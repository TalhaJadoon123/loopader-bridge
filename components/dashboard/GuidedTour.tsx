"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

const MARKS = [
  {
    selector: "text",
    title: "This is your trading hub",
    body: "Live prices, your balance, and quick actions — everything starts here.",
  },
  {
    selector: "text",
    title: "Place your first trade",
    body: "Pick a symbol, choose Buy or Sell, set your volume. Start small: 0.01 lots.",
  },
  {
    selector: "text",
    title: "Your AI coach is free",
    body: "Ask anything — \"review my trade\" or \"what is pips?\" — and get instant answers.",
  },
  {
    selector: "text",
    title: "Keep your streak alive",
    body: "Check in daily to build XP and badges. Consistency beats luck.",
  },
];

const STORAGE_KEY = "loopader_coach_marks_done";

/** 4-step coach-mark overlay shown once after onboarding. */
export function GuidedTour() {
  const [step, setStep] = useState<number | null>(null);

  useEffect(() => {
    try {
      if (!localStorage.getItem(STORAGE_KEY)) setStep(0);
    } catch {
      /* private mode — skip tour */
    }
  }, []);

  const finish = () => {
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch { /* ignore */ }
    setStep(null);
  };

  if (step === null) return null;
  const mark = MARKS[step];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[90] bg-background/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-6"
      >
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm bg-card border border-border rounded-2xl p-6 shadow-2xl relative"
        >
          <button onClick={finish} aria-label="Skip tour" className="absolute top-3 right-3 text-muted-foreground hover:text-foreground">
            <X className="w-4 h-4" />
          </button>
          <div className="flex gap-1.5 mb-4">
            {MARKS.map((_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-border"}`} />
            ))}
          </div>
          <h3 className="text-lg font-bold mb-1">{mark.title}</h3>
          <p className="text-sm text-muted-foreground mb-5">{mark.body}</p>
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{step + 1} of {MARKS.length}</span>
            <button
              onClick={() => (step < MARKS.length - 1 ? setStep(step + 1) : finish())}
              className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90"
            >
              {step < MARKS.length - 1 ? "Next" : "Got it"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
