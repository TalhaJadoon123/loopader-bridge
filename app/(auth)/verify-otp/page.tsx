"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, MailCheck, Smartphone, RefreshCw, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "email" | "phone" | "phone-input";

export default function VerifyOtpPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");

  // Email OTP state
  const [emailCode, setEmailCode] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [emailCooldown, setEmailCooldown] = useState(0);

  // Phone OTP state
  const [phone, setPhone] = useState("");
  const [phoneCode, setPhoneCode] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneCooldown, setPhoneCooldown] = useState(0);
  const [sentTo, setSentTo] = useState("");
  const [smsAvailable, setSmsAvailable] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setEmailCooldown(c => Math.max(0, c - 1));
      setPhoneCooldown(c => Math.max(0, c - 1));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  // ── Email OTP ──
  const verifyEmail = async () => {
    if (emailCode.length !== 6 || emailLoading) return;
    setEmailLoading(true);
    setEmailError("");
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: emailCode }),
      });
      const data = await res.json();
      if (res.ok) {
        // Check if SMS verification is available; if yes go to phone step, else done
        try {
          const test = await fetch("/api/auth/mobile-otp/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: "0000000000" }),
          });
          if (test.status === 503) {
            setSmsAvailable(false);
            router.push("/onboarding");
            return;
          }
        } catch {}
        setStep("phone-input");
      } else {
        setEmailError(data.error || "Invalid or expired code");
        setEmailCode("");
      }
    } catch {
      setEmailError("Network error");
    } finally {
      setEmailLoading(false);
    }
  };

  const resendEmail = async () => {
    if (emailCooldown > 0) return;
    await fetch("/api/auth/resend-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}" }).catch(() => {});
    setEmailCooldown(60);
  };

  // ── Phone OTP ──
  const sendPhoneOtp = async () => {
    if (phone.replace(/\D/g, "").length < 10 || phoneLoading) return;
    setPhoneLoading(true);
    setPhoneError("");
    try {
      const res = await fetch("/api/auth/mobile-otp/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, country: "PK" }),
      });
      const data = await res.json();
      if (res.ok || data.alreadyVerified) {
        if (data.alreadyVerified) { router.push("/onboarding"); return; }
        setSentTo(data.sentTo ?? "");
        setStep("phone");
        setPhoneCooldown(60);
      } else {
        setPhoneError(data.error || "Failed to send SMS");
      }
    } catch {
      setPhoneError("Network error");
    } finally {
      setPhoneLoading(false);
    }
  };

  const verifyPhone = async () => {
    if (phoneCode.length !== 6 || phoneLoading) return;
    setPhoneLoading(true);
    setPhoneError("");
    try {
      const res = await fetch("/api/auth/mobile-otp/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: phoneCode }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push("/onboarding");
        router.refresh();
      } else {
        setPhoneError(data.error || "Invalid code");
        setPhoneCode("");
      }
    } catch {
      setPhoneError("Network error");
    } finally {
      setPhoneLoading(false);
    }
  };

  // 6-box OTP input renderer
  const OtpBoxes = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => (
    <div className="flex gap-2 justify-center">
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          id={`otp-${i}`}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={1}
          value={value[i] || ""}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, "").slice(0, 1);
            const next = value.split("");
            next[i] = val;
            onChange(next.join("").slice(0, 6));
            if (val && i < 5) document.getElementById(`otp-${i + 1}`)?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) {
              document.getElementById(`otp-${i - 1}`)?.focus();
            }
          }}
          className="w-12 h-14 text-center text-2xl font-bold rounded-lg border-2 bg-input border-border focus:ring-2 focus:ring-ring focus:border-transparent outline-none transition-all"
        />
      ))}
    </div>
  );

  return (
    <main className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className={cn("h-1.5 rounded-full transition-all", step === "email" ? "w-10 bg-primary" : "w-10 bg-primary")} />
          <div className={cn("h-1.5 rounded-full transition-all", step === "email" ? "w-6 bg-muted" : "w-10 bg-primary")} />
        </div>

        <AnimatePresence mode="wait">
          {/* STEP 1: EMAIL OTP */}
          {step === "email" && (
            <motion.div key="email" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <MailCheck className="w-8 h-8 text-primary" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Verify your email</h1>
                <p className="text-muted-foreground">Step 1 of 2 — enter the code from your inbox</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <OtpBoxes value={emailCode} onChange={setEmailCode} />

                {emailError && (
                  <p className="text-sm text-destructive text-center px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg">{emailError}</p>
                )}

                <button
                  onClick={verifyEmail}
                  disabled={emailLoading || emailCode.length !== 6}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {emailLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify Email <ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                  <span>Didn&apos;t receive it?</span>
                  <button
                    onClick={resendEmail}
                    disabled={emailCooldown > 0}
                    className={cn("flex items-center gap-1 font-medium", emailCooldown > 0 ? "cursor-not-allowed opacity-60" : "text-primary hover:underline")}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {emailCooldown > 0 ? `Resend in ${emailCooldown}s` : "Resend"}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 2a: PHONE NUMBER INPUT */}
          {step === "phone-input" && (
            <motion.div key="phone-input" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-sky-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Add your mobile</h1>
                <p className="text-muted-foreground">Step 2 of 2 — SMS security code for withdrawals</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <div>
                  <label className="block text-sm font-medium mb-1.5">Mobile Number</label>
                  <div className="flex gap-2">
                    <span className="px-3 py-3 rounded-lg bg-secondary text-sm font-mono">+92</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="300 1234567"
                      className="flex-1 px-4 py-3 rounded-lg bg-input border border-border focus:outline-none focus:ring-2 focus:ring-ring font-mono"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1.5">Used for withdrawal security codes. Never shared.</p>
                </div>

                {phoneError && (
                  <p className="text-sm text-destructive text-center px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg">{phoneError}</p>
                )}

                <button
                  onClick={sendPhoneOtp}
                  disabled={phoneLoading || phone.replace(/\D/g, "").length < 10}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {phoneLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Send SMS Code <ArrowRight className="w-4 h-4" /></>}
                </button>

                <button
                  onClick={() => router.push("/onboarding")}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground"
                >
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 2b: PHONE OTP */}
          {step === "phone" && (
            <motion.div key="phone" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} className="w-full">
              <div className="text-center mb-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-sky-500/10 flex items-center justify-center">
                  <Smartphone className="w-8 h-8 text-sky-500" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Verify your mobile</h1>
                <p className="text-muted-foreground">Code sent to {sentTo || "your number"}</p>
              </div>

              <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
                <OtpBoxes value={phoneCode} onChange={setPhoneCode} />

                {phoneError && (
                  <p className="text-sm text-destructive text-center px-3 py-2 bg-destructive/10 border border-destructive/30 rounded-lg">{phoneError}</p>
                )}

                <button
                  onClick={verifyPhone}
                  disabled={phoneLoading || phoneCode.length !== 6}
                  className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {phoneLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <>Verify & Finish <ArrowRight className="w-4 h-4" /></>}
                </button>

                <div className="flex items-center justify-between text-sm">
                  <button onClick={() => setStep("phone-input")} className="text-muted-foreground hover:text-foreground">← Change number</button>
                  <button
                    onClick={sendPhoneOtp}
                    disabled={phoneCooldown > 0}
                    className={cn("flex items-center gap-1 font-medium", phoneCooldown > 0 ? "text-muted-foreground cursor-not-allowed" : "text-primary hover:underline")}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {phoneCooldown > 0 ? `${phoneCooldown}s` : "Resend"}
                  </button>
                </div>

                <button onClick={() => router.push("/onboarding")} className="w-full py-2 text-sm text-muted-foreground hover:text-foreground">
                  Skip for now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Two-step verification keeps your funds secure. Codes expire in 10 minutes.
        </p>
      </motion.div>
    </main>
  );
}
