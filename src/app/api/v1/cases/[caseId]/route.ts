import { jsonError, jsonOk } from "@/lib/server/api";
import { getActor } from "@/lib/server/session";
import { CaseRepo, PatientRepo } from "@/lib/data/repo";
import { NextRequest } from "next/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    const c = CaseRepo.byId(caseId);
    if (!c) throw Object.assign(new Error("not_found"), { code: "RESOURCE_NOT_AVAILABLE", status: 404, message: "Case not found." });
    if (actor.user.role === "PATIENT") {
      const patient = PatientRepo.byOwner(actor.user.id);
      if (!patient || patient.id !== c.patient_id) throw new Error("FORBIDDEN");
    }
    const patient = PatientRepo.byId(c.patient_id);
    return jsonOk({ case: c, patient });
  } catch (e) {
    return jsonError(e);
  }
}
