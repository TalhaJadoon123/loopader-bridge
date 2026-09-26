import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { transferToUser } from "@/lib/payments/binancepay";
import { z } from "zod";

const prisma = new PrismaClient();

const approveSchema = z.object({
  withdrawalId: z.string(),
  txHash: z.string().optional(),
  adminNote: z.string().optional(),
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

  const parse = approveSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { withdrawalId, txHash: inputTxHash, adminNote } = parse.data;

  const withdrawal = await prisma.withdrawal.findUnique({
    where: { id: withdrawalId },
    include: { user: true },
  });
  if (!withdrawal) {
    return NextResponse.json({ error: "Withdrawal not found" }, { status: 404 });
  }

  if (withdrawal.status !== "PENDING" && withdrawal.status !== "ADMIN_REVIEW") {
    return NextResponse.json({ error: "Withdrawal not in pending state" }, { status: 400 });
  }

  let txHash = inputTxHash ?? withdrawal.txHash;

  // If BINANCE_PAY, attempt transfer via Binance Pay API
  if (withdrawal.method === "BINANCE_PAY") {
    const accountDetails = withdrawal.accountDetails as Record<string, any>;
    const binancePayId = accountDetails?.binancePayId;
    if (!binancePayId) {
      return NextResponse.json({ error: "Missing Binance Pay ID" }, { status: 400 });
    }

    try {
      const result = await transferToUser({
        payeeId: binancePayId,
        amount: Number(withdrawal.amount),
        currency: "USDT",
        description: `Withdrawal ${withdrawal.id}`,
      });

      if (result.code !== "000000" || result.status !== "SUCCESS") {
        return NextResponse.json(
          { error: `Binance Pay transfer failed: ${result.errorMessage}` },
          { status: 500 }
        );
      }

      txHash = result.data.transferId;
    } catch (e: any) {
      return NextResponse.json(
        { error: `Binance Pay transfer error: ${e.message}` },
        { status: 500 }
      );
    }
  }

  // Approve withdrawal
  await prisma.$transaction(async (tx) => {
    await tx.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: "PAID",
        processedAt: new Date(),
        processedBy: session.user.id,
        txHash: txHash ?? null,
        adminNote: adminNote ?? null,
      },
    });

    await tx.auditLog.create({
      data: {
        action: "WITHDRAWAL_APPROVED",
        userId: withdrawal.userId,
        payload: {
          withdrawalId: withdrawal.id,
          amount: Number(withdrawal.amount),
          method: withdrawal.method,
          txHash,
          adminId: session.user.id,
          adminNote,
        },
      },
    });
  });

  return NextResponse.json({ success: true, message: "Withdrawal approved" });
}