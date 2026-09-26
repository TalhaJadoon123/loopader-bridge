"use client";

import { useEffect, useState, useCallback } from "react";
import { Search, Loader2, TrendingUp, TrendingDown, AlertTriangle, Shield, Brain, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { format } from "date-fns";

interface AiRiskProfile {
  id: string;
  userId: string;
  user: { email: string; fullName: string | null };
  profitabilityScore: number;
  revengeFlag: boolean;
  anomalyFlag: boolean;
  recommendedRoute: string | null;
  reason: string | null;
  updatedAt: string;
}

interface FilterState { search: string; route: string; flag: string; }

export default function AdminRiskPage() {
  const [profiles, setProfiles] = useState<AiRiskProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({ search: "", route: "", flag: "" });
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const fetchProfiles = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const params = new URLSearchParams({ 
        page: page.toString(), 
        limit: pageSize.toString(), 
        ...Object.fromEntries(Object.entries(filters).filter(([, v]) => v)) 
      });
      const res = await fetch(`/api/admin/risk?${params}`);
      if (!res.ok) throw new Error("Failed to fetch risk profiles");
      const data = await res.json();
      setProfiles(data.profiles);
    } catch (e: any) { setError(e.message ?? "Failed to load risk profiles"); }
    finally { setLoading(false); }
  }, [page, filters, pageSize]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const getScoreColor = (score: number) => {
    if (score >= 70) return "text-green-500";
    if (score >= 40) return "text-yellow-500";
    return "text-red-500";
  };

  const getRouteBadge = (route: string | null) => {
    if (!route) return <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-600/20 text-gray-400">—</span>;
    const colors: Record<string, string> = {
      A_BOOK: "bg-green-600/20 text-green-600",
      B_BOOK: "bg-red-600/20 text-red-600",
      C_BOOK: "bg-blue-600/20 text-blue-600",
    };
    return <span className={`px-2 py-0.5 rounded text-xs font-medium ${colors[route] || "bg-gray-600/20 text-gray-400"}`}>{route}</span>;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">AI Risk Profiles</h1>
          <p className="text-muted-foreground">Monitor AI-enhanced risk analysis for all users</p>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <input type="text" placeholder="Search by email..." value={filters.search} onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))} className="w-full px-3 py-2 rounded border border-input bg-background" />
          </div>
          <div>
            <select value={filters.route} onChange={(e) => setFilters((prev) => ({ ...prev, route: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background">
              <option value="">All Routes</option>
              <option value="A_BOOK">A_BOOK</option>
              <option value="B_BOOK">B_BOOK</option>
              <option value="C_BOOK">C_BOOK</option>
            </select>
          </div>
          <div>
            <select value={filters.flag} onChange={(e) => setFilters((prev) => ({ ...prev, flag: e.target.value }))} className="w-[160px] px-3 py-2 rounded border border-input bg-background">
              <option value="">All Flags</option>
              <option value="revenge">Revenge Trading</option>
              <option value="anomaly">Anomaly</option>
              <option value="none">No Flags</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-border overflow-hidden">
        {loading ? (
          <div className="p-8 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" /><p className="text-muted-foreground mt-2">Loading risk profiles...</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left text-muted-foreground">
                  <th className="p-3">User</th>
                  <th className="p-3">Profitability</th>
                  <th className="p-3">Recommended Route</th>
                  <th className="p-3">Revenge Trading</th>
                  <th className="p-3">Anomaly</th>
                  <th className="p-3">Reason</th>
                  <th className="p-3">Updated</th>
                </tr>
              </thead>
              <tbody>
                {profiles.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">No risk profiles found</td></tr>
                ) : (
                  profiles.map((p) => (
                    <tr key={p.id} className="border-t border-border/50 hover:bg-muted/30">
                      <td className="p-3">
                        <div className="font-medium">{p.user.fullName ?? p.user.email}</div>
                        <div className="text-xs text-muted-foreground">{p.user.email}</div>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <span className={`font-mono font-semibold ${getScoreColor(p.profitabilityScore)}`}>{p.profitabilityScore}</span>
                          <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                            <div className={`h-full ${getScoreColor(p.profitabilityScore).replace("text", "bg")}`} style={{ width: `${p.profitabilityScore}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{getRouteBadge(p.recommendedRoute)}</td>
                      <td className="p-3">
                        {p.revengeFlag ? (
                          <span className="flex items-center gap-1 text-red-500"><AlertTriangle className="w-4 h-4" /> Yes</span>
                        ) : (
                          <span className="text-green-500"><Shield className="w-4 h-4 inline" /> No</span>
                        )}
                      </td>
                      <td className="p-3">
                        {p.anomalyFlag ? (
                          <span className="flex items-center gap-1 text-yellow-500"><AlertTriangle className="w-4 h-4" /> Yes</span>
                        ) : (
                          <span className="text-green-500"><Shield className="w-4 h-4 inline" /> No</span>
                        )}
                      </td>
                      <td className="p-3 text-muted-foreground max-w-[200px] truncate">{p.reason ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">{format(new Date(p.updatedAt), "PPp")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}