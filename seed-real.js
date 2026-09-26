const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();

async function main() {
  // 1. Activate all LIVE accounts (they were created inactive)
  const activated = await p.account.updateMany({
    where: { type: "LIVE", isActive: false },
    data: { isActive: true },
  });
  console.log("Activated LIVE accounts:", activated.count);

  // 2. Generate trading signals (populates the signals page)
  const analyst = await p.user.findFirst({ where: { role: "ADMIN" } });
  if (!analyst) { console.log("No admin found"); return; }

  const signalCount = await p.signal.count();
  if (signalCount === 0) {
    const signals = [
      { symbol: "XAUUSD", direction: "BUY", entryPrice: 4430, stopLoss: 4380, takeProfit: 4520, confidence: 72, analysis: "Gold holding above $4,400 support. Central bank buying + geopolitical risk drive safe-haven demand. Target $4,520." },
      { symbol: "BTCUSD", direction: "BUY", entryPrice: 79000, stopLoss: 75000, takeProfit: 88000, confidence: 68, analysis: "BTC consolidating above $78K after correction. ETF inflows resumed. Key resistance at $85K." },
      { symbol: "EURUSD", direction: "SELL", entryPrice: 1.1620, stopLoss: 1.1680, takeProfit: 1.1480, confidence: 55, analysis: "EURUSD approaching resistance at 1.1650. ECB dovish vs Fed hawkish divergence. RSI overbought." },
      { symbol: "USOIL", direction: "BUY", entryPrice: 78.50, stopLoss: 75.50, takeProfit: 83.00, confidence: 70, analysis: "Crude supported by OPEC+ production cuts and declining US inventories. Bullish structure above $77." },
      { symbol: "NVDA", direction: "BUY", entryPrice: 228, stopLoss: 210, takeProfit: 260, confidence: 75, analysis: "NVDA momentum strong on AI datacenter demand. Next earnings catalyst. Breakout above $230 targets $260." },
      { symbol: "SPX500", direction: "SELL", entryPrice: 5430, stopLoss: 5480, takeProfit: 5350, confidence: 50, analysis: "S&P 500 at resistance. Mixed signals ahead of CPI. Short bias below 5,430 — cover at 5,350." },
    ];
    for (const s of signals) {
      await p.signal.create({ data: { ...s, analystId: analyst.id, status: "active" } });
    }
    console.log("Created", signals.length, "signals");
  } else {
    console.log("Signals already exist:", signalCount);
  }

  // 3. Create a trade idea so social feed isn't empty
  const ideaCount = await p.tradeIdea.count();
  if (ideaCount === 0) {
    const user1 = await p.user.findFirst({ where: { email: "user1@loopader.com" } });
    if (user1) {
      await p.tradeIdea.create({
        data: {
          authorId: user1.id,
          symbol: "XAUUSD",
          direction: "BUY",
          note: "Gold breaking out of consolidation. Central bank demand at record levels. Looking for entry above $4,420 with SL at $4,380. Target $4,520+. Risk/reward 2:1.",
        },
      });
      console.log("Created 1 trade idea");
    }
  }

  await p.$disconnect();
}

main().catch(e => { console.error(e.message); process.exit(1); });