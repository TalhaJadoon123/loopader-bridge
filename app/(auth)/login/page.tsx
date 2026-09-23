"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { signIn } from "next-auth/react";
import { Fingerprint, Lock, Mail, Eye, EyeOff, Loader2, Shield, ArrowRight } from "lucide-react";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [totp, setTotp] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await signIn("credentials", {
      redirect: false,
      email,
      password,
      totp: totp || undefined,
      turnstileToken: "bypassed-for-demo",
    });

    setLoading(false);

    if (result?.error === "REQUIRES_2FA") {
      setRequires2FA(true);
      return;
    }

    if (result?.ok) {
      try {
        const s = await fetch("/api/auth/session").then(r => r.json());
        if (s?.user?.email && s.user.emailVerified === false) {
          router.push(`/verify-otp?email=${encodeURIComponent(s.user.email)}`);
          return;
        }
      } catch {}
      router.push("/dashboard");
      router.refresh();
    } else {
      setError("Invalid email or password");
    }
  };

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Shield className="w-7 h-7 text-primary" />
          </div>
          <h1 className="text-3xl font-bold">Welcome back</h1>
          <p className="text-muted-foreground mt-2">Log in to continue trading</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-6 space-y-4">
          {requires2FA ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <Shield className="w-6 h-6 text-yellow-500" />
                </div>
                <h2 className="font-semibold">Two-factor authentication</h2>
                <p className="text-sm text-muted-foreground mt-1">Enter the code from your authenticator app</p>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={totp}
                onChange={(e) => setTotp(e.target.value.replace(/\D/g, ""))}
                placeholder="6-digit code"
                className="w-full px-4 py-3 rounded-lg border border-border bg-input text-center text-2xl font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-ring"
                autoFocus
              />
              <button
                type="submit"
                disabled={totp.length !== 6 || loading}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 mx-auto animate-spin" /> : "Verify & Log In"}
              </button>
              <button
                type="button"
                onClick={() => { setRequires2FA(false); setTotp(""); }}
                className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
              >
                Back to login
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium mb-1.5">Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    className="w-full pl-10 pr-10 py-3 rounded-lg border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg text-sm text-destructive">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email || !password}
                className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log In"}
                {!loading && <ArrowRight className="w-4 h-4" />}
              </button>

<button
                type="button"
                className="w-full py-2.5 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors flex items-center justify-center gap-2"
              >
                <Fingerprint className="w-4 h-4 text-primary" />
                Log in with Passkey
              </button>

              <OAuthButtons mode="login" />
            </>
          )}
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          New to Loopader?{" "}
          <Link href="/register" className="text-primary hover:underline font-medium">
            Create account
          </Link>
        </p>
      </motion.div>
    </main>
  );
}

