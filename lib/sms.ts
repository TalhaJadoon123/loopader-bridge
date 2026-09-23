// SMS via Twilio — free trial gives ~$15 credit (hundreds of PK SMS).
// Get free: https://www.twilio.com/try-twilio → Console → Account SID, Auth Token, Trial number
import { isCountryProhibited } from "@/lib/compliance";

let clientPromise: Promise<any> | null = null;

function getClient(): Promise<any> | null {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) return null;
  if (!clientPromise) {
    clientPromise = (async () => {
      const mod = await import("twilio");
      const twilio = (mod as any).default ?? mod;
      return twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    })();
  }
  return clientPromise;
}

export function isSmsEnabled(): boolean {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

// Normalize PK numbers: 03001234567 → +923001234567
export function normalizePhone(phone: string, country = "PK"): string {
  const digits = phone.replace(/\D/g, "");
  if (country === "PK") {
    if (digits.startsWith("92")) return `+${digits}`;
    if (digits.startsWith("0")) return `+92${digits.slice(1)}`;
    if (digits.length === 10) return `+92${digits}`;
  }
  if (phone.startsWith("+")) return phone;
  return `+${digits}`;
}

export async function sendSms(to: string, body: string): Promise<void> {
  const client = await getClient();
  if (!client) throw new Error("SMS not configured");
  const from = process.env.TWILIO_PHONE_NUMBER!;
  await client.messages.create({ to, from, body });
}

export async function sendOtpSms(phone: string, otp: string): Promise<void> {
  const normalized = normalizePhone(phone);
  await sendSms(
    normalized,
    `Loopader verification code: ${otp}. Valid for 10 minutes. Never share this code.`
  );
}