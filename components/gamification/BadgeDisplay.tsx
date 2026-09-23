"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Badge { id: string; code: string; name: string; icon: string; criteria: string; earned: boolean; earnedAt?: string; }

interface BadgeDisplayProps {
  badges: Badge[];
  maxVisible?: number;
}

export function BadgeDisplay({ badges, maxVisible = 6 }: BadgeDisplayProps) {
  const earnedBadges = badges.filter(b => b.earned);
  const lockedBadges = badges.filter(b => !b.earned);

  return (
    <div className="space-y-4">
      {earnedBadges.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span className="text-lg">🏆</span> Earned ({earnedBadges.length})
          </h4>
          <div className="flex flex-wrap gap-3">
            {earnedBadges.slice(0, maxVisible).map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 bg-green-500/10 border border-green-500/30 rounded-lg hover:border-green-500/50 transition-colors"
              >
                <span className="text-2xl" role="img" aria-label={badge.name}>{badge.icon}</span>
                <div className="flex flex-col">
                  <span className="font-medium text-sm">{badge.name}</span>
                  <span className="text-xs text-muted-foreground">{badge.criteria}</span>
                </div>
                {badge.earnedAt && (
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(badge.earnedAt).toLocaleDateString()}
                  </span>
                )}
              </motion.div>
            ))}
            {earnedBadges.length > maxVisible && (
              <div className="px-3 py-2 bg-secondary rounded-lg text-sm text-muted-foreground">
                +{earnedBadges.length - maxVisible} more
              </div>
            )}
          </div>
        </div>
      )}

      {lockedBadges.length > 0 && (
        <div>
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <span className="text-lg">🔒</span> Locked ({lockedBadges.length})
          </h4>
          <div className="flex flex-wrap gap-3">
            {lockedBadges.slice(0, maxVisible).map((badge, i) => (
              <motion.div
                key={badge.id}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 0.5, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2 px-3 py-2 bg-muted/50 border border-border rounded-lg opacity-60"
              >
                <span className="text-2xl opacity-40" role="img">{badge.icon}</span>
                <div className="flex flex-col">
                  <span className="font-medium text-sm opacity-70">{badge.name}</span>
                  <span className="text-xs text-muted-foreground">{badge.criteria}</span>
                </div>
              </motion.div>
            ))}
            {lockedBadges.length > maxVisible && (
              <div className="px-3 py-2 bg-muted/50 rounded-lg text-sm text-muted-foreground">
                +{lockedBadges.length - maxVisible} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}