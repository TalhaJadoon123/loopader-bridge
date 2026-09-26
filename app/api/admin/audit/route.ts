import { verifyAdmin, adminDenied } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.authorized) return adminDenied();

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "100") || 100, 500);
  const offset = parseInt(searchParams.get("offset") ?? "0") || 0;
  const event = searchParams.get("event");

  const where: any = {};
  if (event && event !== "all") where.event = { contains: event, mode: "insensitive" };

  const [events, total] = await Promise.all([
    prisma.securityEvent.findMany({
      where,
      take: limit,
      skip: offset,
      orderBy: { createdAt: "desc" },
      include: { user: { select: { email: true, fullName: true } } },
    }),
    prisma.securityEvent.count({ where }),
  ]);

  return NextResponse.json({
    total,
    events: events.map(e => ({
      id: e.id,
      event: e.event,
      user: e.user ? { email: e.user.email, fullName: e.user.fullName } : null,
      ip: e.ip,
      country: e.country,
      deviceFingerprint: e.deviceFingerprint,
      riskScore: e.riskScore,
      createdAt: e.createdAt,
    })),
  });
}
