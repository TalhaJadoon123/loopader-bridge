import { NextResponse } from "next/server";
import { verifyRefreshToken, signAccessToken } from "@/lib/auth/mobile-jwt";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const refreshSchema = z.object({ refreshToken: z.string().min(10) });

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parse = refreshSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const payload = verifyRefreshToken(parse.data.refreshToken);
  if (!payload) return NextResponse.json({ error: "Invalid refresh token" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { id: payload.sub } });
  if (!user || user.accountFrozen) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const accessToken = signAccessToken({ id: user.id, email: user.email, role: user.role });

  return NextResponse.json({ accessToken, expiresIn: 15 * 60 });
}