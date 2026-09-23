import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const alertSchema = z.object({
  symbol: z.string().transform(s => s.toUpperCase()),
  condition: z.enum(["ABOVE", "BELOW", "CROSSES"]),
  targetPrice: z.number().positive(),
});

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const alerts = await prisma.alert.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    alerts: alerts.map(a => ({
      id: a.id,
      symbol: a.symbol,
      condition: a.condition,
      targetPrice: Number(a.targetPrice),
      isTriggered: a.isTriggered,
      createdAt: a.createdAt,
    })),
  });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = alertSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const alert = await prisma.alert.create({
    data: { userId: session.user.id, ...parse.data },
  });

  return NextResponse.json({
    alert: { id: alert.id, symbol: alert.symbol, condition: alert.condition, targetPrice: Number(alert.targetPrice) },
  }, { status: 201 });
}