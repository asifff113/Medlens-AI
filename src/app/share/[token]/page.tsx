"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

export default function ShareRedeemPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [data, setData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/v1/shares/redeem", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) setError(d.error?.message ?? "Invalid link");
        else setData(d.data);
      });
  }, [token]);

  if (error) return <div className="prose-card"><p className="text-red-800">{error}</p></div>;
  if (!data) return <p>Redeeming token…</p>;

  const sections = data.items ?? [];
  return (
    <div className="space-y-4">
      <div className="prose-card">
        <p className="section-title">U8 · One-page general brief</p>
        <p className="text-xs text-ink-500">Bearer session · audience fingerprint {data.audienceFingerprint} · privacy epoch {data.privacyEpoch}</p>
        <p className="mt-2 text-xs text-warn-600">No restricted wellbeing content is included in this general view.</p>
      </div>
      {Object.entries(groupBy(sections, "section")).map(([section, items]) => (
        <div key={section} className="prose-card">
          <p className="section-title">{section}</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-800">
            {(items as any[]).map((it) => (
              <li key={it.id}>{it.text}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function groupBy(arr: any[], key: string) {
  return arr.reduce((acc, it) => {
    const k = it[key] ?? "other";
    acc[k] = acc[k] ?? [];
    acc[k].push(it);
    return acc;
  }, {} as Record<string, any[]>);
}