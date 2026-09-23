import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { handleStripeWebhook } from "@/lib/payments/stripe";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  if (!signature) return NextResponse.json({ error: "Missing signature" }, { status: 400 });

  const payload = await req.text();

  const result = await handleStripeWebhook(payload, signature);
  if (!result.success) {
    return NextResponse.json({ error: "Webhook verification failed" }, { status: 400 });
  }

  return NextResponse.json({ success: true });
}