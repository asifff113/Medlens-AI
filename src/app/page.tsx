import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <section className="prose-card">
        <p className="section-title">U0 · Scenario landing</p>
        <h1 className="mt-2 text-2xl font-semibold">Reconstructing context from patient-held evidence</h1>
        <p className="mt-2 text-ink-700">
          MedLens AI turns paper prescriptions, lab reports and labelled medicine
          strips into source-linked claims, so a clinician walks into the room
          with reconciled context, evidence jumps and patient-confirmed answers.
          This is a competition demo running on synthetic data.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link className="btn-primary" href="/demo">Start demo</Link>
          <Link className="btn-secondary" href="/evaluation">Evaluation dashboard</Link>
          <Link className="btn-secondary" href="/help">Help surface</Link>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="prose-card">
          <p className="section-title">Why this exists</p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-700">
            <li>Paper prescriptions and lab reports are the patient&apos;s truth, but they live on paper.</li>
            <li>Doctors have one minute per brief. Reviews must be grounded in a source jump.</li>
            <li>Wellbeing is private by default and never bleeds into general view.</li>
            <li>Revocation races, mixed-source documents and same-key retries are first-class.</li>
          </ul>
        </div>
        <div className="prose-card">
          <p className="section-title">Demo credentials</p>
          <div className="mt-2 grid gap-2 text-sm">
            <Credential label="Patient (Rahima)" auth="rahima@demo" pw="rahima-demo" />
            <Credential label="Caregiver (Tanvir)" auth="tanvir@demo" pw="tanvir-demo" />
            <Credential label="Granted doctor (Dr A)" auth="dra@demo" pw="doctor-a-demo" />
            <Credential label="Ungranted doctor (Dr B)" auth="drb@demo" pw="doctor-b-demo" />
            <Credential label="Operator" auth="operator@demo" pw="operator-demo" />
            <Credential label="Evaluator" auth="evaluator@demo" pw="evaluator-demo" />
          </div>
        </div>
      </section>

      <section className="prose-card">
        <p className="section-title">Demo flow</p>
        <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-ink-700">
          <li>Sign in as Rahima, upload the seeded papers and watch them turn into source-linked claims.</li>
          <li>Open the prepare screen and answer three neutral Bangla questions about medicine overlap and strength.</li>
          <li>Step into the private wellbeing branch, opt-in to WHO-5 and see the deterministic score.</li>
          <li>Sign in as Dr A and open the one-minute brief with provenance, evidence jumps and the wellbeing block.</li>
          <li>Open today&apos;s visit, review the change preview, commit it and watch context advance atomically.</li>
        </ol>
      </section>
    </div>
  );
}

function Credential({ label, auth, pw }: { label: string; auth: string; pw: string }) {
  return (
    <div className="flex items-center justify-between rounded-md border border-ink-200 bg-ink-50 px-3 py-2">
      <span className="font-medium">{label}</span>
      <span className="text-xs text-ink-600">
        <code className="font-mono">{auth}</code> / <code className="font-mono">{pw}</code>
      </span>
    </div>
  );
}