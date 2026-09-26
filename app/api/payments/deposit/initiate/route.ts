import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { COMPLIANCE, isCountryProhibited } from "@/lib/compliance";
import { z } from "zod";

const prisma = new PrismaClient();

const depositSchema = z.object({
  amount: z.number().min(5),
  method: z.enum(["BINANCE_PAY", "CRYPTO", "WIRE", "CARD", "BANK"]),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = depositSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { amount, method } = parse.data;

  // ── Compliance gates (AML/KYC) ──
  const user = await prisma.user.findUnique({ where: { id: session.user.id } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.accountFrozen) return NextResponse.json({ error: "Account frozen" }, { status: 403 });
  if (isCountryProhibited(user.country)) {
    return NextResponse.json({ error: "Service is not available in your jurisdiction" }, { status: 403 });
  }

  // Lifetime deposit cap for unverified users
  const confirmedAgg = await prisma.deposit.aggregate({
    where: { userId: user.id, status: "CONFIRMED" },
    _sum: { amount: true },
  });
  const lifetimeDeposits = Number(confirmedAgg._sum.amount ?? 0);
  if (user.kycStatus !== "VERIFIED" && lifetimeDeposits + amount > COMPLIANCE.kyc.depositLimitUnverified) {
    return NextResponse.json(
      { error: `KYC required`, message: `Unverified accounts can deposit up to $${COMPLIANCE.kyc.depositLimitUnverified} lifetime. Please complete KYC to raise this limit.` },
      { status: 403 }
    );
  }

  const orderRef = `LC_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount,
      method,
      status: "PENDING",
      reference: orderRef,
    },
  });

  if (method === "BINANCE_PAY") {
    return NextResponse.json({ depositId: deposit.id, message: "Use /api/wallet/deposit/binance for Binance Pay" });
  }

  if (method === "CRYPTO") {
    return NextResponse.json({ depositId: deposit.id, message: "Use /api/wallet/deposit/crypto for crypto deposits" });
  }

  return NextResponse.json({ depositId: deposit.id, message: "Method handled by dedicated endpoint" });
}