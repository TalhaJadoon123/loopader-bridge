"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function WithdrawConfirmPage({ params }: { params: { token: string } }) {
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/wallet/withdraw/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: params.token }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data.error ?? "Could not confirm this withdrawal.");
          setState("error");
          return;
        }
        setMessage(data.message ?? "Withdrawal confirmed.");
        setState("ok");
      } catch {
        setMessage("Network error. Please try again.");
        setState("error");
      }
    })();
  }, [params.token]);

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl p-8 text-center">
        {state === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-primary animate-spin mx-auto" />
            <h1 className="text-xl font-bold mt-4">Confirming your withdrawal…</h1>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-xl font-bold mt-4">Withdrawal confirmed</h1>
            <p className="text-muted-foreground mt-2">{message}</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
            <h1 className="text-xl font-bold mt-4">Confirmation failed</h1>
            <p className="text-muted-foreground mt-2">{message}</p>
          </>
        )}
        <Link href="/wallet" className="inline-block mt-6 px-5 py-2.5 bg-primary text-primary-foreground rounded-lg font-semibold text-sm">
          Back to Wallet
        </Link>
        <p className="text-xs text-muted-foreground mt-6">Trading involves risk of loss. Loopader is a technology platform.</p>
      </div>
    </main>
  );
}
