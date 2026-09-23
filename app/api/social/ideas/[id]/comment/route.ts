import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();
const commentSchema = z.object({ content: z.string().min(1).max(500) });

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = commentSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid content" }, { status: 400 });

  const comment = await prisma.tradeIdeaComment.create({
    data: {
      userId: session.user.id,
      ideaId: params.id,
      content: parse.data.content,
    },
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
  });

  return NextResponse.json({ comment }, { status: 201 });
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const comments = await prisma.tradeIdeaComment.findMany({
    where: { ideaId: params.id },
    include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ comments });
}