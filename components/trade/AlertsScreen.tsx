"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Plus, Bell, BellOff, Trash2, Edit } from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  symbol: string;
  condition: "ABOVE" | "BELOW" | "CROSSES";
  targetPrice: number;
  isTriggered: boolean;
}

export function AlertsScreen() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ symbol: "EURUSD", condition: "ABOVE", targetPrice: "" });

  const fetchAlerts = async () => {
    try {
      const res = await fetch("/api/alerts");
      const data = await res.json();
      if (data.alerts) setAlerts(data.alerts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, []);

  const createAlert = async () => {
    if (!form.targetPrice) return;
    try {
      await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, targetPrice: parseFloat(form.targetPrice) }),
      });
      setForm({ symbol: "EURUSD", condition: "ABOVE", targetPrice: "" });
      setShowForm(false);
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteAlert = async (id: string) => {
    try {
      await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  const toggleAlert = async (id: string, triggered: boolean) => {
    try {
      await fetch(`/api/alerts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTriggered: !triggered }),
      });
      fetchAlerts();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64">Loading…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Price Alerts</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Alert
        </button>
      </div>

      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className="bg-card border border-border rounded-xl p-4 space-y-4"
        >
          <h3 className="font-semibold">Create Price Alert</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Symbol</label>
              <select
                value={form.symbol}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="EURUSD">EURUSD</option>
                <option value="GBPUSD">GBPUSD</option>
                <option value="USDJPY">USDJPY</option>
                <option value="XAUUSD">XAUUSD</option>
                <option value="BTCUSD">BTCUSD</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Condition</label>
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as any })}
                className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="ABOVE">Price goes above</option>
                <option value="BELOW">Price goes below</option>
                <option value="CROSSES">Price crosses</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Target Price</label>
              <input
                type="number"
                step="0.00001"
                value={form.targetPrice}
                onChange={(e) => setForm({ ...form, targetPrice: e.target.value })}
                placeholder="1.08500"
                className="w-full px-3 py-2 rounded border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={createAlert}
              className="flex-1 px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90"
            >
              Create Alert
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/80"
            >
              Cancel
            </button>
          </div>
        </motion.div>
      )}

      {alerts.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
          <Bell className="w-12 h-12 mb-4 text-muted-foreground/50" />
          <p className="text-lg">No alerts set</p>
          <p className="text-sm">Create your first price alert above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-card border border-border rounded-lg p-4 flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-4 flex-1">
                <span className={cn("px-2 py-1 rounded text-sm font-medium", alert.isTriggered ? "bg-green-600/20 text-green-600" : "bg-yellow-600/20 text-yellow-600")}>
                  {alert.isTriggered ? "Triggered" : "Active"}
                </span>
                <div>
                  <p className="font-medium font-mono">{alert.symbol}</p>
                  <p className="text-sm text-muted-foreground">
                    {alert.condition === "ABOVE" && "Price >"}
                    {alert.condition === "BELOW" && "Price <"}
                    {alert.condition === "CROSSES" && "Price crosses"}
                    {alert.targetPrice.toFixed(5)}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!alert.isTriggered && (
                  <button
                    onClick={() => toggleAlert(alert.id, alert.isTriggered)}
                    className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-foreground"
                    title="Toggle"
                  >
                    <BellOff className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={() => deleteAlert(alert.id)}
                  className="p-2 rounded hover:bg-secondary text-muted-foreground hover:text-destructive"
                  title="Delete"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}