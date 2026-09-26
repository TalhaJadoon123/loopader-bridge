import crypto from "crypto";

const ALGO = "aes-256-gcm";

function getMasterKey(): Buffer {
  const KEY_HEX = process.env.ENCRYPTION_KEY;
  if (!KEY_HEX || KEY_HEX.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be 64 hex chars (32 bytes)");
  }
  return Buffer.from(KEY_HEX, "hex");
}

export function encrypt(plaintext: string): string {
  const MASTER_KEY = getMasterKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, MASTER_KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, ciphertext]).toString("base64");
}

export function decrypt(ciphertextB64: string): string {
  const MASTER_KEY = getMasterKey();
  const data = Buffer.from(ciphertextB64, "base64");
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = crypto.createDecipheriv(ALGO, MASTER_KEY, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function hashForIndex(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex").substring(0, 32);
}