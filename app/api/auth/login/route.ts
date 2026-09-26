import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { calculateRisk, logSecurityEvent } from "@/lib/security/risk";
import { verifyTotp, decryptSecret } from "@/lib/security/totp";
import { getClientIp } from "@/lib/security/rate-limit";
import { hashFingerprint, parseDeviceInfo } from "@/lib/security/device";
import { getGeoInfo } from "@/lib/security/geo";
import { createNotification } from "@/lib/notify";
import { consumeLimiter, loginLimiter } from "@/lib/security/rate-limit";
import { z } from "zod";

const prisma = new PrismaClient();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
  totp: z.string().optional(),
  deviceFingerprint: z.string().optional(),
  turnstileToken: z.string(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";

  const { allowed, resetSec } = await consumeLimiter(loginLimiter, `ip:${ip}`);
  if (!allowed) {
    return NextResponse.json({ error: "Too many login attempts", retryAfter: resetSec }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = loginSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 400 });
  }

  const { email, password, totp, deviceFingerprint, turnstileToken } = parse.data;
  const fpHash = deviceFingerprint ? hashFingerprint(deviceFingerprint) : null;

  const turnstileConfigured = process.env.TURNSTILE_SECRET_KEY && process.env.TURNSTILE_SECRET_KEY !== "bypass" && process.env.TURNSTILE_SECRET_KEY.startsWith("0x");
  if (turnstileConfigured) {
    const turnstileRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret: process.env.TURNSTILE_SECRET_KEY, response: turnstileToken, remoteip: ip }),
    });
    const turnstileData = await turnstileRes.json();
    if (!turnstileData.success) {
      await logSecurityEvent(null, "LOGIN_TURNSTILE_FAILED", ip, userAgent, fpHash, null, 20);
      return NextResponse.json({ error: "Captcha verification failed" }, { status: 400 });
    }
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash) {
    await logSecurityEvent(null, "LOGIN_FAILED_INVALID_CREDENTIALS", ip, userAgent, fpHash, null, 10);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const { verifyPassword } = await import("@/lib/security/password");
  const pwdValid = await verifyPassword(password, user.passwordHash);
  if (!pwdValid) {
    await logSecurityEvent(user.id, "LOGIN_FAILED_INVALID_PASSWORD", ip, userAgent, fpHash, null, 10);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.kycStatus === "REJECTED") {
    await logSecurityEvent(user.id, "LOGIN_BLOCKED_KYC_REJECTED", ip, userAgent, fpHash, null, 50);
    return NextResponse.json({ error: "Account restricted" }, { status: 403 });
  }

  const risk = await calculateRisk({
    userId: user.id,
    ip,
    userAgent,
    deviceFingerprint,
    action: "LOGIN",
  });

  if (risk.require2FA && user.twoFactorSecret) {
    if (!totp) {
      await logSecurityEvent(user.id, "LOGIN_REQUIRES_2FA", ip, userAgent, fpHash, null, risk.score);
      return NextResponse.json({ requires2FA: true }, { status: 200 });
    }
    const secret = decryptSecret(user.twoFactorSecret);
    if (!verifyTotp(totp, secret)) {
      await logSecurityEvent(user.id, "LOGIN_FAILED_2FA", ip, userAgent, fpHash, null, risk.score + 20);
      return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
    }
  }

  const geoCountry = (await getGeoInfo(ip))?.country ?? null;
  await logSecurityEvent(user.id, "LOGIN_SUCCESS", ip, userAgent, fpHash, geoCountry, risk.score);

  // New device login → notify the user (email + in-app + push)
  if (fpHash) {
    const seenBefore = await prisma.securityEvent.findFirst({
      where: { userId: user.id, deviceFingerprint: fpHash, event: "LOGIN_SUCCESS" },
      select: { id: true },
      // Exclude the row we just wrote above by checking earlier events only:
    });
    const isNewDevice = !seenBefore || (await prisma.securityEvent.count({
      where: { userId: user.id, deviceFingerprint: fpHash, event: "LOGIN_SUCCESS" },
    })) <= 1;
    if (isNewDevice) {
      const deviceInfo = parseDeviceInfo(userAgent);
      const { newDeviceEmail } = await import("@/lib/email-templates");
      const { sendEmail } = await import("@/lib/notify");
      if (user.email) {
        sendEmail(user.email, "New device sign-in", newDeviceEmail(`${deviceInfo.browser} on ${deviceInfo.os}`, geoCountry ?? "Unknown location", ip));
      }
      createNotification(user.id, "security", "New device sign-in", `${deviceInfo.browser} on ${deviceInfo.os} just signed in (${geoCountry ?? "unknown location"}). If this wasn't you, freeze your account now.`);
    }
  }

  return NextResponse.json({ success: true, requires2FA: false });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fp = req.headers.get("x-device-fingerprint") ?? "";
  const fpHash = fp ? hashFingerprint(fp) : null;

  if (session?.user?.id) {
    await logSecurityEvent(session.user.id, "LOGOUT", ip, userAgent, fpHash, null, 0);
  }

  return NextResponse.json({ success: true });
}