// Master LLM provider registry — all OpenAI-compatible + native providers.
// Users bring their own keys (BYOK). Mirrors opencode's provider system.

export interface ProviderDef {
  key: string;
  name: string;
  envKey: string;          // env var the TradingAgents framework expects
  baseUrl: string | null;  // null = native SDK routing
  defaultModel: string;
  keyHint: string;         // placeholder showing key format
  signupUrl: string;
  color: string;
  free?: boolean;          // has a free tier
  custom?: boolean;        // custom endpoint provider
}

export const PROVIDERS: ProviderDef[] = [
  // ── Major first-party providers ──
  { key: "openai",      name: "OpenAI",            envKey: "OPENAI_API_KEY",       baseUrl: "https://api.openai.com/v1",                defaultModel: "gpt-4o-mini",                 keyHint: "sk-...",           signupUrl: "https://platform.openai.com/api-keys",      color: "#10a37f" },
  { key: "anthropic",   name: "Anthropic Claude",  envKey: "ANTHROPIC_API_KEY",    baseUrl: null,                                       defaultModel: "claude-sonnet-4-20250514",    keyHint: "sk-ant-...",       signupUrl: "https://console.anthropic.com/keys",        color: "#d4a27f" },
  { key: "gemini",      name: "Google Gemini",     envKey: "GOOGLE_API_KEY",       baseUrl: null,                                       defaultModel: "gemini-2.0-flash",            keyHint: "AIza...",          signupUrl: "https://aistudio.google.com/apikey",        color: "#4285f4", free: true },
  { key: "xai",         name: "xAI Grok",          envKey: "XAI_API_KEY",          baseUrl: "https://api.x.ai/v1",                      defaultModel: "grok-3",                      keyHint: "xai-...",          signupUrl: "https://console.x.ai",                      color: "#000000" },

  // ── Fast inference (OpenAI-compatible) ──
  { key: "groq",        name: "Groq",              envKey: "GROQ_API_KEY",         baseUrl: "https://api.groq.com/openai/v1",           defaultModel: "openai/gpt-oss-20b",          keyHint: "gsk_...",          signupUrl: "https://console.groq.com/keys",             color: "#f55036", free: true },
  { key: "cerebras",    name: "Cerebras",          envKey: "CEREBRAS_API_KEY",     baseUrl: "https://api.cerebras.ai/v1",               defaultModel: "llama-3.3-70b",               keyHint: "csk-...",          signupUrl: "https://cloud.cerebras.ai",                 color: "#f97316", free: true },
  { key: "sambanova",   name: "SambaNova",         envKey: "SAMBANOVA_API_KEY",    baseUrl: "https://api.sambanova.ai/v1",              defaultModel: "Meta-Llama-3.3-70B-Instruct", keyHint: "...",              signupUrl: "https://cloud.sambanova.ai",                color: "#00A276" },
  { key: "nvidia",      name: "NVIDIA Nemotron",   envKey: "NVIDIA_API_KEY",       baseUrl: "https://integrate.api.nvidia.com/v1",      defaultModel: "nvidia/nemotron-3-ultra",     keyHint: "nvapi-...",        signupUrl: "https://build.nvidia.com",                  color: "#76b900", free: true },

  // ── Model aggregators ──
  { key: "openrouter",  name: "OpenRouter",        envKey: "OPENROUTER_API_KEY",   baseUrl: "https://openrouter.ai/api/v1",             defaultModel: "meta-llama/llama-3.1-8b-instruct:free",     keyHint: "sk-or-...",        signupUrl: "https://openrouter.ai/keys",                color: "#8b5cf6", free: true },
  { key: "together",    name: "Together AI",       envKey: "TOGETHER_API_KEY",     baseUrl: "https://api.together.xyz/v1",              defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo", keyHint: "...", signupUrl: "https://api.together.ai/settings/api-keys", color: "#0f6fff", free: true },

  // ── Chinese providers ──
  { key: "deepseek",    name: "DeepSeek",          envKey: "DEEPSEEK_API_KEY",     baseUrl: "https://api.deepseek.com/v1",              defaultModel: "deepseek-chat",               keyHint: "sk-...",           signupUrl: "https://platform.deepseek.com",             color: "#4D6BFE", free: true },
  { key: "qwen",        name: "Qwen (Alibaba)",    envKey: "DASHSCOPE_API_KEY",    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1", defaultModel: "qwen-plus", keyHint: "sk-...", signupUrl: "https://dashscope.console.aliyun.com",  color: "#615ced" },
  { key: "zhipu",       name: "GLM (Zhipu)",       envKey: "ZHIPU_API_KEY",        baseUrl: "https://open.bigmodel.cn/api/paas/v4",     defaultModel: "glm-4-plus",                  keyHint: "…",                signupUrl: "https://open.bigmodel.cn",                  color: "#3859ff" },
  { key: "minimax",     name: "MiniMax",           envKey: "MINIMAX_API_KEY",      baseUrl: "https://api.minimax.io/v1",                defaultModel: "MiniMax-Text-01",             keyHint: "…",                signupUrl: "https://www.minimax.io",                    color: "#ff4d4f" },
  { key: "moonshot",    name: "Kimi (Moonshot)",   envKey: "KIMI_API_KEY",         baseUrl: "https://api.moonshot.cn/v1",               defaultModel: "moonshot-v1-32k",             keyHint: "sk-...",           signupUrl: "https://platform.moonshot.cn",              color: "#000000" },

  // ── Others ──
  { key: "mistral",     name: "Mistral AI",        envKey: "MISTRAL_API_KEY",      baseUrl: "https://api.mistral.ai/v1",                defaultModel: "mistral-large-latest",        keyHint: "...",              signupUrl: "https://console.mistral.ai",                color: "#ff7000", free: true },
  { key: "perplexity",  name: "Perplexity",        envKey: "PERPLEXITY_API_KEY",   baseUrl: "https://api.perplexity.ai",                defaultModel: "sonar-pro",                   keyHint: "pplx-...",         signupUrl: "https://www.perplexity.ai/settings/api",    color: "#20808D" },
  { key: "fireworks",   name: "Fireworks AI",      envKey: "FIREWORKS_API_KEY",    baseUrl: "https://api.fireworks.ai/inference/v1",    defaultModel: "accounts/fireworks/models/llama-v3p3-70b-instruct", keyHint: "fw_...", signupUrl: "https://fireworks.ai/account/api-keys", color: "#8B5CF6" },

  // ── Custom / self-hosted (opencode-style) ──
  { key: "ollama",      name: "Ollama (Local)",    envKey: "OLLAMA_API_KEY",       baseUrl: "http://localhost:11434/v1",                defaultModel: "llama3.3",                    keyHint: "optional",         signupUrl: "https://ollama.com",                        color: "#a3a3a3", free: true },
  { key: "lmstudio",    name: "LM Studio (Local)", envKey: "LMSTUDIO_API_KEY",     baseUrl: "http://localhost:1234/v1",                 defaultModel: "local-model",                 keyHint: "optional",         signupUrl: "https://lmstudio.ai",                       color: "#a3a3a3", free: true },
  { key: "vllm",        name: "vLLM (Self-hosted)",envKey: "VLLM_API_KEY",         baseUrl: "http://localhost:8000/v1",                 defaultModel: "custom",                      keyHint: "optional",         signupUrl: "https://docs.vllm.ai",                      color: "#a3a3a3", free: true },
  { key: "custom",      name: "Custom Endpoint",   envKey: "CUSTOM_API_KEY",       baseUrl: "",                                         defaultModel: "custom",                      keyHint: "any OpenAI-compatible URL", signupUrl: "",                 color: "#6b7280", custom: true },
];

export function getProvider(key: string): ProviderDef | undefined {
  return PROVIDERS.find(p => p.key === key);
}

// Validation endpoint per provider (lightweight models list call)
export function getValidationConfig(provider: string, baseUrl?: string): { url: string; authStyle: "bearer" | "anthropic" | "gemini" | "none" } {
  const def = getProvider(provider);
  const url = baseUrl || def?.baseUrl || "";
  if (provider === "anthropic") return { url: "https://api.anthropic.com/v1/models", authStyle: "anthropic" };
  if (provider === "gemini") return { url: `https://generativelanguage.googleapis.com/v1/models?key=PLACEHOLDER`, authStyle: "gemini" };
  if (def?.free && (provider === "ollama" || provider === "lmstudio" || provider === "vllm")) return { url: `${url}/models`, authStyle: "none" };
  return { url: `${url}/models`, authStyle: "bearer" };
}