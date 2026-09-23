import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { getUserApiKey } from "@/lib/bot/keys";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const BRIDGE_URL = process.env.TRADINGAGENTS_BRIDGE_URL ?? "http://localhost:8001";

export async function POST(req: Request) {
  // Get user — session, email header, or default first user
  const session = await getServerSession(authOptions);
  let userId = session?.user?.id;

  if (!userId && session?.user?.email) {
    const user = await prisma.user.findUnique({ where: { email: session.user.email }, select: { id: true } });
    if (user) userId = user.id;
  }

  if (!userId) {
    const email = req.headers.get("x-user-email");
    if (email) {
      const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (user) userId = user.id;
    }
  }

  if (!userId) {
    const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
    if (firstUser) userId = firstUser.id;
  }

  if (!userId) return NextResponse.json({ error: "No users found" }, { status: 401 });

  // Get the user's API key
  const userKey = await getUserApiKey(userId);
  if (!userKey) {
    return NextResponse.json({
      error: "No API key configured",
      hint: "Add your LLM provider API key in the Bot settings to use the AI Analyst",
    }, { status: 400 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const { symbol, depth, analysts, action } = body as {
    symbol: string;
    depth?: number;
    analysts?: string[];
    action?: string;
  };

  if (action === "status" || (body as any).jobId) {
    // Poll job status
    const { jobId } = body as { jobId: string };
    if (!jobId) return NextResponse.json({ error: "jobId required" }, { status: 400 });
    const res = await fetch(`${BRIDGE_URL}/analyze/${jobId}`, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) return NextResponse.json({ error: "Bridge error" }, { status: res.status });
    return NextResponse.json(await res.json());
  }

  if (!symbol) return NextResponse.json({ error: "symbol required" }, { status: 400 });

  // Start analysis — pass user's key + provider config to the bridge
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-LLM-Provider": userKey.provider,
      "X-LLM-Key": userKey.key,
    };
    if (userKey.baseUrl) headers["X-LLM-Base-URL"] = userKey.baseUrl;
    if (userKey.model) headers["X-LLM-Model"] = userKey.model;

    const res = await fetch(`${BRIDGE_URL}/analyze`, {
      method: "POST",
      headers,
      body: JSON.stringify({ symbol, depth: depth ?? 1, analysts }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return NextResponse.json({ error: err.detail ?? "Bridge error" }, { status: res.status });
    }

    return NextResponse.json(await res.json());
  } catch (e: any) {
    return NextResponse.json({
      error: "Trading bot service unavailable — is the bridge running?",
      hint: "Deploy bridge.py to Render or run locally on port 8001",
    }, { status: 503 });
  }
}
