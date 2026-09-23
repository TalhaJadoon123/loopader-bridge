import { hashFingerprint, parseDeviceInfo, isVpnUserAgent } from "./device";
import { getGeoInfo, isGeoAnomaly } from "./geo";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface RiskInput {
  userId: string;
  ip: string;
  userAgent: string;
  deviceFingerprint?: string;
  action: string;
}

export interface RiskResult {
  score: number;
  factors: string[];
  require2FA: boolean;
  requireReauth: boolean;
}

export async function calculateRisk(input: RiskInput): Promise<RiskResult> {
  const factors: string[] = [];
  let score = 0;

  const fpHash = input.deviceFingerprint ? hashFingerprint(input.deviceFingerprint) : null;

  const existingDevice = fpHash
    ? await prisma.securityEvent.findFirst({
        where: { userId: input.userId, deviceFingerprint: fpHash, event: "LOGIN_SUCCESS" },
        orderBy: { createdAt: "desc" },
      })
    : null;

  if (!existingDevice && fpHash) {
    score += 10;
    factors.push("New device (+10)");
  }

  const lastLogin = await prisma.securityEvent.findFirst({
    where: { userId: input.userId, event: "LOGIN_SUCCESS" },
    orderBy: { createdAt: "desc" },
  });

  const currentGeo = await getGeoInfo(input.ip);
  if (lastLogin?.ip) {
    const lastGeo = await getGeoInfo(lastLogin.ip);
    const anomaly = isGeoAnomaly(lastGeo, currentGeo, 2);
    if (anomaly.anomaly) {
      score += 25;
      factors.push(`Geo anomaly: ${anomaly.reason} (+25)`);
    }
  }

  const { browser, os, device } = parseDeviceInfo(input.userAgent);
  if (isVpnUserAgent(input.userAgent)) {
    score += 15;
    factors.push("VPN/Proxy detected (+15)");
  }

  if (input.action === "WITHDRAWAL" && score < 20) score = 20;

  const require2FA = score >= 40;
  const requireReauth = score >= 60 || input.action === "WITHDRAWAL";

  if (require2FA) factors.push("2FA required");
  if (requireReauth) factors.push("Re-authentication required");

  return { score, factors, require2FA, requireReauth };
}

export async function logSecurityEvent(
  userId: string | null,
  event: string,
  ip: string,
  userAgent: string,
  deviceFingerprint: string | null,
  country: string | null,
  riskScore: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  await prisma.securityEvent.create({
    data: {
      userId: userId ?? undefined,
      event,
      ip,
      deviceFingerprint: deviceFingerprint ?? undefined,
      country: country ?? undefined,
      riskScore,
    },
  });
}