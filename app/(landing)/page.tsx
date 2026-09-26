"use client";

import dynamic from "next/dynamic";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Shield, Users, Bot, Globe, ArrowRight, TrendingUp, Lock, Smartphone, BarChart2, Zap, Award, Menu, X } from "lucide-react";

const HeroScene = dynamic(() => import("@/components/three/CurrencySymbols").then((mod) => mod.HeroScene), {
  ssr: false,
  loading: () => <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#0d1526_0%,#070b14_60%)]" />,
});

// Animated letter-by-letter wordmark
function Wordmark() {
  const letters = "LOOPADER".split("");
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      className="flex items-center justify-center gap-[0.35em] mb-6"
      aria-label="Loopader"
    >
      {letters.map((l, i) => (
        <motion.span
          key={i}
          variants={{
            hidden: { opacity: 0, y: 40, rotateX: -90, filter: "blur(8px)" },
            visible: {
              opacity: 1,
              y: 0,
              rotateX: 0,
              filter: "blur(0px)",
              transition: { delay: 0.15 + i * 0.08, duration: 0.7, ease: [0.16, 1, 0.3, 1] },
            },
          }}
          className="text-2xl md:text-4xl font-black tracking-[0.4em] bg-gradient-to-b from-white via-emerald-200 to-emerald-500 bg-clip-text text-transparent drop-shadow-[0_0_25px_rgba(16,185,129,0.45)]"
        >
          {l}
        </motion.span>
      ))}
      <motion.span
        variants={{ hidden: { scaleX: 0 }, visible: { scaleX: 1, transition: { delay: 0.9, duration: 0.8, ease: "easeOut" } } }}
        className="absolute -bottom-2 left-1/2 -translate-x-1/2 h-px w-[120%] origin-center bg-gradient-to-r from-transparent via-emerald-400 to-transparent"
      />
    </motion.div>
  );
}

// Animated counter
function Counter({ to, suffix = "", prefix = "" }: { to: number; suffix?: string; prefix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const dur = 1600;
    const start = performance.now();
    let raf: number;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [to]);
  return <span>{prefix}{val.toLocaleString()}{suffix}</span>;
}

const FEATURES = [
  { icon: Bot, title: "AI Trading Coach", desc: "GPT-powered coach analyzes every trade and teaches you in real time — included free." },
  { icon: Shield, title: "Passkey Security", desc: "Face ID, fingerprint or hardware key. Phishing-proof login no broker offers." },
  { icon: Users, title: "Copy Trading", desc: "Mirror top performers with allocation control. Leaders earn profit share." },
  { icon: Zap, title: "Market Mood", desc: "Live sentiment gauge scoring −100 to +100 from global news flow." },
  { icon: Award, title: "Streaks & XP", desc: "Build discipline with daily streaks, missions and achievement badges." },
  { icon: Globe, title: "1:3000 Leverage", desc: "Institutional leverage with negative balance protection." },
  { icon: Smartphone, title: "Native Mobile", desc: "iOS & Android apps with biometric login and live streaming quotes." },
  { icon: BarChart2, title: "169 Instruments", desc: "Forex, gold, oil, indices, crypto and US stocks from one account." },
];

const ACCOUNT_TIERS = [
  { name: "Standard", price: "Free", spread: "0.8", commission: "None", features: ["All 169 instruments", "$10,000 practice balance", "AI Coach included", "Copy trading", "Streaks & rewards"], cta: "Start Free" },
  { name: "Raw", price: "$9/mo", spread: "0.2", commission: "None", features: ["Everything in Standard", "Ultra-low spreads", "Priority execution", "Advanced charting", "API access"], cta: "Choose Raw", featured: true },
  { name: "ECN", price: "$29/mo", spread: "0.0", commission: "$7/lot", features: ["Everything in Raw", "Zero spreads", "Direct market access", "Dedicated manager", "Custom reporting"], cta: "Choose ECN" },
];

const COMPARISON = [
  { feature: "AI Trading Coach", us: true, exness: false, ic: false, xm: false, etoro: false },
  { feature: "Passkey / Passwordless Login", us: true, exness: false, ic: false, xm: false, etoro: false },
  { feature: "Live Collaborative Charts", us: true, exness: false, ic: false, xm: false, etoro: false },
  { feature: "Market Mood Sentiment", us: true, exness: false, ic: false, xm: false, etoro: false },
  { feature: "Guaranteed Stop Loss", us: true, exness: false, ic: false, xm: false, etoro: false },
  { feature: "Binance Pay / Crypto Deposits", us: true, exness: false, ic: false, xm: false, etoro: false },
  { feature: "Copy Trading", us: true, exness: true, ic: true, xm: true, etoro: true },
  { feature: "Stock CFDs", us: true, exness: false, ic: true, xm: false, etoro: true },
  { feature: "Islamic Account (free)", us: true, exness: true, ic: true, xm: true, etoro: false },
  { feature: "Max Leverage", us: "1:3000", exness: "1:2000", ic: "1:500", xm: "1:1000", etoro: "1:30" },
];

const FAQ = [
  { q: "Is Loopader regulated?", a: "Loopader is a technology platform connecting you to licensed liquidity providers. Regulatory status varies by jurisdiction — please check your local regulations before trading." },
  { q: "How does the AI Coach work?", a: "It runs on Groq's fastest AI models. It reviews your trades, spots patterns (like revenge trading), explains concepts in plain English, and never gives financial advice guarantees." },
  { q: "What is Market Mood?", a: "A real-time sentiment gauge built from financial news headlines. It scores each instrument from −100 (extreme fear) to +100 (extreme greed) and refreshes every 15 minutes." },
  { q: "How do passkeys work?", a: "Passkeys use Face ID, fingerprint or a hardware key instead of a password. They're synced via iCloud or Google Password Manager and are immune to phishing attacks." },
  { q: "Can I start with practice funds?", a: "Yes — every account starts with a $10,000 practice balance instantly. No card required. Switch to a live account whenever you're ready." },
  { q: "What's the difference between Demo and Live accounts?", a: "Every user gets both a DEMO account ($10,000 virtual, trading enabled immediately) and a LIVE account ($0, trading disabled until LP configured). KYC is required for LIVE deposits/withdrawals but not for demo trading." },
  { q: "What are the fees?", a: "Standard: 0.8 pip spread, zero commission, free. Raw: 0.2 pips + $9/mo. ECN: 0.0 pips + $7/lot + $29/mo. No deposit fees, no inactivity fees, no hidden charges." },
];

const TICKER = [
  { sym: "EURUSD", price: "1.16194", chg: "+0.14%" },
  { sym: "GBPUSD", price: "1.35179", chg: "−0.11%" },
  { sym: "XAUUSD", price: "4,432.19", chg: "+0.45%" },
  { sym: "BTCUSD", price: "79,710", chg: "+1.12%" },
  { sym: "US30", price: "39,150", chg: "−0.08%" },
  { sym: "USOIL", price: "78.45", chg: "+0.15%" },
  { sym: "SPX500", price: "5,430", chg: "+0.31%" },
  { sym: "NAS100", price: "19,380", chg: "+0.62%" },
];

export default function LandingPage() {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const [navOpen, setNavOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main className="relative min-h-screen bg-[#070b14] text-slate-100 overflow-x-hidden">
      {/* NAV */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#070b14]/90 backdrop-blur-xl border-b border-white/5" : ""}`}>
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[0.25em] bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">
            LOOPADER
          </Link>
          <div className="hidden md:flex items-center gap-8 text-sm text-slate-300">
            <Link href="#features" className="hover:text-emerald-400 transition-colors">Features</Link>
            <Link href="#accounts" className="hover:text-emerald-400 transition-colors">Accounts</Link>
            <Link href="#comparison" className="hover:text-emerald-400 transition-colors">Compare</Link>
            <Link href="#faq" className="hover:text-emerald-400 transition-colors">FAQ</Link>
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link href="/login" className="text-sm text-slate-300 hover:text-white px-4 py-2">Log in</Link>
            <Link href="/register" className="text-sm font-semibold bg-emerald-500 text-[#070b14] px-5 py-2 rounded-lg hover:bg-emerald-400 transition-colors">
              Start Free
            </Link>
          </div>
          <button className="md:hidden p-2" onClick={() => setNavOpen(!navOpen)} aria-label="Menu">
            {navOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
        {navOpen && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="md:hidden bg-[#070b14]/98 border-b border-white/5 px-6 py-4 space-y-3">
            {["features", "accounts", "comparison", "faq"].map(s => (
              <Link key={s} href={`#${s}`} onClick={() => setNavOpen(false)} className="block capitalize text-slate-300 py-1.5">{s}</Link>
            ))}
            <Link href="/login" className="block text-slate-300 py-1.5">Log in</Link>
            <Link href="/register" className="block text-center font-semibold bg-emerald-500 text-[#070b14] px-5 py-2.5 rounded-lg">Start Free</Link>
          </motion.div>
        )}
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center">
        <HeroScene />
        {/* floating orbs */}
        <motion.div
          animate={{ x: [0, 40, 0], y: [0, -30, 0] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-[10%] w-72 h-72 rounded-full bg-emerald-500/10 blur-[100px] pointer-events-none"
        />
        <motion.div
          animate={{ x: [0, -50, 0], y: [0, 40, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-[8%] w-80 h-80 rounded-full bg-sky-500/10 blur-[110px] pointer-events-none"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#070b14]" />

        <motion.div style={{ opacity: heroOpacity }} className="relative z-10 max-w-6xl mx-auto px-6 pt-28 pb-32 text-center">
          <Wordmark />

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1, duration: 0.7 }}
            className="space-y-7"
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 text-emerald-400 text-xs font-medium border border-emerald-500/20 backdrop-blur">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              AI-powered trading — live now
            </span>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.04] text-balance">
              Trade with an unfair
              <span className="bg-gradient-to-r from-emerald-400 via-teal-300 to-sky-400 bg-clip-text text-transparent"> advantage.</span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto leading-relaxed">
              The first broker with a built-in AI coach, passkey security and live market sentiment.
              Start with $10,000 in practice funds — no card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <Link
                href="/register"
                className="group px-8 py-4 rounded-xl bg-emerald-500 text-[#070b14] font-bold text-base hover:bg-emerald-400 transition-all shadow-[0_0_40px_-8px_rgba(16,185,129,0.5)]"
              >
                Start Free — $10,000 Demo
                <ArrowRight className="w-4 h-4 ml-2 inline group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link
                href="/register"
                className="px-8 py-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur font-semibold hover:bg-white/10 transition-all"
              >
                Go Live When Ready
              </Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-2 pt-6 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Bank-grade encryption</span>
              <span className="flex items-center gap-1.5"><TrendingUp className="w-3.5 h-3.5" /> Sub-second execution</span>
              <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Negative balance protection</span>
            </div>
          </motion.div>
        </motion.div>
      </section>

      {/* STATS BAR */}
      <section className="border-y border-white/5 bg-black/30">
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { label: "Instruments", value: 169, suffix: "+" },
            { label: "Markets covered", value: 40, suffix: "+" },
            { label: "Max leverage", value: 3000, prefix: "1:", suffix: "" },
            { label: "Practice balance", value: 10000, prefix: "$", suffix: "" },
          ].map(s => (
            <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
              <p className="text-3xl md:text-4xl font-extrabold font-mono text-emerald-400">
                <Counter to={s.value} prefix={s.prefix ?? ""} suffix={s.suffix ?? ""} />
              </p>
              <p className="text-xs text-slate-500 mt-1 uppercase tracking-wider">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TICKER */}
      <section className="border-b border-white/5 bg-black/20">
        <div className="max-w-7xl mx-auto px-6 py-3 overflow-hidden">
          <div className="flex gap-10 whitespace-nowrap animate-marquee text-sm font-mono">
            {[...TICKER, ...TICKER].map((t, i) => (
              <span key={i} className="flex items-center gap-3">
                <span className="text-slate-400 font-semibold">{t.sym}</span>
                <span className="text-slate-200">{t.price}</span>
                <span className={t.chg.startsWith("+") ? "text-emerald-400" : "text-red-400"}>{t.chg}</span>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-28 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold tracking-wide uppercase mb-3">Why Loopader</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Everything. Integrated. Finally.</h2>
            <p className="text-slate-400 text-lg mt-4 max-w-2xl mx-auto">Eight features no other broker ships — designed around how traders actually behave.</p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: (i % 4) * 0.08 }}
                className="group relative bg-white/[0.03] border border-white/5 rounded-2xl p-6 hover:border-emerald-500/30 hover:bg-white/[0.05] hover:-translate-y-1 transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-5 h-5 text-emerald-400" />
                </div>
                <h3 className="font-bold mb-1.5">{f.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ACCOUNTS */}
      <section id="accounts" className="py-28 px-6 bg-gradient-to-b from-black/40 to-transparent border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold tracking-wide uppercase mb-3">Accounts</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Transparent pricing. Zero gimmicks.</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {ACCOUNT_TIERS.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className={`relative rounded-2xl p-8 border transition-all ${tier.featured ? "border-emerald-500/50 bg-emerald-500/[0.04] shadow-[0_0_60px_-20px_rgba(16,185,129,0.3)]" : "border-white/10 bg-white/[0.03] hover:border-white/20"}`}
              >
                {tier.featured && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-emerald-500 text-[#070b14] text-xs font-bold rounded-full">MOST POPULAR</div>
                )}
                <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wide">{tier.name}</h3>
                <div className="text-4xl font-extrabold mt-3">{tier.price}</div>
                <div className="text-sm text-slate-400 mt-2">{tier.spread} pips spread · {tier.commission} commission</div>
                <ul className="space-y-2.5 mt-6 mb-8">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5 text-sm text-slate-300">
                      <Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link href="/register" className={`block w-full py-3 rounded-xl font-semibold text-center transition-all ${tier.featured ? "bg-emerald-500 text-[#070b14] hover:bg-emerald-400" : "border border-white/10 bg-white/5 hover:bg-white/10"}`}>
                  {tier.cta}
                </Link>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* DEMO FIRST, LIVE WHEN READY */}
      <section className="py-28 px-6 bg-gradient-to-b from-black/40 to-transparent border-y border-white/5">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-16">
            <p className="text-emerald-400 text-sm font-semibold tracking-wide uppercase mb-3">Two Accounts. One Platform.</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Demo First, Live When Ready</h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <motion.div initial={{ opacity: 0, x: -30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 border border-yellow-500/30 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-yellow-400" />
                </div>
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-yellow-500/20 text-yellow-400 text-xs font-semibold">DEMO</span>
                  <h3 className="text-xl font-bold mt-1">Practice Account</h3>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed mb-6">
                Every user instantly gets a <strong>$10,000 practice balance</strong> with full trading features. No KYC, no deposit, no risk. Trade forex, gold, crypto, and stocks using our in-memory matching engine — zero latency, zero cost.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> $10,000 virtual balance</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> All 169 instruments</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> AI Coach included</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Copy trading enabled</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> No KYC required</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Instant reset (24h cooldown)</li>
              </ul>
            </motion.div>

            <motion.div initial={{ opacity: 0, x: 30 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} className="bg-white/[0.03] border border-white/10 rounded-2xl p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-green-400" />
                </div>
                <div>
                  <span className="inline-flex items-center px-3 py-1 rounded-full bg-green-500/20 text-green-400 text-xs font-semibold">LIVE</span>
                  <h3 className="text-xl font-bold mt-1">Real Account</h3>
                </div>
              </div>
              <p className="text-slate-400 leading-relaxed mb-6">
                Your <strong>LIVE account</strong> holds real money. Trading is <strong>disabled by default</strong> — it only enables after the operator configures a Liquidity Provider (LP) connection. KYC verification is required for deposits and withdrawals.
              </p>
              <ul className="space-y-3 text-sm text-slate-300">
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Real money, real risk</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> LP connection required</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> KYC required for deposits/withdrawals</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Binance Pay, crypto, wire deposits</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Manual withdrawal approval</li>
                <li className="flex items-center gap-2"><Check className="w-4 h-4 text-emerald-400" /> Operator controls trading toggle</li>
              </ul>
            </motion.div>
          </div>

          <div className="text-center mt-10">
            <p className="text-slate-400 mb-4 max-w-2xl mx-auto">
              Start with DEMO today. Switch to LIVE when you&apos;re ready and the operator has configured the LP.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="group px-8 py-4 rounded-xl bg-emerald-500 text-[#070b14] font-bold text-base hover:bg-emerald-400 transition-all shadow-[0_0_40px_-8px_rgba(16,185,129,0.5)]">
                Start Free — $10,000 Demo
                <ArrowRight className="w-4 h-4 ml-2 inline group-hover:translate-x-0.5 transition-transform" />
              </Link>
              <Link href="/register" className="px-8 py-4 rounded-xl border border-white/10 bg-white/5 backdrop-blur font-semibold hover:bg-white/10 transition-all">
                Go Live When Ready
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* COMPARISON */}
      <section id="comparison" className="py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-emerald-400 text-sm font-semibold tracking-wide uppercase mb-3">Head to head</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">We win where it matters.</h2>
          </motion.div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-sm min-w-[720px]">
              <thead>
                <tr className="bg-white/5 border-b border-white/10">
                  <th className="p-4 text-left font-semibold text-slate-400">Feature</th>
                  <th className="p-4 text-center font-bold text-emerald-400 bg-emerald-500/[0.06]">Loopader</th>
                  <th className="p-4 text-center font-semibold text-slate-400">Exness</th>
                  <th className="p-4 text-center font-semibold text-slate-400">IC Markets</th>
                  <th className="p-4 text-center font-semibold text-slate-400">XM</th>
                  <th className="p-4 text-center font-semibold text-slate-400">eToro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="p-4 font-medium">{row.feature}</td>
                    <td className="p-4 text-center font-bold text-emerald-400 bg-emerald-500/[0.06]">
                      {typeof row.us === "boolean" ? (row.us ? "✓" : "—") : row.us}
                    </td>
                    {[row.exness, row.ic, row.xm, row.etoro].map((v, j) => (
                      <td key={j} className="p-4 text-center text-slate-500">
                        {typeof v === "boolean" ? (v ? "✓" : "—") : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-28 px-6 bg-gradient-to-b from-black/40 to-transparent">
        <div className="max-w-3xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="text-center mb-14">
            <p className="text-emerald-400 text-sm font-semibold tracking-wide uppercase mb-3">FAQ</p>
            <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">Questions, answered.</h2>
          </motion.div>
          <div className="space-y-3">
            {FAQ.map((item, i) => (
              <details key={i} className="group bg-white/[0.03] border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-colors">
                <summary className="flex items-center justify-between p-5 cursor-pointer list-none">
                  <span className="font-semibold">{item.q}</span>
                  <span className="text-emerald-400 transition-transform group-open:rotate-180 text-xs">▼</span>
                </summary>
                <p className="px-5 pb-5 text-slate-400 leading-relaxed text-sm">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-28 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}>
            <h2 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-6">
              Your edge starts <span className="bg-gradient-to-r from-emerald-400 to-sky-400 bg-clip-text text-transparent">today.</span>
            </h2>
            <p className="text-xl text-slate-400 mb-10">Two minutes to set up. $10,000 to practice with. Zero reasons not to.</p>
            <Link href="/register" className="inline-block px-10 py-4 rounded-xl bg-emerald-500 text-[#070b14] font-bold text-lg hover:bg-emerald-400 transition-all shadow-[0_0_50px_-10px_rgba(16,185,129,0.6)]">
              Create Free Account
            </Link>
          </motion.div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-14 px-6 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            <div>
              <h4 className="font-black tracking-[0.2em] mb-4 text-sm bg-gradient-to-r from-white to-emerald-400 bg-clip-text text-transparent">LOOPADER</h4>
              <p className="text-slate-500 text-sm leading-relaxed">AI-powered trading for the next generation. Built in Pakistan, made for the world.</p>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">Platform</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/trade" className="hover:text-emerald-400">Trade</Link></li>
                <li><Link href="/markets" className="hover:text-emerald-400">Markets</Link></li>
                <li><Link href="/coach" className="hover:text-emerald-400">AI Coach</Link></li>
                <li><Link href="/social" className="hover:text-emerald-400">Copy Trading</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">Learn</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/education" className="hover:text-emerald-400">Academy</Link></li>
                <li><Link href="/tools" className="hover:text-emerald-400">Calculators</Link></li>
                <li><Link href="/developers" className="hover:text-emerald-400">API Docs</Link></li>
                <li><Link href="/news" className="hover:text-emerald-400">Market News</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4 text-sm">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/legal/terms" className="hover:text-emerald-400">Terms of Service</Link></li>
                <li><Link href="/legal/privacy" className="hover:text-emerald-400">Privacy Policy</Link></li>
                <li><Link href="/legal/risk" className="hover:text-emerald-400">Risk Disclosure</Link></li>
                <li><Link href="/legal/aml" className="hover:text-emerald-400">AML / KYC Policy</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/5 text-center text-xs text-slate-600 space-y-2">
            <p className="text-amber-500/70 max-w-4xl mx-auto leading-relaxed">
              Trading involves a high level of risk and may not be suitable for all investors. Loopader is a technology platform. Real-money trading is enabled only after LP configuration. Past performance does not guarantee future results.
            </p>
            <p>© 2026 Loopader. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}