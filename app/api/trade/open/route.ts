import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { calculateMargin, getContractSize, getPipValue, validateVolume, checkRiskGuard, suggestSLTP, calculateATR, TIER_SPREADS } from "@/lib/trading/engine";
import { logSecurityEvent } from "@/lib/security/risk";
import { getClientIp } from "@/lib/security/rate-limit";
import { hashFingerprint } from "@/lib/security/device";
import { getGeoInfo } from "@/lib/security/geo";
import { consumeLimiter, tradeLimiter } from "@/lib/security/rate-limit";
import { cookies } from "next/headers";
import { z } from "zod";

const prisma = new PrismaClient();

const openSchema = z.object({
  symbol: z.string().transform((s) => s.toUpperCase()),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number().positive(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  idempotencyKey: z.string().min(10),
  accountId: z.string().optional(),
});

const ENGINE_URL = process.env.ENGINE_SERVICE_URL ?? "http://localhost:8080";
const ORCHESTRATOR_URL = process.env.ORCHESTRATOR_URL ?? "http://localhost:8000";
const USE_ORCHESTRATOR = process.env.USE_ORCHESTRATOR === "true";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent") ?? "";
  const fp = req.headers.get("x-device-fingerprint") ?? "";
  const fpHash = fp ? hashFingerprint(fp) : null;

  const { allowed, resetSec } = await consumeLimiter(tradeLimiter, `user:${session.user.id}`);
  if (!allowed) {
    return NextResponse.json({ error: "Rate limited", retryAfter: resetSec }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = openSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { symbol, side, volume, stopLoss, takeProfit, idempotencyKey, accountId: bodyAccountId } = parse.data;

  const existing = await prisma.trade.findFirst({ where: { idempotencyKey } });
  if (existing) return NextResponse.json({ error: "Duplicate request" }, { status: 409 });

  const volCheck = validateVolume(volume);
  if (!volCheck.valid) return NextResponse.json({ error: volCheck.message }, { status: 400 });

  // Determine account: use body accountId, or active account from cookie, or fallback to default
  let account;
  if (bodyAccountId) {
    account = await prisma.tradingAccount.findUnique({ where: { id: bodyAccountId } });
  } else {
    // Read active account from cookie
    const cookieStore = await cookies();
    const activeAccountId = cookieStore.get("active_account_id")?.value;
    if (activeAccountId) {
      account = await prisma.tradingAccount.findUnique({ where: { id: activeAccountId, userId: session.user.id, isActive: true } });
    }
    // Fallback: default account (DEMO preferred)
    if (!account) {
      account = await prisma.tradingAccount.findFirst({
        where: { userId: session.user.id, isDefault: true, isActive: true },
      });
    }
    if (!account) {
      account = await prisma.tradingAccount.findFirst({
        where: { userId: session.user.id, isActive: true },
        orderBy: { type: "asc" }, // DEMO first
      });
    }
  }

  if (!account) return NextResponse.json({ error: "No active account" }, { status: 400 });
  if (account.userId !== session.user.id) return NextResponse.json({ error: "Not your account" }, { status: 403 });

  // LIVE account trading check
  if (account.type === "LIVE" && !account.isTradingEnabled) {
    return NextResponse.json(
      {
        error: "Live trading not yet enabled",
        message: "The operator is configuring the LP connection. Use your DEMO account to practice.",
      },
      { status: 403 }
    );
  }

  const quotes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/market/quotes?symbols=${symbol}`).then((r) => r.json());
  const quote = quotes.quotes?.[0];
  if (!quote || quote.price === 0) return NextResponse.json({ error: "Price unavailable" }, { status: 503 });

  const spread = TIER_SPREADS[account.tier as keyof typeof TIER_SPREADS] ?? 0.8;
  const pipValue = getPipValue(symbol);
  const spreadCost = spread * pipValue * volume * getContractSize(symbol);

  const marginRequired = calculateMargin(volume, quote.price, account.leverage, symbol);
  if (Number(account.balance) < marginRequired + spreadCost) {
    return NextResponse.json({ error: "Insufficient margin" }, { status: 400 });
  }

  const recentTrades = await prisma.trade.findMany({
    where: { accountId: account.id, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 10,
  });
  const riskGuard = checkRiskGuard(
    recentTrades.map((t) => ({ profit: Number(t.profit), openedAt: t.openedAt! }))
  );

  const openPrice = side === "BUY" ? quote.price + spread * pipValue / 2 : quote.price - spread * pipValue / 2;

  let finalSL = stopLoss;
  let finalTP = takeProfit;

  if (!finalSL || !finalTP) {
    const candles = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/market/candles?symbol=${symbol}&interval=1h`).then((r) => r.json());
    const atr = calculateATR(candles.candles ?? []);
    const suggested = suggestSLTP(side, openPrice, atr);
    finalSL ??= suggested.stopLoss;
    finalTP ??= suggested.takeProfit;
  }

  // Forward order to Orchestrator (which routes to Rust engine with A/B/C book logic)
  // Include account_type so orchestrator knows DEMO vs LIVE
  const engineOrder = {
    user_id: session.user.id,
    symbol,
    side,
    order_type: "limit",
    price: openPrice,
    volume,
    account_type: account.type, // "DEMO" or "LIVE"
  };

  let engineOrderId: string;
  let engineStatus: string;
  let routingDecision: any = null;

  try {
    const targetUrl = USE_ORCHESTRATOR ? `${ORCHESTRATOR_URL}/order` : `${ENGINE_URL}/order`;
    const engineRes = await fetch(targetUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(engineOrder),
    });
    const engineData = await engineRes.json();
    if (!engineRes.ok) {
      return NextResponse.json({ error: engineData.message || "Engine rejected order" }, { status: 400 });
    }
    engineOrderId = engineData.order_id;
    engineStatus = engineData.status;
    routingDecision = engineData.routing_decision;
  } catch (e: any) {
    console.error("Engine/Orchestrator connection failed:", e);
    // Fallback: create trade locally if engine is down
    engineOrderId = `local-${Date.now()}`;
    engineStatus = "pending";
  }

  const trade = await prisma.trade.create({
    data: {
      accountId: account.id,
      userId: session.user.id,
      symbol,
      side,
      volume,
      openPrice,
      stopLoss: finalSL,
      takeProfit: finalTP,
      status: engineStatus === "filled" ? "OPEN" : "PENDING",
      idempotencyKey,
      engineOrderId,
      routingDecision: routingDecision?.book_type ?? null,
    },
  });

  await prisma.tradingAccount.update({
    where: { id: account.id },
    data: { balance: { decrement: marginRequired + spreadCost } },
  });

  await logSecurityEvent(
    session.user.id,
    "TRADE_OPENED",
    ip,
    userAgent,
    fpHash,
    (await getGeoInfo(ip))?.country ?? null,
    5
  );

  // First Trade badge (idempotent via unique constraint)
  try {
    const tradeCount = await prisma.trade.count({ where: { userId: session.user.id } });
    if (tradeCount === 1) {
      const badge = await prisma.badge.findUnique({ where: { code: "FIRST_TRADE" } });
      if (badge) {
        await prisma.userBadge.upsert({
          where: { userId_badgeId: { userId: session.user.id, badgeId: badge.id } },
          create: { userId: session.user.id, badgeId: badge.id },
          update: {},
        });
      }
    }
  } catch (e) {
    console.error("FIRST_TRADE badge award failed:", e);
  }

  return NextResponse.json({
    trade: { ...trade, volume: Number(trade.volume), openPrice: Number(trade.openPrice) },
    marginUsed: marginRequired,
    spreadCost,
    riskWarning: riskGuard.message,
    engineOrderId,
    engineStatus,
    routingDecision,
  });
}