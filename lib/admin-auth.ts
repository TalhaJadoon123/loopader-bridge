import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export interface AdminAuthResult {
  authorized: boolean;
  userId?: string;
  email?: string;
}

// Verify the request is from an ADMIN user
// Returns { authorized: true, userId, email } or { authorized: false }
export async function verifyAdmin(req: Request): Promise<AdminAuthResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) return { authorized: false };
  if ((session as any).user?.role !== "ADMIN") return { authorized: false };

  // Double-check against DB (session might be stale)
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, accountFrozen: true, email: true },
  });
  if (!user || user.role !== "ADMIN" || user.accountFrozen) return { authorized: false };

  // Log admin access
  await prisma.securityEvent.create({
    data: {
      userId: session.user.id,
      event: "ADMIN_ACCESS",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      riskScore: 0,
    },
  }).catch(() => {});

  return { authorized: true, userId: session.user.id, email: user.email };
}

// Returns a 404 response (not 403 — don't reveal admin routes exist)
export function adminDenied(): NextResponse {
  return NextResponse.json({ error: "Not Found" }, { status: 404 });
}