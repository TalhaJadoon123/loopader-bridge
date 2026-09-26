import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const xpLogs = await prisma.xpLog.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const totalXp = xpLogs.reduce((sum, log) => sum + log.points, 0);
  const level = Math.floor(totalXp / 1000) + 1;
  const xpInLevel = totalXp % 1000;
  const xpForNextLevel = 1000;

  const titles = ["Beginner", "Apprentice", "Trader", "Pro", "Master", "Legend"];
  const title = titles[Math.min(level - 1, titles.length - 1)];

  return NextResponse.json({
    totalXp,
    level,
    title,
    xpInLevel,
    xpForNextLevel,
    recentLogs: xpLogs.map(l => ({ points: l.points, source: l.source, createdAt: l.createdAt })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { points, source } = body as { points: number; source: string };
  if (!points || !source) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await prisma.xpLog.create({ data: { userId: session.user.id, points, source } });

  const logs = await prisma.xpLog.findMany({ where: { userId: session.user.id } });
  const totalXp = logs.reduce((sum, log) => sum + log.points, 0);
  const level = Math.floor(totalXp / 1000) + 1;

  return NextResponse.json({ success: true, totalXp, level });
}