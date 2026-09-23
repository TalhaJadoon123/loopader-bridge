import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const days = Math.min(90, parseInt(searchParams.get("days") ?? "30"));

  const since = new Date();
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);

  const trades = await prisma.trade.findMany({
    where: { userId: session.user.id, status: "CLOSED", closedAt: { gte: since } },
    select: { closedAt: true, profit: true, volume: true },
    orderBy: { closedAt: "asc" },
  });

  // Group by date
  const dailyMap = new Map<string, { pnl: number; trades: number; wins: number; volume: number }>();
  for (const t of trades) {
    const key = t.closedAt!.toISOString().slice(0, 10);
    if (!dailyMap.has(key)) dailyMap.set(key, { pnl: 0, trades: 0, wins: 0, volume: 0 });
    const d = dailyMap.get(key)!;
    d.pnl += Number(t.profit);
    d.trades += 1;
    if (Number(t.profit) > 0) d.wins += 1;
    d.volume += Number(t.volume);
  }

  // Build calendar array
  const calendar: Array<{ date: string; pnl: number; trades: number; winRate: number; intensity: number }> = [];
  const d = new Date(since);
  const today = new Date();
  let maxAbsPnl = 0;

  while (d <= today) {
    const key = d.toISOString().slice(0, 10);
    const data = dailyMap.get(key);
    const pnl = data?.pnl ?? 0;
    if (Math.abs(pnl) > maxAbsPnl) maxAbsPnl = Math.abs(pnl);
    calendar.push({
      date: key,
      pnl: Math.round(pnl * 100) / 100,
      trades: data?.trades ?? 0,
      winRate: data?.trades ? Math.round((data.wins / data.trades) * 100) : 0,
      intensity: 0,
    });
    d.setDate(d.getDate() + 1);
  }

  // Calculate intensity (0-100)
  for (const c of calendar) {
    c.intensity = maxAbsPnl > 0 ? Math.min(100, Math.round((Math.abs(c.pnl) / maxAbsPnl) * 100)) : 0;
  }

  // Summary
  const totalPnl = calendar.reduce((s, c) => s + c.pnl, 0);
  const tradingDays = calendar.filter(c => c.trades > 0);
  const greenDays = calendar.filter(c => c.pnl > 0).length;
  const redDays = calendar.filter(c => c.pnl < 0).length;
  const bestDay = calendar.reduce((best, c) => c.pnl > best.pnl ? c : best, { date: "", pnl: 0, trades: 0, winRate: 0, intensity: 0 });
  const worstDay = calendar.reduce((worst, c) => c.pnl < worst.pnl ? c : worst, { date: "", pnl: 0, trades: 0, winRate: 0, intensity: 0 });

  return NextResponse.json({
    calendar,
    summary: {
      totalPnl: Math.round(totalPnl * 100) / 100,
      tradingDays: tradingDays.length,
      greenDays,
      redDays,
      bestDay: bestDay.pnl > 0 ? { date: bestDay.date, pnl: bestDay.pnl } : null,
      worstDay: worstDay.pnl < 0 ? { date: worstDay.date, pnl: worstDay.pnl } : null,
      avgDailyPnl: tradingDays.length ? Math.round(totalPnl / tradingDays.length * 100) / 100 : 0,
    },
  });
}