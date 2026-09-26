import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const REFERRAL_QUALIFY_USD = 50;
const REFERRAL_BONUS_USD = 10;

/**
 * Called after a deposit is CONFIRMED. Marks a PENDING referral as QUALIFIED
 * once the referee's lifetime confirmed deposits reach $50, and credits the
 * referrer $10 to their live account (idempotent — only transitions once).
 */
export async function processReferralOnDeposit(refereeId: string): Promise<void> {
  try {
    const referral = await prisma.referral.findFirst({
      where: { refereeId, status: "PENDING" },
    });
    if (!referral) return;

    const agg = await prisma.deposit.aggregate({
      where: { userId: refereeId, status: "CONFIRMED" },
      _sum: { amount: true },
    });
    const lifetime = Number(agg._sum.amount ?? 0);
    if (lifetime < REFERRAL_QUALIFY_USD) return;

    // Referee hit the threshold — qualify the referral and pay the referrer.
    await prisma.$transaction(async (tx) => {
      // Idempotency: re-check status inside the transaction.
      const current = await tx.referral.findUnique({ where: { id: referral.id } });
      if (!current || current.status !== "PENDING") return;

      await tx.referral.update({
        where: { id: referral.id },
        data: { status: "QUALIFIED" },
      });

      const referrerAccount = await tx.tradingAccount.findFirst({
        where: { userId: referral.referrerId, type: "LIVE", isActive: true },
      });

      if (referrerAccount) {
        await tx.tradingAccount.update({
          where: { id: referrerAccount.id },
          data: { balance: { increment: REFERRAL_BONUS_USD } },
        });
        await tx.referral.update({
          where: { id: referral.id },
          data: { status: "PAID", paidAt: new Date() },
        });
      }
    });

    const referrer = await prisma.user.findUnique({
      where: { id: referral.referrerId },
      select: { email: true, fullName: true },
    });
    if (referrer?.email) {
      const { sendEmail } = await import("@/lib/notify");
      const { depositConfirmedEmail } = await import("@/lib/email-templates");
      // Reuse the deposit-confirmed template wording for the bonus credit.
      sendEmail(referrer.email, "Referral bonus credited", depositConfirmedEmail(REFERRAL_BONUS_USD.toFixed(2), "referral bonus"));
    }
  } catch (e) {
    console.error("Referral processing failed:", e);
  }
}
