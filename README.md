# MedLens AI

> Source-linked consultation support for Bangladesh clinics.
> Synthetic-data demo prototype built for the GP FutureMakers competition.

MedLens AI is a Next.js prototype that turns a messy bundle of pre-visit paper
(prescriptions, lab reports, strip photos, discharge summaries, allergy notes)
into a clean, source-anchored, consent-bounded brief that a named doctor — and
only that doctor — can read before walking into the room. Every fact on the
brief is a pointer back to the exact image region, audio span, or text excerpt
that produced it, every issue the brief surfaces is auditable, and every share
expires.

The architecture is the modular monolith described in
`GP_FutureMakers_Full_Architecture.md`. This repository is a runnable,
end-to-end prototype of the **18 CORE + 27 ORIGINAL MVP + 5 ADDED wellbeing =
50 features** the spec asks for. All data is synthetic; no real patient data
ever leaves the local SQLite database.

---

## Quick start (60 seconds)

```bash
# 1. Install (Node 20+, no native compile required — prebuilt better-sqlite3 binary)
npm install

# 2. Reset + seed synthetic case "Rahima" (idempotent)
npm run db:seed

# 3. Start dev server (Next.js 15 + React 18)
npm run dev
# → http://localhost:3000
```

Open `http://localhost:3000`, click **Sign in to demo**, and use one of the
six credentials in the table on the home page. To rebuild the demo from
scratch at any time, click **Reset demo scenario** on the sign-in page (it
calls `POST /api/v1/demo/reset`) or run `npm run db:seed`.

---

## Demo accounts

| Role       | Login (`authSubject`) | Password           |
| ---------- | --------------------- | ------------------ |
| Patient    | `rahima@demo`         | `rahima-demo`      |
| Caregiver  | `tanvir@demo`         | `tanvir-demo`      |
| Doctor A   | `dra@demo`            | `doctor-a-demo`    |
| Doctor B   | `drb@demo`            | `doctor-b-demo`    |
| Operator   | `operator@demo`       | `operator-demo`    |
| Evaluator  | `evaluator@demo`      | `evaluator-demo`   |

Doctors A and B differ: only **Dr A** has a synthetic clinician profile and
will show up in any "share with named doctor" grant flow. **Dr B** has a
matching account but is the canonical "ungranted doctor" used to prove the
access boundary: with no grant they see nothing.

---

## Storyboard (the 5-minute walkthrough)

1. Sign in as **rahima@demo** (`/demo`).
2. **Overview** — the Rahima case (`/cases/case_rahima`) shows the complaint,
   the agenda, the source manifest, and the three badges (Synthetic data /
   Architecture v1.0 / Build demo-1.0.0).
3. **Evidence** — open `/cases/case_rahima/evidence`. There are 10 sources:
   - 5 ADMITTED pre-visit papers
   - 2 ADMITTED strip photos
   - 1 ADMITTED new Rx (`prescription-today.pdf`)
   - 1 REVIEW_REQUIRED handwritten Rx
   - 1 QUARANTINED wrong-patient PDF
   The "Process" button runs each source through the deterministic mock AI
   provider (`src/lib/providers/ai.ts`), which is wired into the same
   `AIProvider` interface a real Gemini adapter would satisfy.
4. **Context** — `/cases/case_rahima/context` shows the medication board,
   labs, allergies. Each row carries why-codes and evidence-anchor ids.
5. **Prepare** — `/cases/case_rahima/prepare` starts an interview, plans the
   first three questions against the open reconciliation issues, lets the
   patient answer.
6. **Wellbeing** — `/cases/case_rahima/wellbeing` lets Rahima submit a free-text
   concern, take the WHO-5 (DEMO_ONLY) assessment, and trigger one of three
   support-flow buttons: CURRENT_EXPLICIT, AMBIGUOUS, or NEGATED. The first
   reveals a clinician-handoff surface; the other two do not.
7. **Sharing** — `/cases/case_rahima/sharing` lets Rahima grant Dr A a
   24-hour named grant or generate a 2-hour bearer QR for the printable
   general brief. Dr B with no grant sees nothing.
8. **Doctor's view** — sign out, sign in as `dra@demo`. Open the doctor
   brief (`/doctor/cases/case_rahima/brief`); only Dr A sees this because of
   the named grant. Build a change preview and commit it (`/doctor/cases/case_rahima/visit/[visitId]`).
9. **Share redeem** — open the general QR token at `/share/[token]`. The
   wellbeing block is suppressed and a yellow warning explains why.
10. **History** — `/cases/case_rahima/history` shows the immutable audit log
    of every write action.
11. **Evaluation** — `/evaluation` (sign in as `evaluator@demo`) shows the
    A01–A09 acceptance scenarios with admit / reject numerators per slice.

---

## Architecture mapping (50 features → files)

This section is the section the judges will care about. Each row points to
the file that **implements** the capability, with a one-line note.

### 18 CORE (must-have)

| #     | Capability                       | File(s)                                                                                |
|---|---------------------------------------------------------------------------------|---------------------------------------------------------------------------------------|
| C01 | Auth subject + password, session cookie | `src/lib/server/session.ts`, `src/app/api/v1/auth/*`                                 |
| C02 | Session-scoped RBAC (PATIENT / CAREGIVER / DOCTOR / OPERATOR / EVALUATOR)      | `src/lib/server/session.ts` (`requireRole`, `getActor`)                               |
| C03 | Source ingestion + content hashing                                                | `src/lib/data/repo.ts` (`SourceArtifactRepo`), `src/app/api/v1/cases/[caseId]/sources` |
| C04 | Consent records with wording version + understanding check                      | `src/lib/data/repo.ts` (`ConsentRepo`), `src/lib/domain/ids.ts`                       |
| C05 | Case-level access policy (assertCaseAccess / asset-kind matrix)                 | `src/lib/server/access.ts`                                                            |
| C06 | Source-anchored facts (fact / fact_revision / evidence_anchor / evidence_edge)  | `src/lib/data/schema-sql.ts`, `src/lib/data/repo.ts`                                  |
| C07 | AI provider adapter with explicit interface                                      | `src/lib/providers/ai.ts`                                                             |
| C08 | Review-state lifecycle (UNREVIEWED → CONTRIBUTOR_CONFIRMED → DOCTOR_REVIEWED)    | `src/lib/domain/reconcile.ts`, `src/lib/data/repo.ts`                                 |
| C09 | Reconciliation rules (RX01–RX06, LAB01, TERM01) as pure functions              | `src/lib/domain/reconcile.ts`                                                         |
| C10 | Issue records with rule/version/signature/audience fingerprint                  | `src/lib/data/schema-sql.ts` (`issue`), `src/lib/domain/reconcile.ts`                 |
| C11 | Audience-aware projection (brief composer + abstentions)                        | `src/lib/domain/brief.ts` (`composeBrief`)                                            |
| C12 | Named grant (NAMED audience + expiry + source-closure hash)                     | `src/app/api/v1/cases/[caseId]/sharing/grant/route.ts`                                |
| C13 | General share (GENERAL_QR audience + bearer redemption)                        | `src/app/api/v1/cases/[caseId]/shares/route.ts`, `src/app/api/v1/shares/redeem/route.ts` |
| C14 | Revoke (bumps privacy_epoch, invalidates outstanding share links)               | `src/app/api/v1/sharing/grant/[grantId]/revoke/route.ts`                              |
| C15 | Visit-update preview → transactional commit (MedicationEvent, advanceContext)   | `src/app/api/v1/cases/[caseId]/visit-update/route.ts`, `.../updates/[updateId]/commit/route.ts` |
| C16 | Audit trail (immutable append-only audit_event)                                  | `src/lib/data/schema-sql.ts`, every write path inserts an audit row                   |
| C17 | Idempotency receipts on AI/extraction calls                                      | `src/lib/data/repo.ts` (`IdempotencyRepo`)                                            |
| C18 | Well-defined domain errors → HTTP mapping                                         | `src/lib/domain/errors.ts`, `src/lib/server/api.ts`                                   |

### 27 ORIGINAL MVP (must-have acceptance scenarios)

| #    | Capability                       | File(s)                                                                                |
|---|----------------------------------------------------|---------------------------------------------------------------------------------------|
| M01 | Process document end-to-end                        | `src/app/api/v1/cases/[caseId]/process/route.ts`                                      |
| M02 | Reconcile open issues                              | `src/app/api/v1/cases/[caseId]/reconcile/route.ts`                                    |
| M03 | Plan interview questions (priority + burden)       | `src/lib/domain/interview.ts`, `src/app/api/v1/cases/[caseId]/interviews/route.ts`    |
| M04 | Answer typed question → typed source + fact revision + anchor | `src/app/api/v1/questions/[qid]/answer/route.ts`                            |
| M05 | Compose brief (sections + why-codes + abstentions) | `src/app/api/v1/cases/[caseId]/brief/route.ts`, `src/lib/domain/brief.ts`             |
| M06 | Compose general brief (wellbeing excluded)         | `src/app/api/v1/shares/redeem/route.ts`                                               |
| M07 | Compose doctor brief (wellbeing included if granted) | `src/app/api/v1/cases/[caseId]/brief/route.ts` (`includeWellbeing: actor.user.role === "DOCTOR"`) |
| M08 | Build visit change preview                         | `src/app/api/v1/cases/[caseId]/visit-update/route.ts`                                 |
| M09 | Accept / reject per item                           | `src/app/api/v1/updates/[updateId]/items/route.ts`                                    |
| M10 | Commit visit update (transactional)                | `src/app/api/v1/updates/[updateId]/commit/route.ts`                                   |
| M11 | Grant named doctor (preview hash + closure hash)   | `src/app/api/v1/cases/[caseId]/sharing/grant/route.ts`                                |
| M12 | Generate QR for general brief                      | `src/app/cases/[caseId]/sharing/page.tsx` (`QRCode.toString`)                         |
| M13 | Revoke grant                                       | `src/app/api/v1/sharing/grant/[grantId]/revoke/route.ts`                              |
| M14 | List active grants                                 | `src/app/api/v1/cases/[caseId]/sharing/grant/route.ts` (GET)                          |
| M15 | Submit wellbeing self-report                       | `src/app/api/v1/cases/[caseId]/wellbeing/route.ts` (POST)                             |
| M16 | Submit WHO-5 (DEMO_ONLY) assessment                | `src/app/api/v1/cases/[caseId]/assessments/route.ts`, `src/lib/domain/assessment.ts`  |
| M17 | Recognize support signal (CURRENT_EXPLICIT/AMBIGUOUS/NEGATED/QUOTED/HELP_REQUEST) | `src/lib/domain/support.ts`, `src/app/api/v1/cases/[caseId]/support/route.ts` |
| M18 | Show verified support resources                    | `src/app/help/page.tsx`, `src/lib/data/repo.ts` (`SupportResourceRepo`)               |
| M19 | Clinician handoff for severe observations          | `src/lib/domain/support.ts` (`handoffState`), `src/app/help/page.tsx`                 |
| M20 | Branded terminology dictionary (Secure / Maxpro / Amlopres / Metformin / Amoxil) | `src/lib/domain/terminology.ts`                                                |
| M21 | Lab dictionary + alias lookup                      | `src/lib/domain/terminology.ts` (`lookupLabByAlias`)                                  |
| M22 | Bangladesh idiom normalization                    | `src/lib/domain/terminology.ts` (`idioms`)                                            |
| M23 | Wrong-patient detection → QUARANTINED              | `src/lib/providers/ai.ts` (`src_wrong_patient`), `src/lib/data/repo.ts`               |
| M24 | Handwriting needs-review handling                  | `src/lib/providers/ai.ts` (`src_rx_b_handwritten`), reconciliation rule RX06          |
| M25 | Case-level audit log                               | `src/app/api/v1/cases/[caseId]/audit/route.ts`                                        |
| M26 | Frozen evaluation fixtures (A01–A09)               | `scripts/seed.ts`, `src/app/api/v1/evaluation/route.ts`                               |
| M27 | Demo reset endpoint (no data leakage)              | `src/app/api/v1/demo/reset/route.ts`                                                  |

### 5 ADDED (wellbeing)

| #  | Capability                                            | File(s)                                                                  |
|----|-------------------------------------------------------|--------------------------------------------------------------------------|
| W1 | Wellbeing intake (own-words + topic + presentation pref) | `src/app/api/v1/cases/[caseId]/wellbeing/route.ts`                       |
| W2 | Wellbeing inclusion rule (only doctors, only if granted) | `src/app/api/v1/cases/[caseId]/brief/route.ts` (`includeWellbeing`)      |
| W3 | Wellbeing exclusion from general share                | `src/app/api/v1/shares/redeem/route.ts`                                  |
| W4 | Audit of wellbeing write events                       | `src/lib/data/schema-sql.ts` (every wellbeing write inserts audit_event) |
| W5 | Help surface with verified resources                  | `src/app/help/page.tsx`                                                  |

---

## Project layout

```
src/
├── app/                  Next.js 15 App Router
│   ├── (root)            marketing + sign-in + help + evaluation
│   ├── cases/[caseId]    patient surface (overview, evidence, prepare, …)
│   ├── doctor/cases/...  doctor surface (brief + visit)
│   └── api/v1/...        30 route handlers under /api/v1/
├── lib/
│   ├── data/             SQLite repo (one file, ~30 typed repos)
│   ├── domain/           Pure business logic (reconcile, brief, terminology, support, …)
│   ├── providers/        AI adapter interface + mock deterministic impl
│   └── server/           auth, access policy, request id, json helpers
├── components/           small UI primitives
scripts/
├── seed.ts               Synthetic Rahima demo seed (idempotent)
├── smoke.mjs             End-to-end API smoke test (28 tests)
└── (helpers)
```

The architecture commit is real (everything compiles, no `TODO` stubs in the
acceptance flow), and the worker concept is exercised inside the same Next
process: every write path that the spec assigns to a worker (extractDocument,
reconcile, compose brief, score assessment) is reached synchronously through
the route handlers, but the Job + idempotency_receipt tables in
`schema-sql.ts` are populated by the demo so a real worker can be bolted on
without changing the wire format.

---

## What is real vs. demo

**Real and ready for the demo**

- All 30 API routes. Full RBAC. Session cookie via scrypt.
- Source → fact → anchor → brief pipeline. The mock provider returns realistic
  deterministic extractions for the seeded source ids, and the same routes
  work against a real provider by swapping `MockDeterministicProvider` for a
  Gemini adapter in `src/lib/providers/ai.ts` (one-line change; the adapter
  interface is locked).
- The seven reconciliation rules (RX01–RX06, LAB01, TERM01) in
  `src/lib/domain/reconcile.ts` are pure functions over admitted claims.
- Brief composer emits abstentions for items it cannot ground (no anchors).
- General QR vs. named grant, expiry, source-closure hash, revoke, privacy
  epoch bump.
- Visit-update preview, per-item accept/reject, transactional commit.
- Wellbeing intake, WHO-5 in DEMO_ONLY mode (labelled as such everywhere it
  surfaces — see `src/lib/domain/assessment.ts`), three support flows, help
  surface with verified-resource card.
- Frozen evaluation set with the nine A01–A09 acceptance scenarios.
- Immutable audit trail on every write.

**Deliberately demo**

- **AI provider is mocked.** The `MockDeterministicProvider` returns canned
  extractions for the seeded fixture ids and `UNREADABLE` for anything else.
  The real Gemini call path is one import swap away but is not exercised in
  the demo (no live network calls, no API key needed).
- **WHO-5 scoring is DEMO_ONLY.** The instrument definition, items, and
  scoring function are wired up; the items are paraphrased and labelled as
  such in the UI. `runtimeMode: "DEMO_ONLY"` is set on every persisted
  assessment, and the response carries `interpretation: null,
  diagnosticLabel: null` so a real clinician cannot mistake it for a clinical
  score.
- **No live OCR / no audio transcription.** Documents and strips are processed
  by the mock provider's deterministic extractions, not by a real model.
  Source artifacts are present in the database but have placeholder byte
  payloads; their content_hash is computed over the placeholder, so the
  pipeline is real but the bytes are synthetic.
- **No SMTP, no SMS, no webhook delivery.** Every "show resource" / "send
  notification" step writes an audit_event and (where relevant) a
  support_event row.
- **No persistent storage beyond SQLite.** The DB lives at `./data/medlens.db`.
  Reset it any time with `npm run db:seed`.

---

## Verifying the demo

After `npm run db:seed` and `npm run dev`, the smoke test exercises every
acceptance path end-to-end:

```bash
# In a separate terminal:
node scripts/smoke.mjs
# → 28 passed, 0 failed
```

The smoke covers: sign-in (all six accounts), demo reset, sources list,
process every admitted source, reconcile, issues, context, wellbeing,
support signal recognition, WHO-5 create + submit, interview planning,
sharing preview / grant / revoke, brief compose (patient + doctor + general),
doctor visit-update, audit log, evaluation run. It also verifies the
wellbeing-excluded warning when redeeming the general share.

---

## Running on Windows / macOS / Linux

`better-sqlite3@12.11.1` ships a prebuilt binary for Node 18 / 20 / 22 on
all three platforms; no Visual Studio Build Tools or `python` are needed.
If you ever do hit a native-compile failure, run
`npm rebuild better-sqlite3 --build-from-source` once with a working
toolchain.

---

## What to look at in 30 minutes

If a judge only has half an hour, the most informative files are:

1. `src/lib/domain/reconcile.ts` — the seven reconciliation rules, each
   a pure function.
2. `src/lib/domain/brief.ts` — the audience-aware composer with abstentions.
3. `src/lib/server/access.ts` — the access policy (assertCaseAccess,
   previewHash, hashSourceClosure).
4. `src/lib/providers/ai.ts` — the `AIProvider` interface and the mock that
   satisfies it; this is the one place where a real adapter plugs in.
5. `scripts/seed.ts` — a single read shows the full synthetic-data shape:
   patient, caregiver, doctors, consents, sources, admitted facts, lab
   observations, allergies, support protocol, evaluation set.

The other ~80 files are infrastructure plumbing; everything important lives
in the five places above.