import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  // Rank traders by 30-day performance — includes both LIVE and DEMO accounts
  // (LIVE traders get a "LIVE" badge; demo traders show as practice leaders)
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const trades = await prisma.trade.findMany({
    where: { status: "CLOSED", closedAt: { gte: since } },
    include: {
      user: { select: { id: true, fullName: true, avatarUrl: true } },
      account: { select: { type: true } },
    },
  });

  // Aggregate per user
  const stats = new Map<string, {
    user: any; profit: number; volume: number; trades: number;
    wins: number; hasLive: boolean; followers: number;
  }>();

  for (const t of trades) {
    const uid = t.userId;
    if (!stats.has(uid)) {
      stats.set(uid, { user: t.user, profit: 0, volume: 0, trades: 0, wins: 0, hasLive: false, followers: 0 });
    }
    const s = stats.get(uid)!;
    s.profit += Number(t.profit);
    s.volume += Number(t.volume);
    s.trades += 1;
    if (Number(t.profit) > 0) s.wins += 1;
    if (t.account.type === "LIVE") s.hasLive = true;
  }

  // Count followers
  const copyRels = await prisma.copyRelationship.groupBy({
    by: ["leaderId"],
    _count: { leaderId: true },
    where: { isActive: true },
  });
  for (const rel of copyRels) {
    const s = stats.get(rel.leaderId);
    if (s) s.followers = rel._count.leaderId;
  }

  const leaders = Array.from(stats.values())
    .filter(s => s.trades >= 3) // minimum 3 trades to qualify
    .map(s => {
      const winRate = s.trades ? Math.round((s.wins / s.trades) * 100) : 0;
      const maxDrawdown = Math.min(0, s.profit);
      const riskLevel = maxDrawdown < -500 ? "HIGH" : maxDrawdown < -100 ? "MEDIUM" : "LOW";

      return {
        id: s.user.id,
        name: s.user.fullName ?? "Trader",
        avatar: s.user.avatarUrl,
        gain30d: Math.round(s.profit * 100) / 100,
        winRate,
        totalVolume: Math.round(s.volume * 100) / 100,
        riskLevel,
        followers: s.followers,
        isLive: s.hasLive,
      };
    })
    .sort((a, b) => b.gain30d - a.gain30d)
    .slice(0, 10);

  return NextResponse.json({ leaders });
}