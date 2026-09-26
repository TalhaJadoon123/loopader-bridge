import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const streak = await prisma.streak.findUnique({ where: { userId: session.user.id } });
  if (!streak) return NextResponse.json({ current: 0, longest: 0, freezes: 2 });

  return NextResponse.json({ current: streak.current, longest: streak.longest, freezes: streak.freezes });
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const streak = await prisma.streak.findUnique({ where: { userId: session.user.id } });
  if (!streak) {
    await prisma.streak.create({ data: { userId: session.user.id, current: 1, longest: 1, lastActiveDate: today, freezes: 2 } });
    return NextResponse.json({ current: 1, longest: 1, freezes: 2 });
  }

  const lastActive = streak.lastActiveDate ? new Date(streak.lastActiveDate) : null;
  if (lastActive) {
    lastActive.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      return NextResponse.json({ current: streak.current, longest: streak.longest, freezes: streak.freezes });
    }

    if (diffDays === 1) {
      const newCurrent = streak.current + 1;
      const newLongest = Math.max(streak.longest, newCurrent);
      await prisma.streak.update({
        where: { userId: session.user.id },
        data: { current: newCurrent, longest: newLongest, lastActiveDate: today },
      });
      return NextResponse.json({ current: newCurrent, longest: newLongest, freezes: streak.freezes });
    }

    if (diffDays > 1 && streak.freezes > 0) {
      await prisma.streak.update({
        where: { userId: session.user.id },
        data: { freezes: streak.freezes - 1, lastActiveDate: today },
      });
      return NextResponse.json({ current: streak.current, longest: streak.longest, freezes: streak.freezes - 1, freezeUsed: true });
    }
  }

  await prisma.streak.update({
    where: { userId: session.user.id },
    data: { current: 1, lastActiveDate: today },
  });
  return NextResponse.json({ current: 1, longest: streak.longest, freezes: streak.freezes, streakBroken: true });
}