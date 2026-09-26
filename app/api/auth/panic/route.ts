import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { logSecurityEvent } from "@/lib/security/risk";
import { getClientIp } from "@/lib/security/rate-limit";
import { hashFingerprint } from "@/lib/security/device";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fp = req.headers.get("x-device-fingerprint") ?? "";

  await prisma.user.update({
    where: { id: session.user.id },
    data: { accountFrozen: true, freezeReason: "User initiated panic freeze" },
  });

  await logSecurityEvent(
    session.user.id,
    "PANIC_FREEZE",
    ip,
    userAgent,
    fp ? hashFingerprint(fp) : null,
    null,
    80
  );

  return NextResponse.json({ success: true, message: "Account frozen. Contact support to unfreeze." });
}