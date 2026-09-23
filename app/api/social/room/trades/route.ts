import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") ?? "all"; // all | live | demo
  const symbol = searchParams.get("symbol");

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24 hours only

  const where: any = {
    status: "CLOSED",
    closedAt: { gte: since },
  };
  if (type !== "all") where.account = { type: type.toUpperCase() };
  if (symbol) where.symbol = symbol.toUpperCase();

  const trades = await prisma.trade.findMany({
    where,
    orderBy: { closedAt: "desc" },
    take: 30,
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } }, account: { select: { type: true } } },
  });

  // Also include open positions in the room
  const openWhere: any = { status: "OPEN" };
  if (type !== "all") openWhere.account = { type: type.toUpperCase() };
  if (symbol) openWhere.symbol = symbol.toUpperCase();

  const openTrades = await prisma.trade.findMany({
    where: openWhere,
    orderBy: { openedAt: "desc" },
    take: 15,
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } }, account: { select: { type: true } } },
  });

  // Room stats
  const [activeTraders, volumeAgg] = await Promise.all([
    prisma.trade.groupBy({ by: ["userId"], where: { status: "CLOSED", closedAt: { gte: since } } }),
    prisma.trade.aggregate({ where: { status: "CLOSED", closedAt: { gte: since } }, _sum: { volume: true } }),
  ]);

  return NextResponse.json({
    stats: {
      activeTraders: activeTraders.length,
      volume24h: Math.round(Number(volumeAgg._sum.volume ?? 0) * 100) / 100,
      closedLast24h: trades.length,
      openNow: openTrades.length,
    },
    closed: trades.map(t => ({
      id: t.id,
      name: t.user.fullName ?? "Trader",
      symbol: t.symbol,
      side: t.side,
      volume: Number(t.volume),
      openPrice: Number(t.openPrice),
      closePrice: t.closePrice ? Number(t.closePrice) : null,
      profit: Number(t.profit),
      closedAt: t.closedAt?.toISOString(),
      accountType: t.account?.type ?? "DEMO",
    })),
    open: openTrades.map(t => ({
      id: t.id,
      name: t.user.fullName ?? "Trader",
      symbol: t.symbol,
      side: t.side,
      volume: Number(t.volume),
      openPrice: Number(t.openPrice),
      profit: Number(t.profit),
      openedAt: t.openedAt.toISOString(),
      accountType: t.account?.type ?? "DEMO",
    })),
  });
}

// Fix: need totalTradesInWindow
