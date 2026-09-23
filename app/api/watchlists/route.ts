import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const createSchema = z.object({
  name: z.string().min(1).max(50).default("Default"),
  symbols: z.array(z.string()).max(50).default([]),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const lists = await prisma.watchlist.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ watchlists: lists });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const parse = createSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const list = await prisma.watchlist.create({
    data: { userId: session.user.id, name: parse.data.name, symbols: parse.data.symbols },
  });

  return NextResponse.json({ watchlist: list }, { status: 201 });
}

export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const { symbols, name } = body as { symbols?: string[]; name?: string };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const updated = await prisma.watchlist.updateMany({
    where: { id, userId: session.user.id },
    data: { ...(symbols ? { symbols } : {}), ...(name ? { name } : {}), updatedAt: new Date() },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await prisma.watchlist.deleteMany({ where: { id, userId: session.user.id } });
  return NextResponse.json({ success: true });
}