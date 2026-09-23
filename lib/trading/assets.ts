export type AssetClass = "forex" | "commodity" | "index" | "stock" | "crypto";

export interface AssetInfo {
  symbol: string;
  name: string;
  class: AssetClass;
  exchange?: string;
  contractSize: number;
  pipValue: number;
  pipDecimals: number;
  minVolume: number;
  maxVolume: number;
  stepVolume: number;
  marginCurrency: string;
  description: string;
  popular?: boolean;
}

const fx = (symbol: string, name: string, opts: Partial<AssetInfo> = {}): AssetInfo => ({
  symbol, name, class: "forex", contractSize: 100000,
  pipValue: symbol.endsWith("JPY") ? 0.01 : 0.0001,
  pipDecimals: symbol.endsWith("JPY") ? 3 : 5,
  minVolume: 0.01, maxVolume: 100, stepVolume: 0.01,
  marginCurrency: symbol.slice(3), description: "",
  ...opts,
});

const cm = (symbol: string, name: string, contractSize: number, pipValue: number, pipDecimals: number, opts: Partial<AssetInfo> = {}): AssetInfo => ({
  symbol, name, class: "commodity", contractSize, pipValue, pipDecimals,
  minVolume: 0.01, maxVolume: 50, stepVolume: 0.01, marginCurrency: "USD", description: "",
  ...opts,
});

const idx = (symbol: string, name: string, opts: Partial<AssetInfo> = {}): AssetInfo => ({
  symbol, name, class: "index", contractSize: 1, pipValue: 0.1, pipDecimals: 1,
  minVolume: 0.1, maxVolume: 100, stepVolume: 0.1, marginCurrency: "USD", description: "",
  ...opts,
});

const cr = (symbol: string, name: string, price: number, opts: Partial<AssetInfo> = {}): AssetInfo => ({
  symbol, name, class: "crypto", contractSize: 1,
  pipValue: price > 10000 ? 0.1 : price > 100 ? 0.01 : price > 1 ? 0.001 : 0.00001,
  pipDecimals: price > 10000 ? 1 : price > 100 ? 2 : price > 1 ? 4 : 6,
  minVolume: price > 1000 ? 0.01 : 0.1, maxVolume: price > 1000 ? 50 : 1000, stepVolume: 0.01,
  marginCurrency: "USD", description: "", ...opts,
});

const st = (symbol: string, name: string, exchange: string, description: string, opts: Partial<AssetInfo> = {}): AssetInfo => ({
  symbol, name, class: "stock", exchange, contractSize: 1, pipValue: 0.01, pipDecimals: 2,
  minVolume: 0.1, maxVolume: 10000, stepVolume: 0.1, marginCurrency: "USD", description, ...opts,
});

export const ASSETS: Record<string, AssetInfo> = {
  // ══════════ FOREX — MAJORS ══════════
  EURUSD: fx("EURUSD", "Euro / US Dollar", { description: "Most traded pair globally", popular: true }),
  GBPUSD: fx("GBPUSD", "British Pound / US Dollar", { description: "The Cable — 2nd most traded", popular: true }),
  USDJPY: fx("USDJPY", "US Dollar / Japanese Yen", { description: "Yen pair, risk-sentiment sensitive", popular: true }),
  USDCHF: fx("USDCHF", "US Dollar / Swiss Franc", { description: "Safe-haven pair", popular: true }),
  USDCAD: fx("USDCAD", "US Dollar / Canadian Dollar", { description: "The Loonie — oil-linked", popular: true }),
  AUDUSD: fx("AUDUSD", "Australian Dollar / US Dollar", { description: "The Aussie — commodity currency", popular: true }),
  NZDUSD: fx("NZDUSD", "New Zealand Dollar / US Dollar", { description: "The Kiwi", popular: true }),

  // ══════════ FOREX — CROSSES ══════════
  EURGBP: fx("EURGBP", "Euro / British Pound", { description: "Euro-Zone vs UK", popular: true }),
  EURJPY: fx("EURJPY", "Euro / Japanese Yen", { description: "Popular carry cross", popular: true }),
  EURCHF: fx("EURCHF", "Euro / Swiss Franc"),
  EURAUD: fx("EURAUD", "Euro / Australian Dollar"),
  EURCAD: fx("EURCAD", "Euro / Canadian Dollar"),
  EURNZD: fx("EURNZD", "Euro / New Zealand Dollar"),
  GBPJPY: fx("GBPJPY", "British Pound / Japanese Yen", { description: "The Dragon — most volatile major cross", popular: true }),
  GBPCHF: fx("GBPCHF", "British Pound / Swiss Franc"),
  GBPAUD: fx("GBPAUD", "British Pound / Australian Dollar"),
  GBPCAD: fx("GBPCAD", "British Pound / Canadian Dollar"),
  GBPNZD: fx("GBPNZD", "British Pound / New Zealand Dollar"),
  AUDJPY: fx("AUDJPY", "Australian Dollar / Japanese Yen"),
  AUDCHF: fx("AUDCHF", "Australian Dollar / Swiss Franc"),
  AUDCAD: fx("AUDCAD", "Australian Dollar / Canadian Dollar"),
  AUDNZD: fx("AUDNZD", "Australian Dollar / New Zealand Dollar"),
  NZDJPY: fx("NZDJPY", "New Zealand Dollar / Japanese Yen"),
  NZDCHF: fx("NZDCHF", "New Zealand Dollar / Swiss Franc"),
  NZDCAD: fx("NZDCAD", "New Zealand Dollar / Canadian Dollar"),
  CADJPY: fx("CADJPY", "Canadian Dollar / Japanese Yen"),
  CADCHF: fx("CADCHF", "Canadian Dollar / Swiss Franc"),
  CHFJPY: fx("CHFJPY", "Swiss Franc / Japanese Yen"),

  // ══════════ FOREX — EXOTICS (Asia, ME, Africa, LatAm, EM Europe) ══════════
  USDPKR: fx("USDPKR", "US Dollar / Pakistani Rupee", { description: "Pakistan Rupee", pipDecimals: 4, popular: true }),
  USDINR: fx("USDINR", "US Dollar / Indian Rupee", { description: "Indian Rupee", pipDecimals: 4 }),
  USDBDT: fx("USDBDT", "US Dollar / Bangladeshi Taka", { description: "Bangladesh Taka", pipDecimals: 4 }),
  USDLKR: fx("USDLKR", "US Dollar / Sri Lankan Rupee", { description: "Sri Lanka Rupee", pipDecimals: 4 }),
  USDAED: fx("USDAED", "US Dollar / UAE Dirham", { description: "Gulf currency", pipDecimals: 4, popular: true }),
  USDSAR: fx("USDSAR", "US Dollar / Saudi Riyal", { description: "Gulf currency", pipDecimals: 4, popular: true }),
  USDQAR: fx("USDQAR", "US Dollar / Qatari Riyal", { pipDecimals: 4 }),
  USDKWD: fx("USDKWD", "US Dollar / Kuwaiti Dinar", { pipDecimals: 4 }),
  USDBHD: fx("USDBHD", "US Dollar / Bahraini Dinar", { pipDecimals: 4 }),
  USDOMR: fx("USDOMR", "US Dollar / Omani Rial", { pipDecimals: 4 }),
  USDJOD: fx("USDJOD", "US Dollar / Jordanian Dinar", { pipDecimals: 4 }),
  USDILS: fx("USDILS", "US Dollar / Israeli Shekel", { pipDecimals: 4 }),
  USDMYR: fx("USDMYR", "US Dollar / Malaysian Ringgit", { pipDecimals: 4 }),
  USDPHP: fx("USDPHP", "US Dollar / Philippine Peso", { pipDecimals: 4 }),
  USDIDR: fx("USDIDR", "US Dollar / Indonesian Rupiah", { description: "pip = 1 point", pipValue: 1, pipDecimals: 1 }),
  USDTHB: fx("USDTHB", "US Dollar / Thai Baht", { pipDecimals: 4 }),
  USDSGD: fx("USDSGD", "US Dollar / Singapore Dollar", { description: "Asian hub currency" }),
  USDHKD: fx("USDHKD", "US Dollar / Hong Kong Dollar", { pipDecimals: 4 }),
  USDCNH: fx("USDCNH", "US Dollar / Chinese Yuan (offshore)", { description: "Offshore RMB", pipDecimals: 4 }),
  USDTWD: fx("USDTWD", "US Dollar / Taiwan Dollar", { pipDecimals: 4 }),
  USDKRW: fx("USDKRW", "US Dollar / Korean Won", { pipValue: 0.01, pipDecimals: 2 }),
  USDINR_T: undefined as never, // placeholder removed below
  USDMXN: fx("USDMXN", "US Dollar / Mexican Peso", { description: "Most traded EM currency" }),
  USDZAR: fx("USDZAR", "US Dollar / South African Rand", { description: "Gold-linked currency", popular: true }),
  USDTRY: fx("USDTRY", "US Dollar / Turkish Lira"),
  USDSEK: fx("USDSEK", "US Dollar / Swedish Krona"),
  USDNOK: fx("USDNOK", "US Dollar / Norwegian Krone", { description: "Oil-linked" }),
  USDDKK: fx("USDDKK", "US Dollar / Danish Krone"),
  USDPLN: fx("USDPLN", "US Dollar / Polish Zloty"),
  USDHUF: fx("USDHUF", "US Dollar / Hungarian Forint", { pipValue: 0.01, pipDecimals: 3 }),
  USDCZK: fx("USDCZK", "US Dollar / Czech Koruna", { pipValue: 0.001, pipDecimals: 4 }),
  USDBRL: fx("USDBRL", "US Dollar / Brazilian Real"),
  USDCLP: fx("USDCLP", "US Dollar / Chilean Peso", { pipDecimals: 3 }),
  USDCOP: fx("USDCOP", "US Dollar / Colombian Peso", { pipDecimals: 3 }),
  USDEGP: fx("USDEGP", "US Dollar / Egyptian Pound", { pipDecimals: 4 }),
  USDNGN: fx("USDNGN", "US Dollar / Nigerian Naira", { pipValue: 0.01, pipDecimals: 3 }),
  USDAUD: undefined as never, // placeholder removed below
  EURPLN: fx("EURPLN", "Euro / Polish Zloty"),
  EURTRY: fx("EURTRY", "Euro / Turkish Lira"),
  EURSEK: fx("EURSEK", "Euro / Swedish Krona"),
  EURNOK: fx("EURNOK", "Euro / Norwegian Krone"),
  EURHUF: fx("EURHUF", "Euro / Hungarian Forint", { pipValue: 0.01, pipDecimals: 3 }),
  EURCZK: fx("EURCZK", "Euro / Czech Koruna", { pipValue: 0.001, pipDecimals: 4 }),

  // ══════════ COMMODITIES — METALS ══════════
  XAUUSD: cm("XAUUSD", "Gold vs US Dollar", 100, 0.01, 2, { description: "Spot gold — the #1 safe haven", popular: true }),
  XAGEUR: cm("XAGEUR", "Silver vs Euro", 5000, 0.001, 3),
  XAUEUR: cm("XAUEUR", "Gold vs Euro", 100, 0.01, 2),
  XAGUSD: cm("XAGUSD", "Silver vs US Dollar", 5000, 0.001, 3, { description: "Industrial + precious metal", popular: true }),
  XPTUSD: cm("XPTUSD", "Platinum vs US Dollar", 50, 0.01, 2),
  XPDUSD: cm("XPDUSD", "Palladium vs US Dollar", 50, 0.01, 2),
  COPPER: cm("COPPER", "Copper", 25000, 0.0001, 4, { description: "Economic barometer metal" }),

  // ══════════ COMMODITIES — ENERGY ══════════
  USOIL: cm("USOIL", "WTI Crude Oil", 1000, 0.01, 2, { description: "US West Texas Intermediate", popular: true }),
  UKOIL: cm("UKOIL", "Brent Crude Oil", 1000, 0.01, 2, { description: "North Sea Brent", popular: true }),
  NATGAS: cm("NATGAS", "Natural Gas", 10000, 0.001, 3, { description: "Henry Hub futures" }),

  // ══════════ INDICES ══════════
  US30: idx("US30", "Dow Jones 30", { description: "Wall Street blue chips", popular: true }),
  SPX500: idx("SPX500", "S&P 500", { description: "Broad US market", popular: true }),
  NAS100: idx("NAS100", "Nasdaq 100", { description: "US tech giants", popular: true }),
  US2000: idx("US2000", "Russell 2000", { description: "US small caps" }),
  DAX40: idx("DAX40", "DAX 40", { marginCurrency: "EUR", description: "Germany's blue chips", popular: true }),
  FTSE100: idx("FTSE100", "FTSE 100", { marginCurrency: "GBP", description: "UK blue chips", popular: true }),
  CAC40: idx("CAC40", "CAC 40", { marginCurrency: "EUR", description: "France's largest" }),
  IBEX35: idx("IBEX35", "IBEX 35", { marginCurrency: "EUR", description: "Spain's index" }),
  EURO50: idx("EURO50", "Euro Stoxx 50", { marginCurrency: "EUR", description: "Eurozone blue chips" }),
  AEX25: idx("AEX25", "AEX 25", { marginCurrency: "EUR", description: "Netherlands index" }),
  SMI20: idx("SMI20", "Swiss Market Index", { marginCurrency: "CHF" }),
  NIKKEI225: idx("NIKKEI225", "Nikkei 225", { marginCurrency: "JPY", description: "Japan's index", popular: true }),
  ASX200: idx("ASX200", "ASX 200", { marginCurrency: "AUD", description: "Australia's index" }),
  HSI50: idx("HSI50", "Hang Seng Index", { description: "Hong Kong index" }),
  NIFTY50: idx("NIFTY50", "Nifty 50", { description: "India's index", popular: true }),
  SENSEX: idx("SENSEX", "BSE Sensex", { description: "India's oldest index" }),
  TSX60: idx("TSX60", "Canada S&P/TSX 60", { marginCurrency: "CAD" }),
  KOSPI200: idx("KOSPI200", "Korea KOSPI 200"),
  VIX: idx("VIX", "Volatility Index", { description: "The fear gauge" }),

  // ══════════ CRYPTO (25) ══════════
  BTCUSD: cr("BTCUSD", "Bitcoin", 81000, { description: "Digital gold — largest crypto", popular: true }),
  ETHUSD: cr("ETHUSD", "Ethereum", 2520, { description: "Smart-contract leader", popular: true }),
  BNBUSD: cr("BNBUSD", "BNB", 620, { description: "BNB Chain token" }),
  SOLUSD: cr("SOLUSD", "Solana", 104, { description: "High-performance L1", popular: true }),
  XRPUSD: cr("XRPUSD", "XRP", 2.35, { description: "Payments-focused", popular: true }),
  ADAUSD: cr("ADAUSD", "Cardano", 0.78),
  DOGEUSD: cr("DOGEUSD", "Dogecoin", 0.28, { description: "The original meme coin", popular: true }),
  TRXUSD: cr("TRXUSD", "TRON", 0.24),
  LINKUSD: cr("LINKUSD", "Chainlink", 18.5, { description: "Oracle network" }),
  AVAXUSD: cr("AVAXUSD", "Avalanche", 32.0),
  DOTUSD: cr("DOTUSD", "Polkadot", 5.9),
  TONUSD: cr("TONUSD", "Toncoin", 4.9, { description: "Telegram's blockchain" }),
  SHIBUSD: cr("SHIBUSD", "Shiba Inu", 0.0000215, { minVolume: 1000, maxVolume: 10000000, stepVolume: 1000 }),
  PEPEUSD: cr("PEPEUSD", "Pepe", 0.0000088, { minVolume: 1000, maxVolume: 10000000, stepVolume: 1000 }),
  LTCUSD: cr("LTCUSD", "Litecoin", 108, { description: "Digital silver" }),
  ETCUSD: cr("ETCUSD", "Ethereum Classic", 24.5),
  ATOMUSD: cr("ATOMUSD", "Cosmos", 6.4),
  NEARUSD: cr("NEARUSD", "NEAR Protocol", 5.1),
  APTUSD: cr("APTUSD", "Aptos", 8.7),
  ARBUSD: cr("ARBUSD", "Arbitrum", 0.72),
  OPUSD: cr("OPUSD", "Optimism", 1.55),
  SUIUSD: cr("SUIUSD", "Sui", 3.4),
  INJUSD: cr("INJUSD", "Injective", 20.5),
  FILUSD: cr("FILUSD", "Filecoin", 4.6),
  XLMUSD: cr("XLMUSD", "Stellar", 0.38),
  HBARUSD: cr("HBARUSD", "Hedera", 0.24),
  UNIUSD: cr("UNIUSD", "Uniswap", 11.2, { description: "Top DEX token" }),

  // ══════════ US STOCKS (45) ══════════
  // Tech
  AAPL: st("AAPL", "Apple Inc.", "NASDAQ", "iPhone, Mac, services", { popular: true }),
  MSFT: st("MSFT", "Microsoft Corp.", "NASDAQ", "Windows, Azure, Office", { popular: true }),
  GOOGL: st("GOOGL", "Alphabet Inc.", "NASDAQ", "Google, YouTube, Cloud", { popular: true }),
  AMZN: st("AMZN", "Amazon.com Inc.", "NASDAQ", "E-commerce + AWS", { popular: true }),
  META: st("META", "Meta Platforms", "NASDAQ", "Facebook, Instagram, WhatsApp", { popular: true }),
  TSLA: st("TSLA", "Tesla Inc.", "NASDAQ", "EVs, energy, AI", { popular: true }),
  NVDA: st("NVDA", "NVIDIA Corp.", "NASDAQ", "AI & GPU leader", { popular: true }),
  AMD: st("AMD", "Advanced Micro Devices", "NASDAQ", "CPU/GPU competitor"),
  INTC: st("INTC", "Intel Corp.", "NASDAQ", "Semiconductor veteran"),
  NFLX: st("NFLX", "Netflix Inc.", "NASDAQ", "Streaming"),
  ADBE: st("ADBE", "Adobe Inc.", "NASDAQ", "Creative software"),
  CRM: st("CRM", "Salesforce Inc.", "NYSE", "Enterprise SaaS"),
  ORCL: st("ORCL", "Oracle Corp.", "NYSE", "Database & cloud"),
  UBER: st("UBER", "Uber Technologies", "NYSE", "Ride-hailing, delivery"),
  ABNB: st("ABNB", "Airbnb Inc.", "NASDAQ", "Travel marketplace"),
  PLTR: st("PLTR", "Palantir Technologies", "NASDAQ", "AI data analytics", { popular: true }),
  COIN: st("COIN", "Coinbase Global", "NASDAQ", "Crypto exchange", { popular: true }),
  SHOP: st("SHOP", "Shopify Inc.", "NYSE", "E-commerce platform"),
  // Finance
  JPM: st("JPM", "JPMorgan Chase", "NYSE", "Largest US bank"),
  BAC: st("BAC", "Bank of America", "NYSE", "Consumer banking"),
  GS: st("GS", "Goldman Sachs", "NYSE", "Investment banking"),
  MS: st("MS", "Morgan Stanley", "NYSE", "Wealth management"),
  V: st("V", "Visa Inc.", "NYSE", "Payments network"),
  MA: st("MA", "Mastercard Inc.", "NYSE", "Payments network"),
  PYPL: st("PYPL", "PayPal Holdings", "NASDAQ", "Digital payments"),
  // Consumer
  KO: st("KO", "Coca-Cola Co.", "NYSE", "Beverage giant"),
  PEP: st("PEP", "PepsiCo Inc.", "NASDAQ", "Food & beverage"),
  MCD: st("MCD", "McDonald's Corp.", "NYSE", "Global fast food"),
  SBUX: st("SBUX", "Starbucks Corp.", "NASDAQ", "Coffee chain"),
  NKE: st("NKE", "Nike Inc.", "NYSE", "Sportswear"),
  DIS: st("DIS", "Walt Disney Co.", "NYSE", "Entertainment"),
  WMT: st("WMT", "Walmart Inc.", "NYSE", "Retail giant"),
  COST: st("COST", "Costco Wholesale", "NASDAQ", "Warehouse retail"),
  PG: st("PG", "Procter & Gamble", "NYSE", "Consumer staples"),
  // Health
  JNJ: st("JNJ", "Johnson & Johnson", "NYSE", "Pharma & devices"),
  PFE: st("PFE", "Pfizer Inc.", "NYSE", "Pharmaceuticals"),
  UNH: st("UNH", "UnitedHealth Group", "NYSE", "Health insurance"),
  LLY: st("LLY", "Eli Lilly & Co.", "NYSE", "Pharma — GLP-1 leader", { popular: true }),
  MRK: st("MRK", "Merck & Co.", "NYSE", "Pharmaceuticals"),
  // Energy & Industrial
  XOM: st("XOM", "Exxon Mobil Corp.", "NYSE", "Oil supermajor"),
  CVX: st("CVX", "Chevron Corp.", "NYSE", "Oil supermajor"),
  BA: st("BA", "Boeing Co.", "NYSE", "Aerospace"),
  CAT: st("CAT", "Caterpillar Inc.", "NYSE", "Heavy machinery"),
  T: st("T", "AT&T Inc.", "NYSE", "Telecom"),
};

// remove placeholder keys
delete (ASSETS as any).USDINR_T;
delete (ASSETS as any).USDAUD;

export function getAsset(symbol: string): AssetInfo | undefined {
  return ASSETS[symbol.toUpperCase()];
}

export function getAssetsByClass(cls: AssetClass): AssetInfo[] {
  return Object.values(ASSETS).filter(a => a.class === cls);
}

export function getPopularAssets(): AssetInfo[] {
  return Object.values(ASSETS).filter(a => a.popular);
}

export function getPipValue(symbol: string): number {
  return getAsset(symbol)?.pipValue ?? 0.0001;
}

export function getContractSize(symbol: string): number {
  return getAsset(symbol)?.contractSize ?? 100000;
}

export function validateVolume(symbol: string, volume: number): { valid: boolean; message?: string } {
  const asset = getAsset(symbol);
  if (!asset) return { valid: false, message: "Unknown symbol" };
  if (volume < asset.minVolume) return { valid: false, message: `Minimum volume for ${symbol} is ${asset.minVolume}` };
  if (volume > asset.maxVolume) return { valid: false, message: `Maximum volume for ${symbol} is ${asset.maxVolume}` };
  return { valid: true };
}

export const ALL_SYMBOLS = Object.keys(ASSETS);
export const POPULAR_SYMBOLS = getPopularAssets().map(a => a.symbol);