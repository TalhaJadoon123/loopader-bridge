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
  const depositId = searchParams.get("id");

  if (depositId) {
    // Single deposit for polling
    const deposit = await prisma.deposit.findUnique({
      where: { id: depositId, userId: session.user.id },
      select: {
        id: true,
        status: true,
        reference: true,
        binancePrepayId: true,
        txHash: true,
        confirmedAt: true,
        method: true,
        amount: true,
        cryptoCurrency: true,
        createdAt: true,
      },
    });

    if (!deposit) {
      return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
    }

    return NextResponse.json({ deposit });
  }

  // List all deposits
  const deposits = await prisma.deposit.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    deposits: deposits.map((d) => ({
      id: d.id,
      amount: Number(d.amount),
      method: d.method,
      status: d.status,
      reference: d.reference,
      proofUrl: d.proofUrl,
      binancePrepayId: d.binancePrepayId,
      txHash: d.txHash,
      confirmedAt: d.confirmedAt,
      cryptoCurrency: d.cryptoCurrency,
      createdAt: d.createdAt.toISOString(),
    })),
  });
}