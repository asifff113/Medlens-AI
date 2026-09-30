"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function HistoryPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [audit, setAudit] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}/audit`).then((r) => r.json()).then((d) => setAudit(d.data?.events ?? [])).catch(() => setAudit([]));
  }, [caseId]);

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/cases/${caseId}`} className="hover:underline">Case</Link> · History
      </nav>
      <div className="prose-card">
        <p className="section-title">U10 · Audit log</p>
        <p className="text-xs text-ink-500">Minimal metadata only. No medical snippets.</p>
        <div className="mt-3 space-y-1">
          {audit.length === 0 && <p className="text-sm text-ink-500">No events yet.</p>}
          {audit.map((e) => (
            <div key={e.id} className="rounded-md border border-ink-200 bg-white px-3 py-2 text-sm">
              <span className="text-ink-500">{e.occurred_at}</span> · <span className="font-medium">{e.action}</span> · <span className="text-xs">{e.actor_or_service_id}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}