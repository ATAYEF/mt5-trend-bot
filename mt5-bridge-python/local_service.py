# -*- coding: utf-8 -*-
"""
سرویس محلی TrendPilot — جایگزین bridge.py و mt5_trend_bot_gui.py
====================================================================
این فایل روی همان کامپیوتری اجرا می‌شود که ترمینال MT5 روی آن نصب و
باز است (طبق تصمیم: PC شخصی، نه VPS ۲۴/۷). برخلاف نسخه‌ی قبلی
bridge.py (که فقط کندل رله می‌کرد و تصمیم را از یک سرور TypeScript
می‌گرفت)، این نسخه **مغز اصلی را دوباره در پایتون نگه می‌دارد**:

  - همان `TrendBot` از mt5_trend_bot_core.py (بدون هیچ تغییری در منطق)
    برای اجرای زنده‌ی چند پروفایل هم‌زمان
  - همان `Backtester` از mt5_trend_bot_backtest.py برای بک‌تست با
    داده‌ی واقعی تاریخی MT5 (نه داده‌ی مصنوعی)
  - ماژول جدید ai_engine.py برای آموزش/پیش‌بینی هوش مصنوعی

این اسکریپت فقط با HTTP به سرور وب وصل می‌شود — یک حلقه‌ی همگام‌سازی
ساده به‌جای اجرای هر منطق معاملاتی روی سرور:

  ۱) هر چند ثانیه، وضعیت لحظه‌ای همه‌ی پروفایل‌های در حال اجرا را
     POST می‌کند به /api/local/status
  ۲) هر چند ثانیه، دستورات معلق را از GET /api/local/commands
     می‌خواند و محلی اجرا می‌کند (start/stop/save_profile/...)
  ۳) نتیجه‌ی هر دستور (به‌خصوص بک‌تست و آموزش AI که طول می‌کشند) را
     در یک ترد جدا اجرا کرده و بعد از اتمام POST می‌کند به
     /api/local/commands/{id}/done

چون PC گاهی خاموش/آفلاین است: اگر اینترنت/سرور در دسترس نباشد، این
اسکریپت کرش نمی‌کند — فقط لاگ می‌کند و در چرخه‌ی بعدی دوباره تلاش
می‌کند. معاملات زنده (start شده) در این مدت هم‌چنان طبق منطق خودشان
کار می‌کنند؛ فقط داشبورد وب موقتاً «آفلاین» نشان داده می‌شود.

اجرا:
    pip install -r requirements.txt
    cp .env.example .env   # و مقداردهی کنید
    python local_service.py

برای اجرای خودکار/پس‌زمینه از همان start.bat / run_hidden.vbs /
install_autostart.bat قبلی استفاده کنید — فقط در آن‌ها به‌جای
bridge.py بنویسید local_service.py.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import asdict, is_dataclass
from datetime import datetime, date
from typing import Any

import requests
from dotenv import load_dotenv

from mt5_trend_bot_core import TrendBot, generate_profile_magic_number
from mt5_trend_bot_backtest import Backtester
import ai_engine

load_dotenv()

# ============================================================
# لاگ — هم‌زمان کنسول و فایل (برای اجرای بی‌ناظر پس‌زمینه)
# ============================================================
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_service.log"),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("trendpilot-local")


# ============================================================
# بافر لاگ — خطوط جدید هر چرخه به سرور push می‌شوند (برای تب لاگ وب)
# ============================================================
class _BufferHandler(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.INFO)
        self.buffer: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        try:
            self.buffer.append(self.format(record))
        except Exception:
            pass

    def drain(self) -> list[str]:
        lines, self.buffer = self.buffer, []
        return lines


_log_buffer_handler = _BufferHandler()
_log_buffer_handler.setFormatter(logging.Formatter("%(asctime)s [%(levelname)s] %(message)s", "%H:%M:%S"))
logging.getLogger().addHandler(_log_buffer_handler)

# ============================================================
# تنظیمات از .env
# ============================================================
SERVER_BASE_URL = os.getenv("SERVER_BASE_URL", "http://localhost:8787").rstrip("/")
API_SECRET = os.getenv("API_SECRET", "")
SYNC_INTERVAL_SEC = int(os.getenv("SYNC_INTERVAL_SEC", "5"))
PROFILES_FILE = os.getenv("PROFILES_FILE", "profiles.json")
DEFAULT_PROFILE_NAME = "پیش‌فرض"

HEADERS = {"Authorization": f"Bearer {API_SECRET}"} if API_SECRET else {}

# قفل مشترک — بک‌تست و آموزش AI هر دو مستقیماً با mt5.copy_rates_*
# داده‌ی تاریخی می‌خوانند؛ اگر هم‌زمان با حلقه‌ی زنده‌ی یکی از
# TrendBotها اجرا شوند، بهتر است تداخل نکنند. اگر نسخه‌ی واقعی
# core.py شما از قبل قفل داخلی (MT5_LOCK) دارد، این یکی اضافی ولی
# بی‌ضرر است؛ اگر ندارد، این حداقلِ لازم برای جلوگیری از تداخل است.
MT5_HEAVY_OP_LOCK = threading.Lock()


def _json_default(o: Any):
    if isinstance(o, (datetime, date)):
        return o.isoformat()
    if is_dataclass(o):
        return asdict(o)
    return str(o)


# ============================================================
# مدیریت پروفایل‌ها — همان فرمت profiles.json که GUI قبلی می‌ساخت
# ============================================================
class ProfileStore:
    def __init__(self, path: str):
        self.path = path
        self.profiles: dict[str, dict] = {}
        self.load()

    def load(self) -> None:
        if os.path.exists(self.path):
            try:
                with open(self.path, "r", encoding="utf-8") as f:
                    self.profiles = json.load(f)
                log.info("پروفایل‌ها بارگذاری شد: %s", list(self.profiles.keys()))
                return
            except Exception:
                log.exception("خواندن %s ناموفق بود — با پروفایل خالی شروع می‌شود", self.path)
        self.profiles = {}

    def save(self) -> None:
        with open(self.path, "w", encoding="utf-8") as f:
            json.dump(self.profiles, f, ensure_ascii=False, indent=2)

    def upsert(self, name: str, config: dict) -> dict:
        config = dict(config)
        config["PROFILE_NAME"] = name
        config.setdefault("MAGIC_NUMBER", generate_profile_magic_number(name, set(
            p.get("MAGIC_NUMBER") for p in self.profiles.values() if p.get("MAGIC_NUMBER")
        )))
        self.profiles[name] = config
        self.save()
        return config

    def delete(self, name: str) -> None:
        self.profiles.pop(name, None)
        self.save()

    def duplicate(self, source: str, new_name: str) -> dict:
        base = dict(self.profiles.get(source, {}))
        base["PROFILE_NAME"] = new_name
        base["MAGIC_NUMBER"] = generate_profile_magic_number(new_name, set(
            p.get("MAGIC_NUMBER") for p in self.profiles.values() if p.get("MAGIC_NUMBER")
        ))
        self.profiles[new_name] = base
        self.save()
        return base


# ============================================================
# مدیریت TrendBotهای در حال اجرا (یک نمونه به‌ازای هر پروفایلِ start‌شده)
# ============================================================
class BotManager:
    def __init__(self, store: ProfileStore):
        self.store = store
        self.bots: dict[str, TrendBot] = {}

    def _make_logger(self, profile_name: str):
        def _cb(entry: str):
            log.info("[%s] %s", profile_name, entry)
        return _cb

    def start(self, profile_name: str) -> None:
        config = self.store.profiles.get(profile_name)
        if config is None:
            raise ValueError(f"پروفایل «{profile_name}» یافت نشد")
        bot = self.bots.get(profile_name)
        if bot is None:
            bot = TrendBot(config=config, log_callback=self._make_logger(profile_name))
            self.bots[profile_name] = bot
        else:
            bot.config = {**bot.config, **config}
        if not bot.connect():
            raise RuntimeError("اتصال به MT5 ناموفق بود")
        bot.start()
        log.info("پروفایل «%s» استارت شد", profile_name)

    def stop(self, profile_name: str) -> None:
        bot = self.bots.get(profile_name)
        if bot:
            bot.stop()
            log.info("پروفایل «%s» متوقف شد", profile_name)

    def is_running(self, profile_name: str) -> bool:
        bot = self.bots.get(profile_name)
        return bool(bot and bot.is_running())

    def open_chart(self, profile_name: str, symbol: str) -> None:
        bot = self.bots.get(profile_name)
        if bot is None:
            raise ValueError(f"پروفایل «{profile_name}» در حال اجرا نیست")
        if hasattr(bot, "open_chart"):
            bot.open_chart(symbol)
        else:
            log.warning("core.py متد open_chart ندارد — نادیده گرفته شد")

    def snapshot(self, profile_name: str) -> dict | None:
        bot = self.bots.get(profile_name)
        if bot is None:
            return None
        return bot.get_status_snapshot()

    def report(self, profile_name: str, days: int = 7, start_date=None, end_date=None) -> dict:
        config = self.store.profiles.get(profile_name)
        if config is None:
            raise ValueError(f"پروفایل «{profile_name}» یافت نشد")
        bot = self.bots.get(profile_name) or TrendBot(config=config, log_callback=self._make_logger(profile_name))
        return bot.get_performance_report(days=days, start_date=start_date, end_date=end_date)


# ============================================================
# اجرای دستورات
# ============================================================
class CommandRunner:
    def __init__(self, store: ProfileStore, bots: BotManager, session: requests.Session):
        self.store = store
        self.bots = bots
        self.session = session

    def _post_done(self, command_id: str, status: str, result: Any = None, error: str | None = None) -> None:
        url = f"{SERVER_BASE_URL}/api/local/commands/{command_id}/done"
        body = {"status": status, "result": result, "error": error}
        try:
            self.session.post(url, json=json.loads(json.dumps(body, default=_json_default)),
                               headers=HEADERS, timeout=15)
        except requests.RequestException:
            log.exception("ارسال نتیجه‌ی دستور %s ناموفق بود", command_id)

    def handle(self, cmd: dict) -> None:
        cmd_id = cmd["id"]
        cmd_type = cmd["type"]
        payload = cmd.get("payload") or {}
        try:
            if cmd_type == "start":
                self.bots.start(payload["profile_name"])
                self._post_done(cmd_id, "done")

            elif cmd_type == "stop":
                self.bots.stop(payload["profile_name"])
                self._post_done(cmd_id, "done")

            elif cmd_type == "save_profile":
                cfg = self.store.upsert(payload["profile_name"], payload.get("config", {}))
                self._post_done(cmd_id, "done", result=cfg)

            elif cmd_type == "delete_profile":
                name = payload["profile_name"]
                self.bots.stop(name)
                self.store.delete(name)
                self._post_done(cmd_id, "done")

            elif cmd_type == "duplicate_profile":
                cfg = self.store.duplicate(payload["source_name"], payload["new_name"])
                self._post_done(cmd_id, "done", result=cfg)

            elif cmd_type == "get_report":
                result = self.bots.report(
                    payload["profile_name"],
                    days=payload.get("days", 7),
                    start_date=payload.get("start_date"),
                    end_date=payload.get("end_date"),
                )
                self._post_done(cmd_id, "done", result=result)

            elif cmd_type == "run_backtest":
                # طول می‌کشد — در ترد جدا تا حلقه‌ی sync اصلی بلاک نشود
                threading.Thread(target=self._run_backtest, args=(cmd_id, payload), daemon=True).start()

            elif cmd_type == "train_ai":
                threading.Thread(target=self._train_ai, args=(cmd_id, payload), daemon=True).start()

            elif cmd_type == "predict_ai":
                threading.Thread(target=self._predict_ai, args=(cmd_id, payload), daemon=True).start()

            elif cmd_type == "ai_status":
                result = ai_engine.status(payload["symbol"], payload.get("timeframe_minutes", 15))
                self._post_done(cmd_id, "done", result=result)

            elif cmd_type == "open_chart":
                self.bots.open_chart(payload["profile_name"], payload["symbol"])
                self._post_done(cmd_id, "done")

            else:
                self._post_done(cmd_id, "failed", error=f"نوع دستور ناشناخته: {cmd_type}")

        except Exception as exc:
            log.exception("خطا در اجرای دستور %s (%s)", cmd_id, cmd_type)
            self._post_done(cmd_id, "failed", error=str(exc))

    def _run_backtest(self, cmd_id: str, payload: dict) -> None:
        """
        پشتیبانی از چند نماد هم‌زمان (چون فرم وب می‌تونه چند symbol
        بفرسته) — روی هر نماد جدا اجرا می‌شه، نتیجه‌ها با
        _combine_backtest_results ترکیب می‌شن تا خروجی دقیقاً شکل
        BacktestResultPayload فرانت‌اند (trades[], per_symbol[], ...) باشه.
        """
        try:
            base_config = dict(payload.get("config") or self.store.profiles.get(payload.get("profile_name", ""), {}))
            symbols = payload.get("symbols") or ([payload["symbol"]] if payload.get("symbol") else [])
            if not symbols:
                raise ValueError("هیچ نمادی برای بک‌تست مشخص نشده")

            per_symbol_results = []
            with MT5_HEAVY_OP_LOCK:
                for sym in symbols:
                    bt = Backtester(config=base_config, log_callback=lambda m: log.info("[backtest] %s", m))
                    result = bt.run(
                        symbol=sym,
                        start=_parse_dt(payload.get("start_date")),
                        end=_parse_dt(payload.get("end_date")),
                        bars=payload.get("bars"),
                    )
                    per_symbol_results.append((sym, result))

            combined = _combine_backtest_results(per_symbol_results)
            self._post_done(cmd_id, "done", result=combined)
        except Exception as exc:
            log.exception("بک‌تست ناموفق بود")
            self._post_done(cmd_id, "failed", error=str(exc))

    def _train_ai(self, cmd_id: str, payload: dict) -> None:
        try:
            with MT5_HEAVY_OP_LOCK:
                result = ai_engine.train(
                    symbol=payload["symbol"],
                    timeframe_minutes=payload.get("timeframe_minutes", payload.get("timeframe", 15)),
                    bars=payload.get("bars", 5000),
                )
            self._post_done(cmd_id, "done", result=result)
        except Exception as exc:
            log.exception("آموزش AI ناموفق بود")
            self._post_done(cmd_id, "failed", error=str(exc))

    def _predict_ai(self, cmd_id: str, payload: dict) -> None:
        try:
            with MT5_HEAVY_OP_LOCK:
                result = ai_engine.predict(
                    symbol=payload["symbol"],
                    timeframe_minutes=payload.get("timeframe_minutes", payload.get("timeframe", 15)),
                )
            self._post_done(cmd_id, "done", result=result)
        except Exception as exc:
            log.exception("پیش‌بینی AI ناموفق بود")
            self._post_done(cmd_id, "failed", error=str(exc))


def _combine_backtest_results(per_symbol_results: list[tuple[str, Any]]) -> dict:
    """چند BacktestResult (هرکدام برای یک نماد) رو به شکل BacktestResultPayload فرانت ترکیب می‌کنه."""
    all_trades: list[dict] = []
    per_symbol_stats: list[dict] = []
    total_profit = 0.0
    wins = 0
    losses = 0
    tips: list[str] = []
    advanced_combined: dict = {}

    for sym, result in per_symbol_results:
        rd = asdict(result)
        trades = rd.get("trades", [])
        all_trades.extend(trades)
        total_profit += rd.get("total_profit", 0.0)
        wins += rd.get("wins", 0)
        losses += rd.get("losses", 0)
        tips.extend(rd.get("tips", []) or [])
        sym_trade_count = len(trades)
        sym_wins = sum(1 for t in trades if t.get("profit", 0) > 0)
        per_symbol_stats.append({
            "symbol": sym,
            "total_profit": rd.get("total_profit", 0.0),
            "total_trades": sym_trade_count,
            "win_rate": round(100 * sym_wins / sym_trade_count, 2) if sym_trade_count else 0.0,
            "profit_factor": rd.get("advanced", {}).get("profit_factor", 0.0),
            "max_drawdown_percent": rd.get("max_dd_pct", 0.0),
            "expectancy": rd.get("advanced", {}).get("expectancy", 0.0),
        })
        advanced_combined[sym] = rd.get("advanced", {})

    total_trades = wins + losses
    win_rate = round(100 * wins / total_trades, 2) if total_trades else 0.0
    max_dd_pct = max((rd.get("max_dd_pct", 0.0) for _, rd in [(s, asdict(r)) for s, r in per_symbol_results]), default=0.0)
    max_dd_money = max((rd.get("max_dd_money", 0.0) for _, rd in [(s, asdict(r)) for s, r in per_symbol_results]), default=0.0)

    return {
        "total_profit": round(total_profit, 2),
        "wins": wins,
        "losses": losses,
        "win_rate": win_rate,
        "max_dd_pct": max_dd_pct,
        "max_dd_money": max_dd_money,
        "advanced": advanced_combined,
        "tips": list(dict.fromkeys(tips)),  # حذف تکراری‌ها با حفظ ترتیب
        "trades": all_trades,
        "per_symbol": per_symbol_stats,
    }


def _parse_dt(value: str | None):
    if not value:
        return None
    return datetime.fromisoformat(value)


# ============================================================
# حلقه‌ی همگام‌سازی اصلی
# ============================================================
def sync_loop(store: ProfileStore, bots: BotManager, runner: CommandRunner, session: requests.Session) -> None:
    log.info("شروع همگام‌سازی با سرور: %s", SERVER_BASE_URL)
    while True:
        # ۱) push وضعیت همه‌ی پروفایل‌های شناخته‌شده (اجراشده یا نه)
        try:
            status_payload = {
                "ts": datetime.now().isoformat(),
                "profiles": {
                    name: {
                        "running": bots.is_running(name),
                        "snapshot": bots.snapshot(name),
                        "config": cfg,
                    }
                    for name, cfg in store.profiles.items()
                },
            }
            resp = session.post(
                f"{SERVER_BASE_URL}/api/local/status",
                data=json.dumps(status_payload, default=_json_default),
                headers={**HEADERS, "Content-Type": "application/json"},
                timeout=10,
            )
            resp.raise_for_status()
        except requests.RequestException as exc:
            log.warning("push وضعیت ناموفق بود (احتمالاً آفلاین): %s", exc)

        # ۲) خواندن و اجرای دستورات معلق
        try:
            resp = session.get(f"{SERVER_BASE_URL}/api/local/commands", headers=HEADERS, timeout=10)
            resp.raise_for_status()
            for cmd in resp.json():
                runner.handle(cmd)
        except requests.RequestException as exc:
            log.warning("دریافت دستورات ناموفق بود (احتمالاً آفلاین): %s", exc)

        # ۳) push خطوط لاگ جدید (برای تب لاگ در داشبورد وب)
        new_lines = _log_buffer_handler.drain()
        if new_lines:
            try:
                session.post(
                    f"{SERVER_BASE_URL}/api/local/logs",
                    json={"lines": new_lines},
                    headers=HEADERS,
                    timeout=10,
                )
            except requests.RequestException:
                # اگه push نشد، خط‌ها رو گم نکن — برگردون به بافر برای چرخه‌ی بعد
                _log_buffer_handler.buffer = new_lines + _log_buffer_handler.buffer

        time.sleep(SYNC_INTERVAL_SEC)


def main() -> None:
    store = ProfileStore(PROFILES_FILE)
    if not store.profiles:
        # همان رفتار قبلیِ GUI: اگر هیچ profiles.json نبود، یک پروفایل
        # پیش‌فرض از config.json قدیمی (اگر بود) یا از صفر بساز
        legacy_path = "config.json"
        legacy_cfg = {}
        if os.path.exists(legacy_path):
            with open(legacy_path, "r", encoding="utf-8") as f:
                legacy_cfg = json.load(f)
        store.upsert(DEFAULT_PROFILE_NAME, legacy_cfg)

    bots = BotManager(store)
    session = requests.Session()
    runner = CommandRunner(store, bots, session)

    try:
        sync_loop(store, bots, runner, session)
    except KeyboardInterrupt:
        log.info("متوقف شد توسط کاربر — توقف همه‌ی پروفایل‌های در حال اجرا")
        for name in list(bots.bots.keys()):
            bots.stop(name)


if __name__ == "__main__":
    main()
