import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { ASSETS } from "@/lib/trading/assets";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const limit = Math.min(50, parseInt(searchParams.get("limit") ?? "20"));

  const where: any = { status: "active" };
  if (symbol) where.symbol = symbol;

  const signals = await prisma.signal.findMany({
    where,
    orderBy: [{ confidence: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { analyst: { select: { id: true, fullName: true } } },
  });

  return NextResponse.json({
    signals: signals.map(s => ({
      id: s.id,
      symbol: s.symbol,
      direction: s.direction,
      entryPrice: Number(s.entryPrice),
      stopLoss: Number(s.stopLoss),
      takeProfit: Number(s.takeProfit),
      confidence: s.confidence,
      analysis: s.analysis,
      status: s.status,
      createdAt: s.createdAt,
      analyst: s.analyst?.fullName ?? "AI Analyst",
    })),
  });
}

// Demo: auto-generate a few signals if none exist
export async function POST() {
  const count = await prisma.signal.count();
  if (count > 0) return NextResponse.json({ signals: [] });

  // Get the first user as analyst
  const analyst = await prisma.user.findFirst({ where: { role: "USER" } });
  if (!analyst) return NextResponse.json({ error: "No users" }, { status: 400 });

  const demoSignals: Array<{ symbol: string; direction: "BUY" | "SELL"; entryPrice: number; stopLoss: number; takeProfit: number; confidence: number; analysis: string }> = [
    { symbol: "EURUSD", direction: "BUY", entryPrice: 1.0850, stopLoss: 1.0780, takeProfit: 1.0950, confidence: 75, analysis: "EURUSD bullish on weakening USD. Support at 1.0820. Target 1.0950." },
    { symbol: "XAUUSD", direction: "BUY", entryPrice: 2340, stopLoss: 2310, takeProfit: 2380, confidence: 70, analysis: "Gold holding above $2320 support. Middle East tensions + rate cut expectations drive safe-haven demand." },
    { symbol: "BTCUSD", direction: "BUY", entryPrice: 67200, stopLoss: 65000, takeProfit: 72000, confidence: 65, analysis: "Bitcoin consolidating above $67k. ETF inflows positive. Resistance at $72k." },
    { symbol: "SPX500", direction: "SELL", entryPrice: 5430, stopLoss: 5480, takeProfit: 5350, confidence: 55, analysis: "S&P 500 overbought on RSI. Potential profit-taking ahead of CPI data." },
    { symbol: "USOIL", direction: "BUY", entryPrice: 78.5, stopLoss: 76.0, takeProfit: 82.0, confidence: 72, analysis: "Crude supported by OPEC+ cuts and declining US inventories. Bullish structure." },
  ];

  const signals = await Promise.all(
    demoSignals.map(s => prisma.signal.create({
      data: {
        ...s,
        entryPrice: s.entryPrice,
        stopLoss: s.stopLoss,
        takeProfit: s.takeProfit,
        analystId: analyst.id,
        status: "active",
      },
    }))
  );

  return NextResponse.json({ signals }, { status: 201 });
}