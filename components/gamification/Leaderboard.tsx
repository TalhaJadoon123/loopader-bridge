"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, User, Filter, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeaderboardEntry { rank: number; name: string; avatar?: string; profit: number; profitPct: number; trades: number; }

export function Leaderboard() {
  const [data, setData] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState<"weekly" | "monthly">("weekly");
  const [accountType, setAccountType] = useState<"DEMO" | "LIVE">("DEMO");
  const [showFilters, setShowFilters] = useState(false);

  const fetchLeaderboard = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/gamification/leaderboard?type=${type}&accountType=${accountType}`);
      const json = await res.json();
      setData(json.leaderboard ?? []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchLeaderboard(); }, [type, accountType]);

  const medals = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-yellow-500" />
          Leaderboard
        </h3>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-1 px-3 py-1.5 text-sm bg-secondary rounded-lg hover:bg-secondary/80"
        >
          <Filter className="w-4 h-4" />
          Filters
        </button>
      </div>

      {showFilters && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="bg-card border border-border rounded-lg p-4 space-y-3"
        >
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Period</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as "weekly" | "monthly")}
                className="w-full px-3 py-2 rounded border border-border bg-input text-sm"
              >
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1">Account</label>
              <select
                value={accountType}
                onChange={e => setAccountType(e.target.value as "DEMO" | "LIVE")}
                className="w-full px-3 py-2 rounded border border-border bg-input text-sm"
              >
                <option value="DEMO">Demo</option>
                <option value="LIVE">Live</option>
              </select>
            </div>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40 text-muted-foreground">Loading…</div>
      ) : data.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
          <Trophy className="w-12 h-12 mb-2 opacity-50" />
          <p>No data yet. Complete 5+ trades to qualify!</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 text-left text-muted-foreground">
                <th className="p-3">#</th>
                <th className="p-3">Trader</th>
                <th className="p-3 text-right">Return</th>
                <th className="p-3 text-right">Profit</th>
                <th className="p-3 text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {data.map((entry, i) => (
                <motion.tr
                  key={entry.name}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="border-t border-border/50 hover:bg-muted/30"
                >
                  <td className="p-3 font-bold">
                    {medals[i] ?? <span className="text-muted-foreground">#{entry.rank}</span>}
                  </td>
                  <td className="p-3 flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium text-xs">
                      {entry.avatar ? <img src={entry.avatar} alt="" className="w-8 h-8 rounded-full" /> : entry.name[0].toUpperCase()}
                    </div>
                    <span className="font-medium">{entry.name}</span>
                  </td>
                  <td className="p-3 text-right font-mono font-medium text-green-500">{entry.profitPct >= 0 ? "+" : ""}{entry.profitPct.toFixed(2)}%</td>
                  <td className="p-3 text-right font-mono text-green-500">{entry.profit >= 0 ? "+" : ""}{entry.profit.toFixed(2)}</td>
                  <td className="p-3 text-right text-muted-foreground">{entry.trades}</td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}