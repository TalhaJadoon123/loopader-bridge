"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ExternalLink, Clock, Newspaper, Loader2, TrendingUp, TrendingDown, Minus, Sparkles, BrainCircuit } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface NewsItem {
  title: string; summary: string; url: string; source: string; publishedAt: string;
  symbols: string[]; score: number; label: "bullish" | "bearish" | "neutral";
  bullishKeyword: string | null; bearishKeyword: string | null;
}
interface Overall { score: number; label: string; bullishPct: number; bearishPct: number; }

const FILTERS = [
  { key: "", label: "All", icon: Newspaper },
  { key: "bullish", label: "Bullish", icon: TrendingUp },
  { key: "bearish", label: "Bearish", icon: TrendingDown },
  { key: "neutral", label: "Neutral", icon: Minus },
];

const SYMBOL_FILTERS = ["EURUSD", "XAUUSD", "BTCUSD", "USOIL", "SPX500"];

export default function NewsPage() {
  const [items, setItems] = useState<NewsItem[]>([]);
  const [overall, setOverall] = useState<Overall | null>(null);
  const [source, setSource] = useState<"ai" | "keywords">("keywords");
  const [loading, setLoading] = useState(true);
  const [labelFilter, setLabelFilter] = useState("");
  const [symbolFilter, setSymbolFilter] = useState("");

  useEffect(() => {
    const params = new URLSearchParams();
    if (labelFilter) params.set("filter", labelFilter);
    if (symbolFilter) params.set("symbol", symbolFilter);
    fetch(`/api/news/sentiment?${params.toString()}`)
      .then(r => r.json())
      .then(d => {
        setItems(d.items ?? []);
        setOverall(d.overall ?? null);
        setSource(d.source ?? "keywords");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [labelFilter, symbolFilter]);

  const overallColor = overall?.label === "bullish" ? "text-up" : overall?.label === "bearish" ? "text-down" : "text-yellow-500";
  const overallBar = overall ? 50 + overall.score / 2 : 50;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI News Sentiment</h1>
              <p className="text-sm text-muted-foreground flex items-center gap-1.5">
                {source === "ai" ? (
                  <><Sparkles className="w-3.5 h-3.5 text-primary" /> AI-analyzed market mood</>
                ) : (
                  <>Keyword sentiment — AI warming up</>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Overall sentiment gauge */}
        {overall && (
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm">Overall Market Mood</h3>
              <span className={cn("text-2xl font-bold font-mono", overallColor)}>
                {overall.score > 0 ? "+" : ""}{overall.score}
              </span>
            </div>
            {/* Dual-direction gauge */}
            <div className="relative h-3 bg-muted rounded-full overflow-hidden flex">
              <div className="flex-1 flex justify-end">
                {overall.score < 0 && <div className="h-full bg-down rounded-l-full" style={{ width: `${Math.abs(overall.score) / 2}%` }} />}
              </div>
              <div className="w-px h-full bg-border" />
              <div className="flex-1">
                {overall.score >= 0 && <div className="h-full bg-up rounded-r-full" style={{ width: `${overall.score / 2}%` }} />}
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
              <span>−100 Fear</span>
              <span>Neutral</span>
              <span>+100 Greed</span>
            </div>
            <div className="grid grid-cols-3 gap-3 mt-4 text-center">
              <div className="bg-up/10 rounded-lg py-2">
                <p className="text-lg font-bold font-mono text-up">{overall.bullishPct}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bullish news</p>
              </div>
              <div className="bg-muted/50 rounded-lg py-2">
                <p className="text-lg font-bold font-mono">{100 - overall.bullishPct - overall.bearishPct}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Neutral</p>
              </div>
              <div className="bg-down/10 rounded-lg py-2">
                <p className="text-lg font-bold font-mono text-down">{overall.bearishPct}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Bearish news</p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map(f => (
            <button
              key={f.key}
              onClick={() => setLabelFilter(f.key)}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors",
                labelFilter === f.key ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              <f.icon className="w-3.5 h-3.5" /> {f.label}
            </button>
          ))}
          <div className="w-px h-6 bg-border mx-1" />
          {SYMBOL_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setSymbolFilter(symbolFilter === s ? "" : s)}
              className={cn(
                "px-2.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-colors",
                symbolFilter === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              )}
            >
              {s}
            </button>
          ))}
        </div>

        {/* News list */}
        {loading ? (
          <div className="flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Newspaper className="w-12 h-12 mb-3 opacity-50" />
            <p className="text-lg">No news matching filters</p>
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((n, i) => {
              const isBull = n.label === "bullish";
              const isBear = n.label === "bearish";
              return (
                <motion.article
                  key={n.url + i}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className={cn(
                    "bg-card border rounded-xl p-4 hover:border-primary/30 transition-colors relative overflow-hidden",
                    isBull ? "border-up/20" : isBear ? "border-down/20" : "border-border"
                  )}
                >
                  {/* Sentiment edge strip */}
                  <div className={cn("absolute left-0 top-0 bottom-0 w-1", isBull ? "bg-up" : isBear ? "bg-down" : "bg-muted-foreground/30")} />

                  <div className="flex items-start justify-between gap-4 pl-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2 flex-wrap">
                        <span className="font-medium text-primary">{n.source}</span>
                        <span>•</span>
                        <Clock className="w-3 h-3" />
                        <span>{new Date(n.publishedAt).toLocaleString()}</span>
                        {/* Sentiment badge */}
                        <span className={cn(
                          "flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold",
                          isBull ? "bg-up/15 text-up" : isBear ? "bg-down/15 text-down" : "bg-muted text-muted-foreground"
                        )}>
                          {isBull ? <TrendingUp className="w-3 h-3" /> : isBear ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          {n.score > 0 ? "+" : ""}{n.score}
                        </span>
                      </div>

                      <h3 className="font-semibold mb-1 leading-snug">{n.title}</h3>
                      <p className="text-sm text-muted-foreground line-clamp-2">{n.summary}</p>

                      {/* AI keywords */}
                      {(n.bullishKeyword || n.bearishKeyword) && (
                        <div className="flex flex-wrap items-center gap-2 mt-2 text-xs">
                          {n.bullishKeyword && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-up/10 text-up font-mono">
                              ▲ {n.bullishKeyword}
                            </span>
                          )}
                          {n.bearishKeyword && (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-down/10 text-down font-mono">
                              ▼ {n.bearishKeyword}
                            </span>
                          )}
                        </div>
                      )}

                      {n.symbols.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {n.symbols.map(s => (
                            <button
                              key={s}
                              onClick={() => setSymbolFilter(symbolFilter === s ? "" : s)}
                              className="px-2 py-0.5 rounded text-xs font-mono font-medium bg-muted hover:bg-secondary transition-colors"
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <a
                      href={n.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}