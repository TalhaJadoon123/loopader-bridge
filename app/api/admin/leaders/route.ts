import { verifyAdmin, adminDenied } from "@/lib/admin-auth";
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  leaderId: z.string().min(1),
  featured: z.boolean(),
});

export async function GET(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.authorized) return adminDenied();

  const leaders = await prisma.user.findMany({
    where: { copyLeads: { some: { isActive: true } } },
    include: {
      copyLeads: { where: { isActive: true } },
      trades: {
        where: { status: "CLOSED", openedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
        select: { profit: true, volume: true },
      },
    },
  });

  const formatted = leaders.map(leader => {
    const closedTrades = leader.trades;
    const totalProfit = closedTrades.reduce((sum, t) => sum + Number(t.profit), 0);
    const wins = closedTrades.filter(t => Number(t.profit) > 0).length;
    const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;
    const totalVolume = closedTrades.reduce((sum, t) => sum + Number(t.volume), 0);

    return {
      id: leader.id,
      name: leader.fullName ?? leader.email.split("@")[0],
      email: leader.email,
      gain30d: totalProfit,
      winRate: Math.round(winRate),
      totalVolume: Math.round(totalVolume),
      followers: leader.copyLeads.length,
      isFeatured: leader.isFeatured,
    };
  });

  formatted.sort((a, b) => b.gain30d - a.gain30d);

  return NextResponse.json({ leaders: formatted.slice(0, 50) });
}

export async function PATCH(req: Request) {
  const auth = await verifyAdmin(req);
  if (!auth.authorized) return adminDenied();

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = patchSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { leaderId, featured } = parse.data;

  const leader = await prisma.user.findUnique({ where: { id: leaderId } });
  if (!leader) return NextResponse.json({ error: "Leader not found" }, { status: 404 });

  await prisma.user.update({
    where: { id: leaderId },
    data: { isFeatured: featured },
  });

  await prisma.securityEvent.create({
    data: {
      userId: leaderId,
      event: featured ? "ADMIN_LEADER_FEATURED" : "ADMIN_LEADER_UNFEATURED",
      ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown",
      riskScore: 10,
    },
  });

  return NextResponse.json({ success: true });
}
