import { NextResponse } from "next/server";
import { fetchQuotes } from "@/lib/market-data";
import { z } from "zod";

const querySchema = z.object({
  symbols: z.string().transform((s) => s.split(",").map((x) => x.trim().toUpperCase())),
});

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parse = querySchema.safeParse({ symbols: searchParams.get("symbols") ?? "" });
  if (!parse.success) return NextResponse.json({ error: "Invalid symbols" }, { status: 400 });

  const quotes = await fetchQuotes(parse.data.symbols);
  return NextResponse.json({ quotes });
}