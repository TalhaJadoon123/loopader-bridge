import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { isMt5Enabled, mt5MarketOrder, mt5ClosePosition, mt5ModifySLTP } from "@/lib/mt5/metaapi";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/security/risk";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const openSchema = z.object({
  mt5AccountId: z.string(),
  symbol: z.string().transform(s => s.toUpperCase()),
  side: z.enum(["BUY", "SELL"]),
  volume: z.number().positive(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
});

const closeSchema = z.object({
  mt5AccountId: z.string(),
  positionId: z.string(),
});

const modifySchema = z.object({
  mt5AccountId: z.string(),
  positionId: z.string(),
  stopLoss: z.number().optional(),
  takeProfit: z.number().optional(),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMt5Enabled()) return NextResponse.json({ error: "MT5 integration not configured" }, { status: 503 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") ?? "open";

  const mt5 = await prisma.mt5Account.findFirst({
    where: { id: (body as any)?.mt5AccountId, userId: session.user.id, isActive: true },
  });
  if (!mt5) return NextResponse.json({ error: "MT5 account not found" }, { status: 404 });

  try {
    if (action === "open") {
      const parse = openSchema.safeParse(body);
      if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
      const d = parse.data;

      const result = await mt5MarketOrder(mt5.metaapiId, {
        symbol: d.symbol, side: d.side, volume: d.volume,
        stopLoss: d.stopLoss, takeProfit: d.takeProfit,
      });

      await logSecurityEvent(session.user.id, "MT5_TRADE_OPENED", "system", "", null, null, 10);
      return NextResponse.json({ success: true, positionId: (result as any)?.positionId ?? (result as any)?.orderId ?? null, result });
    }

    if (action === "close") {
      const parse = closeSchema.safeParse(body);
      if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
      const result = await mt5ClosePosition(mt5.metaapiId, parse.data.positionId);
      await logSecurityEvent(session.user.id, "MT5_TRADE_CLOSED", "system", "", null, null, 10);
      return NextResponse.json({ success: true, result });
    }

    if (action === "modify") {
      const parse = modifySchema.safeParse(body);
      if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
      const result = await mt5ModifySLTP(mt5.metaapiId, parse.data.positionId, parse.data.stopLoss, parse.data.takeProfit);
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (e: any) {
    console.error("[mt5] trade failed:", e?.message ?? e);
    return NextResponse.json({ error: e?.message?.slice(0, 200) ?? "MT5 trade failed" }, { status: 400 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!isMt5Enabled()) return NextResponse.json({ positions: [], mt5Enabled: false });

  const { searchParams } = new URL(req.url);
  const mt5AccountId = searchParams.get("accountId");
  if (!mt5AccountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  const mt5 = await prisma.mt5Account.findFirst({
    where: { id: mt5AccountId, userId: session.user.id, isActive: true },
  });
  if (!mt5) return NextResponse.json({ error: "MT5 account not found" }, { status: 404 });

  const { mt5Positions } = await import("@/lib/mt5/metaapi");
  const positions = await mt5Positions(mt5.metaapiId);

  return NextResponse.json({ positions, mt5Enabled: true });
}