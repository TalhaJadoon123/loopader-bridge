import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const demoAccount = await prisma.tradingAccount.findFirst({
    where: { userId: session.user.id, type: "DEMO", isActive: true },
  });
  if (!demoAccount) return NextResponse.json({ error: "No demo account" }, { status: 400 });

  await prisma.$transaction([
    prisma.trade.deleteMany({ where: { accountId: demoAccount.id } }),
    prisma.tradingAccount.update({
      where: { id: demoAccount.id },
      data: { balance: 10000 },
    }),
  ]);

  return NextResponse.json({ success: true, balance: 10000 });
}