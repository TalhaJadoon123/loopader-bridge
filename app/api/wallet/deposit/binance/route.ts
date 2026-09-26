import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";
import { createOrder } from "@/lib/payments/binancepay";
import { z } from "zod";

const prisma = new PrismaClient();

const depositSchema = z.object({
  amountUsd: z.number().min(10).max(100000),
  currency: z.enum(["USDT", "USDC", "BTC", "ETH", "BNB", "BUSD"]).default("USDT"),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check KYC status
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true },
  });
  if (!user || user.kycStatus !== "VERIFIED") {
    return NextResponse.json({ error: "KYC verification required" }, { status: 403 });
  }

  // Check LIVE account exists
  const liveAccount = await prisma.tradingAccount.findFirst({
    where: { userId: session.user.id, type: "LIVE", isActive: true },
  });
  if (!liveAccount) {
    return NextResponse.json({ error: "No active LIVE account" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = depositSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { amountUsd, currency } = parse.data;

  // Get active account from cookie (or use LIVE account)
  const cookieStore = await cookies();
  const activeAccountId = cookieStore.get("active_account_id")?.value;
  const accountId = activeAccountId ?? liveAccount.id;

  // Create order reference
  const merchantTradeNo = `BIN_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // Create Deposit record
  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount: amountUsd,
      method: "BINANCE_PAY",
      status: "PENDING",
      reference: merchantTradeNo,
      cryptoCurrency: currency,
    },
  });

  try {
    // Create Binance Pay order
    const result = await createOrder({
      merchantTradeNo,
      orderAmount: amountUsd,
      currency: "USDT", // Binance Pay uses USDT for amounts
      goods: [
        {
          goodsType: "02",
          goodsCategory: "Z999",
          goodsName: "Loopader Wallet Deposit",
          goodsDetail: `Deposit ${currency} to LIVE account`,
        },
      ],
      buyer: {
        buyerId: session.user.id,
        buyerEmail: session.user.email ?? undefined,
      },
      notifyUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/payments/binance/callback`,
      returnUrl: `${process.env.NEXT_PUBLIC_APP_URL}/wallet?deposit=success`,
    });

    if (result.code !== "000000" || result.status !== "SUCCESS") {
      // Update deposit as failed
      await prisma.deposit.update({
        where: { id: deposit.id },
        data: { status: "FAILED" },
      });
      return NextResponse.json(
        { error: result.errorMessage ?? "Binance Pay order creation failed" },
        { status: 500 }
      );
    }

    // Store prepayId on deposit
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: {
        binancePrepayId: result.data.prepayId,
        binanceOrderId: merchantTradeNo,
      },
    });

    return NextResponse.json({
      qrCodeLink: result.data.qrCodeLink,
      checkoutUrl: result.data.checkoutUrl,
      prepayId: result.data.prepayId,
      expireTime: result.data.expireTime,
      depositId: deposit.id,
    });
  } catch (e: any) {
    console.error("Binance Pay deposit failed:", e);
    await prisma.deposit.update({
      where: { id: deposit.id },
      data: { status: "FAILED" },
    });
    return NextResponse.json(
      { error: e.message ?? "Binance Pay deposit failed" },
      { status: 500 }
    );
  }
}