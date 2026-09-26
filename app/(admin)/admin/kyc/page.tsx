"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, CheckCircle, XCircle, Shield, Eye, User, Image as ImageIcon, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

function StatusBadge({ status }: { status: string }) {
  const color = (() => {
    switch (status) {
      case "APPROVED": return "bg-green-600/20 text-green-600";
      case "PENDING": return "bg-yellow-600/20 text-yellow-600";
      case "REJECTED": return "bg-red-600/20 text-red-600";
      default: return "bg-gray-600/20 text-gray-400";
    }
  })();
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${color} flex items-center gap-1`}>
      {status === "APPROVED" && <CheckCircle className="w-3 h-3" />}
      {status === "PENDING" && <Shield className="w-3 h-3" />}
      {status === "REJECTED" && <XCircle className="w-3 h-3" />}
      {status}
    </span>
  );
}

interface KycSubmission { id: string; user: { email: string; fullName: string | null }; status: string; idFrontUrl: string | null; idBackUrl: string | null; selfieUrl: string | null; submittedAt: string; reviewedAt: string | null; reviewedBy: string | null; reason: string | null; }
interface FilterState { status: string; search: string; }

export default function AdminKycPage() {
  const [submissions, setSubmissions] = useState<KycSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ status: "", search: "" });
  const [page, setPage] = useState(1);
  const pageSize = 25;
  const [modal, setModal] = useState<{ submission: KycSubmission | null; imageType: string }>({ submission: null, imageType: "" });

  const fetchSubmissions = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ page: page.toString(), limit: pageSize.toString(), ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) });
      const res = await fetch(`/api/admin/kyc?${params}`);
      if (!res.ok) throw new Error("Failed to fetch KYC submissions");
      const data = await res.json();
      setSubmissions(data.submissions);
    } catch (e: any) { setError(e.message ?? "Failed to load KYC submissions"); }
    finally { setLoading(false); }
  }, [page, filters]);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  const handleAction = async (submissionId: string, action: "approve" | "reject") => {
    if (action === "reject") { const reason = prompt("Rejection reason (required):"); if (!reason || reason.trim().length < 3) return; await performAction(submissionId, action, reason.trim()); }
    else { await performAction(submissionId, action, ""); }
  };

  const performAction = async (submissionId: string, action: "approve" | "reject", note: string) => {
    try { const res = await fetch("/api/admin/kyc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ submissionId, action, reason: note || undefined }) }); if (!res.ok) throw new Error("Action failed"); fetchSubmissions(); } catch (e: any) { alert(e.message ?? "Action failed"); }
  };

  const openImage = (submission: KycSubmission, type: "idFrontUrl" | "idBackUrl" | "selfieUrl") => { if (submission[type]) setModal({ submission, imageType: type }); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between"><div><h1 className="text-3xl font-bold">KYC Review</h1><p className="text-muted-foreground">Review and approve/reject user identity verification</p></div></div>
      <div className="rounded-lg border bg-card p-4 space-y-4"><div className="flex flex-wrap gap-4"><div className="flex-1 min-w-[200px]"><input type="text" placeholder="Search by email, name..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="w-full px-3 py-2 rounded border border-input bg-background" /></div><div><select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background"><option value="">All Status</option><option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option></select></div></div></div>
      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (<div className="p-8 text-center">Loading KYC submissions…</div>) : (
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="bg-muted/50 text-left text-muted-foreground"><th className="p-3">User</th><th className="p-3">Status</th><th className="p-3">Documents</th><th className="p-3">Submitted</th><th className="p-3">Reviewed</th><th className="p-3">Reason</th><th className="p-3">Actions</th></tr></thead><tbody>{submissions.length === 0 ? (<tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No KYC submissions found</td></tr>) : (submissions.map((s) => (<tr key={s.id} className="border-t border-border/50 hover:bg-muted/30"><td className="p-3"><div className="font-medium">{s.user.fullName ?? s.user.email}</div><div className="text-xs text-muted-foreground">{s.user.email}</div></td><td className="p-3"><StatusBadge status={s.status} /></td><td className="p-3"><div className="flex items-center gap-2">{s.idFrontUrl && (<button onClick={() => openImage(s, "idFrontUrl")} className="px-2 py-1 text-xs bg-blue-600/20 text-blue-600 rounded hover:bg-blue-600/30"><ImageIcon className="w-3 h-3 mr-1" />ID Front</button>)}{s.idBackUrl && (<button onClick={() => openImage(s, "idBackUrl")} className="px-2 py-1 text-xs bg-blue-600/20 text-blue-600 rounded hover:bg-blue-600/30"><ImageIcon className="w-3 h-3 mr-1" />ID Back</button>)}{s.selfieUrl && (<button onClick={() => openImage(s, "selfieUrl")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded hover:bg-green-600/30"><User className="w-3 h-3 mr-1" />Selfie</button>)}</div></td><td className="p-3 text-muted-foreground">{format(new Date(s.submittedAt), "PPp")}</td><td className="p-3 text-muted-foreground">{s.reviewedAt ? format(new Date(s.reviewedAt), "PPp") : "—"}</td><td className="p-3 text-muted-foreground max-w-[200px] truncate">{s.reason ?? "—"}</td><td className="p-3">{s.status === "PENDING" ? (<div className="flex items-center gap-1"><button onClick={() => handleAction(s.id, "approve")} className="px-2 py-1 text-xs bg-green-600/20 text-green-600 rounded mr-1 hover:bg-green-600/30"><CheckCircle className="w-3 h-3 mr-1" />Approve</button><button onClick={() => { const reason = prompt("Rejection reason (required):"); if (reason && reason.trim().length >= 3) handleAction(s.id, "reject"); }} className="px-2 py-1 text-xs bg-red-600/20 text-red-600 rounded hover:bg-red-600/30"><XCircle className="w-3 h-3 mr-1" />Reject</button></div>) : null}</td></tr>)))}</tbody></table></div>)}</div>
    </div>
  );
}

interface KycSubmission { id: string; user: { email: string; fullName: string | null }; status: string; idFrontUrl: string | null; idBackUrl: string | null; selfieUrl: string | null; submittedAt: string; reviewedAt: string | null; reviewedBy: string | null; reason: string | null; }
interface FilterState { status: string; search: string; }