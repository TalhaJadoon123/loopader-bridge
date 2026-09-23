"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, DollarSign, TrendingUp, FileText, Shield, AlertTriangle, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";

interface AdminStats { totalUsers: number; activeUsers: number; depositsToday: number; withdrawalsPending: number; openVolume: number; revenueEstimate: number; }
interface AdminUser { id: string; email: string; fullName: string | null; country: string | null; kycStatus: string; role: string; balance: number; createdAt: string; accountFrozen: boolean; isFeatured: boolean; }
interface Deposit { id: string; user: { email: string; fullName: string | null }; amount: number; method: string; status: string; createdAt: string; }
interface Withdrawal { id: string; user: { email: string; fullName: string | null }; amount: number; method: string; status: string; createdAt: string; adminNote: string | null; }
interface Leader { id: string; name: string; email: string; gain30d: number; winRate: number; followers: number; isFeatured: boolean; }
interface AuditEvent { id: string; event: string; user: { email: string; fullName: string | null } | null; ip: string | null; riskScore: number; createdAt: string; }

export function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "users" | "deposits" | "withdrawals" | "leaders" | "audit">("overview");
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (q?: string) => {
    try {
      const [statsRes, usersRes, depositsRes, withdrawalsRes] = await Promise.all([
        fetch("/api/admin/stats"),
        fetch(`/api/admin/users?limit=100${q ? `&q=${encodeURIComponent(q)}` : ""}`),
        fetch("/api/admin/deposits?limit=100"),
        fetch("/api/admin/withdrawals?limit=100"),
      ]);
      if (statsRes.ok) setStats(await statsRes.json());
      if (usersRes.ok) setUsers((await usersRes.json()).users);
      if (depositsRes.ok) setDeposits((await depositsRes.json()).deposits);
      if (withdrawalsRes.ok) setWithdrawals((await withdrawalsRes.json()).withdrawals);
      if (activeTab === "leaders") {
        const leadersRes = await fetch("/api/admin/leaders");
        if (leadersRes.ok) setLeaders((await leadersRes.json()).leaders);
      }
      if (activeTab === "audit") {
        const auditRes = await fetch("/api/admin/audit?limit=200");
        if (auditRes.ok) setAuditEvents((await auditRes.json()).events);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchData(search || undefined); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = async (url: string, body: any, method: "PATCH" | "POST" = "PATCH") => {
    setError(null);
    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Action failed (${res.status})`);
        return false;
      }
      await fetchData(search || undefined);
      return true;
    } catch {
      setError("Network error");
      return false;
    }
  };

  const handleUserAction = (userId: string, action: "freeze" | "unfreeze" | "kyc_approve" | "kyc_reject" | "adjust_balance") => {
    if (action === "freeze") {
      const reason = prompt("Freeze reason (required):");
      if (!reason || reason.trim().length < 3) return;
      runAction(`/api/admin/users?id=${userId}`, { action, reason: reason.trim() });
    } else if (action === "adjust_balance") {
      const amountRaw = prompt("Balance adjustment amount (use negative to deduct, e.g. 50 or -25):");
      if (amountRaw === null) return;
      const amount = parseFloat(amountRaw);
      if (Number.isNaN(amount) || amount === 0) { setError("Invalid amount"); return; }
      const reason = prompt("Reason for adjustment (required, stored in audit log):");
      if (!reason || reason.trim().length < 3) { setError("Reason is required"); return; }
      runAction(`/api/admin/users?id=${userId}`, { action, amount, reason: reason.trim() });
    } else {
      runAction(`/api/admin/users?id=${userId}`, { action });
    }
  };

  const handleDepositAction = (depositId: string, action: "approve" | "reject") => {
    runAction(`/api/admin/deposits?id=${depositId}`, { action });
  };

  const handleWithdrawalAction = (withdrawalId: string, action: "approve" | "reject") => {
    const note = prompt(action === "approve" ? "Admin note (optional):" : "Rejection reason (recommended):");
    if (note === null) return;
    runAction(`/api/admin/withdrawals?id=${withdrawalId}`, { action, adminNote: note || undefined });
  };

  const handleLeaderFeature = (leaderId: string, featured: boolean) => {
    runAction("/api/admin/leaders", { leaderId, featured });
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading admin panel…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Admin Panel</h1>
        <span className="px-3 py-1 bg-red-500/20 text-red-400 text-sm font-medium rounded-full">Restricted Access</span>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg text-sm">{error}</div>
      )}

      <div className="flex gap-2 border-b border-border overflow-x-auto">
        {[
          { id: "overview", label: "Overview", icon: TrendingUp },
          { id: "users", label: "Users", icon: Users },
          { id: "deposits", label: "Deposits", icon: DollarSign },
          { id: "withdrawals", label: "Withdrawals", icon: FileText },
          { id: "leaders", label: "Leaders", icon: Shield },
          { id: "audit", label: "Audit Log", icon: ScrollText },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id as any); if (tab.id === "leaders" || tab.id === "audit") fetchData(); }}
            className={cn(
              "flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-t-lg transition-colors whitespace-nowrap",
              activeTab === tab.id
                ? "bg-primary text-primary-foreground border-b-2 border-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            )}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && stats && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <AdminStatCard icon={Users} label="Total Users" value={stats.totalUsers.toLocaleString()} color="text-blue-500" />
          <AdminStatCard icon={Users} label="New Today" value={stats.activeUsers.toLocaleString()} color="text-green-500" />
          <AdminStatCard icon={DollarSign} label="Deposits Today" value={`$${stats.depositsToday.toLocaleString()}`} color="text-green-500" />
          <AdminStatCard icon={AlertTriangle} label="Pending Withdrawals" value={String(stats.withdrawalsPending)} color="text-yellow-500" />
          <AdminStatCard icon={TrendingUp} label="Open Trades" value={String(stats.openVolume)} color="text-primary" />
          <AdminStatCard icon={TrendingUp} label="Est. Revenue" value={`$${stats.revenueEstimate.toLocaleString()}`} color="text-purple-500" />
        </motion.div>
      )}

      {activeTab === "users" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminUserTable users={users} search={search} setSearch={setSearch} onSearch={fetchData} onAction={handleUserAction} />
        </motion.div>
      )}

      {activeTab === "deposits" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminDepositTable deposits={deposits} onAction={handleDepositAction} />
        </motion.div>
      )}

      {activeTab === "withdrawals" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminWithdrawalTable withdrawals={withdrawals} onAction={handleWithdrawalAction} />
        </motion.div>
      )}

      {activeTab === "leaders" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminLeaderTable leaders={leaders} onFeature={handleLeaderFeature} />
        </motion.div>
      )}

      {activeTab === "audit" && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <AdminAuditTable events={auditEvents} />
        </motion.div>
      )}
    </div>
  );
}

function AdminStatCard({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between">
        <Icon className={cn("w-5 h-5", color)} />
      </div>
      <div className="mt-2">
        <p className="text-2xl font-bold font-mono">{value}</p>
        <p className="text-sm text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function AdminUserTable({ users, search, setSearch, onSearch, onAction }: any) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4">
        <div className="flex-1 min-w-[200px] flex gap-2">
          <input
            type="text"
            value={search}
            placeholder="Search by email, name or ID…"
            className="w-full px-3 py-2 rounded border border-border bg-input"
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") onSearch(search || undefined); }}
          />
          <button onClick={() => onSearch(search || undefined)} className="px-3 py-2 bg-primary text-primary-foreground rounded text-sm">Search</button>
        </div>
      </div>
      <div className="rounded-lg border border-border overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 text-left text-muted-foreground">
              <th className="p-3">User</th>
              <th className="p-3">Country</th>
              <th className="p-3">KYC</th>
              <th className="p-3">Balance</th>
              <th className="p-3">Role</th>
              <th className="p-3">Status</th>
              <th className="p-3">Joined</th>
              <th className="p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: AdminUser) => (
              <tr key={u.id} className="border-t border-border/50 hover:bg-muted/30">
                <td className="p-3">
                  <div className="font-medium">{u.fullName ?? u.email}</div>
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </td>
                <td className="p-3">{u.country ?? "—"}</td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                    u.kycStatus === "VERIFIED" && "bg-green-600/20 text-green-600",
                    u.kycStatus === "PENDING" && "bg-yellow-600/20 text-yellow-600",
                    u.kycStatus === "REJECTED" && "bg-red-600/20 text-red-600"
                  )}>{u.kycStatus}</span>
                </td>
                <td className="p-3 font-mono">${Number(u.balance).toFixed(2)}</td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                    u.role === "ADMIN" ? "bg-purple-600/20 text-purple-600" : "bg-gray-600/20 text-gray-400"
                  )}>{u.role}</span>
                </td>
                <td className="p-3">
                  <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                    u.accountFrozen ? "bg-red-600/20 text-red-600" : "bg-green-600/20 text-green-600"
                  )}>{u.accountFrozen ? "Frozen" : "Active"}</span>
                </td>
                <td className="p-3 text-muted-foreground">{new Date(u.createdAt).toLocaleDateString()}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1 flex-wrap">
                    {u.kycStatus === "PENDING" && (
                      <>
                        <button onClick={() => onAction(u.id, "kyc_approve")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded hover:bg-green-600/30">Approve KYC</button>
                        <button onClick={() => onAction(u.id, "kyc_reject")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded hover:bg-red-600/30">Reject KYC</button>
                      </>
                    )}
                    {!u.accountFrozen ? (
                      <button onClick={() => onAction(u.id, "freeze")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded hover:bg-red-600/30">Freeze</button>
                    ) : (
                      <button onClick={() => onAction(u.id, "unfreeze")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded hover:bg-green-600/30">Unfreeze</button>
                    )}
                    {u.role !== "ADMIN" && (
                      <button onClick={() => onAction(u.id, "adjust_balance")} className="px-2 py-1 text-xs bg-blue-600/20 text-blue-500 rounded hover:bg-blue-600/30">Adjust $</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AdminDepositTable({ deposits, onAction }: any) {
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-muted-foreground">
            <th className="p-3">User</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Method</th>
            <th className="p-3">Status</th>
            <th className="p-3">Date</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {deposits.map((d: Deposit) => (
            <tr key={d.id} className="border-t border-border/50 hover:bg-muted/30">
              <td className="p-3">{d.user.fullName ?? d.user.email}</td>
              <td className="p-3 font-mono">${Number(d.amount).toFixed(2)}</td>
              <td className="p-3">{d.method}</td>
              <td className="p-3">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                  d.status === "CONFIRMED" && "bg-green-600/20 text-green-600",
                  d.status === "PENDING" && "bg-yellow-600/20 text-yellow-600",
                  d.status === "REJECTED" && "bg-red-600/20 text-red-600"
                )}>{d.status}</span>
              </td>
              <td className="p-3 text-muted-foreground">{new Date(d.createdAt).toLocaleString()}</td>
              <td className="p-3">
                {d.status === "PENDING" && (
                  <>
                    <button onClick={() => onAction(d.id, "approve")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30">Approve</button>
                    <button onClick={() => onAction(d.id, "reject")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded hover:bg-red-600/30">Reject</button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminWithdrawalTable({ withdrawals, onAction }: any) {
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-muted-foreground">
            <th className="p-3">User</th>
            <th className="p-3">Amount</th>
            <th className="p-3">Method</th>
            <th className="p-3">Status</th>
            <th className="p-3">Note</th>
            <th className="p-3">Date</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {withdrawals.map((w: Withdrawal) => (
            <tr key={w.id} className="border-t border-border/50 hover:bg-muted/30">
              <td className="p-3">{w.user.fullName ?? w.user.email}</td>
              <td className="p-3 font-mono">${Number(w.amount).toFixed(2)}</td>
              <td className="p-3">{w.method}</td>
              <td className="p-3">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                  w.status === "PAID" && "bg-green-600/20 text-green-600",
                  w.status === "ADMIN_REVIEW" && "bg-purple-600/20 text-purple-600",
                  w.status === "PENDING" && "bg-yellow-600/20 text-yellow-600",
                  w.status === "REJECTED" && "bg-red-600/20 text-red-600"
                )}>{w.status}</span>
              </td>
              <td className="p-3 text-muted-foreground max-w-[180px] truncate">{w.adminNote ?? "—"}</td>
              <td className="p-3 text-muted-foreground">{new Date(w.createdAt).toLocaleString()}</td>
              <td className="p-3">
                {w.status === "ADMIN_REVIEW" || w.status === "PENDING" ? (
                  <>
                    <button onClick={() => onAction(w.id, "approve")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30">Approve</button>
                    <button onClick={() => onAction(w.id, "reject")} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded hover:bg-red-600/30">Reject</button>
                  </>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminLeaderTable({ leaders, onFeature }: { leaders: Leader[]; onFeature: (id: string, featured: boolean) => void }) {
  if (!leaders.length) return <div className="p-8 text-center text-muted-foreground">No copy-trading leaders yet.</div>;
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-muted-foreground">
            <th className="p-3">Leader</th>
            <th className="p-3">30d Gain</th>
            <th className="p-3">Win Rate</th>
            <th className="p-3">Followers</th>
            <th className="p-3">Status</th>
            <th className="p-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {leaders.map((l) => (
            <tr key={l.id} className="border-t border-border/50 hover:bg-muted/30">
              <td className="p-3">
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-muted-foreground">{l.email}</div>
              </td>
              <td className={cn("p-3 font-mono", l.gain30d >= 0 ? "text-green-500" : "text-red-500")}>
                {l.gain30d >= 0 ? "+" : ""}${l.gain30d.toFixed(2)}
              </td>
              <td className="p-3">{l.winRate}%</td>
              <td className="p-3">{l.followers}</td>
              <td className="p-3">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                  l.isFeatured ? "bg-purple-600/20 text-purple-600" : "bg-gray-600/20 text-gray-400"
                )}>{l.isFeatured ? "Featured" : "Standard"}</span>
              </td>
              <td className="p-3">
                <button
                  onClick={() => onFeature(l.id, !l.isFeatured)}
                  className={cn("px-2 py-1 text-xs rounded",
                    l.isFeatured
                      ? "bg-gray-600/20 text-gray-400 hover:bg-gray-600/30"
                      : "bg-purple-600/20 text-purple-600 hover:bg-purple-600/30"
                  )}
                >
                  {l.isFeatured ? "Unfeature" : "Feature"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdminAuditTable({ events }: { events: AuditEvent[] }) {
  if (!events.length) return <div className="p-8 text-center text-muted-foreground">No audit events recorded yet.</div>;
  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-muted-foreground">
            <th className="p-3">Event</th>
            <th className="p-3">User</th>
            <th className="p-3">IP</th>
            <th className="p-3">Risk</th>
            <th className="p-3">Time</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-t border-border/50 hover:bg-muted/30">
              <td className="p-3 font-mono text-xs">{e.event}</td>
              <td className="p-3">{e.user ? (e.user.fullName ?? e.user.email) : "—"}</td>
              <td className="p-3 font-mono text-xs">{e.ip ?? "—"}</td>
              <td className="p-3">
                <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                  e.riskScore >= 50 && "bg-red-600/20 text-red-600",
                  e.riskScore >= 20 && e.riskScore < 50 && "bg-yellow-600/20 text-yellow-600",
                  e.riskScore < 20 && "bg-green-600/20 text-green-600"
                )}>{e.riskScore}</span>
              </td>
              <td className="p-3 text-muted-foreground">{new Date(e.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
