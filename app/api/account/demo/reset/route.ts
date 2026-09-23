import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Find user's DEMO account
    const demoAccount = await prisma.tradingAccount.findFirst({
      where: { userId: session.user.id, type: "DEMO", isActive: true },
    });

    if (!demoAccount) {
      return NextResponse.json({ error: "No active DEMO account found" }, { status: 404 });
    }

    // Check 24h cooldown
    if (demoAccount.lastDemoResetAt) {
      const hoursSinceReset = (Date.now() - new Date(demoAccount.lastDemoResetAt).getTime()) / (1000 * 60 * 60);
      if (hoursSinceReset < 24) {
        const hoursLeft = Math.ceil(24 - hoursSinceReset);
        return NextResponse.json(
          { error: `Demo reset available in ${hoursLeft} hour${hoursLeft > 1 ? "s" : ""}.` },
          { status: 429 }
        );
      }
    }

    const demoStartingBalance = parseFloat(process.env.DEMO_STARTING_BALANCE || "10000");

    // Close all open DEMO trades and reset balance in a transaction
    await prisma.$transaction(async (tx) => {
      // Get all open trades for this demo account
      const openTrades = await tx.trade.findMany({
        where: { accountId: demoAccount.id, status: "OPEN" },
        select: { id: true, symbol: true, openPrice: true, volume: true, side: true },
      });

      // Close each open trade at current price (fallback to openPrice if no market data)
      for (const trade of openTrades) {
        // Try to get current price from market data (would need integration)
        // For now, use openPrice as closePrice (break-even)
        const closePrice = Number(trade.openPrice);

        await tx.trade.update({
          where: { id: trade.id },
          data: {
            status: "CLOSED",
            closePrice,
            profit: 0, // Demo reset = break-even
            closedAt: new Date(),
          },
        });
      }

      // Reset DEMO account balance
      await tx.tradingAccount.update({
        where: { id: demoAccount.id },
        data: {
          balance: demoStartingBalance,
          lastDemoResetAt: new Date(),
        },
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          action: "DEMO_RESET",
          userId: session.user.id,
          payload: {
            accountId: demoAccount.id,
            tradesClosed: openTrades.length,
            newBalance: demoStartingBalance,
          },
        },
      });
    });

    const nextResetAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    return NextResponse.json({
      success: true,
      newBalance: demoStartingBalance,
      nextResetAt: nextResetAt.toISOString(),
    });
  } catch (e: any) {
    console.error("Demo reset error:", e);
    return NextResponse.json({ error: "Failed to reset demo account" }, { status: 500 });
  }
}