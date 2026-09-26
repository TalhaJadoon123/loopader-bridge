import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const patchSchema = z.object({ isTriggered: z.boolean() });

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted = await prisma.alert.deleteMany({ where: { id: params.id, userId: session.user.id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = patchSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const updated = await prisma.alert.updateMany({
    where: { id: params.id, userId: session.user.id },
    data: { isTriggered: parse.data.isTriggered },
  });
  if (updated.count === 0) return NextResponse.json({ error: "Alert not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}