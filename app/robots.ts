import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin", "/api/", "/dashboard", "/trade", "/wallet", "/security", "/settings", "/notifications"] },
    ],
    sitemap: "https://loopader.vercel.app/sitemap.xml",
  };
}