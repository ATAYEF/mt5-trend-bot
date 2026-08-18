"""
پل TrendPilot سمت MT5 — نسخه‌ی پایتون (جایگزین EA برای MQL5)
================================================================
برخلاف EA که باید per-symbol روی هر چارت جداگانه نصب شود، این
اسکریپت یک پروسه‌ی واحد است که مستقیماً با پکیج رسمی MetaTrader5
به ترمینال باز شده وصل می‌شود و همه‌ی نمادهای یک پروفایل را در
یک حلقه پوشش می‌دهد — دقیقاً مثل تجربه‌ی قبلی با پایتون.

اصل طراحی سند رعایت شده: این اسکریپت هیچ محاسبه یا تصمیمی
نمی‌گیرد. فقط:
  ۱) کندل‌های هر نماد را می‌خواند و به سرور می‌فرستد
  ۲) دستور معامله را از پاسخ سرور می‌گیرد
  ۳) همان لحظه با mt5.order_send اجرا می‌کند

نیازمندی‌ها:
  - ویندوز (پکیج MetaTrader5 فقط روی ویندوز کار می‌کند)
  - ترمینال MT5 نصب و باز باشد (لاگین دستی یا از طریق این اسکریپت)
  - pip install -r requirements.txt

اجرا:
  cp .env.example .env   # و مقداردهی کنید
  python bridge.py
"""
from __future__ import annotations

import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any

import MetaTrader5 as mt5
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(
            os.path.join(os.path.dirname(os.path.abspath(__file__)), "bridge.log"),
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("trendpilot-bridge")


# ============================================================
# تنظیمات — از .env خوانده می‌شود
# ============================================================
@dataclass
class Config:
    server_base_url: str
    profile_name: str
    symbols: list[str]
    timeframe_minutes: int
    poll_interval_sec: int
    candles_to_send: int
    default_volume: float
    mt5_login: int | None
    mt5_password: str | None
    mt5_server: str | None
    mt5_path: str | None

    @staticmethod
    def from_env() -> "Config":
        symbols_raw = os.getenv("SYMBOLS", "EURUSD")
        login_raw = os.getenv("MT5_LOGIN", "").strip()
        return Config(
            server_base_url=os.getenv("SERVER_BASE_URL", "http://localhost:8787").rstrip("/"),
            profile_name=os.getenv("PROFILE_NAME", "Default"),
            symbols=[s.strip() for s in symbols_raw.split(",") if s.strip()],
            timeframe_minutes=int(os.getenv("TIMEFRAME_MINUTES", "15")),
            poll_interval_sec=int(os.getenv("POLL_INTERVAL_SEC", "5")),
            candles_to_send=int(os.getenv("CANDLES_TO_SEND", "150")),
            default_volume=float(os.getenv("DEFAULT_VOLUME", "0.01")),
            mt5_login=int(login_raw) if login_raw else None,
            mt5_password=os.getenv("MT5_PASSWORD") or None,
            mt5_server=os.getenv("MT5_SERVER") or None,
            mt5_path=os.getenv("MT5_PATH") or None,
        )


# نگاشت دقیقه به ثابت تایم‌فریم MT5
TIMEFRAME_MAP: dict[int, int] = {
    1: mt5.TIMEFRAME_M1,
    5: mt5.TIMEFRAME_M5,
    15: mt5.TIMEFRAME_M15,
    30: mt5.TIMEFRAME_M30,
    60: mt5.TIMEFRAME_H1,
    240: mt5.TIMEFRAME_H4,
    1440: mt5.TIMEFRAME_D1,
}


@dataclass
class SymbolState:
    last_sent_bar_time: int | None = None


class TrendPilotBridge:
    def __init__(self, config: Config):
        self.config = config
        self.session = requests.Session()
        self.states: dict[str, SymbolState] = {s: SymbolState() for s in config.symbols}

    # --------------------------------------------------------
    # اتصال به MT5
    # --------------------------------------------------------
    def connect(self) -> None:
        init_kwargs: dict[str, Any] = {}
        if self.config.mt5_path:
            init_kwargs["path"] = self.config.mt5_path

        if not mt5.initialize(**init_kwargs):
            raise RuntimeError(f"اتصال به MT5 ناموفق بود: {mt5.last_error()}")

        if self.config.mt5_login and self.config.mt5_password and self.config.mt5_server:
            ok = mt5.login(
                self.config.mt5_login,
                password=self.config.mt5_password,
                server=self.config.mt5_server,
            )
            if not ok:
                raise RuntimeError(f"لاگین به حساب MT5 ناموفق بود: {mt5.last_error()}")

        account = mt5.account_info()
        if account is None:
            raise RuntimeError("اطلاعات حساب MT5 در دسترس نیست — مطمئن شوید ترمینال لاگین است")

        log.info(
            "به MT5 وصل شد — حساب %s روی سرور %s — بالانس %.2f %s",
            account.login, account.server, account.balance, account.currency,
        )
        for symbol in self.config.symbols:
            if not mt5.symbol_select(symbol, True):
                log.warning("نماد %s در Market Watch در دسترس نیست", symbol)

    def disconnect(self) -> None:
        mt5.shutdown()

    # --------------------------------------------------------
    # خواندن کندل‌ها و ساخت payload — فقط داده، بدون هیچ منطقی
    # --------------------------------------------------------
    def fetch_candles(self, symbol: str) -> list[dict[str, Any]] | None:
        tf = TIMEFRAME_MAP.get(self.config.timeframe_minutes)
        if tf is None:
            log.error("تایم‌فریم %s دقیقه‌ای پشتیبانی نمی‌شود", self.config.timeframe_minutes)
            return None

        rates = mt5.copy_rates_from_pos(symbol, tf, 0, self.config.candles_to_send)
        if rates is None or len(rates) < 2:
            log.warning("کندل کافی برای %s دریافت نشد: %s", symbol, mt5.last_error())
            return None

        candles = [
            {
                "time": int(r["time"]),
                "open": float(r["open"]),
                "high": float(r["high"]),
                "low": float(r["low"]),
                "close": float(r["close"]),
                "volume": int(r["tick_volume"]),
            }
            for r in rates
        ]
        return candles

    # --------------------------------------------------------
    # فراخوانی سرور
    # --------------------------------------------------------
    def call_analyze(self, symbol: str, candles: list[dict[str, Any]]) -> dict[str, Any] | None:
        url = f"{self.config.server_base_url}/api/v1/analyze"
        payload = {
            "profile_name": self.config.profile_name,
            "symbol": symbol,
            "timeframeMinutes": self.config.timeframe_minutes,
            "candles": candles,
        }
        try:
            resp = self.session.post(url, json=payload, timeout=8)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            log.error("خطا در ارتباط با سرور برای %s: %s", symbol, exc)
            return None

    # --------------------------------------------------------
    # اجرای دستور — بدون هیچ تصمیم اضافه‌ای
    # --------------------------------------------------------
    def execute_decision(self, symbol: str, decision: dict[str, Any]) -> None:
        order = decision.get("order")
        if not order or order == "hold":
            return

        if order == "close":
            self.close_all_positions(symbol)
            return

        if order not in ("buy", "sell"):
            log.warning("دستور ناشناخته از سرور برای %s: %s", symbol, order)
            return

        volume = decision.get("volume") or self.config.default_volume
        sl = decision.get("sl")
        tp = decision.get("tp")

        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            log.error("قیمت لحظه‌ای %s در دسترس نیست", symbol)
            return

        price = tick.ask if order == "buy" else tick.bid
        order_type = mt5.ORDER_TYPE_BUY if order == "buy" else mt5.ORDER_TYPE_SELL

        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": symbol,
            "volume": float(volume),
            "type": order_type,
            "price": price,
            "sl": float(sl) if sl is not None else 0.0,
            "tp": float(tp) if tp is not None else 0.0,
            "deviation": 20,
            "magic": 0,
            "comment": "TrendPilot",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }

        result = mt5.order_send(request)
        if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
            log.error("خطا در اجرای سفارش %s روی %s: %s", order, symbol, result)
        else:
            log.info(
                "سفارش %s روی %s اجرا شد — تیکت %s — دلیل سرور: %s",
                order, symbol, result.order, decision.get("reason", ""),
            )

    def close_all_positions(self, symbol: str) -> None:
        positions = mt5.positions_get(symbol=symbol)
        if not positions:
            return
        for pos in positions:
            tick = mt5.symbol_info_tick(symbol)
            if tick is None:
                continue
            is_buy = pos.type == mt5.POSITION_TYPE_BUY
            request = {
                "action": mt5.TRADE_ACTION_DEAL,
                "symbol": symbol,
                "volume": pos.volume,
                "type": mt5.ORDER_TYPE_SELL if is_buy else mt5.ORDER_TYPE_BUY,
                "position": pos.ticket,
                "price": tick.bid if is_buy else tick.ask,
                "deviation": 20,
                "comment": "TrendPilot close",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": mt5.ORDER_FILLING_IOC,
            }
            result = mt5.order_send(request)
            if result is None or result.retcode != mt5.TRADE_RETCODE_DONE:
                log.error("خطا در بستن پوزیشن %s: %s", pos.ticket, result)
            else:
                log.info("پوزیشن %s (%s) بسته شد", pos.ticket, symbol)

    # --------------------------------------------------------
    # حلقه‌ی اصلی — همه‌ی نمادهای پروفایل را پشت سر هم پردازش می‌کند
    # --------------------------------------------------------
    def run_forever(self) -> None:
        log.info(
            "شروع پایش %d نماد برای پروفایل «%s» — هر %d ثانیه",
            len(self.config.symbols), self.config.profile_name, self.config.poll_interval_sec,
        )
        while True:
            # بررسی سلامت اتصال ترمینال — اگر MT5 بسته/قطع شده باشد،
            # استثنا پرتاب می‌شود تا حلقه‌ی بیرونی در main() دوباره وصل شود
            if mt5.terminal_info() is None:
                raise RuntimeError("اتصال به ترمینال MT5 قطع شده است")

            for symbol in self.config.symbols:
                try:
                    self.process_symbol(symbol)
                except Exception:
                    log.exception("خطای غیرمنتظره هنگام پردازش %s", symbol)
            time.sleep(self.config.poll_interval_sec)

    def process_symbol(self, symbol: str) -> None:
        candles = self.fetch_candles(symbol)
        if not candles:
            return

        last_bar_time = candles[-1]["time"]
        state = self.states[symbol]
        if state.last_sent_bar_time == last_bar_time:
            # از ارسال تکراری همان کندل بسته‌نشده جلوگیری می‌کند (بهینه‌سازی ترافیک)
            return
        state.last_sent_bar_time = last_bar_time

        decision = self.call_analyze(symbol, candles)
        if decision is None:
            return

        self.execute_decision(symbol, decision)


def main() -> None:
    config = Config.from_env()
    if not config.symbols:
        log.error("هیچ نمادی در SYMBOLS تنظیم نشده — .env را بررسی کنید")
        return

    reconnect_delay_sec = 5
    max_reconnect_delay_sec = 60

    # حلقه‌ی بیرونی: اگر اتصال به MT5 یا حلقه‌ی اصلی به هر دلیلی قطع شد
    # (ری‌استارت MT5، قطعی اینترنت، خطای غیرمنتظره)، به‌جای بستن کامل
    # برنامه، دوباره تلاش می‌کند — مناسب اجرای دائمی/بی‌ناظر.
    while True:
        bridge = TrendPilotBridge(config)
        try:
            bridge.connect()
            reconnect_delay_sec = 5  # بعد از اتصال موفق، تأخیر را ریست کن
            bridge.run_forever()
        except KeyboardInterrupt:
            log.info("متوقف شد توسط کاربر")
            bridge.disconnect()
            return
        except Exception:
            log.exception(
                "اتصال قطع شد یا خطای غیرمنتظره رخ داد — تلاش مجدد در %d ثانیه",
                reconnect_delay_sec,
            )
            bridge.disconnect()
            time.sleep(reconnect_delay_sec)
            reconnect_delay_sec = min(reconnect_delay_sec * 2, max_reconnect_delay_sec)


if __name__ == "__main__":
    main()
