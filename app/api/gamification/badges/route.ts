import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const badges = await prisma.badge.findMany({ orderBy: { createdAt: "asc" } });
  const userBadges = await prisma.userBadge.findMany({
    where: { userId: session.user.id },
    include: { badge: true },
  });
  const earnedIds = new Set(userBadges.map(ub => ub.badgeId));

  return NextResponse.json({
    badges: badges.map(b => ({
      id: b.id,
      code: b.code,
      name: b.name,
      icon: b.icon,
      criteria: b.criteria,
      earned: earnedIds.has(b.id),
      earnedAt: userBadges.find(ub => ub.badgeId === b.id)?.earnedAt ?? null,
    })),
  });
}