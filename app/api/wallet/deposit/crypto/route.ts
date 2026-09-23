import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { createInvoice } from "@/lib/payments/nowpayments";
import { z } from "zod";

const prisma = new PrismaClient();

const depositSchema = z.object({
  amountUsd: z.number().min(10).max(100000),
  cryptoCurrency: z.string().optional(),
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

  const parse = depositSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { amountUsd, cryptoCurrency } = parse.data;

  // Create order reference
  const orderId = `CRYPTO_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Create Deposit record
  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount: amountUsd,
      method: "CRYPTO",
      status: "PENDING",
      reference: orderId,
      cryptoCurrency: cryptoCurrency ?? "USDT",
    },
  });

  try {
    const result = await createInvoice({
      priceAmount: amountUsd,
      priceCurrency: "USD",
      payCurrency: cryptoCurrency ?? "USDT",
      orderId,
      orderDescription: `Loopader Wallet Deposit (${cryptoCurrency ?? "USDT"})`,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=cancelled`,
    });

    return NextResponse.json({
      invoiceId: result.id,
      paymentId: result.paymentId,
      payAddress: result.payAddress,
      payAmount: result.payAmount,
      payCurrency: result.payCurrency,
      priceAmount: result.priceAmount,
      priceCurrency: result.priceCurrency,
      purchaseUrl: result.purchaseUrl,
      depositId: deposit.id,
    });
  } catch (e: any) {
    console.error("NOWPayments deposit failed:", e);
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: e.message ?? "Crypto deposit failed" },
      { status: 500 }
    );
  }
}