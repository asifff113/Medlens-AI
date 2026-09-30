import { NextRequest } from "next/server";
import { WellbeingRepo, FactRepo, FactRevisionRepo, ConsentRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { nanoid } from "nanoid";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    if (actor.user.role === "CAREGIVER") throw new Error("FORBIDDEN");
    return jsonOk({ entries: WellbeingRepo.forCase(caseId) });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "PATIENT") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const consent = ConsentRepo.activeFor(caseId, "WELLBEING_COLLECTION");
    if (!consent) throw new Error("FORBIDDEN");
    const body = (await req.json()) as {
      originalWording: string;
      topicSelected?: string;
      onset?: string;
      datePrecision?: string;
      requestDiscussion: boolean;
      presentationPreference?: "DEFAULT" | "RESPECTFUL" | "PRIVATE_CONVERSATION";
    };
    const factId = `fact_${nanoid(8)}`;
    FactRepo.insert({ id: factId, resource_id: `res_${nanoid(8)}`, case_id: caseId, kind: "WELLBEING", current_revision_id: null, logical_key: `wellbeing-${nanoid(6)}` });
    const revisionId = `rev_${nanoid(8)}`;
    FactRevisionRepo.insert({
      id: revisionId, resource_id: `res_${nanoid(8)}`, fact_id: factId, revision_no: 1,
      raw_representation: body.originalWording,
      normalized_payload: JSON.stringify({
        topicSelected: body.topicSelected ?? null,
        onset: body.onset ?? null,
        datePrecision: body.datePrecision ?? "UNKNOWN",
        requestDiscussion: body.requestDiscussion,
        presentationPreference: body.presentationPreference ?? "RESPECTFUL",
      }),
      event_date: body.onset ?? null,
      date_precision: body.datePrecision ?? "UNKNOWN",
      origin_kind: "PATIENT",
      processing_state: "NORMALIZED",
      review_state: "CONTRIBUTOR_CONFIRMED",
      validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([]),
      author_id: actor.user.id,
      supersedes_revision_id: null,
      created_at: new Date().toISOString(),
    });
    FactRepo.setCurrentRevision(factId, revisionId);
    WellbeingRepo.insert({
      fact_revision_id: revisionId,
      resource_id: `res_${nanoid(8)}`,
      case_id: caseId,
      respondent_id: actor.user.id,
      original_input_id: null,
      topic_selected: body.topicSelected ?? null,
      onset: body.onset ?? null,
      date_precision: body.datePrecision ?? "UNKNOWN",
      original_wording: body.originalWording,
      confirmed_summary: null,
      request_discussion: body.requestDiscussion ? 1 : 0,
      presentation_preference: body.presentationPreference ?? "RESPECTFUL",
      confirmation_at: new Date().toISOString(),
    });
    return jsonOk({ factRevisionId: revisionId });
  } catch (e) {
    return jsonError(e);
  }
}
