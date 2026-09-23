import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { PrismaClient } from "@prisma/client";
import { createNotification } from "@/lib/notify";

const prisma = new PrismaClient();

export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB per image
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function validateFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) return "Only JPG, PNG or WebP images are allowed";
  if (file.size > MAX_SIZE) return "Each image must be under 2 MB";
  if (file.size < 1024) return "Image file looks invalid (too small)";
  return null;
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true, accountFrozen: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.accountFrozen) return NextResponse.json({ error: "Account is frozen" }, { status: 403 });
  if (user.kycStatus === "VERIFIED") {
    return NextResponse.json({ error: "Your identity is already verified" }, { status: 400 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const front = form.get("idFront");
  const back = form.get("idBack");
  const selfie = form.get("selfie");

  if (!(front instanceof File) || !(back instanceof File) || !(selfie instanceof File)) {
    return NextResponse.json({ error: "All three images are required: ID front, ID back, selfie" }, { status: 400 });
  }

  for (const [name, file] of [["idFront", front], ["idBack", back], ["selfie", selfie]] as const) {
    const err = validateFile(file);
    if (err) return NextResponse.json({ error: `${name}: ${err}` }, { status: 400 });
  }

  const toDataUrl = async (file: File) => {
    const buf = Buffer.from(await file.arrayBuffer());
    return `data:${file.type};base64,${buf.toString("base64")}`;
  };

  try {
    const [frontUrl, backUrl, selfieUrl] = await Promise.all([
      toDataUrl(front),
      toDataUrl(back),
      toDataUrl(selfie),
    ]);

    await prisma.user.update({
      where: { id: session.user.id },
      data: {
        idFrontUrl: frontUrl,
        idBackUrl: backUrl,
        selfieUrl: selfieUrl,
        kycStatus: "PENDING",
        kycSubmittedAt: new Date(),
        kycRejectReason: null,
      },
    });

    await createNotification(
      session.user.id,
      "kyc",
      "Documents submitted",
      "We received your identity documents. Verification is usually completed within 24 hours."
    );

    return NextResponse.json({ success: true, status: "PENDING" }, { status: 201 });
  } catch (e) {
    console.error("KYC upload failed:", e);
    return NextResponse.json({ error: "Failed to process upload" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { kycStatus: true, kycSubmittedAt: true, kycReviewedAt: true, kycRejectReason: true },
  });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json({
    kycStatus: user.kycStatus,
    kycSubmittedAt: user.kycSubmittedAt,
    kycReviewedAt: user.kycReviewedAt,
    kycRejectReason: user.kycRejectReason,
  });
}
