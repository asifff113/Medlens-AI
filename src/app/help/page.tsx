"use client";
import { useState } from "react";

export default function HelpPage() {
  const [text, setText] = useState("");
  const [support, setSupport] = useState<any | null>(null);
  const [resources, setResources] = useState<any[]>([]);

  async function askHelp() {
    const r = await fetch("/api/v1/cases/case_rahima/support", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, language: "bn", transcriptConfirmed: true }),
    });
    const d = await r.json();
    setSupport(d.data);
    const r2 = await fetch("/api/v1/cases/case_rahima/support?lang=bn").then((r) => r.json());
    setResources(r2.data?.resources ?? []);
  }

  return (
    <div className="space-y-4">
      <div className="prose-card">
        <p className="section-title">U12 · Help surface</p>
        <h1 className="mt-2 text-2xl font-semibold">You are not alone.</h1>
        <p className="mt-2 text-sm text-ink-700">
          This surface is always available without login. It is NOT a clinical
          service. It does not diagnose, monitor or alert anyone. Use it to reach
          a verified human-help route in Bangladesh. Sharing is your choice.
        </p>
        <p className="mt-2 text-sm text-ink-700">
          Generic human-help routes:
        </p>
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-ink-800">
          <li>National Emergency Service: 999</li>
          <li>Government family-health hotline: 16789</li>
          <li>Reach your nearest upazila health complex or medical college casualty</li>
        </ul>
      </div>

      <div className="prose-card">
        <p className="section-title">Verified support resources</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {resources.length === 0 && <p className="text-sm text-ink-500">No verified resources loaded.</p>}
          {resources.map((r) => (
            <div key={r.id} className="rounded-lg border border-ink-200 bg-white p-3">
              <p className="font-medium">{r.display_contact}</p>
              <p className="text-sm text-ink-700">{r.channel} · {r.hours}</p>
              <p className="text-xs text-ink-500">Verified {r.last_verified_at}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="prose-card">
        <p className="section-title">Share a concern with your named clinician</p>
        <p className="mt-1 text-xs text-ink-500">Opt-in only. No automated alert. Handoff state is honest.</p>
        <textarea
          className="mt-2 w-full rounded-md border border-ink-200 p-2 text-sm"
          rows={4}
          placeholder="আপনার কথা লিখুন"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <button className="btn-primary mt-2" onClick={askHelp}>Send to my clinician</button>
        {support && (
          <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3 text-sm">
            <p className="font-medium">Observation: <span className="tag-wellbeing">{support.observation}</span></p>
            <p className="mt-1">Monitoring available: {String(support.protocol.monitoringAvailable)} · Delivery mode: {String(support.protocol.deliveryMode)}</p>
          </div>
        )}
      </div>
    </div>
  );
}