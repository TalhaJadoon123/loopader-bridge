import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { createStripeCheckoutSession } from "@/lib/payments/stripe";
import { checkUnverifiedDepositLimit } from "@/lib/kyc";
import { z } from "zod";

const prisma = new PrismaClient();

const stripeDepositSchema = z.object({
  amount: z.number().min(5),
  currency: z.enum(["USD", "EUR", "PKR"]).default("USD"),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = stripeDepositSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { amount, currency } = parse.data;

  const kycError = await checkUnverifiedDepositLimit(session.user.id, amount);
  if (kycError) return NextResponse.json({ error: kycError }, { status: 403 });

  const orderRef = `STRIPE_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount,
      method: "CARD",
      status: "PENDING",
      reference: orderRef,
    },
  });

  try {
    const result = await createStripeCheckoutSession({
      amount,
      currency,
      userId: session.user.id,
      userEmail: session.user.email ?? "",
      successUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=success&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=cancelled`,
      metadata: { depositId: deposit.id, orderRef },
    });

    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { proofUrl: result.url },
    });

    return NextResponse.json({
      sessionId: result.sessionId,
      checkoutUrl: result.url,
      depositId: deposit.id,
    });
  } catch (e: any) {
    console.error("Stripe error:", e);
    await prisma.deposit.update({ where: { id: deposit.id }, data: { status: "FAILED" } });
    return NextResponse.json({ error: "Failed to create Stripe session" }, { status: 500 });
  }
}