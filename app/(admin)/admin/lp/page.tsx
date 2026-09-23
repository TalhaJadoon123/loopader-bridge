"use client";

import { useState, useEffect } from "react";
import { Shield, AlertTriangle, Save, Lock, Unlock, Loader2, CheckCircle, XCircle } from "lucide-react";

interface LpConfig {
  provider: string;
  apiKey: string;
  apiUrl: string;
  lpAccountId: string;
  enabled: boolean;
}

export default function AdminLpPage() {
  const [config, setConfig] = useState<LpConfig>({
    provider: "STUB",
    apiKey: "",
    apiUrl: "",
    lpAccountId: "",
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchConfig = async () => {
    try {
      const res = await fetch("/api/admin/lp/config");
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (e) {
      console.error("Failed to fetch LP config:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field: keyof LpConfig, value: any) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/lp/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Save failed");
      setMessage({ type: "success", text: "LP configuration saved successfully" });
      fetchConfig();
    } catch (e: any) {
      setMessage({ type: "error", text: e.message ?? "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const providers = [
    { value: "STUB", label: "Stub (Testing Only)" },
    { value: "MATCH_PRIME", label: "Match-Prime" },
    { value: "B2BROKER", label: "B2Broker" },
    { value: "OTHER", label: "Other / Custom" },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">LP Configuration</h1>
          <p className="text-muted-foreground">Configure Liquidity Provider for live trading</p>
        </div>
      </div>

      {message && (
        <div className={`rounded-lg p-4 ${message.type === "success" ? "bg-green-50 border-green-200 text-green-800" : "bg-red-50 border-red-200 text-red-800"} flex items-center gap-2`}>
          {message.type === "success" ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
          {message.text}
        </div>
      )}

      {/* Warning Banner */}
      {config.enabled && (
        <div className="rounded-lg border-2 border-amber-500 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="w-6 h-6 text-amber-500 mt-0.5 shrink-0" />
          <div>
            <h3 className="font-semibold text-amber-800">Live Trading Enabled</h3>
            <p className="text-amber-700 mt-1">
              Real money is now at risk. Ensure your LP account is funded and properly configured.
              Monitor exposure limits and hedge positions regularly.
            </p>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-primary" />
          <h2 className="text-lg font-semibold">LP Provider Settings</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Provider</label>
            <select
              value={config.provider}
              onChange={(e) => handleChange("provider", e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            >
              {providers.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API Key</label>
            <div className="relative">
              <input
                type="password"
                value={config.apiKey === "****" ? "" : config.apiKey}
                onChange={(e) => handleChange("apiKey", e.target.value)}
                placeholder={config.apiKey === "****" ? "•••••••• (set in .env)" : "Enter API key"}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-10"
              />
              {config.apiKey === "****" && (
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Stored encrypted. Shows **** if already set.</p>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">API URL</label>
            <input
              type="url"
              value={config.apiUrl}
              onChange={(e) => handleChange("apiUrl", e.target.value)}
              placeholder="https://api.lp-provider.com"
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">LP Account ID</label>
            <input
              type="text"
              value={config.lpAccountId}
              onChange={(e) => handleChange("lpAccountId", e.target.value)}
              placeholder="Your LP account identifier"
              className="w-full rounded-lg border border-input bg-background px-3 py-2"
            />
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => handleChange("enabled", e.target.checked)}
                className="w-4 h-4 rounded border-input text-primary focus:ring-primary"
              />
              <span className="font-medium">Enable Live Trading</span>
            </label>
            {config.enabled && <Unlock className="w-5 h-5 text-green-500" />}
            {!config.enabled && <Lock className="w-5 h-5 text-muted-foreground" />}
          </div>
        </div>

        <div className="pt-4 border-t">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-50"
          >
            {saving ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                Save Configuration
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}