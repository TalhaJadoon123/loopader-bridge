"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Code, Copy, Check, ChevronDown, ChevronRight, BookOpen, Terminal, Server, Key, Globe, Lock, Webhook, Cpu } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

const SECTIONS = [
  {
    id: "intro",
    title: "Overview",
    icon: BookOpen,
    content: `
Loopader provides a REST API for programmatic trading, account management, and market data.
Base URL: https://loopader.com/api

All endpoints require authentication via Bearer token (JWT).
Rate limit: 100 requests/min per user on most endpoints, 60/min on trading endpoints.

Authentication: JWT token obtained via /api/auth/login.
    `,
  },
  {
    id: "auth",
    title: "Authentication",
    icon: Key,
    content: `
POST /api/auth/login
Body: { "email": "...", "password": "..." }
Response: { "access_token": "jwt...", "token_type": "bearer" }

Use the token in Authorization header: Bearer <token>
    `,
  },
  {
    id: "market",
    title: "Market Data",
    icon: Globe,
    content: `
GET /api/market/quotes?symbols=EURUSD,GBPUSD
Response: { "quotes": [{ "symbol": "EURUSD", "price": 1.08542, "change": 0.0023, "changePercent": 0.21 }] }

GET /api/market/candles?symbol=EURUSD&interval=5m
Response: { "candles": [{ "timestamp": 1700000000, "open": 1.085, "high": 1.086, "low": 1.084, "close": 1.0855 }] }

GET /api/market/sentiment?symbols=EURUSD
Response: { "sentiment": [{ "symbol": "EURUSD", "score": 45, "sourceCount": 23 }] }
    `,
  },
  {
    id: "trading",
    title: "Trading",
    icon: Terminal,
    content: `
POST /api/trade/open
Body: { "symbol": "EURUSD", "side": "BUY", "volume": 0.1, "idempotencyKey": "unique-key-123" }
Response: { "trade": { "id": "abc123", "symbol": "EURUSD", "side": "BUY", "volume": 0.1, "openPrice": 1.08542, "status": "OPEN" } }

POST /api/trade/close
Body: { "tradeId": "abc123" }
Response: { "profit": 12.50, "closePrice": 1.08650 }

GET /api/trade/positions
Response: { "positions": [{ "symbol": "EURUSD", "side": "BUY", "volume": 0.1, "unrealizedProfit": 5.20 }] }

GET /api/trade/history?limit=50&format=csv
Response: CSV file with trade history
    `,
  },
  {
    id: "account",
    title: "Account",
    icon: Server,
    content: `
GET /api/auth/session
Response: { "user": { "id": "...", "email": "...", "role": "USER", "kycStatus": "VERIFIED" } }

GET /api/analytics/portfolio
Response: { "totalTrades": 50, "winRate": 62, "totalPnL": 1250.00, "sharpe": 1.24, ... }
    `,
  },
  {
    id: "webhooks",
    title: "Webhooks",
    icon: Webhook,
    content: `
Payment webhooks (POST):
- /api/payments/jazzcash/callback
- /api/payments/easypaisa/callback
- /api/payments/nowpayments/callback
- /api/payments/stripe/webhook

All webhooks verify signatures before processing.
    `,
  },
  {
    id: "sockets",
    title: "WebSocket (Socket.io)",
    icon: Cpu,
    content: `
Connect to wss://loopader-worker.onrender.com with query: { symbol: "EURUSD" }

Events:
- "quotes": Real-time price updates every 5s
- "chart:cursor": Live cursor positions from other traders

Emit:
- "chart:join": { symbol: "EURUSD" }
- "chart:cursor": { symbol: "EURUSD", x: 0.5, y: 0.3, name: "trader", color: "#10b981" }
    `,
  },
  {
    id: "rate-limits",
    title: "Rate Limits",
    icon: Lock,
    content: `
Login: 5 requests per 15 min per IP
Trading: 60 requests per min per user
API: 100 requests per min per user

Rate limit headers:
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 45
    `,
  },
];

export default function ApiDocsPage() {
  const [expanded, setExpanded] = useState<string>("intro");
  const [copied, setCopied] = useState<string | null>(null);

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(code);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Code className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">API Documentation</h1>
            <p className="text-sm text-muted-foreground">Build on top of Loopader with our REST + WebSocket API</p>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <div className="lg:w-56 shrink-0 space-y-1">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => setExpanded(s.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left",
                  expanded === s.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                )}
              >
                <s.icon className="w-4 h-4" />
                {s.title}
              </button>
            ))}
          </div>

          <div className="flex-1 min-w-0">
            {SECTIONS.map(s => (
              expanded === s.id && (
                <motion.div key={s.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                  <h2 className="text-xl font-bold">{s.title}</h2>
                  <div className="bg-card border border-border rounded-xl p-6">
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed">{s.content.trim()}</pre>
                    <button
                      onClick={() => copyCode(s.content)}
                      className="mt-4 flex items-center gap-1 px-3 py-1.5 text-xs bg-secondary rounded-lg hover:bg-secondary/80 text-muted-foreground"
                    >
                      {copied === s.content ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied === s.content ? "Copied" : "Copy to clipboard"}
                    </button>
                  </div>
                </motion.div>
              )
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}