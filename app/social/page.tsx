"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Send, TrendingUp, TrendingDown, Users, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Idea { id: string; author: { id: string; fullName: string | null; avatarUrl: string | null }; symbol: string; direction: "BUY" | "SELL"; note: string; liked: boolean; likeCount: number; commentCount: number; createdAt: string; }

export default function SocialFeedPage() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [newIdea, setNewIdea] = useState({ symbol: "EURUSD", direction: "BUY" as "BUY" | "SELL", note: "" });
  const [submitting, setSubmitting] = useState(false);
  const [liveUsers, setLiveUsers] = useState(0);

  const fetchIdeas = async () => {
    try {
      const res = await fetch("/api/social/ideas");
      const data = await res.json();
      setIdeas(data.ideas ?? []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchIdeas(); const id = setInterval(fetchIdeas, 10000); return () => clearInterval(id); }, []);

  const likeIdea = async (id: string) => {
    await fetch(`/api/social/ideas/${id}/like`, { method: "POST" });
    fetchIdeas();
  };

  const submitIdea = async () => {
    if (!newIdea.note.trim()) return;
    setSubmitting(true);
    await fetch("/api/social/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ symbol: newIdea.symbol, direction: newIdea.direction === "BUY" ? "LONG" : "SHORT", note: newIdea.note }),
    });
    setNewIdea({ symbol: "EURUSD", direction: "BUY", note: "" });
    setSubmitting(false);
    fetchIdeas();
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Trade Ideas</h1>
              <p className="text-xs text-muted-foreground">{liveUsers} traders online</p>
            </div>
          </div>
          <span className="px-2 py-1 bg-green-500/10 text-green-500 text-xs rounded-full flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" /> Live
          </span>
        </div>

        <div className="bg-card border border-border rounded-xl p-4 space-y-3">
          <div className="flex gap-2">
            <select value={newIdea.symbol} onChange={e => setNewIdea({ ...newIdea, symbol: e.target.value })} className="px-3 py-2 rounded-lg border border-border bg-input text-sm">
              {["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "AUDUSD"].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <div className="flex rounded-lg border border-border overflow-hidden">
              <button onClick={() => setNewIdea({ ...newIdea, direction: "BUY" })} className={cn("px-4 py-2 text-sm font-medium", newIdea.direction === "BUY" ? "bg-green-600 text-white" : "hover:bg-secondary")}>
                <TrendingUp className="w-4 h-4" />
              </button>
              <button onClick={() => setNewIdea({ ...newIdea, direction: "SELL" })} className={cn("px-4 py-2 text-sm font-medium", newIdea.direction === "SELL" ? "bg-red-600 text-white" : "hover:bg-secondary")}>
                <TrendingDown className="w-4 h-4" />
              </button>
            </div>
          </div>
          <textarea value={newIdea.note} onChange={e => setNewIdea({ ...newIdea, note: e.target.value })} placeholder="Share your trade idea..." className="w-full px-3 py-2 rounded-lg border border-border bg-input text-sm resize-none h-20 focus:outline-none focus:ring-2 focus:ring-ring" />
          <button onClick={submitIdea} disabled={submitting || !newIdea.note.trim()} className="px-6 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Post Idea
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">Loading ideas…</div>
        ) : ideas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Sparkles className="w-8 h-8 mb-2 opacity-50" />
            <p>No ideas yet. Be the first to share!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea, i) => (
              <motion.div key={idea.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="bg-card border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary">
                      {idea.author.fullName?.[0] ?? idea.author.id[0]}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{idea.author.fullName ?? "Trader"}</p>
                      <p className="text-xs text-muted-foreground">{new Date(idea.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-muted">{idea.symbol}</span>
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", idea.direction === "BUY" ? "bg-green-600/20 text-green-600" : "bg-red-600/20 text-red-600")}>
                      {idea.direction}
                    </span>
                  </div>
                </div>
                <p className="text-sm leading-relaxed">{idea.note}</p>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <button onClick={() => likeIdea(idea.id)} className={cn("flex items-center gap-1 text-sm hover:text-red-500 transition-colors", idea.liked && "text-red-500")}>
                    <Heart className={cn("w-4 h-4", idea.liked && "fill-current")} /> {idea.likeCount}
                  </button>
                  <span className="flex items-center gap-1 text-sm"><MessageCircle className="w-4 h-4" /> {idea.commentCount}</span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}