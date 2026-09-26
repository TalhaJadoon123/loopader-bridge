import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const search = searchParams.get("search");

  const skip = (page - 1) * limit;

  try {
    const where: any = {};
    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { fullName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          fullName: true,
          country: true,
          kycStatus: true,
          role: true,
          accountFrozen: true,
          isFeatured: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.user.count({ where }),
    ]);

    // Fetch additional data for each user
    const usersWithData = await Promise.all(
      users.map(async (user) => {
        const [demoAcc, liveAcc, tradeCount] = await Promise.all([
          prisma.tradingAccount.findFirst({
            where: { userId: user.id, type: "DEMO", isActive: true },
            select: { balance: true, isTradingEnabled: true },
          }),
          prisma.tradingAccount.findFirst({
            where: { userId: user.id, type: "LIVE", isActive: true },
            select: { balance: true, isTradingEnabled: true },
          }),
          prisma.trade.count({ where: { userId: user.id, status: "CLOSED" } }),
        ]);

        const demoBalance = demoAcc ? Number(demoAcc.balance) : 0;
        const liveBalance = liveAcc ? Number(liveAcc.balance) : 0;
        const demoTradingEnabled = demoAcc?.isTradingEnabled ?? false;
        const liveTradingEnabled = liveAcc?.isTradingEnabled ?? false;

        // Calculate win rate from closed trades
        const closedTrades = await prisma.trade.findMany({
          where: { userId: user.id, status: "CLOSED" },
          select: { profit: true },
        });
        const wins = closedTrades.filter((t) => Number(t.profit) > 0).length;
        const winRate = closedTrades.length > 0 ? (wins / closedTrades.length) * 100 : 0;

        return {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
          country: user.country,
          kycStatus: user.kycStatus,
          role: user.role,
          accountFrozen: user.accountFrozen,
          isFeatured: user.isFeatured,
          createdAt: user.createdAt.toISOString(),
          demoBalance,
          liveBalance,
          demoTradingEnabled,
          liveTradingEnabled,
          totalTrades: tradeCount,
          winRate: Math.round(winRate * 100) / 100,
        };
      })
    );

    return NextResponse.json({
      users: usersWithData,
      total,
      page,
      limit,
    });
  } catch (e: any) {
    console.error("Admin users error:", e);
    return NextResponse.json({ error: "Failed to load users" }, { status: 500 });
  }
}