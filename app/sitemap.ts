import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://loopader.vercel.app";
  const routes = [
    "", "/login", "/register", "/markets", "/news", "/education",
    "/challenges", "/tools", "/developers", "/legal/terms",
    "/legal/privacy", "/legal/risk", "/legal/aml",
  ];
  return routes.map(route => ({
    url: `${base}${route}`,
    lastModified: new Date(),
    changeFrequency: route === "" ? "daily" : "weekly",
    priority: route === "" ? 1.0 : route === "/markets" || route === "/trade" ? 0.9 : 0.7,
  }));
}