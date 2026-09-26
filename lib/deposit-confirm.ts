import { createNotification } from "@/lib/notify";
import { depositConfirmedEmail } from "@/lib/email-templates";
import { sendEmail } from "@/lib/notify";
import { processReferralOnDeposit } from "@/lib/referral";

const METHOD_LABELS: Record<string, string> = {
  JAZZCASH: "JazzCash",
  EASYPAISA: "EasyPaisa",
  BANK: "bank transfer",
  CARD: "card",
  CRYPTO: "cryptocurrency",
};

/**
 * Side effects after a deposit transitions to CONFIRMED:
 * in-app notification, confirmation email, referral qualification.
 * Fire-and-forget style — never blocks or breaks the confirm flow.
 */
export async function postDepositConfirm(
  depositId: string,
  userId: string,
  amount: number,
  method: string
): Promise<void> {
  try {
    const label = METHOD_LABELS[method] ?? method.toLowerCase();
    await createNotification(
      userId,
      "deposit",
      "Deposit confirmed",
      `Your deposit of $${amount.toFixed(2)} via ${label} has been credited to your live account.`
    );

    const { PrismaClient } = await import("@prisma/client");
    const prisma = new PrismaClient();
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true },
      });
      if (user?.email) {
        sendEmail(user.email, "Deposit confirmed", depositConfirmedEmail(amount.toFixed(2), label));
      }
    } finally {
      await prisma.$disconnect();
    }

    await processReferralOnDeposit(userId);
  } catch (e) {
    console.error("postDepositConfirm failed:", e);
  }
}

/** Look up a deposit id's owner + amount (for callers that only have the id). */
export async function getDepositInfo(depositId: string): Promise<{ userId: string; amount: number; method: string } | null> {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  try {
    const d = await prisma.deposit.findUnique({ where: { id: depositId } });
    if (!d) return null;
    return { userId: d.userId, amount: Number(d.amount), method: d.method };
  } finally {
    await prisma.$disconnect();
  }
}
