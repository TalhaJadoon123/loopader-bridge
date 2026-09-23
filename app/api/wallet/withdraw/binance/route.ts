import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "@/lib/security/password";
import { verifyTotp, decryptSecret } from "@/lib/security/totp";
import { logSecurityEvent } from "@/lib/security/risk";
import { getClientIp, consumeLimiter, apiLimiter } from "@/lib/security/rate-limit";
import { hashFingerprint } from "@/lib/security/device";
import { getGeoInfo } from "@/lib/security/geo";
import { z } from "zod";
import crypto from "crypto";

const prisma = new PrismaClient();

const binanceWithdrawSchema = z.object({
  amount: z.number().positive().max(100000),
  binancePayId: z.string().min(5),
  password: z.string(),
  totp: z.string().optional(),
  turnstileToken: z.string(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fp = req.headers.get("x-device-fingerprint") ?? "";
  const fpHash = fp ? hashFingerprint(fp) : null;

  const { allowed, resetSec } = await consumeLimiter(apiLimiter, `user:${session.user.id}:withdraw`);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited", retryAfter: resetSec }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = binanceWithdrawSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { amount, binancePayId, password, totp, turnstileToken } = parse.data;

  // Turnstile
  const turnstileConfigured = process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY.startsWith("0x");
  if (turnstileConfigured) {
    try {
      const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken, remoteip: ip }),
      });
      const turnstileData = await turnstileRes.json();
      if (!turnstileData.success) {
        return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
    }
  }

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user || !user.passwordHash) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const pwdValid = await verifyPassword(password, user.passwordHash);
  if (!pwdValid) {
    await logSecurityEvent(user.id, "WITHDRAWAL_FAILED_PASSWORD", ip, userAgent, fpHash, null, 20);
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  if (user.twoFactorSecret) {
    if (!totp) return NextResponse.json({ requires2FA: true }, { status: 200 });
    const secret = decryptSecret(user.twoFactorSecret);
    if (!verifyTotp(totp, secret)) {
      await logSecurityEvent(user.id, "WITHDRAWAL_FAILED_2FA", ip, userAgent, fpHash, null, 40);
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
    }
  }

  if (user.accountFrozen) {
    return NextResponse.json({ error: "Account is frozen" }, { status: 403 });
  }

  if (user.kycStatus !== "VERIFIED") {
    return NextResponse.json({ error: "KYC verification required" }, { status: 403 });
  }

  const liveAcc = await prisma.tradingAccount.findFirst({ where: { userId: user.id, type: "LIVE", isActive: true } });
  if (!liveAcc) return NextResponse.json({ error: "No active live account" }, { status: 400 });

  if (Number(liveAcc.balance) < amount) return NextResponse.json({ error: "Insufficient balance" }, { status: 400 });

  const needsAdminApproval = amount > 1000;
  const status = needsAdminApproval ? "ADMIN_REVIEW" : "PENDING";

  const withdrawal = await prisma.$transaction(async (tx) => {
    const created = await tx.withdrawal.create({
      data: {
        userId: user.id,
        amount,
        method: "BINANCE_PAY",
        accountDetails: { binancePayId },
        status: status as any,
      },
    });

    await tx.tradingAccount.update({
      where: { id: liveAcc.id },
      data: { balance: { decrement: amount } },
    });

    return created;
  });

  if (!needsAdminApproval) {
    // For Binance Pay, we could auto-process small amounts via API
    // For now, still require admin approval for all BINANCE_PAY withdrawals
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        confirmationToken,
        confirmationExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });
  }

  await logSecurityEvent(user.id, "WITHDRAWAL_REQUESTED", ip, userAgent, fpHash, (await getGeoInfo(ip))?.country ?? null, 30);

  return NextResponse.json({ id: withdrawal.id, status, needsAdminApproval });
}