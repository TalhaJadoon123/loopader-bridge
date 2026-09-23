"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Calculator, ArrowRightLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import DashboardLayout from "@/components/layout/DashboardLayout";

type CalcType = "pip" | "margin" | "position" | "convert";

const SYMBOLS = ["EURUSD", "GBPUSD", "USDJPY", "XAUUSD", "BTCUSD", "AUDUSD", "USDCAD", "NZDUSD"];

export default function ToolsPage() {
  const [tab, setTab] = useState<CalcType>("pip");
  const [result, setResult] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const calculate = async () => {
    setLoading(true);
    setResult("");
    const params = new URLSearchParams({ type: tab });

    if (tab === "pip") { params.set("symbol", inputs.symbol ?? "EURUSD"); params.set("volume", inputs.volume ?? "0.1"); }
    if (tab === "margin") { params.set("symbol", inputs.symbol ?? "EURUSD"); params.set("volume", inputs.volume ?? "0.1"); params.set("price", inputs.price ?? "1.08"); params.set("leverage", inputs.leverage ?? "30"); }
    if (tab === "position") { params.set("balance", inputs.balance ?? "10000"); params.set("riskPct", inputs.riskPct ?? "2"); params.set("slPips", inputs.slPips ?? "20"); params.set("symbol", inputs.symbol ?? "EURUSD"); }
    if (tab === "convert") { params.set("amount", inputs.amount ?? "1"); params.set("from", inputs.from ?? "USD"); params.set("to", inputs.to ?? "PKR"); params.set("rate", inputs.rate ?? "278"); }

    try {
      const res = await fetch(`/api/tools/calculate?${params.toString()}`);
      const data = await res.json();
      if (tab === "pip") setResult(`Value per pip: $${data.valuePerPip?.toFixed(2) ?? "—"}`);
      if (tab === "margin") setResult(`Margin required: $${data.marginRequired?.toFixed(2) ?? "—"}`);
      if (tab === "position") setResult(`Recommended lot size: ${data.lotSize ?? "—"} lots (risk $${data.riskAmount?.toFixed(2) ?? "—"})`);
      if (tab === "convert") setResult(`${inputs.amount ?? 0} ${inputs.from ?? ""} = ${data.converted ?? "—"} ${inputs.to ?? ""}`);
    } catch { setResult("Calculation failed"); }
    finally { setLoading(false); }
  };

  const set = (k: string, v: string) => setInputs(prev => ({ ...prev, [k]: v }));

  const tabs: Array<{ id: CalcType; label: string }> = [
    { id: "pip", label: "Pip Value" },
    { id: "margin", label: "Margin" },
    { id: "position", label: "Position Size" },
    { id: "convert", label: "Currency" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Calculator className="w-6 h-6 text-primary" /> Trading Calculators</h1>
          <p className="text-sm text-muted-foreground">Quick, accurate tools to plan every trade</p>
        </div>

        <div className="flex gap-2 flex-wrap">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => { setTab(t.id); setResult(""); }}
              className={cn("px-4 py-2 rounded-lg text-sm font-medium transition-colors", tab === t.id ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/80")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-xl p-6 space-y-4">
          {tab === "pip" && (
            <>
              <Field label="Symbol" type="select" options={SYMBOLS} value={inputs.symbol ?? "EURUSD"} onChange={v => set("symbol", v)} />
              <Field label="Volume (lots)" type="number" value={inputs.volume ?? "0.1"} onChange={v => set("volume", v)} placeholder="0.1" />
            </>
          )}
          {tab === "margin" && (
            <>
              <Field label="Symbol" type="select" options={SYMBOLS} value={inputs.symbol ?? "EURUSD"} onChange={v => set("symbol", v)} />
              <Field label="Volume (lots)" type="number" value={inputs.volume ?? "1"} onChange={v => set("volume", v)} placeholder="1.0" />
              <Field label="Price" type="number" value={inputs.price ?? "1.08"} onChange={v => set("price", v)} placeholder="1.08" />
              <Field label="Leverage" type="select" options={["30", "100", "500", "1000", "2000", "3000"]} value={inputs.leverage ?? "30"} onChange={v => set("leverage", v)} />
            </>
          )}
          {tab === "position" && (
            <>
              <Field label="Balance ($)" type="number" value={inputs.balance ?? "10000"} onChange={v => set("balance", v)} />
              <Field label="Risk %" type="number" value={inputs.riskPct ?? "2"} onChange={v => set("riskPct", v)} />
              <Field label="Stop Loss (pips)" type="number" value={inputs.slPips ?? "20"} onChange={v => set("slPips", v)} />
              <Field label="Symbol" type="select" options={SYMBOLS} value={inputs.symbol ?? "EURUSD"} onChange={v => set("symbol", v)} />
            </>
          )}
          {tab === "convert" && (
            <>
              <Field label="Amount" type="number" value={inputs.amount ?? "100"} onChange={v => set("amount", v)} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="From" type="select" options={["USD", "EUR", "GBP", "PKR", "AED", "SAR"]} value={inputs.from ?? "USD"} onChange={v => set("from", v)} />
                <Field label="To" type="select" options={["USD", "EUR", "GBP", "PKR", "AED", "SAR"]} value={inputs.to ?? "PKR"} onChange={v => set("to", v)} />
              </div>
              <Field label="Exchange Rate" type="number" value={inputs.rate ?? "278"} onChange={v => set("rate", v)} />
            </>
          )}

          <button
            onClick={calculate}
            disabled={loading}
            className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-semibold hover:opacity-90 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ArrowRightLeft className="w-5 h-5" />}
            Calculate
          </button>

          {result && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="p-4 bg-primary/10 border border-primary/30 rounded-lg text-center font-mono text-primary">
              {result}
            </motion.div>
          )}
        </div>

        <div className="text-xs text-muted-foreground bg-card border border-border rounded-lg p-3">
          💡 Risk tip: Risk no more than 1-2% of your account per trade. Use the Position Size calculator to size correctly.
        </div>
      </div>
    </DashboardLayout>
  );
}

function Field({ label, type, value, onChange, options, placeholder }: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  options?: string[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1.5">{label}</label>
      {type === "select" ? (
        <select value={value} onChange={e => onChange(e.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring">
          {(options ?? []).map((o: string) => <option key={o} value={o}>{o}</option>)}
        </select>
      ) : (
        <input type="number" step="any" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className="w-full px-3 py-2.5 rounded-lg border border-border bg-input focus:outline-none focus:ring-2 focus:ring-ring" />
      )}
    </div>
  );
}