"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function DoctorBriefPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [brief, setBrief] = useState<any | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function compose() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/v1/cases/${caseId}/brief`, { method: "POST" });
      const d = await r.json();
      if (!r.ok) setError(d.error?.message ?? "Brief unavailable.");
      else setBrief(d.data);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { compose(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [caseId]);

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · Doctor · Case {caseId} · Brief
      </nav>
      <div className="prose-card">
        <p className="section-title">U7 · One-minute brief</p>
        <p className="text-xs text-ink-500">Re-composed fresh on each request. Policy and grant rechecked on every read.</p>
        <div className="mt-3 flex gap-2">
          <button className="btn-primary" onClick={compose} disabled={busy}>{busy ? "Composing…" : "Recompose brief"}</button>
          <Link className="btn-secondary" href={`/doctor/cases/${caseId}/visit/today`}>Today's visit</Link>
        </div>
        {error && <p className="mt-3 rounded-md bg-red-100 p-2 text-sm text-red-800">{error}</p>}
      </div>

      {brief && (
        <>
          {Object.entries(brief.sections ?? {}).map(([section, items]: any) => (
            <div key={section} className="prose-card">
              <p className="section-title">{section} ({items.length})</p>
              <ul className="mt-2 space-y-2">
                {items.map((it: any) => (
                  <li key={it.id} className="rounded-lg border border-ink-200 bg-white p-3">
                    <p className="text-sm text-ink-800">{it.displayText}</p>
                    <p className="mt-1 text-xs text-ink-500">
                      <span className="tag-doc">{it.kind}</span> · why <span className="tag-derived">{it.whyCode}</span> · sensitivity {it.sensitivity}
                      {it.evidenceAnchorIds?.length ? ` · ${it.evidenceAnchorIds.length} evidence anchor(s)` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {brief.abstained?.length > 0 && (
            <div className="prose-card">
              <p className="section-title">Abstentions ({brief.abstained.length})</p>
              <p className="text-xs text-ink-500">Items suppressed because no valid evidence anchor was available.</p>
              <ul className="mt-2 space-y-1 text-sm text-ink-700">
                {brief.abstained.map((a: any, idx: number) => (
                  <li key={idx}>· {a.reason} ({a.factRevisionId})</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}