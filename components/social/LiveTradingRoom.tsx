"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, Activity, Loader2, Eye, TrendingUp, TrendingDown, CircleDot, CheckSquare } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoomTrade {
  id: string; name: string; symbol: string; side: "BUY" | "SELL"; volume: number;
  openPrice: number; closePrice?: number | null; profit: number; time: string; accountType: string;
}
interface RoomStats { activeTraders: number; volume24h: number; closedLast24h: number; openNow: number; }
interface Leader { id: string; name: string; gain30d: number; winRate: number; riskLevel: string; followers: number; }

export function LiveTradingRoom() {
  const [stats, setStats] = useState<RoomStats | null>(null);
  const [closed, setClosed] = useState<RoomTrade[]>([]);
  const [open, setOpen] = useState<RoomTrade[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"all" | "live" | "demo">("all");

  const fetchRoom = useCallback(async () => {
    try {
      const res = await fetch(`/api/social/room/trades?type=${tab}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data.stats);
        setClosed(data.closed ?? []);
        setOpen(data.open ?? []);
      }
    } catch {}
  }, [tab]);

  const fetchLeaders = useCallback(async () => {
    try {
      const res = await fetch("/api/social/copy/leaders");
      if (res.ok) setLeaders((await res.json()).leaders ?? []);
    } catch {}
  }, []);

  useEffect(() => {
    fetchRoom();
    fetchLeaders();
    const id = setInterval(fetchRoom, 8000);
    return () => clearInterval(id);
  }, [fetchRoom, fetchLeaders]);

  return (
    <div className="space-y-4">
      {/* Header + tab filter */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" /> Live Trading Room
        </h3>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border overflow-hidden">
            {(["all", "live", "demo"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-3 py-1 text-xs font-medium capitalize transition-colors",
                  tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary"
                )}
              >
                {t === "live" ? "🔴 Live" : t === "demo" ? "Practice" : "All"}
              </button>
            ))}
          </div>
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Activity className="w-3.5 h-3.5 text-green-500 animate-pulse" /> Live
          </span>
        </div>
      </div>

      {/* Real stats bar */}
      {stats && (
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Traders 24h", value: stats.activeTraders, icon: Users },
            { label: "Volume 24h", value: stats.volume24h.toFixed(1), icon: TrendingUp },
            { label: "Closed 24h", value: stats.closedLast24h, icon: CheckSquare },
            { label: "Open Now", value: stats.openNow, icon: CircleDot },
          ].map(s => (
            <div key={s.label} className="bg-muted/30 rounded-lg p-2.5 text-center">
              <s.icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
              <p className="text-base font-bold font-mono">{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Open positions (live feed) */}
      {open.length > 0 && (
        <div className="rounded-xl border border-up/20 overflow-hidden">
          <div className="bg-up/5 px-4 py-2 text-xs font-medium text-up flex items-center gap-1.5">
            <CircleDot className="w-3.5 h-3.5 animate-pulse" /> Open Positions ({open.length})
          </div>
          <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
            {open.map(t => (
              <div key={t.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium truncate max-w-[80px]">{t.name}</span>
                  <span className={cn("text-[10px] px-1 py-0.5 rounded font-bold", t.side === "BUY" ? "bg-up/15 text-up" : "bg-down/15 text-down")}>{t.side}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">{t.symbol}</span>
                  <span className="text-xs text-muted-foreground">{t.volume.toFixed(2)} lots @ {t.openPrice.toFixed(5)}</span>
                </div>
                <span className={cn("text-xs font-mono font-medium", t.profit >= 0 ? "text-up" : "text-down")}>
                  {t.profit >= 0 ? "+" : ""}{t.profit.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recently closed */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground font-medium">
          Closed — Last 24h ({closed.length})
        </div>
        {loading ? (
          <div className="h-24 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
        ) : closed.length === 0 ? (
          <div className="h-24 flex flex-col items-center justify-center text-muted-foreground text-sm">
            <Users className="w-7 h-7 mb-1.5 opacity-40" />
            No trades closed in the last 24h — be the first!
          </div>
        ) : (
          <div className="divide-y divide-border/50 max-h-56 overflow-y-auto">
            {closed.map(t => (
              <motion.div key={t.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between px-4 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs font-medium truncate max-w-[80px]">{t.name}</span>
                  <span className={cn("text-[10px] px-1 py-0.5 rounded font-bold", t.side === "BUY" ? "bg-up/15 text-up" : "bg-down/15 text-down")}>{t.side}</span>
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted font-mono">{t.symbol}</span>
                  <span className="text-xs text-muted-foreground">{t.volume.toFixed(2)} lots</span>
                  {t.accountType === "LIVE" && <span className="text-[9px] px-1 py-0.5 bg-red-500/15 text-red-400 rounded font-bold">LIVE</span>}
                </div>
                <div className="flex items-center gap-2">
                  {t.closePrice && <span className="text-xs text-muted-foreground font-mono">@ {t.closePrice.toFixed(5)}</span>}
                  <span className={cn("text-xs font-mono font-medium", t.profit >= 0 ? "text-up" : "text-down")}>
                    {t.profit >= 0 ? "+" : ""}{t.profit.toFixed(2)}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Top Leaders */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="bg-muted/50 px-4 py-2 text-xs text-muted-foreground font-medium flex items-center gap-1.5">
          <Eye className="w-3.5 h-3.5" /> Top Leaders — Copy Them
        </div>
        <div className="divide-y divide-border/50">
          {leaders.length === 0 ? (
            <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">
              No leaders yet — top traders appear here after 30 days of live trading
            </div>
          ) : leaders.slice(0, 5).map((l, i) => (
            <div key={l.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-sm">{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`}</span>
                <span className="text-sm font-medium">{l.name}</span>
                <span className={cn("text-xs px-1.5 py-0.5 rounded",
                  l.riskLevel === "LOW" ? "bg-green-500/15 text-green-500" :
                  l.riskLevel === "MEDIUM" ? "bg-yellow-500/15 text-yellow-500" : "bg-red-500/15 text-red-500"
                )}>{l.riskLevel}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-muted-foreground">{l.followers} 👥</span>
                <span className={cn("font-mono font-medium", l.gain30d >= 0 ? "text-up" : "text-down")}>
                  {l.gain30d >= 0 ? "+" : ""}{l.gain30d.toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
