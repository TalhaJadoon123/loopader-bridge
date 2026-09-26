"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, Shield, UserX, UserCheck, DollarSign, UserPlus, UserMinus, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ frozen, tradingEnabled }: { frozen: boolean; tradingEnabled: boolean }) {
  if (frozen) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-600/20 text-red-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Frozen</span>;
  if (!tradingEnabled) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-yellow-600/20 text-yellow-600 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Trading Disabled</span>;
  return <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-600/20 text-green-600">Active</span>;
}

interface AdminUser { id: string; email: string; fullName: string | null; country: string | null; kycStatus: string; role: string; balance: number; createdAt: string; accountFrozen: boolean; isTradingEnabled: boolean; }
interface FilterState { status: string; role: string; search: string; }

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: "", role: "", search: "" });
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchUsers = useCallback(async () => {
    setLoading(true); setError(null);
    try { const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString(), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) }); const res = await fetch(`/api/admin/users?${params}`); if (!res.ok) throw new Error("Failed to fetch users"); const data = await res.json(); setUsers(data.users); } catch (e: any) { setError(e.message ?? "Failed to load users"); } finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAction = async (userId: string, action: "freeze" | "unfreeze" | "kyc_approve" | "kyc_reject" | "toggle_trading" | "adjust_balance") => {
    if (action === "adjust_balance") { const amountRaw = prompt("Balance adjustment amount (use negative to deduct, e.g. 50 or -25):"); if (amountRaw === null) return; const amount = parseFloat(amountRaw); if (Number.isNaN(amount) || amount === 0) { alert("Invalid amount"); return; } const reason = prompt("Reason for adjustment (required, stored in audit log):"); if (!reason || reason.trim().length < 3) { alert("Reason is required"); return; } await performAction(userId, action, { amount, reason: reason.trim() }); }
    else if (action === "freeze") { const reason = prompt("Freeze reason (required):"); if (!reason || reason.trim().length < 3) return; await performAction(userId, action, { reason: reason.trim() }); }
    else { await performAction(userId, action, {}); }
  };

  const performAction = async (userId: string, action: string, payload: any) => { try { const res = await fetch(`/api/admin/users?id=${userId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...payload }) }); if (!res.ok) throw new Error("Action failed"); fetchUsers(); } catch (e: any) { alert(e.message ?? "Action failed"); } };

  const kycConfig: Record<string, string> = { VERIFIED: "bg-green-600/20 text-green-600", PENDING: "bg-yellow-600/20 text-yellow-600", REJECTED: "bg-red-600/20 text-red-600" };
  const roleConfig: Record<string, string> = { ADMIN: "bg-purple-600/20 text-purple-600", USER: "bg-gray-600/20 text-gray-400" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">User Management</h1><p className="text-muted-foreground">Manage user accounts, KYC, balances, and trading permissions</p></div></div>
      <div className="rounded-lg border bg-card p-4 space-y-4"><div className="flex flex-wrap gap-4"><div className="flex-1 min-w-[200px]"><input type="text" placeholder="Search by email, name or ID..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="w-full px-3 py-2 rounded border border-input bg-background" /></div><div><select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Status</option><option value="frozen">Frozen</option><option value="active">Active</option><option value="trading_disabled">Trading Disabled</option></select></div><div><select value={filters.role} onChange={(e) => setFilters((prev) => ({ ...prev, role: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Roles</option><option value="USER">User</option><option value="ADMIN">Admin</option></select></div></div></div>
      <div className="rounded-lg border border-border overflow-hidden">{loading ? (<div className="p-8 text-center">Loading users…</div>) : (<div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-muted/50 text-left text-muted-foreground"><th className="p-3">User</th><th className="p-3">Country</th><th className="p-3">KYC</th><th className="p-3">Balance</th><th className="p-3">Role</th><th className="p-3">Status</th><th className="p-3">Trading</th><th className="p-3">Joined</th><th className="p-3">Actions</th></tr></thead><tbody>{users.length === 0 ? (<tr><td colSpan={10} className="p-8 text-center text-muted-foreground">No users found</td></tr>) : (users.map((u) => (<tr key={u.id} className="border-t border-border/50 hover:bg-muted/30"><td className="p-3"><div className="font-medium">{u.fullName ?? u.email}</div><div className="text-xs text-muted-foreground">{u.email}</div></td><td className="p-3">{u.country ?? "—"}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${kycConfig[u.kycStatus] || "bg-gray-600/20 text-gray-400"}`}>{u.kycStatus}</span></td><td className="p-3 font-mono">${Number(u.balance).toFixed(2)}</td><td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${roleConfig[u.role] || "bg-gray-600/20 text-gray-400"}`}>{u.role}</span></td><td className="p-3"><StatusBadge frozen={u.accountFrozen} tradingEnabled={u.isTradingEnabled} /></td><td className="p-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${u.isTradingEnabled ? "bg-green-600/20 text-green-600" : "bg-red-600/20 text-red-600"}`}>{u.isTradingEnabled ? "Enabled" : "Disabled"}</span></td><td className="p-3 text-muted-foreground">{format(new Date(u.createdAt), "PPp")}</td><td className="p-3"><div className="flex items-center gap-1 flex-wrap">{u.kycStatus === "PENDING" && (<><button onClick={() => handleAction(u.id, "kyc_approve")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30">KYC Approve</button><button onClick={() => handleAction(u.id, "kyc_reject")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded mr-1 hover:bg-red-600/30">KYC Reject</button></>)} {!u.accountFrozen ? (<button onClick={() => handleAction(u.id, "freeze")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded mr-1 hover:bg-red-600/30"><UserX className="w-3 h-3 mr-1" />Freeze</button>) : (<button onClick={() => handleAction(u.id, "unfreeze")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30"><UserCheck className="w-3 h-3 mr-1" />Unfreeze</button>)} {!u.isTradingEnabled ? (<button onClick={() => handleAction(u.id, "toggle_trading")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30"><Shield className="w-3 h-3 mr-1" />Enable Trading</button>) : (<button onClick={() => handleAction(u.id, "toggle_trading")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded mr-1 hover:bg-red-600/30"><Shield className="w-3 h-3 mr-1" />Disable Trading</button>)} {u.role !== "ADMIN" && (<button onClick={() => handleAction(u.id, "adjust_balance")} className="px-2 py-1 text-xs bg-blue-600/20 text-blue-500 rounded hover:bg-blue-600/30"><DollarSign className="w-3 h-3 mr-1" />Adjust $</button>)}</div></td></tr>)))}</tbody></table></div>)}</div></div>
  );
}