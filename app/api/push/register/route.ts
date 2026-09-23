import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const registerSchema = z.object({
  token: z.string().min(10).max(500),
  platform: z.enum(["mobile", "web"]).default("mobile"),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = registerSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  await prisma.pushToken.upsert({
    where: { token: parse.data.token },
    create: {
      userId: session.user.id,
      token: parse.data.token,
      platform: parse.data.platform,
    },
    update: { isActive: true, platform: parse.data.platform },
  });

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = registerSchema.pick({ token: true }).safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  await prisma.pushToken.updateMany({
    where: { token: parse.data.token, userId: session.user.id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
