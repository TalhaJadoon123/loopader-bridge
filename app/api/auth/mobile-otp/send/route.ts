import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { sendOtpSms, isSmsEnabled, normalizePhone } from "@/lib/sms";
import { consumeLimiter, apiLimiter } from "@/lib/security/rate-limit";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await consumeLimiter(apiLimiter, `sms:${session.user.id}`);
  if (!allowed) return NextResponse.json({ error: "Too many requests — wait a minute" }, { status: 429 });

  if (!isSmsEnabled()) {
    return NextResponse.json({ error: "SMS verification unavailable — try again later", smsEnabled: false }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { phone, country } = body as { phone?: string; country?: string };
  if (!phone || phone.replace(/\D/g, "").length < 10) {
    return NextResponse.json({ error: "Valid mobile number required" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true, phoneVerified: true, phone: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (!user.emailVerified) return NextResponse.json({ error: "Verify your email first" }, { status: 400 });
  if (user.phoneVerified) return NextResponse.json({ success: true, alreadyVerified: true });

  const normalized = normalizePhone(phone, country ?? "PK");

  // Check the number isn't used by another account
  const taken = await prisma.user.findFirst({
    where: { phone: normalized, id: { not: session.user.id } },
  });
  if (taken) return NextResponse.json({ error: "This number is already registered" }, { status: 400 });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      phone: normalized,
      phoneOtpCode: otp,
      phoneOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      phoneOtpAttempts: 0,
    },
  });

  try {
    await sendOtpSms(normalized, otp);
  } catch (e: any) {
    console.error("[sms] send failed:", e?.message?.slice(0, 120));
    return NextResponse.json({ error: "SMS failed to send — check the number and try again" }, { status: 500 });
  }

  return NextResponse.json({ success: true, sentTo: normalized.replace(/(\d{5})\d{4}$/, "*****$1") });
}