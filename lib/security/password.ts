import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;
const HIBP_ENDPOINT = process.env.HIBP_ENDPOINT ?? "https://api.pwnedpasswords.com/range";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

async function sha1Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export async function checkPasswordBreached(password: string): Promise<{ breached: boolean; count: number }> {
  const hash = await sha1Hex(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);

  const res = await fetch(`${HIBP_ENDPOINT}/${prefix}`, {
    headers: { "User-Agent": "Loopader-Security" },
    signal: AbortSignal.timeout(5000),
  });

  if (!res.ok) {
    return { breached: false, count: 0 };
  }

  const text = await res.text();
  for (const line of text.split("\n")) {
    const [suf, countStr] = line.split(":");
    if (suf === suffix) {
      return { breached: true, count: parseInt(countStr, 10) };
    }
  }
  return { breached: false, count: 0 };
}

export function validatePasswordStrength(password: string): { valid: boolean; message?: string } {
  if (password.length < 8) return { valid: false, message: "Password must be at least 8 characters" };
  if (!/[A-Z]/.test(password)) return { valid: false, message: "Password must contain an uppercase letter" };
  if (!/[a-z]/.test(password)) return { valid: false, message: "Password must contain a lowercase letter" };
  if (!/[0-9]/.test(password)) return { valid: false, message: "Password must contain a number" };
  if (!/[^A-Za-z0-9]/.test(password)) return { valid: false, message: "Password must contain a special character" };
  return { valid: true };
}