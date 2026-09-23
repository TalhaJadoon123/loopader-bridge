import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getCardProcessor } from "@/lib/payments/card";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature") ?? req.headers.get("webhook-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let payload: any;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const processor = getCardProcessor();
  if (!processor.verifyWebhook(payload, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Handle different card processor events
  // This is a generic handler - specific implementations would parse processor-specific events
  const eventType = payload.type ?? payload.event_type ?? payload.event;

  // Extract orderId from metadata
  const orderId = payload.data?.object?.metadata?.orderId ?? payload.metadata?.orderId;
  if (!orderId) {
    return NextResponse.json({ error: "Missing orderId in metadata" }, { status: 400 });
  }

  const deposit = await prisma.deposit.findUnique({ where: { reference: orderId } });
  if (!deposit) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  if (deposit.status === "CONFIRMED") {
    return NextResponse.json({ success: true });
  }

  // Handle success events (generic)
  if (eventType === "payment_intent.succeeded" || eventType === "payment.succeeded" || eventType === "charge.succeeded") {
    await prisma.$transaction(async (tx) => {
      await tx.deposit.update({
        where: { id: deposit.id },
        data: { status: "CONFIRMED", txHash: payload.data?.object?.id ?? payload.id, confirmedAt: new Date() },
      });

      const liveAccount = await tx.tradingAccount.findFirst({
        where: { userId: deposit.userId, type: "LIVE", isActive: true },
      });
      if (!liveAccount) throw new Error("No active LIVE account");

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
            method: "CARD",
            processorEvent: eventType,
            txId: payload.data?.object?.id ?? payload.id,
          },
        },
      });
    });
  } else if (eventType === "payment_intent.payment_failed" || eventType === "payment.failed") {
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "FAILED" },
    });
  }

  return NextResponse.json({ success: true });
}