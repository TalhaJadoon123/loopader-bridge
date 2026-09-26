// MetaApi.cloud integration — connects Loopader to real MT5 accounts.
// Free tier: 1 MT5 account, 99 requests/day — enough to launch ($0).
// Get token: https://app.metaapi.cloud → token → copy
// NOTE: SDK imported lazily — it references browser globals at module load.

let apiPromise: Promise<any> | null = null;

async function client(): Promise<any> {
  if (!process.env.METAAPI_TOKEN) {
    throw new Error("METAAPI_TOKEN not configured — MT5 trading disabled");
  }
  if (!apiPromise) {
    apiPromise = (async () => {
      const mod = await import("metaapi.cloud-sdk");
      const MetaApi = (mod as any).default ?? mod;
      return new MetaApi(process.env.METAAPI_TOKEN);
    })();
  }
  return apiPromise;
}

export function isMt5Enabled(): boolean {
  return !!process.env.METAAPI_TOKEN;
}

export interface Mt5ConnectionInfo {
  accountId: string;
  login: string;
  server: string;
  broker: string;
  currency: string;
  balance: number;
  equity: number;
}

// ── Provision a new MT5 account (via MetaApi — creates a real broker account) ──
export async function provisionMt5Account(
  userId: string,
  opts: { server: string; login: string; password: string; accountType?: "real" | "demo" }
) {
  const c = await client();
  const account = await c.metatraderAccountApi.createAccount({
    name: `loopader-${userId.slice(-6)}`,
    type: "cloud" as any,
    login: opts.login,
    password: opts.password,
    server: opts.server,
    region: "new-york",
    magic: 100604,
  } as any);
  await account.deploy();
  await account.waitDeployed();
  await account.waitConnected();
  return account;
}

// ── Connect and get account info ──
export async function getMt5Connection(metaapiId: string) {
  const c = await client();
  const account = await c.metatraderAccountApi.getAccount(metaapiId);
  const connection = account.getRPCConnection();
  await connection.connect();
  await connection.waitSynchronized();
  return connection;
}

export async function getAccountInfo(metaapiId: string) {
  const conn = await getMt5Connection(metaapiId);
  return conn.getAccountInformation();
}

// ── Real MT5 order execution ──
export async function mt5MarketOrder(
  metaapiId: string,
  params: {
    symbol: string;
    side: "BUY" | "SELL";
    volume: number;
    stopLoss?: number;
    takeProfit?: number;
    comment?: string;
  }
) {
  const conn = await getMt5Connection(metaapiId);
  const comment = params.comment ?? "Loopader";
  return params.side === "BUY"
    ? conn.createMarketBuyOrder(params.symbol, params.volume, params.stopLoss, params.takeProfit, { comment })
    : conn.createMarketSellOrder(params.symbol, params.volume, params.stopLoss, params.takeProfit, { comment });
}

export async function mt5ClosePosition(metaapiId: string, positionId: string) {
  const conn = await getMt5Connection(metaapiId);
  return conn.closePosition(positionId, { comment: "Loopader close" } as any);
}

export async function mt5Positions(metaapiId: string) {
  const conn = await getMt5Connection(metaapiId);
  return conn.getPositions();
}

export async function mt5History(metaapiId: string, days = 30) {
  const conn = await getMt5Connection(metaapiId);
  const now = Date.now();
  return conn.getDealsByTimeRange(new Date(now - days * 86400000), new Date(now));
}

export async function mt5ModifySLTP(
  metaapiId: string,
  positionId: string,
  stopLoss?: number,
  takeProfit?: number
) {
  const conn = await getMt5Connection(metaapiId);
  return conn.modifyPosition(positionId, stopLoss, takeProfit);
}

// ── Symbol price quote from the real MT5 server ──
export async function mt5Quote(metaapiId: string, symbol: string) {
  const conn = await getMt5Connection(metaapiId);
  return (conn as any).getSymbolSpecification
    ? (conn as any).getSymbolSpecification(symbol)
    : (conn as any).getSymbolPrice?.(symbol);
}

// ── Available broker servers (for the connect UI dropdown) ──
export const POPULAR_MT5_SERVERS = [
  "Exness-MT5Real", "Exness-MT5Real8", "Exness-MT5Trial8",
  "ICMarketsSC-MT5", "ICMarketsSC-MT5Trial",
  "XMGlobal-MT5 2", "XMGlobal-MT5Trial 2",
  "Deriv-Demo", "FTMO-Demo", "MetaQuotes-Demo",
];
