"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

export default function SharingPage() {
  const params = useParams<{ caseId: string }>();
  const caseId = params.caseId;
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [grants, setGrants] = useState<any[]>([]);

  useEffect(() => {
    fetch(`/api/v1/cases/${caseId}/sharing/grant`).then((r) => r.json()).then((d) => setGrants(d.data?.grants ?? []));
  }, [caseId]);

  async function createQr() {
    const r = await fetch(`/api/v1/cases/${caseId}/shares`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ expiresAt: new Date(Date.now() + 2 * 3600 * 1000).toISOString(), generalOnly: true }),
    });
    const d = await r.json();
    setToken(d.data.token);
    const url = `${window.location.origin}/share/${d.data.token}`;
    const svg = await QRCode.toString(url, { type: "svg", margin: 1, width: 200 });
    setQrSvg(svg);
  }

  async function createDoctorGrant() {
    const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
    const preview = await fetch(`/api/v1/cases/${caseId}/sharing/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipientUserId: "user_dra",
        purpose: "VISIT_CONTEXT",
        resourceIds: [],
        expiresAt,
      }),
    }).then((r) => r.json());
    await fetch(`/api/v1/cases/${caseId}/sharing/grant`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        recipientUserId: "user_dra",
        purpose: "VISIT_CONTEXT",
        resourceIds: [],
        expiresAt,
        previewHash: preview.data.previewHash,
        kind: "SENSITIVE_NAMED",
      }),
    });
    const refreshed = await fetch(`/api/v1/cases/${caseId}/sharing/grant`).then((r) => r.json());
    setGrants(refreshed.data?.grants ?? []);
  }

  async function revoke(id: string) {
    await fetch(`/api/v1/sharing/grant/${id}/revoke`, { method: "POST" });
    const refreshed = await fetch(`/api/v1/cases/${caseId}/sharing/grant`).then((r) => r.json());
    setGrants(refreshed.data?.grants ?? []);
  }

  return (
    <div className="space-y-4">
      <nav className="text-xs text-ink-500">
        <Link href="/" className="hover:underline">Home</Link> · <Link href={`/cases/${caseId}`} className="hover:underline">Case</Link> · Sharing
      </nav>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="prose-card">
          <p className="section-title">U6 · Share with named doctor</p>
          <p className="mt-1 text-sm text-ink-600">Grants Dr A a bounded, expiry-bound, source-closure-aware view of the case. Wellbeing is shared only when you choose.</p>
          <button className="btn-primary mt-3" onClick={createDoctorGrant}>Grant Dr A access</button>
          <p className="mt-3 text-xs text-ink-500">Dr B has no grant and will see no private block, counts, or placeholders.</p>
        </div>
        <div className="prose-card">
          <p className="section-title">General QR (printable brief)</p>
          <p className="mt-1 text-sm text-ink-600">Generate a 2-hour bearer token for a one-pager. Wellbeing is excluded by default.</p>
          <button className="btn-primary mt-3" onClick={createQr}>Generate QR</button>
          {qrSvg && (
            <div className="mt-3">
              <div className="rounded-md border border-ink-200 bg-white p-3" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-2 break-all text-xs text-ink-500">Token: {token}</p>
              <p className="text-xs text-ink-500">Open: <Link className="text-accent-600 hover:underline" href={`/share/${token}`}>/share/{token?.slice(0, 8)}…</Link></p>
            </div>
          )}
        </div>
      </div>

      <div className="prose-card">
        <p className="section-title">Active grants</p>
        <div className="mt-2 grid gap-2 md:grid-cols-2">
          {grants.length === 0 && <p className="text-sm text-ink-500">No grants yet.</p>}
          {grants.map((g) => (
            <div key={g.id} className="rounded-lg border border-ink-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <span className="tag-derived">{g.kind}</span>
                <span className={`label-chip ${g.revoked_at ? "bg-red-100 text-red-800" : "bg-green-100 text-green-800"}`}>{g.revoked_at ? "REVOKED" : "ACTIVE"}</span>
              </div>
              <p className="mt-1 text-sm">Recipient: {g.recipient_user_id ?? "general"}</p>
              <p className="text-xs text-ink-500">Expires {g.expires_at}</p>
              {!g.revoked_at && (
                <button className="btn-warn mt-2 text-xs" onClick={() => revoke(g.id)}>Revoke</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}