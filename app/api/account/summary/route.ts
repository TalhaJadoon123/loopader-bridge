import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { getContractSize } from "@/lib/trading/engine";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "LIVE") as "LIVE" | "DEMO";

  const account = await prisma.tradingAccount.findFirst({
    where: { userId: session.user.id, type, isActive: true },
    include: {
      trades: { where: { status: "OPEN" } },
    },
  });

  if (!account) {
    return NextResponse.json({ error: `No active ${type} account` }, { status: 404 });
  }

  // Unrealized P&L of open positions at current prices (best-effort)
  let unrealized = 0;
  if (account.trades.length > 0) {
    try {
      const symbols = Array.from(new Set(account.trades.map(t => t.symbol)));
      const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/market/quotes?symbols=${symbols.join(",")}`);
      const json = await res.json();
      const priceMap = new Map<string, number>((json.quotes ?? []).map((q: any) => [q.symbol, Number(q.price)]));
      for (const t of account.trades) {
        const price = priceMap.get(t.symbol);
        if (price) {
          const diff = t.side === "BUY" ? price - Number(t.openPrice) : Number(t.openPrice) - price;
          unrealized += diff * Number(t.volume) * getContractSize(t.symbol);
        }
      }
    } catch { /* quotes unavailable — unrealized stays 0 */ }
  }

  const marginUsed = account.trades.reduce((sum, t) => {
    const notional = Number(t.volume) * getContractSize(t.symbol) * Number(t.openPrice);
    return sum + notional / account.leverage;
  }, 0);

  const balance = Number(account.balance);
  const equity = balance + unrealized;
  const freeMargin = equity - marginUsed;
  const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 10000;

  return NextResponse.json({
    id: account.id,
    type: account.type,
    tier: account.tier,
    balance: Math.round(balance * 100) / 100,
    equity: Math.round(equity * 100) / 100,
    margin: Math.round(marginUsed * 100) / 100,
    freeMargin: Math.round(freeMargin * 100) / 100,
    marginLevel: Math.round(marginLevel * 100) / 100,
    unrealizedPnL: Math.round(unrealized * 100) / 100,
    leverage: account.leverage,
    openPositions: account.trades.length,
  });
}