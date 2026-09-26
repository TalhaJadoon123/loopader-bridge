"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const SESSIONS = [
  { name: "Sydney", open: 22, close: 7, tz: 0, color: "#8b5cf6" },
  { name: "Tokyo", open: 0, close: 9, tz: 0, color: "#ef4444" },
  { name: "London", open: 8, close: 17, tz: 0, color: "#3b82f6" },
  { name: "New York", open: 13, close: 22, tz: 0, color: "#10b981" },
];

export function MarketSessions() {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  const utcHour = now.getUTCHours();
  const utcMinutes = now.getUTCMinutes();
  const timeStr = `${utcHour.toString().padStart(2, "0")}:${utcMinutes.toString().padStart(2, "0")} UTC`;

  const isSessionOpen = (open: number, close: number) => {
    if (open < close) return utcHour >= open && utcHour < close;
    return utcHour >= open || utcHour < close; // overnight session
  };

  const openCount = SESSIONS.filter(s => isSessionOpen(s.open, s.close)).length;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm">Market Sessions</h3>
        <span className="text-xs font-mono text-muted-foreground">{timeStr}</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {SESSIONS.map(session => {
          const isOpen = isSessionOpen(session.open, session.close);
          return (
            <div
              key={session.name}
              className={cn(
                "rounded-lg p-2.5 text-center border transition-all",
                isOpen ? "border-transparent" : "border-border bg-muted/30"
              )}
              style={isOpen ? { backgroundColor: `${session.color}15`, borderColor: `${session.color}40` } : {}}
            >
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span
                  className={cn("w-2 h-2 rounded-full", isOpen ? "animate-pulse" : "opacity-30")}
                  style={{ backgroundColor: isOpen ? session.color : "#6b7280" }}
                />
                <p className={cn("text-[11px] font-semibold", isOpen ? "text-foreground" : "text-muted-foreground")}>
                  {session.name}
                </p>
              </div>
              <p className={cn("text-[10px]", isOpen ? "text-green-500 font-bold" : "text-muted-foreground")}>
                {isOpen ? "OPEN" : "CLOSED"}
              </p>
            </div>
          );
        })}
      </div>
      {openCount > 0 && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-xs text-center text-muted-foreground mt-2.5"
        >
          {openCount} session{openCount > 1 ? "s" : ""} active —{" "}
          {openCount >= 2 ? "high liquidity" : "normal liquidity"}
        </motion.p>
      )}
    </div>
  );
}