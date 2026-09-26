import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { cookies } from "next/headers";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { accountId: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { accountId } = body;
  if (!accountId) return NextResponse.json({ error: "accountId required" }, { status: 400 });

  // Verify account belongs to user
  const account = await prisma.tradingAccount.findFirst({
    where: { id: accountId, userId: session.user.id, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  // Update isDefault: set true for selected, false for others
  await prisma.tradingAccount.updateMany({
    where: { userId: session.user.id, isActive: true },
    data: { isDefault: false },
  });

  await prisma.tradingAccount.update({
    where: { id: accountId },
    data: { isDefault: true },
  });

  // Set cookie for server-side reads
  const cookieStore = await cookies();
  cookieStore.set("active_account_id", accountId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
  });

  return NextResponse.json({ account: { ...account, isDefault: true } });
}