import { authenticator } from "otplib";
import QRCode from "qrcode";
import { encrypt, decrypt } from "@/lib/crypto";

authenticator.options = { step: 30, window: 1 };

export function generateSecret(): string {
  return authenticator.generateSecret();
}

export function getTotpUri(secret: string, email: string, issuer = "Loopader"): string {
  return authenticator.keyuri(email, issuer, secret);
}

export async function generateQrCodeDataUrl(uri: string): Promise<string> {
  return QRCode.toDataURL(uri);
}

export function verifyTotp(token: string, secret: string): boolean {
  return authenticator.check(token, secret);
}

export function encryptSecret(secret: string): string {
  return encrypt(secret);
}

export function decryptSecret(encrypted: string): string {
  return decrypt(encrypted);
}

export function generateBackupCodes(count = 8): string[] {
  const codes: string[] = [];
  for (let i = 0; i < count; i++) {
    const arr = new Uint8Array(4);
    crypto.getRandomValues(arr);
    codes.push(Array.from(arr).map((b) => b.toString(16).padStart(2, "0")).join("").toUpperCase());
  }
  return codes;
}