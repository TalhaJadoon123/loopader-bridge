import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashPassword, checkPasswordBreached, validatePasswordStrength } from "@/lib/security/password";
import { calculateRisk, logSecurityEvent } from "@/lib/security/risk";
import { getClientIp } from "@/lib/security/rate-limit";
import { hashFingerprint } from "@/lib/security/device";
import { getGeoInfo } from "@/lib/security/geo";
import { consumeLimiter, loginLimiter } from "@/lib/security/rate-limit";
import { sendOtpEmail } from "@/lib/email";
import { z } from "zod";

const prisma = new PrismaClient();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(2).max(100),
  phone: z.string().optional(),
  country: z.string().length(2).optional(),
  turnstileToken: z.string(),
  ref: z.string().optional(),
});

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fp = req.headers.get("x-device-fingerprint") ?? "";

  const { allowed, remaining, resetSec } = await consumeLimiter(loginLimiter, `ip:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many attempts", retryAfter: resetSec }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = registerSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { email, password, fullName, phone, country, turnstileToken, ref } = parse.data;

  const turnstileConfigured = process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY !== "bypass" && process.env.TURNSTILE_SECRET_KEY.startsWith("0x");
  if (turnstileConfigured) {
    const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken, remoteip: ip }),
    });
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      await logSecurityEvent(null, "REGISTER_TURNSTILE_FAILED", ip, userAgent, fp ? hashFingerprint(fp) : null, null, 20);
      return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
    }
  }

  const pwdStrength = validatePasswordStrength(password);
  if (!pwdStrength.valid) {
    return NextResponse.json({ error: pwdStrength.message }, { status: 400 });
  }

  const { breached, count } = await checkPasswordBreached(password);
  if (breached) {
    await logSecurityEvent(null, "REGISTER_BREACHED_PASSWORD", ip, userAgent, fp ? hashFingerprint(fp) : null, null, 30);
    return NextResponse.json({ error: `This password has been breached ${count} times. Choose a different one.` }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 400 });
  }

  if (phone) {
    const existingPhone = await prisma.user.findUnique({ where: { phone } });
    if (existingPhone) {
      return NextResponse.json({ error: "Phone already registered" }, { status: 400 });
    }
  }

  // Generate OTP
  const otp = generateOtp();

  const passwordHash = await hashPassword(password);
  const fpHash = fp ? hashFingerprint(fp) : null;
  const geo = await getGeoInfo(ip);

  const demoStartingBalance = parseFloat(process.env.DEMO_STARTING_BALANCE ?? "10000");

  const user = await prisma.$transaction(async (tx) => {
    // Create user
    const newUser = await tx.user.create({
      data: {
        email,
        passwordHash: await hashPassword(password),
        fullName,
        phone: phone ?? null,
        country: country ?? geo?.country ?? "XX",
        kycStatus: "PENDING",
        emailVerified: false,
        otpCode: otp,
        otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    // Create DEMO account (trading enabled by default)
    const demoAccount = await tx.tradingAccount.create({
      data: {
        userId: newUser.id,
        type: "DEMO",
        tier: "STANDARD",
        balance: demoStartingBalance,
        currency: "USD",
        leverage: 100,
        isActive: true,
        isTradingEnabled: true,
        isDefault: true,
      },
    });

    // Create LIVE account (trading disabled until LP configured)
    const liveAccount = await tx.tradingAccount.create({
      data: {
        userId: newUser.id,
        type: "LIVE",
        tier: "STANDARD",
        balance: 0,
        currency: "USD",
        leverage: 100,
        isActive: true,
        isTradingEnabled: false,
        isDefault: false,
      },
    });

    // Create Streak record
    await tx.streak.create({
      data: {
        userId: newUser.id,
        current: 0,
        longest: 0,
        freezes: 2,
      },
    });

    // Create UserMissions for all active Missions
    const activeMissions = await tx.mission.findMany({ where: { isActive: true } });
    if (activeMissions.length > 0) {
      await tx.userMission.createMany({
        data: activeMissions.map((m) => ({
          userId: newUser.id,
          missionId: m.id,
          progress: 0,
        })),
      });
    }

    // Create KYCSubmission row (PENDING)
    await tx.kYCSubmission.create({
      data: {
        userId: newUser.id,
        status: "PENDING",
      },
    });

    // Referral
    if (ref) {
      try {
        const referrer = await tx.user.findUnique({ where: { id: ref }, select: { id: true } });
        if (referrer && referrer.id !== newUser.id) {
          await tx.referral.create({
            data: { referrerId: referrer.id, refereeId: newUser.id },
          });
        }
      } catch (e) {
        console.error("Referral link failed:", e);
      }
    }

    return { user: newUser, demoAccount, liveAccount };
  });

  // Send OTP email
  try {
    await sendOtpEmail(email, otp);
  } catch (e) {
    console.error("Failed to send OTP email:", e);
  }

  await logSecurityEvent(user.user.id, "REGISTER_SUCCESS", ip, userAgent, fpHash, geo?.country ?? null, 0);

  return NextResponse.json(
    {
      id: user.user.id,
      email: user.user.email,
      fullName: user.user.fullName,
      emailVerified: false,
      requiresOtp: true,
      demoAccountId: user.demoAccount.id,
      liveAccountId: user.liveAccount.id,
      needsKyc: true,
    },
    { status: 201 }
  );
}