import { NextResponse } from "next/server";
import { fetchCandles } from "@/lib/market-data";
import { z } from "zod";

const querySchema = z.object({
  symbol: z.string().transform((s) => s.toUpperCase()),
  interval: z.enum(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]).default("5m"),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = querySchema.safeParse({
    symbol: searchParams.get("symbol"),
    interval: searchParams.get("interval"),
  });
  if (!parse.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const candles = await fetchCandles(parse.data.symbol, parse.data.interval);
  return NextResponse.json({ candles });
}