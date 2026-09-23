"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Scan, TrendingUp, TrendingDown, Minus, Loader2, Filter, Zap, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface ScanResult {
  symbol: string;
  price: number;
  change24h: number;
  rsi: number | null;
  rsiSignal: string;
  macdSignal: string;
  bbSignal: string;
  overallSignal: "STRONG_BUY" | "BUY" | "NEUTRAL" | "SELL" | "STRONG_SELL";
  score: number;
}

const SCAN_TYPES = [
  { key: "all", label: "All Signals", icon: Scan },
  { key: "oversold", label: "RSI Oversold", icon: TrendingUp },
  { key: "overbought", label: "RSI Overbought", icon: TrendingDown },
  { key: "macd_bull", label: "MACD Bullish", icon: Zap },
  { key: "macd_bear", label: "MACD Bearish", icon: TrendingDown },
];

const CLASSES = [
  { key: "", label: "All Markets" },
  { key: "forex", label: "Forex" },
  { key: "crypto", label: "Crypto" },
  { key: "commodity", label: "Commodities" },
  { key: "index", label: "Indices" },
  { key: "stock", label: "Stocks" },
];

const SIGNAL_COLORS: Record<string, string> = {
  STRONG_BUY: "bg-green-500/20 text-green-500 border-green-500/30",
  BUY: "bg-green-500/10 text-green-400 border-green-500/20",
  NEUTRAL: "bg-muted text-muted-foreground border-border",
  SELL: "bg-red-500/10 text-red-400 border-red-500/20",
  STRONG_SELL: "bg-red-500/20 text-red-500 border-red-500/30",
};

export default function ScannerPage() {
  const [results, setResults] = useState<ScanResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanType, setScanType] = useState("all");
  const [assetClass, setAssetClass] = useState("");
  const [scanned, setScanned] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);

  const runScan = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type: scanType });
    if (assetClass) params.set("class", assetClass);
    try {
      const res = await fetch(`/api/scanner?${params.toString()}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setScanned(data.scanned ?? 0);
      setLastScan(data.timestamp);
    } catch {} finally { setLoading(false); }
  }, [scanType, assetClass]);

  useEffect(() => { runScan(); }, [runScan]);

  const strongBuys = results.filter(r => r.overallSignal.includes("BUY")).length;
  const strongSells = results.filter(r => r.overallSignal.includes("SELL")).length;
  const neutral = results.filter(r => r.overallSignal === "NEUTRAL").length;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Scan className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Market Scanner</h1>
            <p className="text-sm text-muted-foreground">Scan 169 instruments for RSI, MACD & Bollinger signals</p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-green-500">{strongBuys}</p>
            <p className="text-xs text-muted-foreground">Bullish Signals</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-xl p-3 text-center">
            <p className="text-2xl font-bold">{neutral}</p>
            <p className="text-xs text-muted-foreground">Neutral</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-500">{strongSells}</p>
            <p className="text-xs text-muted-foreground">Bearish Signals</p>
          </div>
        </div>

        {/* Filters */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {SCAN_TYPES.map(t => (
              <button
                key={t.key}
                onClick={() => setScanType(t.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                  scanType === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {CLASSES.map(c => (
              <button
                key={c.key}
                onClick={() => setAssetClass(c.key)}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-medium transition-colors",
                  assetClass === c.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                )}
              >
                {c.label}
              </button>
            ))}
            <button onClick={runScan} className="px-3 py-1 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 flex items-center gap-1">
              <Filter className="w-3 h-3" /> Re-scan
            </button>
          </div>
          {lastScan && (
            <p className="text-xs text-muted-foreground">
              Scanned {scanned} instruments · {results.length} matches · Last scan: {new Date(lastScan).toLocaleTimeString()}
            </p>
          )}
        </div>

        {/* Results */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">Scanning markets…</span>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Scan className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p className="text-lg font-medium">No matching signals</p>
            <p className="text-sm">Try a different filter or scan type</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map((r, i) => (
              <motion.div
                key={r.symbol}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.02 }}
                className={cn(
                  "bg-card border rounded-xl p-4 flex items-center justify-between gap-3 hover:border-primary/30 transition-colors",
                  r.overallSignal.includes("BUY") ? "border-green-500/20" : r.overallSignal.includes("SELL") ? "border-red-500/20" : "border-border"
                )}
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className={cn(
                    "w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 border",
                    SIGNAL_COLORS[r.overallSignal]
                  )}>
                    {r.overallSignal.includes("BUY") ? <TrendingUp className="w-5 h-5" /> :
                     r.overallSignal.includes("SELL") ? <TrendingDown className="w-5 h-5" /> :
                     <Minus className="w-5 h-5" />}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm">{r.symbol}</span>
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-[10px] font-bold",
                        SIGNAL_COLORS[r.overallSignal]
                      )}>
                        {r.overallSignal.replace("_", " ")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                      <span className="font-mono">${r.price >= 1000 ? r.price.toLocaleString() : r.price.toFixed(5)}</span>
                      <span className={r.change24h >= 0 ? "text-green-500" : "text-red-500"}>
                        {r.change24h >= 0 ? "+" : ""}{r.change24h?.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-4 text-xs">
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">RSI</p>
                    <p className={cn(
                      "font-mono font-bold",
                      r.rsi !== null && r.rsi < 30 ? "text-green-500" :
                      r.rsi !== null && r.rsi > 70 ? "text-red-500" : "text-foreground"
                    )}>
                      {r.rsi ?? "—"}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">MACD</p>
                    <p className={cn("font-mono font-bold", r.macdSignal === "BULLISH" ? "text-green-500" : r.macdSignal === "BEARISH" ? "text-red-500" : "")}>
                      {r.macdSignal.slice(0, 4)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">BB</p>
                    <p className="font-mono">{r.bbSignal.slice(0, 4)}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-muted-foreground text-[10px]">Score</p>
                    <p className={cn("font-mono font-bold", r.score > 0 ? "text-green-500" : r.score < 0 ? "text-red-500" : "")}>
                      {r.score > 0 ? "+" : ""}{r.score}
                    </p>
                  </div>
                  <a href="/trade" className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20">
                    <ArrowRight className="w-4 h-4" />
                  </a>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}