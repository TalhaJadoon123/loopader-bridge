import { NextResponse } from "next/server";
import { fetchCandles } from "@/lib/market-data";
import { computeIndicator } from "@/lib/indicators";
import { z } from "zod";

export const dynamic = "force-dynamic";

const schema = z.object({
  symbol: z.string().transform(s => s.toUpperCase()),
  interval: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("5m"),
  type: z.string().min(1),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = schema.safeParse({
    symbol: searchParams.get("symbol") ?? "",
    interval: searchParams.get("interval") ?? undefined,
    type: searchParams.get("type") ?? "",
  });
  if (!parse.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { symbol, interval, type } = parse.data;

  const candles = await fetchCandles(symbol, interval);
  const results = computeIndicator(type, candles);

  return NextResponse.json({ indicators: results });
}