import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const copies = await prisma.copyRelationship.findMany({
    where: { followerId: session.user.id },
    include: { leader: { select: { fullName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    copies: copies.map(c => ({
      id: c.id,
      leaderId: c.leaderId,
      leaderName: c.leader.fullName ?? "Trader",
      allocationPct: c.allocationPct,
      riskLevel: c.riskLevel,
      createdAt: c.createdAt,
      isActive: c.isActive,
    })),
  });
}