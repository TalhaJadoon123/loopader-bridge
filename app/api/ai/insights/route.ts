import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { computeInsights, getTradeScore } from "@/lib/ai/trade-analyzer";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tradeId = searchParams.get("tradeId");

  if (tradeId) {
    const score = await getTradeScore(tradeId);
    return NextResponse.json({ score });
  }

  const insights = await computeInsights(session.user.id);
  return NextResponse.json({ insights });
}