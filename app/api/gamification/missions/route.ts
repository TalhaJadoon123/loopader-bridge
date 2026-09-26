import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userMissions = await prisma.userMission.findMany({
    where: { userId: session.user.id },
    include: { mission: true },
  });

  return NextResponse.json({ missions: userMissions.map(um => ({
    id: um.mission.id,
    title: um.mission.title,
    description: um.mission.description,
    xpReward: um.mission.xpReward,
    expiresDaily: um.mission.expiresDaily,
    progress: um.progress,
    completed: !!um.completedAt,
  })) });
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

  const { missionId, progress } = body as { missionId: string; progress: number };
  if (!missionId) return NextResponse.json({ error: "missionId required" }, { status: 400 });

  const um = await prisma.userMission.findUnique({
    where: { userId_missionId: { userId: session.user.id, missionId } },
    include: { mission: true },
  });
  if (!um) return NextResponse.json({ error: "Mission not found" }, { status: 404 });

  const newProgress = Math.min(um.mission.xpReward, (um.progress ?? 0) + (progress ?? 1));
  const completed = newProgress >= um.mission.xpReward && !um.completedAt;

  await prisma.userMission.update({
    where: { id: um.id },
    data: { progress: newProgress, completedAt: completed ? new Date() : null },
  });

  if (completed) {
    await prisma.xpLog.create({ data: { userId: session.user.id, points: um.mission.xpReward, source: "mission" } });
    await checkAndAwardBadges(session.user.id);
  }

  return NextResponse.json({ progress: newProgress, completed });
}

async function checkAndAwardBadges(userId: string) {
  const userMissions = await prisma.userMission.findMany({ where: { userId, completedAt: { not: null } } });
  const completedCount = userMissions.length;

  const badgeChecks = [
    { code: "JOURNAL_KEEPER", condition: completedCount >= 50 },
  ];

  for (const check of badgeChecks) {
    if (check.condition) {
      const badge = await prisma.badge.findUnique({ where: { code: check.code } });
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId, badgeId: badge.id } },
          create: { userId, badgeId: badge.id },
          update: {},
        });
      }
    }
  }
}