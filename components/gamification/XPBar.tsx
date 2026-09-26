"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface XPBarProps {
  totalXp: number;
  level: number;
  title: string;
  xpInLevel: number;
  xpForNextLevel: number;
}

export function XPBar({ totalXp, level, title, xpInLevel, xpForNextLevel }: XPBarProps) {
  const progress = (xpInLevel / xpForNextLevel) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-sm text-muted-foreground">Level {level} • {totalXp.toLocaleString()} XP</p>
        </div>
        <p className="text-sm font-mono text-primary">{xpInLevel} / {xpForNextLevel} XP</p>
      </div>
      <div className="h-3 bg-muted rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full bg-gradient-to-r from-yellow-500 to-orange-500 rounded-full"
        />
      </div>
    </div>
  );
}