import { NextResponse } from "next/server";
import { fetchNews } from "@/lib/market-data";

export async function GET() {
  const news = await fetchNews();
  return NextResponse.json({ news });
}