import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const confirmSchema = z.object({
  depositId: z.string(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check admin role
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = confirmSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { depositId } = parse.data;

  const deposit = await prisma.deposit.findUnique({
    where: { id: depositId },
    include: { user: true },
  });
  if (!deposit) {
    return NextResponse.json({ error: "Deposit not found" }, { status: 404 });
  }

  if (deposit.method !== "WIRE") {
    return NextResponse.json({ error: "Not a wire deposit" }, { status: 400 });
  }

  if (deposit.status === "CONFIRMED") {
    return NextResponse.json({ error: "Deposit already confirmed" }, { status: 400 });
  }

  // Confirm wire deposit
  await prisma.$transaction(async (tx) => {
    await tx.deposit.update({
      where: { id: depositId },
      data: { status: "CONFIRMED", confirmedAt: new Date(), confirmedBy: session.user.id },
    });

    // Increment LIVE account balance
    const liveAccount = await tx.tradingAccount.findFirst({
      where: { userId: deposit.userId, type: "LIVE", isActive: true },
    });
    if (!liveAccount) throw new Error("No active LIVE account");

    await tx.tradingAccount.update({
      where: { id: liveAccount.id },
      data: { balance: { increment: deposit.amount } },
    });

    await tx.auditLog.create({
      data: {
        action: "DEPOSIT_CONFIRMED",
        userId: deposit.userId,
        payload: {
          depositId: deposit.id,
          amount: Number(deposit.amount),
          method: "WIRE",
          confirmedBy: session.user.id,
        },
      },
    });
  });

  return NextResponse.json({ success: true, message: "Wire deposit confirmed" });
}