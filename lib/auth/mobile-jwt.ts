import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET ?? "loopader-dev-secret";
const REFRESH_SECRET = process.env.JWT_ACCESS_SECRET ?? "loopader-dev-secret";

const ACCESS_TTL = 15 * 60;
const REFRESH_TTL = 30 * 24 * 60 * 60;

export interface MobileTokenPayload {
  sub: string;
  email: string;
  role: string;
  deviceFp?: string;
  type: "access" | "refresh";
}

export function signAccessToken(user: { id: string; email: string; role: string }, deviceFp?: string): string {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role, deviceFp, type: "access" },
    ACCESS_SECRET,
    { expiresIn: ACCESS_TTL, issuer: "loopader-mobile" }
  );
}

export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: "refresh" },
    REFRESH_SECRET,
    { expiresIn: REFRESH_TTL, issuer: "loopader-mobile" }
  );
}

export function verifyAccessToken(token: string): MobileTokenPayload | null {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as MobileTokenPayload;
    if (decoded.type !== "access") return null;
    return decoded;
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { sub: string } | null {
  try {
    const decoded = jwt.verify(token, REFRESH_SECRET) as { sub: string; type: string };
    if (decoded.type !== "refresh") return null;
    return decoded;
  } catch {
    return null;
  }
}

// Get authenticated user from a Request: accepts Bearer JWT (mobile) OR NextAuth session cookie (web)
export async function getAuthUser(req: Request): Promise<{
  user: { id: string; email: string; role: string } | null;
  deviceFp: string | null;
  authType: "jwt" | "cookie" | null;
}> {
  const authHeader = req.headers.get("authorization");
  const deviceFp = req.headers.get("x-device-fingerprint");

  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    const payload = verifyAccessToken(token);
    if (!payload) return { user: null, deviceFp, authType: null };
    return { user: { id: payload.sub, email: payload.email, role: payload.role }, deviceFp, authType: "jwt" };
  }

  // Fallback: cookie session (web)
  try {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("./options");
    const session = await getServerSession(authOptions);
    if (session?.user?.id) {
      return { user: { id: session.user.id, email: session.user.email ?? "", role: session.user.role }, deviceFp, authType: "cookie" };
    }
  } catch {}

  return { user: null, deviceFp, authType: null };
}

export async function requireAuthUser(req: Request) {
  const { user, deviceFp, authType } = await getAuthUser(req);
  return { user, deviceFp, authType };
}

export async function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}