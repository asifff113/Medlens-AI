"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function PreparePage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [interview, setInterview] = useState<any | null>(null);
  const [issues, setIssues] = useState<any[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}/issues`).then((r) => r.json()).then((d) => setIssues(d.data?.issues ?? []));
  }, [caseId]);

  async function startInterview() {
    setBusy(true);
    try {
      const r = await fetch(`/api/v1/cases/${caseId}/interviews`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ language: "bn" }),
      });
      const d = await r.json();
      setInterview(d.data);
    } finally {
      setBusy(false);
    }
  }

  async function answer(qid: string, optionId: string) {
    setAnswers((prev) => ({ ...prev, [qid]: optionId }));
    await fetch(`/api/v1/questions/${qid}/answer`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ optionId }),
    });
  }

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/cases/${caseId}`} className="hover:underline">Case</Link> · Prepare
      </nav>
      <div className="prose-card">
        <p className="section-title">U4 · Pre-visit interview</p>
        <p className="mt-1 text-sm text-ink-600">Neutral Bangla questions selected by the question planner.</p>
        <div className="mt-3 flex items-center gap-2">
          <button className="btn-primary" onClick={startInterview} disabled={busy}>{busy ? "Starting…" : "Start interview"}</button>
          <Link className="btn-secondary" href={`/cases/${caseId}/sharing`}>Share with doctor</Link>
        </div>
      </div>

      {interview && (
        <div className="prose-card fade-in">
          <p className="section-title">Questions ({interview.questions.length})</p>
          <div className="mt-2 space-y-3">
            {interview.questions.map((q: any, idx: number) => (
              <div key={q.id} className="rounded-lg border border-ink-200 bg-white p-3">
                <p className="text-sm font-medium">{idx + 1}. {q.text}</p>
                <div className="mt-2 grid gap-2 md:grid-cols-2">
                  {q.options.map((o: any) => (
                    <button
                      key={o.id}
                      className={`btn-secondary justify-start text-left ${answers[q.id] === o.id ? "ring-2 ring-accent-500" : ""}`}
                      onClick={() => answer(q.id, o.id)}
                    >
                      <span className="font-medium">{o.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-ink-500">Unknown / Skip available</p>
              </div>
            ))}
            {interview.questions.length === 0 && <p className="text-sm text-ink-500">No open issues. Interview skipped.</p>}
          </div>
        </div>
      )}

      <div className="prose-card">
        <p className="section-title">Open issues</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {issues.map((i) => (
            <div key={i.id} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="tag-derived">{i.type}</span>
                <span className="label-chip">{i.priority}</span>
              </div>
              <p className="mt-1 text-sm text-ink-800">{i.summary}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}