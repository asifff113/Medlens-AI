import { NextRequest } from "next/server";
import { GrantRepo, ShareLinkRepo, AuditRepo, CaseRepo, PatientRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { nanoid } from "nanoid";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ grantId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { grantId } = await params;
    const g = GrantRepo.byId(grantId);
    if (!g) throw new Error("FORBIDDEN");
    if (actor.user.role === "PATIENT") {
      const p = PatientRepo.byOwner(actor.user.id);
      if (!p || p.id !== g.patient_id) throw new Error("FORBIDDEN");
    }

    GrantRepo.revoke(grantId);
    CaseRepo.bumpPrivacyEpoch(g.case_id);
    AuditRepo.insert({
      id: nanoid(8),
      case_id: g.case_id,
      actor_or_service_id: actor.user.id,
      action: "REVOKE_GRANT",
      target_resource_id: grantId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });
    return jsonOk({ grantId, state: "REVOKED" });
  } catch (e) {
    return jsonError(e);
  }
}
