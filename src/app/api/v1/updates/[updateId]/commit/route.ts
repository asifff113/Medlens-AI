import { NextRequest } from "next/server";
import { CaseRepo, UpdateItemRepo, VisitUpdateRepo, AuditRepo, ReviewActionRepo, MedicationEventRepo, FactRepo, FactRevisionRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ updateId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "DOCTOR") throw new Error("FORBIDDEN");
    const { updateId } = await params;
    const body = (await req.json()) as { itemIds?: string[] };
    const update = VisitUpdateRepo.byId(updateId);
    if (!update) throw new Error("FORBIDDEN");
    if (update.committed_at) return jsonOk({ updateId, state: "COMMITTED", receipt: { alreadyCommitted: true } });

    const c = CaseRepo.byId(update.case_id);
    if (!c) throw new Error("FORBIDDEN");
    if (c.context_version !== update.base_context_version) {
      return jsonError(Object.assign(new Error("stale"), { code: "STALE_VERSION", status: 409, message: "Context changed." }));
    }

    const items = UpdateItemRepo.forUpdate(updateId);
    const acceptIds = new Set(body.itemIds ?? items.filter((i) => i.status === "PENDING").map((i) => i.id));

    const reviewActionIds: string[] = [];
    for (const it of items) {
      const status = acceptIds.has(it.id) ? "ACCEPTED" : "REJECTED";
      UpdateItemRepo.updateStatus(it.id, status);

      const ra = `ra_${nanoid(8)}`;
      ReviewActionRepo.insert({
        id: ra,
        resource_id: `res_${nanoid(8)}`,
        target_resource_id: it.id,
        target_revision: it.revision,
        actor_id: actor.user.id,
        actor_role: "DOCTOR",
        action: status === "ACCEPTED" ? "ACCEPT" : "REJECT",
        correction_payload: null,
        reason: null,
        authored_source_id: null,
        acted_at: new Date().toISOString(),
      });
      reviewActionIds.push(ra);

      if (status === "ACCEPTED" && it.target_fact_id && it.operation === "ADD") {
        const f = FactRepo.byId(it.target_fact_id);
        if (f?.current_revision_id) {
          FactRevisionRepo.setReviewState(f.current_revision_id, "DOCTOR_CONFIRMED");
          const encounterId = update.encounter_id;
          MedicationEventRepo.insert({
            id: `mev_${nanoid(8)}`,
            resource_id: `res_${nanoid(8)}`,
            encounter_id: encounterId,
            medication_fact_id: f.id,
            event_kind: "STARTED",
            before_claim_id: null,
            after_claim_id: f.current_revision_id,
            review_action_id: ra,
            reason_fact_revision_id: null,
            effective_date: new Date().toISOString(),
            date_precision: "DAY",
          });
        }
      }
    }

    VisitUpdateRepo.updateState(updateId, "COMMITTED", actor.user.id);
    CaseRepo.advanceContext(update.case_id, c.privacy_epoch);

    AuditRepo.insert({
      id: nanoid(8),
      case_id: update.case_id,
      actor_or_service_id: actor.user.id,
      action: "COMMIT_VISIT_UPDATE",
      target_resource_id: updateId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: update.base_context_version,
      new_version: c.context_version + 1,
    });

    return jsonOk({ updateId, state: "COMMITTED", acceptedCount: acceptIds.size, receipt: { reviewActionIds } });
  } catch (e) {
    return jsonError(e);
  }
}
