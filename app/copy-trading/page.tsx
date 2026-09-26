"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, TrendingUp, Target, Shield, Loader2, RefreshCw, Plus, X, ExternalLink, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Leader {
  id: string;
  name: string;
  email: string;
  gain30d: number;
  winRate: number;
  totalVolume: number;
  followers: number;
  isFeatured: boolean;
  isFollowing: boolean;
  riskLevel: string;
}

interface CopyRelation {
  id: string;
  leaderId: string;
  leaderName: string;
  allocationPct: number;
  riskLevel: string;
  createdAt: string;
  isActive: boolean;
}

export default function CopyTradingPage() {
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [myCopies, setMyCopies] = useState<CopyRelation[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "error" | "success" | "info"; text: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [leadersRes, copiesRes] = await Promise.all([
        fetch("/api/social/copy/leaders").catch(() => null),
        fetch("/api/social/copy/my-copies").catch(() => null),
      ]);
      if (leadersRes?.ok) setLeaders((await leadersRes.json()).leaders ?? []);
      if (copiesRes?.ok) setMyCopies((await copiesRes.json()).copies ?? []);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); const id = setInterval(fetchData, 30000); return () => clearInterval(id); }, [fetchData]);

  const followLeader = async (leaderId: string) => {
    setActionLoading(leaderId);
    setMsg(null);
    try {
      const res = await fetch("/api/social/copy/follow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaderId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not follow");
      setMsg({ type: "success", text: "Now copying this trader." });
      fetchData();
    } catch (e: any) {
      setMsg({ type: "error", text: e.message ?? "Failed to follow" });
    } finally { setActionLoading(null); }
  };

  const stopCopy = async (copyId: string) => {
    setActionLoading(copyId);
    setMsg(null);
    try {
      const res = await fetch("/api/social/copy/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ copyId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not stop copying");
      setMsg({ type: "success", text: "Stopped copying." });
      fetchData();
    } catch (e: any) {
      setMsg({ type: "error", text: e.message ?? "Failed to stop" });
    } finally { setActionLoading(null); }
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div></DashboardLayout>;

  const activeCopies = myCopies.filter(c => c.isActive);
  const pastCopies = myCopies.filter(c => !c.isActive);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Users className="w-7 h-7 text-primary" /> Copy Trading</h1>
          <p className="text-muted-foreground mt-1">Discover top traders, copy their trades automatically, and manage your portfolio.</p>
        </div>

        {msg && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className={cn("px-4 py-3 rounded-lg border text-sm",
            msg.type === "error" && "bg-red-500/10 border-red-500/30 text-red-400",
            msg.type === "success" && "bg-green-500/10 border-green-500/30 text-green-500",
            msg.type === "info" && "bg-blue-500/10 border-blue-500/30 text-blue-400")}>
            {msg.text}
          </motion.div>
        )}

        {/* My Active Copies */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Link2 className="w-5 h-5 text-primary" /> My Portfolio</h2>
            {activeCopies.length > 0 && (
              <span className="px-2 py-1 bg-primary/10 text-primary text-xs font-medium rounded-full">{activeCopies.length} active</span>
            )}
          </div>

          {activeCopies.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center">
              <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-muted-foreground mb-4">You&apos;re not copying anyone yet.</p>
              <p className="text-sm text-muted-foreground/70 mb-4">Explore leaders below and start copying with one click.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {activeCopies.map((copy) => (
                <motion.div key={copy.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{copy.leaderName}</p>
                      <p className="text-xs text-muted-foreground">Allocation: {copy.allocationPct}% · Risk: {copy.riskLevel}</p>
                    </div>
                    <button onClick={() => stopCopy(copy.id)} disabled={actionLoading === copy.id} className="px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 rounded-lg border border-red-500/30 disabled:opacity-50 flex items-center gap-1">
                      <X className="w-3 h-3" /> Stop
                    </button>
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-2">
                    <span>Started {new Date(copy.createdAt).toLocaleDateString()}</span>
                    <ExternalLink className="w-3 h-3" />
                    <a href={`/social?leader=${copy.leaderId}`} className="underline hover:text-primary">View profile</a>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        {/* Past Copies */}
        {pastCopies.length > 0 && (
          <section>
            <h2 className="text-xl font-bold mb-3">Stopped Copies</h2>
            <div className="rounded-lg border border-border overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="bg-muted/50 text-left text-muted-foreground"><th className="p-3">Leader</th><th className="p-3">Allocation</th><th className="p-3">Risk</th><th className="p-3">Stopped</th></tr></thead>
                <tbody>
                  {pastCopies.map((copy) => (
                    <tr key={copy.id} className="border-t border-border/50">
                      <td className="p-3">{copy.leaderName}</td>
                      <td className="p-3">{copy.allocationPct}%</td>
                      <td className="p-3"><span className={cn("px-2 py-0.5 rounded text-xs", copy.riskLevel === "HIGH" && "bg-red-600/20 text-red-600", copy.riskLevel === "MEDIUM" && "bg-yellow-600/20 text-yellow-600", copy.riskLevel === "LOW" && "bg-green-600/20 text-green-600")}>{copy.riskLevel}</span></td>
                      <td className="p-3 text-muted-foreground">{new Date(copy.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Available Leaders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold flex items-center gap-2"><Target className="w-5 h-5 text-primary" /> Top Traders to Copy</h2>
            <button onClick={fetchData} disabled={loading} className="px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"><RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} /> Refresh</button>
          </div>

          {leaders.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground">No leaders available yet.</div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {leaders.map((leader, i) => (
                <motion.div key={leader.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className={cn("bg-card border border-border rounded-xl p-4 space-y-3", leader.isFeatured && "border-primary/30 bg-primary/5")}>
                  {leader.isFeatured && <div className="px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded">Featured</div>}
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{leader.name}</p>
                      <p className="text-xs text-muted-foreground">{leader.followers} copiers</p>
                    </div>
                    {leader.isFeatured && <Shield className="w-5 h-5 text-purple-500" />}
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div><span className="text-muted-foreground">30d Gain</span><p className={cn("font-bold font-mono", leader.gain30d >= 0 ? "text-green-500" : "text-red-500")}>{leader.gain30d >= 0 ? "+" : ""}{leader.gain30d.toFixed(1)}%</p></div>
                    <div><span className="text-muted-foreground">Win Rate</span><p className="font-bold">{leader.winRate}%</p></div>
                    <div><span className="text-muted-foreground">Volume</span><p className="font-bold">${leader.totalVolume.toLocaleString()}</p></div>
                    <div><span className="text-muted-foreground">Copiers</span><p className="font-bold">{leader.followers}</p></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn("px-2 py-0.5 rounded text-xs font-medium", leader.riskLevel === "HIGH" && "bg-red-600/20 text-red-600", leader.riskLevel === "MEDIUM" && "bg-yellow-600/20 text-yellow-600", leader.riskLevel === "LOW" && "bg-green-600/20 text-green-600")}>
                      Risk: {leader.riskLevel}
                    </span>
                  </div>
                  <div className="pt-2 border-t border-border/50">
                    {leader.isFollowing ? (
                      <button className="w-full px-3 py-2 text-sm font-medium text-red-500 hover:bg-red-500/10 rounded-lg border border-red-500/30 flex items-center justify-center gap-1" disabled>
                        <X className="w-4 h-4" /> Already copying
                      </button>
                    ) : (
                      <button onClick={() => followLeader(leader.id)} disabled={actionLoading === leader.id} className="w-full px-3 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-1">
                        {actionLoading === leader.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        {actionLoading === leader.id ? "Following..." : "Start Copying"}
                      </button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </section>

        <p className="text-xs text-muted-foreground text-center">Trading involves risk of loss. Loopader is a technology platform. Past performance does not guarantee future results.</p>
      </div>
    </DashboardLayout>
  );
}