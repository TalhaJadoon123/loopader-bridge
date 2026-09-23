import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { z } from "zod";

export const dynamic = "force-dynamic";

const calcSchema = z.object({
  entryPrice: z.number().positive(),
  exitPrice: z.number().positive(),
  volume: z.number().positive(),
  side: z.enum(["BUY", "SELL"]),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  symbol: z.string().default("EURUSD"),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parse = calcSchema.safeParse({
    entryPrice: parseFloat(searchParams.get("entry") ?? "0"),
    exitPrice: parseFloat(searchParams.get("exit") ?? "0"),
    volume: parseFloat(searchParams.get("volume") ?? "0.1"),
    side: searchParams.get("side") ?? "BUY",
    stopLoss: searchParams.get("sl") ? parseFloat(searchParams.get("sl")!) : undefined,
    takeProfit: searchParams.get("tp") ? parseFloat(searchParams.get("tp")!) : undefined,
    symbol: searchParams.get("symbol") ?? "EURUSD",
  });

  if (!parse.success) return NextResponse.json({ error: "Invalid inputs" }, { status: 400 });

  const { entryPrice, exitPrice, volume, side, stopLoss, takeProfit, symbol } = parse.data;

  const diff = side === "BUY" ? exitPrice - entryPrice : entryPrice - exitPrice;
  const profit = diff * volume * 100000; // $100k contract

  // Pip distance
  const pipValue = symbol.endsWith("JPY") || symbol === "XAUUSD" || symbol === "BTCUSD" ? 0.01 : 0.0001;
  const pips = diff / pipValue;

  let risk: number | null = null;
  let reward: number | null = null;
  let rr: number | null = null;

  if (stopLoss) {
    const slDiff = side === "BUY" ? entryPrice - stopLoss : stopLoss - entryPrice;
    risk = slDiff * volume * 100000;
  }
  if (takeProfit) {
    const tpDiff = side === "BUY" ? takeProfit - entryPrice : entryPrice - takeProfit;
    reward = tpDiff * volume * 100000;
  }
  if (risk && reward && risk > 0) {
    rr = Math.round((reward / risk) * 100) / 100;
  }

  return NextResponse.json({
    entryPrice: Math.round(entryPrice * 100000) / 100000,
    exitPrice: Math.round(exitPrice * 100000) / 100000,
    volume,
    side,
    symbol,
    pips: Math.round(pips * 10) / 10,
    profit: Math.round(profit * 100) / 100,
    profitPct: Math.round((profit / (entryPrice * volume * 100000)) * 10000) / 100,
    risk: risk ? Math.round(risk * 100) / 100 : null,
    reward: reward ? Math.round(reward * 100) / 100 : null,
    riskRewardRatio: rr,
  });
}