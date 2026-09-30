"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function DemoPage() {
  const router = useRouter();
  const [authSubject, setAuthSubject] = useState("rahima@demo");
  const [password, setPassword] = useState("rahima-demo");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState<{ id: string; displayName: string; role: string } | null>(null);

  useEffect(() => {
    fetch("/api/v1/auth/session").then((r) => r.json()).then((d) => setUser(d.data?.user ?? null));
  }, []);

  async function signIn() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/v1/auth/sign-in", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ authSubject, password }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error?.message ?? "Sign-in failed.");
        return;
      }
      const data = await res.json();
      setUser({ id: data.data.user.id, displayName: data.data.user.displayName, role: data.data.user.role });
      const role = data.data.user.role;
      if (role === "DOCTOR") router.push("/doctor/cases/case_rahima/brief");
      else if (role === "CAREGIVER") router.push("/cases/case_rahima");
      else if (role === "OPERATOR") router.push("/demo/operator");
      else if (role === "EVALUATOR") router.push("/evaluation");
      else router.push("/cases/case_rahima");
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    await fetch("/api/v1/auth/sign-out", { method: "POST" });
    setUser(null);
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="prose-card">
        <p className="section-title">U0 · Demo entry</p>
        {user ? (
          <div className="mt-4 space-y-3">
            <p className="text-sm text-ink-700">
              Signed in as <span className="font-semibold">{user.displayName}</span> ({user.role}).
            </p>
            <div className="flex gap-2">
              <button className="btn-primary" onClick={() => router.push(user.role === "DOCTOR" ? "/doctor/cases/case_rahima/brief" : "/cases/case_rahima")}>
                Continue
              </button>
              <button className="btn-secondary" onClick={signOut}>Sign out</button>
            </div>
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <Field label="Email" value={authSubject} onChange={setAuthSubject} />
            <Field label="Password" value={password} onChange={setPassword} type="password" />
            {error && <p className="rounded-md bg-red-100 px-3 py-2 text-sm text-red-800">{error}</p>}
            <button className="btn-primary" onClick={signIn} disabled={loading}>{loading ? "Signing in…" : "Sign in"}</button>
            <p className="text-xs text-ink-500">Demo accounts listed on the home page. Sessions are valid for 30 minutes.</p>
          </div>
        )}
      </div>
      <div className="prose-card">
        <p className="section-title">Storyboard</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-700">
          <li>Sign in as Rahima and review admitted evidence.</li>
          <li>Walk through prepare → questions → answers.</li>
          <li>Open private wellbeing; observe DEMO_ONLY score.</li>
          <li>Sign out, sign in as Dr A, open the one-minute brief.</li>
          <li>Commit today&apos;s prescription and watch the context advance.</li>
        </ol>
        <p className="mt-3 text-ink-700 text-sm">Use the seed button below if you need to reset to the canonical scenario.</p>
        <ResetButton />
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-sm">
      <span className="block font-medium text-ink-700">{label}</span>
      <input
        className="mt-1 block w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm"
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function ResetButton() {
  const [state, setState] = useState<"idle" | "busy" | "done">("idle");
  return (
    <div className="mt-3">
      <button
        className="btn-secondary"
        onClick={async () => {
          setState("busy");
          await fetch("/api/v1/demo/reset", { method: "POST" });
          setState("done");
          setTimeout(() => setState("idle"), 1500);
        }}
      >
        {state === "idle" ? "Reset demo scenario" : state === "busy" ? "Resetting…" : "Done ✓"}
      </button>
      <p className="mt-1 text-xs text-ink-500">Wipes local SQLite, re-runs the synthetic Rahima seed.</p>
    </div>
  );
}