import Groq from "groq-sdk";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat/completions";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const SYSTEM_PROMPT = `You are an expert trading coach for Loopader. 
- Explain concepts in plain English, never use unexplained jargon.
- NEVER give financial advice or guarantees. Always mention risk.
- Be encouraging but honest about risks.
- When analyzing user's trades, be specific and constructive.
- If asked about specific trades, reference them by symbol and time.
- Max response length: 300 words unless user asks for more.
- If you don't know, say so. Never hallucinate.`;

const QUICK_PROMPTS = [
  "Why did gold spike today?",
  "Review my last trade",
  "What does RSI mean?",
  "Am I overtrading?",
  "Explain this chart pattern",
  "How do I set a proper stop loss?",
  "What's the Market Mood telling us?",
];

export async function getUserContext(userId: string) {
  const [openTrades, recentTrades, streak, marketMood] = await Promise.all([
    prisma.trade.findMany({
      where: { userId, status: "OPEN" },
      include: { account: true },
      take: 10,
    }),
    prisma.trade.findMany({
      where: { userId, status: "CLOSED" },
      orderBy: { closedAt: "desc" },
      take: 10,
    }),
    prisma.streak.findUnique({ where: { userId } }),
    prisma.sentimentCache.findMany({
      where: { symbol: { in: ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD"] } },
    }),
  ]);

  return { openTrades, recentTrades, streak, marketMood };
}

export async function checkRateLimit(userId: string): Promise<{ allowed: boolean; remaining: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const usage = await prisma.aiUsage.upsert({
    where: { userId_date: { userId, date: today } },
    create: { userId, date: today, count: 1 },
    update: { count: { increment: 1 } },
  });

  const count = usage.count;
  if (count >= 20) {
    return { allowed: false, remaining: 0 };
  }
  return { allowed: true, remaining: 20 - count };
}

async function queryGroq(messages: { role: "user" | "assistant" | "system" | string; content: string }[]): Promise<string> {
  try {
    const groq = getGroq();
    if (!groq) throw new Error("GROQ_API_KEY not configured");
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: messages as ChatCompletionMessageParam[],
      temperature: 0.7,
      max_tokens: 2000,
    });
    return completion.choices[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
  } catch (e) {
    console.warn("Groq error:", e);
    throw e;
  }
}

async function queryGemini(messages: { role: string; content: string }[]): Promise<string> {
  if (!genAI) throw new Error("GEMINI_API_KEY not configured");
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const chat = model.startChat({
    history: messages.slice(0, -1).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
  });
  const result = await chat.sendMessage(messages[messages.length - 1].content);
  return result.response.text();
}

export async function coachChat(userId: string, userMessage: string, conversationHistory: { role: string; content: string }[] = []) {
  const rateLimit = await checkRateLimit(userId);
  if (!rateLimit.allowed) {
    return { response: "Coach is resting. Daily limit reached. Try again tomorrow!", remaining: 0 };
  }

  const context = await getUserContext(userId);
  const contextSummary = `
User context:
- Open trades: ${context.openTrades.length}
- Recent trades (last 10): ${context.recentTrades.length} (wins: ${context.recentTrades.filter(t => Number(t.profit) > 0).length})
- Current streak: ${context.streak?.current ?? 0} days
- Market mood: ${context.marketMood.map(m => `${m.symbol}: ${m.score}`).join(", ")}
`;

  const messages = [
    { role: "system", content: SYSTEM_PROMPT + "\n\n" + contextSummary },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  let response: string;
  try {
    response = await queryGroq(messages);
  } catch (e) {
    console.warn("Groq failed, trying Gemini:", e);
    try {
      response = await queryGemini(messages);
    } catch (e2) {
      console.error("Both AI providers failed:", e2);
      response = "I'm having technical difficulties. Please try again in a moment.";
    }
  }

  return { response, remaining: rateLimit.remaining };
}

export async function journalInsight(userId: string, tradeId: string, note: string) {
  if (note.length < 20) return null;

  const trade = await prisma.trade.findUnique({ where: { id: tradeId } });
  if (!trade) return null;

  const recentTrades = await prisma.trade.findMany({
    where: { userId, status: "CLOSED", openedAt: { lt: trade.openedAt } },
    orderBy: { openedAt: "desc" },
    take: 20,
  });

  const prompt = `
User wrote a journal note for trade ${trade.symbol} ${trade.side} @ ${trade.openPrice}:
"${note}"

Recent 20 trades summary:
${recentTrades.map(t => `${t.symbol} ${t.side} ${Number(t.volume)} lots @ ${t.openPrice} → ${t.closePrice} P&L: ${Number(t.profit).toFixed(2)}`).join("\n")}

Analyze this note in context of their recent trading. Spot behavioral patterns (revenge trading, overconfidence, good discipline, etc.). Be specific, constructive, and encouraging. Max 200 words.`;

  try {
    const insight = await queryGroq([
      { role: "system", content: "You are a trading psychologist. Analyze journal notes for behavioral patterns." },
      { role: "user", content: prompt },
    ]);
    return insight;
  } catch (e) {
    console.error("Journal insight failed:", e);
    return null;
  }
}

export function getQuickPrompts() {
  return QUICK_PROMPTS;
}

