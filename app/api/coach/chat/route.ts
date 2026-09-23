import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { coachChat, getQuickPrompts, journalInsight } from "@/lib/ai/coach";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({ prompts: getQuickPrompts() });
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

  const { message, history, journalNote, tradeId } = body as {
    message?: string;
    history?: { role: string; content: string }[];
    journalNote?: string;
    tradeId?: string;
  };

  if (journalNote && tradeId) {
    const insight = await journalInsight(session.user.id, tradeId, journalNote);
    if (insight) {
      await prisma.journalEntry.update({
        where: { id: tradeId },
        data: { aiInsight: insight },
      });
      return NextResponse.json({ insight });
    }
    return NextResponse.json({ insight: null });
  }

  if (!message) return NextResponse.json({ error: "Message required" }, { status: 400 });

  const result = await coachChat(session.user.id, message, history ?? []);

  return NextResponse.json({ response: result.response, remaining: result.remaining });
}