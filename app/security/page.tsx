"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, Smartphone, Laptop, Monitor, Globe, AlertTriangle, Trash2, Plus, Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

interface Device { id: string; fingerprint: string; userAgent: string; ip: string; country: string | null; lastSeenAt: string; isCurrent: boolean; riskScore: number; }
interface Address { id: string; method: string; address: string; label: string; createdAt: string; }

export default function SecurityPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [addrForm, setAddrForm] = useState({ method: "JAZZCASH", address: "", label: "" });
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [dRes, aRes] = await Promise.all([
        fetch("/api/security/devices"),
        fetch("/api/security/addresses"),
      ]);
      if (dRes.ok) setDevices((await dRes.json()).devices ?? []);
      if (aRes.ok) setAddresses((await aRes.json()).addresses ?? []);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const revokeDevice = async (id: string) => {
    await fetch(`/api/security/devices?deviceId=${id}`, { method: "DELETE" });
    fetchData();
  };

  const addAddress = async () => {
    await fetch("/api/security/addresses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(addrForm) });
    setShowAddressForm(false);
    setAddrForm({ method: "JAZZCASH", address: "", label: "" });
    fetchData();
  };

  const deleteAddress = async (id: string) => {
    await fetch(`/api/security/addresses?id=${id}`, { method: "DELETE" });
    fetchData();
  };

  const copyAddress = (addr: string) => {
    navigator.clipboard.writeText(addr);
    setCopied(addr);
    setTimeout(() => setCopied(null), 2000);
  };

  if (loading) return <DashboardLayout><div className="flex items-center justify-center h-64">Loading…</div></DashboardLayout>;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Shield className="w-6 h-6 text-primary" /> Security Center</h1>
          <p className="text-sm text-muted-foreground">Manage devices, withdrawal addresses, and account security</p>
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Smartphone className="w-5 h-5 text-primary" /> Connected Devices ({devices.length})</h2>
          {devices.length === 0 ? (
            <p className="text-sm text-muted-foreground">No devices logged</p>
          ) : (
            <div className="space-y-3">
              {devices.map(d => (
                <div key={d.id} className={cn("flex items-center justify-between p-3 rounded-lg border", d.isCurrent ? "border-primary bg-primary/5" : "border-border")}>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                      <Smartphone className="w-5 h-5 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{d.isCurrent ? "Current device" : d.userAgent.slice(0, 30)}</p>
                      <p className="text-xs text-muted-foreground">{d.ip} {d.country ? `• ${d.country}` : ""} • {new Date(d.lastSeenAt).toLocaleString()}</p>
                    </div>
                  </div>
                  {!d.isCurrent && (
                    <button onClick={() => revokeDevice(d.id)} className="px-3 py-1 text-xs bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20">
                      Revoke
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Shield className="w-5 h-5 text-primary" /> Withdrawal Addresses</h2>
            <button onClick={() => setShowAddressForm(true)} className="px-3 py-1.5 text-sm bg-primary/10 text-primary rounded-lg hover:bg-primary/20 flex items-center gap-1">
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          {showAddressForm && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="mb-4 p-4 bg-secondary/50 rounded-lg border border-border space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <select value={addrForm.method} onChange={e => setAddrForm({ ...addrForm, method: e.target.value })} className="px-3 py-2 rounded border border-border bg-input text-sm">
                  <option value="JAZZCASH">JazzCash</option>
                  <option value="EASYPAISA">EasyPaisa</option>
                  <option value="BANK">Bank</option>
                  <option value="CRYPTO">Crypto</option>
                </select>
                <input type="text" value={addrForm.address} onChange={e => setAddrForm({ ...addrForm, address: e.target.value })} placeholder="Address / account" className="px-3 py-2 rounded border border-border bg-input text-sm" />
                <input type="text" value={addrForm.label} onChange={e => setAddrForm({ ...addrForm, label: e.target.value })} placeholder="Label (e.g. My Wallet)" className="px-3 py-2 rounded border border-border bg-input text-sm" />
              </div>
              <div className="flex gap-2">
                <button onClick={addAddress} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm">Save</button>
                <button onClick={() => setShowAddressForm(false)} className="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg text-sm">Cancel</button>
              </div>
            </motion.div>
          )}

          {addresses.length === 0 ? (
            <p className="text-sm text-muted-foreground">No whitelisted addresses. Add one to secure withdrawals.</p>
          ) : (
            <div className="space-y-2">
              {addresses.map(a => (
                <div key={a.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/30">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-muted shrink-0">{a.method}</span>
                    <span className="text-sm font-mono truncate">{a.address}</span>
                    <span className="text-xs text-muted-foreground shrink-0">{a.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => copyAddress(a.address)} className="p-1.5 text-muted-foreground hover:text-foreground" title="Copy">
                      {copied === a.address ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button onClick={() => deleteAddress(a.id)} className="p-1.5 text-muted-foreground hover:text-destructive" title="Delete">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}