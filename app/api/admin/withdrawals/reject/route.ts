import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const rejectSchema = z.object({
  withdrawalId: z.string(),
  reason: z.string().min(5).max(500),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin role
  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = rejectSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { withdrawalId, reason } = parse.data;

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
  });
  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (withdrawal.status !== "PENDING" && withdrawal.status !== "ADMIN_REVIEW") {
    return NextResponse.json({ error: "Withdrawal not in pending state" }, { status: 400 });
  }

  // Reject withdrawal and refund balance
  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: "REJECTED",
        processedAt: new Date(),
        processedBy: session.user.id,
        adminNote: reason,
      },
    });

    // Refund balance to LIVE account
    const liveAccount = await tx.tradingAccount.findFirst({
      where: { userId: withdrawal.userId, type: "LIVE", isActive: true },
    });
    if (!liveAccount) throw new Error("No active LIVE account");

    await tx.tradingAccount.update({
      where: { id: liveAccount.id },
      data: { balance: { increment: withdrawal.amount } },
    });

    await tx.auditLog.create({
      data: {
        action: "WITHDRAWAL_REJECTED",
        userId: withdrawal.userId,
        payload: {
          withdrawalId: withdrawal.id,
          amount: Number(withdrawal.amount),
          method: withdrawal.method,
          reason,
          adminId: session.user.id,
        },
      },
    });
  });

  return NextResponse.json({ success: true, message: "Withdrawal rejected, balance refunded" });
}