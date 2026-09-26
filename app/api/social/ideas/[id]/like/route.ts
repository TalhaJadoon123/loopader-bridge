import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await prisma.tradeIdeaLike.findUnique({
    where: { userId_ideaId: { userId: session.user.id, ideaId: params.id } },
  });

  if (existing) {
    await prisma.tradeIdeaLike.delete({ where: { id: existing.id } });
    return NextResponse.json({ liked: false });
  }

  await prisma.tradeIdeaLike.create({
    data: { userId: session.user.id, ideaId: params.id },
  });

  return NextResponse.json({ liked: true });
}