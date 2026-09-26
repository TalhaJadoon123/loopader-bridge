import { NextResponse } from "next/server";
import { analyzeNewsSentiment } from "@/lib/ai/news-sentiment";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const filter = searchParams.get("filter"); // "bullish" | "bearish" | "neutral"

  const analysis = await analyzeNewsSentiment(20);

  let items = analysis.items;
  if (symbol) items = items.filter(i => i.symbols.includes(symbol));
  if (filter) items = items.filter(i => i.label === filter);

  return NextResponse.json({
    source: analysis.source,
    overall: analysis.overall,
    items,
  });
}