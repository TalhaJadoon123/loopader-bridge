"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { CalendarDays, TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CalendarDay { date: string; pnl: number; trades: number; winRate: number; intensity: number; }
interface Summary { totalPnl: number; tradingDays: number; greenDays: number; redDays: number; bestDay: { date: string; pnl: number } | null; worstDay: { date: string; pnl: number } | null; avgDailyPnl: number; }

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function CalendarHeatmap() {
  const [calendar, setCalendar] = useState<CalendarDay[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetch(`/api/calendar?days=${days}`).then(r => r.json()).then(d => {
      setCalendar(d.calendar ?? []);
      setSummary(d.summary ?? null);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [days]);

  // Group by month
  const months = new Map<string, CalendarDay[]>();
  for (const c of calendar) {
    const monthKey = c.date.slice(0, 7);
    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey)!.push(c);
  }

  const getColor = (day: CalendarDay) => {
    if (day.trades === 0) return "bg-muted/30";
    const intensity = Math.min(1, day.intensity / 100);
    if (day.pnl > 0) return `bg-green-500/${Math.max(20, Math.round(intensity * 100))}`;
    return `bg-red-500/${Math.max(20, Math.round(intensity * 100))}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <CalendarDays className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Trading Calendar</h1>
            <p className="text-sm text-muted-foreground">Your daily P&L at a glance</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          {[30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={cn("px-3 py-1.5 text-xs font-medium", days === d ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary")}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className={cn("bg-card border rounded-xl p-3 text-center", summary.totalPnl >= 0 ? "border-green-500/20" : "border-red-500/20")}>
            <p className={cn("text-xl font-bold font-mono", summary.totalPnl >= 0 ? "text-green-500" : "text-red-500")}>
              {summary.totalPnl >= 0 ? "+" : ""}${summary.totalPnl.toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">Total P&L</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold">{summary.tradingDays}</p>
            <p className="text-xs text-muted-foreground">Trading Days</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-green-500">{summary.greenDays}</p>
            <p className="text-xs text-muted-foreground">Green Days</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-3 text-center">
            <p className="text-xl font-bold text-red-500">{summary.redDays}</p>
            <p className="text-xs text-muted-foreground">Red Days</p>
          </div>
        </div>
      )}

      {/* Heatmap */}
      {loading ? (
        <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-6">
          {Array.from(months.entries()).reverse().map(([monthKey, days]) => {
            const [year, month] = monthKey.split("-");
            const firstDay = new Date(parseInt(year), parseInt(month) - 1, 1).getDay();
            const daysInMonth = new Date(parseInt(year), parseInt(month), 0).getDate();

            return (
              <div key={monthKey} className="bg-card border border-border rounded-xl p-4">
                <h3 className="font-semibold mb-3">{MONTH_NAMES[parseInt(month) - 1]} {year}</h3>
                <div className="grid grid-cols-7 gap-1.5">
                  {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                    <div key={i} className="text-center text-[10px] text-muted-foreground font-medium">{d}</div>
                  ))}
                  {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
                  {days.map(day => {
                    const dateNum = parseInt(day.date.slice(8));
                    return (
                      <motion.div
                        key={day.date}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={cn(
                          "aspect-square rounded-lg flex flex-col items-center justify-center text-[10px] cursor-default hover:scale-110 transition-transform",
                          getColor(day),
                          day.trades > 0 ? "cursor-pointer" : ""
                        )}
                        title={day.trades > 0 ? `${day.date}: $${day.pnl.toFixed(2)} (${day.trades} trades, ${day.winRate}% WR)` : day.date}
                      >
                        <span className="font-medium">{dateNum}</span>
                        {day.trades > 0 && (
                          <span className={cn("text-[8px] font-bold", day.pnl >= 0 ? "text-green-300" : "text-red-300")}>
                            {day.pnl >= 0 ? "+" : ""}{day.pnl.toFixed(0)}
                          </span>
                        )}
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Best/worst */}
      {summary?.bestDay && summary.bestDay.pnl > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/5 border border-green-500/20 rounded-xl p-4">
            <p className="text-xs text-green-500 uppercase font-bold mb-1 flex items-center gap-1"><TrendingUp className="w-3.5 h-3.5" /> Best Day</p>
            <p className="text-lg font-bold font-mono text-green-500">+${summary.bestDay.pnl.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{summary.bestDay.date}</p>
          </div>
          <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
            <p className="text-xs text-red-500 uppercase font-bold mb-1 flex items-center gap-1"><TrendingDown className="w-3.5 h-3.5" /> Worst Day</p>
            <p className="text-lg font-bold font-mono text-red-500">${summary.worstDay?.pnl.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground">{summary.worstDay?.date}</p>
          </div>
        </div>
      )}
    </div>
  );
}