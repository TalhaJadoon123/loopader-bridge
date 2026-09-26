"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Search, TrendingUp, TrendingDown, BarChart3, Globe, Activity, Cpu, Factory } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

const CLASSES = [
  { key: "", label: "All", icon: BarChart3 },
  { key: "forex", label: "Forex", icon: Globe },
  { key: "commodity", label: "Commodities", icon: Factory },
  { key: "index", label: "Indices", icon: TrendingUp },
  { key: "crypto", label: "Crypto", icon: Activity },
  { key: "stock", label: "Stocks", icon: Cpu },
];

interface Asset { symbol: string; name: string; class: string; description: string; popular?: boolean; }

export default function MarketsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [cls, setCls] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (cls) params.set("class", cls);
    if (search) params.set("search", search);
    fetch(`/api/market/assets?${params.toString()}`).then(r => r.json()).then(d => { setAssets(d.assets ?? []); setLoading(false); }).catch(() => setLoading(false));
  }, [cls, search]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">All Markets</h1>
          <div className="relative w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search symbols..." className="w-full pl-9 pr-4 py-2 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {CLASSES.map(c => (
            <button key={c.key} onClick={() => setCls(c.key)} className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors", cls === c.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}>
              <c.icon className="w-4 h-4" /> {c.label}
            </button>
          ))}
        </div>

        {loading ? <div className="h-64 flex items-center justify-center text-muted-foreground">Loading assets…</div> : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {assets.map((a, i) => (
              <motion.div key={a.symbol} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02 }} className="bg-card border border-border rounded-xl p-4 hover:border-primary/30 cursor-pointer transition-colors">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-mono font-bold text-lg">{a.symbol}</span>
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium", a.class === "forex" ? "bg-blue-500/20 text-blue-500" : a.class === "commodity" ? "bg-yellow-500/20 text-yellow-500" : a.class === "index" ? "bg-purple-500/20 text-purple-500" : a.class === "crypto" ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500")}>{a.class}</span>
                </div>
                <p className="text-sm text-muted-foreground truncate">{a.name}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{a.description}</p>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}