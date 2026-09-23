import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 5;

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { code } = body as { code?: string };
  if (!code || code.length !== 6) return NextResponse.json({ error: "Enter the 6-digit code" }, { status: 400 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { phoneVerified: true, phoneOtpCode: true, phoneOtpExpiresAt: true, phoneOtpAttempts: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.phoneVerified) return NextResponse.json({ success: true, alreadyVerified: true });

  if (!user.phoneOtpCode || !user.phoneOtpExpiresAt) {
    return NextResponse.json({ error: "No code sent — request a new one" }, { status: 400 });
  }

  // Brute-force protection
  if ((user.phoneOtpAttempts ?? 0) >= MAX_ATTEMPTS) {
    return NextResponse.json({ error: "Too many attempts — request a new code" }, { status: 429 });
  }

  if (user.phoneOtpCode !== code) {
    await prisma.user.update({
      where: { id: session.user.id },
      data: { phoneOtpAttempts: (user.phoneOtpAttempts ?? 0) + 1 },
    });
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (new Date() > user.phoneOtpExpiresAt) {
    return NextResponse.json({ error: "Code expired — request a new one" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { phoneVerified: true, phoneOtpCode: null, phoneOtpExpiresAt: null, phoneOtpAttempts: 0 },
  });

  return NextResponse.json({ success: true, verified: true });
}