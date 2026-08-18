// تولید داده‌ی مصنوعی OHLC برای تست (بدون وابستگی به منبع خارجی)
import type { Candle } from "../indicators/engine.js";

export function generateSyntheticCandles(
  count: number,
  opts: { startPrice?: number; trendPerBar?: number; noise?: number; seed?: number } = {}
): Candle[] {
  const { startPrice = 1.1, trendPerBar = 0.0002, noise = 0.0015, seed = 42 } = opts;
  let rngState = seed;
  const rand = () => {
    rngState = (rngState * 1664525 + 1013904223) % 4294967296;
    return rngState / 4294967296;
  };
  const candles: Candle[] = [];
  let price = startPrice;
  let t = Math.floor(Date.now() / 1000) - count * 300;
  for (let i = 0; i < count; i++) {
    const open = price;
    const drift = trendPerBar + (rand() - 0.5) * noise;
    const close = open + drift;
    const high = Math.max(open, close) + rand() * noise * 0.5;
    const low = Math.min(open, close) - rand() * noise * 0.5;
    candles.push({ time: t, open, high, low, close, volume: 100 + Math.floor(rand() * 500) });
    price = close;
    t += 300;
  }
  return candles;
}
