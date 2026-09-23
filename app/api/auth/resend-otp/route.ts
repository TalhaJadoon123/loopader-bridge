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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.emailVerified) return NextResponse.json({ success: true, message: "Already verified" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await prisma.user.update({
    where: { id: session.user.id },
    data: { otpCode: otp, otpExpiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  try {
    await sendOtpEmail(user.email, otp);
  } catch (e) {
    console.error("Failed to resend OTP email:", e);
    return NextResponse.json({ error: "Failed to send email — try again shortly" }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: "OTP resent" });
}