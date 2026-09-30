/**
 * SQLite schema. The schema mirrors the architecture's relational design
 * (Section 12): a Resource registry at the centre, case-owned common columns
 * (C), resource-owned common columns (R), explicit sensitivity and retention
 * classes, immutable FactRevision, and append-only ReviewAction / AuditEvent.
 *
 * The implementation uses a tagged union table `resource` so that grants and
 * evidence edges can reference any securable object by id. Most domain
 * payloads live as typed JSON in JSONB-equivalent TEXT columns, since SQLite
 * has no native JSONB but TEXT + JSON.stringify is sufficient for the demo.
 */

import type { Sensitivity } from "../domain/ids";

export type ResourceType =
  | "SOURCE_ARTIFACT"
  | "FACT"
  | "MEDICATION_CLAIM"
  | "LAB_OBSERVATION"
  | "TEST_ORDER"
  | "WELLBEING_ENTRY"
  | "ASSESSMENT_REVISION"
  | "BRIEF"
  | "BRIEF_ITEM"
  | "UPDATE_PROPOSAL"
  | "ISSUE";

export type RetentionClass = "S" | "A" | "D" | "L" | "K";

export interface ResourceRow {
  id: string;
  resource_type: ResourceType;
  owner_case_id: string | null;
  owner_patient_id: string | null;
  sensitivity: Sensitivity;
  retention_class: RetentionClass;
  created_at: string;
  created_by: string | null;
  deleted_at: string | null;
  schema_version: string;
}

export interface CaseRow {
  id: string;
  patient_id: string;
  context_version: number;
  privacy_epoch: number;
  synthetic: number;
  status: "OPEN" | "ARCHIVED" | "DELETING";
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface UserRow {
  id: string;
  auth_subject: string;
  role: "PATIENT" | "CAREGIVER" | "DOCTOR" | "OPERATOR" | "EVALUATOR";
  display_name: string;
  locale: "bn" | "en";
  disabled_at: string | null;
  password_hash: string | null;
  created_at: string;
}

export interface PatientRow {
  id: string;
  owner_user_id: string;
  display_name: string;
  birth_year: number | null;
  date_precision: string;
  preferred_language: "bn" | "en";
  synthetic: number;
}

export interface ClinicianProfileRow {
  user_id: string;
  display_name: string;
  verification_state: "DEMO_IDENTITY" | "VERIFIED" | "PENDING" | "DISABLED";
  verification_evidence_ref: string | null;
}

export interface CaregiverRelationshipRow {
  id: string;
  case_id: string;
  patient_id: string;
  caregiver_user_id: string;
  grant_id: string | null;
  relation_label: string;
  status: "INVITED" | "ACTIVE" | "REVOKED";
  created_at: string;
}

export interface EncounterRow {
  id: string;
  case_id: string;
  provider_id: string | null;
  event_date: string | null;
  date_precision: string;
  kind: "PLANNED" | "WALK_IN" | "TELE" | "FOLLOW_UP";
  status: "PLANNED" | "OPEN" | "REVIEW_PENDING" | "CLOSED";
  created_at: string;
}

export interface ConsentRow {
  id: string;
  case_id: string;
  patient_id: string;
  actor_id: string;
  purpose:
    | "GENERAL_COLLECTION"
    | "AI_PROCESSING"
    | "WELLBEING_COLLECTION"
    | "ASSESSMENT_PARTICIPATION"
    | "AUDIO_RECORDING"
    | "SHARING_NAMED_DOCTOR"
    | "SHARING_GENERAL_QR"
    | "EXPORT";
  wording_version: string;
  understanding_check_passed: number;
  decision: "GRANTED" | "DECLINED";
  valid_from: string;
  revoked_at: string | null;
  supersedes_id: string | null;
  metadata: string;
}

export interface GrantRow {
  id: string;
  case_id: string;
  patient_id: string;
  recipient_user_id: string | null;
  kind: "GENERAL_QR" | "SENSITIVE_NAMED" | "CAREGIVER_GENERAL";
  purpose: string;
  consent_id: string;
  starts_at: string;
  expires_at: string;
  revoked_at: string | null;
  export_allowed: number;
  version: number;
  preview_hash: string | null;
  source_closure_hash: string | null;
}

export interface GrantResourceRow {
  id: string;
  grant_id: string;
  resource_id: string;
  field_paths: string;
  source_closure_hash: string;
}

export interface ShareLinkRow {
  id: string;
  grant_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at: string | null;
  redeemed_at: string | null;
  session_hash: string | null;
}

export interface SourceArtifactRow {
  id: string;
  resource_id: string;
  case_id: string;
  kind: "DOCUMENT" | "STRIP" | "AUDIO" | "TYPED" | "CLINICIAN_ENTRY";
  object_key: string | null;
  content_hash: string;
  mime_type: string;
  size_bytes: number;
  filename_safe: string;
  source_payload: string | null;
  respondent_id: string | null;
  respondent_role: "PATIENT" | "CAREGIVER" | "DOCTOR" | null;
  captured_at: string;
  event_date: string | null;
  consent_id: string | null;
  question_id: string | null;
  transcript_of_id: string | null;
  deletion_due_at: string | null;
  state:
    | "UPLOADING"
    | "RECEIVED"
    | "QUARANTINED"
    | "PROCESSING"
    | "REVIEW_REQUIRED"
    | "ADMITTED"
    | "PARTIAL"
    | "FAILED"
    | "DELETED";
}

export interface DocumentPageRow {
  id: string;
  source_artifact_id: string;
  page_number: number;
  width_px: number;
  height_px: number;
  rotation: number;
  image_hash: string;
  object_key: string;
}

export interface EvidenceAnchorRow {
  id: string;
  resource_id: string;
  source_artifact_id: string;
  page_id: string | null;
  bbox: string | null;
  text_start: number | null;
  text_end: number | null;
  audio_start_ms: number | null;
  audio_end_ms: number | null;
  quote_original: string | null;
  source_version_hash: string;
}

export interface ProcessingRunRow {
  id: string;
  source_id: string | null;
  stage: string;
  adapter: string;
  provider: string | null;
  model_id: string | null;
  prompt_version: string | null;
  schema_version: string;
  input_hash: string;
  output_resource_id: string | null;
  dictionary_version: string | null;
  policy_fingerprint: string;
  privacy_epoch: number;
  started_at: string;
  finished_at: string | null;
  latency_ms: number | null;
  error_code: string | null;
  usage_metadata: string | null;
  status: "QUEUED" | "RUNNING" | "SUCCEEDED" | "PARTIAL" | "FAILED" | "CANCELLED";
}

export interface FactRow {
  id: string;
  resource_id: string;
  case_id: string;
  kind:
    | "MEDICATION"
    | "LAB"
    | "TEST_ORDER"
    | "ALLERGY"
    | "REACTION"
    | "COMPLAINT"
    | "AGENDA"
    | "NARRATIVE"
    | "WELLBEING"
    | "ASSESSMENT"
    | "PROVIDER";
  current_revision_id: string | null;
  logical_key: string;
}

export interface FactRevisionRow {
  id: string;
  resource_id: string;
  fact_id: string;
  revision_no: number;
  raw_representation: string;
  normalized_payload: string;
  event_date: string | null;
  date_precision: string;
  origin_kind: "DOCUMENT" | "PATIENT" | "CAREGIVER" | "CLINICIAN" | "DERIVED";
  processing_state: "EXTRACTED" | "NORMALIZED" | "LOW_CONFIDENCE" | "NEEDS_REVIEW";
  review_state: "UNREVIEWED" | "CONTRIBUTOR_CONFIRMED" | "DOCTOR_CONFIRMED" | "REJECTED";
  validity_state: "CURRENT" | "SUPERSEDED" | "CONFLICTING" | "UNKNOWN";
  confidence_by_stage: string;
  author_id: string;
  supersedes_revision_id: string | null;
  created_at: string;
}

export interface MedicationClaimRow {
  fact_revision_id: string;
  product_id: string | null;
  brand: string | null;
  manufacturer: string | null;
  ingredient_ids: string;
  ingredient_names: string;
  strength_value: number | null;
  strength_unit: string | null;
  form: string | null;
  route: string | null;
  dose_raw: string | null;
  frequency_raw: string | null;
  parsed_schedule: string | null;
  duration_raw: string | null;
  evidence_kind: string;
  claimed_lifecycle: string;
  effective_start: string | null;
  effective_end: string | null;
  provider_id: string | null;
  unknown_reason: string | null;
}

export interface LabObservationRow {
  fact_revision_id: string;
  lab_definition_id: string | null;
  analyte: string | null;
  original_test: string | null;
  original_value: string | null;
  original_unit: string | null;
  original_range: string | null;
  normalized_decimal: number | null;
  normalized_unit: string | null;
  conversion_version: string | null;
  method: string | null;
  specimen: string | null;
  laboratory: string | null;
  result_date: string | null;
  date_precision: string | null;
}

export interface TestOrderRow {
  fact_revision_id: string;
  lab_definition_id: string | null;
  test_name: string | null;
  instruction_raw: string | null;
  ordered_date: string | null;
  encounter_id: string | null;
}

export interface OrderResultLinkRow {
  id: string;
  order_revision_id: string;
  result_revision_id: string;
  relation: "CANDIDATE" | "CONFIRMED" | "REJECTED";
  match_method: string;
  review_action_id: string | null;
}

export interface ContextSnapshotRow {
  resource_id: string;
  context_version: number;
  audience_fingerprint: string;
  source_revision_ids: string;
  medication_projection: string;
  generated_at: string;
  privacy_epoch: number;
  state: "CURRENT" | "STALE" | "INVALID";
}

export interface IssueRow {
  id: string;
  resource_id: string;
  case_id: string;
  kind: "CONFLICT" | "GAP";
  type: string;
  rule_id: string;
  rule_version: string;
  signature: string;
  context_version: number;
  audience_fingerprint: string;
  priority: "REVIEW_FIRST" | "REVIEW_NEXT" | "INFORMATION";
  uncertainty_codes: string;
  status: string;
  claim_revision_ids: string;
  summary: string;
  doctor_only: number;
  created_at: string;
  updated_at: string;
}

export interface InterviewRow {
  id: string;
  case_id: string;
  respondent_id: string;
  role: "PATIENT" | "CAREGIVER";
  language: "bn" | "en";
  budget: number;
  context_version: number;
  status: "READY" | "ACTIVE" | "PAUSED" | "SKIPPED" | "COMPLETED" | "EXITED";
  stop_reason: string | null;
  visited_question_ids: string;
  created_at: string;
  updated_at: string;
}

export interface QuestionRow {
  id: string;
  resource_id: string;
  interview_id: string;
  target_issue_ids: string;
  template_id: string;
  template_version: string;
  language: "bn" | "en";
  text: string;
  response_type: "SINGLE" | "MULTI" | "TEXT" | "PHOTO";
  options: string;
  allows_unknown: number;
  allows_skip: number;
  stop_conditions: string;
  asked_at: string | null;
  answered_input_id: string | null;
  disposition: "PLANNED" | "ASKED" | "ANSWERED" | "UNKNOWN" | "SKIPPED" | "CANCELLED";
}

export interface BriefRow {
  id: string;
  resource_id: string;
  case_id: string;
  context_version: number;
  audience_fingerprint: string;
  grant_ids: string;
  privacy_epoch: number;
  composition_version: string;
  generated_at: string;
  status: "BUILDING" | "READY" | "STALE" | "INVALID" | "FAILED";
  export_artifact_id: string | null;
}

export interface BriefItemRow {
  id: string;
  resource_id: string;
  brief_id: string;
  section: string;
  rank: number;
  kind: string;
  text: string;
  why_code: string;
  status_labels: string;
  structured_payload: string;
  fact_revision_ids: string;
  evidence_anchor_ids: string;
}

export interface VisitUpdateRow {
  id: string;
  resource_id: string;
  case_id: string;
  encounter_id: string;
  base_context_version: number;
  proposal_version: number;
  privacy_epoch: number;
  state:
    | "PROPOSED"
    | "IN_REVIEW"
    | "READY"
    | "COMMITTED"
    | "REJECTED"
    | "STALE";
  committed_at: string | null;
  committed_by: string | null;
}

export interface UpdateItemRow {
  id: string;
  resource_id: string;
  update_id: string;
  revision: number;
  operation: "ADD" | "CHANGE" | "STOP" | "CONTINUE" | "PAUSE";
  before_payload: string | null;
  proposed_after_payload: string;
  target_fact_id: string | null;
  status: "PENDING" | "ACCEPTED" | "CORRECTED" | "REJECTED";
}

export interface ReviewTaskRow {
  id: string;
  resource_id: string;
  target_resource_id: string;
  assignee_id: string | null;
  kind: string;
  status: "OPEN" | "SEEN" | "ACKNOWLEDGED" | "DECIDED" | "CANCELLED";
  due_at: string | null;
  created_at: string;
}

export interface ReviewActionRow {
  id: string;
  resource_id: string;
  target_resource_id: string;
  target_revision: number;
  actor_id: string;
  actor_role: "PATIENT" | "CAREGIVER" | "DOCTOR" | "OPERATOR";
  action: string;
  correction_payload: string | null;
  reason: string | null;
  authored_source_id: string | null;
  acted_at: string;
}

export interface AuditEventRow {
  id: string;
  case_id: string | null;
  actor_or_service_id: string;
  action: string;
  target_resource_id: string | null;
  outcome: string;
  request_id: string;
  policy_version: string;
  occurred_at: string;
  prior_version: number | null;
  new_version: number | null;
}

export interface MedicationEventRow {
  id: string;
  resource_id: string;
  encounter_id: string;
  medication_fact_id: string;
  event_kind: string;
  before_claim_id: string | null;
  after_claim_id: string | null;
  review_action_id: string;
  reason_fact_revision_id: string | null;
  effective_date: string;
  date_precision: string;
}

export interface JobRow {
  id: string;
  type: string;
  case_id: string | null;
  target_ids: string;
  input_hash: string;
  idempotency_key: string;
  state:
    | "QUEUED"
    | "RUNNING"
    | "WAITING_REVIEW"
    | "RETRY_WAIT"
    | "SUCCEEDED"
    | "PARTIAL"
    | "FAILED"
    | "CANCELLED";
  attempt: number;
  lease_until: string | null;
  heartbeat_at: string | null;
  privacy_epoch: number;
  progress_stage: string | null;
  error_code: string | null;
  result_ids: string | null;
  created_at: string;
  updated_at: string;
}

export interface IdempotencyReceiptRow {
  id: string;
  actor_id: string;
  route_key: string;
  key_hash: string;
  request_hash: string;
  response_resource_ids: string | null;
  status_code: number;
  expires_at: string;
  created_at: string;
}

export interface WellbeingEntryRow {
  fact_revision_id: string;
  resource_id: string;
  case_id: string;
  respondent_id: string;
  original_input_id: string | null;
  topic_selected: string | null;
  onset: string | null;
  date_precision: string;
  original_wording: string;
  confirmed_summary: string | null;
  request_discussion: number;
  presentation_preference: "DEFAULT" | "RESPECTFUL" | "PRIVATE_CONVERSATION";
  confirmation_at: string | null;
}

export interface InstrumentDefinitionRow {
  id: string;
  instrument_key: "WHO5";
  definition_version: string;
  language: "bn" | "en";
  source_url: string;
  source_file_hash: string;
  content_checksum: string;
  rights_metadata: string;
  attribution: string;
  timeframe: string;
  scoring_version: string;
  activation_status: "UNAVAILABLE" | "DEMO_ONLY" | "REAL_USE_APPROVED" | "RETIRED";
  content_reviewer: string;
  reviewed_at: string | null;
}

export interface InstrumentItemRow {
  id: string;
  definition_id: string;
  item_key: string;
  ordinal: number;
  exact_text: string;
  exact_options_json: string;
  value_min: number;
  value_max: number;
}

export interface AssessmentSessionRow {
  id: string;
  resource_id: string;
  definition_id: string;
  case_id: string;
  patient_id: string;
  respondent_id: string;
  consent_id: string;
  administration_mode: "FIXED_TEXT" | "CONFIRMED_TRANSCRIPTION";
  current_revision: number;
  started_at: string;
  submitted_at: string | null;
  completion_state:
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "INCOMPLETE"
    | "SUBMITTED"
    | "SCORED"
    | "VOID"
    | "UNAVAILABLE";
}

export interface AssessmentRevisionRow {
  id: string;
  resource_id: string;
  session_id: string;
  revision_no: number;
  definition_checksum: string;
  response_hash: string;
  scoring_version: string;
  raw_total: number | null;
  transformed_score: number | null;
  submitted_at: string | null;
  scored_at: string | null;
  supersedes_id: string | null;
}

export interface AssessmentResponseRow {
  id: string;
  assessment_revision_id: string;
  item_id: string;
  value: number | null;
  disposition: "ANSWERED" | "UNANSWERED" | "SKIPPED" | "UNKNOWN";
  confirmed_at: string | null;
  source_input_id: string | null;
}

export interface SupportEventRow {
  id: string;
  resource_id: string;
  case_id: string;
  evidence_resource_id: string | null;
  protocol_version: string;
  observation_type: string;
  presentation_state: string;
  handoff_state: string;
  shown_at: string | null;
  grant_id: string | null;
  recipient_id: string | null;
  monitoring_available: number;
  last_transition_at: string;
}

export interface SupportResourceRow {
  id: string;
  jurisdiction: string;
  language: "bn" | "en";
  channel: string;
  display_contact: string;
  hours: string;
  source_url: string;
  last_verified_at: string;
  expires_at: string;
  review_owner: string;
  status: "VERIFIED" | "EXPIRED" | "UNAVAILABLE";
}

export interface SupportProtocolRow {
  id: string;
  version: string;
  language: "bn" | "en";
  templates: string;
  observation_rules: string;
  source_refs: string;
  reviewed_by: string;
  activation_mode: "DEMO_ONLY" | "REVIEWED";
  content_checksum: string;
}

export interface ProviderRow {
  id: string;
  case_id: string;
  display_name: string;
  specialty_as_documented: string | null;
  source_anchor_id: string | null;
}

export interface EvidenceEdgeRow {
  id: string;
  case_id: string;
  derived_resource_id: string;
  source_resource_id: string;
  relation: string;
  transformation_version: string;
}

export interface EvaluationSetRow {
  id: string;
  name: string;
  version: string;
  manifest_hash: string;
  synthetic_only: number;
  frozen_at: string;
}

export interface EvaluationCaseRow {
  id: string;
  set_id: string;
  fixture_key: string;
  asset_hashes: string;
  expected_json: string;
  label_author: string;
  adjudicator: string;
  slice_tags: string;
}

export interface EvaluationRunRow {
  id: string;
  set_id: string;
  build_commit: string;
  model_config_hash: string;
  dictionary_version: string;
  protocol_version: string;
  started_at: string;
  finished_at: string | null;
  status: "NOT_RUN" | "RUNNING" | "COMPLETE" | "FAILED";
}

export interface EvaluationMetricRow {
  id: string;
  run_id: string;
  metric_key: string;
  slice: string;
  numerator: number;
  denominator: number;
  value: number | null;
  failure_case_ids: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
  purpose: "DEFAULT" | "PRIVATE_WELLBEING" | "DOCTOR_REVIEW";
}
