"use client";

import { useState, useEffect, useCallback } from "react";
import { Search, Loader2, CheckCircle, XCircle, Shield, DollarSign, CreditCard, Building2, Download, AlertTriangle, Info, Copy, Zap, RotateCcw, Clock, X, Check } from "lucide-react";
import { format } from "date-fns";
import { QRCodeSVG as QRCode } from "qrcode.react";

interface Deposit {
  id: string;
  amount: number;
  method: string;
  status: string;
  reference: string | null;
  cryptoCurrency: string | null;
  binancePrepayId: string | null;
  createdAt: string;
  user: { email: string; fullName: string | null };
  proofUrl?: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  method: string;
  status: string;
  adminNote: string | null;
  accountDetails: Record<string, any>;
  createdAt: string;
  processedAt: string | null;
}

interface ActiveAccount {
  id: string;
  type: "DEMO" | "LIVE";
  balance: number;
  isTradingEnabled: boolean;
}

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { icon: any; color: string }> = {
    CONFIRMED: { icon: CheckCircle, color: "bg-green-600/20 text-green-600" },
    PENDING: { icon: Clock, color: "bg-yellow-600/20 text-yellow-600" },
    REJECTED: { icon: XCircle, color: "bg-red-600/20 text-red-600" },
    FAILED: { icon: AlertTriangle, color: "bg-red-600/20 text-red-600" },
    ADMIN_REVIEW: { icon: Shield, color: "bg-purple-600/20 text-purple-600" },
    PAID: { icon: CheckCircle, color: "bg-green-600/20 text-green-600" },
  };
  const c = config[status] || { icon: null, color: "bg-gray-600/20 text-gray-400" };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.color} flex items-center gap-1`}>
      {c.icon && <c.icon className="w-3 h-3" />}
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    BINANCE_PAY: "bg-orange-600/20 text-orange-600",
    CRYPTO: "bg-blue-600/20 text-blue-600",
    WIRE: "bg-gray-600/20 text-gray-400",
    CARD: "bg-purple-600/20 text-purple-600",
    BANK: "bg-green-600/20 text-green-600",
  };
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[method] || "bg-gray-600/20 text-gray-400"}`}>{method}</span>;
}

function ActiveAccountBadge({ account }: { account: ActiveAccount | null }) {
  if (!account) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-600/20 text-gray-400">No account</span>;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${account.type === "DEMO" ? "bg-yellow-600/20 text-yellow-600" : "bg-green-600/20 text-green-600"}`}>
      {account.type} ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}
      {!account.isTradingEnabled && <AlertTriangle className="w-3 h-3 ml-1" />}
    </span>
  );
}

export default function WalletPage() {
  const [activeTab, setActiveTab] = useState<"deposit" | "withdraw" | "history">("deposit");
  const [depositSubTab, setDepositSubTab] = useState<"binance" | "crypto" | "wire" | "card">("binance");
  const [activeAccount, setActiveAccount] = useState<ActiveAccount | null>(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loadingDeposits, setLoadingDeposits] = useState(false);
  const [loadingWithdrawals, setLoadingWithdrawals] = useState(false);

  // Binance Pay state
  const [binanceAmount, setBinanceAmount] = useState("");
  const [binanceCurrency, setBinanceCurrency] = useState("USDT");
  const [binanceLoading, setBinanceLoading] = useState(false);
  const [binanceResult, setBinanceResult] = useState<{ qrCodeLink: string; checkoutUrl: string; prepayId: string; expireTime: number; depositId: string } | null>(null);
  const [binancePolling, setBinancePolling] = useState(false);

  // Crypto state
  const [cryptoAmount, setCryptoAmount] = useState("");
  const [cryptoCurrency, setCryptoCurrency] = useState("USDT");
  const [cryptoLoading, setCryptoLoading] = useState(false);
  const [cryptoResult, setCryptoResult] = useState<{ payAddress: string; payAmount: number; payCurrency: string; purchaseUrl: string; depositId: string } | null>(null);
  const [cryptoPolling, setCryptoPolling] = useState(false);

  // Wire state
  const [wireAmount, setWireAmount] = useState("");
  const [wireLoading, setWireLoading] = useState(false);
  const [wireResult, setWireResult] = useState<{ reference: string; bankDetails: any; depositId: string } | null>(null);

  // Card state
  const [cardAmount, setCardAmount] = useState("");
  const [cardLoading, setCardLoading] = useState(false);
  const [cardResult, setCardResult] = useState<any>(null);

  // Withdraw state
  const [withdrawMethod, setWithdrawMethod] = useState<"BINANCE_PAY" | "CRYPTO" | "WIRE">("BINANCE_PAY");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDetails, setWithdrawDetails] = useState("");
  const [withdrawPassword, setWithdrawPassword] = useState("");
  const [withdrawTotp, setWithdrawTotp] = useState("");
  const [withdrawLoading, setWithdrawLoading] = useState(false);

  // History
  const [historyLoading, setHistoryLoading] = useState(false);
  const [allTransactions, setAllTransactions] = useState<any[]>([]);

  // Fetch active account
  const fetchActiveAccount = useCallback(async () => {
    try {
      const res = await fetch("/api/account/list");
      if (res.ok) {
        const data = await res.json();
        const defaultAcc = data.accounts?.find((a: any) => a.isDefault);
        if (defaultAcc) {
          setActiveAccount({
            id: defaultAcc.id,
            type: defaultAcc.type,
            balance: Number(defaultAcc.balance),
            isTradingEnabled: defaultAcc.isTradingEnabled,
          });
        }
      }
    } catch (e) {
      console.error("Failed to fetch active account:", e);
    } finally {
      setLoadingAccount(false);
    }
  }, []);

  // Fetch deposits
  const fetchDeposits = useCallback(async () => {
    setLoadingDeposits(true);
    try {
      const res = await fetch("/api/payments/deposit/status?type=all");
      if (res.ok) {
        const data = await res.json();
        setDeposits(data.deposits || []);
      }
    } catch (e) {
      console.error("Failed to load deposits:", e);
    } finally {
      setLoadingDeposits(false);
    }
  }, []);

  // Fetch withdrawals
  const fetchWithdrawals = useCallback(async () => {
    setLoadingWithdrawals(true);
    try {
      const res = await fetch("/api/wallet/withdraw");
      if (res.ok) {
        const data = await res.json();
        setWithdrawals(data.withdrawals || []);
      }
    } catch (e) {
      console.error("Failed to load withdrawals:", e);
    } finally {
      setLoadingWithdrawals(false);
    }
  }, []);

  // Fetch history
  const fetchHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const [depRes, wdRes] = await Promise.all([
        fetch("/api/payments/deposit/status?type=all"),
        fetch("/api/wallet/withdraw"),
      ]);
      const [depData, wdData] = await Promise.all([depRes.json(), wdRes.json()]);
      const transactions = [
        ...(depData.deposits || []).map((d: Deposit) => ({ ...d, type: "deposit" })),
        ...(wdData.withdrawals || []).map((w: Withdrawal) => ({ ...w, type: "withdrawal" })),
      ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllTransactions(transactions);
    } catch (e) {
      console.error("Failed to load history:", e);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchActiveAccount();
    fetchDeposits();
    fetchWithdrawals();
    fetchHistory();
  }, [fetchActiveAccount, fetchDeposits, fetchWithdrawals, fetchHistory]);

  // Poll deposit status
  useEffect(() => {
    if (!binancePolling || !binanceResult?.depositId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/payments/deposit/status?id=${binanceResult!.depositId}`);
        if (res.ok) {
          const data = await res.json();
          if (data.deposit?.status === "CONFIRMED") {
            setBinancePolling(false);
            fetchDeposits();
            setBinanceResult(null);
          }
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 10000);
    return () => clearInterval(interval);
  }, [binancePolling, binanceResult]);

  // Binance Pay deposit
  const handleBinanceDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!binanceAmount || parseFloat(binanceAmount) < 10) {
      alert("Minimum deposit is $10");
      return;
    }
    setBinanceLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit/binance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: parseFloat(binanceAmount), currency: binanceCurrency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create Binance Pay order");
      setBinanceResult(data);
      setBinancePolling(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setBinanceLoading(false);
    }
  };

  // Crypto deposit
  const handleCryptoDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cryptoAmount || parseFloat(cryptoAmount) < 10) {
      alert("Minimum deposit is $10");
      return;
    }
    setCryptoLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: parseFloat(cryptoAmount), cryptoCurrency }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create crypto invoice");
      setCryptoResult(data);
      setCryptoPolling(true);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCryptoLoading(false);
    }
  };

  // Wire deposit
  const handleWireDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wireAmount || parseFloat(wireAmount) < 100) {
      alert("Minimum wire deposit is $100");
      return;
    }
    setWireLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit/wire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: parseFloat(wireAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create wire instruction");
      setWireResult(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWireLoading(false);
    }
  };

  // Card deposit
  const handleCardDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cardAmount || parseFloat(cardAmount) < 10) {
      alert("Minimum deposit is $10");
      return;
    }
    setCardLoading(true);
    try {
      const res = await fetch("/api/wallet/deposit/card", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: parseFloat(cardAmount) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Card deposit failed");
      setCardResult(data);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setCardLoading(false);
    }
  };

  // Withdraw
  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert("Enter a valid amount");
      return;
    }
    if (!withdrawPassword) {
      alert("Password required");
      return;
    }
    setWithdrawLoading(true);
    try {
      const endpoint = withdrawMethod === "BINANCE_PAY" ? "/api/wallet/withdraw/binance" : "/api/wallet/withdraw";
      const body: any = { amount: parseFloat(withdrawAmount), password: withdrawPassword };
      if (withdrawMethod === "BINANCE_PAY") {
        body.binancePayId = withdrawDetails;
      } else {
        body.method = withdrawMethod;
        body.accountDetails = withdrawDetails;
      }
      if (withdrawTotp) body.totp = withdrawTotp;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Withdrawal failed");
      alert("Withdrawal requested successfully");
      fetchWithdrawals();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setWithdrawLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Active Account Badge */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Wallet</h1>
        {loadingAccount ? (
          <Loader2 className="w-6 h-6 animate-spin" />
        ) : (
          <ActiveAccountBadge account={activeAccount} />
        )}
      </div>

      {/* Top Tabs */}
      <div className="flex gap-1 bg-muted p-1 rounded-lg">
        {["deposit", "withdraw", "history"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Deposit Tab */}
      {activeTab === "deposit" && (
        <div className="space-y-6">
          {/* Sub-tabs */}
          <div className="flex gap-1 bg-muted p-1 rounded-lg">
            {[
              { id: "binance", label: "Binance Pay", icon: Zap, recommended: true },
              { id: "crypto", label: "Crypto (Direct)", icon: CreditCard },
              { id: "wire", label: "Bank Wire", icon: Building2 },
              { id: "card", label: "Card", icon: CreditCard },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setDepositSubTab(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                  depositSubTab === tab.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
                {tab.recommended && <span className="px-1.5 py-0.5 text-[10px] bg-orange-500/20 text-orange-500 rounded">REC</span>}
              </button>
            ))}
          </div>

          {/* Binance Pay */}
          {depositSubTab === "binance" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-orange-500" />
                  Binance Pay Deposit
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pay with Binance Pay. Most Pakistanis use this. No bank needed.
                </p>
                <form onSubmit={handleBinanceDeposit} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount (USD)</label>
                    <input
                      type="number"
                      min="10"
                      step="0.01"
                      value={binanceAmount}
                      onChange={(e) => setBinanceAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-input bg-background"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Currency</label>
                    <select
                      value={binanceCurrency}
                      onChange={(e) => setBinanceCurrency(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-input bg-background"
                    >
                      <option value="USDT">USDT</option>
                      <option value="USDC">USDC</option>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={binanceLoading || !!binanceResult}
                    className="w-full py-3 rounded-lg bg-orange-500 text-white font-medium disabled:opacity-50"
                  >
                    {binanceLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Generate QR"}
                  </button>
                </form>

                {binanceResult && (
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <QRCode value={binanceResult.qrCodeLink} size={180} />
                      <div>
                        <p className="text-sm text-muted-foreground">Scan with Binance App or</p>
                        <a
                          href={binanceResult.checkoutUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-orange-500 hover:underline text-sm font-medium"
                        >
                          Open Checkout Link
                        </a>
                        <p className="text-xs text-muted-foreground mt-2">
                          Expires in {Math.floor((binanceResult.expireTime - Date.now()) / 1000 / 60)} minutes
                        </p>
                        <button
                          onClick={() => navigator.clipboard.writeText(binanceResult.checkoutUrl)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Copy checkout URL
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                      <p className="text-sm text-yellow-500">Waiting for payment... Polling every 10s.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Crypto */}
          {depositSubTab === "crypto" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-500" />
                  Crypto (Direct)
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Pay directly with any crypto wallet. No Binance account needed.
                </p>
                <form onSubmit={handleCryptoDeposit} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount (USD)</label>
                    <input
                      type="number"
                      min="10"
                      step="0.01"
                      value={cryptoAmount}
                      onChange={(e) => setCryptoAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-input bg-background"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Currency</label>
                    <select
                      value={cryptoCurrency}
                      onChange={(e) => setCryptoCurrency(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-input bg-background"
                    >
                      <option value="USDT">USDT</option>
                      <option value="USDC">USDC</option>
                      <option value="BTC">BTC</option>
                      <option value="ETH">ETH</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={cryptoLoading || !!cryptoResult}
                    className="w-full py-3 rounded-lg bg-blue-500 text-white font-medium disabled:opacity-50"
                  >
                    {cryptoLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Generate Invoice"}
                  </button>
                </form>

                {cryptoResult && (
                  <div className="border-t pt-6 space-y-4">
                    <div className="flex items-center gap-4">
                      <QRCode value={cryptoResult.purchaseUrl} size={180} />
                      <div>
                        <p className="text-sm text-muted-foreground">Send <span className="font-mono text-blue-500">{cryptoResult.payAmount} {cryptoResult.payCurrency}</span> to:</p>
                        <p className="font-mono text-sm break-all bg-muted p-2 rounded">{cryptoResult.payAddress}</p>
                        <a
                          href={cryptoResult.purchaseUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline text-sm font-medium"
                        >
                          View on NOWPayments
                        </a>
                        <button
                          onClick={() => navigator.clipboard.writeText(cryptoResult.payAddress)}
                          className="text-xs text-muted-foreground hover:text-foreground underline"
                        >
                          Copy address
                        </button>
                      </div>
                    </div>
                    <div className="rounded-lg bg-yellow-500/10 border border-yellow-500/30 p-3">
                      <p className="text-sm text-yellow-500">Waiting for payment... Polling every 10s.</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Wire */}
          {depositSubTab === "wire" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-500" />
                  Bank Wire Deposit
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  For large deposits. Confirmation may take 1–2 business days.
                </p>
                <form onSubmit={handleWireDeposit} className="space-y-4 max-w-md">
                  <div>
                    <label className="block text-sm font-medium mb-1">Amount (USD)</label>
                    <input
                      type="number"
                      min="100"
                      step="0.01"
                      value={wireAmount}
                      onChange={(e) => setWireAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded border border-input bg-background"
                      placeholder="1000"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={wireLoading || !!wireResult}
                    className="w-full py-3 rounded-lg bg-gray-600 text-white font-medium disabled:opacity-50"
                  >
                    {wireLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Get Wire Instructions"}
                  </button>
                </form>

                {wireResult && (
                  <div className="border-t pt-6 space-y-4">
                    <div className="rounded-lg bg-gray-50 p-4 border border-gray-200">
                      <h4 className="font-semibold mb-2">Wire Instructions</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between"><span className="text-muted-foreground">Bank:</span><span className="font-mono">{wireResult.bankDetails.bankName}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Account:</span><span className="font-mono">{wireResult.bankDetails.accountNumber}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">SWIFT:</span><span className="font-mono">{wireResult.bankDetails.swift}</span></div>
                        {wireResult.bankDetails.iban && (
                          <div className="flex justify-between"><span className="text-muted-foreground">IBAN:</span><span className="font-mono">{wireResult.bankDetails.iban}</span></div>
                        )}
                        <div className="flex justify-between"><span className="text-muted-foreground">Beneficiary:</span><span className="font-mono">{wireResult.bankDetails.beneficiaryName}</span></div>
                        <div className="flex justify-between"><span className="text-muted-foreground">Reference:</span><span className="font-mono font-bold text-blue-500">{wireResult.reference}</span></div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Transfer {wireAmount} USD to the above account. Include the reference number. Wire transfers typically take 1-2 business days.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Card */}
          {depositSubTab === "card" && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-card p-6">
                <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-500" />
                  Card Deposit
                </h3>
                {cardResult ? (
                  <div className="space-y-4">
                    <div className="rounded-lg bg-green-50 border border-green-200 p-4">
                      <h4 className="font-semibold text-green-700">Payment Link Generated</h4>
                      <p className="text-sm text-green-600 mt-1">Your card payment link has been generated.</p>
                      <a href={cardResult.redirectUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-500 hover:underline">Open Payment Page</a>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground mb-4">
                      Card payments are being set up. Use Binance Pay or crypto in the meantime.
                    </p>
                    <form onSubmit={handleCardDeposit} className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium mb-1">Amount (USD)</label>
                        <input
                          type="number"
                          min="10"
                          step="0.01"
                          value={cardAmount}
                          onChange={(e) => setCardAmount(e.target.value)}
                          className="w-full px-3 py-2 rounded border border-input bg-background"
                          placeholder="50"
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={cardLoading}
                        className="w-full py-3 rounded-lg bg-purple-500 text-white font-medium disabled:opacity-50"
                      >
                        {cardLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Generate Payment Link"}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Withdraw Tab */}
      {activeTab === "withdraw" && (
        <div className="space-y-6">
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">Request Withdrawal</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Withdrawals from your LIVE account. Password + 2FA required.
            </p>
            <form onSubmit={handleWithdraw} className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium mb-1">Method</label>
                <select
                  value={withdrawMethod}
                  onChange={(e) => setWithdrawMethod(e.target.value as any)}
                  className="w-full px-3 py-2 rounded border border-input bg-background"
                >
                  <option value="BINANCE_PAY">Binance Pay</option>
                  <option value="CRYPTO">Crypto (Wallet)</option>
                  <option value="WIRE">Bank Wire</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Amount (USD)</label>
                <input
                  type="number"
                  min="10"
                  step="0.01"
                  max={activeAccount?.balance || 0}
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-input bg-background"
                  placeholder="50"
                />
                {activeAccount && (
                  <p className="text-xs text-muted-foreground mt-1">Available: ${activeAccount.balance.toLocaleString()}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">
                  {withdrawMethod === "BINANCE_PAY" ? "Binance Pay ID" : withdrawMethod === "CRYPTO" ? "Wallet Address" : "Bank Details"}
                </label>
                <textarea
                  value={withdrawDetails}
                  onChange={(e) => setWithdrawDetails(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded border border-input bg-background"
                  placeholder={withdrawMethod === "BINANCE_PAY" ? "Your Binance Pay ID" : withdrawMethod === "CRYPTO" ? "Your wallet address" : "Bank name, account number, SWIFT/IBAN"}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Password</label>
                <input
                  type="password"
                  value={withdrawPassword}
                  onChange={(e) => setWithdrawPassword(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-input bg-background"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">2FA Code (if enabled)</label>
                <input
                  type="text"
                  value={withdrawTotp}
                  onChange={(e) => setWithdrawTotp(e.target.value)}
                  className="w-full px-3 py-2 rounded border border-input bg-background"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={withdrawLoading || !withdrawAmount || !withdrawPassword}
                className="w-full py-3 rounded-lg bg-red-500 text-white font-medium disabled:opacity-50"
              >
                {withdrawLoading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : "Request Withdrawal"}
              </button>
            </form>
          </div>

          {/* Pending Withdrawals */}
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b border-border">
              <h4 className="font-semibold">Pending Withdrawals</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-muted-foreground">
                    <th className="p-3">Amount</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingWithdrawals ? (
                    <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
                  ) : withdrawals.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">No withdrawals</td></tr>
                  ) : (
                    withdrawals.map((w) => (
                      <tr key={w.id} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="p-3 font-mono">${Number(w.amount).toFixed(2)}</td>
                        <td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-600/20 text-gray-400">{w.method}</span></td>
                        <td className="p-3"><StatusBadge status={w.status} /></td>
                        <td className="p-3 text-muted-foreground">{format(new Date(w.createdAt), "PPp")}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* History Tab */}
      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="rounded-lg border bg-card">
            <div className="p-4 border-b border-border">
              <h4 className="font-semibold">Transaction History</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50 text-left text-muted-foreground">
                    <th className="p-3">Type</th>
                    <th className="p-3">Method</th>
                    <th className="p-3">Amount</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Date</th>
                    <th className="p-3">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan={6} className="p-8 text-center">Loading...</td></tr>
                  ) : allTransactions.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No transactions</td></tr>
                  ) : (
                    allTransactions.map((t) => (
                      <tr key={t.id} className="border-t border-border/50 hover:bg-muted/30">
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${t.type === "deposit" ? "bg-green-600/20 text-green-600" : "bg-red-600/20 text-red-600"}`}>
                            {t.type === "deposit" ? "Deposit" : "Withdrawal"}
                          </span>
                        </td>
                        <td className="p-3"><MethodBadge method={t.method} /></td>
                        <td className={`p-3 font-mono ${t.type === "deposit" ? "text-green-500" : "text-red-500"}`}>${Number(t.amount).toFixed(2)}</td>
                        <td className="p-3"><StatusBadge status={t.status} /></td>
                        <td className="p-3 text-muted-foreground">{format(new Date(t.createdAt), "PPp")}</td>
                        <td className="p-3 font-mono text-xs text-muted-foreground max-w-[160px] truncate">{t.reference ?? t.binancePrepayId ?? t.id.slice(0, 12)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}