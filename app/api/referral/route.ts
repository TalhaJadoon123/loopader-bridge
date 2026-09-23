import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const referrals = await prisma.referral.findMany({
    where: { referrerId: session.user.id },
    include: { referee: { select: { email: true, fullName: true, createdAt: true } } },
    orderBy: { createdAt: "desc" },
  });

  const totalBonus = referrals
    .filter(r => r.status === "PAID")
    .reduce((sum, r) => sum + Number(r.bonusUsd), 0);

  const stats = {
    total: referrals.length,
    pending: referrals.filter(r => r.status === "PENDING").length,
    qualified: referrals.filter(r => r.status === "QUALIFIED").length,
    paid: referrals.filter(r => r.status === "PAID").length,
    totalBonus: Math.round(totalBonus * 100) / 100,
  };

  return NextResponse.json({
    referralLink: `${process.env.NEXT_PUBLIC_APP_URL}/register?ref=${session.user.id}`,
    stats,
    referrals: referrals.map(r => ({
      id: r.id,
      email: r.referee.email,
      name: r.referee.fullName,
      bonusUsd: Number(r.bonusUsd),
      status: r.status,
      joinedAt: r.referee.createdAt,
      createdAt: r.createdAt,
    })),
  });
}