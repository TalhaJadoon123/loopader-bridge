"""
Loopader TradingAgents Bridge — FastAPI service that wraps the TradingAgents
multi-agent framework with a REST API for the Loopader web platform.

Run locally:
    cd E:\\Entertainment\\TradingAgents
    venv\\Scripts\\python bridge.py
    → serves on http://localhost:8001

Deploy: Render free tier (Python), root = this repo.
"""
import os
import sys
import uuid
import json
import time
import threading
from datetime import datetime, timedelta
from typing import Optional

# Ensure repo root is importable
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi import FastAPI, HTTPException, BackgroundTasks, Request, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

# ── Groq key from env (fallback only — users bring their own keys) ──
os.environ.setdefault("GROQ_API_KEY", os.environ.get("GROQ_API_KEY", ""))

from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

app = FastAPI(title="Loopader TradingAgents Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Loopader web + mobile
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory job store (single-worker free tier) ──
JOBS: dict = {}

# LLM provider configuration — users bring their own keys per request
# LLM provider configuration - BYOK: users bring their own keys per request
# Supports 20+ providers + any custom OpenAI-compatible endpoint

PROVIDER_URLS = {
    "openai": "https://api.openai.com/v1",
    "groq": "https://api.groq.com/openai/v1",
    "cerebras": "https://api.cerebras.ai/v1",
    "sambanova": "https://api.sambanova.ai/v1",
    "nvidia": "https://integrate.api.nvidia.com/v1",
    "openrouter": "https://openrouter.ai/api/v1",
    "together": "https://api.together.xyz/v1",
    "deepseek": "https://api.deepseek.com/v1",
    "qwen": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4",
    "minimax": "https://api.minimax.io/v1",
    "moonshot": "https://api.moonshot.cn/v1",
    "mistral": "https://api.mistral.ai/v1",
    "perplexity": "https://api.perplexity.ai",
    "fireworks": "https://api.fireworks.ai/inference/v1",
    "xai": "https://api.x.ai/v1",
    "ollama": "http://localhost:11434/v1",
    "lmstudio": "http://localhost:1234/v1",
    "vllm": "http://localhost:8000/v1",
}

PROVIDER_MODELS = {
    "openai": "gpt-4o-mini",
    "groq": "openai/gpt-oss-20b",
    "cerebras": "llama-3.3-70b",
    "sambanova": "Meta-Llama-3.3-70B-Instruct",
    "nvidia": "nvidia/nemotron-3-ultra",
    "openrouter": "openai/gpt-4o-mini",
    "together": "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    "deepseek": "deepseek-chat",
    "qwen": "qwen-plus",
    "zhipu": "glm-4-plus",
    "minimax": "MiniMax-Text-01",
    "moonshot": "moonshot-v1-32k",
    "mistral": "mistral-large-latest",
    "perplexity": "sonar-pro",
    "fireworks": "accounts/fireworks/models/llama-v3p3-70b-instruct",
    "xai": "grok-3",
    "ollama": "llama3.3",
    "lmstudio": "local-model",
    "vllm": "custom",
}

PROVIDER_ENV_KEYS = {
    "openai": "OPENAI_API_KEY", "groq": "GROQ_API_KEY", "cerebras": "CEREBRAS_API_KEY",
    "sambanova": "SAMBANOVA_API_KEY", "nvidia": "NVIDIA_API_KEY", "openrouter": "OPENROUTER_API_KEY",
    "together": "TOGETHER_API_KEY", "deepseek": "DEEPSEEK_API_KEY", "qwen": "DASHSCOPE_API_KEY",
    "zhipu": "ZHIPU_API_KEY", "minimax": "MINIMAX_API_KEY", "moonshot": "KIMI_API_KEY",
    "mistral": "MISTRAL_API_KEY", "perplexity": "PERPLEXITY_API_KEY", "fireworks": "FIREWORKS_API_KEY",
    "xai": "XAI_API_KEY", "ollama": "OLLAMA_API_KEY", "lmstudio": "LMSTUDIO_API_KEY",
    "vllm": "VLLM_API_KEY", "custom": "OPENAI_API_KEY",
}

class AnalyzeRequest(BaseModel):
    symbol: str = Field(..., description="Ticker, e.g. AAPL, BTC-USD, NVDA, 0700.HK")
    analysis_date: Optional[str] = Field(None, description="YYYY-MM-DD; defaults to today")
    depth: int = Field(1, ge=1, le=3, description="Debate rounds (1=fast, 3=deep)")
    analysts: Optional[list[str]] = Field(
        None, description="Subset of: market, news (fewer = faster, less tokens)"
    )


class AnalyzeResponse(BaseModel):
    job_id: str
    status: str
    symbol: str


def _make_graph(depth: int, analysts: Optional[list[str]], provider: str, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None) -> TradingAgentsGraph:
    config = DEFAULT_CONFIG.copy()

    # Resolve provider settings
    llm_model = model or PROVIDER_MODELS.get(provider, "gpt-4o-mini")
    url = base_url or PROVIDER_URLS.get(provider)

    # Native providers use their own SDK routing; everything else via OpenAI-compatible
    if provider in ("openai", "anthropic", "google", "gemini"):
        config["llm_provider"] = "anthropic" if provider == "anthropic" else ("google" if provider in ("gemini", "google") else "openai")
    else:
        config["llm_provider"] = "openai_compatible"
        config["backend_url"] = url

    config["deep_think_llm"] = llm_model
    config["quick_think_llm"] = llm_model

    # Set API key env var for the framework to read
    env_var = PROVIDER_ENV_KEYS.get(provider, "OPENAI_API_KEY")
    os.environ[env_var] = api_key

    config["max_debate_rounds"] = depth
    config["max_risk_discuss_rounds"] = max(1, depth)
    selected = tuple(analysts) if analysts else ("market", "news")
    return TradingAgentsGraph(debug=False, config=config, selected_analysts=list(selected))


def _run_analysis(job_id: str, symbol: str, analysis_date: str, depth: int, analysts: Optional[list[str]], provider: str, api_key: str, model: Optional[str] = None, base_url: Optional[str] = None):
    JOBS[job_id]["status"] = "running"
    JOBS[job_id]["steps"] = []
    started = time.time()

    def log_step(step: str):
        JOBS[job_id]["steps"].append({
            "step": step,
            "at": datetime.utcnow().isoformat(),
            "elapsedSec": round(time.time() - started, 1),
        })

    try:
        log_step(f"Initializing {provider} agents (analysts, researchers, trader, risk)")
        graph = _make_graph(depth, analysts, provider, api_key, model, base_url)

        log_step("Analyst team gathering market data (prices, indicators, news, sentiment)")
        JOBS[job_id]["progress"] = 20

        state, decision = graph.propagate(symbol, analysis_date)
        JOBS[job_id]["progress"] = 85

        log_step("Research debate + risk assessment complete")
        log_step("Portfolio manager decision ready")

        # Extract a clean decision payload
        clean = decision if isinstance(decision, dict) else {"raw": str(decision)}
        action = str(clean.get("action", clean.get("decision", ""))).upper()
        if "BUY" in action and "SELL" not in action:
            signal = "BUY"
        elif "SELL" in action or "SHORT" in action:
            signal = "SELL"
        elif "HOLD" in action or action == "":
            signal = "HOLD"
        else:
            signal = "HOLD"

        JOBS[job_id].update({
            "status": "completed",
            "progress": 100,
            "result": {
                "symbol": symbol,
                "analysisDate": analysis_date,
                "signal": signal,
                "confidence": clean.get("confidence"),
                "rawDecision": clean,
                "reasoning": clean.get("reasoning") or clean.get("rationale") or clean.get("raw", ""),
            },
            "steps": JOBS[job_id]["steps"],
            "durationSec": round(time.time() - started, 1),
        })
    except Exception as e:
        JOBS[job_id].update({
            "status": "failed",
            "progress": 100,
            "error": str(e)[:500],
            "steps": JOBS[job_id]["steps"],
            "durationSec": round(time.time() - started, 1),
        })


@app.get("/")
def root():
    return {"service": "loopader-tradingagents-bridge", "status": "ok", "agents": 6}


@app.get("/health")
def health():
    return {"status": "ok", "mode": "BYOK — users bring their own API keys", "providers": list(PROVIDER_URLS.keys())}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest, request: Request):
    # Per-user LLM key from Loopader backend (BYOK model)
    llm_provider = request.headers.get("X-LLM-Provider", "groq")
    llm_key = request.headers.get("X-LLM-Key", "")
    llm_model = request.headers.get("X-LLM-Model")
    llm_base_url = request.headers.get("X-LLM-Base-URL")

    if not llm_key:
        # Fallback to server env keys
        if llm_provider == "groq" and GROQ_API_KEY:
            llm_key = GROQ_API_KEY
        else:
            raise HTTPException(status_code=401, detail="No LLM API key provided")

    symbol = req.symbol.strip().upper()
    yf_symbol = symbol
    if symbol.endswith("USD") and symbol not in ("AUDUSD", "GBPUSD", "EURUSD", "USDJPY"):
        crypto = {"BTCUSD": "BTC-USD", "ETHUSD": "ETH-USD", "SOLUSD": "SOL-USD",
                  "XRPUSD": "XRP-USD", "DOGEUSD": "DOGE-USD", "ADAUSD": "ADA-USD",
                  "LTCUSD": "LTC-USD", "LINKUSD": "LINK-USD"}
        yf_symbol = crypto.get(symbol, f"{symbol[:-3]}-USD")

    analysis_date = req.analysis_date or datetime.utcnow().strftime("%Y-%m-%d")

    job_id = uuid.uuid4().hex[:12]
    JOBS[job_id] = {
        "status": "queued",
        "progress": 0,
        "symbol": symbol,
        "steps": [],
    }

    threading.Thread(
        target=_run_analysis,
        args=(job_id, yf_symbol, analysis_date, req.depth, req.analysts, llm_provider, llm_key, llm_model, llm_base_url),
        daemon=True,
    ).start()

    return AnalyzeResponse(job_id=job_id, status="queued", symbol=symbol)


@app.get("/analyze/{job_id}")
def analyze_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")
    return job


@app.get("/jobs")
def jobs():
    return {k: {"status": v["status"], "symbol": v.get("symbol")} for k, v in JOBS.items()}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)
