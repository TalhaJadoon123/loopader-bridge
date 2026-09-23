import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") ?? "json";
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const where: any = { userId: session.user.id };
  if (from || to) {
    where.createdAt = {};
    if (from) where.createdAt.gte = new Date(from);
    if (to) where.createdAt.lte = new Date(to);
  }

  const [trades, deposits, withdrawals] = await Promise.all([
    prisma.trade.findMany({ where: { userId: session.user.id, ...(from || to ? { closedAt: where.createdAt } : {}) }, orderBy: { openedAt: "asc" } }),
    prisma.deposit.findMany({ where, orderBy: { createdAt: "asc" } }),
    prisma.withdrawal.findMany({ where, orderBy: { createdAt: "asc" } }),
  ]);

  const rows: any[] = [];

  for (const t of trades) {
    rows.push({
      date: (t.closedAt ?? t.openedAt).toISOString(),
      type: "TRADE",
      symbol: t.symbol,
      side: t.side,
      volume: Number(t.volume),
      open: Number(t.openPrice),
      close: t.closePrice ? Number(t.closePrice) : "",
      profit: Number(t.profit).toFixed(2),
      status: t.status,
      orderType: t.orderType,
    });
  }
  for (const d of deposits) {
    rows.push({ date: d.createdAt.toISOString(), type: "DEPOSIT", method: d.method, amount: Number(d.amount).toFixed(2), status: d.status });
  }
  for (const w of withdrawals) {
    rows.push({ date: w.createdAt.toISOString(), type: "WITHDRAWAL", method: w.method, amount: Number(w.amount).toFixed(2), status: w.status });
  }

  rows.sort((a, b) => a.date.localeCompare(b.date));

  if (format === "csv") {
    const headers = ["date", "type", "symbol", "side", "volume", "open", "close", "amount", "profit", "status", "orderType", "method"];
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => r[h] ?? "").join(","))].join("\n");
    return new NextResponse(csv, {
      headers: { "Content-Type": "text/csv", "Content-Disposition": `attachment; filename=loopader-statement-${new Date().toISOString().slice(0, 10)}.csv` },
    });
  }

  const totalDeposits = deposits.reduce((s, d) => s + (d.status === "CONFIRMED" ? Number(d.amount) : 0), 0);
  const totalWithdrawals = withdrawals.reduce((s, w) => s + (w.status === "PAID" ? Number(w.amount) : 0), 0);
  const realizedPnL = trades.filter(t => t.status === "CLOSED").reduce((s, t) => s + Number(t.profit), 0);

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    summary: { totalDeposits, totalWithdrawals, realizedPnL, net: totalDeposits - totalWithdrawals + realizedPnL, tradeCount: trades.length },
    rows,
  });
}