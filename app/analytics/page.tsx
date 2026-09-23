"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Percent, Target, Shield, Award, BarChart2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Skeleton } from "@/components/ui/Skeleton";

interface Portfolio {
  totalTrades: number; wins: number; losses: number; winRate: number; totalPnL: number;
  avgProfit: number; avgLoss: number; profitFactor: number; maxDrawdown: number; sharpe: number;
  bestTrade: any; worstTrade: any; monthlyPnL: { month: string; pnl: number }[]; bySymbol: any[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/analytics/portfolio").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <DashboardLayout><Skeleton className="h-96 w-full rounded-xl" /></DashboardLayout>;

  if (!data || data.totalTrades === 0) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <BarChart2 className="w-12 h-12 mb-3 opacity-50" />
          <p className="text-lg">No trading data yet</p>
          <p className="text-sm">Complete some trades to see your analytics</p>
        </div>
      </DashboardLayout>
    );
  }

  const maxMonthly = Math.max(...data.monthlyPnL.map(m => Math.abs(m.pnl)), 1);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Portfolio Analytics</h1>
          <p className="text-sm text-muted-foreground">Track your performance and improve your edge</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard icon={TrendingUp} label="Total P&L" value={`$${data.totalPnL.toFixed(2)}`} color={data.totalPnL >= 0 ? "text-green-500" : "text-red-500"} />
          <MetricCard icon={Percent} label="Win Rate" value={`${data.winRate}%`} color="text-primary" />
          <MetricCard icon={Award} label="Profit Factor" value={data.profitFactor.toFixed(2)} color={data.profitFactor >= 1.5 ? "text-green-500" : data.profitFactor >= 1 ? "text-yellow-500" : "text-red-500"} />
          <MetricCard icon={Shield} label="Max Drawdown" value={`$${data.maxDrawdown.toFixed(2)}`} color="text-red-500" />
          <MetricCard icon={Target} label="Sharpe Ratio" value={data.sharpe.toFixed(2)} color={data.sharpe >= 1 ? "text-green-500" : "text-muted-foreground"} />
          <MetricCard icon={TrendingUp} label="Avg Win" value={`$${data.avgProfit.toFixed(2)}`} color="text-green-500" />
          <MetricCard icon={TrendingDown} label="Avg Loss" value={`$${data.avgLoss.toFixed(2)}`} color="text-red-500" />
          <MetricCard icon={Target} label="Trades" value={data.totalTrades} color="text-primary" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Monthly P&L</h3>
            <div className="space-y-2">
              {data.monthlyPnL.map(m => (
                <div key={m.month} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-16 font-mono">{m.month}</span>
                  <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden relative">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(8, (Math.abs(m.pnl) / maxMonthly) * 100)}%` }}
                      transition={{ duration: 0.6 }}
                      className={cn("h-full rounded", m.pnl >= 0 ? "bg-green-500/80" : "bg-red-500/80")}
                    />
                  </div>
                  <span className={cn("text-xs font-mono w-20 text-right", m.pnl >= 0 ? "text-green-500" : "text-red-500")}>
                    {m.pnl >= 0 ? "+" : ""}{m.pnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-6">
            <h3 className="font-semibold mb-4">Performance by Symbol</h3>
            <div className="space-y-3">
              {data.bySymbol.slice(0, 8).map(s => (
                <div key={s.symbol} className="flex items-center justify-between text-sm">
                  <span className="font-mono font-medium">{s.symbol}</span>
                  <span className="text-xs text-muted-foreground">{s.trades} trades • {s.winRate}% WR</span>
                  <span className={cn("font-mono font-medium", s.pnl >= 0 ? "text-green-500" : "text-red-500")}>
                    {s.pnl >= 0 ? "+" : ""}{s.pnl.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.bestTrade && (
            <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
              <p className="text-xs text-green-500 font-medium uppercase mb-1">Best Trade</p>
              <p className="font-mono font-bold text-green-500 text-lg">+${data.bestTrade.profit.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{data.bestTrade.symbol} • {new Date(data.bestTrade.date).toLocaleDateString()}</p>
            </div>
          )}
          {data.worstTrade && (
            <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs text-red-500 font-medium uppercase mb-1">Worst Trade</p>
              <p className="font-mono font-bold text-red-500 text-lg">{data.worstTrade.profit.toFixed(2)}</p>
              <p className="text-sm text-muted-foreground">{data.worstTrade.symbol} • {new Date(data.worstTrade.date).toLocaleDateString()}</p>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className={cn("text-2xl font-bold font-mono", color)}>{value}</p>
    </div>
  );
}