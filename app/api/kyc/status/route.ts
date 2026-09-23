import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const kyc = await prisma.kYCSubmission.findUnique({
    where: { userId: session.user.id },
    select: {
      id: true,
      status: true,
      idFrontUrl: true,
      idBackUrl: true,
      selfieUrl: true,
      submittedAt: true,
      reviewedAt: true,
      reviewedBy: true,
      reason: true,
    },
  });

  return NextResponse.json(kyc ?? { status: "NOT_SUBMITTED" });
}