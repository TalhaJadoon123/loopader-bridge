"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, Users, TrendingUp, Medal, Target, Sparkles, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Challenge { id: string; title: string; description: string; type: string; prize: string; startsAt: string; endsAt: string; participantCount: number; joined: boolean; participants: any[]; }
interface MyEntry { challengeId: string; title: string; score: number; rank: number | null; status: string; }

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [myEntries, setMyEntries] = useState<MyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/challenges");
      const data = await res.json();
      setChallenges(data.challenges ?? []);
      setMyEntries(data.myEntries ?? []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const joinChallenge = async (id: string) => {
    setJoining(id);
    await fetch("/api/challenges", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId: id }) });
    setJoining(null);
    fetchData();
  };

  const active = challenges.filter(c => new Date(c.startsAt) < new Date() && new Date(c.endsAt) > new Date());
  const upcoming = challenges.filter(c => new Date(c.startsAt) > new Date());

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Trophy className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Trading Challenges</h1>
            <p className="text-sm text-muted-foreground">Compete, win prizes, prove you&apos;re the best trader</p>
          </div>
        </div>

        {myEntries.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-4">
            <h2 className="font-semibold mb-3 flex items-center gap-2"><Medal className="w-5 h-5 text-yellow-500" /> My Rankings</h2>
            <div className="space-y-2">
              {myEntries.map(e => (
                <div key={e.challengeId} className="flex items-center justify-between text-sm">
                  <span>{e.title}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-muted-foreground">Score: {e.score.toFixed(0)}</span>
                    <span className="font-medium">{e.rank ? `#${e.rank}` : "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Sparkles className="w-5 h-5 text-green-500" /> Active Challenges</h2>
          {loading ? <div className="h-32 flex items-center justify-center">Loading…</div> :
          active.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 bg-card border border-border rounded-xl">No active challenges right now</div>
          ) : (
            <div className="space-y-4">
              {active.map(c => <ChallengeCard key={c.id} c={c} joining={joining} onJoin={joinChallenge} />)}
            </div>
          )}
        </div>

        <div>
          <h2 className="font-semibold mb-4 flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-500" /> Upcoming</h2>
          {upcoming.map(c => <ChallengeCard key={c.id} c={c} joining={joining} onJoin={joinChallenge} />)}
        </div>
      </div>
    </DashboardLayout>
  );
}

function ChallengeCard({ c, joining, onJoin }: { c: Challenge; joining: string | null; onJoin: (id: string) => void }) {
  const isActive = new Date(c.startsAt) < new Date() && new Date(c.endsAt) > new Date();
  return (
    <motion.div whileHover={{ scale: 1.01 }} className={cn("rounded-xl border p-5", isActive ? "border-primary bg-primary/5" : "border-border bg-card")}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold">{c.title}</h3>
            <span className="px-2 py-0.5 rounded text-xs bg-muted">{c.type}</span>
          </div>
          <p className="text-sm text-muted-foreground mb-2">{c.description}</p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c.participantCount}</span>
            <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> Ends {new Date(c.endsAt).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-2xl font-bold text-primary">{c.prize}</div>
          <div className="text-xs text-muted-foreground mb-2">prize pool</div>
          {c.joined ? (
            <span className="px-3 py-1 text-xs bg-green-500/15 text-green-500 rounded-lg font-medium">Joined ✓</span>
          ) : (
            <button onClick={() => onJoin(c.id)} disabled={joining === c.id} className="px-4 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg font-medium hover:opacity-90 disabled:opacity-50">
              {joining === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : "Join Now"}
            </button>
          )}
        </div>
      </div>
      {c.participants.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/50 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Top:</span>
          {c.participants.map((p, i) => (
            <span key={i} className="text-xs px-2 py-0.5 bg-muted rounded-full">
              {["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {p.name} {p.score.toFixed(0)}pts
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}