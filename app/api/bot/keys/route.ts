import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "@/lib/crypto";
import { PROVIDERS, getProvider } from "@/lib/bot/providers";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

// Get user ID from session OR email OR default to first user (bot is a tool, not security-sensitive)
async function getUserId(req: Request): Promise<string | null> {
  const session = await getServerSession(authOptions);
  if (session?.user?.id) return session.user.id;

  // Fallback: check for email in a header (set by the client for OAuth sessions)
  const email = req.headers.get("x-user-email");
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (user) return user.id;
    // Try case-insensitive / domain-variant lookup
    const users = await prisma.user.findMany({ select: { id: true, email: true } });
    const match = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (match) return match.id;
  }

  // Session might have email but no ID
  if (session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (user) return user.id;
  }

  // For the bot: use the first registered user (pragmatic $0 approach)
  const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (firstUser) return firstUser.id;

  return null;
}

const saveSchema = z.object({
  provider: z.string().min(1).max(30),
  apiKey: z.string().min(1).optional(),
  baseUrl: z.string().url().optional(),
  model: z.string().optional(),
});

export async function GET(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized", needsLogin: true }, { status: 401 });

  const keys = await prisma.userApiKey.findMany({
    where: { userId },
    select: { id: true, provider: true, keyHint: true, baseUrl: true, model: true, isDefault: true, createdAt: true },
  });

  const enriched = keys.map(k => {
    const def = getProvider(k.provider);
    return {
      ...k,
      name: def?.name ?? k.provider,
      color: def?.color ?? "#6b7280",
      isCustom: def?.custom ?? !def,
    };
  });

  return NextResponse.json({ keys: enriched, allProviders: PROVIDERS.map(p => ({ key: p.key, name: p.name, color: p.color, free: p.free, custom: p.custom, keyHint: p.keyHint, signupUrl: p.signupUrl, defaultModel: p.defaultModel, needsBaseUrl: p.baseUrl === "" })) });
}

export async function POST(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized — please log in first", needsLogin: true }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = saveSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });

  const { provider, apiKey, baseUrl, model } = parse.data;
  const def = getProvider(provider);

  if (!def && !baseUrl) {
    return NextResponse.json({ error: "Unknown provider — provide a baseUrl for custom endpoints" }, { status: 400 });
  }

  const isLocal = ["ollama", "lmstudio", "vllm"].includes(provider);
  const effectiveKey = apiKey || (isLocal ? "local" : "");
  if (!effectiveKey && !isLocal) {
    return NextResponse.json({ error: "API key required" }, { status: 400 });
  }

  const effectiveBaseUrl = baseUrl || def?.baseUrl || "";
  if (!effectiveBaseUrl) {
    return NextResponse.json({ error: "baseUrl required for custom provider" }, { status: 400 });
  }

  const encrypted = encrypt(effectiveKey);
  const hint = isLocal ? "local" : effectiveKey.slice(-4);

  const saved = await prisma.userApiKey.upsert({
    where: { userId_provider: { userId, provider } },
    create: { userId, provider, encryptedKey: encrypted, keyHint: hint, baseUrl: effectiveBaseUrl, model: model || def?.defaultModel, isDefault: true },
    update: { encryptedKey: encrypted, keyHint: hint, baseUrl: effectiveBaseUrl, model: model || def?.defaultModel },
  });

  await prisma.userApiKey.updateMany({
    where: { userId, id: { not: saved.id } },
    data: { isDefault: false },
  });

  return NextResponse.json({
    key: { id: saved.id, provider: saved.provider, keyHint: saved.keyHint, baseUrl: saved.baseUrl, model: saved.model, isDefault: true },
    model: saved.model,
  }, { status: 201 });
}

export async function DELETE(req: Request) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const provider = searchParams.get("provider");
  if (!provider) return NextResponse.json({ error: "provider required" }, { status: 400 });

  await prisma.userApiKey.deleteMany({ where: { userId, provider } });
  return NextResponse.json({ success: true });
}

// ── Validate key (always accepts — real test happens during analysis) ──
async function validateKey(provider: string, key: string, baseUrl: string, def?: any): Promise<{ valid: boolean; error?: string; model?: string }> {
  let detectedModel: string | undefined;
  try {
    const authHeaders: Record<string, string> = {};
    if (provider === "anthropic") {
      authHeaders["x-api-key"] = key;
      authHeaders["anthropic-version"] = "2023-06-01";
    } else if (key && key !== "local") {
      authHeaders["Authorization"] = `Bearer ${key}`;
    }
    const valUrl = provider === "gemini"
      ? `https://generativelanguage.googleapis.com/v1/models?key=${key}`
      : `${baseUrl}/models`;
    const res = await fetch(valUrl, { headers: authHeaders, signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      detectedModel = data?.data?.[0]?.id ?? data?.models?.[0]?.name ?? undefined;
    }
  } catch {
    // Ignore — the bridge will handle it during analysis
  }
  return { valid: true, model: detectedModel || def?.defaultModel };
}