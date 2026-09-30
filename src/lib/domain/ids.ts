/**
 * Domain type definitions for MedLens AI.
 *
 * These types implement the contracts from Section 8.2 and Section 12 of the
 * architecture document. They are intentionally framework-free so the same
 * definitions can be reused across the API route handlers, the worker job
 * processors, the React UI and the evaluation runner.
 */

export type ID = string;

export type Language = "bn" | "en" | "bn-Latn";
export type Role = "PATIENT" | "CAREGIVER" | "DOCTOR" | "WORKER" | "EVALUATOR" | "OPERATOR" | "ANONYMOUS";
export type Sensitivity = "GENERAL" | "RESTRICTED_WELLBEING" | "QUARANTINED";

export interface Confidence {
  stage: "OCR" | "ASR" | "ENTITY_LINK" | "GROUNDING";
  value: number | null;
  method: string;
  calibratedOn: string | null;
  reviewReason: string | null;
}

export interface EvidenceAnchor {
  pageId?: ID | null;
  sourceArtifactId: ID;
  bbox?: { x0: number; y0: number; x1: number; y1: number } | null;
  textStart?: number | null;
  textEnd?: number | null;
  audioStartMs?: number | null;
  audioEndMs?: number | null;
  quoteOriginal?: string | null;
}

export type FactKind =
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

export type EvidenceKind =
  | "PRESCRIBED"
  | "SEEN_AT_HOME"
  | "PATIENT_REPORTED_USE"
  | "CAREGIVER_REPORTED_USE"
  | "DOCTOR_CONFIRMED_PLAN"
  | "DOCUMENTED_DISPENSED"
  | "REPORTED";

export type ClaimedLifecycle = "STARTED" | "CONTINUED" | "CHANGED" | "PAUSED" | "STOPPED" | "UNKNOWN";
export type ProcessingState = "EXTRACTED" | "NORMALIZED" | "LOW_CONFIDENCE" | "NEEDS_REVIEW";
export type ReviewState = "UNREVIEWED" | "CONTRIBUTOR_CONFIRMED" | "DOCTOR_CONFIRMED" | "REJECTED";
export type ValidityState = "CURRENT" | "SUPERSEDED" | "CONFLICTING" | "UNKNOWN";
export type OriginKind = "DOCUMENT" | "PATIENT" | "CAREGIVER" | "CLINICIAN" | "DERIVED";

export interface MedicationClaim {
  productId?: ID | null;
  brand?: string | null;
  manufacturer?: string | null;
  ingredientIds: ID[];
  ingredientNames: string[];
  strengthValue?: number | null;
  strengthUnit?: string | null;
  form?: string | null;
  route?: string | null;
  doseRaw?: string | null;
  frequencyRaw?: string | null;
  parsedSchedule?: string[] | null;
  durationRaw?: string | null;
  evidenceKind: EvidenceKind;
  claimedLifecycle: ClaimedLifecycle;
  effectiveStart?: string | null;
  effectiveEnd?: string | null;
  providerId?: ID | null;
  unknownReason?: string | null;
}

export interface LabObservation {
  labDefinitionId?: ID | null;
  analyte?: string | null;
  originalTest?: string | null;
  originalValue?: string | null;
  originalUnit?: string | null;
  originalRange?: string | null;
  normalizedDecimal?: number | null;
  normalizedUnit?: string | null;
  conversionVersion?: string | null;
  method?: string | null;
  specimen?: string | null;
  laboratory?: string | null;
  resultDate?: string | null;
  datePrecision?: string | null;
  unknownReason?: string | null;
}

export interface TestOrder {
  labDefinitionId?: ID | null;
  testName?: string | null;
  instructionRaw?: string | null;
  orderedDate?: string | null;
  encounterId?: ID | null;
}

export interface AllergyClaim {
  substance: string;
  reactionText?: string | null;
  date?: string | null;
  verification: "DOCUMENTED" | "REPORTED" | "DENIED" | "UNKNOWN";
}

export interface WellbeingClaim {
  topicSelected?: string | null;
  onset?: string | null;
  datePrecision?: string | null;
  originalWording: string;
  confirmedSummary?: string | null;
  requestDiscussion: boolean;
  presentationPreference: "DEFAULT" | "RESPECTFUL" | "PRIVATE_CONVERSATION";
}

export interface AssessmentClaim {
  instrumentId: "WHO5";
  definitionVersion: string;
  rawTotal: number;
  transformedScore: number;
  scoringVersion: string;
  runtimeMode: "DEMO_ONLY" | "REAL_USE_APPROVED";
  interpretation: null;
  diagnosticLabel: null;
  responseHash: string;
}

export type IssueKind = "CONFLICT" | "GAP";
export type IssuePriority = "REVIEW_FIRST" | "REVIEW_NEXT" | "INFORMATION";
export type IssueStatus =
  | "OPEN"
  | "CLARIFIED_BY_REPORT"
  | "AWAITING_EVIDENCE"
  | "NEEDS_DOCTOR_REVIEW"
  | "DISMISSED_BY_DOCTOR"
  | "RESOLVED_BY_DOCTOR"
  | "STALE";

export interface Issue {
  id: ID;
  kind: IssueKind;
  type: string;
  ruleId: string;
  ruleVersion: string;
  signature: string;
  contextVersion: number;
  audienceFingerprint: string;
  priority: IssuePriority;
  uncertaintyCodes: string[];
  status: IssueStatus;
  claimRevisionIds: ID[];
  summary: string;
  doctorOnly: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PatientQuestion {
  id: ID;
  interviewId: ID;
  targetIssueIds: ID[];
  templateId: string;
  templateVersion: string;
  language: Language;
  text: string;
  responseType: "SINGLE" | "MULTI" | "TEXT" | "PHOTO";
  options: { id: string; label: string }[];
  allowsUnknown: true;
  allowsSkip: true;
  stopConditions: string[];
  status: "PLANNED" | "ASKED" | "ANSWERED" | "UNKNOWN" | "SKIPPED" | "CANCELLED";
  askedAt?: string | null;
  answeredInputId?: ID | null;
}

export interface BriefItem {
  id: ID;
  briefId: ID;
  section: string;
  rank: number;
  kind: string;
  displayText: string;
  factRevisionIds: ID[];
  evidenceAnchorIds: ID[];
  whyCode: string;
  sourceStatus: string;
  reviewStatus: string;
  sensitivity: Sensitivity;
  audienceFingerprint: string;
}

export interface UpdateProposal {
  id: ID;
  caseId: ID;
  encounterId: ID;
  baseContextVersion: number;
  privacyEpoch: number;
  items: {
    id: ID;
    revision: number;
    operation: "ADD" | "CHANGE" | "STOP" | "CONTINUE" | "PAUSE";
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    evidenceIds: ID[];
    requiresReview: true;
  }[];
}

export interface WellbeingContextItem {
  id: ID;
  respondentId: ID;
  respondentRole: "PATIENT" | "CAREGIVER" | "DOCTOR";
  originalInputId: ID;
  originalWording: string;
  confirmedSummary: string | null;
  eventDate: string | null;
  datePrecision: string;
  requestDiscussion: boolean;
  sensitivity: "RESTRICTED_WELLBEING";
  revision: number;
}

export interface DistressSupportEvent {
  id: ID;
  evidenceResourceId: ID | null;
  protocolVersion: string;
  observation:
    | "HELP_REQUEST"
    | "CURRENT_EXPLICIT"
    | "AMBIGUOUS"
    | "HISTORICAL"
    | "QUOTED_THIRD_PERSON"
    | "NEGATED"
    | "UNRECOGNIZED";
  presentationState: "NOT_SHOWN" | "SHOWN" | "EXITED" | "RESUMED_BY_USER";
  handoffState:
    | "NOT_REQUESTED"
    | "CONSENT_REQUIRED"
    | "CREATED"
    | "DELIVERED"
    | "SEEN"
    | "ACKNOWLEDGED"
    | "UNMONITORED"
    | "DELIVERY_FAILED"
    | "UNACKNOWLEDGED"
    | "REVOKED"
    | "CANCELLED";
  displayedAt: string | null;
  recipientId: ID | null;
  grantId: ID | null;
  monitoringAvailable: boolean;
}

export interface AssessmentScore {
  assessmentRevisionId: ID;
  scoringVersion: string;
  definitionChecksum: string;
  responseHash: string;
  rawTotal: number;
  transformedScore: number;
  scoredAt: string;
  interpretation: null;
  diagnosticLabel: null;
  runtimeMode: "DEMO_ONLY" | "REAL_USE_APPROVED";
}

export interface AssessmentSubmission {
  sessionId: ID;
  expectedRevision: number;
  instrumentId: "WHO5";
  definitionVersion: string;
  language: "bn" | "en";
  definitionChecksum: string;
  respondentId: ID;
  administrationMode: "FIXED_TEXT" | "CONFIRMED_TRANSCRIPTION";
  responses: {
    itemId: string;
    value: number;
    confirmed: boolean;
    sourceInputId?: ID;
  }[];
}

export interface ReviewAction {
  id: ID;
  targetResourceId: ID;
  targetRevision: number;
  actorId: ID;
  actorRole: Role;
  action:
    | "CONFIRM_READING"
    | "ACCEPT"
    | "CORRECT"
    | "REJECT"
    | "ACKNOWLEDGE"
    | "ANNOTATE"
    | "QUARANTINE";
  correctionPayload?: Record<string, unknown> | null;
  reason?: string | null;
  authoredSourceId?: ID | null;
  actedAt: string;
}
