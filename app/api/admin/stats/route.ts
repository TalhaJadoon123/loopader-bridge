import { verifyAdmin, adminDenied } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.authorized) return adminDenied();

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const [
    totalUsers,
    activeUsers,
    depositsToday,
    withdrawalsPending,
    openTrades,
    closedTrades,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: today } } }), // users registered today
    prisma.deposit.aggregate({
      where: { status: "CONFIRMED", createdAt: { gte: today, lt: tomorrow } },
      _sum: { amount: true },
    }),
    prisma.withdrawal.count({ where: { status: { in: ["PENDING", "ADMIN_REVIEW"] } } }),
    prisma.trade.count({ where: { status: "OPEN" } }),
    prisma.trade.findMany({
      where: { status: "CLOSED", openedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      select: { profit: true, account: { select: { type: true } } },
    }),
  ]);

  const depositsTodayAmount = Number(depositsToday._sum.amount ?? 0);
  const spreadRevenue = closedTrades.reduce((sum, t) => {
    const volume = 1;
    const spread = t.account.type === "LIVE" ? 0.8 : 0.8;
    return sum + spread * 0.0001 * volume * 100000;
  }, 0);

  return NextResponse.json({
    totalUsers,
    activeUsers,
    depositsToday: depositsTodayAmount,
    withdrawalsPending,
    openVolume: openTrades,
    revenueEstimate: spreadRevenue,
  });
}
