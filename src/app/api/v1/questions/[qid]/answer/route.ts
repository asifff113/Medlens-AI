import { NextRequest } from "next/server";
import { IssueRepo, QuestionRepo, FactRepo, FactRevisionRepo, SourceArtifactRepo, EvidenceAnchorRepo, EvidenceEdgeRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";

export async function POST(req: NextRequest, { params }: { params: Promise<{ qid: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { qid } = await params;
    const body = (await req.json()) as { optionId?: string; text?: string; disposition?: "ANSWERED" | "SKIPPED" | "UNKNOWN" };
    const q = QuestionRepo.byId(qid);
    if (!q) throw new Error("FORBIDDEN");

    const disposition = body.disposition ?? "ANSWERED";
    let answerText = body.text ?? body.optionId ?? "";
    if (disposition === "ANSWERED" && body.optionId) {
      const opts = JSON.parse(q.options) as { id: string; label: string }[];
      const match = opts.find((o) => o.id === body.optionId);
      if (match) answerText = match.label;
    }

    // Create typed source artifact for the answer (attributed).
    const sourceId = `src_ans_${nanoid(8)}`;
    const sourceHash = createHash("sha256").update(`${qid}|${answerText}|${Date.now()}`).digest("hex");
    const interviewCaseId = (q.interview_id?.length ?? 0) ? (await import("@/lib/data/repo")).InterviewRepo.byId(q.interview_id)?.case_id : null;
    if (!interviewCaseId) throw new Error("FORBIDDEN");
    SourceArtifactRepo.insert({
      id: sourceId,
      resource_id: `res_${nanoid(8)}`,
      case_id: interviewCaseId,
      kind: "TYPED",
      object_key: null,
      content_hash: sourceHash,
      mime_type: "text/plain",
      size_bytes: answerText.length,
      filename_safe: "patient-answer.txt",
      source_payload: JSON.stringify({ templateId: q.template_id, answer: answerText, disposition }),
      respondent_id: actor.user.id,
      respondent_role: "PATIENT",
      captured_at: new Date().toISOString(),
      event_date: new Date().toISOString(),
      consent_id: null,
      question_id: qid,
      transcript_of_id: null,
      deletion_due_at: null,
      state: "ADMITTED",
    });

    // Create a fact revision that records the patient-reported answer.
    const factId = `fact_${nanoid(8)}`;
    FactRepo.insert({
      id: factId,
      resource_id: `res_${nanoid(8)}`,
      case_id: interviewCaseId,
      kind: "NARRATIVE",
      current_revision_id: null,
      logical_key: `answer-${q.template_id}`,
    });
    const revisionId = `rev_${nanoid(8)}`;
    FactRevisionRepo.insert({
      id: revisionId,
      resource_id: `res_${nanoid(8)}`,
      fact_id: factId,
      revision_no: 1,
      raw_representation: answerText,
      normalized_payload: JSON.stringify({ templateId: q.template_id, optionId: body.optionId, disposition }),
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
    FactRepo.setCurrentRevision(factId, revisionId);
    const anchorId = `anc_${nanoid(8)}`;
    EvidenceAnchorRepo.insert({
      id: anchorId,
      resource_id: `res_${nanoid(8)}`,
      source_artifact_id: sourceId,
      page_id: null,
      bbox: null,
      text_start: 0,
      text_end: answerText.length,
      audio_start_ms: null,
      audio_end_ms: null,
      quote_original: answerText,
      source_version_hash: sourceHash,
    });
    EvidenceEdgeRepo.insert({
      id: `edge_${nanoid(8)}`,
      case_id: interviewCaseId,
      derived_resource_id: revisionId,
      source_resource_id: anchorId,
      relation: "DERIVES_FROM",
      transformation_version: "demo-1",
    });

    QuestionRepo.updateDisposition(qid, disposition === "SKIPPED" ? "SKIPPED" : disposition === "UNKNOWN" ? "UNKNOWN" : "ANSWERED", sourceId);

    // Update target issues: mark as CLARIFIED_BY_REPORT
    const targetIssueIds: string[] = JSON.parse(q.target_issue_ids);
    for (const id of targetIssueIds) {
      IssueRepo.updateStatus(id, disposition === "ANSWERED" ? "CLARIFIED_BY_REPORT" : "AWAITING_EVIDENCE");
    }

    return jsonOk({ questionId: qid, sourceId, factRevisionId: revisionId, targetIssueIds });
  } catch (e) {
    return jsonError(e);
  }
}
