import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { postDepositConfirm } from "@/lib/deposit-confirm";

let stripeInstance: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeInstance) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }
    stripeInstance = new Stripe(process.env.STRIPE_SECRET_KEY, { typescript: true });
  }
  return stripeInstance;
}

export interface StripeCheckoutRequest {
  amount: number;
  currency: string;
  userId: string;
  userEmail: string;
  successUrl: string;
  cancelUrl: string;
  metadata?: Record<string, string>;
}

export interface StripeCheckoutResponse {
  sessionId: string;
  url: string;
}

export async function createStripeCheckoutSession(req: StripeCheckoutRequest): Promise<StripeCheckoutResponse> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: req.currency.toLowerCase(),
          product_data: { name: "Loopader Wallet Deposit" },
          unit_amount: Math.round(req.amount * 100),
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: req.successUrl,
    cancel_url: req.cancelUrl,
    customer_email: req.userEmail,
    metadata: { userId: req.userId, ...req.metadata },
  });

  return { sessionId: session.id, url: session.url! };
}

export async function handleStripeWebhook(payload: string, signature: string): Promise<{ success: boolean }> {
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!endpointSecret) throw new Error("STRIPE_WEBHOOK_SECRET not configured");

  const stripe = getStripe();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, signature, endpointSecret);
  } catch (err: any) {
    console.error("Stripe webhook signature verification failed:", err.message);
    return { success: false };
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const depositId = session.metadata?.depositId;

    if (!depositId) {
      console.error("Stripe webhook: checkout.session.completed without depositId metadata", session.id);
      return { success: false };
    }

    const prisma = new PrismaClient();
    try {
      const deposit = await prisma.deposit.findUnique({
        where: { id: depositId },
        include: { user: { include: { tradingAccounts: true } } },
      });

      if (!deposit) {
        console.error("Stripe webhook: deposit not found:", depositId);
        return { success: false };
      }

      if (deposit.status === "CONFIRMED") {
        return { success: true };
      }

      const liveAccount = deposit.user.tradingAccounts.find((a) => a.type === "LIVE" && a.isActive);
      if (!liveAccount) {
        console.error("Stripe webhook: no active live account for user:", deposit.userId);
        return { success: false };
      }

      await prisma.$transaction([
        prisma.deposit.update({
          where: { id: deposit.id },
          data: {
            status: "CONFIRMED",
            method: "CARD",
            reference: session.id,
          },
        }),
        prisma.tradingAccount.update({
          where: { id: liveAccount.id },
          data: { balance: { increment: deposit.amount } },
        }),
      ]);

      console.log("Stripe payment confirmed and credited:", session.id, "deposit:", deposit.id);
      postDepositConfirm(deposit.id, deposit.userId, Number(deposit.amount), "CARD");
    } finally {
      await prisma.$disconnect();
    }
  }

  return { success: true };
}

export { getStripe as stripe };