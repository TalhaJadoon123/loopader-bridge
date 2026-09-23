"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Filter, Download, Shield, Loader2, DollarSign, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const color = (() => {
    switch (status) {
      case "CONFIRMED": return "bg-green-600/20 text-green-600";
      case "PENDING": return "bg-yellow-600/20 text-yellow-600";
      case "REJECTED":
      case "FAILED": return "bg-red-600/20 text-red-600";
      case "ADMIN_REVIEW": return "bg-purple-600/20 text-purple-600";
      default: return "bg-gray-600/20 text-gray-400";
    }
  })();
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color} flex items-center gap-1`}>
      {status === "CONFIRMED" && <CheckCircle className="w-3 h-3" />}
      {status === "PENDING" && <Clock className="w-3 h-3" />}
      {status === "REJECTED" && <XCircle className="w-3 h-3" />}
      {status === "FAILED" && <XCircle className="w-3 h-3" />}
      {status === "ADMIN_REVIEW" && <Shield className="w-3 h-3" />}
      {status}
    </span>
  );
}

function MethodBadge({ method }: { method: string }) {
  const color = (() => {
    switch (method) {
      case "BINANCE_PAY": return "bg-orange-600/20 text-orange-600";
      case "CRYPTO": return "bg-blue-600/20 text-blue-600";
      case "WIRE": return "bg-gray-600/20 text-gray-400";
      case "CARD": return "bg-purple-600/20 text-purple-600";
      case "BANK": return "bg-green-600/20 text-green-600";
      default: return "bg-gray-600/20 text-gray-400";
    }
  })();
  return <span className={`px-2 py-0.5 rounded text-xs font-medium ${color}`}>{method}</span>;
}

interface Deposit { id: string; user: { email: string; fullName: string | null }; amount: number; method: string; status: string; createdAt: string; reference: string | null; cryptoCurrency: string | null; binancePrepayId: string | null; }
interface FilterState { status: string; method: string; dateFrom: string; dateTo: string; search: string; }

function handleConfirmWire(depositId: string) {
  if (!confirm("Confirm this wire deposit? This will credit the user's LIVE balance.")) return;
  fetch("/api/admin/deposits/confirm-wire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ depositId }) })
    .then((res) => { if (!res.ok) throw new Error("Failed to confirm"); window.location.reload(); })
    .catch((e: any) => alert(e.message ?? "Failed to confirm"));
}

export default function AdminDepositsPage() {
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: "", method: "", dateFrom: "", dateTo: "", search: "" });
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchDeposits = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString(), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const res = await fetch(`/api/admin/deposits?${params}`);
      if (!res.ok) throw new Error("Failed to fetch deposits");
      const data = await res.json();
      setDeposits(data.deposits);
    } catch (e: any) { setError(e.message ?? "Failed to load deposits"); }
    finally { setLoading(false); }
  }, [page, filters, pageSize]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const handleConfirmWire = async (depositId: string) => {
    if (!confirm("Confirm this wire deposit? This will credit the user's LIVE balance.")) return;
    try { const res = await fetch("/api/admin/deposits/confirm-wire", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ depositId }) }); if (!res.ok) throw new Error("Failed to confirm"); fetchDeposits(); } catch (e: any) { alert(e.message ?? "Failed to confirm"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">Deposits Management</h1><p className="text-muted-foreground">Monitor and manage all user deposits</p></div></div>
      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]"><input type="text" placeholder="Search by email, reference..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="w-full px-3 py-2 rounded border border-input bg-background" /></div>
          <div><select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Status</option><option value="PENDING">Pending</option><option value="CONFIRMED">Confirmed</option><option value="REJECTED">Rejected</option><option value="FAILED">Failed</option><option value="ADMIN_REVIEW">Admin Review</option></select></div>
          <div><select value={filters.method} onChange={(e) => setFilters((prev) => ({ ...prev, method: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Methods</option><option value="BINANCE_PAY">Binance Pay</option><option value="CRYPTO">Crypto</option><option value="WIRE">Wire</option><option value="CARD">Card</option><option value="BANK">Bank</option></select></div>
          <div className="flex gap-2"><input type="date" value={filters.dateFrom} onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))} className="px-3 py-2 rounded border border-input bg-background w-[160px]" /><span className="self-center text-muted-foreground">to</span><input type="date" value={filters.dateTo} onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))} className="px-3 py-2 rounded border border-input bg-background w-[160px]" /></div>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (<div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-muted-foreground mt-2">Loading deposits...</p></div>) : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-muted/50 text-left text-muted-foreground"><th className="p-3">User</th><th className="p-3">Amount</th><th className="p-3">Method</th><th className="p-3">Status</th><th className="p-3">Reference</th><th className="p-3">Date</th><th className="p-3">Actions</th></tr></thead><tbody>{deposits.length === 0 ? (<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No deposits found</td></tr>) : (deposits.map((d) => (<tr key={d.id} className="border-t border-border/50 hover:bg-muted/30"><td className="p-3"><div className="font-medium">{d.user.fullName ?? d.user.email}</div><div className="text-xs text-muted-foreground">{d.user.email}</div></td><td className="p-3 font-mono">${Number(d.amount).toFixed(2)}</td><td className="p-3"><MethodBadge method={d.method} /></td><td className="p-3"><StatusBadge status={d.status} /></td><td className="p-3 font-mono text-xs text-muted-foreground max-w-[160px] truncate">{d.reference ?? d.binancePrepayId ?? d.id.slice(0, 12) + "…"}</td><td className="p-3 text-muted-foreground">{format(new Date(d.createdAt), "PPp")}</td><td className="p-3">{d.status === "PENDING" && d.method === "WIRE" && (<button onClick={() => handleConfirmWire(d.id)} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded hover:bg-green-600/30">Confirm Wire</button>)}</td></tr>)))}</tbody></table></div>)}</div>
    </div>
  );
}

interface Deposit { id: string; user: { email: string; fullName: string | null }; amount: number; method: string; status: string; createdAt: string; reference: string | null; cryptoCurrency: string | null; binancePrepayId: string | null; }
interface FilterState { status: string; method: string; dateFrom: string; dateTo: string; search: string; }