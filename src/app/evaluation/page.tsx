"use client";
import { useEffect, useState } from "react";

export default function EvaluationPage() {
  const [data, setData] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    const r = await fetch("/api/v1/evaluation");
    const d = await r.json();
    setData(d.data);
  }
  useEffect(() => { load(); }, []);

  async function run() {
    setBusy(true);
    await fetch("/api/v1/evaluation", { method: "POST" });
    await load();
    setBusy(false);
  }

  return (
    <div className="space-y-4">
      <div className="prose-card">
        <p className="section-title">U11 · Evaluation dashboard</p>
        <p className="mt-1 text-sm text-ink-600">Synthetic frozen fixtures only. Each metric shows its actual numerator and denominator.</p>
        <button className="btn-primary mt-3" onClick={run} disabled={busy}>{busy ? "Running…" : "Run evaluation"}</button>
      </div>
      {data && (
        <div className="prose-card">
          <p className="section-title">Latest metrics</p>
          <table className="mt-2 w-full text-sm">
            <thead>
              <tr className="text-left text-ink-500"><th>Metric</th><th>Slice</th><th>Num</th><th>Den</th><th>Value</th></tr>
            </thead>
            <tbody>
              {data.metrics.map((m: any) => (
                <tr key={m.id} className="border-t border-ink-100">
                  <td className="py-1 pr-2">{m.metric_key}</td>
                  <td className="py-1 pr-2">{m.slice}</td>
                  <td className="py-1 pr-2">{m.numerator}</td>
                  <td className="py-1 pr-2">{m.denominator}</td>
                  <td className="py-1 pr-2">{m.value != null ? (m.value * 100).toFixed(1) + "%" : "n/a"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}