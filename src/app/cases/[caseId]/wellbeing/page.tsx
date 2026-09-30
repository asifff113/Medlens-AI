"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function WellbeingPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [view, setView] = useState<"home" | "self-report" | "assessment" | "share">("home");
  const [session, setSession] = useState<any | null>(null);
  const [responses, setResponses] = useState<Record<string, number | null>>({});
  const [score, setScore] = useState<{ rawTotal: number; transformedScore: number; runtimeMode: string } | null>(null);
  const [supportOpen, setSupportOpen] = useState<{ observation: string; shouldShowSupport: boolean } | null>(null);
  const [selfReportText, setSelfReportText] = useState("");
  const [topic, setTopic] = useState("sleep");
  const [requestDiscussion, setRequestDiscussion] = useState(true);

  async function startAssessment() {
    const r = await fetch(`/api/v1/cases/${caseId}/assessments`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ language: "bn" }),
    });
    const d = await r.json();
    if (d.data?.state === "IN_PROGRESS") setSession(d.data);
    else setSession(d.data);
  }

  async function submitAssessment() {
    if (!session) return;
    const rs = Object.entries(responses)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([itemId, value]) => ({ itemId, value: value as number, confirmed: true }));
    const r = await fetch(`/api/v1/cases/${caseId}/assessments/submit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        sessionId: session.sessionId,
        definitionChecksum: session.definitionChecksum,
        responses: rs,
      }),
    });
    const d = await r.json();
    if (d.error) alert(d.error.message);
    else setScore(d.data);
  }

  async function submitSelfReport() {
    await fetch(`/api/v1/cases/${caseId}/wellbeing`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        originalWording: selfReportText,
        topicSelected: topic,
        onset: "2024-01-01",
        datePrecision: "MONTH",
        requestDiscussion,
        presentationPreference: "RESPECTFUL",
      }),
    });
    setView("home");
    setSelfReportText("");
  }

  async function triggerSupport(text: string) {
    const r = await fetch(`/api/v1/cases/${caseId}/support`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, language: "bn", transcriptConfirmed: true }),
    });
    const d = await r.json();
    setSupportOpen({ observation: d.data.observation, shouldShowSupport: d.data.shouldShowSupport });
  }

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/cases/${caseId}`} className="hover:underline">Case</Link> · Wellbeing
      </nav>
      <div className="prose-card">
        <p className="section-title">U5 · Private wellbeing</p>
        <p className="mt-1 text-sm text-ink-600">Voluntary. Healthcare intake continues even if you skip this branch.</p>
        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <button className="btn-secondary" onClick={() => setView("self-report")}>Add own-words concern</button>
          <button className="btn-secondary" onClick={async () => { await startAssessment(); setView("assessment"); }}>Take WHO-5 assessment</button>
          <button className="btn-secondary" onClick={() => setView("share")}>Share selected with doctor</button>
          <Link className="btn-secondary justify-center" href="/help">Get help</Link>
        </div>
      </div>

      {view === "self-report" && (
        <div className="prose-card fade-in">
          <p className="section-title">Own-words concern</p>
          <textarea
            className="mt-2 w-full rounded-md border border-ink-200 p-2 text-sm"
            rows={4}
            placeholder="আপনার অনুভূতি নিজের ভাষায় লিখুন"
            value={selfReportText}
            onChange={(e) => setSelfReportText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-3 text-sm">
            <label>Topic:
              <select value={topic} onChange={(e) => setTopic(e.target.value)} className="ml-2 rounded-md border border-ink-200 px-2 py-1">
                <option value="sleep">ঘুম</option>
                <option value="mood">মন</option>
                <option value="stress">চাপ</option>
                <option value="daily">দৈনন্দিন</option>
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={requestDiscussion} onChange={(e) => setRequestDiscussion(e.target.checked)} /> Discuss with doctor
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={submitSelfReport}>Save privately</button>
            <button className="btn-secondary" onClick={() => setView("home")}>Cancel</button>
          </div>
        </div>
      )}

      {view === "assessment" && session && session.state !== "UNAVAILABLE" && !score && (
        <div className="prose-card fade-in">
          <p className="section-title">WHO-5 Well-Being Index · DEMO_ONLY</p>
          <p className="mt-1 text-xs text-ink-500">Synthetic paraphrase of the official items for demonstration; replace with verbatim text after G02.</p>
          <div className="mt-3 space-y-3">
            {session.items.map((item: any) => (
              <div key={item.itemId} className="rounded-lg border border-ink-200 bg-white p-3">
                <p className="text-sm font-medium">{item.text}</p>
                <div className="mt-2 grid gap-1 md:grid-cols-6">
                  {item.options.map((o: any) => (
                    <button
                      key={o.value}
                      className={`rounded-md border px-2 py-1 text-xs ${responses[item.itemId] === o.value ? "border-accent-500 bg-accent-100" : "border-ink-200 bg-white"}`}
                      onClick={() => setResponses((prev) => ({ ...prev, [item.itemId]: o.value }))}
                    >
                      {o.value} — {o.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={submitAssessment} disabled={Object.keys(responses).length < 5}>
              Submit
            </button>
            <button className="btn-secondary" onClick={() => setView("home")}>Cancel</button>
          </div>
        </div>
      )}

      {score && (
        <div className="prose-card fade-in">
          <p className="section-title">Score · DEMO_ONLY</p>
          <p className="mt-2 text-2xl font-semibold">{score.rawTotal} / 25 <span className="text-ink-500 text-base">({score.transformedScore} / 100 transformed)</span></p>
          <p className="text-xs text-ink-500">Arithmetic only. No clinical interpretation. No support escalation.</p>
          <button className="btn-secondary mt-3" onClick={() => { setScore(null); setResponses({}); setSession(null); setView("home"); }}>Done</button>
        </div>
      )}

      {view === "share" && (
        <div className="prose-card fade-in">
          <p className="section-title">Selective wellbeing sharing</p>
          <p className="mt-1 text-sm text-ink-600">Share only the wording you chose. No diagnosis is implied.</p>
          <Link className="btn-primary mt-3" href={`/cases/${caseId}/sharing`}>Open sharing controls</Link>
        </div>
      )}

      <div className="prose-card">
        <p className="section-title">Support interruption test</p>
        <p className="mt-1 text-sm text-ink-600">Enter an explicit current concern to see the support surface light up (synthetic demo).</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="btn-secondary" onClick={() => triggerSupport("আমি মরতে চাই")}>Trigger CURRENT_EXPLICIT</button>
          <button className="btn-secondary" onClick={() => triggerSupport("কখনো না, ভালো আছি")}>Trigger NEGATED</button>
          <button className="btn-secondary" onClick={() => triggerSupport("আগে একবার খারাপ লেগেছিল")}>Trigger HISTORICAL</button>
        </div>
        {supportOpen && (
          <div className="mt-3 rounded-md border border-purple-200 bg-purple-50 p-3 text-sm">
            <p className="font-medium">Observation: <span className="tag-wellbeing">{supportOpen.observation}</span></p>
            {supportOpen.shouldShowSupport ? (
              <p className="mt-2 text-purple-900">Support surface shown (HUMAN-HELP ONLY — no clinical detection).</p>
            ) : (
              <p className="mt-2 text-purple-900">No support surface (current concern not asserted).</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}