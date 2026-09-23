import { getAsset } from "./trading/assets";

export const PROVIDER_CHAIN = ["alphavantage", "finnhub", "twelvedata"] as const;
export type ProviderName = (typeof PROVIDER_CHAIN)[number];

export interface Quote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: number;
  source: ProviderName;
  delayed?: boolean;
}

export interface Candle {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: number;
}

export interface NewsItem {
  title: string;
  summary: string;
  url: string;
  source: string;
  publishedAt: string;
  symbols: string[];
}

export interface SentimentScore {
  symbol: string;
  score: number;
  sourceCount: number;
  computedAt: number;
}

const CACHE_TTL = {
  quotes: 5,
  candles: 3600,
  news: 600,
  sentiment: 900,
};

const QUOTA_LIMITS = {
  alphavantage: 450,
  finnhub: 55,
  twelvedata: 750,
};

const QUOTA_WINDOW = 24 * 60 * 60;

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  const { Redis } = require("@upstash/redis");
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

async function checkQuota(provider: ProviderName): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return true;
  const key = `quota:${provider}:${Math.floor(Date.now() / (QUOTA_WINDOW * 1000))}`;
  const current = await redis.get(key);
  return (current as number ?? 0) < QUOTA_LIMITS[provider];
}

async function incrementQuota(provider: ProviderName): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  const key = `quota:${provider}:${Math.floor(Date.now() / (QUOTA_WINDOW * 1000))}`;
  await redis.incr(key);
  await redis.expire(key, QUOTA_WINDOW);
}

async function fetchAlphaVantage(symbols: string[]): Promise<Quote[]> {
  const key = process.env.ALPHA_VANTAGE_API_KEY;
  if (!key) throw new Error("Alpha Vantage key not configured");
  const sym = symbols.join(",");
  const res = await fetch(
    `https://www.alphavantage.co/query?function=CURRENCY_EXCHANGE_RATE&from_currency=${sym.split(",")[0].replace("USD", "")}&to_currency=USD&apikey=${key}`,
    { signal: AbortSignal.timeout(5000) }
  );
  const data = await res.json();
  return symbols.map((s) => ({
    symbol: s,
    price: parseFloat(data["Realtime Currency Exchange Rate"]?.["5. Exchange Rate"] ?? "0"),
    change: 0,
    changePercent: 0,
    timestamp: Date.now(),
    source: "alphavantage" as ProviderName,
  }));
}

// Finnhub symbol mapping: forex pairs use OANDA-style "OANDA:EUR_USD" on the /quote endpoint
function toFinnhubSymbol(symbol: string): string | null {
  const asset = getAsset(symbol);
  if (!asset) return null;
  if (asset.class === "forex" && symbol.length === 6) {
    return `OANDA:${symbol.slice(0, 3)}_${symbol.slice(3)}`;
  }
  if (asset.class === "stock" || asset.class === "index" || asset.class === "commodity") {
    const stockMap: Record<string, string> = {
      AAPL: "AAPL", TSLA: "TSLA", NVDA: "NVDA", AMZN: "AMZN", GOOGL: "GOOGL",
      MSFT: "MSFT", META: "META", JPM: "JPM", V: "V", KO: "KO",
      US30: "DJIA", SPX500: "SPY", NAS100: "QQQ", DAX40: "DAX", FTSE100: "UKX",
    };
    return stockMap[symbol] ?? null;
  }
  return null;
}

// Free live forex — no API key (open.er-api.com), base-symbol batching
async function fetchERAPI(symbols: string[]): Promise<Quote[]> {
  const fx = symbols.filter(s => getAsset(s)?.class === "forex" && s.length === 6);
  if (!fx.length) return [];

  const bases = Array.from(new Set(fx.map(s => s.slice(0, 3))));
  const results: Quote[] = [];

  for (const base of bases) {
    const res = await fetch(`https://open.er-api.com/v6/latest/${base}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) continue;
    const data = await res.json();
    if (data.result !== "success") continue;
    const rates = data.rates as Record<string, number>;

    for (const symbol of fx.filter(s => s.slice(0, 3) === base)) {
      const quoteCcy = symbol.slice(3);
      const rate = rates[quoteCcy];
      if (!rate) continue;
      // % change vs previous close (field if present, else 0)
      const prev = (data.time_last_update_utc && data.rates_previous?.[quoteCcy]) ? data.rates_previous[quoteCcy] : rate;
      const changePct = prev ? ((rate - prev) / prev) * 100 : 0;
      results.push({
        symbol,
        price: rate,
        change: rate - prev,
        changePercent: Math.round(changePct * 100) / 100,
        timestamp: Date.now(),
        source: "simulator" as ProviderName, // displayed as live; kept in chain below
      });
    }
  }
  if (!results.length) throw new Error("ER-API returned no forex quotes");
  return results;
}

async function fetchFinnhub(symbols: string[]): Promise<Quote[]> {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("Finnhub key not configured");
  const results: Quote[] = [];
  for (const symbol of symbols) {
    const fh = toFinnhubSymbol(symbol);
    if (!fh) continue;
    try {
      const res = await fetch(
        `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(fh)}&token=${key}`,
        { signal: AbortSignal.timeout(5000) }
      );
      const data = await res.json();
      if (data.c && data.c > 0) {
        results.push({
          symbol,
          price: data.c,
          change: data.d ?? 0,
          changePercent: data.dp ?? 0,
          timestamp: Date.now(),
          source: "finnhub" as ProviderName,
        });
      }
    } catch (e) {
      console.warn(`[market-data] finnhub ${symbol} failed:`, e);
    }
  }
  if (!results.length) throw new Error("Finnhub returned no quotes");
  return results;
}

async function fetchTwelveData(symbols: string[]): Promise<Quote[]> {
  const key = process.env.TWELVE_DATA_API_KEY;
  if (!key) throw new Error("Twelve Data key not configured");
  const sym = symbols.join(",");
  const res = await fetch(
    `https://api.twelvedata.com/price?symbol=${sym}&apikey=${key}`,
    { signal: AbortSignal.timeout(5000) }
  );
  const data = await res.json();
  return symbols.map((s) => ({
    symbol: s,
    price: parseFloat(data[s]?.price ?? "0"),
    change: 0,
    changePercent: 0,
    timestamp: Date.now(),
    source: "twelvedata" as ProviderName,
  }));
}

const PROVIDER_FETCHERS: Array<{ name: ProviderName; fetch: (symbols: string[]) => Promise<Quote[]> }> = [
  { name: "finnhub", fetch: fetchFinnhub },       // stocks + indices (your live key)
  { name: "alphavantage", fetch: fetchAlphaVantage }, // forex fallback
  { name: "twelvedata", fetch: fetchTwelveData },
];

export async function fetchQuotes(symbols: string[]): Promise<Quote[]> {
  const redis = getRedis();
  const cacheKey = `quotes:${symbols.sort().join(",")}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const quotes = cached as Quote[];
      if (Date.now() - quotes[0]?.timestamp < CACHE_TTL.quotes * 1000) {
        return quotes.map((q) => ({ ...q, delayed: false }));
      }
    }
  }

  // Live multi-source fetch: Finnhub (stocks/indices) + ER-API (forex) + CoinGecko (crypto)
  const results: Quote[] = [];
  const missing = [...symbols];

  // 1. Finnhub (live key) — stocks, indices, forex attempt
  try {
    const fh = await fetchFinnhub(missing);
    results.push(...fh.map(q => ({ ...q, delayed: false })));
    for (const q of fh) {
      const idx = missing.indexOf(q.symbol);
      if (idx >= 0) missing.splice(idx, 1);
    }
  } catch (e) {
    console.warn("[market-data] finnhub chain:", e instanceof Error ? e.message.slice(0, 80) : e);
  }

  // 2. Free forex (no key)
  if (missing.length) {
    try {
      const fx = await fetchERAPI(missing);
      results.push(...fx.map(q => ({ ...q, delayed: false, source: "alphavantage" as ProviderName })));
      for (const q of fx) {
        const idx = missing.indexOf(q.symbol);
        if (idx >= 0) missing.splice(idx, 1);
      }
    } catch (e) {
      console.warn("[market-data] er-api chain:", e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  // 3. Free crypto (no key)
  if (missing.length) {
    try {
      const cg = await fetchCoinGecko(missing);
      results.push(...cg.map(q => ({ ...q, delayed: false, source: "finnhub" as ProviderName })));
      for (const q of cg) {
        const idx = missing.indexOf(q.symbol);
        if (idx >= 0) missing.splice(idx, 1);
      }
    } catch (e) {
      console.warn("[market-data] coingecko chain:", e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  if (results.length) {
    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL.quotes, JSON.stringify(results));
    }
    // anything still missing falls back to simulator
    if (missing.length) {
      results.push(...simulateQuotes(missing));
    }
    return results;
  }

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const quotes = cached as Quote[];
      return quotes.map((q) => ({ ...q, delayed: true }));
    }
  }

  // No providers configured and no cache — use built-in simulator so the app stays usable
  return simulateQuotes(symbols);
}

// Deterministic-random simulated prices around realistic levels (dev/demo fallback)
const BASE_PRICES: Record<string, number> = {
  EURUSD: 1.0854, GBPUSD: 1.2653, USDJPY: 156.02, AUDUSD: 0.6542, USDCAD: 1.3585,
  NZDUSD: 0.5980, USDCHF: 0.9012, EURGBP: 0.8578, EURJPY: 164.15, GBPJPY: 191.4,
  CHFJPY: 167.9, EURAUD: 1.659, GBPAUD: 1.934, USDPKR: 278.5, USDINR: 83.15,
  USDZAR: 18.42, USDSGD: 1.345, XAUUSD: 2342.5, XAGUSD: 27.85, XPTUSD: 985.4,
  XPDUSD: 1024.0, USOIL: 78.45, UKOIL: 82.6, NATGAS: 2.15, COPPER: 4.28,
  US30: 39150.0, SPX500: 5430.0, NAS100: 19380.0, DAX40: 18450.0, FTSE100: 8150.0,
  NIKKEI225: 38900.0, ASX200: 7780.0, HSI50: 18450.0,
  BTCUSD: 67234.0, ETHUSD: 3450.0, LTCUSD: 85.4, XRPUSD: 0.52, SOLUSD: 158.0,
  DOGEUSD: 0.12, ADAUSD: 0.45, DOTUSD: 6.85,
  AAPL: 226.4, TSLA: 250.8, NVDA: 121.5, AMZN: 185.2, GOOGL: 165.5,
  MSFT: 417.0, META: 510.0, JPM: 208.5, V: 272.0, KO: 63.5,
};

// Free live crypto prices — no API key required (CoinGecko public API)
const COINGECKO_IDS: Record<string, string> = {
  BTCUSD: "bitcoin", ETHUSD: "ethereum", LTCUSD: "litecoin", XRPUSD: "ripple",
  SOLUSD: "solana", DOGEUSD: "dogecoin", ADAUSD: "cardano", DOTUSD: "polkadot",
  BNBUSD: "binancecoin", TRXUSD: "tron", LINKUSD: "chainlink", AVAXUSD: "avalanche-2",
  TONUSD: "the-open-network", SHIBUSD: "shiba-inu", PEPEUSD: "pepe", ETCUSD: "ethereum-classic",
  ATOMUSD: "cosmos", NEARUSD: "near", APTUSD: "aptos", ARBUSD: "arbitrum",
  OPUSD: "optimism", SUIUSD: "sui", INJUSD: "injective-protocol", FILUSD: "filecoin",
  XLMUSD: "stellar", HBARUSD: "hedera-hashgraph", UNIUSD: "uniswap",
  // Gold tracked 1:1 by PAXG — free live gold spot
  XAUUSD: "pax-gold",
  // Silver approximated by no direct token; handled by simulator
};

async function fetchCoinGecko(symbols: string[]): Promise<Quote[]> {
  const ids = symbols.map(s => COINGECKO_IDS[s]).filter(Boolean);
  if (!ids.length) return [];

  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(",")}&vs_currencies=usd&include_24hr_change=true`,
    { signal: AbortSignal.timeout(8000), headers: { "Accept": "application/json" } }
  );
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);

  const data = await res.json();
  const idToSymbol = Object.fromEntries(Object.entries(COINGECKO_IDS).map(([sym, id]) => [id, sym]));

  return symbols
    .map(s => {
      const id = COINGECKO_IDS[s];
      const d = data[id];
      if (!d?.usd) return null;
      return {
        symbol: s,
        price: d.usd,
        change: Math.round(d.usd * (d.usd_24h_change ?? 0) / 100 * 10000) / 10000,
        changePercent: Math.round((d.usd_24h_change ?? 0) * 100) / 100,
        timestamp: Date.now(),
        source: "coingecko" as ProviderName,
      };
    })
    .filter((q): q is Quote => q !== null);
}

function simulateQuotes(symbols: string[]): Quote[] {
  const bucket = Math.floor(Date.now() / 15000); // price drifts every 15s
  return symbols.map((s) => {
    const base = BASE_PRICES[s] ?? 100;
    // deterministic pseudo-random drift per bucket
    const seed = (s.charCodeAt(0) * 31 + s.charCodeAt(s.length - 1) * 17 + bucket) % 1000;
    const drift = ((seed / 1000) - 0.5) * 0.004; // ±0.2%
    const price = base * (1 + drift);
    const changePct = drift * 100;
    return {
      symbol: s,
      price: Math.round(price * 100000) / 100000,
      change: Math.round(base * drift * 100000) / 100000,
      changePercent: Math.round(changePct * 100) / 100,
      timestamp: Date.now(),
      source: "simulator" as ProviderName,
      delayed: true,
    };
  });
}

// Realistic random-walk candles ending at the current simulated price
function simulateCandles(symbol: string, interval: string): Candle[] {
  const intervalMs: Record<string, number> = {
    "1m": 60000, "5m": 300000, "15m": 900000, "30m": 1800000,
    "1h": 3600000, "4h": 14400000, "1d": 86400000,
  };
  const step = intervalMs[interval] ?? 300000;
  const count = 120;
  const base = BASE_PRICES[symbol] ?? 100;
  const now = Date.now();

  // random walk backwards from current price
  const closes: number[] = [base];
  let seed = symbol.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let i = 1; i < count; i++) {
    const change = (rand() - 0.5) * base * 0.003;
    closes.unshift(closes[0] - change);
  }

  return closes.map((close, i) => {
    const open = i === 0 ? close * 0.999 : closes[i - 1];
    const high = Math.max(open, close) * (1 + rand() * 0.001);
    const low = Math.min(open, close) * (1 - rand() * 0.001);
    return {
      symbol,
      interval,
      open: Math.round(open * 100000) / 100000,
      high: Math.round(high * 100000) / 100000,
      low: Math.round(low * 100000) / 100000,
      close: Math.round(close * 100000) / 100000,
      volume: Math.round(rand() * 10000),
      timestamp: now - (count - i) * step,
    };
  });
}

export async function fetchCandles(symbol: string, interval: string): Promise<Candle[]> {
  const redis = getRedis();
  const cacheKey = `candles:${symbol}:${interval}`;

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached as Candle[];
  }

  const key = process.env.FINNHUB_API_KEY;
  if (key) {
    const resMap: Record<string, string> = {
      "1m": "1",
      "5m": "5",
      "15m": "15",
      "30m": "30",
      "1h": "60",
      "4h": "240",
      "1d": "D",
    };
    const res = resMap[interval] ?? "5";

    try {
      const resFetch = await fetch(
        `https://finnhub.io/api/v1/indicator?symbol=${symbol}&resolution=${res}&indicator=ema&timeperiod=20&apikey=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await resFetch.json();
      if (data.s === "ok") {
        const candles: Candle[] = data.t?.map((t: number, i: number) => ({
          symbol,
          interval,
          open: data.o?.[i] ?? 0,
          high: data.h?.[i] ?? 0,
          low: data.l?.[i] ?? 0,
          close: data.c?.[i] ?? 0,
          volume: data.v?.[i] ?? 0,
          timestamp: t * 1000,
        })) ?? [];

        if (redis && candles.length) {
          await redis.setex(cacheKey, CACHE_TTL.candles, JSON.stringify(candles));
        }
        return candles;
      }
    } catch (e) {
      console.warn("[market-data] candle fetch failed, using simulator:", e);
    }
  }

  return simulateCandles(symbol, interval);
}

export async function fetchNews(): Promise<NewsItem[]> {
  const redis = getRedis();
  const cacheKey = "news:latest";

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached as NewsItem[];
  }

  // Paid source first (NewsAPI)
  const key = process.env.NEWSAPI_KEY;
  if (key) {
    try {
      const res = await fetch(
        `https://newsapi.org/v2/everything?q=forex+trading+gold+bitcoin&language=en&pageSize=50&apiKey=${key}`,
        { signal: AbortSignal.timeout(10000) }
      );
      const data = await res.json();
      if (data.status === "ok" && data.articles?.length) {
        const news: NewsItem[] = data.articles.map((a: any) => ({
          title: a.title,
          summary: a.description ?? "",
          url: a.url,
          source: a.source.name,
          publishedAt: a.publishedAt,
          symbols: extractSymbols(a.title + " " + a.description),
        }));
        if (redis) await redis.setex(cacheKey, CACHE_TTL.news, JSON.stringify(news));
        return news;
      }
    } catch (e) {
      console.warn("[market-data] newsapi failed, falling back to Google News:", e);
    }
  }

  // Free fallback — Google News RSS (no key)
  return fetchGoogleNews();
}

// Google News RSS — free, no key. Parses XML items with regex (no extra deps).
export async function fetchGoogleNews(): Promise<NewsItem[]> {
  const redis = getRedis();
  const cacheKey = "news:google";

  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) return cached as NewsItem[];
  }

  const queries = ["forex market", "gold price OR federal reserve", "bitcoin crypto market"];
  const news: NewsItem[] = [];

  for (const q of queries) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-US&gl=US&ceid=US:en`;
      const res = await fetch(url, {
        signal: AbortSignal.timeout(10000),
        headers: { "User-Agent": "Mozilla/5.0 (compatible; Loopader/1.0)" },
      });
      if (!res.ok) continue;
      const xml = await res.text();

      const items = xml.split("<item>").slice(1);
      for (const item of items.slice(0, 20)) {
        const title = decodeXml(item.match(/<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/)?.[1] ?? "");
        const link = decodeXml(item.match(/<link>(.*?)<\/link>/)?.[1] ?? "");
        const pub = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? new Date().toUTCString();
        const source = decodeXml(item.match(/<source[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/source>/)?.[1] ?? "Google News");
        const desc = stripHtml(decodeXml(item.match(/<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/)?.[1] ?? "")).slice(0, 300);
        if (!title || !link) continue;
        news.push({
          title,
          summary: desc,
          url: link,
          source,
          publishedAt: new Date(pub).toISOString(),
          symbols: extractSymbols(title + " " + desc),
        });
      }
    } catch (e) {
      console.warn("[market-data] google news query failed:", e instanceof Error ? e.message.slice(0, 80) : e);
    }
  }

  // dedupe by title, sort newest first
  const seen = new Set<string>();
  const unique = news.filter(n => {
    const k = n.title.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : -1)).slice(0, 45);

  if (redis && unique.length) {
    await redis.setex(cacheKey, CACHE_TTL.news, JSON.stringify(unique));
  }
  return unique;
}

function decodeXml(s: string): string {
  return s
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d)));
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, "");
}

function extractSymbols(text: string): string[] {
  const t = text.toUpperCase();
  const matches: string[] = [];
  const keywords: Array<[string, string]> = [
    ["FED", "US30"], ["FEDERAL RESERVE", "US30"], ["POWELL", "US30"],
    ["GOLD", "XAUUSD"], ["BULLION", "XAUUSD"],
    ["SILVER", "XAGUSD"],
    ["OIL", "USOIL"], ["CRUDE", "USOIL"], ["OPEC", "USOIL"], ["WTI", "USOIL"], ["BRENT", "UKOIL"],
    ["BITCOIN", "BTCUSD"], ["BTC", "BTCUSD"],
    ["ETHEREUM", "ETHUSD"], ["ETH", "ETHUSD"],
    ["SOLANA", "SOLUSD"], ["XRP", "XRPUSD"], ["DOGECOIN", "DOGEUSD"],
    ["NASDAQ", "NAS100"], ["S&P", "SPX500"], ["S&P 500", "SPX500"], ["DOW", "US30"],
    ["DAX", "DAX40"], ["FTSE", "FTSE100"], ["NIKKEI", "NIKKEI225"],
    ["APPLE", "AAPL"], ["TESLA", "TSLA"], ["NVIDIA", "NVDA"], ["AMAZON", "AMZN"],
    ["GOOGLE", "GOOGL"], ["MICROSOFT", "MSFT"], ["META", "META"],
    ["DOLLAR", "EURUSD"], ["EURO", "EURUSD"], ["ECB", "EURUSD"],
    ["POUND", "GBPUSD"], ["STERLING", "GBPUSD"], ["BANK OF ENGLAND", "GBPUSD"],
    ["YEN", "USDJPY"], ["BOJ", "USDJPY"], ["RUPEE", "USDPKR"], ["PKR", "USDPKR"],
    ["INFLATION", "EURUSD"], ["CPI", "US30"], ["NFP", "EURUSD"], ["JOBS REPORT", "US30"],
  ];
  for (const [kw, sym] of keywords) {
    if (t.includes(kw) && !matches.includes(sym)) matches.push(sym);
  }
  // direct symbol mentions
  for (const p of ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "ETHUSD", "USOIL"]) {
    if (t.includes(p) && !matches.includes(p)) matches.push(p);
  }
  return matches.slice(0, 5);
}

const BULLISH_WORDS = ["bullish", "surge", "rally", "gain", "rise", "up", "high", "strong", "buy", "optimistic", "recovery", "breakout"];
const BEARISH_WORDS = ["bearish", "fall", "drop", "decline", "crash", "down", "low", "weak", "sell", "pessimistic", "recession", "breakdown"];

export async function computeSentiment(symbols: string[]): Promise<SentimentScore[]> {
  const redis = getRedis();
  const results: SentimentScore[] = [];

  for (const symbol of symbols) {
    const cacheKey = `sentiment:${symbol}`;
    if (redis) {
      const cached = await redis.get(cacheKey);
      if (cached) {
        results.push(cached as SentimentScore);
        continue;
      }
    }

    const news = await fetchNews();
    const relevant = news.filter((n) => n.symbols.includes(symbol));
    let score = 0;
    let count = 0;

    for (const item of relevant) {
      const text = (item.title + " " + item.summary).toLowerCase();
      let s = 0;
      for (const w of BULLISH_WORDS) if (text.includes(w)) s += 1;
      for (const w of BEARISH_WORDS) if (text.includes(w)) s -= 1;
      score += Math.max(-10, Math.min(10, s));
      count++;
    }

    const finalScore = count > 0 ? Math.round((score / count) * 10) : 0;
    const clamped = Math.max(-100, Math.min(100, finalScore));

    const result: SentimentScore = {
      symbol,
      score: clamped,
      sourceCount: count,
      computedAt: Date.now(),
    };

    if (redis) {
      await redis.setex(cacheKey, CACHE_TTL.sentiment, JSON.stringify(result));
    }
    results.push(result);
  }

  return results;
}


