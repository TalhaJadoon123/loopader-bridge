import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";

const prisma = new PrismaClient();

const configSchema = z.object({
  provider: z.enum(["STUB", "MATCH_PRIME", "B2BROKER", "OTHER"]).optional(),
  apiKey: z.string().optional(),
  apiUrl: z.string().url().optional().or(z.literal("")),
  lpAccountId: z.string().optional(),
  enabled: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const config = await prisma.lpConfig.findFirst();
  if (!config) {
    return NextResponse.json({
      provider: "STUB",
      apiKey: "",
      apiUrl: "",
      lpAccountId: "",
      enabled: false,
    });
  }

  return NextResponse.json({
    provider: config.provider,
    apiKey: config.apiKeyEncrypted ? "****" : "",
    apiUrl: config.apiUrl,
    lpAccountId: config.lpAccountId,
    enabled: config.enabled,
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true },
  });
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = configSchema.safeParse(body);
  if (!parse.success) {
    return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });
  }

  const { provider, apiKey, apiUrl, lpAccountId, enabled } = parse.data;

  const existing = await prisma.lpConfig.findFirst();

  if (existing) {
    await prisma.lpConfig.update({
      where: { id: existing.id },
      data: {
        ...(provider && { provider }),
        ...(apiKey && { apiKeyEncrypted: encrypt(apiKey) }),
        ...(apiUrl !== undefined && { apiUrl: apiUrl || null }),
        ...(lpAccountId !== undefined && { lpAccountId: lpAccountId || null }),
        ...(enabled !== undefined && { enabled }),
      },
    });
  } else {
    if (!provider || !apiKey || !apiUrl || !lpAccountId) {
      return NextResponse.json({ error: "All fields required for initial config" }, { status: 400 });
    }
    await prisma.lpConfig.create({
      data: {
        provider,
        apiKeyEncrypted: encrypt(apiKey),
        apiUrl,
        lpAccountId,
        enabled: enabled ?? false,
      },
    });
  }

  return NextResponse.json({ success: true });
}