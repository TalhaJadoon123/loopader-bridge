import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");
  const status = searchParams.get("status");
  const method = searchParams.get("method");

  const skip = (page - 1) * limit;

  try {
    const where: any = {};
    if (status) where.status = status;
    if (method) where.method = method;

    const [deposits, total] = await Promise.all([
      prisma.deposit.findMany({
        where,
        include: {
          user: {
            select: { email: true, fullName: true },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.deposit.count({ where }),
    ]);

    return NextResponse.json({
      deposits: deposits.map((d) => ({
        id: d.id,
        user: d.user,
        amount: Number(d.amount),
        method: d.method,
        status: d.status,
        reference: d.reference,
        cryptoCurrency: d.cryptoCurrency,
        binancePrepayId: d.binancePrepayId,
        createdAt: d.createdAt.toISOString(),
        updatedAt: d.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (e: any) {
    console.error("Admin deposits error:", e);
    return NextResponse.json({ error: "Failed to load deposits" }, { status: 500 });
  }
}