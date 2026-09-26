"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { BookOpen, Search, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

const GLOSSARY = [
  { term: "Pip", def: "Smallest price movement in a currency pair. For most pairs, 1 pip = 0.0001. For JPY pairs, 1 pip = 0.01." },
  { term: "Spread", def: "The difference between the bid (sell) and ask (buy) price. The broker's fee built into every trade." },
  { term: "Leverage", def: "Borrowed capital to increase position size. 1:30 leverage means $1 controls $30. Higher leverage = higher risk." },
  { term: "Margin", def: "The amount of your own money required to open a leveraged position. The rest is provided by the broker." },
  { term: "Stop Loss (SL)", def: "An automatic order to close a trade at a specific price to limit losses. Essential risk management tool." },
  { term: "Take Profit (TP)", def: "An automatic order to close a trade at a specific price to lock in profits." },
  { term: "Lot", def: "Standardized trade size. 1 standard lot = 100,000 units of base currency. 0.1 = mini lot, 0.01 = micro lot." },
  { term: "Long / Short", def: "Long = buying (expecting price to rise). Short = selling (expecting price to fall)." },
  { term: "Drawdown", def: "The peak-to-trough decline in your account balance. A measure of risk and trading consistency." },
  { term: "Sharpe Ratio", def: "A measure of risk-adjusted return. Higher = better returns relative to the risk taken." },
  { term: "Margin Call", def: "Warning from your broker when your account equity falls below the required margin level. Act fast or positions may be closed." },
  { term: "Stop Out", def: "When the broker automatically closes your positions because your margin level fell below the minimum (usually 20%)." },
  { term: "ATR", def: "Average True Range — a measure of market volatility. Higher ATR = more price movement = wider SL needed." },
  { term: "RSI", def: "Relative Strength Index — an oscillator (0-100) measuring whether a market is overbought (>70) or oversold (<30)." },
  { term: "Market Mood", def: "Loopader's proprietary sentiment gauge. Scores -100 to +100 based on news headlines and social buzz." },
  { term: "Copy Trading", def: "Automatically mirroring another trader's positions. Your account follows their trades proportionally." },
];

const GUIDES = [
  { title: "Your First Trade", desc: "Step-by-step guide to placing your first trade on Loopader", time: "5 min" },
  { title: "Risk Management 101", desc: "How to protect your capital with proper position sizing and SL/TP", time: "10 min" },
  { title: "Understanding Leverage", desc: "How leverage works, margin requirements, and why it's a double-edged sword", time: "8 min" },
  { title: "Using the AI Coach", desc: "How to get the most out of Loopader's AI trading coach", time: "3 min" },
  { title: "Market Mood Guide", desc: "How to read and use the Market Mood sentiment gauge", time: "4 min" },
  { title: "Copy Trading Strategy", desc: "How to choose leaders and allocate capital wisely", time: "7 min" },
  { title: "Technical Analysis Basics", desc: "Understanding support, resistance, trends, and common indicators", time: "15 min" },
  { title: "Trading Psychology", desc: "Managing emotions, avoiding revenge trading, building discipline", time: "12 min" },
];

export default function EducationPage() {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = GLOSSARY.filter(g => g.term.toLowerCase().includes(search.toLowerCase()) || g.def.toLowerCase().includes(search.toLowerCase()));

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Education</h1>
            <p className="text-sm text-muted-foreground">Learn to trade smarter, not harder</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {GUIDES.map(guide => (
            <motion.div
              key={guide.title}
              whileHover={{ scale: 1.02 }}
              className="bg-card border border-border rounded-xl p-4 cursor-pointer hover:border-primary/50 transition-colors"
            >
              <p className="font-medium text-sm mb-1">{guide.title}</p>
              <p className="text-xs text-muted-foreground mb-2">{guide.desc}</p>
              <span className="text-xs text-primary">{guide.time}</span>
            </motion.div>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-4">Trading Glossary</h2>
          <div className="relative mb-4">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search terms..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-input text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="space-y-2">
            {filtered.map(item => (
              <div key={item.term} className="border-b border-border/50 last:border-0 pb-2">
                <button
                  onClick={() => setExpanded(expanded === item.term ? null : item.term)}
                  className="w-full flex items-center justify-between py-2 text-left"
                >
                  <span className="font-medium text-sm">{item.term}</span>
                  <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", expanded === item.term && "rotate-180")} />
                </button>
                {expanded === item.term && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="text-sm text-muted-foreground pb-2">
                    {item.def}
                  </motion.p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}