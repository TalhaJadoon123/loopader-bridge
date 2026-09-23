import { PrismaClient } from "@prisma/client";
import { COMPLIANCE } from "@/lib/compliance";

const prisma = new PrismaClient();

/**
 * Enforce the lifetime deposit limit for unverified (non-KYC) users.
 * Returns an error message string if the deposit would breach the limit, else null.
 */
export async function checkUnverifiedDepositLimit(
  userId: string,
  amount: number
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { kycStatus: true },
  });
  if (!user) return "User not found";
  if (user.kycStatus === "VERIFIED") return null;

  const agg = await prisma.deposit.aggregate({
    where: { userId, status: "CONFIRMED" },
    _sum: { amount: true },
  });
  const lifetime = Number(agg._sum.amount ?? 0);
  const limit = COMPLIANCE.kyc.depositLimitUnverified;

  if (lifetime + amount > limit) {
    return `Unverified accounts are limited to $${limit} in lifetime deposits. Complete identity verification (KYC) to remove this limit.`;
  }
  return null;
}
