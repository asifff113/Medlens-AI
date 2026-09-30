"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";

interface CaseView {
  case: { id: string; context_version: number; privacy_epoch: number; status: string };
  patient: { id: string; display_name: string; birth_year: number; preferred_language: string };
}

export default function CaseOverview() {
  const params = useParams<{ caseId: string }>();
  const router = useRouter();
  const caseId = params.caseId;
  const [view, setView] = useState<CaseView | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [issues, setIssues] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}`).then((r) => r.json()).then((d) => setView(d.data));
    fetch(`/api/v1/cases/${caseId}/sources`).then((r) => r.json()).then((d) => setSources(d.data?.sources ?? []));
    fetch(`/api/v1/cases/${caseId}/issues`).then((r) => r.json()).then((d) => setIssues(d.data?.issues ?? []));
  }, [caseId]);

  async function reconcile() {
    await fetch(`/api/v1/cases/${caseId}/reconcile`, { method: "POST" });
    const r = await fetch(`/api/v1/cases/${caseId}/issues`).then((r) => r.json());
    setIssues(r.data?.issues ?? []);
  }

  return (
    <div className="space-y-6">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · Case {caseId}
      </nav>
      {view && (
        <div className="prose-card">
          <p className="section-title">U1 · Case overview</p>
          <div className="mt-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">{view.patient.display_name}</h2>
              <p className="text-sm text-ink-600">
                Patient ID {view.patient.id} · born {view.patient.birth_year} · {view.patient.preferred_language.toUpperCase()}
              </p>
            </div>
            <div className="text-right text-xs text-ink-500">
              <div>Context v{view.case.context_version}</div>
              <div>Privacy epoch {view.case.privacy_epoch}</div>
              <div>Status {view.case.status}</div>
            </div>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <Link className="btn-secondary justify-center" href={`/cases/${caseId}/evidence`}>Evidence ({sources.length})</Link>
            <Link className="btn-secondary justify-center" href={`/cases/${caseId}/context`}>Medication board</Link>
            <Link className="btn-secondary justify-center" href={`/cases/${caseId}/prepare`}>Prepare</Link>
            <Link className="btn-secondary justify-center" href={`/cases/${caseId}/wellbeing`}>Wellbeing</Link>
            <Link className="btn-secondary justify-center" href={`/cases/${caseId}/sharing`}>Share</Link>
            <Link className="btn-secondary justify-center" href={`/cases/${caseId}/history`}>History</Link>
            <button className="btn-primary" onClick={reconcile}>Run reconcile</button>
            <button className="btn-secondary" onClick={() => router.refresh()}>Refresh</button>
          </div>
        </div>
      )}

      <div className="prose-card">
        <p className="section-title">Issues ({issues.length})</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {issues.length === 0 && <p className="text-sm text-ink-500">Run reconcile to compute issues.</p>}
          {issues.map((i) => (
            <div key={i.id} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="tag-derived">{i.type}</span>
                <span className={`label-chip ${i.priority === "REVIEW_FIRST" ? "bg-yellow-100 text-yellow-800" : ""}`}>{i.priority}</span>
              </div>
              <p className="mt-2 text-sm text-ink-800">{i.summary}</p>
              <p className="mt-1 text-xs text-ink-500">{i.status} · rule v{i.rule_version}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="prose-card">
        <p className="section-title">Sources ({sources.length})</p>
        <div className="mt-2 grid gap-2 md:grid-cols-3">
          {sources.map((s) => (
            <div key={s.id} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="tag-doc">{s.kind}</span>
                <span className={`label-chip ${
                  s.state === "ADMITTED" ? "bg-green-100 text-green-800" :
                  s.state === "QUARANTINED" ? "bg-red-100 text-red-800" :
                  s.state === "REVIEW_REQUIRED" ? "bg-yellow-100 text-yellow-800" : ""
                }`}>{s.state}</span>
              </div>
              <p className="mt-2 text-sm font-medium">{s.filename_safe}</p>
              <p className="mt-1 text-xs text-ink-500">Event date {s.event_date ?? "unknown"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}