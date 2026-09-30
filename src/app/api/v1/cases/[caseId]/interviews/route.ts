import { NextRequest } from "next/server";
import { InterviewRepo, IssueRepo, CaseRepo, QuestionRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { planQuestions } from "@/lib/domain/interview";
import { newQuestionId } from "@/lib/domain/interview";
import { nanoid } from "nanoid";
import { AuditRepo } from "@/lib/data/repo";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    const body = (await req.json()) as { language?: "bn" | "en" };
    const language = body.language ?? actor.user.locale ?? "bn";
    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");

    const interviewId = `iv_${nanoid(10)}`;
    InterviewRepo.insert({
      id: interviewId,
      case_id: caseId,
      respondent_id: actor.user.id,
      role: actor.user.role === "CAREGIVER" ? "CAREGIVER" : "PATIENT",
      language,
      budget: 3,
      context_version: c.context_version,
      status: "ACTIVE",
      stop_reason: null,
      visited_question_ids: "[]",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    const openIssues = IssueRepo.forCase(caseId).filter((i) => i.status === "OPEN");
    const planned = planQuestions(
      openIssues.map((i) => ({
        id: i.id,
        kind: i.kind as "CONFLICT" | "GAP",
        type: i.type,
        ruleId: i.rule_id,
        ruleVersion: i.rule_version,
        signature: i.signature,
        contextVersion: i.context_version,
        audienceFingerprint: i.audience_fingerprint,
        priority: i.priority as "REVIEW_FIRST" | "REVIEW_NEXT" | "INFORMATION",
        uncertaintyCodes: JSON.parse(i.uncertainty_codes || "[]"),
        status: i.status as any,
        claimRevisionIds: JSON.parse(i.claim_revision_ids || "[]"),
        summary: i.summary,
        doctorOnly: !!i.doctor_only,
        createdAt: i.created_at,
        updatedAt: i.updated_at,
      })),
      [],
      language,
      3,
    );
    const created = [];
    for (const p of planned) {
      const qid = newQuestionId();
      QuestionRepo.insert({
        id: qid,
        resource_id: `res_${nanoid(8)}`,
        interview_id: interviewId,
        target_issue_ids: JSON.stringify(p.targetIssueIds),
        template_id: p.templateId,
        template_version: "demo-1",
        language,
        text: p.text,
        response_type: p.responseType,
        options: JSON.stringify(p.options),
        allows_unknown: 1,
        allows_skip: 1,
        stop_conditions: "[]",
        asked_at: new Date().toISOString(),
        answered_input_id: null,
        disposition: "ASKED",
      });
      created.push({ id: qid, text: p.text, options: p.options });
    }

    AuditRepo.insert({
      id: nanoid(8),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "START_INTERVIEW",
      target_resource_id: interviewId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });

    return jsonOk({ interviewId, questions: created });
  } catch (e) {
    return jsonError(e);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    const interviews = InterviewRepo.forCase(caseId);
    return jsonOk({ interviews });
  } catch (e) {
    return jsonError(e);
  }
}
