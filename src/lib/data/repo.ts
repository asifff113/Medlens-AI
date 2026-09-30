/**
 * Repository layer. SQL only — no domain logic and no policy. Each method
 * takes a typed parameter and returns typed rows. This is the only module
 * that constructs SQL strings.
 */

import type Database from "better-sqlite3";
import { getDb } from "./db";
import type {
  CaseRow,
  PatientRow,
  UserRow,
  ClinicianProfileRow,
  SourceArtifactRow,
  FactRow,
  FactRevisionRow,
  MedicationClaimRow,
  LabObservationRow,
  TestOrderRow,
  IssueRow,
  InterviewRow,
  QuestionRow,
  BriefRow,
  BriefItemRow,
  VisitUpdateRow,
  UpdateItemRow,
  ReviewActionRow,
  ConsentRow,
  GrantRow,
  GrantResourceRow,
  ShareLinkRow,
  DocumentPageRow,
  EvidenceAnchorRow,
  ProcessingRunRow,
  OrderResultLinkRow,
  ContextSnapshotRow,
  EncounterRow,
  ProviderRow,
  MedicationEventRow,
  AuditEventRow,
  SessionRow,
  IdempotencyReceiptRow,
  JobRow,
  EvidenceEdgeRow,
  WellbeingEntryRow,
  InstrumentDefinitionRow,
  AssessmentSessionRow,
  AssessmentRevisionRow,
  AssessmentResponseRow,
  SupportEventRow,
  SupportResourceRow,
  ResourceRow,
} from "./schema";

function db(): Database.Database {
  return getDb();
}

function rows<T>(stmt: Database.Statement, ...params: unknown[]): T[] {
  return stmt.all(...params) as T[];
}

function one<T>(stmt: Database.Statement, ...params: unknown[]): T | null {
  const r = stmt.get(...params);
  return (r ?? null) as T | null;
}

// ---------- resource ----------

export const ResourceRepo = {
  insert(row: ResourceRow) {
    db()
      .prepare(
        `INSERT INTO resource_${row.resource_type.toLowerCase() === "fact" ? "fact" : row.resource_type.toLowerCase()} (id, resource_id, owner_case_id, owner_patient_id, sensitivity, retention_class, created_at, created_by, deleted_at, schema_version)
         VALUES (@id, @resource_id, @owner_case_id, @owner_patient_id, @sensitivity, @retention_class, @created_at, @created_by, @deleted_at, @schema_version)`,
      )
      .run(row);
  },
};

// We avoid an extra "resource" table in this demo and encode the sensitivity
// directly on the fact/artifact rows. A "registry" join view is implemented
// in code. This keeps the SQLite footprint small while preserving the
// Resource registry semantics required by the architecture.

export const _resource = {
  forFact(revisionId: string): { resourceId: string; caseId: string; sensitivity: "GENERAL" | "RESTRICTED_WELLBEING" | "QUARANTINED" } | null {
    const fact = one<FactRow>(db().prepare("SELECT * FROM fact WHERE current_revision_id = ?"), revisionId);
    if (!fact) return null;
    if (fact.kind === "WELLBEING") return { resourceId: fact.resource_id, caseId: fact.case_id, sensitivity: "RESTRICTED_WELLBEING" };
    return { resourceId: fact.resource_id, caseId: fact.case_id, sensitivity: "GENERAL" };
  },
  forSource(id: string): { resourceId: string; caseId: string; sensitivity: "GENERAL" | "RESTRICTED_WELLBEING" | "QUARANTINED" } | null {
    const src = one<SourceArtifactRow>(db().prepare("SELECT * FROM source_artifact WHERE id = ?"), id);
    if (!src) return null;
    return { resourceId: src.resource_id, caseId: src.case_id, sensitivity: src.state === "QUARANTINED" ? "QUARANTINED" : "GENERAL" };
  },
};

// ---------- user / session / auth ----------

export const UserRepo = {
  byAuthSubject(subject: string): UserRow | null {
    return one<UserRow>(db().prepare("SELECT * FROM user WHERE auth_subject = ?"), subject);
  },
  byId(id: string): UserRow | null {
    return one<UserRow>(db().prepare("SELECT * FROM user WHERE id = ?"), id);
  },
  insert(row: UserRow) {
    db()
      .prepare(
        `INSERT INTO user (id, auth_subject, role, display_name, locale, disabled_at, password_hash, created_at)
         VALUES (@id, @auth_subject, @role, @display_name, @locale, @disabled_at, @password_hash, @created_at)`,
      )
      .run(row);
  },
  all(): UserRow[] {
    return rows<UserRow>(db().prepare("SELECT * FROM user ORDER BY created_at"));
  },
};

export const SessionRepo = {
  create(row: SessionRow) {
    db()
      .prepare(
        `INSERT INTO session (id, user_id, expires_at, purpose, created_at) VALUES (@id, @user_id, @expires_at, @purpose, @created_at)`,
      )
      .run(row);
  },
  byId(id: string): SessionRow | null {
    return one<SessionRow>(db().prepare("SELECT * FROM session WHERE id = ? AND expires_at > datetime('now')"), id);
  },
  delete(id: string) {
    db().prepare("DELETE FROM session WHERE id = ?").run(id);
  },
  forUser(userId: string): SessionRow[] {
    return rows<SessionRow>(db().prepare("SELECT * FROM session WHERE user_id = ? AND expires_at > datetime('now')"), userId);
  },
};

export const ClinicianProfileRepo = {
  byId(userId: string): ClinicianProfileRow | null {
    return one<ClinicianProfileRow>(db().prepare("SELECT * FROM clinician_profile WHERE user_id = ?"), userId);
  },
  insert(row: ClinicianProfileRow) {
    db()
      .prepare(
        `INSERT INTO clinician_profile (user_id, display_name, verification_state, verification_evidence_ref)
         VALUES (@user_id, @display_name, @verification_state, @verification_evidence_ref)`,
      )
      .run(row);
  },
};

export const PatientRepo = {
  byId(id: string): PatientRow | null {
    return one<PatientRow>(db().prepare("SELECT * FROM patient WHERE id = ?"), id);
  },
  byOwner(ownerUserId: string): PatientRow | null {
    return one<PatientRow>(db().prepare("SELECT * FROM patient WHERE owner_user_id = ?"), ownerUserId);
  },
  insert(row: PatientRow) {
    db()
      .prepare(
        `INSERT INTO patient (id, owner_user_id, display_name, birth_year, date_precision, preferred_language, synthetic)
         VALUES (@id, @owner_user_id, @display_name, @birth_year, @date_precision, @preferred_language, @synthetic)`,
      )
      .run(row);
  },
};

// ---------- case / encounter / provider ----------

export const CaseRepo = {
  insert(row: CaseRow) {
    db()
      .prepare(
        `INSERT INTO "case" (id, patient_id, context_version, privacy_epoch, synthetic, status, created_at, updated_at, created_by)
         VALUES (@id, @patient_id, @context_version, @privacy_epoch, @synthetic, @status, @created_at, @updated_at, @created_by)`,
      )
      .run(row);
  },
  byId(id: string): CaseRow | null {
    return one<CaseRow>(db().prepare('SELECT * FROM "case" WHERE id = ?'), id);
  },
  byPatient(patientId: string): CaseRow[] {
    return rows<CaseRow>(db().prepare('SELECT * FROM "case" WHERE patient_id = ? ORDER BY created_at'), patientId);
  },
  advanceContext(id: string, epoch: number) {
    db()
      .prepare('UPDATE "case" SET context_version = context_version + 1, updated_at = datetime(\'now\') WHERE id = ?')
      .run(id);
    db().prepare('UPDATE "case" SET privacy_epoch = ? WHERE id = ?').run(epoch, id);
  },
  bumpPrivacyEpoch(id: string) {
    db().prepare('UPDATE "case" SET privacy_epoch = privacy_epoch + 1, updated_at = datetime(\'now\') WHERE id = ?').run(id);
  },
};

export const ProviderRepo = {
  insert(row: ProviderRow) {
    db()
      .prepare(
        `INSERT INTO provider (id, case_id, display_name, specialty_as_documented, source_anchor_id)
         VALUES (@id, @case_id, @display_name, @specialty_as_documented, @source_anchor_id)`,
      )
      .run(row);
  },
  byId(id: string): ProviderRow | null {
    return one<ProviderRow>(db().prepare("SELECT * FROM provider WHERE id = ?"), id);
  },
};

export const EncounterRepo = {
  insert(row: EncounterRow) {
    db()
      .prepare(
        `INSERT INTO encounter (id, case_id, provider_id, event_date, date_precision, kind, status, created_at)
         VALUES (@id, @case_id, @provider_id, @event_date, @date_precision, @kind, @status, @created_at)`,
      )
      .run(row);
  },
  byId(id: string): EncounterRow | null {
    return one<EncounterRow>(db().prepare("SELECT * FROM encounter WHERE id = ?"), id);
  },
  forCase(caseId: string): EncounterRow[] {
    return rows<EncounterRow>(db().prepare("SELECT * FROM encounter WHERE case_id = ? ORDER BY event_date DESC"), caseId);
  },
};

// ---------- consent / grant / share ----------

export const ConsentRepo = {
  insert(row: ConsentRow) {
    db()
      .prepare(
        `INSERT INTO consent (id, case_id, patient_id, actor_id, purpose, wording_version, understanding_check_passed, decision, valid_from, revoked_at, supersedes_id, metadata)
         VALUES (@id, @case_id, @patient_id, @actor_id, @purpose, @wording_version, @understanding_check_passed, @decision, @valid_from, @revoked_at, @supersedes_id, @metadata)`,
      )
      .run(row);
  },
  byId(id: string): ConsentRow | null {
    return one<ConsentRow>(db().prepare('SELECT * FROM consent WHERE id = ?'), id);
  },
  activeFor(caseId: string, purpose: string): ConsentRow | null {
    return one<ConsentRow>(
      db().prepare('SELECT * FROM consent WHERE case_id = ? AND purpose = ? AND revoked_at IS NULL ORDER BY valid_from DESC LIMIT 1'),
      caseId,
      purpose,
    );
  },
  revoke(id: string) {
    db().prepare("UPDATE consent SET revoked_at = datetime('now') WHERE id = ?").run(id);
  },
};

export const GrantRepo = {
  insert(row: GrantRow) {
    db()
      .prepare(
        `INSERT INTO grant (id, case_id, patient_id, recipient_user_id, kind, purpose, consent_id, starts_at, expires_at, revoked_at, export_allowed, version, preview_hash, source_closure_hash)
         VALUES (@id, @case_id, @patient_id, @recipient_user_id, @kind, @purpose, @consent_id, @starts_at, @expires_at, @revoked_at, @export_allowed, @version, @preview_hash, @source_closure_hash)`,
      )
      .run(row);
  },
  byId(id: string): GrantRow | null {
    return one<GrantRow>(db().prepare("SELECT * FROM grant WHERE id = ?"), id);
  },
  activeFor(caseId: string, recipientUserId: string | null, kind: GrantRow["kind"]): GrantRow[] {
    return rows<GrantRow>(
      db().prepare(
        "SELECT * FROM grant WHERE case_id = ? AND (recipient_user_id IS NULL OR recipient_user_id = ?) AND kind = ? AND revoked_at IS NULL AND expires_at > datetime('now')",
      ),
      caseId,
      recipientUserId,
      kind,
    );
  },
  forCase(caseId: string): GrantRow[] {
    return rows<GrantRow>(db().prepare("SELECT * FROM grant WHERE case_id = ? ORDER BY starts_at DESC"), caseId);
  },
  revoke(id: string) {
    db().prepare("UPDATE grant SET revoked_at = datetime('now') WHERE id = ?").run(id);
  },
};

export const GrantResourceRepo = {
  insert(row: GrantResourceRow) {
    db()
      .prepare(
        `INSERT INTO grant_resource (id, grant_id, resource_id, field_paths, source_closure_hash)
         VALUES (@id, @grant_id, @resource_id, @field_paths, @source_closure_hash)`,
      )
      .run(row);
  },
  forGrant(grantId: string): GrantResourceRow[] {
    return rows<GrantResourceRow>(db().prepare("SELECT * FROM grant_resource WHERE grant_id = ?"), grantId);
  },
};

export const ShareLinkRepo = {
  insert(row: ShareLinkRow) {
    db()
      .prepare(
        `INSERT INTO share_link (id, grant_id, token_hash, expires_at, revoked_at, redeemed_at, session_hash)
         VALUES (@id, @grant_id, @token_hash, @expires_at, @revoked_at, @redeemed_at, @session_hash)`,
      )
      .run(row);
  },
  byTokenHash(tokenHash: string): ShareLinkRow | null {
    return one<ShareLinkRow>(db().prepare("SELECT * FROM share_link WHERE token_hash = ?"), tokenHash);
  },
  redeem(id: string, sessionHash: string) {
    db().prepare("UPDATE share_link SET redeemed_at = datetime('now'), session_hash = ? WHERE id = ?").run(sessionHash, id);
  },
};

// ---------- source artifacts ----------

export const SourceArtifactRepo = {
  insert(row: SourceArtifactRow) {
    db()
      .prepare(
        `INSERT INTO source_artifact (id, resource_id, case_id, kind, object_key, content_hash, mime_type, size_bytes, filename_safe, source_payload, respondent_id, respondent_role, captured_at, event_date, consent_id, question_id, transcript_of_id, deletion_due_at, state)
         VALUES (@id, @resource_id, @case_id, @kind, @object_key, @content_hash, @mime_type, @size_bytes, @filename_safe, @source_payload, @respondent_id, @respondent_role, @captured_at, @event_date, @consent_id, @question_id, @transcript_of_id, @deletion_due_at, @state)`,
      )
      .run(row);
  },
  byId(id: string): SourceArtifactRow | null {
    return one<SourceArtifactRow>(db().prepare("SELECT * FROM source_artifact WHERE id = ?"), id);
  },
  forCase(caseId: string): SourceArtifactRow[] {
    return rows<SourceArtifactRow>(db().prepare("SELECT * FROM source_artifact WHERE case_id = ? ORDER BY captured_at DESC"), caseId);
  },
  updateState(id: string, state: SourceArtifactRow["state"]) {
    db().prepare("UPDATE source_artifact SET state = ? WHERE id = ?").run(state, id);
  },
};

export const DocumentPageRepo = {
  insert(row: DocumentPageRow) {
    db()
      .prepare(
        `INSERT INTO document_page (id, source_artifact_id, page_number, width_px, height_px, rotation, image_hash, object_key)
         VALUES (@id, @source_artifact_id, @page_number, @width_px, @height_px, @rotation, @image_hash, @object_key)`,
      )
      .run(row);
  },
  forSource(sourceId: string): DocumentPageRow[] {
    return rows<DocumentPageRow>(db().prepare("SELECT * FROM document_page WHERE source_artifact_id = ? ORDER BY page_number"), sourceId);
  },
};

export const EvidenceAnchorRepo = {
  insert(row: EvidenceAnchorRow) {
    // Idempotent: if an anchor with this id already exists, skip.
    const existing = one<EvidenceAnchorRow>(db().prepare("SELECT id FROM evidence_anchor WHERE id = ?"), row.id);
    if (existing) return;
    db()
      .prepare(
        `INSERT INTO evidence_anchor (id, resource_id, source_artifact_id, page_id, bbox, text_start, text_end, audio_start_ms, audio_end_ms, quote_original, source_version_hash)
         VALUES (@id, @resource_id, @source_artifact_id, @page_id, @bbox, @text_start, @text_end, @audio_start_ms, @audio_end_ms, @quote_original, @source_version_hash)`,
      )
      .run(row);
  },
  byId(id: string): EvidenceAnchorRow | null {
    return one<EvidenceAnchorRow>(db().prepare("SELECT * FROM evidence_anchor WHERE id = ?"), id);
  },
  forSource(sourceId: string): EvidenceAnchorRow[] {
    return rows<EvidenceAnchorRow>(db().prepare("SELECT * FROM evidence_anchor WHERE source_artifact_id = ?"), sourceId);
  },
  forResource(resourceId: string): EvidenceAnchorRow[] {
    return rows<EvidenceAnchorRow>(db().prepare("SELECT * FROM evidence_anchor WHERE resource_id = ?"), resourceId);
  },
};

export const ProcessingRunRepo = {
  insert(row: { id: string; source_id: string | null; stage: string; adapter: string; provider: string | null; model_id: string | null; prompt_version: string | null; schema_version: string; input_hash: string; output_resource_id: string | null; dictionary_version: string | null; policy_fingerprint: string; privacy_epoch: number }) {
    db()
      .prepare(
        `INSERT INTO processing_run (id, source_id, stage, adapter, provider, model_id, prompt_version, schema_version, input_hash, output_resource_id, dictionary_version, policy_fingerprint, privacy_epoch, status)
         VALUES (@id, @source_id, @stage, @adapter, @provider, @model_id, @prompt_version, @schema_version, @input_hash, @output_resource_id, @dictionary_version, @policy_fingerprint, @privacy_epoch, 'RUNNING')`,
      )
      .run(row);
  },
  finish(id: string, status: "SUCCEEDED" | "PARTIAL" | "FAILED", errorCode: string | null, latencyMs: number) {
    db()
      .prepare(
        "UPDATE processing_run SET status = ?, error_code = ?, latency_ms = ?, finished_at = datetime('now') WHERE id = ?",
      )
      .run(status, errorCode, latencyMs, id);
  },
};

// ---------- facts / claims ----------

export const FactRepo = {
  insert(row: FactRow) {
    db()
      .prepare(
        `INSERT INTO fact (id, resource_id, case_id, kind, current_revision_id, logical_key)
         VALUES (@id, @resource_id, @case_id, @kind, @current_revision_id, @logical_key)`,
      )
      .run(row);
  },
  setCurrentRevision(factId: string, revisionId: string) {
    db().prepare("UPDATE fact SET current_revision_id = ? WHERE id = ?").run(revisionId, factId);
  },
  byId(id: string): FactRow | null {
    return one<FactRow>(db().prepare("SELECT * FROM fact WHERE id = ?"), id);
  },
  forCase(caseId: string): FactRow[] {
    return rows<FactRow>(db().prepare("SELECT * FROM fact WHERE case_id = ? ORDER BY created_at"), caseId);
  },
};

export const FactRevisionRepo = {
  insert(row: FactRevisionRow) {
    db()
      .prepare(
        `INSERT INTO fact_revision (id, resource_id, fact_id, revision_no, raw_representation, normalized_payload, event_date, date_precision, origin_kind, processing_state, review_state, validity_state, confidence_by_stage, author_id, supersedes_revision_id, created_at)
         VALUES (@id, @resource_id, @fact_id, @revision_no, @raw_representation, @normalized_payload, @event_date, @date_precision, @origin_kind, @processing_state, @review_state, @validity_state, @confidence_by_stage, @author_id, @supersedes_revision_id, @created_at)`,
      )
      .run(row);
  },
  byId(id: string): FactRevisionRow | null {
    return one<FactRevisionRow>(db().prepare("SELECT * FROM fact_revision WHERE id = ?"), id);
  },
  forFact(factId: string): FactRevisionRow[] {
    return rows<FactRevisionRow>(db().prepare("SELECT * FROM fact_revision WHERE fact_id = ? ORDER BY revision_no"), factId);
  },
  setReviewState(id: string, state: FactRevisionRow["review_state"]) {
    db().prepare("UPDATE fact_revision SET review_state = ? WHERE id = ?").run(state, id);
  },
  setValidityState(id: string, state: FactRevisionRow["validity_state"]) {
    db().prepare("UPDATE fact_revision SET validity_state = ? WHERE id = ?").run(state, id);
  },
};

export const MedicationClaimRepo = {
  insert(row: MedicationClaimRow) {
    db()
      .prepare(
        `INSERT INTO medication_claim (fact_revision_id, product_id, brand, manufacturer, ingredient_ids, ingredient_names, strength_value, strength_unit, form, route, dose_raw, frequency_raw, parsed_schedule, duration_raw, evidence_kind, claimed_lifecycle, effective_start, effective_end, provider_id, unknown_reason)
         VALUES (@fact_revision_id, @product_id, @brand, @manufacturer, @ingredient_ids, @ingredient_names, @strength_value, @strength_unit, @form, @route, @dose_raw, @frequency_raw, @parsed_schedule, @duration_raw, @evidence_kind, @claimed_lifecycle, @effective_start, @effective_end, @provider_id, @unknown_reason)`,
      )
      .run(row);
  },
  byFactRevision(id: string): MedicationClaimRow | null {
    return one<MedicationClaimRow>(db().prepare("SELECT * FROM medication_claim WHERE fact_revision_id = ?"), id);
  },
  forCase(caseId: string): MedicationClaimRow[] {
    return rows<MedicationClaimRow>(
      db().prepare(
        `SELECT mc.* FROM medication_claim mc
         JOIN fact_revision fr ON fr.id = mc.fact_revision_id
         JOIN fact f ON f.id = fr.fact_id
         WHERE f.case_id = ?`,
      ),
      caseId,
    );
  },
  admittedForCase(caseId: string): { revision: FactRevisionRow; claim: MedicationClaimRow }[] {
    const rows = db()
      .prepare(
        `SELECT fr.*, mc.fact_revision_id as mc_id FROM fact_revision fr
         JOIN fact f ON f.id = fr.fact_id
         JOIN medication_claim mc ON mc.fact_revision_id = fr.id
         WHERE f.case_id = ? AND f.kind = 'MEDICATION'
           AND fr.review_state != 'REJECTED'
         ORDER BY fr.event_date`,
      )
      .all(caseId) as (FactRevisionRow & { mc_id: string })[];
    return rows.map((r) => ({
      revision: r,
      claim: MedicationClaimRepo.byFactRevision(r.id)!,
    })).filter((r) => r.claim);
  },
};

export const LabObservationRepo = {
  insert(row: LabObservationRow) {
    db()
      .prepare(
        `INSERT INTO lab_observation (fact_revision_id, lab_definition_id, analyte, original_test, original_value, original_unit, original_range, normalized_decimal, normalized_unit, conversion_version, method, specimen, laboratory, result_date, date_precision)
         VALUES (@fact_revision_id, @lab_definition_id, @analyte, @original_test, @original_value, @original_unit, @original_range, @normalized_decimal, @normalized_unit, @conversion_version, @method, @specimen, @laboratory, @result_date, @date_precision)`,
      )
      .run(row);
  },
  byFactRevision(id: string): LabObservationRow | null {
    return one<LabObservationRow>(db().prepare("SELECT * FROM lab_observation WHERE fact_revision_id = ?"), id);
  },
  forCase(caseId: string): LabObservationRow[] {
    return rows<LabObservationRow>(
      db().prepare(
        `SELECT lo.* FROM lab_observation lo
         JOIN fact_revision fr ON fr.id = lo.fact_revision_id
         JOIN fact f ON f.id = fr.fact_id
         WHERE f.case_id = ?
         ORDER BY lo.result_date`,
      ),
      caseId,
    );
  },
};

export const TestOrderRepo = {
  insert(row: TestOrderRow) {
    db()
      .prepare(
        `INSERT INTO test_order (fact_revision_id, lab_definition_id, test_name, instruction_raw, ordered_date, encounter_id)
         VALUES (@fact_revision_id, @lab_definition_id, @test_name, @instruction_raw, @ordered_date, @encounter_id)`,
      )
      .run(row);
  },
  forCase(caseId: string): TestOrderRow[] {
    return rows<TestOrderRow>(
      db().prepare(
        `SELECT to2.* FROM test_order to2
         JOIN fact_revision fr ON fr.id = to2.fact_revision_id
         JOIN fact f ON f.id = fr.fact_id
         WHERE f.case_id = ?`,
      ),
      caseId,
    );
  },
};

export const OrderResultLinkRepo = {
  insert(row: OrderResultLinkRow) {
    db()
      .prepare(
        `INSERT INTO order_result_link (id, order_revision_id, result_revision_id, relation, match_method, review_action_id)
         VALUES (@id, @order_revision_id, @result_revision_id, @relation, @match_method, @review_action_id)`,
      )
      .run(row);
  },
  forOrder(orderId: string): OrderResultLinkRow[] {
    return rows<OrderResultLinkRow>(db().prepare("SELECT * FROM order_result_link WHERE order_revision_id = ?"), orderId);
  },
};

export const ContextSnapshotRepo = {
  upsert(row: { resource_id: string; context_version: number; audience_fingerprint: string; source_revision_ids: string; medication_projection: string; privacy_epoch: number }) {
    db()
      .prepare(
        `INSERT OR REPLACE INTO context_snapshot (resource_id, context_version, audience_fingerprint, source_revision_ids, medication_projection, generated_at, privacy_epoch, state)
         VALUES (@resource_id, @context_version, @audience_fingerprint, @source_revision_ids, @medication_projection, datetime('now'), @privacy_epoch, 'CURRENT')`,
      )
      .run(row);
  },
  latestFor(caseId: string, audienceFingerprint: string): { resource_id: string; context_version: number; medication_projection: string } | null {
    const r = one<{ resource_id: string; context_version: number; medication_projection: string }>(
      db().prepare(
        `SELECT cs.resource_id, cs.context_version, cs.medication_projection FROM context_snapshot cs
         JOIN fact f ON f.resource_id = cs.resource_id
         WHERE f.case_id = ? AND cs.audience_fingerprint = ?
         ORDER BY cs.context_version DESC LIMIT 1`,
      ),
      caseId,
      audienceFingerprint,
    );
    return r;
  },
};

// ---------- issues / interview / questions ----------

export const IssueRepo = {
  insert(row: IssueRow) {
    db()
      .prepare(
        `INSERT INTO issue (id, resource_id, case_id, kind, type, rule_id, rule_version, signature, context_version, audience_fingerprint, priority, uncertainty_codes, status, claim_revision_ids, summary, doctor_only, created_at, updated_at)
         VALUES (@id, @resource_id, @case_id, @kind, @type, @rule_id, @rule_version, @signature, @context_version, @audience_fingerprint, @priority, @uncertainty_codes, @status, @claim_revision_ids, @summary, @doctor_only, @created_at, @updated_at)`,
      )
      .run(row);
  },
  clearOpenFor(caseId: string, contextVersion: number) {
    db()
      .prepare("UPDATE issue SET status = 'STALE' WHERE case_id = ? AND context_version < ? AND status IN ('OPEN')")
      .run(caseId, contextVersion);
  },
  forCase(caseId: string): IssueRow[] {
    return rows<IssueRow>(db().prepare("SELECT * FROM issue WHERE case_id = ? ORDER BY priority, created_at"), caseId);
  },
  byId(id: string): IssueRow | null {
    return one<IssueRow>(db().prepare("SELECT * FROM issue WHERE id = ?"), id);
  },
  updateStatus(id: string, status: string) {
    db()
      .prepare("UPDATE issue SET status = ?, updated_at = datetime('now') WHERE id = ?")
      .run(status, id);
  },
};

export const InterviewRepo = {
  insert(row: InterviewRow) {
    db()
      .prepare(
        `INSERT INTO interview (id, case_id, respondent_id, role, language, budget, context_version, status, stop_reason, visited_question_ids, created_at, updated_at)
         VALUES (@id, @case_id, @respondent_id, @role, @language, @budget, @context_version, @status, @stop_reason, @visited_question_ids, @created_at, @updated_at)`,
      )
      .run(row);
  },
  byId(id: string): InterviewRow | null {
    return one<InterviewRow>(db().prepare("SELECT * FROM interview WHERE id = ?"), id);
  },
  forCase(caseId: string): InterviewRow[] {
    return rows<InterviewRow>(db().prepare("SELECT * FROM interview WHERE case_id = ? ORDER BY created_at DESC"), caseId);
  },
  updateStatus(id: string, status: InterviewRow["status"], stopReason: string | null) {
    db()
      .prepare(
        "UPDATE interview SET status = ?, stop_reason = ?, updated_at = datetime('now') WHERE id = ?",
      )
      .run(status, stopReason, id);
  },
};

export const QuestionRepo = {
  insert(row: QuestionRow) {
    db()
      .prepare(
        `INSERT INTO question (id, resource_id, interview_id, target_issue_ids, template_id, template_version, language, text, response_type, options, allows_unknown, allows_skip, stop_conditions, asked_at, answered_input_id, disposition)
         VALUES (@id, @resource_id, @interview_id, @target_issue_ids, @template_id, @template_version, @language, @text, @response_type, @options, @allows_unknown, @allows_skip, @stop_conditions, @asked_at, @answered_input_id, @disposition)`,
      )
      .run(row);
  },
  byId(id: string): QuestionRow | null {
    return one<QuestionRow>(db().prepare("SELECT * FROM question WHERE id = ?"), id);
  },
  forInterview(interviewId: string): QuestionRow[] {
    return rows<QuestionRow>(db().prepare("SELECT * FROM question WHERE interview_id = ? ORDER BY asked_at"), interviewId);
  },
  updateDisposition(id: string, disposition: QuestionRow["disposition"], inputId: string | null) {
    db()
      .prepare("UPDATE question SET disposition = ?, answered_input_id = ? WHERE id = ?")
      .run(disposition, inputId, id);
  },
  markAsked(id: string) {
    db().prepare("UPDATE question SET asked_at = datetime('now'), disposition = 'ASKED' WHERE id = ?").run(id);
  },
};

// ---------- brief / visit update ----------

export const BriefRepo = {
  insert(row: BriefRow) {
    db()
      .prepare(
        `INSERT INTO brief (id, resource_id, case_id, context_version, audience_fingerprint, grant_ids, privacy_epoch, composition_version, generated_at, status, export_artifact_id)
         VALUES (@id, @resource_id, @case_id, @context_version, @audience_fingerprint, @grant_ids, @privacy_epoch, @composition_version, @generated_at, @status, @export_artifact_id)`,
      )
      .run(row);
  },
  byId(id: string): BriefRow | null {
    return one<BriefRow>(db().prepare("SELECT * FROM brief WHERE id = ?"), id);
  },
  forCase(caseId: string): BriefRow[] {
    return rows<BriefRow>(db().prepare("SELECT * FROM brief WHERE case_id = ? ORDER BY generated_at DESC"), caseId);
  },
};

export const BriefItemRepo = {
  insert(row: BriefItemRow) {
    db()
      .prepare(
        `INSERT INTO brief_item (id, resource_id, brief_id, section, rank, kind, text, why_code, status_labels, structured_payload, fact_revision_ids, evidence_anchor_ids)
         VALUES (@id, @resource_id, @brief_id, @section, @rank, @kind, @text, @why_code, @status_labels, @structured_payload, @fact_revision_ids, @evidence_anchor_ids)`,
      )
      .run(row);
  },
  forBrief(briefId: string): BriefItemRow[] {
    return rows<BriefItemRow>(
      db().prepare("SELECT * FROM brief_item WHERE brief_id = ? ORDER BY section, rank"),
      briefId,
    );
  },
};

export const VisitUpdateRepo = {
  insert(row: VisitUpdateRow) {
    db()
      .prepare(
        `INSERT INTO visit_update (id, resource_id, case_id, encounter_id, base_context_version, proposal_version, privacy_epoch, state, committed_at, committed_by)
         VALUES (@id, @resource_id, @case_id, @encounter_id, @base_context_version, @proposal_version, @privacy_epoch, @state, @committed_at, @committed_by)`,
      )
      .run(row);
  },
  byId(id: string): VisitUpdateRow | null {
    return one<VisitUpdateRow>(db().prepare("SELECT * FROM visit_update WHERE id = ?"), id);
  },
  forEncounter(encounterId: string): VisitUpdateRow[] {
    return rows<VisitUpdateRow>(db().prepare("SELECT * FROM visit_update WHERE encounter_id = ? ORDER BY proposal_version DESC"), encounterId);
  },
  updateState(id: string, state: VisitUpdateRow["state"], committedBy?: string) {
    if (state === "COMMITTED" && committedBy) {
      db()
        .prepare(
          "UPDATE visit_update SET state = ?, committed_at = datetime('now'), committed_by = ? WHERE id = ?",
        )
        .run(state, committedBy, id);
    } else {
      db().prepare("UPDATE visit_update SET state = ? WHERE id = ?").run(state, id);
    }
  },
};

export const UpdateItemRepo = {
  insert(row: UpdateItemRow) {
    db()
      .prepare(
        `INSERT INTO update_item (id, resource_id, update_id, revision, operation, before_payload, proposed_after_payload, target_fact_id, status)
         VALUES (@id, @resource_id, @update_id, @revision, @operation, @before_payload, @proposed_after_payload, @target_fact_id, @status)`,
      )
      .run(row);
  },
  forUpdate(updateId: string): UpdateItemRow[] {
    return rows<UpdateItemRow>(db().prepare("SELECT * FROM update_item WHERE update_id = ? ORDER BY rowid"), updateId);
  },
  updateStatus(id: string, status: UpdateItemRow["status"]) {
    db().prepare("UPDATE update_item SET status = ? WHERE id = ?").run(status, id);
  },
};

// ---------- review actions / audit ----------

export const ReviewActionRepo = {
  insert(row: ReviewActionRow) {
    db()
      .prepare(
        `INSERT INTO review_action (id, resource_id, target_resource_id, target_revision, actor_id, actor_role, action, correction_payload, reason, authored_source_id, acted_at)
         VALUES (@id, @resource_id, @target_resource_id, @target_revision, @actor_id, @actor_role, @action, @correction_payload, @reason, @authored_source_id, @acted_at)`,
      )
      .run(row);
  },
  forResource(resourceId: string): ReviewActionRow[] {
    return rows<ReviewActionRow>(db().prepare("SELECT * FROM review_action WHERE target_resource_id = ? ORDER BY acted_at"), resourceId);
  },
};

export const MedicationEventRepo = {
  insert(row: MedicationEventRow) {
    db()
      .prepare(
        `INSERT INTO medication_event (id, resource_id, encounter_id, medication_fact_id, event_kind, before_claim_id, after_claim_id, review_action_id, reason_fact_revision_id, effective_date, date_precision)
         VALUES (@id, @resource_id, @encounter_id, @medication_fact_id, @event_kind, @before_claim_id, @after_claim_id, @review_action_id, @reason_fact_revision_id, @effective_date, @date_precision)`,
      )
      .run(row);
  },
  forCase(caseId: string): MedicationEventRow[] {
    return rows<MedicationEventRow>(
      db().prepare(
        `SELECT me.* FROM medication_event me
         JOIN fact f ON f.id = me.medication_fact_id
         WHERE f.case_id = ?
         ORDER BY me.effective_date`,
      ),
      caseId,
    );
  },
};

export const AuditRepo = {
  insert(row: AuditEventRow) {
    db()
      .prepare(
        `INSERT INTO audit_event (id, case_id, actor_or_service_id, action, target_resource_id, outcome, request_id, policy_version, occurred_at, prior_version, new_version)
         VALUES (@id, @case_id, @actor_or_service_id, @action, @target_resource_id, @outcome, @request_id, @policy_version, @occurred_at, @prior_version, @new_version)`,
      )
      .run(row);
  },
  forCase(caseId: string): AuditEventRow[] {
    return rows<AuditEventRow>(db().prepare("SELECT * FROM audit_event WHERE case_id = ? ORDER BY occurred_at"), caseId);
  },
};

// ---------- wellbeing / assessment / support ----------

export const WellbeingRepo = {
  insert(row: WellbeingEntryRow) {
    db()
      .prepare(
        `INSERT INTO wellbeing_entry (fact_revision_id, resource_id, case_id, respondent_id, original_input_id, topic_selected, onset, date_precision, original_wording, confirmed_summary, request_discussion, presentation_preference, confirmation_at)
         VALUES (@fact_revision_id, @resource_id, @case_id, @respondent_id, @original_input_id, @topic_selected, @onset, @date_precision, @original_wording, @confirmed_summary, @request_discussion, @presentation_preference, @confirmation_at)`,
      )
      .run(row);
  },
  forCase(caseId: string): WellbeingEntryRow[] {
    return rows<WellbeingEntryRow>(db().prepare("SELECT * FROM wellbeing_entry WHERE case_id = ? ORDER BY confirmation_at DESC"), caseId);
  },
};

export const InstrumentDefinitionRepo = {
  insert(row: InstrumentDefinitionRow) {
    db()
      .prepare(
        `INSERT INTO instrument_definition (id, instrument_key, definition_version, language, source_url, source_file_hash, content_checksum, rights_metadata, attribution, timeframe, scoring_version, activation_status, content_reviewer, reviewed_at)
         VALUES (@id, @instrument_key, @definition_version, @language, @source_url, @source_file_hash, @content_checksum, @rights_metadata, @attribution, @timeframe, @scoring_version, @activation_status, @content_reviewer, @reviewed_at)`,
      )
      .run(row);
  },
  byKey(key: string, language: "bn" | "en"): InstrumentDefinitionRow | null {
    return one<InstrumentDefinitionRow>(
      db().prepare("SELECT * FROM instrument_definition WHERE instrument_key = ? AND language = ?"),
      key,
      language,
    );
  },
};

export const InstrumentItemRepo = {
  insert(row: { id: string; definition_id: string; item_key: string; ordinal: number; exact_text: string; exact_options_json: string; value_min: number; value_max: number }) {
    db()
      .prepare(
        `INSERT INTO instrument_item (id, definition_id, item_key, ordinal, exact_text, exact_options_json, value_min, value_max)
         VALUES (@id, @definition_id, @item_key, @ordinal, @exact_text, @exact_options_json, @value_min, @value_max)`,
      )
      .run(row);
  },
  forDefinition(definitionId: string) {
    return rows<{ id: string; item_key: string; ordinal: number; exact_text: string; exact_options_json: string }>(
      db().prepare("SELECT * FROM instrument_item WHERE definition_id = ? ORDER BY ordinal"),
      definitionId,
    );
  },
};

export const AssessmentSessionRepo = {
  insert(row: AssessmentSessionRow) {
    db()
      .prepare(
        `INSERT INTO assessment_session (id, resource_id, definition_id, case_id, patient_id, respondent_id, consent_id, administration_mode, current_revision, started_at, submitted_at, completion_state)
         VALUES (@id, @resource_id, @definition_id, @case_id, @patient_id, @respondent_id, @consent_id, @administration_mode, @current_revision, @started_at, @submitted_at, @completion_state)`,
      )
      .run(row);
  },
  byId(id: string): AssessmentSessionRow | null {
    return one<AssessmentSessionRow>(db().prepare("SELECT * FROM assessment_session WHERE id = ?"), id);
  },
  forCase(caseId: string): AssessmentSessionRow[] {
    return rows<AssessmentSessionRow>(db().prepare("SELECT * FROM assessment_session WHERE case_id = ? ORDER BY started_at DESC"), caseId);
  },
  updateState(id: string, state: AssessmentSessionRow["completion_state"], submittedAt: string | null = null) {
    if (submittedAt) {
      db()
        .prepare(
          "UPDATE assessment_session SET completion_state = ?, submitted_at = ?, current_revision = current_revision + 1 WHERE id = ?",
        )
        .run(state, submittedAt, id);
    } else {
      db()
        .prepare("UPDATE assessment_session SET completion_state = ? WHERE id = ?")
        .run(state, id);
    }
  },
};

export const AssessmentRevisionRepo = {
  insert(row: AssessmentRevisionRow) {
    db()
      .prepare(
        `INSERT INTO assessment_revision (id, resource_id, session_id, revision_no, definition_checksum, response_hash, scoring_version, raw_total, transformed_score, submitted_at, scored_at, supersedes_id)
         VALUES (@id, @resource_id, @session_id, @revision_no, @definition_checksum, @response_hash, @scoring_version, @raw_total, @transformed_score, @submitted_at, @scored_at, @supersedes_id)`,
      )
      .run(row);
  },
  forSession(sessionId: string): AssessmentRevisionRow[] {
    return rows<AssessmentRevisionRow>(db().prepare("SELECT * FROM assessment_revision WHERE session_id = ? ORDER BY revision_no"), sessionId);
  },
};

export const AssessmentResponseRepo = {
  insert(row: AssessmentResponseRow) {
    db()
      .prepare(
        `INSERT INTO assessment_response (id, assessment_revision_id, item_id, value, disposition, confirmed_at, source_input_id)
         VALUES (@id, @assessment_revision_id, @item_id, @value, @disposition, @confirmed_at, @source_input_id)`,
      )
      .run(row);
  },
  forRevision(revisionId: string): AssessmentResponseRow[] {
    return rows<AssessmentResponseRow>(db().prepare("SELECT * FROM assessment_response WHERE assessment_revision_id = ?"), revisionId);
  },
};

export const SupportEventRepo = {
  insert(row: SupportEventRow) {
    db()
      .prepare(
        `INSERT INTO support_event (id, resource_id, case_id, evidence_resource_id, protocol_version, observation_type, presentation_state, handoff_state, shown_at, grant_id, recipient_id, monitoring_available, last_transition_at)
         VALUES (@id, @resource_id, @case_id, @evidence_resource_id, @protocol_version, @observation_type, @presentation_state, @handoff_state, @shown_at, @grant_id, @recipient_id, @monitoring_available, @last_transition_at)`,
      )
      .run(row);
  },
  forCase(caseId: string): SupportEventRow[] {
    return rows<SupportEventRow>(db().prepare("SELECT * FROM support_event WHERE case_id = ? ORDER BY last_transition_at DESC"), caseId);
  },
  byId(id: string): SupportEventRow | null {
    return one<SupportEventRow>(db().prepare("SELECT * FROM support_event WHERE id = ?"), id);
  },
  update(id: string, fields: Partial<Pick<SupportEventRow, "presentation_state" | "handoff_state" | "shown_at" | "grant_id" | "recipient_id">>) {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (!entries.length) return;
    const sets = entries.map(([k]) => `${k} = ?`).join(", ");
    const vals = entries.map(([, v]) => v);
    db()
      .prepare(`UPDATE support_event SET ${sets}, last_transition_at = datetime('now') WHERE id = ?`)
      .run(...vals, id);
  },
};

export const SupportResourceRepo = {
  insert(row: SupportResourceRow) {
    db()
      .prepare(
        `INSERT INTO support_resource (id, jurisdiction, language, channel, display_contact, hours, source_url, last_verified_at, expires_at, review_owner, status)
         VALUES (@id, @jurisdiction, @language, @channel, @display_contact, @hours, @source_url, @last_verified_at, @expires_at, @review_owner, @status)`,
      )
      .run(row);
  },
  active(jurisdiction: string, language: "bn" | "en"): SupportResourceRow[] {
    return rows<SupportResourceRow>(
      db().prepare(
        "SELECT * FROM support_resource WHERE jurisdiction = ? AND language = ? AND status = 'VERIFIED' AND expires_at > datetime('now')",
      ),
      jurisdiction,
      language,
    );
  },
};

// ---------- session / idempotency ----------

export const IdempotencyRepo = {
  find(actorId: string, routeKey: string, keyHash: string): IdempotencyReceiptRow | null {
    return one<IdempotencyReceiptRow>(
      db().prepare(
        "SELECT * FROM idempotency_receipt WHERE actor_id = ? AND route_key = ? AND key_hash = ? AND expires_at > datetime('now')",
      ),
      actorId,
      routeKey,
      keyHash,
    );
  },
  save(row: IdempotencyReceiptRow) {
    db()
      .prepare(
        `INSERT INTO idempotency_receipt (id, actor_id, route_key, key_hash, request_hash, response_resource_ids, status_code, expires_at, created_at)
         VALUES (@id, @actor_id, @route_key, @key_hash, @request_hash, @response_resource_ids, @status_code, @expires_at, @created_at)`,
      )
      .run(row);
  },
};

// ---------- jobs ----------

export const JobRepo = {
  insert(row: JobRow) {
    db()
      .prepare(
        `INSERT INTO job (id, type, case_id, target_ids, input_hash, idempotency_key, state, attempt, lease_until, heartbeat_at, privacy_epoch, progress_stage, error_code, result_ids, created_at, updated_at)
         VALUES (@id, @type, @case_id, @target_ids, @input_hash, @idempotency_key, @state, @attempt, @lease_until, @heartbeat_at, @privacy_epoch, @progress_stage, @error_code, @result_ids, @created_at, @updated_at)`,
      )
      .run(row);
  },
  byId(id: string): JobRow | null {
    return one<JobRow>(db().prepare("SELECT * FROM job WHERE id = ?"), id);
  },
  update(id: string, fields: Partial<Pick<JobRow, "state" | "progress_stage" | "error_code" | "result_ids" | "attempt" | "lease_until" | "heartbeat_at">>) {
    const entries = Object.entries(fields).filter(([, v]) => v !== undefined);
    if (!entries.length) return;
    const sets = entries.map(([k]) => `${k} = ?`).join(", ");
    const vals = entries.map(([, v]) => v);
    db()
      .prepare(`UPDATE job SET ${sets}, updated_at = datetime('now') WHERE id = ?`)
      .run(...vals, id);
  },
  pickNextReady(limit: number = 1): JobRow[] {
    return rows<JobRow>(
      db().prepare(
        "SELECT * FROM job WHERE state IN ('QUEUED', 'RETRY_WAIT') AND (lease_until IS NULL OR lease_until < datetime('now')) ORDER BY created_at LIMIT ?",
      ),
      limit,
    );
  },
};

// ---------- evidence edges ----------

export const EvidenceEdgeRepo = {
  insert(row: EvidenceEdgeRow) {
    db()
      .prepare(
        `INSERT INTO evidence_edge (id, case_id, derived_resource_id, source_resource_id, relation, transformation_version)
         VALUES (@id, @case_id, @derived_resource_id, @source_resource_id, @relation, @transformation_version)`,
      )
      .run(row);
  },
  forDerived(resourceId: string): EvidenceEdgeRow[] {
    return rows<EvidenceEdgeRow>(db().prepare("SELECT * FROM evidence_edge WHERE derived_resource_id = ?"), resourceId);
  },
};

export const CaregiverRelationshipRepo = {
  insert(row: { id: string; case_id: string; patient_id: string; caregiver_user_id: string; grant_id: string | null; relation_label: string; status: "INVITED" | "ACTIVE" | "REVOKED"; created_at: string }) {
    db()
      .prepare(
        `INSERT INTO caregiver_relationship (id, case_id, patient_id, caregiver_user_id, grant_id, relation_label, status, created_at)
         VALUES (@id, @case_id, @patient_id, @caregiver_user_id, @grant_id, @relation_label, @status, @created_at)`,
      )
      .run(row);
  },
};

export const EvaluationSetRepo = {
  insert(row: { id: string; name: string; version: string; manifest_hash: string; synthetic_only: number; frozen_at: string }) {
    db()
      .prepare(
        `INSERT INTO evaluation_set (id, name, version, manifest_hash, synthetic_only, frozen_at)
         VALUES (@id, @name, @version, @manifest_hash, @synthetic_only, @frozen_at)`,
      )
      .run(row);
  },
  all() {
    return rows<{ id: string; name: string; version: string; manifest_hash: string; synthetic_only: number; frozen_at: string }>(
      db().prepare("SELECT * FROM evaluation_set ORDER BY frozen_at"),
    );
  },
};

export const EvaluationCaseRepo = {
  insert(row: { id: string; set_id: string; fixture_key: string; asset_hashes: string; expected_json: string; label_author: string; adjudicator: string; slice_tags: string }) {
    db()
      .prepare(
        `INSERT INTO evaluation_case (id, set_id, fixture_key, asset_hashes, expected_json, label_author, adjudicator, slice_tags)
         VALUES (@id, @set_id, @fixture_key, @asset_hashes, @expected_json, @label_author, @adjudicator, @slice_tags)`,
      )
      .run(row);
  },
  forSet(setId: string) {
    return rows<{ id: string; set_id: string; fixture_key: string; asset_hashes: string; expected_json: string; label_author: string; adjudicator: string; slice_tags: string }>(
      db().prepare("SELECT * FROM evaluation_case WHERE set_id = ? ORDER BY fixture_key"),
      setId,
    );
  },
};

export const EvaluationRunRepo = {
  insert(row: { id: string; set_id: string; build_commit: string; model_config_hash: string; dictionary_version: string; protocol_version: string; started_at: string; finished_at: string | null; status: "NOT_RUN" | "RUNNING" | "COMPLETE" | "FAILED" }) {
    db()
      .prepare(
        `INSERT INTO evaluation_run (id, set_id, build_commit, model_config_hash, dictionary_version, protocol_version, started_at, finished_at, status)
         VALUES (@id, @set_id, @build_commit, @model_config_hash, @dictionary_version, @protocol_version, @started_at, @finished_at, @status)`,
      )
      .run(row);
  },
  forSet(setId: string) {
    return rows<{ id: string; set_id: string; build_commit: string; model_config_hash: string; dictionary_version: string; protocol_version: string; started_at: string; finished_at: string | null; status: "NOT_RUN" | "RUNNING" | "COMPLETE" | "FAILED" }>(
      db().prepare("SELECT * FROM evaluation_run WHERE set_id = ? ORDER BY started_at DESC"),
      setId,
    );
  },
  finish(id: string, status: "COMPLETE" | "FAILED") {
    db()
      .prepare("UPDATE evaluation_run SET status = ?, finished_at = datetime('now') WHERE id = ?")
      .run(status, id);
  },
};

export const EvaluationMetricRepo = {
  insert(row: { id: string; run_id: string; metric_key: string; slice: string; numerator: number; denominator: number; value: number | null; failure_case_ids: string }) {
    db()
      .prepare(
        `INSERT INTO evaluation_metric (id, run_id, metric_key, slice, numerator, denominator, value, failure_case_ids)
         VALUES (@id, @run_id, @metric_key, @slice, @numerator, @denominator, @value, @failure_case_ids)`,
      )
      .run(row);
  },
  forRun(runId: string) {
    return rows<{ id: string; run_id: string; metric_key: string; slice: string; numerator: number; denominator: number; value: number | null; failure_case_ids: string }>(
      db().prepare("SELECT * FROM evaluation_metric WHERE run_id = ? ORDER BY metric_key"),
      runId,
    );
  },
};

export const SupportProtocolRepo = {
  insert(row: { id: string; version: string; language: "bn" | "en"; templates: string; observation_rules: string; source_refs: string; reviewed_by: string; activation_mode: "DEMO_ONLY" | "REVIEWED"; content_checksum: string }) {
    db()
      .prepare(
        `INSERT INTO support_protocol (id, version, language, templates, observation_rules, source_refs, reviewed_by, activation_mode, content_checksum)
         VALUES (@id, @version, @language, @templates, @observation_rules, @source_refs, @reviewed_by, @activation_mode, @content_checksum)`,
      )
      .run(row);
  },
};
