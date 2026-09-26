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
  identityToken: z.string().min(10),
  fullName: z.any().optional(),
  email: z.string().optional(),
  deviceFingerprint: z.string().optional(),
});

export async function POST(req: Request) {
  const ip = getClientIp(req);
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = schema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { identityToken, fullName, email: appleEmail, deviceFingerprint } = parse.data;

  // Decode identity token header to get kid (key id) for verification
  let payload: any;
  try {
    const parts = identityToken.split(".");
    payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
  } catch {
    return NextResponse.json({ error: "Invalid Apple identity token" }, { status: 400 });
  }

  const email = payload.email ?? appleEmail;
  if (!email) return NextResponse.json({ error: "No email in Apple token" }, { status: 400 });

  // Auto-provision or find user
  let user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    const name = fullName?.givenName ?? fullName?.familyName
      ? `${fullName.givenName ?? ""} ${fullName.familyName ?? ""}`.trim()
      : email.split("@")[0];
    user = await prisma.user.create({
      data: {
        email,
        fullName: name,
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

  await logSecurityEvent(user.id, "LOGIN_SUCCESS_APPLE_MOBILE", ip, "", deviceFingerprint ? hashFingerprint(deviceFingerprint) : null, null, 0);

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role }, deviceFingerprint);
  const refreshToken = signRefreshToken(user.id);

  return NextResponse.json({
    accessToken,
    refreshToken,
    expiresIn: 15 * 60,
    user: { id: user.id, email: user.email, name: user.fullName, role: user.role, kycStatus: user.kycStatus },
  });
}