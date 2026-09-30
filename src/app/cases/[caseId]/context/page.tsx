"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function ContextPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [context, setContext] = useState<any | null>(null);

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}/context`).then((r) => r.json()).then((d) => setContext(d.data));
  }, [caseId]);

  if (!context) return <p>Loading…</p>;

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/cases/${caseId}`} className="hover:underline">Case</Link> · Context
      </nav>
      <div className="prose-card">
        <p className="section-title">U3 · Medication board · Context v{context.contextVersion}</p>
        <p className="text-xs text-ink-500">Prescribed vs. seen-at-home vs. reported-use and confirmed plan are projected in parallel.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {context.medications.map((m: any) => (
            <div key={m.revisionId} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="tag-derived">{m.normalized.evidence_kind?.toLowerCase().replaceAll("_", " ")}</span>
                <span className="text-xs text-ink-500">{m.normalized.claimed_lifecycle?.toLowerCase()}</span>
              </div>
              <p className="mt-1 font-medium">{m.normalized.brand ?? m.rawText}</p>
              <p className="text-sm text-ink-600">{m.normalized.ingredient_names} {m.normalized.strength_value}{m.normalized.strength_unit}</p>
              <p className="text-xs text-ink-500">Event date {m.normalized.effective_start ?? "?"}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="prose-card">
        <p className="section-title">Lab series</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {context.labs.map((l: any) => (
            <div key={l.revisionId} className="rounded-lg border border-ink-200 bg-white p-3">
              <p className="font-medium">{l.analyte ?? l.original_test}</p>
              <p className="text-sm text-ink-600">{l.normalized_decimal ?? l.original_value} {l.normalized_unit ?? l.original_unit}</p>
              <p className="text-xs text-ink-500">{l.result_date} · {l.method}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="prose-card">
        <p className="section-title">Allergies / reactions</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {context.allergies.map((a: any) => (
            <div key={a.revisionId} className="rounded-lg border border-ink-200 bg-white p-3">
              <p className="font-medium">{a.normalized.substance}</p>
              <p className="text-sm text-ink-600">{a.normalized.reactionText}</p>
              <p className="text-xs text-ink-500">Verification: {a.normalized.verification}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}