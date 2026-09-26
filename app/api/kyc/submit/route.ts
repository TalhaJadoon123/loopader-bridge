import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";

const prisma = new PrismaClient();

const kycSchema = z.object({
  idFrontUrl: z.string().url(),
  idBackUrl: z.string().url(),
  selfieUrl: z.string().url(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parse = kycSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: "Validation failed" }, { status: 400 });

  const { idFrontUrl, idBackUrl, selfieUrl } = parse.data;

  // Update KYCSubmission record
  await prisma.kYCSubmission.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      status: "PENDING",
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      submittedAt: new Date(),
    },
    update: {
      status: "PENDING",
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      submittedAt: new Date(),
    },
  });

  // Also update user's kycStatus
  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      kycStatus: "PENDING",
      idFrontUrl,
      idBackUrl,
      selfieUrl,
      kycSubmittedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, message: "KYC documents submitted for review" });
}