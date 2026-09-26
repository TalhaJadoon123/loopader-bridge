import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { getAsset, validateVolume } from "@/lib/trading/assets";
import { TIER_SPREADS, getPipValue, getContractSize } from "@/lib/trading/engine";
import { consumeLimiter, tradeLimiter } from "@/lib/security/rate-limit";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const placeSchema = z.object({
  symbol: z.string().transform(s => s.toUpperCase()),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number().positive(),
  orderType: z.enum(["LIMIT", "STOP", "STOP_LIMIT", "OCO"]),
  triggerPrice: z.number().positive(),
  limitPrice: z.number().optional(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
  isGuaranteedStop: z.boolean().optional(),
  trailingStopDistance: z.number().optional(),
  idempotencyKey: z.string().min(10),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pending = await prisma.trade.findMany({
    where: { userId: session.user.id, status: "PENDING" },
    orderBy: { openedAt: "desc" },
    take: 50,
  });

  return NextResponse.json({
    orders: pending.map(o => ({
      id: o.id,
      symbol: o.symbol,
      side: o.side,
      volume: Number(o.volume),
      orderType: o.orderType,
      triggerPrice: o.triggerPrice ? Number(o.triggerPrice) : null,
      stopLoss: o.stopLoss ? Number(o.stopLoss) : null,
      takeProfit: o.takeProfit ? Number(o.takeProfit) : null,
      isGuaranteedStop: o.isGuaranteedStop,
      trailingStopDistance: o.trailingStopDistance ? Number(o.trailingStopDistance) : null,
      status: o.status,
      createdAt: o.openedAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { allowed } = await consumeLimiter(tradeLimiter, `user:${session.user.id}`);
  if (!allowed) return NextResponse.json({ error: "Rate limited" }, { status: 429 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = placeSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });

  const d = parse.data;
  const asset = getAsset(d.symbol);
  if (!asset) return NextResponse.json({ error: "Unknown symbol" }, { status: 400 });
  const volCheck = validateVolume(d.symbol, d.volume);
  if (!volCheck.valid) return NextResponse.json({ error: volCheck.message }, { status: 400 });

  if (d.isGuaranteedStop && !d.stopLoss && !d.takeProfit) {
    return NextResponse.json({ error: "Guaranteed stop requires an SL or TP" }, { status: 400 });
  }

  const account = await prisma.tradingAccount.findFirst({
    where: { userId: session.user.id, type: "LIVE", isActive: true },
  });
  if (!account) return NextResponse.json({ error: "No active live account" }, { status: 400 });

  const spreadCost = d.volume * (TIER_SPREADS[account.tier as keyof typeof TIER_SPREADS] ?? 0.8) * getPipValue(d.symbol) * getContractSize(d.symbol);

  const order = await prisma.trade.create({
    data: {
      accountId: account.id,
      userId: session.user.id,
      symbol: d.symbol,
      side: d.side,
      volume: d.volume,
      orderType: d.orderType,
      triggerPrice: d.triggerPrice,
      openPrice: d.limitPrice ?? d.triggerPrice,
      stopLoss: d.stopLoss,
      takeProfit: d.takeProfit,
      isGuaranteedStop: d.isGuaranteedStop ?? false,
      trailingStopDistance: d.trailingStopDistance,
      status: "PENDING",
      openedAt: new Date(),
      idempotencyKey: d.idempotencyKey,
    },
  });

  return NextResponse.json({
    order: { id: order.id, symbol: order.symbol, orderType: order.orderType, triggerPrice: Number(order.triggerPrice), status: "PENDING" },
    marginHeld: Math.round(spreadCost * 100) / 100,
  }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get("id");
  if (!orderId) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await prisma.trade.updateMany({
    where: { id: orderId, userId: session.user.id, status: "PENDING" },
    data: { status: "CANCELLED" },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}