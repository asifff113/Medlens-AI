import { NextRequest } from "next/server";
import { CaseRepo, SourceArtifactRepo, FactRepo, FactRevisionRepo, MedicationClaimRepo, EvidenceAnchorRepo, EvidenceEdgeRepo, LabObservationRepo, ProcessingRunRepo, ConsentRepo, AuditRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { getProvider } from "@/lib/providers/ai";
import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import { normalizeBrand, TERMINOLOGY_VERSION } from "@/lib/domain/terminology";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    const body = (await req.json()) as { sourceId: string };

    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");
    ConsentRepo.activeFor(caseId, "AI_PROCESSING");

    const source = SourceArtifactRepo.byId(body.sourceId);
    if (!source || source.case_id !== caseId) throw new Error("FORBIDDEN");
    const provider = getProvider();

    const runId = `run_${nanoid(8)}`;
    const startedAt = Date.now();
    ProcessingRunRepo.insert({
      id: runId,
      source_id: source.id,
      stage: "DOCUMENT",
      adapter: provider.name,
      provider: "demo",
      model_id: provider.modelId,
      prompt_version: "demo-1",
      schema_version: "ai-adapter-1.0.0",
      input_hash: source.content_hash,
      output_resource_id: null,
      dictionary_version: TERMINOLOGY_VERSION,
      policy_fingerprint: "demo-1.0.0",
      privacy_epoch: c.privacy_epoch,
    });
    const result = await provider.extractDocument(
      {
        sourceId: source.id,
        pageCount: 1,
        metadata: { caseId, kind: source.kind, filenameSafe: source.filename_safe },
      },
      { taskId: runId, purpose: "DOCUMENT_EXTRACTION", allowedResourceIds: [source.resource_id], privacyEpoch: c.privacy_epoch, policyFingerprint: "demo-1.0.0", schemaVersion: "ai-adapter-1.0.0" },
    );

    ProcessingRunRepo.finish(runId, "SUCCEEDED", null, Date.now() - startedAt);

    // Admit facts.
    const admitted: { factRevisionId: string; summary: string }[] = [];
    let needsReview = false;
    for (const f of result.fields) {
      if (f.state === "UNREADABLE") continue;
      const value = f.value as { brand?: string; ingredient?: string; productId?: string; strength?: number; unit?: string; analyte?: string; value?: number; date?: string } | null;
      if (!value) continue;

      // Medication fields
      if (f.fieldKey.startsWith("drug_line")) {
        if (f.state === "NEEDS_REVIEW") needsReview = true;
        const normalized = normalizeBrand(value.brand ?? "");
        const productId = normalized.selectedConceptId ?? value.productId ?? null;
        const factId = `fact_${nanoid(8)}`;
        FactRepo.insert({
          id: factId, resource_id: `res_${nanoid(8)}`, case_id: caseId,
          kind: "MEDICATION", current_revision_id: null,
          logical_key: `${value.brand?.toLowerCase()}-${value.strength}-${source.event_date ?? ""}`,
        });
        const revisionId = `rev_${nanoid(8)}`;
        FactRevisionRepo.insert({
          id: revisionId, resource_id: `res_${nanoid(8)}`, fact_id: factId, revision_no: 1,
          raw_representation: f.rawText ?? value.brand ?? "",
          normalized_payload: JSON.stringify(value),
          event_date: source.event_date, date_precision: source.event_date ? "DAY" : "UNKNOWN",
          origin_kind: "DOCUMENT",
          processing_state: f.state === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "NORMALIZED",
          review_state: "CONTRIBUTOR_CONFIRMED",
          validity_state: "CURRENT",
          confidence_by_stage: JSON.stringify(f.confidence),
          author_id: actor.user.id,
          supersedes_revision_id: null,
          created_at: new Date().toISOString(),
        });
        FactRepo.setCurrentRevision(factId, revisionId);
        MedicationClaimRepo.insert({
          fact_revision_id: revisionId,
          product_id: productId,
          brand: value.brand ?? null,
          manufacturer: null,
          ingredient_ids: JSON.stringify([]),
          ingredient_names: JSON.stringify([value.ingredient ?? ""]),
          strength_value: value.strength ?? null,
          strength_unit: value.unit ?? "mg",
          form: "TABLET",
          route: "ORAL",
          dose_raw: null,
          frequency_raw: null,
          parsed_schedule: null,
          duration_raw: null,
          evidence_kind: source.kind === "STRIP" ? "SEEN_AT_HOME" : "PRESCRIBED",
          claimed_lifecycle: "STARTED",
          effective_start: source.event_date,
          effective_end: null,
          provider_id: null,
          unknown_reason: null,
        });
        for (const anc of f.anchorIds) {
          EvidenceAnchorRepo.insert({
            id: anc, resource_id: `res_${nanoid(8)}`, source_artifact_id: source.id,
            page_id: null, bbox: JSON.stringify({ x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.2 }),
            text_start: null, text_end: null,
            audio_start_ms: null, audio_end_ms: null,
            quote_original: f.rawText ?? value.brand ?? "",
            source_version_hash: createHash("sha256").update(source.id + revisionId).digest("hex"),
          });
          EvidenceEdgeRepo.insert({
            id: `edge_${nanoid(8)}`, case_id: caseId, derived_resource_id: revisionId,
            source_resource_id: anc, relation: "DERIVES_FROM", transformation_version: "demo-1",
          });
        }
        admitted.push({ factRevisionId: revisionId, summary: `${value.brand} ${value.strength}${value.unit ?? "mg"}` });
      }

      // Lab fields
      if (f.fieldKey === "hba1c" || f.fieldKey === "fpg" || f.fieldKey === "creatinine") {
        const factId = `fact_${nanoid(8)}`;
        FactRepo.insert({
          id: factId, resource_id: `res_${nanoid(8)}`, case_id: caseId,
          kind: "LAB", current_revision_id: null,
          logical_key: `${value.analyte}-${value.date ?? ""}`,
        });
        const revisionId = `rev_${nanoid(8)}`;
        FactRevisionRepo.insert({
          id: revisionId, resource_id: `res_${nanoid(8)}`, fact_id: factId, revision_no: 1,
          raw_representation: f.rawText ?? "",
          normalized_payload: JSON.stringify(value),
          event_date: value.date ?? source.event_date,
          date_precision: "DAY",
          origin_kind: "DOCUMENT",
          processing_state: "NORMALIZED",
          review_state: "CONTRIBUTOR_CONFIRMED",
          validity_state: "CURRENT",
          confidence_by_stage: JSON.stringify(f.confidence),
          author_id: actor.user.id,
          supersedes_revision_id: null,
          created_at: new Date().toISOString(),
        });
        FactRepo.setCurrentRevision(factId, revisionId);
        LabObservationRepo.insert({
          fact_revision_id: revisionId,
          lab_definition_id: value.analyte === "HbA1c" ? "l_hba1c" : value.analyte === "FPG" ? "l_fpg" : "l_creatinine",
          analyte: value.analyte ?? null,
          original_test: value.analyte ?? null,
          original_value: value.value != null ? String(value.value) : null,
          original_unit: value.unit ?? null,
          original_range: null,
          normalized_decimal: value.value ?? null,
          normalized_unit: value.unit ?? null,
          conversion_version: "demo-1",
          method: "HPLC",
          specimen: "BLOOD_SERUM",
          laboratory: "Demo Lab",
          result_date: value.date ?? source.event_date,
          date_precision: "DAY",
        });
        for (const anc of f.anchorIds) {
          EvidenceAnchorRepo.insert({
            id: anc, resource_id: `res_${nanoid(8)}`, source_artifact_id: source.id,
            page_id: null, bbox: JSON.stringify({ x0: 0.1, y0: 0.3, x1: 0.6, y1: 0.4 }),
            text_start: null, text_end: null,
            audio_start_ms: null, audio_end_ms: null,
            quote_original: f.rawText ?? "",
            source_version_hash: createHash("sha256").update(source.id + revisionId).digest("hex"),
          });
          EvidenceEdgeRepo.insert({
            id: `edge_${nanoid(8)}`, case_id: caseId, derived_resource_id: revisionId,
            source_resource_id: anc, relation: "DERIVES_FROM", transformation_version: "demo-1",
          });
        }
        admitted.push({ factRevisionId: revisionId, summary: `${value.analyte} ${value.value}${value.unit}` });
      }

      if (f.fieldKey === "advised_test") {
        const factId = `fact_${nanoid(8)}`;
        FactRepo.insert({
          id: factId, resource_id: `res_${nanoid(8)}`, case_id: caseId,
          kind: "TEST_ORDER", current_revision_id: null,
          logical_key: `order-${value.analyte}-${source.event_date ?? ""}`,
        });
        const revisionId = `rev_${nanoid(8)}`;
        FactRevisionRepo.insert({
          id: revisionId, resource_id: `res_${nanoid(8)}`, fact_id: factId, revision_no: 1,
          raw_representation: f.rawText ?? "",
          normalized_payload: JSON.stringify({ analyte: value.analyte }),
          event_date: source.event_date,
          date_precision: "DAY",
          origin_kind: "DOCUMENT",
          processing_state: "NORMALIZED",
          review_state: "CONTRIBUTOR_CONFIRMED",
          validity_state: "CURRENT",
          confidence_by_stage: JSON.stringify(f.confidence),
          author_id: actor.user.id,
          supersedes_revision_id: null,
          created_at: new Date().toISOString(),
        });
        FactRepo.setCurrentRevision(factId, revisionId);
        for (const anc of f.anchorIds) {
          EvidenceAnchorRepo.insert({
            id: anc, resource_id: `res_${nanoid(8)}`, source_artifact_id: source.id,
            page_id: null, bbox: JSON.stringify({ x0: 0.1, y0: 0.7, x1: 0.5, y1: 0.78 }),
            text_start: null, text_end: null,
            audio_start_ms: null, audio_end_ms: null,
            quote_original: f.rawText ?? "",
            source_version_hash: createHash("sha256").update(source.id + revisionId).digest("hex"),
          });
        }
      }
    }

    if (result.documentType === "PRESCRIPTION" && result.fields.some((f) => f.state === "NEEDS_REVIEW")) {
      SourceArtifactRepo.updateState(source.id, "REVIEW_REQUIRED");
    } else {
      SourceArtifactRepo.updateState(source.id, "ADMITTED");
    }

    AuditRepo.insert({
      id: nanoid(8),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "PROCESS_DOCUMENT",
      target_resource_id: source.id,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });

    return jsonOk({
      documentType: result.documentType,
      fieldsAdmitted: admitted,
      blindSpots: result.blindSpots,
      needsReview,
      runId,
    });
  } catch (e) {
    return jsonError(e);
  }
}
