import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { createInvoice, NOWPAYMENTS_CURRENCIES } from "@/lib/payments/nowpayments";
import { checkUnverifiedDepositLimit } from "@/lib/kyc";
import { z } from "zod";

const prisma = new PrismaClient();

const cryptoDepositSchema = z.object({
  amount: z.number().min(5),
  currency: z.enum(["USD", "EUR", "PKR"]).default("USD"),
  cryptoCurrency: z.string().optional(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = cryptoDepositSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { amount, currency, cryptoCurrency } = parse.data;
  const payCurrency = cryptoCurrency ?? "USDT";

  const kycError = await checkUnverifiedDepositLimit(session.user.id, amount);
  if (kycError) return NextResponse.json({ error: kycError }, { status: 403 });

  if (!NOWPAYMENTS_CURRENCIES.includes(payCurrency.toUpperCase())) {
    return NextResponse.json({ error: "Unsupported cryptocurrency" }, { status: 400 });
  }

  const orderRef = `CRYPTO_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount,
      method: "CRYPTO",
      status: "PENDING",
      reference: orderRef,
      cryptoCurrency: payCurrency,
    },
  });

  try {
    const invoice = await createInvoice({
      priceAmount: amount,
      priceCurrency: currency,
      payCurrency: payCurrency.toUpperCase(),
      orderId: orderRef,
      orderDescription: "Loopader Wallet Deposit",
      ipnCallbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/nowpayments/callback`,
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=success`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=cancelled`,
    });

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { proofUrl: invoice.purchaseUrl },
    });

    return NextResponse.json({
      invoiceId: invoice.id,
      paymentId: invoice.paymentId,
      payAddress: invoice.payAddress,
      payAmount: invoice.payAmount,
      payCurrency: invoice.payCurrency,
      purchaseUrl: invoice.purchaseUrl,
      depositId: deposit.id,
    });
  } catch (e: any) {
    console.error("NOWPayments error:", e);
    await prisma.deposit.update({ where: { id: deposit.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Failed to create crypto invoice" }, { status: 500 });
  }
}