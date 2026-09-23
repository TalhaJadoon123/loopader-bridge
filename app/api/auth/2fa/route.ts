import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { generateSecret, getTotpUri, generateQrCodeDataUrl, verifyTotp, encryptSecret, decryptSecret, generateBackupCodes } from "@/lib/security/totp";
import { verifyPassword } from "@/lib/security/password";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";

const prisma = new PrismaClient();
const verifySchema = z.object({ token: z.string().length(6) });
const disableSchema = z.object({ password: z.string(), token: z.string().length(6) });

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "setup") {
    if (session.user.twoFactorEnabled) {
      return NextResponse.json({ error: "2FA already enabled" }, { status: 400 });
    }
    const secret = generateSecret();
    const uri = getTotpUri(secret, session.user.email ?? "user");
    const qrCode = await generateQrCodeDataUrl(uri);
    const backupCodes = generateBackupCodes();
    return NextResponse.json({ secret, uri, qrCode, backupCodes });
  }

  if (action === "verify") {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
    const parse = verifySchema.safeParse(body);
    if (!parse.success) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (!user?.twoFactorSecret) return NextResponse.json({ error: "2FA not set up" }, { status: 400 });

    const secret = decryptSecret(user.twoFactorSecret!);
    const valid = verifyTotp(parse.data.token, secret);
    if (!valid) return NextResponse.json({ error: "Invalid token" }, { status: 400 });

    const backupCodes = generateBackupCodes();
    await prisma.user.update({
      where: { id: session.user.id },
      data: { twoFactorSecret: encryptSecret(secret), twoFactorBackupCodes: backupCodes.join(",") },
    });
    return NextResponse.json({ success: true, backupCodes });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = disableSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user?.passwordHash) return NextResponse.json({ error: "Cannot disable 2FA for passkey-only accounts" }, { status: 400 });

  const pwdValid = await verifyPassword(parse.data.password, user.passwordHash);
  if (!pwdValid) return NextResponse.json({ error: "Invalid password" }, { status: 401 });

  if (user.twoFactorSecret) {
    const secret = decryptSecret(user.twoFactorSecret!);
    const valid = verifyTotp(parse.data.token, secret);
    if (!valid) return NextResponse.json({ error: "Invalid 2FA code" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { twoFactorSecret: null, twoFactorBackupCodes: null },
  });
  return NextResponse.json({ success: true });
}