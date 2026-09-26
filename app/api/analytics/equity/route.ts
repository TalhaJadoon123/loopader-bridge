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
  const type = (searchParams.get("type") ?? "DEMO") as "DEMO" | "LIVE";
  const days = Math.min(365, parseInt(searchParams.get("days") ?? "90"));

  const since = new Date(Date.now() - days * 86400000);

  const account = await prisma.tradingAccount.findFirst({ where: { userId: session.user.id, type, isActive: true } });
  if (!account) return NextResponse.json({ error: "No account" }, { status: 404 });

  const trades = await prisma.trade.findMany({
    where: { accountId: account.id, status: "CLOSED", closedAt: { gte: since } },
    orderBy: { closedAt: "asc" },
  });

  const deposits = await prisma.deposit.findMany({
    where: { userId: session.user.id, status: "CONFIRMED", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.user.id, status: "PAID", createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  // Build equity curve: start from initial balance, apply P&L, deposits, withdrawals
  const events: Array<{ time: Date; delta: number }> = [
    ...trades.map(t => ({ time: t.closedAt as Date, delta: Number(t.profit) })),
    ...deposits.map(d => ({ time: d.createdAt, delta: Number(d.amount) })),
    ...withdrawals.map(w => ({ time: w.createdAt, delta: -Number(w.amount) })),
  ];
  events.sort((a, b) => a.time.getTime() - b.time.getTime());

  const startBalance = 10000; // demo start
  const points: { date: string; equity: number }[] = [];
  let equity = startBalance;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Daily buckets
  const byDay = new Map<string, number>();
  for (const e of events) {
    const key = e.time.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + e.delta);
  }

  const d = new Date(since);
  while (d <= new Date()) {
    const key = d.toISOString().slice(0, 10);
    if (byDay.has(key)) equity += byDay.get(key) ?? 0;
    points.push({ date: key, equity: Math.round(equity * 100) / 100 });
    d.setDate(d.getDate() + 1);
  }

  const finalEquity = points.length ? points[points.length - 1].equity : startBalance;
  const totalReturn = ((finalEquity - startBalance) / startBalance) * 100;
  let peak = startBalance;
  let maxDrawdown = 0;
  for (const p of points) {
    if (p.equity > peak) peak = p.equity;
    const dd = ((peak - p.equity) / peak) * 100;
    if (dd > maxDrawdown) maxDrawdown = dd;
  }

  return NextResponse.json({
    startBalance,
    currentEquity: finalEquity,
    totalReturn: Math.round(totalReturn * 100) / 100,
    maxDrawdown: Math.round(maxDrawdown * 100) / 100,
    curve: points,
  });
}