import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getPipValue, getContractSize, calculateMargin, calculateRiskLotSize } from "@/lib/trading/engine";
import { z } from "zod";

export const dynamic = "force-dynamic";

const calcSchema = z.object({
  type: z.enum(["pip", "margin", "position", "convert"]),
  symbol: z.string().optional(),
  volume: z.number().optional(),
  price: z.number().optional(),
  leverage: z.number().optional(),
  balance: z.number().optional(),
  riskPct: z.number().optional(),
  slPips: z.number().optional(),
  amount: z.number().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  rate: z.number().optional(),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parse = calcSchema.safeParse({
    type: searchParams.get("type"),
    symbol: searchParams.get("symbol"),
    volume: searchParams.get("volume") ? parseFloat(searchParams.get("volume")!) : undefined,
    price: searchParams.get("price") ? parseFloat(searchParams.get("price")!) : undefined,
    leverage: searchParams.get("leverage") ? parseFloat(searchParams.get("leverage")!) : undefined,
    balance: searchParams.get("balance") ? parseFloat(searchParams.get("balance")!) : undefined,
    riskPct: searchParams.get("riskPct") ? parseFloat(searchParams.get("riskPct")!) : undefined,
    slPips: searchParams.get("slPips") ? parseFloat(searchParams.get("slPips")!) : undefined,
    amount: searchParams.get("amount") ? parseFloat(searchParams.get("amount")!) : undefined,
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    rate: searchParams.get("rate") ? parseFloat(searchParams.get("rate")!) : undefined,
  });

  if (!parse.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { type, symbol, volume, price, leverage, balance, riskPct, slPips, amount, from, to, rate } = parse.data;

  if (type === "pip") {
    if (!symbol || !volume) return NextResponse.json({ error: "symbol & volume required" }, { status: 400 });
    const pipValue = getPipValue(symbol);
    const contractSize = getContractSize(symbol);
    const valuePerPip = pipValue * volume * contractSize;
    return NextResponse.json({
      pipValue,
      contractSize,
      valuePerPip: Math.round(valuePerPip * 100) / 100,
      valuePerPipUsd: Math.round(valuePerPip * 100) / 100,
    });
  }

  if (type === "margin") {
    if (!symbol || !volume || !price || !leverage) return NextResponse.json({ error: "symbol, volume, price, leverage required" }, { status: 400 });
    const margin = calculateMargin(volume, price, leverage, symbol);
    return NextResponse.json({ marginRequired: Math.round(margin * 100) / 100 });
  }

  if (type === "position") {
    if (!balance || !riskPct || !slPips) return NextResponse.json({ error: "balance, riskPct, slPips required" }, { status: 400 });
    const lotSize = calculateRiskLotSize(balance, riskPct, slPips, symbol ?? "EURUSD", leverage ?? 30);
    const riskAmount = balance * (riskPct / 100);
    return NextResponse.json({ lotSize, riskAmount: Math.round(riskAmount * 100) / 100 });
  }

  if (type === "convert") {
    if (!amount || !from || !to || !rate) return NextResponse.json({ error: "amount, from, to, rate required" }, { status: 400 });
    return NextResponse.json({ converted: Math.round(amount * rate * 100) / 100 });
  }

  return NextResponse.json({ error: "Unknown calculation" }, { status: 400 });
}