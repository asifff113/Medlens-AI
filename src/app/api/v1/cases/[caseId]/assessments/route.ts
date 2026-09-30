import { NextRequest } from "next/server";
import { AssessmentSessionRepo, InstrumentDefinitionRepo, InstrumentItemRepo, AssessmentRevisionRepo, AssessmentResponseRepo, ConsentRepo, FactRepo, FactRevisionRepo, WellbeingRepo, PatientRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { scoreWho5Submission, WHO5_DEFINITION_CHECKSUM, WHO5_DEFINITION_VERSION, WHO5_SCORE_VERSION } from "@/lib/domain/assessment";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "PATIENT") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const body = (await req.json()) as { language?: "bn" | "en"; instrumentKey?: string };
    const def = InstrumentDefinitionRepo.byKey(body.instrumentKey ?? "WHO5", body.language ?? "bn");
    if (!def || def.activation_status === "UNAVAILABLE") {
      return jsonOk({ state: "UNAVAILABLE", reason: "Instrument activation pending G02." });
    }
    const consent = ConsentRepo.activeFor(caseId, "ASSESSMENT_PARTICIPATION");
    if (!consent) throw new Error("FORBIDDEN");
    const patient = PatientRepo.byOwner(actor.user.id);
    if (!patient) throw new Error("FORBIDDEN");
    const items = InstrumentItemRepo.forDefinition(def.id);
    const sessionId = `asn_${nanoid(10)}`;
    AssessmentSessionRepo.insert({
      id: sessionId,
      resource_id: `res_${nanoid(8)}`,
      definition_id: def.id,
      case_id: caseId,
      patient_id: patient.id,
      respondent_id: actor.user.id,
      consent_id: consent.id,
      administration_mode: "FIXED_TEXT",
      current_revision: 0,
      started_at: new Date().toISOString(),
      submitted_at: null,
      completion_state: "IN_PROGRESS",
    });
    return jsonOk({
      state: "IN_PROGRESS",
      sessionId,
      definitionVersion: def.definition_version,
      definitionChecksum: def.content_checksum,
      items: items.map((i) => ({
        itemId: i.item_key,
        ordinal: i.ordinal,
        text: i.exact_text,
        options: JSON.parse(i.exact_options_json),
      })),
    });
  } catch (e) {
    return jsonError(e);
  }
}
