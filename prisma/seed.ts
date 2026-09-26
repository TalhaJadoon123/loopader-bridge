import { PrismaClient, Role, AccountType, Tier, TradeSide, TradeStatus, KycStatus, DepositMethod, DepositStatus, WithdrawalMethod, WithdrawalStatus, SubscriptionPlan, SubscriptionStatus, RiskLevel, AlertCondition, JournalMood, ReferralStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean slate (optional - comment out if you want to keep existing data)
  await prisma.presenceSession.deleteMany();
  await prisma.aiChat.deleteMany();
  await prisma.referral.deleteMany();
  await prisma.securityEvent.deleteMany();
  await prisma.sentimentCache.deleteMany();
  await prisma.journalEntry.deleteMany();
  await prisma.xpLog.deleteMany();
  await prisma.userBadge.deleteMany();
  await prisma.badge.deleteMany();
  await prisma.userMission.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.streak.deleteMany();
  await prisma.alert.deleteMany();
  await prisma.copyRelationship.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.withdrawalAddress.deleteMany();
  await prisma.withdrawal.deleteMany();
  await prisma.deposit.deleteMany();
  await prisma.challengeParticipant.deleteMany();
  await prisma.challenge.deleteMany();
  await prisma.trade.deleteMany();
  await prisma.educationProgress.deleteMany();
  await prisma.educationCourse.deleteMany();
  await prisma.watchlist.deleteMany();
  await prisma.signal.deleteMany();
  await prisma.tradingAccount.deleteMany();
  await prisma.user.deleteMany();

  // ---- USERS ----
  const passwordHash = await bcrypt.hash("Password123!", 12); // demo users only

  // Admin password: sourced from env (bcrypt hash) — never hardcoded in the repo.
  // Generate one with: node -e "require('bcryptjs').hash(process.argv[1],12).then(h=>console.log(h))" '<password>'
  // If unset, a random password is generated (unrecoverable — set the env var in production).
  const adminPasswordHash = process.env.ADMIN_PASSWORD_HASH
    ?? (await bcrypt.hash(require("crypto").randomBytes(18).toString("base64url"), 12));
  if (!process.env.ADMIN_PASSWORD_HASH) {
    console.log("⚠️  ADMIN_PASSWORD_HASH not set — admin account gets a random password.");
  }

  const admin = await prisma.user.create({
    data: {
      email: "admin@loopader.com",
      fullName: "Admin User",
      country: "PK",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      kycStatus: KycStatus.VERIFIED,
    }
  });
  console.log("✅ Admin created:", admin.email);

  const demoUsers = await Promise.all([
    prisma.user.create({
      data: {
        email: "user1@loopader.com",
        fullName: "Ahmed Khan",
        country: "PK",
        phone: "+923001234567",
        passwordHash,
        kycStatus: KycStatus.VERIFIED,
      }
    }),
    prisma.user.create({
      data: {
        email: "user2@loopader.com",
        fullName: "Fatima Ali",
        country: "PK",
        phone: "+923001234568",
        passwordHash,
        kycStatus: KycStatus.VERIFIED,
      }
    }),
    prisma.user.create({
      data: {
        email: "user3@loopader.com",
        fullName: "John Smith",
        country: "US",
        phone: "+15551234567",
        passwordHash,
        kycStatus: KycStatus.VERIFIED,
      }
    }),
    prisma.user.create({
      data: {
        email: "user4@loopader.com",
        fullName: "Maria Garcia",
        country: "ES",
        phone: "+34600123456",
        passwordHash,
        kycStatus: KycStatus.VERIFIED,
      }
    }),
    prisma.user.create({
      data: {
        email: "user5@loopader.com",
        fullName: "Chen Wei",
        country: "CN",
        phone: "+8613812345678",
        passwordHash,
        kycStatus: KycStatus.VERIFIED,
      }
    }),
  ]);
  console.log("✅ 5 demo users created");

  // ---- TRADING ACCOUNTS ----
  for (const user of demoUsers) {
    await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        type: AccountType.DEMO,
        tier: Tier.STANDARD,
        balance: 10000,
        currency: "USD",
        leverage: 30,
        isActive: true,
      }
    });
    await prisma.tradingAccount.create({
      data: {
        userId: user.id,
        type: AccountType.LIVE,
        tier: Tier.STANDARD,
        balance: 0,
        currency: "USD",
        leverage: 30,
        isActive: false,
      }
    });
  }
  console.log("✅ Demo + Live trading accounts created for each user");

  // ---- SUBSCRIPTIONS ----
  for (const user of demoUsers) {
    await prisma.subscription.create({
      data: {
        userId: user.id,
        plan: SubscriptionPlan.FREE,
        status: SubscriptionStatus.ACTIVE,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      }
    });
  }

  // ---- STREAKS ----
  for (const user of demoUsers) {
    await prisma.streak.create({
      data: {
        userId: user.id,
        current: Math.floor(Math.random() * 10),
        longest: Math.floor(Math.random() * 30) + 10,
        lastActiveDate: new Date(),
        freezes: 2,
      }
    });
  }

  // ---- BADGES ----
  const badges = await Promise.all([
    prisma.badge.create({ data: { code: "FIRST_TRADE", name: "First Trade", icon: "🎉", criteria: "Open your first trade" } }),
    prisma.badge.create({ data: { code: "FIRST_PROFIT", name: "First Profit", icon: "💰", criteria: "Close your first profitable trade" } }),
    prisma.badge.create({ data: { code: "STREAK_7", name: "7-Day Streak", icon: "🔥", criteria: "Trade 7 days in a row" } }),
    prisma.badge.create({ data: { code: "STREAK_30", name: "30-Day Streak", icon: "🏆", criteria: "Trade 30 days in a row" } }),
    prisma.badge.create({ data: { code: "TRADES_100", name: "Century Trader", icon: "💯", criteria: "Complete 100 trades" } }),
    prisma.badge.create({ data: { code: "COPY_MASTER", name: "Copy Master", icon: "👥", criteria: "Have 10+ followers" } }),
    prisma.badge.create({ data: { code: "JOURNAL_KEEPER", name: "Journal Keeper", icon: "📔", criteria: "Write 50 journal entries" } }),
  ]);
  console.log("✅ Badges created");

  // Award FIRST_TRADE to user1
  await prisma.userBadge.create({
    data: { userId: demoUsers[0].id, badgeId: badges[0].id }
  });

  // ---- MISSIONS ----
  const missions = await Promise.all([
    prisma.mission.create({ data: { title: "Open 1 Trade", description: "Open any trade today", xpReward: 10, expiresDaily: true } }),
    prisma.mission.create({ data: { title: "Set 1 Price Alert", description: "Create a price alert for any symbol", xpReward: 10, expiresDaily: true } }),
    prisma.mission.create({ data: { title: "Write Journal Note", description: "Add a note to your trading journal", xpReward: 10, expiresDaily: true } }),
    prisma.mission.create({ data: { title: "Check Market Mood", description: "View the Market Mood gauge before trading", xpReward: 10, expiresDaily: true } }),
    prisma.mission.create({ data: { title: "Weekly Warrior", description: "Complete 5 daily missions this week", xpReward: 50, expiresDaily: false } }),
  ]);
  console.log("✅ Missions created");

  for (const user of demoUsers) {
    for (const mission of missions) {
      await prisma.userMission.create({
        data: { userId: user.id, missionId: mission.id, progress: 0 }
      });
    }
  }

  // ---- CHALLENGES ----
  const now = new Date();
  const challenges = await Promise.all([
    prisma.challenge.create({
      data: { title: "Top Trader Week", description: "Highest % profit in 7 days wins $50 credit", type: "PROFIT", prize: "$50", startsAt: now, endsAt: new Date(now.getTime() + 7 * 86400000), status: "ACTIVE", isActive: true },
    }),
    prisma.challenge.create({
      data: { title: "Consistency King", description: "Most consistent daily P&L (lowest std dev) wins $25", type: "CONSISTENCY", prize: "$25", startsAt: now, endsAt: new Date(now.getTime() + 14 * 86400000), status: "ACTIVE", isActive: true },
    }),
    prisma.challenge.create({
      data: { title: "Demo Masters", description: "Best demo account performance — $100 prize", type: "PROFIT", prize: "$100", startsAt: new Date(now.getTime() + 30 * 86400000), endsAt: new Date(now.getTime() + 60 * 86400000), status: "UPCOMING", isActive: true },
    }),
  ]);
  // Add user1 to challenges
  for (const c of challenges) {
    await prisma.challengeParticipant.create({ data: { userId: demoUsers[0].id, challengeId: c.id, score: Math.random() * 100 } });
  }
  console.log("✅ Challenges created");

  // ---- EDUCATION COURSES ----
  const courses = await Promise.all([
    prisma.educationCourse.create({
      data: {
        title: "Forex Basics", description: "What is forex, how pairs work, pips & lots", category: "Forex", difficulty: "Beginner", duration: "15 min", order: 1, content: "Learn the fundamentals of currency trading...", quizJson: { questions: [{ q: "What is a pip?", options: ["0.0001", "0.01", "1%"], answer: 0 }] },
      },
    }),
    prisma.educationCourse.create({
      data: {
        title: "Risk Management", description: "Position sizing, stop losses, and protecting capital", category: "Risk", difficulty: "Beginner", duration: "20 min", order: 2, content: "The golden rules of risk...", quizJson: { questions: [{ q: "What's the recommended max risk per trade?", options: ["10%", "1-2%", "50%"], answer: 1 }] },
      },
    }),
    prisma.educationCourse.create({
      data: {
        title: "Technical Analysis", description: "Charts, trends, support & resistance", category: "Analysis", difficulty: "Intermediate", duration: "30 min", order: 3, content: "Reading price action...", quizJson: { questions: [{ q: "RSI above 70 suggests?", options: ["Oversold", "Overbought", "Nothing"], answer: 1 }] },
      },
    }),
    prisma.educationCourse.create({
      data: {
        title: "Trading Psychology", description: "Discipline, emotions, and building routines", category: "Psychology", difficulty: "Intermediate", duration: "15 min", order: 4, content: "Mastering your mindset...", quizJson: { questions: [{ q: "Revenge trading means?", options: ["Trading after a loss out of anger", "Copying others", "Scalping"], answer: 0 }] },
      },
    }),
  ]);
  console.log("✅ Education courses created");

  // ---- SAMPLE TRADES ----
  const symbols = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "USDJPY"];
  const sides: TradeSide[] = [TradeSide.BUY, TradeSide.SELL];

  for (const user of demoUsers) {
    const demoAcc = await prisma.tradingAccount.findFirst({ where: { userId: user.id, type: AccountType.DEMO } });
    if (!demoAcc) continue;

    for (let i = 0; i < 10; i++) {
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      const side = sides[Math.floor(Math.random() * sides.length)];
      const volume = (Math.random() * 0.5 + 0.01).toFixed(2);
      const openPrice = (Math.random() * 100 + 1).toFixed(5);
      const closePrice = (parseFloat(openPrice) + (Math.random() - 0.5) * 0.01).toFixed(5);
      const profit = (parseFloat(closePrice) - parseFloat(openPrice)) * parseFloat(volume) * (side === TradeSide.BUY ? 1 : -1) * 100000;

      await prisma.trade.create({
        data: {
          accountId: demoAcc.id,
          userId: user.id,
          symbol,
          side,
          volume: parseFloat(volume),
          openPrice: parseFloat(openPrice),
          closePrice: parseFloat(closePrice),
          stopLoss: parseFloat((parseFloat(openPrice) - 0.0050 * (side === TradeSide.BUY ? 1 : -1)).toFixed(5)),
          takeProfit: parseFloat((parseFloat(openPrice) + 0.0100 * (side === TradeSide.BUY ? 1 : -1)).toFixed(5)),
          profit: profit,
          status: TradeStatus.CLOSED,
          openedAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
          closedAt: new Date(),
        }
      });
    }
  }
  console.log("✅ Sample trades created");

  // ---- XP LOGS ----
  for (const user of demoUsers) {
    for (let i = 0; i < 20; i++) {
      await prisma.xpLog.create({
        data: {
          userId: user.id,
          points: [10, 25, 50][Math.floor(Math.random() * 3)],
          source: ["trade", "profitable_trade", "mission"][Math.floor(Math.random() * 3)],
          createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
        }
      });
    }
  }
  console.log("✅ XP logs created");

  // ---- JOURNAL ENTRIES ----
  for (const user of demoUsers.slice(0, 2)) {
    const trades = await prisma.trade.findMany({ where: { account: { userId: user.id } }, take: 3 });
    for (const trade of trades) {
      await prisma.journalEntry.create({
        data: {
          userId: user.id,
          tradeId: trade.id,
          mood: [JournalMood.CALM, JournalMood.CONFIDENT, JournalMood.ANXIOUS][Math.floor(Math.random() * 3)],
          note: "Entry note: followed plan, managed risk well.",
          aiInsight: "Good risk management. Consider tightening stop loss on volatile pairs.",
        }
      });
    }
  }
  console.log("✅ Journal entries created");

  // ---- REFERRALS ----
  await prisma.referral.create({
    data: {
      referrerId: demoUsers[0].id,
      refereeId: demoUsers[1].id,
      bonusUsd: 10,
      status: ReferralStatus.PAID,
      paidAt: new Date(),
    }
  });

  // ---- SENTIMENT CACHE ----
  for (const symbol of symbols) {
    await prisma.sentimentCache.create({
      data: {
        symbol,
        score: Math.floor(Math.random() * 200) - 100,
        sourceCount: Math.floor(Math.random() * 50) + 10,
      }
    });
  }
  console.log("✅ Sentiment cache populated");

  // ---- SECURITY EVENTS ----
  await prisma.securityEvent.create({
    data: {
      userId: demoUsers[0].id,
      event: "LOGIN_SUCCESS",
      ip: "203.0.113.1",
      deviceFingerprint: "fp_demo_1",
      country: "PK",
      riskScore: 0,
    }
  });

  console.log("🎉 Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });