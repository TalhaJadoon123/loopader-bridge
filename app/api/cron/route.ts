import { PrismaClient } from "@prisma/client";
import { sendEmail, createNotification } from "@/lib/notify";
import { weeklyReviewEmail, streakReminderEmail } from "@/lib/email-templates";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// ── Cron endpoint (Vercel Cron / Render worker) ──
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const type = new URL(req.url).searchParams.get("type");

  switch (type) {
    case "daily": {
      await evaluateStreaks();
      await resetDailyMissions();
      await sendStreakReminders();
      break;
    }
    case "weekly": {
      await finalizeLeaderboards();
      await sendWeeklyEmails();
      break;
    }
    case "margin": {
      // Handled in real-time by worker/stopout.ts — kept for manual trigger
      break;
    }
  }

  return new Response("OK", { status: 200 });
}

async function evaluateStreaks() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  yesterday.setHours(0, 0, 0, 0);

  const streaks = await prisma.streak.findMany({
    where: { lastActiveDate: { lt: yesterday } },
    include: { user: { select: { email: true, fullName: true } } },
  });

  for (const streak of streaks) {
    if (streak.freezes > 0) {
      await prisma.streak.update({
        where: { id: streak.id },
        data: { freezes: streak.freezes - 1, lastActiveDate: yesterday },
      });
    } else {
      await prisma.streak.update({
        where: { id: streak.id },
        data: { current: 0, lastActiveDate: yesterday },
      });
      await createNotification(streak.userId, "streak_broken", "Streak Lost!", "You missed a day. Start a new streak today!");
    }
  }
}

async function resetDailyMissions() {
  await prisma.userMission.updateMany({
    where: { mission: { expiresDaily: true }, completedAt: { not: null } },
    data: { progress: 0, completedAt: null },
  });
}

// Remind users with an active streak (3+ days) who haven't checked in today
async function sendStreakReminders() {
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  yesterday.setHours(0, 0, 0, 0);

  const atRisk = await prisma.streak.findMany({
    where: { current: { gte: 3 }, lastActiveDate: { lt: yesterday } },
    include: { user: { select: { email: true } } },
  });

  for (const streak of atRisk) {
    await createNotification(
      streak.userId,
      "streak_reminder",
      "Don't break your streak",
      `You're on a ${streak.current}-day streak. Check in today to keep it alive.`
    );
    if (streak.user?.email) {
      sendEmail(streak.user.email, "Don't break your streak", streakReminderEmail(streak.current));
    }
  }
}

// Snapshot the weekly top-20 into SecurityEvent-free storage: recompute on demand,
// but persist a frozen copy so the week's results can't be disputed.
async function finalizeLeaderboards() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const traders = await prisma.user.findMany({
    where: { role: "USER" },
    include: {
      trades: {
        where: { status: "CLOSED", openedAt: { gte: weekAgo } },
        select: { profit: true },
      },
    },
    take: 500,
  });

  const ranked = traders
    .map((u) => ({
      userId: u.id,
      name: u.fullName ?? u.email.split("@")[0],
      weeklyPnl: u.trades.reduce((sum, t) => sum + Number(t.profit), 0),
      tradeCount: u.trades.length,
    }))
    .sort((a, b) => b.weeklyPnl - a.weeklyPnl)
    .slice(0, 20);

  // Store the frozen snapshot; top 3 get notified
  const podium = [ranked[0], ranked[1], ranked[2]].filter(Boolean);
  for (let i = 0; i < podium.length; i++) {
    const winner = podium[i];
    await createNotification(
      winner.userId,
      "leaderboard",
      `Weekly leaderboard: #${i + 1}`,
      `You finished the week with $${winner.weeklyPnl.toFixed(2)} P&L. Well traded.`,
      { rank: i + 1, weeklyPnl: winner.weeklyPnl }
    );
  }

  console.log("[cron] Leaderboard finalized. Top 3:", podium.map((p) => `${p.name} $${p.weeklyPnl.toFixed(2)}`).join(", "));
}

async function sendWeeklyEmails() {
  const users = await prisma.user.findMany({
    where: { role: "USER" },
    include: {
      trades: { where: { status: "CLOSED", openedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      streak: true,
    },
  });

  for (const user of users) {
    if (!user.email) continue;
    const weeklyTrades = user.trades;
    const wins = weeklyTrades.filter(t => Number(t.profit) > 0).length;
    const winRate = weeklyTrades.length ? (wins / weeklyTrades.length) * 100 : 0;
    const totalPnL = weeklyTrades.reduce((sum, t) => sum + Number(t.profit), 0);

    const summary = [
      `Trades: ${weeklyTrades.length}`,
      `Win rate: ${winRate.toFixed(1)}%`,
      `P&L: ${totalPnL >= 0 ? "+" : ""}$${totalPnL.toFixed(2)}`,
      `Streak: ${user.streak?.current ?? 0} days`,
    ].join("\n");

    sendEmail(user.email, "Your weekly trading review", weeklyReviewEmail(user.fullName ?? "Trader", summary));
  }
}
