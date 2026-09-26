"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { X, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Position {
  id: string;
  symbol: string;
  side: "BUY" | "SELL";
  volume: number;
  openPrice: number;
  currentPrice: number;
  unrealizedProfit: number;
  marginUsed: number;
  stopLoss?: number;
  takeProfit?: number;
}

export function PositionsScreen() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPositions = async () => {
    try {
      const res = await fetch("/api/trade/positions");
      const data = await res.json();
      if (data.positions) setPositions(data.positions);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPositions();
    const id = setInterval(fetchPositions, 2000);
    return () => clearInterval(id);
  }, []);

  const closePosition = async (id: string) => {
    try {
      await fetch("/api/trade/close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tradeId: id }),
      });
      fetchPositions();
    } catch (e) {
      console.error(e);
    }
  };

  const closeAll = async () => {
    await Promise.all(positions.map((p) => closePosition(p.id)));
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading positions…</div>;
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
        <AlertTriangle className="w-12 h-12 mb-4 text-muted-foreground/50" />
        <p className="text-lg">No open positions</p>
        <p className="text-sm">Open a trade from the <a href="/trade" className="text-primary underline">Trade</a> page</p>
      </div>
    );
  }

  const totalPnL = positions.reduce((sum, p) => sum + p.unrealizedProfit, 0);
  const totalMargin = positions.reduce((sum, p) => sum + p.marginUsed, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Open Positions</h1>
        <div className="flex items-center gap-4 text-sm">
          <span className={cn("font-mono", totalPnL >= 0 ? "text-green-500" : "text-red-500")}>
            {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}
          </span>
          <span className="text-muted-foreground">Margin: {totalMargin.toFixed(2)}</span>
        </div>
      </div>

      {positions.length > 1 && (
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={closeAll}
          className="w-full py-2 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30 flex items-center justify-center gap-2"
        >
          <X className="w-4 h-4" />
          Close All Positions
        </motion.button>
      )}

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/50 text-left text-sm text-muted-foreground">
              <th className="p-3">Symbol</th>
              <th className="p-3">Side</th>
              <th className="p-3">Volume</th>
              <th className="p-3">Entry</th>
              <th className="p-3">Current</th>
              <th className="p-3">P&L</th>
              <th className="p-3">Margin</th>
              <th className="p-3">SL / TP</th>
              <th className="p-3"></th>
            </tr>
          </thead>
          <tbody>
            {positions.map((p) => (
              <motion.tr
                key={p.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-t border-border hover:bg-muted/30 transition-colors"
              >
                <td className="p-3 font-mono font-medium">{p.symbol}</td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", p.side === "BUY" ? "bg-green-600/20 text-green-600" : "bg-red-600/20 text-red-600")}>
                    {p.side}
                  </span>
                </td>
                <td className="p-3 font-mono">{p.volume.toFixed(2)}</td>
                <td className="p-3 font-mono">{p.openPrice.toFixed(5)}</td>
                <td className="p-3 font-mono">{p.currentPrice.toFixed(5)}</td>
                <td className="p-3">
                  <span className={cn("font-mono font-medium", p.unrealizedProfit >= 0 ? "text-green-500" : "text-red-500")}>
                    {p.unrealizedProfit >= 0 ? "+" : ""}{p.unrealizedProfit.toFixed(2)}
                  </span>
                </td>
                <td className="p-3 font-mono text-muted-foreground">{p.marginUsed.toFixed(2)}</td>
                <td className="p-3 text-xs text-muted-foreground font-mono">
                  {p.stopLoss ? `SL: ${p.stopLoss.toFixed(5)}` : "—"}<br />
                  {p.takeProfit ? `TP: ${p.takeProfit.toFixed(5)}` : "—"}
                </td>
                <td className="p-3 text-right">
                  <button
                    onClick={() => closePosition(p.id)}
                    className="text-red-500 hover:text-red-700 text-sm font-medium"
                  >
                    Close
                  </button>
                </td>
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}