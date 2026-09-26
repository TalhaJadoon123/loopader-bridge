import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyWebhook, parseWebhookEvent } from "@/lib/payments/binancepay";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("binancepay-signature") ?? req.headers.get("BinancePay-Signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Verify signature
  if (!verifyWebhook(payload, signature)) {
    console.error("Binance Pay webhook signature verification failed");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Parse event
  const event = parseWebhookEvent(payload);

  // Find deposit by prepayId
  const deposit = await prisma.deposit.findFirst({
    where: { binancePrepayId: event.prepayId },
  });

  if (!deposit) {
    console.error(`Deposit not found for prepayId: ${event.prepayId}`);
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  // Idempotent: if already confirmed, return 200
  if (deposit.status === "CONFIRMED") {
    return NextResponse.json({ success: true });
  }

  // Handle event
  if (event.eventType === "PAY_SUCCESS") {
    // Update deposit
    await prisma.$transaction(async (tx) => {
      await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: "CONFIRMED",
          txHash: event.transactionId,
          confirmedAt: event.paidAt,
        },
      });

      // Increment LIVE account balance
      await tx.tradingAccount.update({
        where: { id: deposit.userId, type: "LIVE" }, // This needs to be fixed - deposit doesn't have accountId
        data: { balance: { increment: deposit.amount } },
      });

      // Log audit
      await tx.auditLog.create({
        data: {
          action: "DEPOSIT_CONFIRMED",
          userId: deposit.userId,
          payload: {
            depositId: deposit.id,
            amount: Number(deposit.amount),
            currency: deposit.cryptoCurrency,
            method: "BINANCE_PAY",
            transactionId: event.transactionId,
            prepayId: event.prepayId,
          },
        },
      });
    });

    console.log(`Deposit ${deposit.id} confirmed via Binance Pay: ${event.transactionId}`);
  } else if (event.eventType === "PAY_CLOSED" || event.eventType === "PAY_FAILED") {
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "FAILED" },
    });
  }

  // Always return 200 to stop Binance Pay retries
  return NextResponse.json({ success: true });
}