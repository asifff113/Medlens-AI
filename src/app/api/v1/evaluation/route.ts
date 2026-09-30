import { NextRequest } from "next/server";
import { EvaluationSetRepo, EvaluationCaseRepo, EvaluationRunRepo, EvaluationMetricRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { nanoid } from "nanoid";

export async function GET() {
  const sets = EvaluationSetRepo.all();
  const runs = sets.length > 0 ? EvaluationRunRepo.forSet(sets[0].id) : [];
  const metrics = runs.flatMap((r) => EvaluationMetricRepo.forRun(r.id));
  return jsonOk({ sets, runs, metrics });
}

export async function POST(_req: NextRequest) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "EVALUATOR" && actor.user.role !== "OPERATOR") throw new Error("FORBIDDEN");
    const sets = EvaluationSetRepo.all();
    if (!sets.length) throw new Error("FORBIDDEN");
    const cases = EvaluationCaseRepo.forSet(sets[0].id);
    const runId = `run_${nanoid(8)}`;
    const startedAt = new Date().toISOString();
    EvaluationRunRepo.insert({
      id: runId,
      set_id: sets[0].id,
      build_commit: "demo",
      model_config_hash: "mock-demo-1.0.0",
      dictionary_version: "demo-1.0.0",
      protocol_version: "demo-1.0.0",
      started_at: startedAt,
      finished_at: null,
      status: "RUNNING",
    });
    let totalAdmitted = 0;
    let totalExpected = 0;
    for (const c of cases) {
      const expected = JSON.parse(c.expected_json);
      const accepted = expected.expectedAccepted ?? 0;
      const admitted = expected.expectedAdmitted ?? accepted;
      totalAdmitted += admitted;
      totalExpected += accepted;
      EvaluationMetricRepo.insert({
        id: `metric_${nanoid(8)}`,
        run_id: runId,
        metric_key: c.fixture_key,
        slice: c.slice_tags,
        numerator: admitted,
        denominator: accepted || 1,
        value: accepted ? admitted / accepted : null,
        failure_case_ids: "[]",
      });
    }
    EvaluationRunRepo.finish(runId, "COMPLETE");
    EvaluationMetricRepo.insert({
      id: `metric_${nanoid(8)}`,
      run_id: runId,
      metric_key: "OVERALL_ADMIT_RATE",
      slice: "ALL",
      numerator: totalAdmitted,
      denominator: totalExpected || 1,
      value: totalExpected ? totalAdmitted / totalExpected : null,
      failure_case_ids: "[]",
    });
    return jsonOk({ runId, status: "COMPLETE" });
  } catch (e) {
    return await jsonError(e);
  }
}
