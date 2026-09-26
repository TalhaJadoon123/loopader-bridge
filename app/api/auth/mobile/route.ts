import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { verifyPassword } from "@/lib/security/password";
import { getClientIp, consumeLimiter, loginLimiter } from "@/lib/security/rate-limit";
import { logSecurityEvent } from "@/lib/security/risk";
import { hashFingerprint } from "@/lib/security/device";
import { checkLoginLockout } from "@/lib/security/advanced";
import { signAccessToken, signRefreshToken } from "@/lib/auth/mobile-jwt";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  deviceFingerprint: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fpHash = null;

  const { allowed, resetSec } = await consumeLimiter(loginLimiter, `ip:${ip}`);
  if (!allowed) return NextResponse.json({ error: "Too many attempts", retryAfter: resetSec }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = loginSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { email, password, deviceFingerprint } = parse.data;
  const deviceFpHash = deviceFingerprint ? hashFingerprint(deviceFingerprint) : null;

  // Progressive lockout (brute force protection)
  const lockout = await checkLoginLockout(email.toLowerCase(), ip);
  if (lockout.blocked) {
    return NextResponse.json({ error: "Too many failed attempts", retryAfter: lockout.retryAfterSec }, { status: 429 });
  }

  const user = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
  if (!user || !user.passwordHash) {
    await logSecurityEvent(null, "LOGIN_FAILED_INVALID_CREDENTIALS", ip, userAgent, fpHash, null, 10);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  const pwdValid = await verifyPassword(password, user.passwordHash);
  if (!pwdValid) {
    await logSecurityEvent(user.id, "LOGIN_FAILED_INVALID_PASSWORD", ip, userAgent, deviceFpHash, null, 10);
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  if (user.accountFrozen) {
    await logSecurityEvent(user.id, "LOGIN_BLOCKED_FROZEN", ip, userAgent, deviceFpHash, null, 80);
    return NextResponse.json({ error: "Account frozen" }, { status: 403 });
  }

  await logSecurityEvent(user.id, "LOGIN_SUCCESS_MOBILE", ip, userAgent, deviceFpHash, null, 0);

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role }, deviceFingerprint);
  const refreshToken = signRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,
    user: { id: user.id, email: user.email, name: user.fullName, role: user.role, kycStatus: user.kycStatus },
  });
}