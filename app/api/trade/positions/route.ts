import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { calculateProfit, getContractSize } from "@/lib/trading/engine";

const prisma = new PrismaClient();
const ENGINE_URL = process.env.ENGINE_SERVICE_URL ?? "http://localhost:8080";
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8000";
const USE_ORCHESTRATOR = process.env.USE_ORCHESTRATOR === "true";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");

  const where: any = { userId: session.user.id, status: "OPEN" };
  if (accountId) where.accountId = accountId;

  const trades = await prisma.trade.findMany({
    where,
    include: { account: true },
    orderBy: { openedAt: "desc" },
  });

  // Fetch orderbook from Orchestrator (or Rust engine directly)
  const symbols = Array.from(new Set(trades.map((t) => t.symbol)));
  const enginePrices = new Map<string, number>();

  const targetBaseUrl = USE_ORCHESTRATOR ? ORCHESTRATOR_URL : ENGINE_URL;

  await Promise.all(symbols.map(async (symbol) => {
    try {
      const res = await fetch(`${targetBaseUrl}/orderbook/${symbol}`);
      if (res.ok) {
        const data = await res.json();
        const bestBid = data.bids[0]?.price;
        const bestAsk = data.asks[0]?.price;
        if (bestBid && bestAsk) {
          enginePrices.set(symbol, (bestBid + bestAsk) / 2);
        } else if (bestBid) {
          enginePrices.set(symbol, bestBid);
        } else if (bestAsk) {
          enginePrices.set(symbol, bestAsk);
        }
      }
    } catch (e) {
      console.warn(`Engine orderbook fetch failed for ${symbol}:`, e);
    }
  }));

  // Fallback to market quotes API
  const quotes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/market/quotes?symbols=${symbols.join(",")}`).then((r) => r.json()).catch(() => ({ quotes: [] }));
  const quoteMap = new Map<string, any>((quotes.quotes ?? []).map((q: any) => [q.symbol, q]));

  const positions = trades.map((t) => {
    const enginePrice = enginePrices.get(t.symbol);
    const quote = quoteMap.get(t.symbol);
    const currentPrice = enginePrice ?? quote?.price ?? Number(t.openPrice);
    const unrealizedProfit = calculateProfit(t.side, Number(t.openPrice), currentPrice, Number(t.volume), t.symbol);
    return {
      ...t,
      volume: Number(t.volume),
      openPrice: Number(t.openPrice),
      currentPrice,
      unrealizedProfit,
      marginUsed: (Number(t.volume) * getContractSize(t.symbol) * Number(t.openPrice)) / t.account.leverage,
    };
  });

  return NextResponse.json({ positions });
}