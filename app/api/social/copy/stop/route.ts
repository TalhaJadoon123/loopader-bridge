import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const leaderId = searchParams.get("leaderId");
  if (!leaderId) return NextResponse.json({ error: "leaderId required" }, { status: 400 });

  const rel = await prisma.copyRelationship.findUnique({
    where: { followerId_leaderId: { followerId: session.user.id, leaderId } },
  });
  if (!rel) return NextResponse.json({ error: "Not following this leader" }, { status: 404 });

  await prisma.copyRelationship.delete({ where: { id: rel.id } });

  return NextResponse.json({ success: true });
}