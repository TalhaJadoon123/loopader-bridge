import { NextResponse } from "next/server";
import { getUserApiKey } from "@/lib/bot/keys";
import { fetchQuotes, fetchCandles } from "@/lib/market-data";
import { computeIndicator } from "@/lib/indicators";
import { PrismaClient } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const prisma = new PrismaClient();

// â•â•â•â•â•â•â•â•â• GOD MODE ANALYSIS â€” 8 data sources, no HTTP self-calls â•â•â•â•â•â•â•â•â•

async function getUserId(req: Request): Promise<string | null> {
  try {
    const authOpts = await getAuthOptions();
    const { getServerSession } = await import("next-auth");
    const session: any = await getServerSession(authOpts);
    if (session?.user?.id) return session.user.id;
    if (session?.user?.email) {
      const u = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
      if (u) return u.id;
    }
  } catch {}
  const email = req.headers.get("x-user-email");
  if (email) {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (u) return u.id;
  }
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  return firstUser?.id ?? null;
}

// Lazy auth import to avoid circular deps
let authOptionsRef: any = null;
async function getAuthOptions() {
  if (!authOptionsRef) {
    authOptionsRef = (await import("@/lib/auth/options")).authOptions;
  }
  return authOptionsRef;
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "No user" }, { status: 401 });

  // ── GOD MODE access gate: FREE users get 3 analyses/day, PRO/ELITE unlimited ──
  const { PrismaClient } = await import("@prisma/client");
  const prismaClient = new PrismaClient();

  const user = await prismaClient.user.findUnique({
    where: { id: userId },
    include: { subscription: true },
  });

  const plan = user?.subscription?.plan ?? "FREE";
  const isPro = plan === "PRO" || plan === "ELITE" || user?.role === "ADMIN";

  if (!isPro) {
    // Free tier: 3 analyses per day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const analysesToday = await prismaClient.xpLog.count({
      where: { userId, source: "god_mode_analysis", createdAt: { gte: today } },
    });
    if (analysesToday >= 3) {
      await prismaClient.$disconnect();
      return NextResponse.json({
        error: "Daily GOD MODE limit reached (3/day on Free plan)",
        hint: "Upgrade to PRO for unlimited analyses, multi-timeframe data, and priority execution",
        upgrade: true,
        plan,
      }, { status: 403 });
    }
    // Track usage
    await prismaClient.xpLog.create({
      data: { userId, points: 0, source: "god_mode_analysis" },
    });
  }
  await prismaClient.$disconnect();

  // ── LLM Key Resolution: Groq free tier first, then User's BYOK, then deterministic fallback ──
  let llmProvider: string, llmKey: string, llmBaseUrl: string | null, llmModel: string;

  // Priority 1: Groq free tier (env GROQ_API_KEY) - always works if configured
  const groqKey = process.env.GROQ_API_KEY ?? "";
  if (groqKey) {
    llmProvider = "groq";
    llmKey = groqKey;
    llmBaseUrl = "https://api.groq.com/openai/v1";
    llmModel = "openai/gpt-oss-20b";
  } else {
    // Priority 2: User's BYOK (from app settings / database)
    const userKey = await getUserApiKey(userId);
    if (userKey) {
      llmProvider = userKey.provider;
      llmKey = userKey.key;
      llmBaseUrl = userKey.baseUrl ?? "";
      llmModel = userKey.model ?? "";
    } else {
      // Priority 3: Deterministic fallback (no LLM call)
      llmProvider = "fallback";
      llmKey = "";
      llmBaseUrl = "";
      llmModel = "";
    }
  }

  const body = await req.json().catch(() => ({}));
  const symbol = (body.symbol ?? "XAUUSD").toUpperCase();

  // â•â•â• PARALLEL DATA COLLECTION â€” all direct function calls, zero HTTP â•â•â•
  const [quoteArr, candles, techData, newsData, accountData, recentTradesData] = await Promise.all([
    // 1. Live quote (uses provider chain + simulator)
    fetchQuotes([symbol]).catch(() => []),
    // 2. Candles for S/R detection (1h)
    fetchCandles(symbol, "1h").catch(() => []),
    // 3. Multi-timeframe indicators
    (async () => {
      const intervals = ["15m", "1h", "4h", "1d"];
      const results: Record<string, any> = {};
      await Promise.all(intervals.map(async (interval) => {
        try {
          const candleData = await fetchCandles(symbol, interval);
          const rsi = computeIndicator("RSI", candleData);
          if (rsi[0]?.series?.length) {
            results[`${interval}_rsi`] = rsi[0].series[rsi[0].series.length - 1]?.value;
            if (rsi[0].series.length >= 3) {
              const recent = rsi[0].series.slice(-3);
              results[`${interval}_rsi_trend`] = recent[2].value > recent[0].value ? "rising" : "falling";
            }
          }
        } catch {}
      }));
      // MACD on 1h
      try {
        const candleData = await fetchCandles(symbol, "1h");
        const macd = computeIndicator("MACD", candleData);
        const macdLine = macd.find((i: any) => i.name === "MACD");
        const signalLine = macd.find((i: any) => i.name === "Signal");
        if (macdLine?.series?.length && signalLine?.series?.length) {
          const lm = macdLine.series[macdLine.series.length - 1]?.value;
          const ls = signalLine.series[signalLine.series.length - 1]?.value;
          results["1h_macd"] = lm;
          results["1h_macd_signal"] = ls;
          results["1h_macd_crossover"] = lm > ls ? "BULLISH" : "BEARISH";
        }
      } catch {}
      // Bollinger 1h
      try {
        const candleData = await fetchCandles(symbol, "1h");
        const boll = computeIndicator("BOLL", candleData);
        const upper = boll.find((i: any) => i.name === "Upper");
        const lower = boll.find((i: any) => i.name === "Lower");
        if (upper?.series?.length && lower?.series?.length) {
          results["1h_bb_upper"] = upper.series[upper.series.length - 1]?.value;
          results["1h_bb_lower"] = lower.series[lower.series.length - 1]?.value;
        }
      } catch {}
      return results;
    })(),
    // 4. News sentiment (uses Google News RSS + Groq AI)
    (async () => {
      try {
        const { analyzeNewsSentiment } = await import("@/lib/ai/news-sentiment");
        return await analyzeNewsSentiment(10);
      } catch { return null; }
    })(),
    // 5. Account summary
    (async () => {
      try {
        const live = await prisma.tradingAccount.findFirst({ where: { userId, type: "LIVE", isActive: true } });
        const account = live ?? await prisma.tradingAccount.findFirst({ where: { userId, type: "DEMO", isActive: true } });
        if (!account) return null;
        return { type: account.type, balance: Number(account.balance), equity: Number(account.balance), freeMargin: Number(account.balance), openPositions: 0 };
      } catch { return null; }
    })(),
    // 6. Recent trades
    (async () => {
      try {
        return await prisma.trade.findMany({
          where: { userId, symbol, status: "CLOSED" },
          orderBy: { closedAt: "desc" }, take: 5,
          select: { symbol: true, side: true, volume: true, openPrice: true, profit: true, status: true },
        });
      } catch { return []; }
    })(),
  ]);

  const quote = quoteArr?.[0];

  // â”€â”€ Support/Resistance from candles â”€â”€
  let srData = { supports: [] as number[], resistances: [] as number[], nearestSupport: null as number | null, nearestResistance: null as number | null, currentPrice: null as number | null };
  if (candles.length > 5) {
    const current = candles[candles.length - 1].close;
    const supports: number[] = [];
    const resistances: number[] = [];
    for (let i = 2; i < candles.length - 2; i++) {
      if (candles[i].low < candles[i-1].low && candles[i].low < candles[i+1].low && supports.length < 3) supports.push(candles[i].low);
      if (candles[i].high > candles[i-1].high && candles[i].high > candles[i+1].high && resistances.length < 3) resistances.push(candles[i].high);
    }
    const round = (v: number) => v >= 1000 ? Math.round(v) : Math.round(v * 10000) / 10000;
    const sortedS = Array.from(new Set(supports.map(round))).sort((a, b) => b - a);
    const sortedR = Array.from(new Set(resistances.map(round))).sort((a, b) => a - b);
    srData = { supports: sortedS, resistances: sortedR, nearestSupport: sortedS.find(s => s < current) ?? null, nearestResistance: sortedR.find(r => r > current) ?? null, currentPrice: current };
  }

  // â”€â”€ Correlations â”€â”€
  const correlationMap: Record<string, string[]> = {
    XAUUSD: ["US30", "EURUSD"], BTCUSD: ["NAS100", "SPX500"],
    USOIL: ["USDCAD", "US30"], NAS100: ["BTCUSD"],
  };
  let correlationData: Record<string, any> = {};
  const related = correlationMap[symbol];
  if (related?.length) {
    try {
      const relatedQuotes = await fetchQuotes(related);
      for (const q of relatedQuotes) correlationData[q.symbol] = { price: q.price, change: q.changePercent };
    } catch {}
  }

  // â”€â”€ Market Mood â”€â”€
  let mood = null;
  try {
    mood = await prisma.sentimentCache.findUnique({ where: { symbol } });
  } catch {}

  const provider = llmProvider;
  const baseUrl = llmBaseUrl || getDefaultBaseUrl(provider);
  const model = llmModel || getDefaultModel(provider);

  // â•â•â•â•â•â•â•â•â• BUILD GOD MODE PROMPT â•â•â•â•â•â•â•â•â•
  const price = quote?.price ?? 0;
  const techStr = Object.entries(techData).map(([k, v]) => `  ${k}: ${v}`).join("\n");
  const newsStr = newsData?.items?.slice(0, 5).map((n: any) => `  [${n.label} ${n.score}] ${n.title} (${n.source})`).join("\n") ?? "  No news";
  const corrStr = Object.entries(correlationData).map(([s, d]: [string, any]) => `  ${s}: ${d.price} (${d.change > 0 ? "+" : ""}${d.change}%)`).join("\n") || "  N/A";
  const portfolioStr = accountData ? `  Type: ${accountData.type} | Balance: $${accountData.balance} | Equity: $${accountData.equity} | Open: ${accountData.openPositions}` : "  N/A";
  const tradesStr = recentTradesData.length
    ? recentTradesData.map(t => `  ${t.symbol} ${t.side} ${Number(t.volume)} lots â†’ P&L: $${Number(t.profit).toFixed(2)}`).join("\n")
    : "  No recent trades on this symbol";

  const assetContext = getAssetContext(symbol);

  const systemPrompt = `You are a senior institutional trading analyst with 20+ years at Goldman Sachs and Citadel. You manage a team of 6 specialists. Your analysis is read by hedge fund managers who expect BULLETS EYE precision.

ANALYSIS FRAMEWORK (in order of importance):
1. MACRO REGIME: Where are we in the cycle? Risk-on/risk-off? Rate environment? Dollar strength?
2. STRUCTURAL LEVELS: Map key support/resistance from the data. Identify where big money has orders.
3. MOMENTUM: Is RSI/MACD confirming or diverging? Multi-timeframe alignment or conflict?
4. SMART MONEY: What would institutions do here? Where is liquidity? Where are stops clustered?
5. RISK/REWARD: Only recommend trades with minimum 1:2 risk/reward. Calculate position size from the user's actual balance using 2% max risk.

OUTPUT: Respond with ONLY a valid JSON object. No markdown, no explanation, no code fences. Just the JSON:
{"signal":"BUY","confidence":75,"reasoning":"3-4 sentence executive summary citing SPECIFIC numbers from the data. Sound like a senior analyst briefing a fund manager. Reference exact indicator values, exact price levels, exact correlations.","technical":"3-4 sentences: multi-timeframe alignment/conflict, specific RSI values per timeframe, MACD crossover status, Bollinger position, key S/R distances from current price","news":"2-3 sentences: which specific headlines matter and WHY, quantify the impact","bullCase":"3 sentences: strongest bull argument with specific price targets and catalysts","bearCase":"3 sentences: strongest bear argument with specific price targets and risks","riskNote":"2-3 sentences: what could invalidate this trade, what data quality issues exist, position sizing guidance","entry":PRICE,"stopLoss":PRICE,"takeProfit1":TP1,"takeProfit2":TP2,"positionSizeLots":CALCULATED,"riskPercent":2.0,"riskReward":"1:X.X","timeHorizon":"hours|days|weeks","tradeGrade":"A|B|C|D","marketRegime":"trending|ranging|volatile|quiet","keyLevels":{"support":[closest,second,third],"resistance":[closest,second,third]},"probability":{"upside":N,"downside":N,"sideways":N},"confluence":"List all BULLISH factors vs BEARISH factors side by side with counts"}

CRITICAL RULES:
- entry/stopLoss/takeProfit: USE THE CURRENT LIVE PRICE as reference. Indicators may show different scale prices - use them ONLY for direction/momentum signals, never for absolute levels
- positionSizeLots: (balance * 2%) / (|entry - stopLoss| * contract_size). Show your calculation
- tradeGrade: A=high confluence (>5 factors aligned), B=moderate (3-4 factors), C=mixed (2 factors), D=conflicting signals
- confluence: Format "BULLISH: RSI<50, MACD bullish, support holding (3) | BEARISH: RSI>70, MACD bearish, news negative (2)"
- probability MUST sum to 100
- NEVER be vague. Reference EXACT numbers from the data provided. If RSI is 52.3, say "RSI 52.3" not "RSI neutral"
- If data is insufficient or contradictory, signal HOLD with confidence 25-35
${assetContext}`;

  const userPrompt = `INSTITUTIONAL ANALYSIS REQUEST: ${symbol}

--- MARKET SNAPSHOT ---
Live Price: ${price} (${quote?.source ?? "unknown"} ${quote?.delayed ? "? DELAYED DATA" : "? LIVE"})
24h Change: ${quote?.changePercent ?? "N/A"}%

--- MULTI-TIMEFRAME TECHNICALS ---
${techStr}

--- KEY LEVELS (auto-detected from 100 candles) ---
Nearest Support: ${srData.nearestSupport ?? "N/A"} (${srData.nearestSupport ? Math.abs(price - srData.nearestSupport).toFixed(5) + " away" : ""})
Nearest Resistance: ${srData.nearestResistance ?? "N/A"} (${srData.nearestResistance ? Math.abs(srData.nearestResistance - price).toFixed(5) + " away" : ""})
All Supports: ${srData.supports.join(" ? ") || "N/A"}
All Resistances: ${srData.resistances.join(" ? ") || "N/A"}

--- CORRELATED ASSETS ---
${corrStr}

--- NEWS FLOW ---
Overall Sentiment: ${newsData?.overall?.score ?? "N/A"} (${newsData?.overall?.label ?? "N/A"}) | Bullish: ${newsData?.overall?.bullishPct ?? 0}% | Bearish: ${newsData?.overall?.bearishPct ?? 0}%
${newsStr}

--- MARKET MOOD ---
Sentiment Gauge: ${mood?.score ?? "N/A"} (scale: -100 extreme fear to +100 extreme greed)

--- TRADER PORTFOLIO ---
${portfolioStr}

--- TRADE HISTORY ON ${symbol} ---
${tradesStr}

--- INSTRUCTIONS ---
Generate your 6-agent institutional analysis. Be specific with numbers. Calculate position sizing. Grade the trade. List confluence factors.`;
  let responseText = "";

  // Skip LLM call for fallback provider (uses deterministic analysis)
  if (llmProvider !== "fallback" && llmKey) {
    try {
      let llmUrl = `${baseUrl}/chat/completions`;
      let headers: Record<string, string> = { "Content-Type": "application/json" };
      if (provider === "anthropic") {
        llmUrl = "https://api.anthropic.com/v1/messages";
        headers["x-api-key"] = llmKey;
        headers["anthropic-version"] = "2023-06-01";
      } else if (provider === "gemini") {
        llmUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${llmKey}`;
      } else {
        headers["Authorization"] = `Bearer ${llmKey}`;
      }

      const llmBody: any = provider === "anthropic"
        ? { model, max_tokens: 2000, messages: [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }] }
        : provider === "gemini"
          ? { contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }] }
          : { model, messages: [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }], max_tokens: 2000, temperature: 0.3 };

      const res = await fetch(llmUrl, { method: "POST", headers, body: JSON.stringify(llmBody), signal: AbortSignal.timeout(55000) });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message ?? JSON.stringify(data.error).slice(0, 200));
      responseText = data.choices?.[0]?.message?.content ?? data.content?.[0]?.text ?? data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    } catch (e: any) {
      return NextResponse.json({ error: `LLM: ${e?.message?.slice(0, 200)}`, provider, model }, { status: 502 });
    }
  }

  // Parse verdict - 4-strategy extraction that works with ANY AI response format
  let verdict: any = {};
  const cleaned = responseText.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  // Strategy 1: Direct JSON.parse
  try { verdict = JSON.parse(cleaned); } catch {}

  // Strategy 2: Find JSON object boundaries
  if (!verdict.signal) {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try { verdict = JSON.parse(cleaned.slice(start, end + 1)); } catch {}
    }
  }

  // Strategy 3: Regex field extraction - works with nested/escaped/malformed JSON
  if (!verdict.technical) {
    const extract = (field: string): string | null => {
      const strM = cleaned.match(new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`));
      if (strM) return strM[1].replace(/\\"/g, '"');
      return null;
    };
    const numExtract = (field: string): number | null => {
      const numM = cleaned.match(new RegExp(`"${field}"\\s*:\\s*([\\d.]+)`));
      return numM ? parseFloat(numM[1]) : null;
    };

    const sig = cleaned.match(/"signal"\s*:\s*"(BUY|SELL|HOLD)"/i);
    if (sig) verdict.signal = sig[1].toUpperCase();
    const conf = cleaned.match(/"confidence"\s*:\s*(\d+)/);
    if (conf) verdict.confidence = parseInt(conf[1]);

    if (!verdict.reasoning || verdict.reasoning.startsWith("{")) {
      const r = extract("reasoning");
      if (r) verdict.reasoning = r;
    }
    const tech = extract("technical");
    if (tech) verdict.technical = tech;
    const news = extract("news");
    if (news) verdict.news = news;
    const bull = extract("bullCase");
    if (bull) verdict.bullCase = bull;
    const bear = extract("bearCase");
    if (bear) verdict.bearCase = bear;
    const risk = extract("riskNote");
    if (risk) verdict.riskNote = risk;

    const entry = numExtract("entry");
    if (entry) verdict.entry = entry;
    const sl = numExtract("stopLoss");
    if (sl) verdict.stopLoss = sl;
    const tp1 = numExtract("takeProfit1");
    if (tp1) verdict.takeProfit1 = tp1;
    const tp2 = numExtract("takeProfit2");
    if (tp2) verdict.takeProfit2 = tp2;
    const size = numExtract("positionSizeLots");
    if (size) verdict.positionSizeLots = size;
    const rp = numExtract("riskPercent");
    if (rp) verdict.riskPercent = rp;
    const rr = extract("riskReward");
    if (rr) verdict.riskReward = rr;
    const th = extract("timeHorizon");
    if (th) verdict.timeHorizon = th;
    const grade = extract("tradeGrade");
    if (grade) verdict.tradeGrade = grade;
    const regime = extract("marketRegime");
    if (regime) verdict.marketRegime = regime;
    const confluence = extract("confluence");
    if (confluence) verdict.confluence = confluence;
    const prob = cleaned.match(/"probability"\s*:\s*(\{[^}]+\})/);
    if (prob) { try { verdict.probability = JSON.parse(prob[1]); } catch {} }
    const kl = cleaned.match(/"keyLevels"\s*:\s*(\{[^}]+\}[^}]*)\}/);
    if (kl) { try { verdict.keyLevels = JSON.parse(kl[1] + "}"); } catch {} }
  }

  // Deep-parse nested JSON strings
  for (const key of Object.keys(verdict)) {
    if (typeof verdict[key] === "string" && (verdict[key] as string).startsWith("{")) {
      try {
        const inner = JSON.parse(verdict[key]);
        for (const [k, v] of Object.entries(inner)) { verdict[k] = v; }
      } catch {}
    }
  }
  if (verdict.result && typeof verdict.result === "object") verdict = { ...verdict, ...verdict.result };

  // Final fallback
  if (!verdict.signal) {
    const upper = responseText.toUpperCase();
    verdict.signal = upper.includes("BUY") ? "BUY" : upper.includes("SELL") ? "SELL" : "HOLD";
    verdict.confidence = 50;
    verdict.reasoning = responseText.slice(0, 800);
  }

  const raw = (verdict.signal ?? "HOLD").toString().toUpperCase();
  const finalSignal = raw.includes("BUY") || raw.includes("LONG") ? "BUY" : raw.includes("SELL") || raw.includes("SHORT") ? "SELL" : "HOLD";

  // ── DETERMINISTIC FALLBACK: Fill ALL missing fields from collected data ──
  // This guarantees the output card is ALWAYS complete regardless of AI format
  const livePrice = quote?.price ?? price;
  const rsi1h = techData["1h_rsi"] ?? null;
  const rsi4h = techData["4h_rsi"] ?? null;
  const rsi1d = techData["1d_rsi"] ?? null;
  const macdCross = techData["1h_macd_crossover"] ?? "N/A";
  const emaSlope = techData["4h_ema_slope"] ?? "N/A";

  // Auto-compute SL/TP from live price + S/R levels
  const computedSL = finalSignal === "BUY"
    ? (srData.nearestSupport ?? livePrice * 0.99)
    : (srData.nearestResistance ?? livePrice * 1.01);
  const computedTP1 = finalSignal === "BUY"
    ? (srData.nearestResistance ?? livePrice * 1.015)
    : (srData.nearestSupport ?? livePrice * 0.985);
  const computedTP2 = finalSignal === "BUY"
    ? livePrice + (livePrice - computedSL) * 2.5
    : livePrice - (computedSL - livePrice) * 2.5;

  // Position sizing: (balance * 2% risk) / (entry-SL distance)
  const balance = accountData?.balance ?? 10000;
  const slDistance = Math.abs(livePrice - computedSL);
  const contractSize = symbol.includes("XAU") ? 100 : symbol.includes("BTC") ? 1 : symbol.includes("OIL") ? 1000 : 100000;
  const computedLots = slDistance > 0 ? Math.round(((balance * 0.02) / (slDistance * contractSize)) * 100) / 100 : 0.01;

  // Confluence scoring
  let bullFactors = 0, bearFactors = 0;
  const confluenceParts: string[] = [];
  if (rsi1h !== null && rsi1h < 45) { bullFactors++; confluenceParts.push("RSI 1h oversold-ish"); }
  if (rsi1h !== null && rsi1h > 55) { bearFactors++; confluenceParts.push("RSI 1h overbought-ish"); }
  if (macdCross === "BULLISH") { bullFactors++; confluenceParts.push("MACD bullish cross"); }
  if (macdCross === "BEARISH") { bearFactors++; confluenceParts.push("MACD bearish cross"); }
  if (emaSlope === "up") { bullFactors++; confluenceParts.push("EMA 4h rising"); }
  if (emaSlope === "down") { bearFactors++; confluenceParts.push("EMA 4h falling"); }
  if (newsData?.overall && newsData.overall.score > 10) { bullFactors++; confluenceParts.push("news positive"); }
  if (newsData?.overall && newsData.overall.score < -10) { bearFactors++; confluenceParts.push("news negative"); }
  if (mood?.score != null && mood.score > 10) { bullFactors++; confluenceParts.push("market mood greedy"); }
  if (mood?.score != null && mood.score < -10) { bearFactors++; confluenceParts.push("market mood fearful"); }
  const confluenceStr = `BULLISH (${bullFactors}): ${confluenceParts.filter((_, i) => i % 2 === 0).join(", ") || "none"} | BEARISH (${bearFactors}): ${confluenceParts.filter((_, i) => i % 2 === 1).join(", ") || "none"}`;

  // Trade grade
  const totalFactors = bullFactors + bearFactors;
  const dominant = Math.max(bullFactors, bearFactors);
  const tradeGrade = dominant >= 5 ? "A" : dominant >= 3 ? "B" : dominant >= 2 ? "C" : "D";

  // Market regime
  const atrValue = Math.abs(quote?.changePercent ?? 0);
  const marketRegime = atrValue > 3 ? "volatile" : atrValue > 1.5 ? "trending" : atrValue > 0.5 ? "ranging" : "quiet";

  // Probability (based on signal direction and confluence)
  const baseProb = finalSignal === "BUY" ? { upside: 30 + bullFactors * 8, downside: 20 + bearFactors * 8, sideways: 50 - (bullFactors + bearFactors) * 4 } :
    finalSignal === "SELL" ? { upside: 20 + bearFactors * 8, downside: 30 + bullFactors * 8, sideways: 50 - (bullFactors + bearFactors) * 4 } :
    { upside: 25, downside: 25, sideways: 50 };
  const probability = {
    upside: Math.max(5, Math.min(70, baseProb.upside)),
    downside: Math.max(5, Math.min(70, baseProb.downside)),
    sideways: Math.max(10, Math.min(60, baseProb.sideways)),
  };
  const probSum = probability.upside + probability.downside + probability.sideways;
  probability.upside = Math.round(probability.upside / probSum * 100);
  probability.downside = Math.round(probability.downside / probSum * 100);
  probability.sideways = 100 - probability.upside - probability.downside;

  // Compute R:R
  const risk = Math.abs(livePrice - computedSL);
  const reward = Math.abs(computedTP1 - livePrice);
  const riskReward = risk > 0 ? `1:${(reward / risk).toFixed(1)}` : "1:2";

  // ── Fill missing fields with computed values ──
  const result = {
    signal: finalSignal,
    confidence: Math.min(100, Math.max(0, Number(verdict.confidence) || 50)),
    reasoning: (verdict.reasoning ?? responseText.slice(0, 800)).toString().slice(0, 800),
    technical: verdict.technical ?? `RSI 1h: ${rsi1h ?? "N/A"} (${techData["1h_rsi_trend"] ?? ""}), RSI 4h: ${rsi4h ?? "N/A"}, RSI 1d: ${rsi1d ?? "N/A"}. MACD 1h: ${macdCross}. EMA 4h: ${emaSlope}. Bollinger: ${techData["1h_bb_lower"] ?? "?"} — ${techData["1h_bb_upper"] ?? "?"}. Price at $${livePrice} vs Support $${srData.nearestSupport ?? "?"} / Resistance $${srData.nearestResistance ?? "?"}.`,
    news: verdict.news ?? `Sentiment score ${newsData?.overall?.score ?? "N/A"} (${newsData?.overall?.label ?? "neutral"}). ${newsData?.overall?.bullishPct ?? 0}% bullish vs ${newsData?.overall?.bearishPct ?? 0}% bearish across ${newsData?.items?.length ?? 0} articles. Market mood: ${mood?.score ?? "N/A"}.`,
    bullCase: verdict.bullCase ?? `Support holding at $${srData.nearestSupport ?? "key level"}. ${bullFactors} bullish factors: ${confluenceParts.filter((_, i) => i % 2 === 0).join(", ") || "waiting for confirmation"}. Target above $${srData.nearestResistance ?? computedTP1} on breakout.`,
    bearCase: verdict.bearCase ?? `Resistance capping at $${srData.nearestResistance ?? "key level"}. ${bearFactors} bearish factors: ${confluenceParts.filter((_, i) => i % 2 === 1).join(", ") || "waiting for confirmation"}. Break below $${srData.nearestSupport ?? computedSL} opens downside to $${computedTP2}.`,
    riskNote: verdict.riskNote ?? `Max 2% risk per trade = $${(balance * 0.02).toFixed(2)}. Stop at $${computedSL} gives ${riskReward} R:R. Market regime: ${marketRegime}. ${totalFactors < 3 ? "Low confluence — reduce size or wait for confirmation." : "Adequate confluence for standard sizing."}`,
    entry: parseFloat(verdict.entry) || livePrice,
    stopLoss: parseFloat(verdict.stopLoss) || computedSL,
    takeProfit1: parseFloat(verdict.takeProfit1 ?? verdict.takeProfit) || computedTP1,
    takeProfit2: parseFloat(verdict.takeProfit2) || computedTP2,
    positionSizeLots: parseFloat(verdict.positionSizeLots) || computedLots,
    riskPercent: parseFloat(verdict.riskPercent) || 2,
    riskReward: verdict.riskReward ?? riskReward,
    timeHorizon: verdict.timeHorizon ?? "days",
    tradeGrade: verdict.tradeGrade ?? tradeGrade,
    marketRegime: verdict.marketRegime ?? marketRegime,
    keyLevels: verdict.keyLevels ?? { support: srData.supports, resistance: srData.resistances },
    probability: verdict.probability ?? probability,
    confluence: verdict.confluence ?? confluenceStr,
  };

  return NextResponse.json({
    symbol,
    godMode: true,
    result,
    marketData: quote ? { price: quote.price, change: quote.changePercent, source: quote.source } : null,
    dataSources: { technicals: techData, supportResistance: srData, correlations: correlationData, newsSentiment: newsData?.overall, marketMood: mood?.score, portfolio: accountData, recentTrades: recentTradesData.length },
    provider,
    model,
    disclaimer: "AI-generated analysis, not financial advice. Trading involves risk of loss.",
  });
}

function getAssetContext(symbol: string): string {
  if (["XAUUSD", "XAUEUR"].includes(symbol)) return "GOLD: safe-haven, correlates inversely with DXY and real yields. Central bank buying drives structural demand. Key levels at round numbers ($4000, $4200, $4400). Use $10-30 SL distances. Watch Fed decisions, CPI, NFP, geopolitics.";
  if (["XAGUSD"].includes(symbol)) return "SILVER: precious + industrial metal. More volatile than gold, higher beta. Solar/electronics demand matters.";
  if (["USOIL", "UKOIL"].includes(symbol)) return "OIL: OPEC+ decisions, EIA inventories, geopolitical supply. Key levels $70, $75, $80, $85.";
  if (["BTCUSD", "ETHUSD"].includes(symbol)) return "CRYPTO: 24/7, extremely volatile. ETF flows, whale movements, regulation. Key levels at round thousands.";
  return "Watch central bank policy, economic data releases, earnings, and sector momentum.";
}

function getDefaultBaseUrl(provider: string): string {
  const urls: Record<string, string> = {
    openai: "https://api.openai.com/v1", groq: "https://api.groq.com/openai/v1",
    cerebras: "https://api.cerebras.ai/v1", nvidia: "https://integrate.api.nvidia.com/v1",
    openrouter: "https://openrouter.ai/api/v1", together: "https://api.together.xyz/v1",
    deepseek: "https://api.deepseek.com/v1", mistral: "https://api.mistral.ai/v1",
    xai: "https://api.x.ai/v1", gemini: "https://generativelanguage.googleapis.com/v1beta",
    anthropic: "https://api.anthropic.com/v1",
  };
  return urls[provider] ?? "https://api.openai.com/v1";
}

function getDefaultModel(provider: string): string {
  const models: Record<string, string> = {
    openai: "gpt-4o-mini", groq: "openai/gpt-oss-20b", cerebras: "llama-3.3-70b",
    nvidia: "nvidia/nemotron-3-ultra", openrouter: "meta-llama/llama-3.1-8b-instruct:free",
    together: "meta-llama/Llama-3.3-70B-Instruct-Turbo", deepseek: "deepseek-chat",
    mistral: "mistral-large-latest", xai: "grok-3", gemini: "gemini-2.0-flash",
    anthropic: "claude-sonnet-4-20250514",
  };
  return models[provider] ?? "gpt-4o-mini";
}

