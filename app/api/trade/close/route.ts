import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { calculateProfit, getContractSize, TIER_SPREADS } from "@/lib/trading/engine";
import { logSecurityEvent } from "@/lib/security/risk";
import { getClientIp } from "@/lib/security/rate-limit";
import { hashFingerprint } from "@/lib/security/device";
import { getGeoInfo } from "@/lib/security/geo";
import { createNotification } from "@/lib/notify";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fp = req.headers.get("x-device-fingerprint") ?? "";
  const fpHash = fp ? hashFingerprint(fp) : null;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { tradeId } = body as { tradeId: string };
  if (!tradeId) return NextResponse.json({ error: "tradeId required" }, { status: 400 });

  const trade = await prisma.trade.findUnique({ where: { id: tradeId }, include: { account: true } });
  if (!trade) return NextResponse.json({ error: "Trade not found" }, { status: 404 });
  if (trade.userId !== session.user.id) return NextResponse.json({ error: "Not your trade" }, { status: 403 });
  if (trade.status !== "OPEN") return NextResponse.json({ error: "Trade not open" }, { status: 400 });

  const quotes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/market/quotes?symbols=${trade.symbol}`).then((r) => r.json());
  const quote = quotes.quotes?.[0];
  if (!quote || quote.price === 0) return NextResponse.json({ error: "Price unavailable" }, { status: 503 });

  const spread = TIER_SPREADS[trade.account.tier as keyof typeof TIER_SPREADS] ?? 0.8;
  const pipValue = trade.symbol.endsWith("JPY") || trade.symbol === "XAUUSD" || trade.symbol === "BTCUSD" ? 0.01 : 0.0001;
  const closePrice = trade.side === "BUY" ? quote.price - spread * pipValue / 2 : quote.price + spread * pipValue / 2;

  const profit = calculateProfit(trade.side, Number(trade.openPrice), closePrice, Number(trade.volume), trade.symbol);

  // Release the margin reserved when the trade was opened
  const marginReleased = (Number(trade.volume) * getContractSize(trade.symbol) * Number(trade.openPrice)) / trade.account.leverage;

  await prisma.$transaction(async (tx) => {
    await tx.trade.update({
      where: { id: tradeId },
      data: { status: "CLOSED", closePrice, profit, closedAt: new Date() },
    });
    await tx.tradingAccount.update({
      where: { id: trade.accountId },
      data: { balance: { increment: profit + marginReleased } },
    });
  });

  await logSecurityEvent(
    session.user.id,
    "TRADE_CLOSED",
    ip,
    userAgent,
    fpHash,
    (await getGeoInfo(ip))?.country ?? null,
    5
  );

  // In-app + push notification for the fill
  createNotification(
    session.user.id,
    "trade",
    profit >= 0 ? `Trade closed: +$${profit.toFixed(2)}` : `Trade closed: -$${Math.abs(profit).toFixed(2)}`,
    `${trade.side} ${trade.volume} ${trade.symbol} closed at ${closePrice}.`,
    { tradeId }
  ).catch(() => {});

  return NextResponse.json({ profit, closePrice });
}