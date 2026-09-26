import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const accountId = searchParams.get("accountId");
  const symbol = searchParams.get("symbol");
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const limit = parseInt(searchParams.get("limit") ?? "100");
  const format = searchParams.get("format");

  const where: any = { userId: session.user.id };
  if (accountId) where.accountId = accountId;
  if (symbol) where.symbol = symbol.toUpperCase();
  if (status) where.status = status;
  if (from || to) {
    where.openedAt = {};
    if (from) where.openedAt.gte = new Date(from);
    if (to) where.openedAt.lte = new Date(to);
  }

  const trades = await prisma.trade.findMany({
    where,
    include: { account: true },
    orderBy: { openedAt: "desc" },
    take: limit,
  });

  if (format === "csv") {
    const headers = ["ID", "Symbol", "Side", "Volume", "Open Price", "Close Price", "Stop Loss", "Take Profit", "Profit", "Status", "Opened At", "Closed At", "Account"];
    const rows = trades.map((t) => [
      t.id,
      t.symbol,
      t.side,
      Number(t.volume).toFixed(2),
      Number(t.openPrice).toFixed(5),
      t.closePrice ? Number(t.closePrice).toFixed(5) : "",
      t.stopLoss ? Number(t.stopLoss).toFixed(5) : "",
      t.takeProfit ? Number(t.takeProfit).toFixed(5) : "",
      Number(t.profit).toFixed(2),
      t.status,
      t.openedAt.toISOString(),
      t.closedAt?.toISOString() ?? "",
      t.account.type,
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": "attachment; filename=trade-history.csv" },
    });
  }

  return NextResponse.json({
    trades: trades.map((t) => ({
      ...t,
      volume: Number(t.volume),
      openPrice: Number(t.openPrice),
      closePrice: t.closePrice ? Number(t.closePrice) : null,
      profit: Number(t.profit),
    })),
  });
}