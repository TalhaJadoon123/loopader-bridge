import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { checkUnverifiedDepositLimit } from "@/lib/kyc";
import { z } from "zod";

const prisma = new PrismaClient();

const bankDepositSchema = z.object({
  amount: z.number().min(5),
  reference: z.string().min(5),
  proofUrl: z.string().url().optional(),
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

  const parse = bankDepositSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { amount, reference, proofUrl } = parse.data;

  const kycError = await checkUnverifiedDepositLimit(session.user.id, amount);
  if (kycError) return NextResponse.json({ error: kycError }, { status: 403 });

  const orderRef = `BANK_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount,
      method: "BANK",
      status: "PENDING",
      reference: orderRef,
      proofUrl: proofUrl ?? null,
    },
  });

  return NextResponse.json({
    depositId: deposit.id,
    reference: orderRef,
    message: "Bank deposit submitted for admin review. Please allow 24-48 hours for confirmation.",
  });
}