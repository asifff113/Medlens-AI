import { NextRequest } from "next/server";
import { LabObservationRepo, MedicationClaimRepo, FactRepo, FactRevisionRepo, WellbeingRepo, ConsentRepo, CaseRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { assertCaseAccess } from "@/lib/server/access";
import { jsonError, jsonOk } from "@/lib/server/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    assertCaseAccess(actor, caseId);

    const facts = FactRepo.forCase(caseId);
    const factView = facts.map((f) => ({
      ...f,
      currentRevision: f.current_revision_id ? FactRevisionRepo.byId(f.current_revision_id) : null,
    }));

    const meds = MedicationClaimRepo.forCase(caseId).map((m) => {
      const rev = FactRevisionRepo.byId(m.fact_revision_id);
      return { revisionId: m.fact_revision_id, rawText: rev?.raw_representation ?? "", normalized: m, factKind: "MEDICATION" };
    });

    const labs = LabObservationRepo.forCase(caseId).map((l) => ({
      revisionId: l.fact_revision_id,
      ...l,
      factKind: "LAB",
    }));

    const allergies = factView
      .filter((f) => f.kind === "ALLERGY")
      .map((f) => ({
        revisionId: f.current_revision_id,
        factKind: "ALLERGY",
        normalized: f.currentRevision ? JSON.parse(f.currentRevision.normalized_payload) : {},
        rawText: f.currentRevision?.raw_representation ?? "",
      }));

    const complaints = factView
      .filter((f) => f.kind === "COMPLAINT")
      .map((f) => ({
        revisionId: f.current_revision_id,
        factKind: "COMPLAINT",
        rawText: f.currentRevision?.raw_representation ?? "",
      }));

    const tests = factView
      .filter((f) => f.kind === "TEST_ORDER")
      .map((f) => ({
        revisionId: f.current_revision_id,
        factKind: "TEST_ORDER",
        rawText: f.currentRevision?.raw_representation ?? "",
      }));

    return jsonOk({
      caseId,
      contextVersion: CaseRepo.byId(caseId)?.context_version ?? 0,
      privacyEpoch: CaseRepo.byId(caseId)?.privacy_epoch ?? 0,
      facts: factView,
      medications: meds,
      labs,
      allergies,
      complaints,
      tests,
    });
  } catch (e) {
    return jsonError(e);
  }
}
