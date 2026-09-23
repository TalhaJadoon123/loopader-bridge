import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { generateWireInstruction } from "@/lib/payments/wire";
import { z } from "zod";

const prisma = new PrismaClient();

const wireSchema = z.object({
  amountUsd: z.number().min(100).max(1000000),
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

  const parse = wireSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { amountUsd } = parse.data;

  // Create wire instruction
  const instruction = generateWireInstruction(session.user.id, amountUsd);

  // Create Deposit record
  const deposit = await prisma.deposit.create({
    data: {
      userId: session.user.id,
      amount: amountUsd,
      method: "WIRE",
      status: "PENDING",
      reference: instruction.reference,
    },
  });

  // Create WireInstruction record
  await prisma.wireInstruction.create({
    data: {
      depositId: deposit.id,
      reference: instruction.reference,
      amountUsd,
      bankName: instruction.bankName,
      accountNumber: instruction.accountNumber,
      swift: instruction.swift,
      iban: instruction.iban,
    },
  });

  return NextResponse.json({
    depositId: deposit.id,
    reference: instruction.reference,
    amountUsd,
    bankDetails: {
      bankName: instruction.bankName,
      accountNumber: instruction.accountNumber,
      swift: instruction.swift,
      iban: instruction.iban,
      beneficiaryName: instruction.beneficiaryName,
      beneficiaryAddress: instruction.beneficiaryAddress,
    },
    instructions: `Transfer ${amountUsd} USD to the above account. Include reference: ${instruction.reference}. Wire transfers typically take 1-3 business days.`,
  });
}