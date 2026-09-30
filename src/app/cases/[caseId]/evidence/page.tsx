"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function EvidencePage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [sources, setSources] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}/sources`).then((r) => r.json()).then((d) => setSources(d.data?.sources ?? []));
  }, [caseId]);

  async function processSource(id: string) {
    setBusyId(id);
    try {
      const r = await fetch(`/api/v1/cases/${caseId}/process`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      const d = await r.json();
      setResult(d.data);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/cases/${caseId}`} className="hover:underline">Case</Link> · Evidence
      </nav>
      <div className="prose-card">
        <p className="section-title">U2 · Evidence tray</p>
        <p className="mt-1 text-sm text-ink-600">Each source artifact runs the extraction pipeline. Click <em>Process</em> on a paper to drive the AI adapter end-to-end.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {sources.map((s) => (
          <div key={s.id} className="rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="tag-doc">{s.kind}</span>
              <span className={`label-chip ${
                s.state === "ADMITTED" ? "bg-green-100 text-green-800" :
                s.state === "QUARANTINED" ? "bg-red-100 text-red-800" :
                s.state === "REVIEW_REQUIRED" ? "bg-yellow-100 text-yellow-800" : ""
              }`}>{s.state}</span>
            </div>
            <p className="mt-2 text-sm font-medium">{s.filename_safe}</p>
            <p className="mt-1 text-xs text-ink-500">ID {s.id} · event {s.event_date ?? "?"}</p>
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-secondary text-xs" disabled={busyId === s.id} onClick={() => processSource(s.id)}>
                {busyId === s.id ? "Running…" : "Process"}
              </button>
              {s.state === "QUARANTINED" && <span className="tag-quarantine">Wrong patient — no facts admitted</span>}
              {s.state === "REVIEW_REQUIRED" && <span className="tag-review">Handwriting review</span>}
            </div>
          </div>
        ))}
      </div>
      {result && (
        <div className="prose-card fade-in">
          <p className="section-title">Processing result</p>
          <pre className="mt-2 max-h-96 overflow-auto rounded-md bg-ink-900 p-3 text-xs text-ink-100">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}