import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  metadataBase: new URL("https://loopader.vercel.app"),
  title: {
    default: "Loopader — AI-Powered Forex Trading Platform",
    template: "%s | Loopader"
  },
  description: "Trade forex, gold, crypto & stocks with an AI coach, passkey security, copy trading, market sentiment & 1:3000 leverage. Start free with $10,000 practice.",
  keywords: ["forex trading", "AI trading coach", "copy trading", "gold trading", "crypto trading", "forex Pakistan", "JazzCash forex", "EasyPaisa forex", "passkey trading", "1:3000 leverage"],
  openGraph: {
    title: "Loopader — AI-Powered Forex Trading",
    description: "AI coach, copy trading, passkey security, market mood & 169 instruments. Start free.",
    url: "https://loopader.vercel.app",
    siteName: "Loopader",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Loopader — AI-Powered Forex Trading",
    description: "AI coach, copy trading, passkey security, 169 instruments. Start free.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} min-h-screen bg-background font-sans text-foreground antialiased`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
