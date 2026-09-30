import { NextRequest } from "next/server";
import { AssessmentSessionRepo, InstrumentDefinitionRepo, AssessmentRevisionRepo, AssessmentResponseRepo, FactRepo, FactRevisionRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { scoreWho5Submission, WHO5_DEFINITION_CHECKSUM } from "@/lib/domain/assessment";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "PATIENT") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const body = (await req.json()) as {
      sessionId: string;
      definitionChecksum: string;
      responses: { itemId: string; value: number; confirmed: boolean }[];
    };
    const session = AssessmentSessionRepo.byId(body.sessionId);
    if (!session || session.case_id !== caseId) throw new Error("FORBIDDEN");
    const def = InstrumentDefinitionRepo.byKey("WHO5", "bn");
    if (!def) throw new Error("FORBIDDEN");
    if (body.definitionChecksum !== WHO5_DEFINITION_CHECKSUM) {
      return jsonError(Object.assign(new Error("checksum mismatch"), { code: "STALE_VERSION", status: 409, message: "Instrument definition changed." }));
    }

    const score = scoreWho5Submission(body.responses);
    const revisionId = `arev_${nanoid(10)}`;
    AssessmentRevisionRepo.insert({
      id: revisionId,
      resource_id: `res_${nanoid(8)}`,
      session_id: session.id,
      revision_no: session.current_revision + 1,
      definition_checksum: body.definitionChecksum,
      response_hash: score.responseHash,
      scoring_version: score.scoringVersion,
      raw_total: score.rawTotal,
      transformed_score: score.transformedScore,
      submitted_at: new Date().toISOString(),
      scored_at: new Date().toISOString(),
      supersedes_id: null,
    });
    for (const r of body.responses) {
      AssessmentResponseRepo.insert({
        id: `arsp_${nanoid(8)}`,
        assessment_revision_id: revisionId,
        item_id: r.itemId,
        value: r.value,
        disposition: "ANSWERED",
        confirmed_at: new Date().toISOString(),
        source_input_id: null,
      });
    }
    AssessmentSessionRepo.updateState(session.id, "SCORED", new Date().toISOString());

    // Persist as an ASSESSMENT fact for downstream briefs.
    const factId = `fact_${nanoid(8)}`;
    FactRepo.insert({
      id: factId, resource_id: `res_${nanoid(8)}`, case_id: caseId,
      kind: "ASSESSMENT", current_revision_id: null,
      logical_key: `assessment-${session.id}-${revisionId}`,
    });
    const factRevId = `rev_${nanoid(8)}`;
    FactRevisionRepo.insert({
      id: factRevId, resource_id: `res_${nanoid(8)}`, fact_id: factId, revision_no: 1,
      raw_representation: `WHO-5 raw ${score.rawTotal}, transformed ${score.transformedScore}`,
      normalized_payload: JSON.stringify({ rawTotal: score.rawTotal, transformedScore: score.transformedScore, runtimeMode: score.runtimeMode }),
      event_date: new Date().toISOString(),
      date_precision: "DAY",
      origin_kind: "PATIENT",
      processing_state: "NORMALIZED",
      review_state: "CONTRIBUTOR_CONFIRMED",
      validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([]),
      author_id: actor.user.id,
      supersedes_revision_id: null,
      created_at: new Date().toISOString(),
    });
    FactRepo.setCurrentRevision(factId, factRevId);

    return jsonOk({
      sessionId: session.id,
      revisionId,
      rawTotal: score.rawTotal,
      transformedScore: score.transformedScore,
      runtimeMode: score.runtimeMode,
      interpretation: null,
      diagnosticLabel: null,
      scoringVersion: score.scoringVersion,
    });
  } catch (e) {
    return jsonError(e);
  }
}
