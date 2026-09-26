import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { hashFingerprint } from "@/lib/security/device";
import { logSecurityEvent } from "@/lib/security/risk";
import { getClientIp } from "@/lib/security/rate-limit";
import { signAccessToken, signRefreshToken } from "@/lib/auth/mobile-jwt";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const schema = z.object({
  code: z.string().min(10),
  redirectUri: z.string(),
  clientId: z.string(),
  deviceFingerprint: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = schema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { code, redirectUri, clientId, deviceFingerprint } = parse.data;

  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientSecret) return NextResponse.json({ error: "Google sign-in not configured" }, { status: 503 });

  // Exchange auth code for tokens
  let tokenRes;
  try {
    tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });
  } catch {
    return NextResponse.json({ error: "Google token exchange failed" }, { status: 502 });
  }
  if (!tokenRes.ok) return NextResponse.json({ error: "Invalid Google code" }, { status: 401 });
  const tokenData = await tokenRes.json();

  // Fetch profile
  let profileRes;
  try {
    profileRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
  } catch {
    return NextResponse.json({ error: "Google profile fetch failed" }, { status: 502 });
  }
  if (!profileRes.ok) return NextResponse.json({ error: "Google profile failed" }, { status: 401 });
  const profile = await profileRes.json();

  const email = profile.email as string;
  if (!email) return NextResponse.json({ error: "No email returned from Google" }, { status: 401 });

  // Auto-provision or find user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        fullName: profile.name ?? email.split("@")[0],
        avatarUrl: profile.picture ?? null,
        kycStatus: "PENDING",
      },
    });
    await prisma.tradingAccount.create({
      data: { userId: user.id, type: "DEMO", tier: "STANDARD", balance: 10000, currency: "USD", leverage: 30, isActive: true },
    });
    await prisma.streak.create({ data: { userId: user.id, current: 0, longest: 0, freezes: 2 } });
    const missions = await prisma.mission.findMany({ where: { isActive: true } });
    for (const m of missions) {
      await prisma.userMission.create({ data: { userId: user.id, missionId: m.id } });
    }
  }

  const userAgent = req.headers.get("user-agent") ?? "";
  await logSecurityEvent(user.id, "LOGIN_SUCCESS_GOOGLE_MOBILE", ip, userAgent, deviceFingerprint ? hashFingerprint(deviceFingerprint) : null, null, 0);

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role }, deviceFingerprint);
  const refreshToken = signRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,
    user: { id: user.id, email: user.email, name: user.fullName, role: user.role, kycStatus: user.kycStatus },
  });
}