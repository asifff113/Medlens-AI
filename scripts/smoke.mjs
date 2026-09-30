// End-to-end smoke test: sign in, list cases, process, reconcile, brief, grant, redeem, visit.
const BASE = "http://localhost:3001";

let pass = 0;
let fail = 0;
function ok(name) { pass++; console.log(`✓ ${name}`); }
function bad(name, why) { fail++; console.log(`✗ ${name}: ${why}`); }

async function call(path, init = {}, cookieJar = {}) {
  const headers = { ...(init.headers || {}) };
  if (cookieJar.cookie) headers["Cookie"] = cookieJar.cookie;
  if (init.body && typeof init.body === "string" && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(BASE + path, { ...init, headers, redirect: "manual" });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    // Very small jar: only one cookie expected.
    const m = setCookie.match(/medlens_session=([^;]+)/);
    if (m) cookieJar.cookie = `medlens_session=${m[1]}`;
  }
  let text = "";
  try { text = await res.text(); } catch {}
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, body: text, json, cookieJar };
}

async function expect(name, p, fn) {
  try {
    const r = await p;
    const okResult = fn(r);
    if (okResult === true) ok(name);
    else bad(name, okResult);
  } catch (e) {
    bad(name, `threw: ${e?.message ?? e}`);
  }
}

async function main() {
  // Reset demo
  const resetJar = {};
  const reset = await call("/api/v1/demo/reset", { method: "POST", body: "{}" }, resetJar);
  await expect("POST /api/v1/demo/reset → 200", Promise.resolve(reset), (r) => r.status === 200 ? true : `status=${r.status} body=${r.body}`);

  // Sign in as Rahima
  const rahimaJar = {};
  const sign = await call("/api/v1/auth/sign-in", { method: "POST", body: JSON.stringify({ usernameOrEmail: "rahima@demo", password: "rahima-demo" }) }, rahimaJar);
  await expect("POST /api/v1/auth/sign-in (rahima) → 200", Promise.resolve(sign), (r) => r.status === 200 ? true : `status=${r.status} body=${r.body}`);
  if (!rahimaJar.cookie) { bad("rahima cookie", "no cookie returned"); return; }

  // Session check
  const sess = await call("/api/v1/auth/session", { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/auth/session → user role PATIENT/CAREGIVER", Promise.resolve(sess), (r) => {
    const role = r.json?.data?.user?.role;
    return role === "PATIENT" || role === "CAREGIVER" ? true : `role=${role}`;
  });

  // List cases
  const cases = await call("/api/v1/cases", { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/cases → 200", Promise.resolve(cases), (r) => r.status === 200 ? true : `status=${r.status}`);
  let caseId = null;
  const casesList = cases.json?.data?.cases ?? cases.json?.cases ?? [];
  if (casesList[0]) caseId = casesList[0].id;
  if (!caseId) { bad("case lookup", `no case id; body=${cases.body}`); return; }
  ok(`case id: ${caseId}`);

  // Case detail
  const detail = await call(`/api/v1/cases/${caseId}`, { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/cases/{id} → 200", Promise.resolve(detail), (r) => r.status === 200 ? true : `status=${r.status} body=${r.body}`);

  // Sources
  const sources = await call(`/api/v1/cases/${caseId}/sources`, { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/cases/{id}/sources → array", Promise.resolve(sources), (r) => {
    const arr = r.json?.data?.sources ?? r.json?.sources ?? [];
    return Array.isArray(arr) ? true : `not array`;
  });

  // Process all admitted sources (skip review_required / quarantined)
  const procResults = [];
  const srcList = sources.json?.data?.sources ?? [];
  for (const src of srcList) {
    if (src.state === "ADMITTED") {
      const proc = await call(`/api/v1/cases/${caseId}/process`, { method: "POST", body: JSON.stringify({ sourceId: src.id }) }, rahimaJar);
      procResults.push(proc.status);
    }
  }
  await expect("POST /api/v1/cases/{id}/process (≥1 admitted) → 200", Promise.resolve({ status: 200 }), () => procResults.some((s) => s === 200) ? true : `all=${procResults.join(",")}`);

  // Reconcile
  const rec = await call(`/api/v1/cases/${caseId}/reconcile`, { method: "POST", body: "{}" }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/reconcile → 200", Promise.resolve(rec), (r) => r.status === 200 ? true : `status=${r.status} body=${rec.body}`);

  // Issues
  const issues = await call(`/api/v1/cases/${caseId}/issues`, { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/cases/{id}/issues → 200", Promise.resolve(issues), (r) => r.status === 200 ? true : `status=${r.status} body=${issues.body}`);

  // Context (medi board)
  const ctx = await call(`/api/v1/cases/${caseId}/context`, { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/cases/{id}/context → 200", Promise.resolve(ctx), (r) => r.status === 200 ? true : `status=${r.status} body=${ctx.body}`);

  // Wellbeing (own-words concern)
  const wb = await call(`/api/v1/cases/${caseId}/wellbeing`, { method: "POST", body: JSON.stringify({ originalWording: "I am scared about my diabetes test result", topicSelected: "HEALTH_WORRY", onset: "2024-01-01", datePrecision: "MONTH", requestDiscussion: true, presentationPreference: "RESPECTFUL" }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/wellbeing → 200", Promise.resolve(wb), (r) => r.status === 200 ? true : `status=${r.status} body=${wb.body}`);

  // Support (CURRENT_EXPLICIT)
  const sup = await call(`/api/v1/cases/${caseId}/support`, { method: "POST", body: JSON.stringify({ signal: "I cannot take this anymore" }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/support (current explicit) → 200", Promise.resolve(sup), (r) => r.status === 200 ? true : `status=${r.status} body=${sup.body}`);

  // Assessments create + submit
  const assCreate = await call(`/api/v1/cases/${caseId}/assessments`, { method: "POST", body: JSON.stringify({ instrumentKey: "WHO5" }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/assessments → 200", Promise.resolve(assCreate), (r) => r.status === 200 ? true : `status=${r.status} body=${assCreate.body}`);
  const sessionId = assCreate.json?.data?.sessionId;
  if (sessionId) {
    const items = assCreate.json?.data?.items ?? [];
    const responses = items.map((it, i) => ({ itemId: it.itemId, value: [2, 3, 1, 4, 2][i] ?? 3, confirmed: true }));
    const submit = await call(`/api/v1/cases/${caseId}/assessments/submit`, { method: "POST", body: JSON.stringify({ sessionId, definitionChecksum: assCreate.json?.data?.definitionChecksum, responses }) }, rahimaJar);
    await expect("POST .../assessments/submit → 200", Promise.resolve(submit), (r) => r.status === 200 ? true : `status=${r.status} body=${submit.body}`);
  } else {
    bad("assessment session id", `missing; body=${assCreate.body}`);
  }

  // Interviews
  const intr = await call(`/api/v1/cases/${caseId}/interviews`, { method: "POST", body: JSON.stringify({ respondent: "PATIENT", language: "bn", budget: 6 }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/interviews → 200", Promise.resolve(intr), (r) => r.status === 200 ? true : `status=${r.status} body=${intr.body}`);

  // Grant to Dr A (named)
  const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const preview = await call(`/api/v1/cases/${caseId}/sharing/preview`, { method: "POST", body: JSON.stringify({ recipientUserId: "user_dra", purpose: "VISIT_CONTEXT", resourceIds: [], expiresAt }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/sharing/preview → 200", Promise.resolve(preview), (r) => r.status === 200 ? true : `status=${r.status} body=${preview.body}`);
  const grant = await call(`/api/v1/cases/${caseId}/sharing/grant`, { method: "POST", body: JSON.stringify({ recipientUserId: "user_dra", purpose: "VISIT_CONTEXT", resourceIds: [], expiresAt, previewHash: preview.json?.data?.previewHash ?? "demo-preview", kind: "SENSITIVE_NAMED" }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/sharing/grant (named) → 200", Promise.resolve(grant), (r) => r.status === 200 ? true : `status=${r.status} body=${grant.body}`);
  let grantId = grant.json?.data?.grantId ?? grant.json?.grant?.id ?? null;

  // General share via grant endpoint with GENERAL audience (we'll create another grant with audience=GENERAL via the doctor later; for now, use shares/redeem for the named link)
  // Brief compose
  const brief = await call(`/api/v1/cases/${caseId}/brief`, { method: "POST", body: "{}" }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/brief → 200", Promise.resolve(brief), (r) => r.status === 200 ? true : `status=${r.status} body=${brief.body}`);

  // Switch to doctor A
  const drJar = {};
  const signDr = await call("/api/v1/auth/sign-in", { method: "POST", body: JSON.stringify({ usernameOrEmail: "dra@demo", password: "doctor-a-demo" }) }, drJar);
  await expect("POST /api/v1/auth/sign-in (drA) → 200", Promise.resolve(signDr), (r) => r.status === 200 ? true : `status=${r.status} body=${signDr.body}`);

  // Dr A brief
  const drBrief = await call(`/api/v1/cases/${caseId}/brief`, { method: "POST", body: "{}" }, drJar);
  await expect("POST /api/v1/cases/{id}/brief (doctor) → 200", Promise.resolve(drBrief), (r) => r.status === 200 ? true : `status=${r.status} body=${drBrief.body}`);

  // Doctor creates visit update proposal
  const visit = await call(`/api/v1/cases/${caseId}/visit-update`, { method: "POST", body: JSON.stringify({ items: [{ action: "ACCEPT_MEDICATION", factRevisionId: "rev_seed_seclo" }] }) }, drJar);
  await expect("POST /api/v1/cases/{id}/visit-update → 200", Promise.resolve(visit), (r) => r.status === 200 ? true : `status=${r.status} body=${visit.body}`);
  const updateId = visit.json?.visitUpdate?.id;

  // General share via /shares (which returns the token)
  const genShare = await call(`/api/v1/cases/${caseId}/shares`, { method: "POST", body: JSON.stringify({ expiresAt: new Date(Date.now() + 3600_000).toISOString(), generalOnly: true }) }, rahimaJar);
  await expect("POST /api/v1/cases/{id}/shares (general) → 200", Promise.resolve(genShare), (r) => r.status === 200 ? true : `status=${r.status} body=${genShare.body}`);
  const generalToken = genShare.json?.data?.token ?? null;

  if (generalToken) {
    const redeem = await call(`/api/v1/shares/redeem`, { method: "POST", body: JSON.stringify({ token: generalToken }) });
    await expect("POST /api/v1/shares/redeem (general) → 200", Promise.resolve(redeem), (r) => r.status === 200 ? true : `status=${r.status} body=${redeem.body}`);
  }

  // Revoke grant
  if (grantId) {
    const revoke = await call(`/api/v1/sharing/grant/${grantId}/revoke`, { method: "POST", body: "{}" }, rahimaJar);
    await expect("POST /api/v1/sharing/grant/{id}/revoke → 200", Promise.resolve(revoke), (r) => r.status === 200 ? true : `status=${r.status} body=${revoke.body}`);
  }

  // Audit
  const aud = await call(`/api/v1/cases/${caseId}/audit`, { method: "GET" }, rahimaJar);
  await expect("GET /api/v1/cases/{id}/audit → 200", Promise.resolve(aud), (r) => r.status === 200 ? true : `status=${r.status} body=${aud.body}`);

  // Evaluation (sign in as evaluator first)
  const evalJar = {};
  await call("/api/v1/auth/sign-in", { method: "POST", body: JSON.stringify({ usernameOrEmail: "evaluator@demo", password: "evaluator-demo" }) }, evalJar);
  const ev = await call(`/api/v1/evaluation`, { method: "POST", body: JSON.stringify({ setId: "ev_set_demo" }) }, evalJar);
  await expect("POST /api/v1/evaluation → 200", Promise.resolve(ev), (r) => r.status === 200 ? true : `status=${r.status} body=${ev.body}`);

  // Pages render (only some routes)
  const home = await call("/", { method: "GET" });
  await expect("GET / → 200", Promise.resolve(home), (r) => r.status === 200 ? true : `status=${r.status}`);

  console.log(`\nResult: ${pass} passed, ${fail} failed`);
  if (fail) process.exit(1);
}

main().catch((e) => { console.error("FATAL", e); process.exit(1); });