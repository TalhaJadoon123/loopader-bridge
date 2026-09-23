import { Decimal } from "@prisma/client/runtime/library";

import { getPipValue as assetPip, getContractSize as assetContract, validateVolume as assetVolume, getAsset } from "./assets";

export const TIER_SPREADS = {
  STANDARD: 0.8,
  RAW: 0.2,
  ECN: 0.0,
} as const;

export const TIER_COMMISSION = {
  STANDARD: 0,
  RAW: 9,
  ECN: 7,
} as const;

export const CONTRACT_SIZES: Record<string, number> = {
  EURUSD: 100000,
  GBPUSD: 100000,
  USDJPY: 100000,
  XAUUSD: 100,
  BTCUSD: 1,
  AUDUSD: 100000,
  USDCAD: 100000,
  NZDUSD: 100000,
  USDCHF: 100000,
  EURGBP: 100000,
};

export const MIN_VOLUME = 0.01;
export const MAX_VOLUME = 100;
export const MAX_LEVERAGE = 3000;

export function getContractSize(symbol: string): number {
  return assetContract(symbol) ?? CONTRACT_SIZES[symbol] ?? 100000;
}

export function getPipValue(symbol: string): number {
  const a = getAsset(symbol);
  if (a) return a.pipValue;
  if (symbol === "XAUUSD") return 0.01;
  if (symbol === "BTCUSD") return 0.01;
  if (symbol.endsWith("JPY")) return 0.01;
  return 0.0001;
}

export function getAssetInfo(symbol: string) {
  return getAsset(symbol);
}

export function calculateMargin(volume: number, price: number, leverage: number, symbol: string): number {
  const contractSize = getContractSize(symbol);
  return (volume * contractSize * price) / leverage;
}

export function calculateProfit(
  side: "BUY" | "SELL",
  openPrice: number,
  closePrice: number,
  volume: number,
  symbol: string
): number {
  const contractSize = getContractSize(symbol);
  const diff = side === "BUY" ? closePrice - openPrice : openPrice - closePrice;
  return diff * volume * contractSize;
}

export function calculateRiskLotSize(
  balance: number,
  riskPercent: number,
  slPips: number,
  symbol: string,
  leverage: number
): number {
  const pipValue = getPipValue(symbol);
  const riskAmount = balance * (riskPercent / 100);
  const slPriceDiff = slPips * pipValue;
  const contractSize = getContractSize(symbol);
  const lotSize = riskAmount / (slPriceDiff * contractSize);
  return Math.max(MIN_VOLUME, Math.min(MAX_VOLUME, Math.floor(lotSize * 100) / 100));
}

export function calculateATR(candles: Array<{ high: number; low: number; close: number }>, period = 14): number {
  if (candles.length < period + 1) return 0;
  let sum = 0;
  for (let i = candles.length - period; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    sum += tr;
  }
  return sum / period;
}

export function suggestSLTP(
  side: "BUY" | "SELL",
  price: number,
  atr: number,
  slMultiplier = 1.5,
  tpMultiplier = 3
): { stopLoss: number; takeProfit: number } {
  const slDist = atr * slMultiplier;
  const tpDist = atr * tpMultiplier;
  if (side === "BUY") {
    return { stopLoss: price - slDist, takeProfit: price + tpDist };
  } else {
    return { stopLoss: price + slDist, takeProfit: price - tpDist };
  }
}

export function validateVolume(volume: number): { valid: boolean; message?: string } {
  if (volume < MIN_VOLUME) return { valid: false, message: `Minimum volume is ${MIN_VOLUME}` };
  if (volume > MAX_VOLUME) return { valid: false, message: `Maximum volume is ${MAX_VOLUME}` };
  if (volume * 100 !== Math.floor(volume * 100)) return { valid: false, message: "Volume must have at most 2 decimal places" };
  return { valid: true };
}

export function checkRiskGuard(trades: Array<{ profit: number; openedAt: Date }>): { blocked: boolean; message?: string } {
  const now = Date.now();
  const recentLosers = trades.filter((t) => t.profit < 0 && now - t.openedAt.getTime() < 30 * 60 * 1000);
  if (recentLosers.length >= 3) {
    return { blocked: false, message: "You've had 3 losing trades in 30 minutes. Consider taking a break." };
  }
  return { blocked: false };
}