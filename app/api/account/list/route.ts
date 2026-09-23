import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.tradingAccount.findMany({
    where: { userId: session.user.id, isActive: true },
    select: {
      id: true,
      type: true,
      balance: true,
      leverage: true,
      tier: true,
      currency: true,
      isDefault: true,
      isTradingEnabled: true,
      isActive: true,
      lastDemoResetAt: true,
    },
    orderBy: { type: "asc" }, // DEMO first
  });

  // Add equity field (same as balance for now, can be computed from positions later)
  const accountsWithEquity = accounts.map((a) => ({ ...a, equity: Number(a.balance) }));

  return NextResponse.json({ accounts: accountsWithEquity });
}