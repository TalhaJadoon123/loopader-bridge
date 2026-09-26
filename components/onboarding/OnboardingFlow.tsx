"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ArrowRight, Sparkles, Shield, Zap, Users, Bot, ArrowLeft, TrendingUp, PartyPopper } from "lucide-react";
import { cn } from "@/lib/utils";
import { Confetti } from "@/components/onboarding/Confetti";

const STEPS = [
  { id: "welcome", title: "Welcome to Loopader", description: "Trade Forex with an AI Coach by your side. Let's get you set up in 2 minutes.", icon: Sparkles },
  { id: "security", title: "Secure Your Account", description: "Set up Face ID or fingerprint login — no passwords needed. The most secure login in forex.", icon: Shield },
  { id: "account", title: "Choose Account Type", description: "Start with a $10,000 demo or go live. Switch anytime.", icon: Zap },
  { id: "social", title: "Copy Top Traders", description: "Mirror winning strategies with 1-click. Earn while you learn.", icon: Users },
  { id: "coach", title: "Meet Your AI Coach", description: "Get instant trade reviews, market explanations, and personalized insights.", icon: Bot },
  { id: "first-trade", title: "Make Your First Trade", description: "A guided practice trade on your demo account — risk-free.", icon: TrendingUp },
  { id: "done", title: "You're In!", description: "You just placed your first trade and earned the First Trade badge.", icon: PartyPopper },
];

export function OnboardingFlow({ onComplete }: { onComplete: (accountType: "demo" | "live") => void }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [securityMethod, setSecurityMethod] = useState<"passkey" | "password">("passkey");
  const [accountType, setAccountType] = useState<"demo" | "live">("demo");
  const [tradeState, setTradeState] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [tradeError, setTradeError] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);

  const goNext = () => {
    if (currentStep === 2) {
      // Persist account choice (Demo/Live) for the trade screen default
      try { localStorage.setItem("loopader_account_type", accountType); } catch { /* ignore */ }
    }
    if (currentStep < STEPS.length - 1) setCurrentStep((p) => p + 1);
    else onComplete(accountType);
  };
  const goBack = () => { if (currentStep > 0) setCurrentStep((p) => p - 1); };
  const progress = ((currentStep + 1) / STEPS.length) * 100;
  const StepIcon = STEPS[currentStep].icon;

  const placeFirstTrade = async () => {
    setTradeState("sending");
    setTradeError("");
    try {
      const res = await fetch("/api/trade/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: "EURUSD",
          side: "BUY",
          volume: 0.01,
          idempotencyKey: `onboarding-${crypto.randomUUID()}`,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setTradeError(data.error ?? "Could not place the practice trade right now.");
        setTradeState("error");
        return;
      }
      setTradeState("done");
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3200);
    } catch {
      setTradeError("Network error — check your connection and try again.");
      setTradeState("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="fixed top-4 left-4 right-4 z-10 flex justify-center">
        <div className="w-full max-w-md mx-auto">
          <div className="bg-card/50 backdrop-blur rounded-full h-2 overflow-hidden border border-border">
            <motion.div initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.5 }} className="h-full bg-gradient-to-r from-green-500 to-blue-500 rounded-full" />
          </div>
          <p className="text-center text-sm text-muted-foreground mt-2">Step {currentStep + 1} of {STEPS.length}</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 pt-24">
        <AnimatePresence mode="wait">
          <motion.div key={currentStep} initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }} transition={{ duration: 0.3 }} className="w-full max-w-md">
            <div className="text-center mb-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                <StepIcon className="w-8 h-8 text-primary" />
              </div>
              <h1 className="text-2xl font-bold mb-2">{STEPS[currentStep].title}</h1>
              <p className="text-muted-foreground">{STEPS[currentStep].description}</p>
            </div>

            {currentStep === 0 && (
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4 text-left">
                  <h3 className="font-semibold mb-2">What you get:</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {["$10,000 demo balance instantly", "AI Trading Coach (Groq Llama 3.3 70B)", "Market Mood sentiment gauge", "Copy trading with top performers", "Streaks, XP & badges", "Passkey / Face ID login"].map((f) => (
                      <li key={f} className="flex items-center gap-2"><Check className="w-4 h-4 text-green-500" /> {f}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {currentStep === 1 && (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">Choose your login method (recommended: Passkey)</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["passkey", "password"] as const).map((m) => (
                    <button key={m} onClick={() => setSecurityMethod(m)} className={cn("p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2", securityMethod === m ? "border-primary bg-primary/5" : "border-border")}>
                      <Shield className="w-8 h-8 text-primary" />
                      <span className="font-medium">{m === "passkey" ? "Passkey" : "Password"}</span>
                      <span className="text-xs text-muted-foreground">{m === "passkey" ? "Face ID / Fingerprint" : "Traditional login"}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 2 && (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">Start risk-free or go live</p>
                <div className="grid grid-cols-2 gap-3">
                  {(["demo", "live"] as const).map((t) => (
                    <button key={t} onClick={() => setAccountType(t)} className={cn("p-4 rounded-xl border-2 transition-all text-left", accountType === t ? "border-primary bg-primary/5" : "border-border")}>
                      <div className={cn("font-bold", t === "demo" ? "text-green-500" : "text-purple-500")}>{t === "demo" ? "Demo" : "Live"}</div>
                      <div className="text-sm text-muted-foreground">{t === "demo" ? "$10,000 virtual balance" : "Real money trading"}</div>
                      <div className={cn("text-xs mt-1", t === "demo" ? "text-green-500" : "text-yellow-500")}>{t === "demo" ? "✓ No KYC needed" : "⚠ KYC required"}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 3 && (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">Discover social trading features</p>
                <div className="grid grid-cols-2 gap-3">
                  {[{ icon: Users, title: "Copy Trading", desc: "Mirror top traders" }, { icon: Bot, title: "Trade Ideas", desc: "Share setups" }, { icon: Users, title: "Live Charts", desc: "See cursors live" }, { icon: Users, title: "Chat Rooms", desc: "Discuss per symbol" }].map((f) => (
                    <div key={f.title} className="bg-card border border-border rounded-xl p-4 text-center">
                      <f.icon className="w-8 h-8 mx-auto text-primary mb-2" />
                      <div className="font-medium">{f.title}</div>
                      <div className="text-xs text-muted-foreground">{f.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {currentStep === 4 && (
              <div className="space-y-4">
                <p className="text-center text-muted-foreground">Your personal AI trading coach</p>
                <div className="bg-card border border-border rounded-xl p-4 text-left">
                  <h3 className="font-semibold mb-2 flex items-center gap-2"><Bot className="w-5 h-5 text-purple-500" /> What can I help with?</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• &quot;Why did gold spike today?&quot;</li>
                    <li>• &quot;Review my last trade&quot;</li>
                    <li>• &quot;What does RSI mean?&quot;</li>
                    <li>• &quot;Am I overtrading?&quot;</li>
                  </ul>
                </div>
              </div>
            )}

            {currentStep === 5 && (
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">€$</span>
                      <div>
                        <div className="font-semibold">EUR/USD</div>
                        <div className="text-xs text-muted-foreground">Euro vs US Dollar</div>
                      </div>
                    </div>
                    <span className="text-xs px-2 py-0.5 rounded bg-green-600/20 text-green-600 font-medium">Demo</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground block text-xs">Volume (lot size)</span><span className="font-mono font-semibold">0.01</span></div>
                    <div className="bg-secondary/50 rounded-lg p-2"><span className="text-muted-foreground block text-xs">Direction</span><span className="font-semibold text-green-500">BUY (go up)</span></div>
                  </div>
                  {tradeError && <div className="px-3 py-2 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm mb-3">{tradeError}</div>}
                  <button
                    onClick={placeFirstTrade}
                    disabled={tradeState === "sending" || tradeState === "done"}
                    className="w-full py-3 rounded-lg bg-green-600 text-white font-semibold hover:bg-green-600/90 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {tradeState === "done" ? <><Check className="w-4 h-4" /> Trade placed!</> : tradeState === "sending" ? "Placing trade…" : "Place practice BUY trade"}
                  </button>
                  <p className="text-xs text-muted-foreground mt-2 text-center">This is your $10,000 demo balance — real money is never used here.</p>
                </div>
                {tradeState === "error" && (
                  <button onClick={goNext} className="w-full text-center text-sm text-muted-foreground underline">
                    Skip for now
                  </button>
                )}
              </div>
            )}

            {currentStep === 6 && (
              <div className="space-y-4 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-green-600/20 flex items-center justify-center">
                  <PartyPopper className="w-10 h-10 text-green-500" />
                </div>
                <div className="bg-card border border-border rounded-xl p-4">
                  <div className="font-semibold flex items-center justify-center gap-2"><Check className="w-5 h-5 text-green-500" /> First Trade badge earned</div>
                  <p className="text-sm text-muted-foreground mt-1">Check your profile to see your badges. Your streak starts today.</p>
                </div>
              </div>
            )}

            <div className="flex justify-between mt-8 pt-4 border-t border-border">
              {currentStep > 0 && (
                <button onClick={goBack} className="px-4 py-2 text-muted-foreground hover:text-foreground transition-colors">
                  <ArrowLeft className="w-4 h-4 mr-1 inline" /> Back
                </button>
              )}
              <button onClick={goNext} className={cn("px-6 py-3 rounded-lg font-semibold transition-colors bg-primary text-primary-foreground hover:bg-primary/90", currentStep === 0 && "w-full")}>
                {currentStep === 5 ? (tradeState === "done" ? "Continue" : "Skip") : currentStep === STEPS.length - 1 ? "Go to Dashboard" : "Continue"} <ArrowRight className="w-4 h-4 ml-2 inline" />
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}