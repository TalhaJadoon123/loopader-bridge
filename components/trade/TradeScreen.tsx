"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Calculator, TrendingUp, TrendingDown, Zap, Shield, Loader2, Info, Crosshair } from "lucide-react";
import { TradingChart } from "@/components/charts/TradingChart";
import { Tooltip } from "@/components/ui/Tooltip";
import { sounds } from "@/lib/sounds";
import { cn } from "@/lib/utils";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "US30", "USOIL", "SPX500"];
const VOLUME_QUICK = [0.01, 0.1, 0.5, 1.0];

interface Quote { symbol: string; price: number; change: number; changePercent: number; delayed?: boolean }

export function TradeScreen() {
  const [symbol, setSymbol] = useState("EURUSD");
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [volume, setVolume] = useState(0.1);
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [autoSLTP, setAutoSLTP] = useState(true);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [loading, setLoading] = useState(false);
  const [balance, setBalance] = useState<number | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/quotes?symbols=${SYMBOLS.join(",")}`);
      const data = await res.json();
      setQuotes(prev => {
        const next = { ...prev };
        (data.quotes ?? []).forEach((q: Quote) => { next[q.symbol] = q; });
        return next;
      });
    } catch {}
  }, []);

  const fetchBalance = useCallback(async () => {
    try {
      const res = await fetch("/api/account/summary?type=LIVE").then(r => r.ok ? r : null)
        .then(live => live ?? fetch("/api/account/summary?type=DEMO"));
      if (res.ok) setBalance((await res.json()).balance);
    } catch {}
  }, []);

  useEffect(() => {
    fetchQuotes();
    fetchBalance();
    const id = setInterval(fetchQuotes, 4000);
    return () => clearInterval(id);
  }, [fetchQuotes, fetchBalance]);

  const quote = quotes[symbol];
  const price = quote?.price ?? 0;
  const pipValue = symbol.endsWith("JPY") || symbol === "XAUUSD" || symbol === "BTCUSD" ? 0.01 : 0.0001;
  const spread = 0.8;
  const bid = price - (spread * pipValue) / 2;
  const ask = price + (spread * pipValue) / 2;
  const execPrice = side === "BUY" ? ask : bid;

  // Risk preview: $ at risk = volume * contract * SL distance
  const slNum = parseFloat(stopLoss);
  const riskAmount = slNum && volume
    ? Math.abs(execPrice - slNum) * volume * (symbol.includes("XAU") ? 100 : 100000)
    : null;
  const riskPct = riskAmount !== null && balance ? (riskAmount / balance) * 100 : null;

  const handleTrade = async () => {
    if (loading || !price) return;
    setLoading(true);
    try {
      const res = await fetch("/api/trade/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          side,
          volume,
          stopLoss: stopLoss ? parseFloat(stopLoss) : undefined,
          takeProfit: takeProfit ? parseFloat(takeProfit) : undefined,
          idempotencyKey: `${symbol}-${side}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (side === "BUY") sounds.buy(); else sounds.sell();
        setToast({ ok: true, msg: `${side} ${volume} ${symbol} filled @ ${data.trade?.openPrice?.toFixed(5) ?? execPrice.toFixed(5)}` });
        setStopLoss("");
        setTakeProfit("");
        fetchBalance();
      } else {
        sounds.error();
        setToast({ ok: false, msg: data.error ?? "Order rejected" });
      }
    } catch {
      sounds.error();
      setToast({ ok: false, msg: "Network error" });
    } finally {
      setLoading(false);
      setTimeout(() => setToast(null), 4000);
    }
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* Symbol strip */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SYMBOLS.map(s => {
          const q = quotes[s];
          const up = (q?.changePercent ?? 0) >= 0;
          return (
            <button
              key={s}
              onClick={() => setSymbol(s)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono whitespace-nowrap transition-all",
                symbol === s
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-primary/40"
              )}
            >
              <span className="font-semibold">{s}</span>
              {q && (
                <span className={cn("text-xs font-medium", up ? "text-up" : "text-down")}>
                  {up ? "▲" : "▼"} {Math.abs(q.changePercent).toFixed(2)}%
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Chart */}
        <div className="lg:col-span-3 bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-baseline gap-3">
              <h2 className="font-bold font-mono">{symbol}</h2>
              <span className={cn("text-lg font-mono font-bold", (quote?.changePercent ?? 0) >= 0 ? "text-up" : "text-down")}>
                {price.toFixed(pipValue === 0.01 && symbol !== "XAUUSD" ? 3 : 5)}
              </span>
              {quote && (
                <span className={cn("text-xs font-medium px-1.5 py-0.5 rounded", quote.changePercent >= 0 ? "text-up bg-up/10" : "text-down bg-down/10")}>
                  {quote.changePercent >= 0 ? "+" : ""}{quote.changePercent.toFixed(2)}%
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Crosshair className="w-3.5 h-3.5" />
              <span>Spread {spread.toFixed(1)} pips</span>
            </div>
          </div>
          <TradingChart symbol={symbol} interval="5m" height={480} indicators={["EMA"]} />
        </div>

        {/* Order panel */}
        <div className="space-y-3">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Buy/Sell price header */}
            <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
              <button
                onClick={() => setSide("SELL")}
                className={cn("p-3 text-left transition-colors", side === "SELL" ? "bg-down/15" : "hover:bg-secondary/50")}
              >
                <div className="flex items-center gap-1 text-xs text-down font-semibold mb-0.5">
                  <TrendingDown className="w-3 h-3" /> SELL
                </div>
                <div className="font-mono font-bold text-down">{bid.toFixed(5)}</div>
              </button>
              <button
                onClick={() => setSide("BUY")}
                className={cn("p-3 text-right transition-colors", side === "BUY" ? "bg-up/15" : "hover:bg-secondary/50")}
              >
                <div className="flex items-center justify-end gap-1 text-xs text-up font-semibold mb-0.5">
                  BUY <TrendingUp className="w-3 h-3" />
                </div>
                <div className="font-mono font-bold text-up">{ask.toFixed(5)}</div>
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Volume */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-muted-foreground">Volume (lots)</label>
                  <Tooltip content="1 standard lot = 100,000 units. 0.01 = micro lot."><Info className="w-3.5 h-3.5 text-muted-foreground cursor-help" /></Tooltip>
                </div>
                <div className="grid grid-cols-4 gap-1.5 mb-2">
                  {VOLUME_QUICK.map(v => (
                    <button
                      key={v}
                      onClick={() => setVolume(v)}
                      className={cn(
                        "py-1.5 rounded-md text-xs font-mono font-semibold transition-colors",
                        volume === v ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                      )}
                    >
                      {v}
                    </button>
                  ))}
                </div>
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={volume}
                  onChange={e => setVolume(parseFloat(e.target.value) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Auto SL/TP toggle */}
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-xs font-medium text-muted-foreground">Auto SL/TP (ATR)</span>
                <input
                  type="checkbox"
                  checked={autoSLTP}
                  onChange={e => setAutoSLTP(e.target.checked)}
                  className="rounded accent-primary"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Stop Loss</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={stopLoss}
                    onChange={e => setStopLoss(e.target.value)}
                    placeholder={autoSLTP ? "Auto (ATR)" : "—"}
                    className="w-full px-2.5 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Take Profit</label>
                  <input
                    type="number"
                    step="0.00001"
                    value={takeProfit}
                    onChange={e => setTakeProfit(e.target.value)}
                    placeholder={autoSLTP ? "Auto (ATR)" : "—"}
                    className="w-full px-2.5 py-2 rounded-lg bg-input border border-border text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/50"
                  />
                </div>
              </div>

              {/* Risk preview — BEFORE clicking */}
              <div className="rounded-lg bg-secondary/60 border border-border p-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Calculator className="w-3 h-3" /> Risk Preview
                  </span>
                  <span className="text-[10px] text-muted-foreground">before you click</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className={cn("text-lg font-bold font-mono", riskPct && riskPct > 2 ? "text-down" : "text-up")}>
                    {riskAmount !== null ? `$${riskAmount.toFixed(2)}` : "set SL"}
                  </span>
                  {riskPct !== null && (
                    <span className={cn("text-xs font-mono", riskPct > 2 ? "text-down" : "text-muted-foreground")}>
                      {riskPct.toFixed(2)}% of balance
                    </span>
                  )}
                </div>
                {riskPct !== null && riskPct > 2 && (
                  <p className="text-[10px] text-down mt-1">⚠ Above the recommended 2% max risk</p>
                )}
              </div>

              {/* Execute */}
              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={handleTrade}
                disabled={loading || volume <= 0 || !price}
                className={cn(
                  "w-full py-3 rounded-lg font-bold text-base text-white transition-all flex items-center justify-center gap-2",
                  side === "BUY" ? "bg-up hover:bg-up/90 shadow-lg shadow-up/20" : "bg-down hover:bg-down/90 shadow-lg shadow-down/20",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    {side} {volume.toFixed(2)} @ {execPrice.toFixed(5)}
                  </>
                )}
              </motion.button>

              <div className="flex items-center justify-between text-[10px] text-muted-foreground px-1">
                <span className="flex items-center gap-1"><Shield className="w-3 h-3 text-up" /> Passkey protected</span>
                <span>Balance: <span className="font-mono">{balance !== null ? `$${balance.toLocaleString()}` : "—"}</span></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl text-sm font-medium",
            toast.ok
              ? "bg-up/10 border-up/30 text-up backdrop-blur"
              : "bg-down/10 border-down/30 text-down backdrop-blur"
          )}
        >
          {toast.ok ? "✓ " : "✕ "}{toast.msg}
        </motion.div>
      )}
    </div>
  );
}