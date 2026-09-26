import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const limit = parseInt(searchParams.get("limit") ?? "20");

  const ideas = await prisma.tradeIdea.findMany({
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
    include: {
      author: { select: { id: true, fullName: true, avatarUrl: true } },
      likes: { select: { userId: true } },
      comments: { select: { id: true } },
    },
  });

  return NextResponse.json({
    ideas: ideas.map((idea) => ({
      ...idea,
      liked: session?.user?.id ? idea.likes.some((l) => l.userId === session.user.id) : false,
      likeCount: idea.likes.length,
      commentCount: idea.comments.length,
    })),
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

  const { symbol, direction, note, chartSnapshot } = body as {
    symbol: string;
    direction: "LONG" | "SHORT";
    note: string;
    chartSnapshot?: string;
  };

  if (!symbol || !direction || !note) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const tradeSide = direction === "LONG" ? "BUY" : "SELL";

  const idea = await prisma.tradeIdea.create({
    data: {
      authorId: session.user.id,
      symbol: symbol.toUpperCase(),
      direction: tradeSide,
      note,
      chartSnapshot,
    },
  });

  return NextResponse.json({ idea }, { status: 201 });
}