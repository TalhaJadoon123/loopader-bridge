import { NextResponse } from "next/server";
import { ASSETS } from "@/lib/trading/assets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cls = searchParams.get("class");

  // For demo: use cached quote prices if available; otherwise generate deterministic pseudo-changes
  // In production this is replaced by live quote data from Redis
  const classes = cls ? [cls] : ["forex", "commodity", "index", "crypto", "stock"];

  const heatmap = classes.flatMap(c => {
    return Object.values(ASSETS)
      .filter(a => a.class === c)
      .map(a => {
        const seed = (a.symbol.charCodeAt(0) * 31 + a.symbol.charCodeAt(1)) % 200 - 100;
        const changePct = Math.round(seed * 10) / 100;
        return {
          symbol: a.symbol,
          name: a.name,
          class: a.class,
          changePct,
          // Heatmap intensity: 0 (flat) → 100 (extreme move)
          intensity: Math.min(100, Math.abs(changePct) * 10),
          direction: changePct >= 0 ? "up" : "down",
        };
      })
      .sort((a, b) => a.changePct - b.changePct);
  });

  return NextResponse.json({ heatmap, generatedAt: new Date().toISOString() });
}