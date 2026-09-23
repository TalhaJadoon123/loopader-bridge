// TradingView-grade technical indicators
export interface Candle { time?: number; open: number; high: number; low: number; close: number; volume: number; }

export function sma(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    out.push(i >= period - 1 ? sum / period : null);
  }
  return out;
}

export function ema(values: number[], period: number): (number | null)[] {
  const out: (number | null)[] = [];
  const k = 2 / (period + 1);
  let prev: number | null = null;
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) { out.push(null); continue; }
    if (i === period - 1) {
      prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
    } else {
      prev = values[i] * k + (prev ?? 0) * (1 - k);
    }
    out.push(prev);
  }
  return out;
}

export function rsi(closes: number[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 0; i < closes.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
        out.push(100 - 100 / (1 + rs));
      } else out.push(null);
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
      out.push(100 - 100 / (1 + rs));
    }
  }
  return out;
}

export function macd(closes: number[], fast = 12, slow = 26, signalP = 9) {
  const fastEma = ema(closes, fast);
  const slowEma = ema(closes, slow);
  const macdLine = closes.map((_, i) => (fastEma[i] != null && slowEma[i] != null ? (fastEma[i] as number) - (slowEma[i] as number) : null));
  const signal = ema(macdLine.filter((v): v is number => v != null), signalP);
  const signalFull: (number | null)[] = macdLine.map((v, i) => {
    const validBefore = macdLine.slice(0, i).filter((x): x is number => x != null).length;
    return signal[validBefore] ?? null;
  });
  const histogram = macdLine.map((v, i) => (v != null && signalFull[i] != null ? v - (signalFull[i] as number) : null));
  return { macdLine, signal: signalFull, histogram };
}

export function bollinger(closes: number[], period = 20, mult = 2) {
  const middle = sma(closes, period);
  const upper: (number | null)[] = [];
  const lower: (number | null)[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { upper.push(null); lower.push(null); continue; }
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / period;
    const variance = slice.reduce((a, b) => a + (b - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper.push(mean + mult * sd);
    lower.push(mean - mult * sd);
  }
  return { upper, middle, lower };
}

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3) {
  const k: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i < kPeriod - 1) { k.push(null); continue; }
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const high = Math.max(...slice.map(c => c.high));
    const low = Math.min(...slice.map(c => c.low));
    k.push(high === low ? 50 : ((candles[i].close - low) / (high - low)) * 100);
  }
  const valid = k.filter((v): v is number => v != null);
  const d = sma(valid, dPeriod);
  const dFull: (number | null)[] = k.map((v, i) => {
    const before = k.slice(0, i).filter((x): x is number => x != null).length;
    return d[before] ?? null;
  });
  return { k, d: dFull };
}

export function atr(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = [];
  for (let i = 0; i < candles.length; i++) {
    if (i === 0) { out.push(null); continue; }
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
if (i <= period) {
      if (i === period) {
        const avg = candles.slice(1, period + 1).reduce((a, b, idx, arr) => {
          const prevC = arr[idx - 1];
          const tr = Math.max(b.high - b.low, Math.abs(b.high - (prevC?.close ?? b.high)), Math.abs(b.low - (prevC?.close ?? b.high)));
          return a + tr;
        }, 0) / period;
        out.push(avg);
      } else out.push(null);
    } else {
      const prevVal = out[i - 1] as number;
      out.push((prevVal * (period - 1) + tr) / period);
    }
  }
  return out;
}

export function vwap(candles: Candle[]): number[] {
  const out: number[] = [];
  let cumVol = 0;
  let cumPV = 0;
  for (const c of candles) {
    const typical = (c.high + c.low + c.close) / 3;
    cumPV += typical * c.volume;
    cumVol += c.volume;
    out.push(cumVol ? cumPV / cumVol : typical);
  }
  return out;
}

export function obv(candles: Candle[]): number[] {
  const out: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) out.push((out[i - 1] ?? 0) + candles[i].volume);
    else if (candles[i].close < candles[i - 1].close) out.push((out[i - 1] ?? 0) - candles[i].volume);
    else out.push(out[i - 1] ?? 0);
  }
  return out;
}

export interface IndicatorResult {
  name: string;
  series: { time: number; value: number }[];
  overlay?: boolean;
  color?: string;
  width?: number;
}

export function computeIndicator(name: string, candles: Candle[]): IndicatorResult[] {
  const closes = candles.map(c => c.close);
  const times = candles.map((c, i) => c.time ?? i);

  const toSeries = (vals: (number | null)[]): { time: number; value: number }[] =>
    vals.map((v, i) => ({ time: times[i], value: v ?? NaN })).filter(p => !isNaN(p.value));

  switch (name) {
    case "SMA": return [{ name: "SMA(20)", overlay: true, color: "#f59e0b", width: 2, series: toSeries(sma(closes, 20)) }];
    case "EMA": return [{ name: "EMA(20)", overlay: true, color: "#3b82f6", width: 2, series: toSeries(ema(closes, 20)) }];
    case "RSI": return [{ name: "RSI(14)", color: "#8b5cf6", series: toSeries(rsi(closes)) }];
    case "MACD": {
      const m = macd(closes);
      return [
        { name: "MACD", color: "#10b981", series: toSeries(m.macdLine) },
        { name: "Signal", color: "#ef4444", series: toSeries(m.signal) },
      ];
    }
    case "BOLL": {
      const b = bollinger(closes);
      return [
        { name: "Upper", overlay: true, color: "#ef4444", width: 1, series: toSeries(b.upper) },
        { name: "Middle", overlay: true, color: "#f59e0b", width: 1, series: toSeries(b.middle) },
        { name: "Lower", overlay: true, color: "#10b981", width: 1, series: toSeries(b.lower) },
      ];
    }
    case "STOCH": {
      const s = stochastic(candles);
      return [
        { name: "%K", color: "#3b82f6", series: toSeries(s.k) },
        { name: "%D", color: "#f59e0b", series: toSeries(s.d) },
      ];
    }
    case "ATR": return [{ name: "ATR(14)", color: "#ec4899", series: toSeries(atr(candles)) }];
    case "VWAP": return [{ name: "VWAP", overlay: true, color: "#06b6d4", width: 2, series: times.map((t, i) => ({ time: t, value: vwap(candles)[i] })) }];
    case "OBV": return [{ name: "OBV", color: "#f59e0b", series: times.map((t, i) => ({ time: t, value: obv(candles)[i] })) }];
    default: return [];
  }
}

export const AVAILABLE_INDICATORS = ["SMA", "EMA", "RSI", "MACD", "BOLL", "STOCH", "ATR", "VWAP", "OBV"];