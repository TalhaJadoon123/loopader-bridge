"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Flame, Award, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

interface StreakFlameProps {
  current: number;
  longest: number;
  freezes: number;
  size?: "sm" | "md" | "lg";
}

export function StreakFlame({ current, longest, freezes, size = "md" }: StreakFlameProps) {
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    setAnimating(true);
    const t = setTimeout(() => setAnimating(false), 1000);
    return () => clearTimeout(t);
  }, [current]);

  const sizeClasses = {
    sm: "w-10 h-10 text-2xl",
    md: "w-16 h-16 text-4xl",
    lg: "w-24 h-24 text-6xl",
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <motion.div
        animate={{ scale: animating ? 1.2 : 1 }}
        transition={{ duration: 0.3 }}
        className={cn("relative flex items-center justify-center", sizeClasses[size])}
      >
        <span className="relative z-10" role="img" aria-label="fire">🔥</span>
        {animating && (
          <motion.span
            initial={{ opacity: 1, scale: 1 }}
            animate={{ opacity: 0, scale: 2 }}
            transition={{ duration: 0.5 }}
            className="absolute text-orange-300"
          >
            🔥
          </motion.span>
        )}
      </motion.div>

      <div className="text-center">
        <p className={cn("font-bold tabular-nums", size === "sm" ? "text-lg" : size === "md" ? "text-3xl" : "text-5xl")}>
          {current}
        </p>
        <p className="text-xs text-muted-foreground">day streak</p>
      </div>

      <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <Award className="w-3 h-3" />
          <span>Best: {longest}</span>
        </div>
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          <span>Freezes: {freezes}</span>
        </div>
      </div>
    </div>
  );
}