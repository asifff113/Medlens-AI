/**
 * Reconcile rule catalog (Section 9.2).
 *
 * The implementation is intentionally pure: it consumes a typed snapshot of
 * admitted claim revisions and emits Issue records. It never writes to the
 * database, never calls an AI provider and never constructs a medication
 * identity it has not seen. Doctor review and clinical confirmation remain
 * required for any conflict resolution.
 */

import type {
  EvidenceKind,
  Issue,
  IssuePriority,
  MedicationClaim,
} from "./ids";
import type { FactRevisionRow, MedicationClaimRow } from "../data/schema";
import { CONCEPTS, DRUG_PRODUCTS, TERMINOLOGY_VERSION } from "./terminology";

const RULE_VERSION = "demo-1.0.0";

export interface RuleHit {
  issue: Omit<Issue, "id" | "createdAt" | "updatedAt" | "audienceFingerprint" | "contextVersion">;
}

interface AdmittedClaim {
  revision: FactRevisionRow;
  claim: MedicationClaimRow;
}

function productById(id: string | null | undefined) {
  if (!id) return null;
  return DRUG_PRODUCTS.find((p) => p.id === id) ?? null;
}

function ingredientsForClaim(c: MedicationClaimRow | MedicationClaim): string[] {
  if ("ingredient_ids" in c) {
    try {
      return JSON.parse(c.ingredient_ids || "[]");
    } catch {
      return [];
    }
  }
  if (c.ingredientIds && c.ingredientIds.length) return c.ingredientIds;
  if (c.ingredientNames?.length) return c.ingredientNames;
  return [];
}

function ingredientsEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const setB = new Set(b.map((s) => s.toLowerCase()));
  return a.every((x) => setB.has(x.toLowerCase()));
}

function classesForIngredient(ingredientId: string): string[] {
  const products = DRUG_PRODUCTS.filter((p) =>
    p.ingredientStrengths.some((i) => i.ingredientId === ingredientId),
  );
  const classes = new Set<string>();
  products.forEach((p) => p.classIds.forEach((cid) => classes.add(cid)));
  return [...classes];
}

function priorityFor(ruleId: string, uncertainty: number): IssuePriority {
  if (ruleId === "RX01" || ruleId === "RX02") return uncertainty > 0 ? "REVIEW_FIRST" : "REVIEW_NEXT";
  if (ruleId === "RX03") return "REVIEW_FIRST";
  if (ruleId === "RX04") return "REVIEW_NEXT";
  if (ruleId === "RX05") return "REVIEW_NEXT";
  if (ruleId === "RX06") return "REVIEW_FIRST";
  if (ruleId === "LAB01") return "REVIEW_NEXT";
  if (ruleId === "TERM01") return "INFORMATION";
  return "INFORMATION";
}

function summariseIngredients(ids: string[]): string {
  return ids
    .map((id) => CONCEPTS.find((c) => c.id === id)?.canonicalLabel ?? id)
    .join(" + ");
}

/** RX01 — exact ingredient overlap between distinct compatible products. */
function rx01ExactIngredientOverlap(items: AdmittedClaim[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].claim;
      const b = items[j].claim;
      const ai = ingredientsForClaim(a);
      const bi = ingredientsForClaim(b);
      if (!ai.length || !bi.length) continue;
      if (!ingredientsEqual(ai, bi)) continue;
      const ap = productById(a.product_id);
      const bp = productById(b.product_id);
      if (ap && bp && ap.id === bp.id) continue;
      const pa = ap?.brand ?? a.brand ?? "";
      const pb = bp?.brand ?? b.brand ?? "";
      const uncertainty =
        (a.unknown_reason ? 1 : 0) + (b.unknown_reason ? 1 : 0);
      hits.push({
        issue: {
          kind: "CONFLICT",
          type: "RX01",
          ruleId: "RX01",
          ruleVersion: RULE_VERSION,
          signature: `RX01:${a.fact_revision_id}:${b.fact_revision_id}`,
          priority: priorityFor("RX01", uncertainty),
          uncertaintyCodes: uncertainty > 0 ? ["IDENTITY_UNRESOLVED"] : [],
          status: "OPEN",
          claimRevisionIds: [a.fact_revision_id, b.fact_revision_id],
          summary: `Possible exact ingredient overlap: ${pa || summariseIngredients(ai)} and ${pb || summariseIngredients(ai)} both contain ${summariseIngredients(ai)}.`,
          doctorOnly: false,
        },
      });
    }
  }
  return hits;
}

/** RX02 — same-class overlap (e.g. omeprazole + esomeprazole). */
function rx02ClassOverlap(items: AdmittedClaim[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].claim;
      const b = items[j].claim;
      const ai = ingredientsForClaim(a);
      const bi = ingredientsForClaim(b);
      if (ingredientsEqual(ai, bi)) continue;
      const classesA = new Set<string>();
      ai.forEach((ing) => classesForIngredient(ing).forEach((c) => classesA.add(c)));
      const classesB = new Set<string>();
      bi.forEach((ing) => classesForIngredient(ing).forEach((c) => classesB.add(c)));
      const shared = [...classesA].filter((c) => classesB.has(c));
      if (!shared.length) continue;
      const ap = productById(a.product_id);
      const bp = productById(b.product_id);
      const pa = ap?.brand ?? a.brand ?? summariseIngredients(ai);
      const pb = bp?.brand ?? b.brand ?? summariseIngredients(bi);
      hits.push({
        issue: {
          kind: "CONFLICT",
          type: "RX02",
          ruleId: "RX02",
          ruleVersion: RULE_VERSION,
          signature: `RX02:${a.fact_revision_id}:${b.fact_revision_id}`,
          priority: priorityFor("RX02", 0),
          uncertaintyCodes: [],
          status: "OPEN",
          claimRevisionIds: [a.fact_revision_id, b.fact_revision_id],
          summary: `Same-class overlap: ${pa} (${summariseIngredients(ai)}) and ${pb} (${summariseIngredients(bi)}) are both ${CONCEPTS.find((c) => c.id === shared[0])?.canonicalLabel}. Doctor confirms whether both are intended.`,
          doctorOnly: false,
        },
      });
    }
  }
  return hits;
}

/** RX03 — strength mismatch on the same ingredient/form. */
function rx03StrengthMismatch(items: AdmittedClaim[]): RuleHit[] {
  const hits: RuleHit[] = [];
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const a = items[i].claim;
      const b = items[j].claim;
      const ai = ingredientsForClaim(a);
      const bi = ingredientsForClaim(b);
      if (ai.length !== 1 || bi.length !== 1) continue;
      if (ai[0] !== bi[0]) continue;
      if (a.strength_value === b.strength_value) continue;
      if (a.strength_unit !== b.strength_unit) continue;
      const isPrescribedVsReported =
        (a.evidence_kind === "PRESCRIBED" && (b.evidence_kind === "SEEN_AT_HOME" || b.evidence_kind === "PATIENT_REPORTED_USE")) ||
        (b.evidence_kind === "PRESCRIBED" && (a.evidence_kind === "SEEN_AT_HOME" || a.evidence_kind === "PATIENT_REPORTED_USE"));
      if (!isPrescribedVsReported) continue;
      hits.push({
        issue: {
          kind: "CONFLICT",
          type: "RX03",
          ruleId: "RX03",
          ruleVersion: RULE_VERSION,
          signature: `RX03:${a.fact_revision_id}:${b.fact_revision_id}`,
          priority: priorityFor("RX03", 0),
          uncertaintyCodes: ["STRENGTH_DISAGREEMENT"],
          status: "OPEN",
          claimRevisionIds: [a.fact_revision_id, b.fact_revision_id],
          summary: `Documented prescription says ${a.strength_value}${a.strength_unit ?? "mg"} but the strip or reported use is ${b.strength_value}${b.strength_unit ?? "mg"} for ${summariseIngredients(ai)}.`,
          doctorOnly: false,
        },
      });
    }
  }
  return hits;
}

/** RX04 — off-record medication (patient report of a product with no matched Rx). */
function rx04OffRecord(items: AdmittedClaim[], allowedEvidenceKinds: EvidenceKind[]): RuleHit[] {
  const reported = items.filter((i) => allowedEvidenceKinds.includes(i.claim.evidence_kind as EvidenceKind));
  const prescribed = items.filter((i) => i.claim.evidence_kind === "PRESCRIBED");
  const hits: RuleHit[] = [];
  for (const r of reported) {
    const ri = ingredientsForClaim(r.claim);
    const match = prescribed.find((p) => {
      const pi = ingredientsForClaim(p.claim);
      return ri.length && pi.length && ingredientsEqual(ri, pi);
    });
    if (match) continue;
    const product = productById(r.claim.product_id);
    hits.push({
      issue: {
        kind: "GAP",
        type: "RX04",
        ruleId: "RX04",
        ruleVersion: RULE_VERSION,
        signature: `RX04:${r.revision.id}`,
        priority: priorityFor("RX04", 0),
        uncertaintyCodes: ["OFF_RECORD"],
        status: "OPEN",
        claimRevisionIds: [r.revision.id],
        summary: `Patient reports using ${product?.brand ?? r.claim.brand ?? summariseIngredients(ri)} but no matching prescribed record was found.`,
        doctorOnly: false,
      },
    });
  }
  return hits;
}

/** RX05 — older Rx with no later stop and no continuation. */
function rx05UnclearContinuation(items: AdmittedClaim[]): RuleHit[] {
  const hits: RuleHit[] = [];
  const meds = items.filter((i) => i.claim.evidence_kind === "PRESCRIBED");
  for (let i = 0; i < meds.length; i++) {
    for (let j = 0; j < meds.length; j++) {
      if (i === j) continue;
      const older = meds[i];
      const newer = meds[j];
      const oStart = older.revision.event_date ?? older.claim.effective_start ?? null;
      const nStart = newer.revision.event_date ?? newer.claim.effective_start ?? null;
      if (!oStart || !nStart) continue;
      if (oStart >= nStart) continue;
      const oi = ingredientsForClaim(older.claim);
      const ni = ingredientsForClaim(newer.claim);
      if (!ingredientsEqual(oi, ni)) continue;
      hits.push({
        issue: {
          kind: "GAP",
          type: "RX05",
          ruleId: "RX05",
          ruleVersion: RULE_VERSION,
          signature: `RX05:${older.revision.id}:${newer.revision.id}`,
          priority: priorityFor("RX05", 0),
          uncertaintyCodes: ["UNCLEAR_CONTINUATION"],
          status: "OPEN",
          claimRevisionIds: [older.revision.id, newer.revision.id],
          summary: `Earlier prescription for ${summariseIngredients(oi)} is not present in the later prescription. Confirm whether this medicine is still being taken.`,
          doctorOnly: false,
        },
      });
    }
  }
  return hits;
}

export interface ReconcileInput {
  caseId: string;
  contextVersion: number;
  audienceFingerprint: string;
  admittedClaims: AdmittedClaim[];
  orderedTestIds: string[];
  matchedOrderIds: string[];
}

export function runReconcileRules(input: ReconcileInput): Omit<Issue, "id" | "createdAt" | "updatedAt">[] {
  const hits: Omit<Issue, "id" | "createdAt" | "updatedAt">[] = [];

  hits.push(
    ...rx01ExactIngredientOverlap(input.admittedClaims).map((h) => ({
      ...h.issue,
      contextVersion: input.contextVersion,
      audienceFingerprint: input.audienceFingerprint,
    })),
  );
  hits.push(
    ...rx02ClassOverlap(input.admittedClaims).map((h) => ({
      ...h.issue,
      contextVersion: input.contextVersion,
      audienceFingerprint: input.audienceFingerprint,
    })),
  );
  hits.push(
    ...rx03StrengthMismatch(input.admittedClaims).map((h) => ({
      ...h.issue,
      contextVersion: input.contextVersion,
      audienceFingerprint: input.audienceFingerprint,
    })),
  );
  hits.push(
    ...rx04OffRecord(input.admittedClaims, ["PATIENT_REPORTED_USE", "SEEN_AT_HOME"]).map((h) => ({
      ...h.issue,
      contextVersion: input.contextVersion,
      audienceFingerprint: input.audienceFingerprint,
    })),
  );
  hits.push(
    ...rx05UnclearContinuation(input.admittedClaims).map((h) => ({
      ...h.issue,
      contextVersion: input.contextVersion,
      audienceFingerprint: input.audienceFingerprint,
    })),
  );

  for (const orderId of input.orderedTestIds) {
    if (!input.matchedOrderIds.includes(orderId)) {
      hits.push({
        kind: "GAP",
        type: "LAB01",
        ruleId: "LAB01",
        ruleVersion: RULE_VERSION,
        signature: `LAB01:${orderId}`,
        priority: priorityFor("LAB01", 0),
        uncertaintyCodes: ["RESULT_NOT_AVAILABLE"],
        status: "OPEN",
        claimRevisionIds: [orderId],
        contextVersion: input.contextVersion,
        audienceFingerprint: input.audienceFingerprint,
        summary: `Advised test result is not available among admitted evidence.`,
        doctorOnly: false,
      });
    }
  }

  return hits;
}

export { RULE_VERSION as RECONCILE_RULE_VERSION, TERMINOLOGY_VERSION };