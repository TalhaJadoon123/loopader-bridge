import { NextResponse } from "next/server";
import { analyzeClient } from "@/lib/ai/risk-enhancer";

const INTERNAL_API_KEY = process.env.INTERNAL_API_KEY;

export async function GET(req: Request) {
  const authHeader = req.headers.get("x-internal-api-key");
  if (!INTERNAL_API_KEY || authHeader !== INTERNAL_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  const result = await analyzeClient(userId);
  return NextResponse.json(result);
}