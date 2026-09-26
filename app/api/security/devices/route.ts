import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth/options";
import { getKnownDevices, revokeDevice } from "@/lib/security/advanced";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const currentFp = req.headers.get("x-device-fingerprint");
  const devices = await getKnownDevices(session.user.id, currentFp ?? "");

  return NextResponse.json({ devices });
}

export async function DELETE(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const deviceId = searchParams.get("deviceId");
  if (!deviceId) return NextResponse.json({ error: "deviceId required" }, { status: 400 });

  const ok = await revokeDevice(session.user.id, deviceId);
  return NextResponse.json({ success: ok });
}