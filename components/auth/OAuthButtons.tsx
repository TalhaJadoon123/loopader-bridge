"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { motion } from "framer-motion";

export function OAuthButtons({ mode = "login" }: { mode?: "login" | "register" }) {
  const [loading, setLoading] = useState<string | null>(null);

  const handleProvider = async (provider: string) => {
    setLoading(provider);
    await signIn(provider, { callbackUrl: "/onboarding" });
    setLoading(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground">or continue with</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <motion.button
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.02 }}
        onClick={() => handleProvider("google")}
        disabled={loading === "google"}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-border bg-card hover:bg-secondary hover:border-primary/30 transition-all duration-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <motion.div
          animate={loading === "google" ? { rotate: 360 } : {}}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M21.35 11.1H12v3h5.4c-.5 2.3-2.5 3.9-5.4 3.9-3.3 0-6-2.7-6-6s2.7-6 6-6c1.5 0 2.9.6 4 1.5l2.6-2.6C17 3.2 14.6 2 12 2 6.5 2 2 6.5 2 12s4.5 10 10 10c5.8 0 9.6-4.1 9.6-9.9 0-.6-.1-1.2-.25-1.9Z" fill="#4285F4"/>
          </svg>
        </motion.div>
        {loading === "google" ? (
          <span className="text-primary">Connecting...</span>
        ) : (
          <span>Continue with Google</span>
        )}
      </motion.button>
    </div>
  );
}