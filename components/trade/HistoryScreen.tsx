"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Download, Filter, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

interface Trade {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  closePrice?: number;
  profit: number;
  status: "OPEN" | "CLOSED";
  openedAt: string;
  closedAt?: string;
}

export function HistoryScreen() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ symbol: "", status: "", from: "", to: "" });

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filters.symbol) params.set("symbol", filters.symbol);
      if (filters.status) params.set("status", filters.status);
      if (filters.from) params.set("from", filters.from);
      if (filters.to) params.set("to", filters.to);
      params.set("limit", "200");
      const res = await fetch(`/api/trade/history?${params.toString()}`);
      const data = await res.json();
      if (data.trades) setTrades(data.trades);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTrades();
  }, [filters]);

  const exportCSV = async () => {
    const params = new URLSearchParams();
    if (filters.symbol) params.set("symbol", filters.symbol);
    if (filters.status) params.set("status", filters.status);
    if (filters.from) params.set("from", filters.from);
    if (filters.to) params.set("to", filters.to);
    params.set("format", "csv");
    const res = await fetch(`/api/trade/history?${params.toString()}`);
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `trade-history-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  const totalProfit = trades.reduce((sum, t) => sum + Number(t.profit), 0);
  const wins = trades.filter((t) => Number(t.profit) > 0).length;
  const winRate = trades.length ? ((wins / trades.length) * 100).toFixed(1) : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Trade History</h1>
          <p className="text-sm text-muted-foreground">
            {trades.length} trades • {winRate}% win rate • {totalProfit >= 0 ? "+" : ""}{totalProfit.toFixed(2)} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary hover:bg-secondary/80 text-sm">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="bg-card border border-border rounded-lg p-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">Symbol</label>
            <select
              value={filters.symbol}
              onChange={(e) => setFilters({ ...filters, symbol: e.target.value })}
              className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All Symbols</option>
              <option value="EURUSD">EURUSD</option>
              <option value="GBPUSD">GBPUSD</option>
              <option value="USDJPY">USDJPY</option>
              <option value="XAUUSD">XAUUSD</option>
              <option value="BTCUSD">BTCUSD</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
            >
              <option value="">All</option>
              <option value="OPEN">Open</option>
              <option value="CLOSED">Closed</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">From</label>
            <input
              type="date"
              value={filters.from}
              onChange={(e) => setFilters({ ...filters, from: e.target.value })}
              className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-medium mb-1">To</label>
            <input
              type="date"
              value={filters.to}
              onChange={(e) => setFilters({ ...filters, to: e.target.value })}
              className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">Loading…</div>
      ) : trades.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <p className="text-lg">No trades found</p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-muted/50 text-left text-sm text-muted-foreground">
                <th className="p-3">Time</th>
                <th className="p-3">Symbol</th>
                <th className="p-3">Side</th>
                <th className="p-3">Volume</th>
                <th className="p-3">Entry</th>
                <th className="p-3">Exit</th>
                <th className="p-3">P&L</th>
                <th className="p-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <motion.tr
                  key={t.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="border-t border-border hover:bg-muted/30 transition-colors"
                >
                  <td className="p-3 text-sm">{new Date(t.openedAt).toLocaleString()}</td>
                  <td className="p-3 font-mono font-medium">{t.symbol}</td>
                  <td className="p-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", t.side === "BUY" ? "bg-green-600/20 text-green-600" : "bg-red-600/20 text-red-600")}>
                      {t.side}
                    </span>
                  </td>
                  <td className="p-3 font-mono">{Number(t.volume).toFixed(2)}</td>
                  <td className="p-3 font-mono">{Number(t.openPrice).toFixed(5)}</td>
                  <td className="p-3 font-mono">{t.closePrice ? Number(t.closePrice).toFixed(5) : "—"}</td>
                  <td className="p-3">
                    <span className={cn("font-mono font-medium", Number(t.profit) >= 0 ? "text-green-500" : "text-red-500")}>
                      {Number(t.profit) >= 0 ? "+" : ""}{Number(t.profit).toFixed(2)}
                    </span>
                  </td>
                  <td className="p-3">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", t.status === "CLOSED" ? "bg-green-600/20 text-green-600" : "bg-yellow-600/20 text-yellow-600")}>
                      {t.status}
                    </span>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}