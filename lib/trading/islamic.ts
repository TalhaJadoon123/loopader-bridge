// swap-free account tiers (Islamic accounts)
export const SWAP_FREE_TIERS = ["STANDARD", "RAW", "ECN"] as const;

export function isSwapFreeAccount(tier: string, isIslamic: boolean): boolean {
  return isIslamic && SWAP_FREE_TIERS.includes(tier as any);
}

export function getSwapRate(symbol: string, tier: string, isIslamic: boolean): { long: number; short: number } {
  if (isIslamic) return { long: 0, short: 0 };
  const rates: Record<string, { long: number; short: number }> = {
    EURUSD: { long: -2.5, short: 0.5 },
    GBPUSD: { long: -2.8, short: 0.3 },
    USDJPY: { long: -1.5, short: 1.5 },
    XAUUSD: { long: -3.0, short: 1.0 },
    BTCUSD: { long: -5.0, short: 2.0 },
    USOIL: { long: -4.0, short: 1.0 },
    SPX500: { long: -1.5, short: 0.5 },
  };
  return rates[symbol] ?? { long: -2.0, short: 0.5 };
}