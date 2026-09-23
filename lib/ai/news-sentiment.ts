import { PrismaClient } from "@prisma/client";
import { fetchNews } from "@/lib/market-data";

const prisma = new PrismaClient();

// Lazy Groq client (same pattern as coach)
let groqPromise: Promise<any> | null = null;
function getGroq(): Promise<any> | null {
  if (!process.env.GROQ_API_KEY) return null;
  if (!groqPromise) {
    groqPromise = (async () => {
      const { default: Groq } = await import("groq-sdk");
      return new Groq({ apiKey: process.env.GROQ_API_KEY });
    })();
  }
  return groqPromise;
}

const SENTIMENT_PROMPT = `You are a financial news sentiment analyst.
For each news headline+summary given, output ONE line in EXACTLY this format:
<index>|<score>|<bullish-word>|<bearish-word>
Where:
- <index> is the 0-based line number
- <score> is -100 to +100 (market impact sentiment)
- <bullish-word> is the single most important bullish keyword, or "-"
- <bearish-word> is the single most important bearish keyword, or "-"
Rules: No extra text. No markdown. One line per news item, same order.
Consider: central banks, earnings, geopolitics, inflation, commodities, crypto.`;

export interface NewsSentimentItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  symbols: string[];
  score: number;           // -100..+100
  label: "bullish" | "bearish" | "neutral";
  bullishKeyword: string | null;
  bearishKeyword: string | null;
}

// Keyword fallback when AI is unavailable
const BULL_WORDS = ["surge", "rally", "gain", "rise", "beat", "upgrade", "bullish", "soar", "jump", "record high", "inflation falls", "rate cut", "stimulus", "recovery", "demand growth", "breakout"];
const BEAR_WORDS = ["crash", "plunge", "fall", "drop", "miss", "downgrade", "bearish", "sink", "recession", "rate hike", "layoff", "sanctions", "war", "default", "selloff", "breakdown"];

function keywordScore(text: string): { score: number; bull: string | null; bear: string | null } {
  const t = text.toLowerCase();
  let s = 0;
  let bull: string | null = null;
  let bear: string | null = null;
  for (const w of BULL_WORDS) if (t.includes(w)) { s += 22; bull = bull ?? w; }
  for (const w of BEAR_WORDS) if (t.includes(w)) { s -= 22; bear = bear ?? w; }
  return { score: Math.max(-100, Math.min(100, s)), bull, bear };
}

export async function analyzeNewsSentiment(limit = 20): Promise<{
  items: NewsSentimentItem[];
  overall: { score: number; label: string; bullishPct: number; bearishPct: number };
  source: "ai" | "keywords";
}> {
  const news = await fetchNews();
  const items = news.slice(0, limit);
  if (!items.length) {
    return { items: [], overall: { score: 0, label: "neutral", bullishPct: 0, bearishPct: 0 }, source: "keywords" };
  }

  const groq = await getGroq();
  const sentiments: Array<{ score: number; bull: string | null; bear: string | null }> = [];
  let source: "ai" | "keywords" = "keywords";

  if (groq) {
    try {
      const completion = await groq.chat.completions.create({
        model: process.env.GROQ_MODEL ?? "openai/gpt-oss-120b",
        messages: [
          { role: "system", content: SENTIMENT_PROMPT },
          { role: "user", content: items.map((n, i) => `${i}. ${n.title}. ${n.summary}`).join("\n") },
        ],
        temperature: 0.2,
        max_completion_tokens: 4000,
      });
      const raw: string = completion.choices[0]?.message?.content ?? "";
      const lines = raw.split("\n").map(l => l.trim()).filter(Boolean);
      let aiHits = 0;

      const parsed: Record<number, { score: number; bull: string | null; bear: string | null }> = {};
      for (const line of lines) {
        const m = line.match(/^(\d+)\|(-?\d+)\|([^|]*)\|(.*)$/);
        if (m) {
          const idx = parseInt(m[1]);
          if (idx >= 0 && idx < items.length) {
            parsed[idx] = {
              score: Math.max(-100, Math.min(100, parseInt(m[2]))),
              bull: m[3].trim() === "-" ? null : m[3].trim(),
              bear: m[4].trim() === "-" ? null : m[4].trim(),
            };
            aiHits++;
          }
        }
      }
      if (aiHits > 0) {
        source = "ai";
        for (let i = 0; i < items.length; i++) {
          sentiments.push(parsed[i] ?? keywordScore(items[i].title + " " + items[i].summary));
        }
      }
    } catch (e) {
      console.warn("[sentiment] AI analysis failed, using keywords:", e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  if (sentiments.length === 0) {
    for (const n of items) {
      sentiments.push(keywordScore(n.title + " " + n.summary));
    }
  }

  const result: NewsSentimentItem[] = items.map((n, i) => {
    const s = sentiments[i] ?? { score: 0, bull: null, bear: null };
    return {
      ...n,
      score: s.score,
      label: s.score > 20 ? "bullish" : s.score < -20 ? "bearish" : "neutral",
      bullishKeyword: s.bull,
      bearishKeyword: s.bear,
    };
  });

  const avg = result.reduce((sum, r) => sum + r.score, 0) / result.length;
  const overallScore = Math.round(avg);
  const bullish = result.filter(r => r.label === "bullish").length;
  const bearish = result.filter(r => r.label === "bearish").length;

  return {
    items: result,
    overall: {
      score: overallScore,
      label: overallScore > 20 ? "bullish" : overallScore < -20 ? "bearish" : "neutral",
      bullishPct: Math.round((bullish / result.length) * 100),
      bearishPct: Math.round((bearish / result.length) * 100),
    },
    source,
  };
}