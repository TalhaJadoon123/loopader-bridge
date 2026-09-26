import Groq from "groq-sdk";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

const ANALYSIS_PROMPT = `You are a world-class trading coach analyzing a completed trade. Be brutally honest but encouraging.
Give the trader a score out of 100 and specific actionable feedback in 3 bullet points max.
Structure your response EXACTLY like:
SCORE: <number>
STRENGTHS: <comma separated list>
MISTAKES: <comma separated list>
ADVICE: <one sentence>

Trade details:
- Symbol: {symbol} ({side})
- Volume: {volume} lots
- Entry: {openPrice}
- Exit: {closePrice}
- Stop Loss: {stopLoss}
- Take Profit: {takeProfit}
- P&L: {profit} USD
- Opened: {openedAt}
- Closed: {closedAt}

Analyze risk/reward, stop placement, and trade management. Max 200 words.`;

export async function analyzeTrade(tradeId: string): Promise<string | null> {
  const groq = getGroq();
  if (!groq) return null;

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return null;

  const prompt = ANALYSIS_PROMPT
    .replace("{symbol}", trade.symbol)
    .replace("{side}", trade.side)
    .replace("{volume}", Number(trade.volume).toFixed(2))
    .replace("{openPrice}", Number(trade.openPrice).toFixed(5))
    .replace("{closePrice}", trade.closePrice ? Number(trade.closePrice).toFixed(5) : "N/A")
    .replace("{stopLoss}", trade.stopLoss ? Number(trade.stopLoss).toFixed(5) : "none")
    .replace("{takeProfit}", trade.takeProfit ? Number(trade.takeProfit).toFixed(5) : "none")
    .replace("{profit}", Number(trade.profit).toFixed(2))
    .replace("{openedAt}", trade.openedAt.toISOString())
    .replace("{closedAt}", trade.closedAt?.toISOString() ?? "N/A");

  try {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 1500,
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch {
    return null;
  }
}

// ── Trading Insights: discover patterns in user behavior ──
export async function computeInsights(userId: string) {
  const trades = await prisma.trade.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 200,
  });

  if (trades.length < 5) {
    return {
      enoughData: false,
      insights: [],
    };
  }

  const insights: Array<{ type: string; text: string; emoji: string; severity: "good" | "warn" | "info" }> = [];

  // 1. Best hour analysis
  const hourStats = new Map<number, { wins: number; losses: number; pnl: number }>();
  for (const t of trades) {
    const hour = t.openedAt.getHours();
    if (!hourStats.has(hour)) hourStats.set(hour, { wins: 0, losses: 0, pnl: 0 });
    const s = hourStats.get(hour)!;
    if (Number(t.profit) > 0) s.wins++; else s.losses++;
    s.pnl += Number(t.profit);
  }
  const bestHour = Array.from(hourStats.entries()).sort((a, b) => b[1].pnl - a[1].pnl)[0];
  const worstHour = Array.from(hourStats.entries()).sort((a, b) => a[1].pnl - b[1].pnl)[0];
  if (bestHour && bestHour[1].pnl > 0) {
    insights.push({ type: "best_hour", emoji: "🕐", text: `Your peak trading hour is ${bestHour[0]}:00 (UTC) with +$${bestHour[1].pnl.toFixed(0)} total.`, severity: "good" });
  }
  if (worstHour && worstHour[1].pnl < -50) {
    insights.push({ type: "worst_hour", emoji: "⚠️", text: `${worstHour[0]}:00 (UTC) is your danger zone — ${worstHour[1].pnl.toFixed(0)}$ lost. Consider resting then.`, severity: "warn" });
  }

  // 2. Overtrading detection
  const oneDay = 24 * 60 * 60 * 1000;
  const lastDay = trades.filter(t => Date.now() - t.openedAt.getTime() < oneDay);
  if (lastDay.length > 15) {
    insights.push({ type: "overtrading", emoji: "🔥", text: `You made ${lastDay.length} trades in the last 24h. That's overtrading — quality over quantity.`, severity: "warn" });
  }

  // 3. SL/TP discipline
  const withSL = trades.filter(t => t.stopLoss).length;
  const slRatio = (withSL / trades.length) * 100;
  if (slRatio < 60) {
    insights.push({ type: "no_sl", emoji: "🛑", text: `Only ${slRatio.toFixed(0)}% of your trades had a Stop Loss. Trading without SL is gambling.`, severity: "warn" });
  } else {
    insights.push({ type: "good_sl", emoji: "✅", text: `Great discipline! ${slRatio.toFixed(0)}% of trades had a Stop Loss.`, severity: "good" });
  }

  // 4. Win rate vs losses
  const wins = trades.filter(t => Number(t.profit) > 0);
  const losses = trades.filter(t => Number(t.profit) < 0);
  const avgWin = wins.reduce((s, t) => s + Number(t.profit), 0) / (wins.length || 1);
  const avgLoss = losses.reduce((s, t) => s + Number(t.profit), 0) / (losses.length || 1);
  if (avgLoss && avgWin > 0) {
    const rr = avgWin / Math.abs(avgLoss);
    if (rr > 1.5) {
      insights.push({ type: "good_rr", emoji: "📈", text: `Your win/loss ratio is ${rr.toFixed(2)} — your winners outpace your losers. Keep it up!`, severity: "good" });
    } else if (rr < 1) {
      insights.push({ type: "poor_rr", emoji: "📉", text: `Your avg win (${avgWin.toFixed(0)}$) is smaller than avg loss (${avgLoss.toFixed(0)}$). Let winners run and cut losers fast.`, severity: "warn" });
    }
  }

  // 5. Symbol specialization
  const bySymbol = new Map<string, { count: number; pnl: number }>();
  for (const t of trades) {
    if (!bySymbol.has(t.symbol)) bySymbol.set(t.symbol, { count: 0, pnl: 0 });
    const s = bySymbol.get(t.symbol)!;
    s.count++; s.pnl += Number(t.profit);
  }
  const bestSymbol = Array.from(bySymbol.entries()).sort((a, b) => b[1].pnl - a[1].pnl)[0];
  if (bestSymbol && bestSymbol[1].pnl > 0 && bestSymbol[1].count >= 5) {
    insights.push({ type: "best_symbol", emoji: "💎", text: `${bestSymbol[0]} is your edge: ${bestSymbol[1].count} trades, +$${bestSymbol[1].pnl.toFixed(0)}.`, severity: "good" });
  }

  // 6. Revenge trading detection
  const lossesCluster = trades.filter((t, i) => {
    if (Number(t.profit) >= 0 || i === 0) return false;
    const prev = trades[i - 1];
    return prev && Number(prev.profit) < 0 && t.openedAt.getTime() - prev.openedAt.getTime() < 5 * 60 * 1000;
  });
  if (lossesCluster.length >= 3) {
    insights.push({ type: "revenge", emoji: "😤", text: `You opened ${lossesCluster.length + 1} losing trades within 5 min of each other. This is revenge trading — walk away after a loss.`, severity: "warn" });
  }

  // 7. Consistency check
  const totalPnL = trades.reduce((s, t) => s + Number(t.profit), 0);
  if (totalPnL > 0 && trades.length >= 20) {
    insights.push({ type: "consistency", emoji: "🏆", text: `You're net positive (+$${totalPnL.toFixed(0)}) across ${trades.length} trades. This is what professional traders do.`, severity: "good" });
  }

  return { enoughData: true, insights };
}

export async function getTradeScore(tradeId: string) {
  const analysis = await analyzeTrade(tradeId);
  if (!analysis) return null;

  const scoreMatch = analysis.match(/SCORE:\s*(\d+)/i);
  const strengthsMatch = analysis.match(/STRENGTHS:\s*(.+)/i);
  const mistakesMatch = analysis.match(/MISTAKES:\s*(.+)/i);
  const adviceMatch = analysis.match(/ADVICE:\s*(.+)/i);

  return {
    raw: analysis,
    score: scoreMatch ? Math.min(100, Math.max(0, parseInt(scoreMatch[1]))) : null,
    strengths: strengthsMatch ? strengthsMatch[1].split(",").map(s => s.trim()) : [],
    mistakes: mistakesMatch ? mistakesMatch[1].split(",").map(s => s.trim()) : [],
    advice: adviceMatch ? adviceMatch[1] : "",
  };
}

