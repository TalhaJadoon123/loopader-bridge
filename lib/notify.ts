import { Resend } from "resend";
import { PrismaClient } from "@prisma/client";
import { sendPushToUser } from "@/lib/push";

const prisma = new PrismaClient();

export async function sendEmail(to: string, subject: string, html: string): Promise<{ provider: string; skipped?: boolean }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.log(`[EMAIL SKIPPED] To: ${to}, Subject: ${subject}`);
    return { provider: "none", skipped: true };
  }
  try {
    const resend = new Resend(apiKey);
    const res = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Loopader <onboarding@resend.dev>",
      to,
      subject,
      html,
    });
    if (res.error) throw new Error(`Resend: ${res.error.message}`);
    return { provider: "resend" };
  } catch (e) {
    console.error("Email send failed:", e);
    throw e;
  }
}

/**
 * Persist an in-app notification AND fire a push notification (best effort).
 * All product notifications should go through this so users get them everywhere.
 */
export async function createNotification(userId: string, type: string, title: string, body: string, data?: Record<string, any>) {
  try {
    await prisma.notification.create({ data: { userId, type, title, body, data: data ?? {} } });
  } catch (e) {
    console.error("Notification create failed:", e);
  }
  await sendPushToUser(userId, { title, body, data: { type, ...data } });
}
