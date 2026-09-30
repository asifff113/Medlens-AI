import { NextRequest } from "next/server";
import { CaseRepo, PatientRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";

export async function GET() {
  const actor = await getActor();
  if (!actor) return await jsonError(new Error("UNAUTHENTICATED"));
  if (actor.user.role === "PATIENT") {
    const patient = PatientRepo.byOwner(actor.user.id);
    if (!patient) return jsonOk({ cases: [] });
    return jsonOk({ cases: CaseRepo.byPatient(patient.id) });
  }
  if (actor.user.role === "DOCTOR" || actor.user.role === "CAREGIVER" || actor.user.role === "EVALUATOR") {
    // For demo we expose the synthetic case only.
    return jsonOk({ cases: CaseRepo.byPatient("pat_rahima") });
  }
  return jsonOk({ cases: [] });
}
