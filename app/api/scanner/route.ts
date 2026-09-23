import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/market-data";
import { ALL_SYMBOLS } from "@/lib/trading/assets";
import { computeIndicator } from "@/lib/indicators";
import { fetchCandles } from "@/lib/market-data";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scanType = searchParams.get("type") ?? "all"; // all | oversold | overbought | macd_bull | macd_bear | bb_squeeze
  const assetClass = searchParams.get("class");

  // Get all symbols (filtered by class if specified)
  let symbols = ALL_SYMBOLS;
  if (assetClass) {
    const { getAssetsByClass } = await import("@/lib/trading/assets");
    symbols = getAssetsByClass(assetClass as any).map(a => a.symbol);
  }

  // Limit to 30 symbols per scan to stay within timeout
  const symbolsToScan = symbols.slice(0, 30);

  // Fetch quotes for all symbols at once
  const quotes = await fetchQuotes(symbolsToScan).catch(() => []);
  const quoteMap = new Map(quotes.map(q => [q.symbol, q]));

  // Scan each symbol for signals
  const signals: Array<{
    symbol: string;
    price: number;
    change24h: number;
    rsi: number | null;
    rsiSignal: string;
    macdSignal: string;
    bbSignal: string;
    overallSignal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
    score: number;
  }> = [];

  // Process in batches of 5 to avoid timeout
  const batchSize = 5;
  for (let i = 0; i < symbolsToScan.length; i += batchSize) {
    const batch = symbolsToScan.slice(i, i + batchSize);
    await Promise.all(batch.map(async (sym) => {
      const quote = quoteMap.get(sym);
      if (!quote || quote.price <= 0) return;

      try {
        const candles = await fetchCandles(sym, "1h");
        if (!candles || candles.length < 20) return;

        // RSI
        const rsiResult = computeIndicator("RSI", candles);
        const rsiValue = rsiResult[0]?.series?.[rsiResult[0].series.length - 1]?.value ?? null;

        // MACD
        const macdResult = computeIndicator("MACD", candles);
        const macdLine = macdResult.find((m: any) => m.name === "MACD");
        const signalLine = macdResult.find((m: any) => m.name === "Signal");
        const lastMacd = macdLine?.series?.[macdLine.series.length - 1]?.value ?? null;
        const lastSignal = signalLine?.series?.[signalLine.series.length - 1]?.value ?? null;
        const macdSignal = lastMacd !== null && lastSignal !== null
          ? (lastMacd > lastSignal ? "BULLISH" : "BEARISH")
          : "N/A";

        // Bollinger
        const bollResult = computeIndicator("BOLL", candles);
        const bbUpper = bollResult.find((b: any) => b.name === "Upper");
        const bbLower = bollResult.find((b: any) => b.name === "Lower");
        const lastUpper = bbUpper?.series?.[bbUpper.series.length - 1]?.value ?? null;
        const lastLower = bbLower?.series?.[bbLower.series.length - 1]?.value ?? null;
        const bbSignal = lastUpper !== null && lastLower !== null
          ? (quote.price >= lastUpper ? "OVERBOUGHT" : quote.price <= lastLower ? "OVERSOLD" : "NEUTRAL")
          : "N/A";

        // Calculate RSI signal
        let rsiSignal = "NEUTRAL";
        if (rsiValue !== null) {
          if (rsiValue < 30) rsiSignal = "OVERSOLD";
          else if (rsiValue < 40) rsiSignal = "APPROACHING_OVERSOLD";
          else if (rsiValue > 70) rsiSignal = "OVERBOUGHT";
          else if (rsiValue > 60) rsiSignal = "APPROACHING_OVERBOUGHT";
        }

        // Score: -100 to +100 (negative = bearish, positive = bullish)
        let score = 0;
        if (rsiValue !== null) {
          if (rsiValue < 30) score += 30;
          else if (rsiValue < 40) score += 15;
          else if (rsiValue > 70) score -= 30;
          else if (rsiValue > 60) score -= 15;
          else score += 5; // neutral zone is slightly positive
        }
        if (macdSignal === "BULLISH") score += 25;
        else if (macdSignal === "BEARISH") score -= 25;
        if (bbSignal === "OVERSOLD") score += 20;
        else if (bbSignal === "OVERBOUGHT") score -= 20;

        // 24h change contribution
        if (quote.changePercent < -3) score += 10; // oversold in short term
        else if (quote.changePercent > 3) score -= 10;

        const overallSignal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL" =
          score >= 50 ? "STRONG_BUY" :
          score >= 20 ? "BUY" :
          score <= -50 ? "STRONG_SELL" :
          score <= -20 ? "SELL" : "NEUTRAL";

        // Filter by scan type
        if (scanType === "oversold" && rsiSignal !== "OVERSOLD" && rsiSignal !== "APPROACHING_OVERSOLD") return;
        if (scanType === "overbought" && rsiSignal !== "OVERBOUGHT" && rsiSignal !== "APPROACHING_OVERBOUGHT") return;
        if (scanType === "macd_bull" && macdSignal !== "BULLISH") return;
        if (scanType === "macd_bear" && macdSignal !== "BEARISH") return;
        if (scanType === "bb_squeeze" && bbSignal !== "NEUTRAL") return;

        signals.push({
          symbol: sym,
          price: quote.price,
          change24h: quote.changePercent,
          rsi: rsiValue ? Math.round(rsiValue * 10) / 10 : null,
          rsiSignal,
          macdSignal,
          bbSignal,
          overallSignal,
          score: Math.round(score),
        });
      } catch {}
    }));
  }

  // Sort by absolute score (strongest signals first)
  signals.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));

  return NextResponse.json({
    scanned: symbolsToScan.length,
    signals: signals.length,
    results: signals,
    scanType,
    timestamp: new Date().toISOString(),
  });
}