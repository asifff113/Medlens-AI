import { NextRequest } from "next/server";
import { CaseRepo, EncounterRepo, FactRepo, FactRevisionRepo, MedicationClaimRepo, IssueRepo, UpdateItemRepo, VisitUpdateRepo, AuditRepo, ReviewActionRepo, MedicationEventRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { nanoid } from "nanoid";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "DOCTOR") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");

    const encounter = EncounterRepo.forCase(caseId)[0];
    if (!encounter) throw new Error("FORBIDDEN");

    const updateId = `vu_${nanoid(8)}`;
    const items: { operation: "ADD" | "CHANGE" | "STOP" | "CONTINUE" | "PAUSE"; before: any; after: any; targetFactId: string | null }[] = [];

    // Diff: from today's prescription (src_rx_today) vs admitted current context
    const todayFacts = FactRepo.forCase(caseId).filter((f) => {
      if (f.kind !== "MEDICATION") return false;
      const rev = f.current_revision_id ? FactRevisionRepo.byId(f.current_revision_id) : null;
      const today = new Date();
      return rev?.event_date ? new Date(rev.event_date).toDateString() === today.toDateString() : false;
    });

    for (const f of todayFacts) {
      const rev = f.current_revision_id ? FactRevisionRepo.byId(f.current_revision_id) : null;
      const claim = rev ? MedicationClaimRepo.byFactRevision(rev.id) : null;
      if (!claim) continue;
      items.push({
        operation: "ADD",
        before: null,
        after: { brand: claim.brand, ingredient: claim.ingredient_names, strength: `${claim.strength_value ?? ""}${claim.strength_unit ?? ""}` },
        targetFactId: f.id,
      });
    }

    // Suggested review-first items from open issues
    const issues = IssueRepo.forCase(caseId).filter((i) => i.priority === "REVIEW_FIRST").slice(0, 3);
    for (const i of issues) {
      items.push({
        operation: "CHANGE",
        before: null,
        after: { issueType: i.type, summary: i.summary },
        targetFactId: null,
      });
    }

    VisitUpdateRepo.insert({
      id: updateId,
      resource_id: `res_${nanoid(8)}`,
      case_id: caseId,
      encounter_id: encounter.id,
      base_context_version: c.context_version,
      proposal_version: 1,
      privacy_epoch: c.privacy_epoch,
      state: "IN_REVIEW",
      committed_at: null,
      committed_by: null,
    });

    let i = 0;
    for (const it of items) {
      UpdateItemRepo.insert({
        id: `ui_${nanoid(8)}`,
        resource_id: `res_${nanoid(8)}`,
        update_id: updateId,
        revision: 1,
        operation: it.operation,
        before_payload: it.before ? JSON.stringify(it.before) : null,
        proposed_after_payload: JSON.stringify(it.after),
        target_fact_id: it.targetFactId,
        status: "PENDING",
      });
      i++;
    }

    AuditRepo.insert({
      id: nanoid(8),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "CREATE_UPDATE_PROPOSAL",
      target_resource_id: updateId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });

    return jsonOk({ updateId, itemCount: items.length });
  } catch (e) {
    return jsonError(e);
  }
}
