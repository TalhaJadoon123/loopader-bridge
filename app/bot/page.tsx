"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Key, Play, Loader2, TrendingUp, TrendingDown, Minus, Check, Trash2, Eye, EyeOff, Settings2, Brain, Globe, Search, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface ProviderDef {
  key: string; name: string; color: string; free?: boolean; custom?: boolean;
  keyHint: string; signupUrl: string; defaultModel: string; needsBaseUrl?: boolean;
}
interface ApiKey { id: string; provider: string; keyHint: string; baseUrl?: string | null; model?: string | null; isDefault: boolean; name: string; color: string; isCustom: boolean; }

const SYMBOLS = ["XAUUSD", "EURUSD", "GBPUSD", "USDJPY", "BTCUSD", "ETHUSD", "NVDA", "AAPL", "TSLA", "SPX500", "USOIL", "NAS100"];

// Client-side fallback — always available even if API fails
const FALLBACK_PROVIDERS: ProviderDef[] = [
  { key: "openai", name: "OpenAI", color: "#10a37f", keyHint: "sk-...", signupUrl: "https://platform.openai.com/api-keys", defaultModel: "gpt-4o-mini" },
  { key: "groq", name: "Groq", color: "#f55036", free: true, keyHint: "gsk_...", signupUrl: "https://console.groq.com/keys", defaultModel: "openai/gpt-oss-20b" },
  { key: "anthropic", name: "Anthropic Claude", color: "#d4a27f", keyHint: "sk-ant-...", signupUrl: "https://console.anthropic.com/keys", defaultModel: "claude-sonnet-4-20250514" },
  { key: "gemini", name: "Google Gemini", color: "#4285f4", free: true, keyHint: "AIza...", signupUrl: "https://aistudio.google.com/apikey", defaultModel: "gemini-2.0-flash" },
  { key: "nvidia", name: "NVIDIA Nemotron", color: "#76b900", free: true, keyHint: "nvapi-...", signupUrl: "https://build.nvidia.com", defaultModel: "nvidia/nemotron-3-ultra" },
  { key: "deepseek", name: "DeepSeek", color: "#4D6BFE", free: true, keyHint: "sk-...", signupUrl: "https://platform.deepseek.com", defaultModel: "deepseek-chat" },
  { key: "openrouter", name: "OpenRouter", color: "#8b5cf6", keyHint: "sk-or-...", signupUrl: "https://openrouter.ai/keys", defaultModel: "openai/gpt-4o-mini" },
  { key: "xai", name: "xAI Grok", color: "#000000", keyHint: "xai-...", signupUrl: "https://console.x.ai", defaultModel: "grok-3" },
  { key: "mistral", name: "Mistral AI", color: "#ff7000", free: true, keyHint: "...", signupUrl: "https://console.mistral.ai", defaultModel: "mistral-large-latest" },
  { key: "together", name: "Together AI", color: "#0f6fff", free: true, keyHint: "...", signupUrl: "https://api.together.ai/settings/api-keys", defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo" },
  { key: "cerebras", name: "Cerebras", color: "#f97316", free: true, keyHint: "csk-...", signupUrl: "https://cloud.cerebras.ai", defaultModel: "llama-3.3-70b" },
  { key: "qwen", name: "Qwen (Alibaba)", color: "#615ced", keyHint: "sk-...", signupUrl: "https://dashscope.console.aliyun.com", defaultModel: "qwen-plus" },
  { key: "zhipu", name: "GLM (Zhipu)", color: "#3859ff", keyHint: "…", signupUrl: "https://open.bigmodel.cn", defaultModel: "glm-4-plus" },
  { key: "minimax", name: "MiniMax", color: "#ff4d4f", keyHint: "…", signupUrl: "https://www.minimax.io", defaultModel: "MiniMax-Text-01" },
  { key: "moonshot", name: "Kimi (Moonshot)", color: "#000000", keyHint: "sk-...", signupUrl: "https://platform.moonshot.cn", defaultModel: "moonshot-v1-32k" },
  { key: "perplexity", name: "Perplexity", color: "#20808D", keyHint: "pplx-...", signupUrl: "https://www.perplexity.ai/settings/api", defaultModel: "sonar-pro" },
  { key: "fireworks", name: "Fireworks AI", color: "#8B5CF6", keyHint: "fw_...", signupUrl: "https://fireworks.ai/account/api-keys", defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct" },
  { key: "sambanova", name: "SambaNova", color: "#00A276", keyHint: "...", signupUrl: "https://cloud.sambanova.ai", defaultModel: "Meta-Llama-3.3-70B-Instruct" },
  { key: "ollama", name: "Ollama (Local)", color: "#a3a3a3", free: true, custom: true, keyHint: "optional", signupUrl: "https://ollama.com", defaultModel: "llama3.3", needsBaseUrl: true },
  { key: "lmstudio", name: "LM Studio (Local)", color: "#a3a3a3", free: true, custom: true, keyHint: "optional", signupUrl: "https://lmstudio.ai", defaultModel: "local-model", needsBaseUrl: true },
  { key: "vllm", name: "vLLM (Self-hosted)", color: "#a3a3a3", free: true, custom: true, keyHint: "optional", signupUrl: "https://docs.vllm.ai", defaultModel: "custom", needsBaseUrl: true },
  { key: "custom", name: "Custom Endpoint", color: "#6b7280", custom: true, keyHint: "any OpenAI-compatible URL", signupUrl: "", defaultModel: "custom", needsBaseUrl: true },
];

export default function BotPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [allProviders, setAllProviders] = useState<ProviderDef[]>(FALLBACK_PROVIDERS);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [showKeyForm, setShowKeyForm] = useState(false);
  const [providerSearch, setProviderSearch] = useState("");

  // Form state
  const [newProvider, setNewProvider] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newBaseUrl, setNewBaseUrl] = useState("");
  const [newModel, setNewModel] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [savingKey, setSavingKey] = useState(false);
  const [keyError, setKeyError] = useState("");
  const [keySuccess, setKeySuccess] = useState("");

  // Analysis state
  const [symbol, setSymbol] = useState("AAPL");
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<any>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState("");
  const [upgradeNeeded, setUpgradeNeeded] = useState(false);

  const fetchKeys = useCallback(async () => {
    // Get user email from session to identify them (works for OAuth users)
    let userEmail = "";
    try {
      const s = await fetch("/api/auth/session").then(r => r.json());
      userEmail = s?.user?.email ?? "";
    } catch {}
    const res = await fetch("/api/bot/keys", {
      headers: userEmail ? { "x-user-email": userEmail } : {},
    }).catch(() => null);
    if (res?.ok) {
      const data = await res.json();
      setKeys(data.keys ?? []);
      if (data.allProviders?.length > 0) {
        setAllProviders(data.allProviders);
      } else {
        setAllProviders(FALLBACK_PROVIDERS);
      }
    } else {
      setAllProviders(FALLBACK_PROVIDERS);
    }
    setLoadingKeys(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  useEffect(() => {
    if (!jobId || !analyzing) return;
    const id = setInterval(async () => {
      const res = await fetch("/api/bot/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      }).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setJob(data);
        if (data.status === "completed" || data.status === "failed") setAnalyzing(false);
      }
    }, 3000);
    return () => clearInterval(id);
  }, [jobId, analyzing]);

  const selectedDef = allProviders.find(p => p.key === newProvider);
  const needsBaseUrl = selectedDef?.needsBaseUrl || selectedDef?.custom;
  const filteredProviders = providerSearch
    ? allProviders.filter(p => p.name.toLowerCase().includes(providerSearch.toLowerCase()))
    : allProviders;

  const saveKey = async () => {
    setSavingKey(true);
    setKeyError("");
    setKeySuccess("");
    try {
      let userEmail = "";
      try {
        const s = await fetch("/api/auth/session").then(r => r.json());
        userEmail = s?.user?.email ?? "";
      } catch {}

      const res = await fetch("/api/bot/keys", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(userEmail ? { "x-user-email": userEmail } : {}),
        },
        body: JSON.stringify({
          provider: newProvider,
          apiKey: newKey.trim() || undefined,
          baseUrl: needsBaseUrl ? newBaseUrl.trim() || undefined : undefined,
          model: newModel.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setKeySuccess(`${selectedDef?.name ?? newProvider} validated and saved!`);
        setNewKey(""); setNewBaseUrl(""); setNewModel("");
        setShowKeyForm(false);
        fetchKeys();
      } else {
        setKeyError(data.error || "Failed to save key");
      }
    } catch {
      setKeyError("Network error");
    } finally {
      setSavingKey(false);
    }
  };

  const deleteKey = async (provider: string) => {
    await fetch(`/api/bot/keys?provider=${provider}`, { method: "DELETE" });
    fetchKeys();
  };

  const startAnalysis = async () => {
    setAnalyzeError(""); setAnalyzing(true); setJob(null);
    // Get user email for auth
    let userEmail = "";
    try {
      const s = await fetch("/api/auth/session").then(r => r.json());
      userEmail = s?.user?.email ?? "";
    } catch {}
    try {
      const res = await fetch("/api/bot/analyze/edge", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(userEmail ? { "x-user-email": userEmail } : {}) },
        body: JSON.stringify({ symbol }),
      });
      const data = await res.json();

      // Handle upgrade prompt
      if (res.status === 403 && data.upgrade) {
        setAnalyzeError(data.error);
        setUpgradeNeeded(true);
        setAnalyzing(false);
        return;
      }

      if (res.ok) {
        setJob({
          status: "completed",
          progress: 100,
          symbol: data.symbol,
          result: data.result,
          durationSec: null,
          provider: data.provider,
          model: data.model,
          marketData: data.marketData,
          godMode: data.godMode,
          dataSources: data.dataSources,
          steps: [
            { step: "Technical Analyst — multi-timeframe RSI, MACD, Bollinger, EMA", elapsedSec: 0 },
            { step: "News Analyst — sentiment from latest headlines", elapsedSec: 0 },
            { step: "Support/Resistance — auto-detected key levels", elapsedSec: 0 },
            { step: "Correlation Analyst — cross-asset relationships", elapsedSec: 0 },
            { step: "Bullish + Bearish Researcher — opposing debate", elapsedSec: 0 },
            { step: "Risk Manager — position sizing + final verdict", elapsedSec: 0 },
          ],
        });
        setAnalyzing(false);
      } else {
        setAnalyzeError(data.hint ?? data.error ?? "Analysis failed");
        setAnalyzing(false);
      }
    } catch { setAnalyzeError("Network error"); setAnalyzing(false); }
  };

  const hasKey = keys.length > 0;
  const freeCount = allProviders.filter(p => p.free).length;

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Bot className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">AI Trading Analyst</h1>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-yellow-500" />
              6 AI agents · {allProviders.length}+ providers · bring your own key
            </p>
          </div>
        </div>

        {/* Key setup */}

        {/* Analysis section */}
        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
            <h2 className="font-semibold flex items-center gap-2"><Brain className="w-4 h-4 text-primary" /> Run Analysis</h2>

            {upgradeNeeded && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-xl border-2 border-yellow-500/50 bg-yellow-500/5 text-center">
                <Zap className="w-8 h-8 mx-auto text-yellow-500 mb-2" />
                <p className="font-bold text-yellow-500 mb-1">GOD MODE Daily Limit Reached</p>
                <p className="text-sm text-muted-foreground mb-3">You&apos;ve used all 3 free GOD MODE analyses today.</p>
                <p className="text-sm text-yellow-500/80 mb-4">Upgrade to <strong>PRO</strong> for unlimited analyses, multi-timeframe data, correlations, and position sizing.</p>
                <Link href="/#accounts" className="inline-block px-6 py-2.5 rounded-lg bg-yellow-500 text-black font-bold hover:bg-yellow-400">
                  Upgrade to PRO — $9/mo
                </Link>
              </motion.div>
            )}
            {analyzeError && !upgradeNeeded && (
              <p className="text-sm text-destructive text-center">{analyzeError}</p>
            )}

            <div className="flex flex-wrap gap-2">
              {SYMBOLS.map(s => (
                <button
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-sm font-mono font-semibold transition-colors",
                    symbol === s ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="w-3.5 h-3.5" />
              Pipeline: Technical Analyst → News Analyst → Bullish Researcher ↔ Bearish Researcher → Trader → Risk Manager
            </div>

            <button
              onClick={startAnalysis}
              disabled={analyzing}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {analyzing ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Play className="w-4 h-4" /> Analyze {symbol}</>}
            </button>

            {analyzeError && <p className="text-sm text-destructive text-center">{analyzeError}</p>}

            {job && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <motion.div
                    animate={{ width: `${job.progress}%` }}
                    className={cn("h-full rounded-full", job.status === "failed" ? "bg-destructive" : job.status === "completed" ? "bg-green-500" : "bg-primary")}
                  />
                </div>

                {job.steps?.length > 0 && (
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1 max-h-48 overflow-y-auto">
                    {job.steps.map((s: any, i: number) => (
                      <motion.p key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-xs text-muted-foreground flex items-center gap-2">
                        <span className="text-primary">✓</span> {s.step}
                        <span className="text-muted-foreground/50 ml-auto">{s.elapsedSec}s</span>
                      </motion.p>
                    ))}
                    {analyzing && <p className="text-xs text-primary animate-pulse">Agents working…</p>}
                  </div>
                )}

                {job.status === "completed" && job.result && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className={cn(
                    "rounded-xl border-2 p-5 relative overflow-hidden",
                    job.result.signal === "BUY" ? "border-green-500/50 bg-green-500/5" :
                    job.result.signal === "SELL" ? "border-red-500/50 bg-red-500/5" :
                    "border-yellow-500/50 bg-yellow-500/5"
                  )}>
                    <div className="absolute top-2 right-3 text-[10px] font-black tracking-widest text-primary/30 select-none">GOD MODE</div>

                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <span className="text-sm text-muted-foreground">AI Verdict for {job.symbol}</span>
                        {job.marketData?.price && (
                          <p className="text-xl font-bold font-mono">${job.marketData.price}
                            <span className={cn("text-xs ml-2", (job.marketData.change ?? 0) >= 0 ? "text-up" : "text-down")}>
                              {(job.marketData.change ?? 0) >= 0 ? "+" : ""}{job.marketData.change}%
                            </span>
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <span className={cn(
                          "text-3xl font-extrabold flex items-center gap-1.5",
                          job.result.signal === "BUY" ? "text-green-500" : job.result.signal === "SELL" ? "text-red-500" : "text-yellow-500"
                        )}>
                          {job.result.signal === "BUY" ? <TrendingUp className="w-7 h-7" /> : job.result.signal === "SELL" ? <TrendingDown className="w-7 h-7" /> : <Minus className="w-7 h-7" />}
                          {job.result.signal}
                        </span>
                        {job.result.confidence != null && (
                          <p className={cn("text-xs font-mono mt-0.5", job.result.confidence >= 70 ? "text-green-500" : job.result.confidence >= 50 ? "text-yellow-500" : "text-muted-foreground")}>
                            {job.result.confidence}% confidence
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                      {[
                        { label: "Entry", value: job.result.entry, color: "text-foreground" },
                        { label: "Stop Loss", value: job.result.stopLoss, color: "text-down" },
                        { label: "TP 1", value: job.result.takeProfit1, color: "text-up" },
                        { label: "TP 2", value: job.result.takeProfit2, color: "text-up" },
                      ].map((s, i) => s.value != null && (
                        <div key={i} className="bg-muted/30 rounded-lg p-2.5 text-center">
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
                          <p className={cn("text-sm font-bold font-mono mt-0.5", s.color)}>{Number(s.value).toFixed(5)}</p>
                        </div>
                      ))}
                    </div>

                    {(job.result.positionSizeLots || job.result.riskReward || job.result.timeHorizon) && (
                      <div className="grid grid-cols-3 gap-2 mb-4">
                        {job.result.positionSizeLots && (
                          <div className="bg-primary/5 rounded-lg p-2 text-center border border-primary/20">
                            <p className="text-sm font-bold font-mono text-primary">{job.result.positionSizeLots} lots</p>
                            <p className="text-[10px] text-muted-foreground">Position Size</p>
                          </div>
                        )}
                        {job.result.riskReward && (
                          <div className="bg-muted/30 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold font-mono">{job.result.riskReward}</p>
                            <p className="text-[10px] text-muted-foreground">R:R Ratio</p>
                          </div>
                        )}
                        {job.result.timeHorizon && (
                          <div className="bg-muted/30 rounded-lg p-2 text-center">
                            <p className="text-sm font-bold font-mono capitalize">{job.result.timeHorizon}</p>
                            <p className="text-[10px] text-muted-foreground">Horizon</p>
                          </div>
                        )}
                      </div>
                    )}

                    {job.result.probability && (
                      <div className="mb-4">
                        <p className="text-xs text-muted-foreground mb-1.5">Probability Distribution</p>
                        <div className="flex h-5 rounded-lg overflow-hidden text-[10px] font-bold">
                          <div className="bg-up flex items-center justify-center text-white" style={{ width: `${job.result.probability.upside ?? 33}%` }}>
                            {(job.result.probability.upside ?? 0) > 15 && `${job.result.probability.upside}% UP`}
                          </div>
                          <div className="bg-muted flex items-center justify-center text-muted-foreground" style={{ width: `${job.result.probability.sideways ?? 34}%` }}>
                            {(job.result.probability.sideways ?? 0) > 15 && `${job.result.probability.sideways}% FLAT`}
                          </div>
                          <div className="bg-down flex items-center justify-center text-white" style={{ width: `${job.result.probability.downside ?? 33}%` }}>
                            {(job.result.probability.downside ?? 0) > 15 && `${job.result.probability.downside}% DOWN`}
                          </div>
                        </div>
                      </div>
                    )}

                    {job.result.keyLevels && (
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-down/5 border border-down/20 rounded-lg p-2.5">
                          <p className="text-[10px] text-down font-bold uppercase mb-1">Support</p>
                          <p className="text-sm font-mono text-down">{(job.result.keyLevels.support ?? []).join(" | ")}</p>
                        </div>
                        <div className="bg-up/5 border border-up/20 rounded-lg p-2.5">
                          <p className="text-[10px] text-up font-bold uppercase mb-1">Resistance</p>
                          <p className="text-sm font-mono text-up">{(job.result.keyLevels.resistance ?? []).join(" | ")}</p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2 mb-4">
                      {[
                        { label: "Technical Analysis", value: job.result.technical },
                        { label: "News Impact", value: job.result.news },
                        { label: "Bull Case", value: job.result.bullCase },
                        { label: "Bear Case", value: job.result.bearCase },
                        { label: "Risk Warning", value: job.result.riskNote },
                      ].filter(s => s.value).map((s, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                          className="bg-muted/20 rounded-lg px-3 py-2">
                          <p className="text-xs text-slate-300 leading-relaxed">
                            <span className="font-semibold text-foreground">{s.label}:</span> {String(s.value).slice(0, 250)}
                          </p>
                        </motion.div>
                      ))}
                    </div>

                    {job.result.reasoning && (
                      <div className="text-sm text-slate-200 bg-background/60 rounded-lg p-4 border border-border/50 whitespace-pre-wrap leading-relaxed">
                        {String(job.result.reasoning).slice(0, 600)}
                      </div>
                    )}

                    <div className="flex items-center justify-end text-xs text-muted-foreground mt-3 pt-3 border-t border-border/30">
                      <span className="text-yellow-500/70">Not financial advice</span>
                    </div>
                  </motion.div>
                )}

                {job.status === "failed" && (
                  <div className="rounded-xl border-2 border-red-500/50 bg-red-500/5 p-4">
                    <p className="text-sm text-red-400">{job.error}</p>
                    {String(job.error).includes("413") && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Groq free tier has low token limits (8K TPM). For full analysis use OpenAI, NVIDIA, DeepSeek, or another provider with higher limits.
                      </p>
                    )}
                  </div>
                )}
              </motion.div>
            )}
        </div>
      </div>
    </DashboardLayout>
  );
}
