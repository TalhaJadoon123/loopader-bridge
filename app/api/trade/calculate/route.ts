import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { calculateRiskLotSize } from "@/lib/trading/engine";
import { z } from "zod";

const querySchema = z.object({
  balance: z.number().positive(),
  riskPct: z.number().min(0.1).max(10),
  slPips: z.number().positive(),
  symbol: z.string().transform((s) => s.toUpperCase()).default("EURUSD"),
  leverage: z.number().positive().default(30),
});

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const parse = querySchema.safeParse({
    balance: parseFloat(searchParams.get("balance") ?? "0"),
    riskPct: parseFloat(searchParams.get("riskPct") ?? "2"),
    slPips: parseFloat(searchParams.get("slPips") ?? "20"),
    symbol: searchParams.get("symbol"),
    leverage: parseFloat(searchParams.get("leverage") ?? "30"),
  });

  if (!parse.success) return NextResponse.json({ error: "Invalid params" }, { status: 400 });

  const { balance, riskPct, slPips, symbol, leverage } = parse.data;
  const lotSize = calculateRiskLotSize(balance, riskPct, slPips, symbol, leverage);
  const riskAmount = balance * (riskPct / 100);

  return NextResponse.json({ lotSize, riskAmount, symbol, leverage });
}