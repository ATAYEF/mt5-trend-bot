# -*- coding: utf-8 -*-
"""
موتور هوش مصنوعی کمکی TrendPilot — نسخه‌ی پایتون
====================================================
معادل پایتونیِ ماژول `ai/` که قبلاً با TypeScript (رگرسیون لجستیک
دستی، بدون کتابخانه) نوشته شده بود. اینجا از داده‌ی واقعیِ تاریخیِ
MT5 (نه مصنوعی) استفاده می‌شود و آموزش با scikit-learn انجام می‌شود.

۵ ویژگی (دقیقاً هم‌ارز نسخه‌ی TS):
  1) فاصله‌ی EMA سریع تا کند (نرمال‌شده با ATR)
  2) RSI نرمال‌شده (۰ تا ۱)
  3) درصد ATR نسبت به قیمت
  4) عرض باند بولینگر (نرمال‌شده با قیمت)
  5) نسبت بدنه‌ی کندل به دامنه‌ی کل کندل

برچسب (target): آیا قیمت طی N کندل بعدی به‌اندازه‌ی حداقل یک آستانه
(بر حسب ATR) در جهت مثبت حرکت کرده یا نه (طبقه‌بندی دودویی).

مدل و متادیتا در پوشه‌ی models/ به‌ازای هر (نماد، تایم‌فریم) ذخیره
می‌شود تا predict() بعداً بتواند بارگذاری‌اش کند.
"""
from __future__ import annotations

import json
import os
from datetime import datetime
from typing import Any

import numpy as np
import pandas as pd

try:
    import joblib
    from sklearn.linear_model import LogisticRegression
    from sklearn.model_selection import train_test_split
    from sklearn.preprocessing import StandardScaler
    from sklearn.metrics import accuracy_score, precision_score, recall_score
except ImportError as e:  # pragma: no cover
    raise ImportError(
        "scikit-learn و joblib لازم است: pip install scikit-learn joblib"
    ) from e

from mt5_trend_bot_backtest import Backtester

MODELS_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models")
os.makedirs(MODELS_DIR, exist_ok=True)

# پارامترهای برچسب‌گذاری — می‌توانید تنظیم کنید
FUTURE_BARS = 5          # افق پیش‌بینی (چند کندل جلوتر)
LABEL_ATR_MULTIPLIER = 0.5  # حرکت لازم برای برچسب "مثبت" (بر حسب ATR)


def _wilder_smooth(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(alpha=1.0 / period, adjust=False).mean()


def _calc_indicators(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    df["ema_fast"] = df["close"].ewm(span=20, adjust=False).mean()
    df["ema_slow"] = df["close"].ewm(span=50, adjust=False).mean()

    delta = df["close"].diff()
    gain = delta.clip(lower=0)
    loss = -delta.clip(upper=0)
    avg_gain = _wilder_smooth(gain, 14)
    avg_loss = _wilder_smooth(loss, 14)
    rs = avg_gain / avg_loss.replace(0, np.nan)
    df["rsi"] = 100 - (100 / (1 + rs))
    df["rsi"] = df["rsi"].fillna(50)

    prev_close = df["close"].shift(1)
    tr = pd.concat([
        df["high"] - df["low"],
        (df["high"] - prev_close).abs(),
        (df["low"] - prev_close).abs(),
    ], axis=1).max(axis=1)
    df["atr"] = _wilder_smooth(tr, 14)

    mid = df["close"].rolling(20).mean()
    std = df["close"].rolling(20).std()
    df["bb_width"] = ((mid + 2 * std) - (mid - 2 * std)) / mid.replace(0, np.nan)

    return df


def extract_features(df: pd.DataFrame) -> pd.DataFrame:
    """۵ ویژگی از دیتافریم کندل (باید ستون‌های open/high/low/close داشته باشد)."""
    df = _calc_indicators(df)
    features = pd.DataFrame(index=df.index)
    features["ema_dist"] = (df["ema_fast"] - df["ema_slow"]) / df["atr"].replace(0, np.nan)
    features["rsi_norm"] = df["rsi"] / 100.0
    features["atr_pct"] = df["atr"] / df["close"].replace(0, np.nan)
    features["bb_width"] = df["bb_width"]
    body = (df["close"] - df["open"]).abs()
    full_range = (df["high"] - df["low"]).replace(0, np.nan)
    features["body_ratio"] = body / full_range
    return features


def _build_labels(df: pd.DataFrame) -> pd.Series:
    atr = _calc_indicators(df)["atr"]
    future_max = df["close"].shift(-FUTURE_BARS).rolling(FUTURE_BARS, min_periods=1).max()
    # ساده‌سازی: مقایسه‌ی قیمت N کندل بعد با قیمت فعلی، نسبت به آستانه‌ی ATR
    future_close = df["close"].shift(-FUTURE_BARS)
    move = future_close - df["close"]
    label = (move > (LABEL_ATR_MULTIPLIER * atr)).astype(int)
    return label


def _model_paths(symbol: str, timeframe_minutes: int) -> tuple[str, str]:
    key = f"{symbol}_{timeframe_minutes}m"
    return (
        os.path.join(MODELS_DIR, f"{key}.joblib"),
        os.path.join(MODELS_DIR, f"{key}.meta.json"),
    )


def train(symbol: str, timeframe_minutes: int = 15, bars: int = 5000) -> dict[str, Any]:
    """داده‌ی واقعی تاریخی MT5 را می‌خواند، مدل را آموزش می‌دهد و ذخیره می‌کند."""
    bt = Backtester(config={"TIMEFRAME": timeframe_minutes}, log_callback=None)
    if not bt.connect():
        raise RuntimeError("اتصال به MT5 برقرار نشد")

    resolved = bt.resolve_symbol(symbol)
    if resolved is None:
        raise RuntimeError(f"نماد «{symbol}» نزد بروکر یافت نشد")

    df = bt.fetch_rates(resolved, timeframe_minutes, bars=bars)
    if df is None or len(df) < 200:
        raise RuntimeError("داده‌ی تاریخی کافی دریافت نشد (حداقل ۲۰۰ کندل لازم است)")

    features = extract_features(df)
    labels = _build_labels(df)

    data = pd.concat([features, labels.rename("label")], axis=1).dropna()
    if len(data) < 100:
        raise RuntimeError("پس از حذف مقادیر خالی، داده‌ی کافی برای آموزش باقی نماند")

    X = data[["ema_dist", "rsi_norm", "atr_pct", "bb_width", "body_ratio"]].values
    y = data["label"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False,  # شافل نکن — داده‌ی زمانی است
    )

    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)

    model = LogisticRegression(max_iter=1000)
    model.fit(X_train_scaled, y_train)

    y_pred = model.predict(X_test_scaled)
    accuracy = float(accuracy_score(y_test, y_pred))
    precision = float(precision_score(y_test, y_pred, zero_division=0))
    recall = float(recall_score(y_test, y_pred, zero_division=0))

    model_path, meta_path = _model_paths(resolved, timeframe_minutes)
    joblib.dump({"model": model, "scaler": scaler}, model_path)

    meta = {
        "symbol": resolved,
        "requested_symbol": symbol,
        "timeframe_minutes": timeframe_minutes,
        "bars_requested": bars,
        "samples_total": int(len(data)),
        "samples_train": int(len(X_train)),
        "samples_test": int(len(X_test)),
        "accuracy": round(accuracy, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "positive_rate": round(float(y.mean()), 4),
        "trained_at": datetime.now().isoformat(),
        "future_bars": FUTURE_BARS,
        "label_atr_multiplier": LABEL_ATR_MULTIPLIER,
        "features": ["ema_dist", "rsi_norm", "atr_pct", "bb_width", "body_ratio"],
    }
    with open(meta_path, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    return meta


def predict(symbol: str, timeframe_minutes: int = 15) -> dict[str, Any]:
    """آخرین کندل بسته‌شده را می‌خواند و با آخرین مدلِ آموزش‌دیده پیش‌بینی می‌کند."""
    model_path, meta_path = _model_paths(symbol, timeframe_minutes)
    if not os.path.exists(model_path):
        raise RuntimeError(f"هیچ مدل آموزش‌دیده‌ای برای {symbol}/{timeframe_minutes}m یافت نشد — ابتدا train() را اجرا کنید")

    bundle = joblib.load(model_path)
    model, scaler = bundle["model"], bundle["scaler"]

    bt = Backtester(config={"TIMEFRAME": timeframe_minutes}, log_callback=None)
    if not bt.connect():
        raise RuntimeError("اتصال به MT5 برقرار نشد")
    resolved = bt.resolve_symbol(symbol)
    df = bt.fetch_rates(resolved, timeframe_minutes, bars=200)
    if df is None or len(df) < 60:
        raise RuntimeError("داده‌ی کافی برای محاسبه‌ی ویژگی‌ها دریافت نشد")

    features = extract_features(df).dropna()
    if features.empty:
        raise RuntimeError("محاسبه‌ی ویژگی‌ها ناموفق بود (داده ناکافی)")

    last_row = features.iloc[[-1]][["ema_dist", "rsi_norm", "atr_pct", "bb_width", "body_ratio"]]
    X_scaled = scaler.transform(last_row.values)
    proba_up = float(model.predict_proba(X_scaled)[0][1])

    meta = {}
    if os.path.exists(meta_path):
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)

    return {
        "symbol": resolved,
        "timeframe_minutes": timeframe_minutes,
        "as_of_bar_time": int(df.iloc[-1]["time"]) if "time" in df.columns else None,
        "probability_up": round(proba_up, 4),
        "signal": "buy_bias" if proba_up >= 0.5 else "sell_bias",
        "model_accuracy_on_holdout": meta.get("accuracy"),
        "model_trained_at": meta.get("trained_at"),
    }


def status(symbol: str, timeframe_minutes: int = 15) -> dict[str, Any]:
    """برای تب «موتور AI» در داشبورد — آیا مدلی آموزش دیده، با چه دقتی."""
    _, meta_path = _model_paths(symbol, timeframe_minutes)
    if not os.path.exists(meta_path):
        return {"trained": False, "symbol": symbol, "timeframe_minutes": timeframe_minutes}
    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)
    return {"trained": True, **meta}
