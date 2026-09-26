import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { sendOtpEmail } from "@/lib/email";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { code } = body as { code?: string };
  if (!code || code.length !== 6) {
    return NextResponse.json({ error: "Invalid OTP code" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { otpCode: true, otpExpiresAt: true, emailVerified: true, email: true, fullName: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ success: true, alreadyVerified: true });

  if (!user.otpCode || !user.otpExpiresAt) {
    return NextResponse.json({ error: "No OTP sent" }, { status: 400 });
  }

  if (user.otpCode !== code) {
    return NextResponse.json({ error: "Invalid code" }, { status: 400 });
  }

  if (new Date() > user.otpExpiresAt) {
    return NextResponse.json({ error: "Code expired" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { emailVerified: true, otpCode: null, otpExpiresAt: null },
  });

  // Welcome email (best effort) once the account is verified
  try {
    const { sendEmail } = await import("@/lib/notify");
    const { welcomeEmail } = await import("@/lib/email-templates");
    if (user.email) {
      sendEmail(user.email, "Welcome to Loopader", welcomeEmail(user.fullName ?? ""));
    }
    const { createNotification } = await import("@/lib/notify");
    createNotification(session.user.id, "system", "Welcome aboard", "Your account is ready. Complete onboarding to claim your demo balance.");
  } catch (e) {
    console.error("Welcome email failed:", e);
  }

  return NextResponse.json({ success: true, verified: true });
}