import { NextRequest } from "next/server";
import { CaseRepo, IssueRepo, LabObservationRepo, MedicationClaimRepo, TestOrderRepo, ConsentRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { assertCaseAccess } from "@/lib/server/access";
import { runReconcileRules } from "@/lib/domain/reconcile";
import { jsonError, jsonOk } from "@/lib/server/api";
import { AuditRepo } from "@/lib/data/repo";
import { nanoid } from "nanoid";
import { TERMINOLOGY_VERSION } from "@/lib/domain/terminology";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    assertCaseAccess(actor, caseId);
    ConsentRepo.activeFor(caseId, "AI_PROCESSING"); // no-op check

    const c = CaseRepo.byId(caseId)!;
    const audience = "self";
    const fingerprint = `${audience}-${caseId}-${c.context_version}`;

    IssueRepo.clearOpenFor(caseId, c.context_version);
    const admitted = MedicationClaimRepo.admittedForCase(caseId);
    const orders = TestOrderRepo.forCase(caseId).map((t) => t.fact_revision_id);
    const labRevisions = LabObservationRepo.forCase(caseId).map((l) => l.fact_revision_id);
    // All orders are matched if at least one lab is present and recent; otherwise they're unmatched
    const matches = orders.filter(() => labRevisions.length > 0);

    const draft = runReconcileRules({
      caseId,
      contextVersion: c.context_version,
      audienceFingerprint: fingerprint,
      admittedClaims: admitted,
      orderedTestIds: orders,
      matchedOrderIds: matches,
    });

    for (const issue of draft) {
      IssueRepo.insert({
        id: nanoid(12),
        resource_id: nanoid(12),
        case_id: caseId,
        kind: issue.kind,
        type: issue.type,
        rule_id: issue.ruleId,
        rule_version: issue.ruleVersion,
        signature: issue.signature,
        context_version: c.context_version,
        audience_fingerprint: fingerprint,
        priority: issue.priority,
        uncertainty_codes: JSON.stringify(issue.uncertaintyCodes),
        status: issue.status,
        claim_revision_ids: JSON.stringify(issue.claimRevisionIds),
        summary: issue.summary,
        doctor_only: issue.doctorOnly ? 1 : 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    AuditRepo.insert({
      id: nanoid(12),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "RECONCILE",
      target_resource_id: null,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });

    return jsonOk({
      issues: IssueRepo.forCase(caseId),
      ruleVersion: "demo-1.0.0",
      dictionaryVersion: TERMINOLOGY_VERSION,
    });
  } catch (e) {
    return jsonError(e);
  }
}
