"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, CheckCircle, XCircle, Shield, DollarSign, Clock, Shield as ShieldIcon } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const color = (() => {
    switch (status) {
      case "PAID": return "bg-green-600/20 text-green-600";
      case "PENDING": return "bg-yellow-600/20 text-yellow-600";
      case "ADMIN_REVIEW": return "bg-purple-600/20 text-purple-600";
      case "REJECTED": return "bg-red-600/20 text-red-600";
      default: return "bg-gray-600/20 text-gray-400";
    }
  })();
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color} flex items-center gap-1`}>
      {status === "PAID" && <CheckCircle className="w-3 h-3" />}
      {status === "PENDING" && <Clock className="w-3 h-3" />}
      {status === "ADMIN_REVIEW" && <Shield className="w-3 h-3" />}
      {status === "REJECTED" && <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

interface Withdrawal { id: string; user: { email: string; fullName: string | null }; amount: number; method: string; status: string; adminNote: string | null; accountDetails: Record<string, any>; createdAt: string; processedAt: string | null; }
interface FilterState { status: string; method: string; search: string; }

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: "", method: "", search: "" });
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchWithdrawals = useCallback(async () => {
    setLoading(true); setError(null);
    try { const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString(), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }); const res = await fetch(`/api/admin/withdrawals?${params}`); if (!res.ok) throw new Error("Failed to fetch withdrawals"); const data = await res.json(); setWithdrawals(data.withdrawals); } catch (e: any) { setError(e.message ?? "Failed to load withdrawals"); } finally { setLoading(false); }
  }, [page, filters, pageSize]);

  useEffect(() => { fetchWithdrawals(); }, [fetchWithdrawals]);

  const handleAction = async (withdrawalId: string, action: "approve" | "reject") => {
    if (action === "reject") { const reason = prompt("Rejection reason (required):"); if (!reason || reason.trim().length < 3) return; await performAction(withdrawalId, action, reason.trim()); }
    else if (action === "approve") { const txHash = prompt("Transaction hash / Binance Pay ID (optional):"); if (txHash === null) return; await performAction(withdrawalId, action, txHash || ""); }
  };

  const performAction = async (withdrawalId: string, action: "approve" | "reject", note: string) => {
    try { const res = await fetch(`/api/admin/withdrawals/${action}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withdrawalId, ...(action === "approve" ? { txHash: note } : { reason: note }) }) }); if (!res.ok) throw new Error("Action failed"); fetchWithdrawals(); } catch (e: any) { alert(e.message ?? "Action failed"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Withdrawals Management</h1><p className="text-muted-foreground">Review and process withdrawal requests</p></div></div>
      <div className="rounded-lg border bg-card p-4 space-y-4"><div className="flex flex-wrap gap-4"><div className="flex-1 min-w-[200px]"><input type="text" placeholder="Search by email, ID..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="w-full px-3 py-2 rounded border border-input bg-background" /></div><div><select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Status</option><option value="ADMIN_REVIEW">Admin Review</option><option value="PENDING">Pending</option><option value="PAID">Paid</option><option value="REJECTED">Rejected</option></select></div><div><select value={filters.method} onChange={(e) => setFilters((prev) => ({ ...prev, method: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Methods</option><option value="BINANCE_PAY">Binance Pay</option><option value="CRYPTO">Crypto</option><option value="WIRE">Wire</option><option value="CARD">Card</option><option value="BANK">Bank</option></select></div></div></div>
      <div className="rounded-lg border border-border overflow-hidden">{loading ? (<div className="p-8 text-center">Loading withdrawals…</div>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-muted/50 text-left text-muted-foreground"><th className="p-3">User</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3"><StatusBadge status="PAID" /></th><th className="p-3">Details</th><th className="p-3">Note</th><th className="p-3">Date</th><th className="p-3">Actions</th></tr></thead><tbody>{withdrawals.length === 0 ? (<tr><td colSpan={8} className="p-8 text-center text-muted-foreground">No withdrawals found</td></tr>) : (withdrawals.map((w) => (<tr key={w.id} className="border-t border-border/50 hover:bg-muted/30"><td className="p-3"><div className="font-medium">{w.user.fullName ?? w.user.email}</div><div className="text-xs text-muted-foreground">{w.user.email}</div></td><td className="p-3 font-mono">${Number(w.amount).toFixed(2)}</td><td className="p-3"><span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-600/20 text-gray-400">{w.method}</span></td><td className="p-3"><StatusBadge status={w.status} /></td><td className="p-3 text-muted-foreground max-w-[200px] truncate">{w.method === "BINANCE_PAY" && w.accountDetails?.binancePayId ? `Binance Pay ID: ${w.accountDetails.binancePayId}` : w.method === "CRYPTO" && w.accountDetails?.walletAddress ? `Wallet: ${w.accountDetails.walletAddress.slice(0, 20)}…` : w.method === "BANK" && w.accountDetails?.bankName ? `Bank: ${w.accountDetails.bankName}` : "—"}</td><td className="p-3 text-muted-foreground max-w-[200px] truncate">{w.adminNote ?? "—"}</td><td className="p-3 text-muted-foreground">{format(new Date(w.createdAt), "PPp")}</td><td className="p-3">{(w.status === "ADMIN_REVIEW" || w.status === "PENDING") ? (<div className="flex items-center gap-1"><button onClick={() => confirm("Approve this withdrawal?") && performAction(w.id, "approve", "")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30">Approve</button><button onClick={() => { const reason = prompt("Rejection reason (required):"); if (reason && reason.trim().length >= 3) performAction(w.id, "reject", reason.trim()); }} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded hover:bg-red-600/30">Reject</button></div>) : null}</td></tr>)))}</tbody></table></div>)}</div></div>
  );
}