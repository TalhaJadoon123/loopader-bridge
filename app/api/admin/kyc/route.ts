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

  const skip = (page - 1) * limit;

  try {
    const where: any = {};
    if (status) where.status = status;

    const [submissions, total] = await Promise.all([
      prisma.kYCSubmission.findMany({
        where,
        include: {
          user: {
            select: { email: true, fullName: true },
          },
        },
        orderBy: { submittedAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.kYCSubmission.count({ where }),
    ]);

    return NextResponse.json({
      submissions: submissions.map((s) => ({
        id: s.id,
        user: s.user,
        status: s.status,
        idFrontUrl: s.idFrontUrl,
        idBackUrl: s.idBackUrl,
        selfieUrl: s.selfieUrl,
        submittedAt: s.submittedAt.toISOString(),
        reviewedAt: s.reviewedAt?.toISOString() || null,
        reviewedBy: s.reviewedBy,
        reason: s.reason,
      })),
      total,
      page,
      limit,
    });
  } catch (e: any) {
    console.error("Admin KYC error:", e);
    return NextResponse.json({ error: "Failed to load KYC submissions" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { submissionId, action, reason } = body;
  if (!submissionId || !action) {
    return NextResponse.json({ error: "Missing submissionId or action" }, { status: 400 });
  }

  if (action !== "approve" && action !== "reject") {
    return NextResponse.json({ error: "Action must be 'approve' or 'reject'" }, { status: 400 });
  }

  if (action === "reject" && (!reason || reason.trim().length < 3)) {
    return NextResponse.json({ error: "Rejection reason required (min 3 chars)" }, { status: 400 });
  }

  try {
    const submission = await prisma.kYCSubmission.findUnique({ where: { id: submissionId } });
    if (!submission) {
      return NextResponse.json({ error: "Submission not found" }, { status: 404 });
    }

    if (submission.status !== "PENDING") {
      return NextResponse.json({ error: "Submission already processed" }, { status: 400 });
    }

    const newStatus = action === "approve" ? "VERIFIED" : "REJECTED";

    await prisma.$transaction(async (tx) => {
      await tx.kYCSubmission.update({
        where: { id: submissionId },
        data: {
          status: newStatus,
          reviewedAt: new Date(),
          reviewedBy: session.user.id,
          reason: reason || null,
        },
      });

      // Update user's kycStatus as well
      await tx.user.update({
        where: { id: submission.userId },
        data: { kycStatus: newStatus },
      });

      await tx.auditLog.create({
        data: {
          action: "KYC_" + action.toUpperCase(),
          userId: submission.userId,
          payload: {
            submissionId,
            action,
            reason: reason || null,
            adminId: session.user.id,
          },
        },
      });
    });

    return NextResponse.json({ success: true, status: newStatus });
  } catch (e: any) {
    console.error("Admin KYC action error:", e);
    return NextResponse.json({ error: "Failed to process KYC action" }, { status: 500 });
  }
}