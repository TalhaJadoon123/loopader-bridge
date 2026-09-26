import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const challenges = await prisma.challenge.findMany({
    where: { isActive: true },
    include: {
      participants: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
      _count: { select: { participants: true } },
    },
    orderBy: { endsAt: "asc" },
    take: 20,
  });

  const myEntries = await prisma.challengeParticipant.findMany({
    where: { userId: session.user.id },
    include: { challenge: true },
  });
  const myChallengeIds = new Set(myEntries.map(e => e.challengeId));

  return NextResponse.json({
    challenges: challenges.map(c => ({
      id: c.id,
      title: c.title,
      description: c.description,
      type: c.type,
      prize: c.prize,
      startsAt: c.startsAt,
      endsAt: c.endsAt,
      participantCount: c._count.participants,
      joined: myChallengeIds.has(c.id),
      participants: c.participants.slice(0, 5).map(p => ({
        name: p.user.fullName ?? "Top Trader",
        score: p.score,
        rank: p.rank,
      })),
    })),
    myEntries: myEntries.map(e => ({
      challengeId: e.challengeId,
      title: e.challenge.title,
      score: e.score,
      rank: e.rank,
      status: e.challenge.status,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { challengeId } = body as { challengeId: string };

  const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge || !challenge.isActive) return NextResponse.json({ error: "Challenge not found" }, { status: 404 });

  const existing = await prisma.challengeParticipant.findUnique({
    where: { userId_challengeId: { userId: session.user.id, challengeId } },
  });
  if (existing) return NextResponse.json({ error: "Already joined" }, { status: 400 });

  const participant = await prisma.challengeParticipant.create({
    data: { userId: session.user.id, challengeId },
  });

  return NextResponse.json({ participant }, { status: 201 });
}