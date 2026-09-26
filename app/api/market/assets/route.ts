import { NextResponse } from "next/server";
import { ASSETS, getAssetsByClass, getPopularAssets, AssetClass } from "@/lib/trading/assets";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const cls = searchParams.get("class") as AssetClass | null;
  const popular = searchParams.get("popular") === "true";
  const search = searchParams.get("search") ?? "";

  let assets = Object.values(ASSETS);

  if (popular) assets = assets.filter(a => a.popular);
  else if (cls) assets = getAssetsByClass(cls);

  if (search) {
    const q = search.toLowerCase();
    assets = assets.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
  }

  return NextResponse.json({
    total: assets.length,
    assets: assets.map(a => ({
      symbol: a.symbol,
      name: a.name,
      class: a.class,
      exchange: a.exchange,
      pipValue: a.pipValue,
      pipDecimals: a.pipDecimals,
      minVolume: a.minVolume,
      maxVolume: a.maxVolume,
      stepVolume: a.stepVolume,
      popular: a.popular,
      description: a.description,
    })),
  });
}