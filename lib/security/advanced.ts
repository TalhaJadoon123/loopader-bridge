import crypto from "crypto";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const CSRF_SECRET = process.env.JWT_ACCESS_SECRET ?? "loopader-csrf";

export function generateCsrfToken(sessionId: string): string {
  const payload = `${sessionId}:${Date.now()}`;
  const signature = crypto.createHmac("sha256", CSRF_SECRET).update(payload).digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

export function verifyCsrfToken(token: string, sessionId: string): boolean {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const [payload, signature] = decoded.split(".");
    if (!payload || !signature) return false;
    const expected = crypto.createHmac("sha256", CSRF_SECRET).update(payload).digest("hex");
    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return false;
    const [sid, ts] = payload.split(":");
    if (sid !== sessionId) return false;
    if (Date.now() - parseInt(ts, 10) > 30 * 60 * 1000) return false; // 30 min expiry
    return true;
  } catch {
    return false;
  }
}

export function requireCsrf(req: Request, sessionId: string): boolean {
  const token = req.headers.get("x-csrf-token");
  if (!token) return false;
  return verifyCsrfToken(token, sessionId);
}

// ── Progressive login lockout (brute force protection) ──
export async function checkLoginLockout(identifier: string, ip: string): Promise<{
  blocked: boolean;
  retryAfterSec: number;
}> {
  const since = new Date(Date.now() - 15 * 60 * 1000);
  const [byIdentifier, byIp] = await Promise.all([
    prisma.securityEvent.count({
      where: {
        event: "LOGIN_FAILED_INVALID_PASSWORD",
        ip: identifier,
        createdAt: { gte: since },
      },
    }),
    prisma.securityEvent.count({
      where: {
        event: "LOGIN_FAILED_INVALID_PASSWORD",
        ip,
        createdAt: { gte: since },
      },
    }),
  ]);

  const attempts = Math.max(byIdentifier, byIp);

  if (attempts >= 10) {
    return { blocked: true, retryAfterSec: 15 * 60 };
  }
  if (attempts >= 5) {
    return { blocked: true, retryAfterSec: 60 };
  }
  return { blocked: false, retryAfterSec: 0 };
}

// ── Device management ──
export interface DeviceRecord {
  id: string;
  fingerprint: string;
  userAgent: string;
  ip: string;
  country: string | null;
  lastSeenAt: Date;
  isCurrent: boolean;
  riskScore: number;
}

export async function getKnownDevices(userId: string, currentFingerprintHash: string): Promise<DeviceRecord[]> {
  const events = await prisma.securityEvent.findMany({
    where: {
      userId,
      deviceFingerprint: { not: null },
      event: { in: ["LOGIN_SUCCESS", "PASSKEY_LOGIN"] },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const seen = new Map<string, DeviceRecord>();
  for (const e of events) {
    if (!e.deviceFingerprint) continue;
    if (!seen.has(e.deviceFingerprint)) {
      seen.set(e.deviceFingerprint, {
        id: e.id,
        fingerprint: e.deviceFingerprint,
        userAgent: e.ip ?? "unknown",
        ip: e.ip ?? "unknown",
        country: e.country,
        lastSeenAt: e.createdAt,
        isCurrent: e.deviceFingerprint === currentFingerprintHash,
        riskScore: e.riskScore,
      });
    }
  }

  return Array.from(seen.values()).slice(0, 20);
}

export async function revokeDevice(userId: string, deviceEventId: string): Promise<boolean> {
  const event = await prisma.securityEvent.findFirst({
    where: { id: deviceEventId, userId },
  });
  if (!event?.deviceFingerprint) return false;

  // Future logins from this fingerprint will be flagged as "revoked device"
  await prisma.securityEvent.create({
    data: {
      userId,
      event: "DEVICE_REVOKED",
      deviceFingerprint: event.deviceFingerprint,
      ip: "system",
      riskScore: 60,
    },
  });
  return true;
}

// ── Withdrawal address whitelist ──
export async function addWithdrawalAddress(userId: string, method: string, address: string, label: string) {
  const existing = await prisma.withdrawalAddress.findUnique({
    where: { userId_method_address: { userId, method, address } },
  });
  if (existing) {
    await prisma.withdrawalAddress.update({ where: { id: existing.id }, data: { label } });
    return existing;
  }
  return prisma.withdrawalAddress.create({ data: { userId, method, address, label } });
}

export async function isWhitelistedAddress(userId: string, method: string, address: string): Promise<boolean> {
  const found = await prisma.withdrawalAddress.findUnique({
    where: { userId_method_address: { userId, method, address } },
  });
  return !!found;
}