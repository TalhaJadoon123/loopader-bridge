import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "weekly";
  const accountType = (searchParams.get("accountType") ?? "DEMO") as "DEMO" | "LIVE";

  const since = new Date();
  if (type === "weekly") since.setDate(since.getDate() - 7);
  else if (type === "monthly") since.setMonth(since.getMonth() - 1);

  const trades = await prisma.trade.findMany({
    where: {
      status: "CLOSED",
      openedAt: { gte: since },
      account: { type: accountType },
    },
    include: { account: { include: { user: true } } },
  });

  const userStats = new Map<string, { user: any; profit: number; volume: number; trades: number }>();
  for (const t of trades) {
    const uid = t.account.userId;
    if (!userStats.has(uid)) userStats.set(uid, { user: t.account.user, profit: 0, volume: 0, trades: 0 });
    const stats = userStats.get(uid)!;
    stats.profit += Number(t.profit);
    stats.volume += Number(t.volume);
    stats.trades += 1;
  }

  const leaderboard = Array.from(userStats.values())
    .filter(s => s.trades >= 5)
    .map(s => ({
      name: s.user.fullName ?? s.user.email.split("@")[0],
      avatar: s.user.avatarUrl,
      profit: s.profit,
      profitPct: s.volume > 0 ? (s.profit / s.volume) * 100 : 0,
      trades: s.trades,
    }))
    .sort((a, b) => b.profitPct - a.profitPct)
    .slice(0, 10)
    .map((s, i) => ({ rank: i + 1, ...s }));

  return NextResponse.json({ leaderboard });
}