import Groq from "groq-sdk";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function getGroq() {
  if (!process.env.GROQ_API_KEY) return null;
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}
const genAI = process.env.GEMINI_API_KEY ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY) : null;

const RISK_ANALYSIS_PROMPT = `You are a risk analyst for a forex broker. Analyze the user's trading history and output a JSON object with these fields:
{
  "profitability_score": 0-100,
  "revenge_trading_flag": boolean,
  "anomaly_flag": boolean,
  "recommended_route": "A_BOOK" | "B_BOOK" | "C_BOOK",
  "reason": "brief explanation"
}

Guidelines:
- profitability_score: 100 = consistently profitable, 0 = consistently losing
- revenge_trading_flag: true if multiple losses followed by quick re-entry with increased size
- anomaly_flag: true if bot-like patterns (fixed intervals, identical sizes, perfect timing)
- recommended_route: A_BOOK = hedge externally (skilled/large), B_BOOK = internalize (new/losing), C_BOOK = mixed
- reason: max 100 chars

Trade history follows.`;

async function queryGroq(messages: { role: "user" | "assistant" | "system"; content: string }[]): Promise<string | null> {
  try {
    const groq = getGroq();
    if (!groq) return null;
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL ?? "llama-3.3-70b-versatile",
      messages: messages as any,
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    });
    return completion.choices[0]?.message?.content ?? null;
  } catch (e) {
    console.warn("Groq risk analysis error:", e);
    return null;
  }
}

async function queryGemini(messages: { role: string; content: string }[]): Promise<string | null> {
  if (!genAI) return null;
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash", generationConfig: { responseMimeType: "application/json" } });
    const chat = model.startChat({
      history: messages.slice(0, -1).map((m) => ({ role: m.role === "user" ? "user" : "model", parts: [{ text: m.content }] })),
    });
    const result = await chat.sendMessage(messages[messages.length - 1].content);
    return result.response.text();
  } catch (e) {
    console.warn("Gemini risk analysis error:", e);
    return null;
  }
}

export async function analyzeClient(userId: string) {
  const cache = await prisma.aiRiskProfile.findUnique({ where: { userId } });
  if (cache && Date.now() - cache.updatedAt.getTime() < 15 * 60 * 1000) {
    return {
      profitabilityScore: cache.profitabilityScore,
      revengeFlag: cache.revengeFlag,
      anomalyFlag: cache.anomalyFlag,
      recommendedRoute: cache.recommendedRoute,
      reason: cache.reason,
      source: "cache" as const,
    };
  }

  const trades = await prisma.trade.findMany({
    where: { userId, status: "CLOSED" },
    orderBy: { closedAt: "desc" },
    take: 50,
    select: {
      symbol: true,
      side: true,
      volume: true,
      openPrice: true,
      closePrice: true,
      stopLoss: true,
      takeProfit: true,
      profit: true,
      openedAt: true,
      closedAt: true,
    },
  });

  if (trades.length < 5) {
    return {
      profitabilityScore: 50,
      revengeFlag: false,
      anomalyFlag: false,
      recommendedRoute: "C_BOOK" as const,
      reason: "Insufficient trade history",
      source: "fallback" as const,
    };
  }

  const history = trades.map((t) =>
    `${t.symbol} ${t.side} ${Number(t.volume).toFixed(2)} lots @ ${Number(t.openPrice).toFixed(5)} → ${t.closePrice ? Number(t.closePrice).toFixed(5) : "open"} | SL: ${t.stopLoss ? Number(t.stopLoss).toFixed(5) : "none"} | TP: ${t.takeProfit ? Number(t.takeProfit).toFixed(5) : "none"} | P&L: ${Number(t.profit).toFixed(2)} | ${t.openedAt.toISOString()}`
  ).join("\n");

  let analysis: string | null = null;
  try {
    analysis = await queryGroq([
      { role: "system", content: RISK_ANALYSIS_PROMPT },
      { role: "user", content: history },
    ]);
  } catch {
    try {
      analysis = await queryGemini([
        { role: "system", content: RISK_ANALYSIS_PROMPT },
        { role: "user", content: history },
      ]);
    } catch {
      console.error("Both AI providers failed for risk analysis");
    }
  }

  let result;
  try {
    if (analysis) {
      result = JSON.parse(analysis);
    } else {
      throw new Error("No analysis");
    }
  } catch {
    result = {
      profitability_score: 50,
      revenge_trading_flag: false,
      anomaly_flag: false,
      recommended_route: "C_BOOK",
      reason: "AI analysis failed, using defaults",
    };
  }

  await prisma.aiRiskProfile.upsert({
    where: { userId },
    create: {
      userId,
      profitabilityScore: result.profitability_score ?? 50,
      revengeFlag: result.revenge_trading_flag ?? false,
      anomalyFlag: result.anomaly_flag ?? false,
      recommendedRoute: result.recommended_route,
      reason: result.reason,
    },
    update: {
      profitabilityScore: result.profitability_score ?? 50,
      revengeFlag: result.revenge_trading_flag ?? false,
      anomalyFlag: result.anomaly_flag ?? false,
      recommendedRoute: result.recommended_route,
      reason: result.reason,
    },
  });

  return {
    profitabilityScore: result.profitability_score ?? 50,
    revengeFlag: result.revenge_trading_flag ?? false,
    anomalyFlag: result.anomaly_flag ?? false,
    recommendedRoute: result.recommended_route,
    reason: result.reason,
    source: "ai" as const,
  };
}