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
  const search = searchParams.get("search");
  const route = searchParams.get("route");
  const flag = searchParams.get("flag");

  const skip = (page - 1) * limit;

  try {
    const where: any = {};
    if (search) {
      where.user = { OR: [{ email: { contains: search, mode: "insensitive" } }, { fullName: { contains: search, mode: "insensitive" } }] };
    }
    if (route) where.recommendedRoute = route;
    if (flag === "revenge") where.revengeFlag = true;
    if (flag === "anomaly") where.anomalyFlag = true;
    if (flag === "none") { where.revengeFlag = false; where.anomalyFlag = false; }

    const [profiles, total] = await Promise.all([
      prisma.aiRiskProfile.findMany({
        where,
        include: { user: { select: { email: true, fullName: true } } },
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.aiRiskProfile.count({ where }),
    ]);

    return NextResponse.json({
      profiles: profiles.map((p) => ({
        id: p.id,
        userId: p.userId,
        user: p.user,
        profitabilityScore: p.profitabilityScore,
        revengeFlag: p.revengeFlag,
        anomalyFlag: p.anomalyFlag,
        recommendedRoute: p.recommendedRoute,
        reason: p.reason,
        updatedAt: p.updatedAt.toISOString(),
      })),
      total,
      page,
      limit,
    });
  } catch (e: any) {
    console.error("Admin risk profiles error:", e);
    return NextResponse.json({ error: "Failed to load risk profiles" }, { status: 500 });
  }
}