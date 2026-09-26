import { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Loopader — AI Forex Trading",
    short_name: "Loopader",
    description: "Trade forex with an AI coach, passkey security, copy trading and market mood sentiment.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0f1a",
    theme_color: "#0a0f1a",
    orientation: "portrait-primary",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
    ],
    shortcuts: [
      { name: "Trade", url: "/trade" },
      { name: "Wallet", url: "/wallet" },
      { name: "AI Coach", url: "/coach" }
    ],
    categories: ["finance", "productivity"]
  };
}