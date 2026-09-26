"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Users, Copy, Check, DollarSign, TrendingUp, Share2 } from "lucide-react";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface ReferralData {
  referralLink: string;
  stats: { total: number; pending: number; qualified: number; paid: number; totalBonus: number };
  referrals: any[];
}

export default function ReferralPage() {
  const [data, setData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/referral").then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const copyLink = () => {
    if (!data?.referralLink) return;
    navigator.clipboard.writeText(data.referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading…</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Refer & Earn</h1>
            <p className="text-sm text-muted-foreground">Get $10 for each friend who deposits $50+</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-primary">{data?.stats.total ?? 0}</p>
            <p className="text-xs text-muted-foreground">Total Referrals</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-yellow-500">{data?.stats.pending ?? 0}</p>
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-green-500">${data?.stats.totalBonus.toFixed(0) ?? 0}</p>
            <p className="text-xs text-muted-foreground">Earned</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-4 text-center">
            <p className="text-2xl font-bold text-purple-500">{data?.stats.paid ?? 0}</p>
            <p className="text-xs text-muted-foreground">Paid Out</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <label className="block text-sm font-medium mb-2">Your Referral Link</label>
          <div className="flex gap-2">
            <input readOnly value={data?.referralLink ?? ""} className="flex-1 px-3 py-2.5 rounded-lg border border-border bg-input text-sm font-mono focus:outline-none" />
            <button onClick={copyLink} className="px-4 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center gap-2">
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <span className="text-xs text-muted-foreground">Share via:</span>
            <a
              href={`https://wa.me/?text=${encodeURIComponent("Join Loopader — AI-powered forex trading with a free AI coach! Use my link for a bonus: " + (data?.referralLink ?? ""))}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 text-green-500 text-sm font-medium hover:bg-green-500/20"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              WhatsApp
            </a>
            <a
              href={`https://t.me/share/url?url=${encodeURIComponent(data?.referralLink ?? "")}&text=${encodeURIComponent("Join Loopader — AI-powered forex trading with a free AI coach!")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-400 text-sm font-medium hover:bg-blue-500/20"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-.633-.415-.25-.644.122-1.006.264-.259 1.485-1.393 1.66-1.594.052-.06.066-.132.035-.176-.031-.044-.12-.056-.218-.032-.146.034-.927.59-2.285 1.7-.34.286-.637.427-.893.419-.273-.007-.798-.166-1.185-.305-.478-.167-.857-.256-.827-.539.016-.146.22-.295.604-.447 2.222-.968 3.7-1.606 4.43-1.914 2.084-.882 2.515-1.034 2.796-1.039.062-.001.198.014.287.085a.31.31 0 01.099.23c.002.064.01.208.004.315z"/></svg>
              Telegram
            </a>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Join Loopader — AI-powered forex trading with a free AI coach!")}&url=${encodeURIComponent(data?.referralLink ?? "")}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-500/10 text-slate-400 text-sm font-medium hover:bg-slate-500/20"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
              X
            </a>
          </div>
        </div>

        {data?.referrals.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-muted-foreground">
            <Users className="w-12 h-12 mb-2 opacity-50" />
            <p>No referrals yet. Share your link to start earning!</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-muted-foreground">
                  <th className="p-3">Friend</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Bonus</th>
                  <th className="p-3 text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {data?.referrals.map((r: any) => (
                  <tr key={r.id} className="border-t border-border/50 hover:bg-muted/30">
                    <td className="p-3">{r.name ?? r.email.split("@")[0]}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        r.status === "PAID" ? "bg-green-600/20 text-green-600" :
                        r.status === "QUALIFIED" ? "bg-blue-600/20 text-blue-600" :
                        "bg-yellow-600/20 text-yellow-600"
                      }`}>{r.status}</span>
                    </td>
                    <td className="p-3 text-right font-mono">${r.bonusUsd.toFixed(2)}</td>
                    <td className="p-3 text-right text-muted-foreground">{new Date(r.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}