import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { isMt5Enabled } from "@/lib/mt5/metaapi";
import { encrypt } from "@/lib/crypto";
import { z } from "zod";
import { logSecurityEvent } from "@/lib/security/risk";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const connectSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  server: z.string().min(1),
  brokerName: z.string().min(1),
  accountType: z.enum(["real", "demo"]).default("real"),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accounts = await prisma.mt5Account.findMany({
    where: { userId: session.user.id, isActive: true },
    orderBy: { createdAt: "desc" },
    select: { id: true, login: true, server: true, brokerName: true, accountType: true, balance: true, equity: true, currency: true, lastSyncedAt: true },
  });

  return NextResponse.json({ accounts, mt5Enabled: isMt5Enabled() });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!isMt5Enabled()) {
    return NextResponse.json({ error: "MT5 integration not configured", hint: "Set METAAPI_TOKEN (free at app.metaapi.cloud)" }, { status: 503 });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = connectSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed", details: parse.error.flatten() }, { status: 400 });

  const { login, password, server, brokerName, accountType } = parse.data;

  // Enforce account limit on free tier
  const count = await prisma.mt5Account.count({ where: { userId: session.user.id, isActive: true } });
  if (count >= 3) return NextResponse.json({ error: "Max 3 MT5 accounts per user" }, { status: 400 });

  // Import lazily so the SDK only loads when configured
  const { provisionMt5Account } = await import("@/lib/mt5/metaapi");

  try {
    const account = await provisionMt5Account(session.user.id, { login, password, server, accountType });

    const mt5 = await prisma.mt5Account.create({
      data: {
        userId: session.user.id,
        metaapiId: account.id,
        login,
        server,
        brokerName,
        accountType,
        isActive: true,
      },
    });

    await logSecurityEvent(session.user.id, "MT5_ACCOUNT_CONNECTED", "system", "", null, null, 20);

    return NextResponse.json({
      account: { id: mt5.id, login: mt5.login, server: mt5.server, brokerName: mt5.brokerName, accountType: mt5.accountType },
    }, { status: 201 });
  } catch (e: any) {
    console.error("[mt5] connect failed:", e?.message ?? e);
    return NextResponse.json({ error: e?.message?.slice(0, 200) ?? "MT5 connection failed — check login/password/server" }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await prisma.mt5Account.updateMany({
    where: { id, userId: session.user.id },
    data: { isActive: false },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}