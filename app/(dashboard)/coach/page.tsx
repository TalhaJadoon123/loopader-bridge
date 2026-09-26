"use client";

import CoachChat from "@/components/coach/CoachChat";

export default function CoachPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">AI Trading Coach</h1>
        <p className="text-muted-foreground mt-1">
          Your personal trading assistant powered by Groq. Analyze trades, learn concepts, and improve discipline.
        </p>
      </div>
      
      <div className="rounded-2xl border border-border bg-card overflow-hidden h-[calc(100vh-200px)]">
        <CoachChat />
      </div>
    </div>
  );
}