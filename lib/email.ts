import nodemailer from "nodemailer";
import { Resend } from "resend";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// ── Provider 1: Resend (preferred — reliable API, no SMTP issues) ──
let resendClient: Resend | null = null;
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null;
  if (!resendClient) resendClient = new Resend(process.env.RESEND_API_KEY);
  return resendClient;
}

// ── Provider 2: SMTP fallback (Gmail app password etc.) ──
let transporter: nodemailer.Transporter | null = null;
function getTransporter(): nodemailer.Transporter | null {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST ?? "smtp.gmail.com",
      port: Number(process.env.SMTP_PORT ?? "587"),
      secure: Number(process.env.SMTP_PORT ?? "587") === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export async function sendEmail(opts: EmailOptions): Promise<{ provider: string; skipped?: boolean }> {
  const resend = getResend();
  if (resend) {
    const res = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL ?? "Loopader <onboarding@resend.dev>",
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    if (res.error) throw new Error(`Resend: ${res.error.message}`);
    return { provider: "resend" };
  }

  const smtp = getTransporter();
  if (smtp) {
    await smtp.sendMail({
      from: process.env.SMTP_FROM ?? `"Loopader" <${process.env.SMTP_USER}>`,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text ?? opts.html.replace(/<[^>]*>/g, ""),
    });
    return { provider: "smtp" };
  }

  // No email provider configured — log to console and return skipped (dev mode)
  console.log(`[EMAIL SKIPPED] To: ${opts.to}, Subject: ${opts.subject}`);
  console.log(opts.html);
  return { provider: "none", skipped: true };
}

// ── Branded OTP email (shared by both providers) ──
export function otpEmailHtml(otp: string): string {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; background: #0a0f1a; border-radius: 16px; border: 1px solid #1e293b;">
      <div style="text-align: center; margin-bottom: 24px;">
        <h1 style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin: 0; letter-spacing: 4px;">LOOPADER</h1>
      </div>
      <p style="color: #94a3b8; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">Your verification code for Loopader:</p>
      <div style="text-align: center; margin: 24px 0;">
        <span style="display: inline-block; background: linear-gradient(135deg, #10b981, #0ea5e9); color: #070b14; font-size: 32px; font-weight: 800; letter-spacing: 8px; padding: 16px 32px; border-radius: 12px; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.6; margin: 24px 0 0;">This code expires in <strong>10 minutes</strong>. Never share this code with anyone — Loopader will never ask for it.</p>
      <hr style="border: none; border-top: 1px solid #1e293b; margin: 24px 0;">
      <p style="color: #64748b; font-size: 12px; text-align: center;">If you didn't request this, please ignore this email or contact <a href="mailto:support@loopader.com" style="color: #10b981;">support@loopader.com</a>.</p>
    </div>
  `;
}

export async function sendOtpEmail(email: string, otp: string): Promise<void> {
  await sendEmail({
    to: email,
    subject: `Your Loopader verification code: ${otp.slice(0, 3)} ${otp.slice(3)}`,
    html: otpEmailHtml(otp),
  });
}