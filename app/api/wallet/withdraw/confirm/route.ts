import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const confirmSchema = z.object({
  token: z.string().length(64),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = confirmSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Invalid confirmation link" }, { status: 400 });

  const withdrawal = await prisma.withdrawal.findFirst({
    where: { confirmationToken: parse.data.token },
  });

  if (!withdrawal) {
    return NextResponse.json({ error: "This confirmation link is invalid or was already used." }, { status: 404 });
  }

  if (withdrawal.status !== "PENDING") {
    return NextResponse.json({ error: `This withdrawal is no longer pending (status: ${withdrawal.status}).` }, { status: 400 });
  }

  if (withdrawal.confirmationExpires && new Date() > withdrawal.confirmationExpires) {
    return NextResponse.json({ error: "This confirmation link has expired. Please request the withdrawal again — the reserved amount will be returned if it is rejected." }, { status: 400 });
  }

  await prisma.withdrawal.update({
    where: { id: withdrawal.id },
    data: { confirmedAt: new Date(), confirmationToken: null },
  });

  await prisma.securityEvent.create({
    data: {
      userId: withdrawal.userId,
      event: "WITHDRAWAL_EMAIL_CONFIRMED",
      riskScore: 0,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    amount: Number(withdrawal.amount),
    method: withdrawal.method,
    message: "Withdrawal confirmed. Our team will process the payout shortly.",
  });
}
