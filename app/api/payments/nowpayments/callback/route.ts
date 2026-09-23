import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyIPN } from "@/lib/payments/nowpayments";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("x-nowpayments-sig");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!verifyIPN(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const { payment_id, payment_status, order_id, pay_amount, pay_currency, price_amount, price_currency } = payload;

  const deposit = await prisma.deposit.findUnique({ where: { reference: order_id } });
  if (!deposit) return NextResponse.json({ error: "Deposit not found" }, { status: 404 });

  if (deposit.status === "CONFIRMED") return NextResponse.json({ success: true });

  if (payment_status !== "finished" && payment_status !== "confirmed") {
    await prisma.deposit.update({ where: { id: deposit.id }, data: { status: "FAILED" } });
    return NextResponse.json({ success: true });
  }

  const liveAccount = await prisma.tradingAccount.findFirst({
    where: { userId: deposit.userId, type: "LIVE", isActive: true },
  });
  if (!liveAccount) return NextResponse.json({ error: "No active live account" }, { status: 400 });

  await prisma.$transaction(async (tx) => {
    await tx.deposit.update({
      where: { id: deposit.id },
      data: { status: "CONFIRMED", txHash: payment_id, confirmedAt: new Date() },
    });
    await tx.tradingAccount.update({
      where: { id: liveAccount.id },
      data: { balance: { increment: deposit.amount } },
    });
    await tx.auditLog.create({
      data: {
        action: "DEPOSIT_CONFIRMED",
        userId: deposit.userId,
        payload: {
          depositId: deposit.id,
          amount: Number(deposit.amount),
          currency: deposit.cryptoCurrency,
          method: "CRYPTO",
          paymentId: payment_id,
        },
      },
    });
  });

  return NextResponse.json({ success: true });
}