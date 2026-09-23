import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { startRegistration, finishRegistration } from "@/lib/auth/webauthn";
import { PrismaClient, Prisma } from "@prisma/client";
import { z } from "zod";

const startSchema = z.object({ userName: z.string().email(), displayName: z.string().min(1).max(100) });
const finishSchema = z.object({ deviceFingerprint: z.string().optional() });

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (action === "start") {
    const parse = startSchema.safeParse(body);
    if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    const options = await startRegistration(session.user.id, parse.data.userName, parse.data.displayName);
    return NextResponse.json(options);
  }

  if (action === "finish") {
    const parse = finishSchema.safeParse(body);
    if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });
    const result = await finishRegistration(session.user.id, body, parse.data.deviceFingerprint);
    return NextResponse.json(result);
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passkeyEnabled: false, passkeyCredentials: Prisma.JsonNull },
  });
  return NextResponse.json({ success: true });
}