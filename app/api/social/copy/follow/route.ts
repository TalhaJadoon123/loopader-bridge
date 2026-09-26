import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { leaderId, allocationPct } = body as { leaderId: string; allocationPct: number };
  if (!leaderId || !allocationPct || allocationPct < 1 || allocationPct > 50) {
    return NextResponse.json({ error: "Invalid allocation (1-50%)" }, { status: 400 });
  }

  if (leaderId === session.user.id) {
    return NextResponse.json({ error: "Cannot follow yourself" }, { status: 400 });
  }

  const existing = await prisma.copyRelationship.findUnique({
    where: { followerId_leaderId: { followerId: session.user.id, leaderId } },
  });
  if (existing) {
    return NextResponse.json({ error: "Already following this leader" }, { status: 400 });
  }

  const leader = await prisma.user.findUnique({ where: { id: leaderId } });
  if (!leader) return NextResponse.json({ error: "Leader not found" }, { status: 404 });

  const followerAccount = await prisma.tradingAccount.findFirst({
    where: { userId: session.user.id, type: "LIVE", isActive: true },
  });
  if (!followerAccount) return NextResponse.json({ error: "No active live account" }, { status: 400 });

  await prisma.copyRelationship.create({
    data: {
      followerId: session.user.id,
      leaderId,
      allocationPct,
      riskLevel: "MEDIUM",
    },
  });

  return NextResponse.json({ success: true });
}