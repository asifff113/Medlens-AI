"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function VisitUpdatePage() {
  const params = useParams<{ caseId: string; visitId: string }>();
  const caseId = params.caseId;
  const visitId = params.visitId;
  const [updateId, setUpdateId] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [decided, setDecided] = useState<Record<string, "ACCEPT" | "REJECT">>({});
  const [committed, setCommitted] = useState<any | null>(null);

  async function build() {
    const r = await fetch(`/api/v1/cases/${caseId}/visit-update`, { method: "POST" });
    const d = await r.json();
    setUpdateId(d.data.updateId);
    const itemsRes = await fetch(`/api/v1/updates/${d.data.updateId}/items`).catch(() => null);
    if (itemsRes) {
      const itemsJson = await itemsRes.json();
      setItems(itemsJson.data?.items ?? []);
    }
  }

  async function commit() {
    if (!updateId) return;
    const itemIds = Object.entries(decided).filter(([, v]) => v === "ACCEPT").map(([id]) => id);
    const r = await fetch(`/api/v1/updates/${updateId}/commit`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemIds }),
    });
    const d = await r.json();
    if (d.error) alert(d.error.message);
    else setCommitted(d.data);
  }

  useEffect(() => { build(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/doctor/cases/${caseId}/brief`}>Brief</Link> · Visit {visitId}
      </nav>
      <div className="prose-card">
        <p className="section-title">U9 · Visit update</p>
        <p className="text-xs text-ink-500">Doctor reviews each proposed change, accepts or rejects, and commits atomically.</p>
        {!updateId && <button className="btn-primary mt-3" onClick={build}>Build change preview</button>}
      </div>
      {updateId && (
        <div className="prose-card fade-in">
          <p className="section-title">Items ({items.length || "loading"})</p>
          <div className="mt-2 space-y-2">
            {(items.length ? items : Array.from({ length: 3 }, (_, i) => ({ id: `placeholder-${i}`, operation: "ADD", proposed_after_payload: JSON.stringify({ brand: "Amlopres 5", strength: "5mg" }), status: "PENDING" }))).map((it: any) => (
              <div key={it.id} className="rounded-lg border border-ink-200 bg-white p-3">
                <div className="flex items-center justify-between">
                  <span className="tag-derived">{it.operation}</span>
                  <span className={`label-chip ${decided[it.id] === "ACCEPT" ? "bg-green-100 text-green-800" : decided[it.id] === "REJECT" ? "bg-red-100 text-red-800" : "bg-ink-100 text-ink-600"}`}>
                    {decided[it.id] ?? "PENDING"}
                  </span>
                </div>
                <p className="mt-1 text-sm">{it.proposed_after_payload ? (() => { try { return JSON.stringify(JSON.parse(it.proposed_after_payload), null, 2); } catch { return it.proposed_after_payload; } })() : ""}</p>
                <div className="mt-2 flex gap-2">
                  <button className="btn-primary text-xs" onClick={() => setDecided((p) => ({ ...p, [it.id]: "ACCEPT" }))}>Accept</button>
                  <button className="btn-warn text-xs" onClick={() => setDecided((p) => ({ ...p, [it.id]: "REJECT" }))}>Reject</button>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <button className="btn-primary" onClick={commit}>Commit accepted items</button>
          </div>
        </div>
      )}
      {committed && (
        <div className="prose-card fade-in">
          <p className="section-title">Commit receipt</p>
          <pre className="mt-2 max-h-64 overflow-auto rounded-md bg-ink-900 p-3 text-xs text-ink-100">{JSON.stringify(committed, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}