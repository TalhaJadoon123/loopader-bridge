import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const modifySchema = z.object({
  tradeId: z.string(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = modifySchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { tradeId, stopLoss, takeProfit } = parse.data;
  if (stopLoss === undefined && takeProfit === undefined) {
    return NextResponse.json({ error: "No changes provided" }, { status: 400 });
  }

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== session.user.id) return NextResponse.json({ error: "Not your trade" }, { status: 403 });
  if (trade.status !== "OPEN") return NextResponse.json({ error: "Trade not open" }, { status: 400 });

  const quotes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/market/quotes?symbols=${trade.symbol}`).then((r) => r.json());
  const quote = quotes.quotes?.[0];
  if (!quote || quote.price === 0) return NextResponse.json({ error: "Price unavailable" }, { status: 503 });

  const currentPrice = quote.price;
  const side = trade.side;

  if (stopLoss !== undefined) {
    if (side === "BUY" && stopLoss >= currentPrice) {
      return NextResponse.json({ error: "Stop loss must be below current price for BUY" }, { status: 400 });
    }
    if (side === "SELL" && stopLoss <= currentPrice) {
      return NextResponse.json({ error: "Stop loss must be above current price for SELL" }, { status: 400 });
    }
  }

  if (takeProfit !== undefined) {
    if (side === "BUY" && takeProfit <= currentPrice) {
      return NextResponse.json({ error: "Take profit must be above current price for BUY" }, { status: 400 });
    }
    if (side === "SELL" && takeProfit >= currentPrice) {
      return NextResponse.json({ error: "Take profit must be below current price for SELL" }, { status: 400 });
    }
  }

  const updated = await prisma.trade.update({
    where: { id: tradeId },
    data: {
      stopLoss: stopLoss ?? trade.stopLoss,
      takeProfit: takeProfit ?? trade.takeProfit,
    },
  });

  return NextResponse.json({
    trade: { ...updated, volume: Number(updated.volume), openPrice: Number(updated.openPrice) },
  });
}