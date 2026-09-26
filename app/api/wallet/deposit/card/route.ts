import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { getCardProcessor } from "@/lib/payments/card";
import { z } from "zod";

const prisma = new PrismaClient();

const cardDepositSchema = z.object({
  amountUsd: z.number().min(10).max(5000),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check KYC status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true },
  });
  if (!user || user.kycStatus !== "VERIFIED") {
    return NextResponse.json({ error: "KYC verification required" }, { status: 403 });
  }

  // Check LIVE account exists
  const liveAccount = await prisma.tradingAccount.findFirst({
    where: { userId: session.user.id, type: "LIVE", isActive: true },
  });
  if (!liveAccount) {
    return NextResponse.json({ error: "No active LIVE account" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = cardDepositSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { amountUsd } = parse.data;

  // Create order reference
  const orderId = `CARD_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Create Deposit record
  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount: amountUsd,
      method: "CARD",
      status: "PENDING",
      reference: orderId,
    },
  });

  try {
    const processor = getCardProcessor();
    const intent = await processor.createPaymentIntent({
      amountUsd,
      orderId,
      userId: session.user.id,
      currency: "USD",
      metadata: { depositId: deposit.id },
    });

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { proofUrl: intent.redirectUrl ?? intent.clientSecret },
    });

    return NextResponse.json({
      intentId: intent.intentId,
      clientSecret: intent.clientSecret,
      redirectUrl: intent.redirectUrl,
      status: intent.status,
      depositId: deposit.id,
    });
  } catch (e: any) {
    console.error("Card deposit failed:", e);

    // If using stub, return 503 with helpful message
    if (e.message?.includes("not configured")) {
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: "Card payments coming soon. Use Binance Pay or crypto in the meantime.", code: "CARD_UNAVAILABLE" },
        { status: 503 }
      );
    }

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json({ error: e.message ?? "Card deposit failed" }, { status: 500 });
  }
}