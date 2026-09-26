"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Wallet, Flame, Clock, Zap, AlertTriangle, Target, Eye, Star, ArrowUpRight, Activity, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { TradingChart } from "@/components/charts/TradingChart";
import { StreakFlame } from "@/components/gamification/StreakFlame";
import { XPBar } from "@/components/gamification/XPBar";
import { BadgeDisplay } from "@/components/gamification/BadgeDisplay";
import { LiveTradingRoom } from "@/components/social/LiveTradingRoom";
import { MarketSessions } from "@/components/dashboard/MarketSessions";
import Link from "next/link";

interface AccountSummary { balance: number; equity: number; margin: number; freeMargin: number; marginLevel: number; unrealizedPnL: number; openPositions: number; type?: string; tier?: string; }
interface StreakData { current: number; longest: number; freezes: number; }
interface Mood { symbol: string; score: number; }
interface XPData { totalXp: number; level: number; title: string; xpInLevel: number; xpForNextLevel: number; }
interface Badge { id: string; code: string; name: string; icon: string; criteria: string; earned: boolean; earnedAt?: string; }
interface Quote { symbol: string; price: number; changePercent: number; }

const WATCHLIST = ["EURUSD", "GBPUSD", "XAUUSD", "BTCUSD", "US30", "USOIL"];

export function DashboardScreen() {
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [mood, setMood] = useState<Mood[]>([]);
  const [xpData, setXpData] = useState<XPData | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [chartSymbol, setChartSymbol] = useState("EURUSD");
  const [chartInterval, setChartInterval] = useState("15m");
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [accRes, streakRes, moodRes, xpRes, badgesRes] = await Promise.all([
        fetch("/api/account/summary?type=LIVE").then(r => r.ok ? r.json() : null).catch(() => null)
          .then(live => live ?? fetch("/api/account/summary?type=DEMO").then(r => r.ok ? r.json() : null).catch(() => null)),
        fetch("/api/gamification/streak").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/market/sentiment?symbols=EURUSD,XAUUSD,BTCUSD").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/gamification/xp").then(r => r.ok ? r.json() : null).catch(() => null),
        fetch("/api/gamification/badges").then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (accRes) setAccount(accRes);
      if (streakRes) setStreak(streakRes);
      if (moodRes) setMood(moodRes.sentiment ?? []);
      if (xpRes) setXpData(xpRes);
      if (badgesRes) setBadges(badgesRes.badges ?? []);
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  const fetchQuotes = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/quotes?symbols=${WATCHLIST.join(",")}`);
      const data = await res.json();
      const map: Record<string, Quote> = {};
      (data.quotes ?? []).forEach((q: Quote) => { map[q.symbol] = q; });
      setQuotes(map);
    } catch {}
  }, []);

  useEffect(() => {
    fetchData();
    fetchQuotes();
    const q = setInterval(fetchQuotes, 5000);
    return () => clearInterval(q);
  }, [fetchData, fetchQuotes]);

  const pnl = account ? account.equity - 10000 : 0;
  const pnlPct = account ? (pnl / 10000) * 100 : 0;

  return (
    <div className="space-y-5">
      {/* Top row: account stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={Wallet}
          label="Balance"
          value={account ? `$${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          sub={account ? `${account.type === "LIVE" ? "Live Account" : "Practice Account"} · ${account.tier}` : ""}
        />
        <StatCard
          icon={pnl >= 0 ? TrendingUp : TrendingDown}
          label="Equity / P&L"
          value={account ? `$${account.equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
          sub={account ? `${pnl >= 0 ? "+" : ""}${pnlPct.toFixed(2)}% all time` : ""}
          accent={pnl >= 0 ? "text-up" : "text-down"}
          pulse={!!account}
        />
        <StatCard
          icon={Flame}
          label="Streak"
          value={streak ? `${streak.current}` : "—"}
          sub={streak ? `days • best ${streak.longest}` : ""}
          accent="text-orange-500"
        />
        <StatCard
          icon={Target}
          label="Margin Level"
          value={account ? `${account.marginLevel.toFixed(0)}%` : "—"}
          sub={account ? `${account.openPositions} open positions` : ""}
          accent={account && account.marginLevel < 100 ? "text-down" : "text-up"}
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        {/* Chart column */}
        <div className="xl:col-span-2 space-y-5">
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-2">
                {WATCHLIST.map(s => (
                  <button
                    key={s}
                    onClick={() => setChartSymbol(s)}
                    className={cn(
                      "px-2.5 py-1 rounded-md text-xs font-mono font-semibold transition-colors",
                      chartSymbol === s ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {["5m", "15m", "1h", "4h"].map(i => (
                  <button
                    key={i}
                    onClick={() => setChartInterval(i)}
                    className={cn("px-2 py-1 rounded text-xs font-medium transition-colors", chartInterval === i ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    {i}
                  </button>
                ))}
              </div>
            </div>
            <TradingChart symbol={chartSymbol} interval={chartInterval} height={400} indicators={["EMA"]} />
          </div>

          {/* Watchlist table */}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-semibold text-sm flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> Watchlist</h3>
              <Link href="/markets" className="text-xs text-primary hover:underline flex items-center">All markets <ChevronRight className="w-3 h-3" /></Link>
            </div>
            <div className="divide-y divide-border/50">
              {WATCHLIST.map(sym => {
                const q = quotes[sym];
                const up = (q?.changePercent ?? 0) >= 0;
                return (
                  <div key={sym} className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors">
                    <button onClick={() => setChartSymbol(sym)} className="flex items-center gap-3">
                      <Star className="w-3.5 h-3.5 text-muted-foreground/40 hover:text-yellow-500 cursor-pointer" />
                      <span className="font-mono font-semibold text-sm">{sym}</span>
                    </button>
                    <div className="flex items-center gap-6 text-sm">
                      <span className="font-mono">{q ? q.price.toFixed(sym.includes("USD") && !sym.includes("X") && !sym.startsWith("US") ? 5 : 2) : "—"}</span>
                      <span className={cn("font-mono font-medium w-20 text-right", up ? "text-up" : "text-down")}>
                        {q ? `${up ? "+" : ""}${q.changePercent.toFixed(2)}%` : "—"}
                      </span>
                      <Link href="/trade" className="text-xs text-primary hover:underline hidden sm:block">Trade</Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right column */}
        <div className="space-y-5">
          {/* Progress */}
          {xpData && (
            <div className="bg-card border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm">Level Progress</h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">{xpData.title}</span>
              </div>
              <XPBar totalXp={xpData.totalXp} level={xpData.level} title={xpData.title} xpInLevel={xpData.xpInLevel} xpForNextLevel={xpData.xpForNextLevel} />
            </div>
          )}

          {/* Market Sessions */}
          <MarketSessions />

          {/* Market Mood */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-yellow-500" /> Market Mood</h3>
            <div className="space-y-2.5">
              {mood.length > 0 ? mood.map(m => <MoodBar key={m.symbol} data={m} />) : (
                <p className="text-xs text-muted-foreground">Sentiment loading…</p>
              )}
            </div>
          </div>

          {/* Badges */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3">Achievements</h3>
            <BadgeDisplay badges={badges} maxVisible={4} />
          </div>

          {/* Risk reminders */}
          <div className="bg-card border border-border rounded-xl p-4">
            <h3 className="font-semibold text-sm mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-yellow-500" /> Risk Rules</h3>
            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> Max 2% risk per trade</li>
              <li className="flex items-center gap-2"><Clock className="w-3 h-3" /> Stop after 3 consecutive losses</li>
              <li className="flex items-center gap-2"><Activity className="w-3 h-3" /> No trading 30min before news</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Live trading room */}
      <div className="bg-card border border-border rounded-xl p-4">
        <LiveTradingRoom />
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, accent, pulse }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-4 relative overflow-hidden"
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <Icon className={cn("w-4 h-4", accent ?? "text-muted-foreground")} />
      </div>
      <p className={cn("text-xl font-bold font-mono tabular-nums", accent)}>{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      {pulse && <span className="absolute top-3 right-3 w-1.5 h-1.5 rounded-full bg-up animate-ping" />}
    </motion.div>
  );
}

function MoodBar({ data }: { data: { symbol: string; score: number } }) {
  const positive = data.score >= 0;
  return (
    <div className="flex items-center gap-2.5">
      <span className="font-mono text-xs font-semibold w-14">{data.symbol}</span>
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden flex">
        <div className="flex-1 flex justify-end">
          {!positive && <div className="h-full bg-down rounded-l-full" style={{ width: `${Math.min(50, Math.abs(data.score) / 2)}%` }} />}
        </div>
        <div className="w-px h-full bg-border" />
        <div className="flex-1">
          {positive && <div className="h-full bg-up rounded-r-full" style={{ width: `${Math.min(50, data.score / 2)}%` }} />}
        </div>
      </div>
      <span className={cn("text-xs font-mono font-semibold w-9 text-right", positive ? "text-up" : "text-down")}>
        {positive ? "+" : ""}{data.score}
      </span>
    </div>
  );
}
