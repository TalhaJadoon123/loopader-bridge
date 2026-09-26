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
import { Resend } from "resend";
import crypto from "crypto";

const prisma = new PrismaClient();

function getResend() {
  if (!process.env.RESEND_API_KEY) throw new Error("RESEND_API_KEY not configured");
  return new Resend(process.env.RESEND_API_KEY);
}

const withdrawSchema = z.object({
  amount: z.number().positive().max(100000),
  method: z.enum(["BINANCE_PAY", "CRYPTO", "WIRE", "CARD", "BANK"]),
  accountDetails: z.record(z.any()),
  password: z.string(),
  totp: z.string().optional(),
  turnstileToken: z.string(),
});

// ── Withdrawal history for the logged-in user ──
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const withdrawals = await prisma.withdrawal.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    withdrawals: withdrawals.map((w) => ({
      id: w.id,
      amount: Number(w.amount),
      method: w.method,
      status: w.status,
      adminNote: w.adminNote,
      confirmedAt: w.confirmedAt,
      createdAt: w.createdAt,
    })),
  });
}

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

  const parse = withdrawSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { amount, method, accountDetails, password, totp, turnstileToken } = parse.data;

  // Turnstile only enforced when the site secret is configured
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

  // Per-method payout detail requirements
  const details = accountDetails ?? {};
  if (method === "CRYPTO" && (!details.walletAddress || String(details.walletAddress).length < 20)) {
    return NextResponse.json({ error: "A valid wallet address is required for crypto withdrawals" }, { status: 400 });
  }
  if (method === "CARD" && (!details.last4 || !/^\d{4}$/.test(String(details.last4)))) {
    return NextResponse.json({ error: "Card ending (last 4 digits) is required" }, { status: 400 });
  }
  if (method === "BINANCE_PAY" && (!details.binancePayId || String(details.binancePayId).length < 5)) {
    return NextResponse.json({ error: "Binance Pay ID is required" }, { status: 400 });
  }
  if (method === "BANK" && (!details.bankName || !details.accountNumber)) {
    return NextResponse.json({ error: "Bank name and account number are required" }, { status: 400 });
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

  // Reserve the funds immediately so pending withdrawals can't overdraw the account
  const withdrawal = await prisma.$transaction(async (tx) => {
    const created = await tx.withdrawal.create({
      data: {
        userId: user.id,
        amount,
        method,
        accountDetails: details,
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
    const confirmationToken = crypto.randomBytes(32).toString("hex");
    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        confirmationToken,
        confirmationExpires: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const confirmUrl = `${process.env.NEXT_PUBLIC_APP_URL}/wallet/withdraw/confirm/${confirmationToken}`;
    try {
      await getResend().emails.send({
        from: process.env.RESEND_FROM ?? "Loopader <onboarding@resend.dev>",
        to: user.email!,
        subject: "Confirm your withdrawal",
        html: `<p>You requested a withdrawal of $${amount.toFixed(2)} via ${method.toLowerCase()}.</p><p><a href="${confirmUrl}">Confirm withdrawal</a></p><p>This link expires in 1 hour. The amount has been reserved from your balance and is released back if the request is rejected.</p>`,
      });
    } catch (e) {
      console.error("Withdrawal confirm email failed:", e);
    }
  }

  await logSecurityEvent(user.id, "WITHDRAWAL_REQUESTED", ip, userAgent, fpHash, (await getGeoInfo(ip))?.country ?? null, 30);

  return NextResponse.json({ id: withdrawal.id, status, needsAdminApproval });
}
