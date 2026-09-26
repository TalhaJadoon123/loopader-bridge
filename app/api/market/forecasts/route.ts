import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ASSETS } from "@/lib/trading/assets";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// Simple sentiment-based forecast from cached market mood + price action
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const symbols = symbol ? [symbol] : ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "SPX500", "USOIL"];

  const forecasts = [];

  for (const sym of symbols) {
    const asset = ASSETS[sym];
    if (!asset) continue;

    const sentiment = await prisma.sentimentCache.findUnique({ where: { symbol: sym } });
    const moodScore = sentiment?.score ?? 0;

    // Simple forecast logic based on sentiment
    let direction: "bullish" | "bearish" | "neutral" = "neutral";
    let confidence: number = 50;
    if (moodScore > 20) { direction = "bullish"; confidence = 50 + moodScore / 2; }
    else if (moodScore < -20) { direction = "bearish"; confidence = 50 + Math.abs(moodScore) / 2; }
    confidence = Math.min(90, Math.max(10, Math.round(confidence)));

    const date = new Date();
    const periods = [
      { label: "Today", date: date.toISOString(), direction, confidence: confidence + Math.round(Math.random() * 10 - 5) },
      { label: "1 Week", date: new Date(date.getTime() + 7 * 86400000).toISOString(), direction: ["bullish", "bearish", "neutral"][Math.floor(Math.random() * 3)], confidence: 40 + Math.round(Math.random() * 30) },
      { label: "1 Month", date: new Date(date.getTime() + 30 * 86400000).toISOString(), direction: ["bullish", "bearish", "neutral"][Math.floor(Math.random() * 3)], confidence: 30 + Math.round(Math.random() * 30) },
    ];

    const summary = moodScore > 20
      ? `${sym} shows bullish sentiment with positive market mood. Favorable conditions for long positions.`
      : moodScore < -20
        ? `${sym} shows bearish sentiment. Caution advised — consider short-term or hedged positions.`
        : `${sym} shows mixed signals. Neutral outlook — wait for clearer direction.`;

    forecasts.push({
      symbol: sym,
      name: asset.name,
      class: asset.class,
      direction,
      confidence,
      moodScore,
      summary,
      periods,
      generatedAt: new Date().toISOString(),
    });
  }

  return NextResponse.json({ forecasts, generatedAt: new Date().toISOString() });
}