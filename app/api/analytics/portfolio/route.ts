import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const allTrades = await prisma.trade.findMany({
    where: { userId: session.user.id, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 500,
  });

  const totalTrades = allTrades.length;
  const wins = allTrades.filter(t => Number(t.profit) > 0).length;
  const losses = allTrades.filter(t => Number(t.profit) < 0).length;
  const winRate = totalTrades ? (wins / totalTrades) * 100 : 0;
  const totalPnL = allTrades.reduce((s, t) => s + Number(t.profit), 0);
  const avgProfit = wins ? allTrades.filter(t => Number(t.profit) > 0).reduce((s, t) => s + Number(t.profit), 0) / wins : 0;
  const avgLoss = losses ? Math.abs(allTrades.filter(t => Number(t.profit) < 0).reduce((s, t) => s + Number(t.profit), 0)) / losses : 0;
  const profitFactor = avgLoss ? avgProfit / avgLoss : totalPnL > 0 ? 999 : 0;

  // Drawdown: running PnL minimum
  let running = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const t of allTrades) {
    running += Number(t.profit);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  // Sharpe ratio (simplified)
  const returns = allTrades.map(t => Number(t.profit));
  const avgReturn = returns.reduce((s, r) => s + r, 0) / (returns.length || 1);
  const variance = returns.reduce((s, r) => s + (r - avgReturn) ** 2, 0) / (returns.length || 1);
  const stdDev = Math.sqrt(variance);
  const sharpe = stdDev ? (avgReturn / stdDev) * Math.sqrt(252) : 0;

  // Monthly PnL
  const monthlyPnL: Record<string, number> = {};
  for (const t of allTrades) {
    const month = t.closedAt?.toISOString().slice(0, 7) ?? "unknown";
    monthlyPnL[month] = (monthlyPnL[month] ?? 0) + Number(t.profit);
  }

  // Best/worst trades
  const bestTrade = allTrades.reduce((best, t) => Number(t.profit) > Number(best.profit) ? t : best, allTrades[0] ?? null);
  const worstTrade = allTrades.reduce((worst, t) => Number(t.profit) < Number(worst.profit) ? t : worst, allTrades[0] ?? null);

  // Symbol breakdown
  const bySymbol: Record<string, { trades: number; pnl: number; wins: number }> = {};
  for (const t of allTrades) {
    if (!bySymbol[t.symbol]) bySymbol[t.symbol] = { trades: 0, pnl: 0, wins: 0 };
    bySymbol[t.symbol].trades++;
    bySymbol[t.symbol].pnl += Number(t.profit);
    if (Number(t.profit) > 0) bySymbol[t.symbol].wins++;
  }

  return NextResponse.json({
    totalTrades,
    wins,
    losses,
    winRate: Math.round(winRate * 100) / 100,
    totalPnL: Math.round(totalPnL * 100) / 100,
    avgProfit: Math.round(avgProfit * 100) / 100,
    avgLoss: Math.round(avgLoss * 100) / 100,
    profitFactor: Math.round(profitFactor * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    sharpe: Math.round(sharpe * 100) / 100,
    bestTrade: bestTrade ? { symbol: bestTrade.symbol, profit: Number(bestTrade.profit), date: bestTrade.closedAt } : null,
    worstTrade: worstTrade ? { symbol: worstTrade.symbol, profit: Number(worstTrade.profit), date: worstTrade.closedAt } : null,
    monthlyPnL: Object.entries(monthlyPnL).sort().map(([month, pnl]) => ({ month, pnl: Math.round(pnl * 100) / 100 })),
    bySymbol: Object.entries(bySymbol).map(([symbol, data]) => ({
      symbol, trades: data.trades, pnl: Math.round(data.pnl * 100) / 100, winRate: Math.round((data.wins / data.trades) * 10000) / 100
    })).sort((a, b) => b.pnl - a.pnl),
  });
}