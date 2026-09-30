/**
 * Synthetic Rahima demo seed.
 *
 * One click of `npm run db:seed` (or `npm run demo:reset`) installs:
 *   - Synthetic patient (Rahima, age 58) and patient user
 *   - Synthetic caregiver (Tanvir) and caregiver user
 *   - Two synthetic doctors (Dr A granted, Dr B ungranted)
 *   - Synthetic evaluator / operator
 *   - The full pre-visit evidence manifest (7 papers + 2 strips + 1 new Rx),
 *     each with consent, source artifact, evidence anchors and admitted
 *     FactRevision rows
 *   - The complaint, agenda and a wellbeing entry in DEMO_ONLY mode
 *   - A pre-built WHO-5 session with synthetic responses and a deterministic
 *     raw total of 12 / transformed score of 48
 *   - The instrument registry activation (DEMO_ONLY)
 *   - Support resources, support protocol and a labeled help surface
 *   - An evaluation set with the A01–A09 acceptance scenarios
 */

import { nanoid } from "nanoid";
import { createHash } from "node:crypto";
import {
  AssessmentResponseRepo,
  AssessmentRevisionRepo,
  AssessmentSessionRepo,
  CaseRepo,
  ClinicianProfileRepo,
  ConsentRepo,
  EncounterRepo,
  EvaluationCaseRepo,
  EvaluationSetRepo,
  EvidenceAnchorRepo,
  FactRepo,
  FactRevisionRepo,
  InstrumentDefinitionRepo,
  InstrumentItemRepo,
  LabObservationRepo,
  MedicationClaimRepo,
  PatientRepo,
  ProcessingRunRepo,
  ProviderRepo,
  SourceArtifactRepo,
  SupportProtocolRepo,
  SupportResourceRepo,
  TestOrderRepo,
  UserRepo,
  WellbeingRepo,
  EvidenceEdgeRepo,
} from "../src/lib/data/repo";
import { hashPassword } from "../src/lib/server/session";
import { resetDb, getDb } from "../src/lib/data/db";
import { WHO5_DEFINITION_CHECKSUM, WHO5_DEFINITION_VERSION, WHO5_FIXED_DEMO_ITEMS, WHO5_SCORE_VERSION } from "../src/lib/domain/assessment";
import { TERMINOLOGY_VERSION, CONCEPTS } from "../src/lib/domain/terminology";

function id(prefix: string) {
  return `${prefix}_${nanoid(8)}`;
}

function iso(year: number, month: number, day: number) {
  return new Date(Date.UTC(year, month - 1, day)).toISOString();
}

function sha(s: string) {
  return createHash("sha256").update(s).digest("hex");
}

export interface SeedResult {
  caseId: string;
  patientUserId: string;
  caregiverUserId: string;
  doctorAUserId: string;
  doctorBUserId: string;
  evaluatorUserId: string;
  operatorUserId: string;
  passwords: { [k: string]: string };
}

export function seedDemo(): SeedResult {
  resetDb();
  const now = new Date().toISOString();

  const passwords = {
    "rahima@demo": "rahima-demo",
    "tanvir@demo": "tanvir-demo",
    "dra@demo": "doctor-a-demo",
    "drb@demo": "doctor-b-demo",
    "operator@demo": "operator-demo",
    "evaluator@demo": "evaluator-demo",
  };

  const rahimaUserId = "user_rahima";
  UserRepo.insert({
    id: rahimaUserId,
    auth_subject: "rahima@demo",
    role: "PATIENT",
    display_name: "Rahima (demo)",
    locale: "bn",
    disabled_at: null,
    password_hash: hashPassword(passwords["rahima@demo"]),
    created_at: now,
  });
  const patientId = "pat_rahima";
  PatientRepo.insert({
    id: patientId,
    owner_user_id: rahimaUserId,
    display_name: "Rahima Begum",
    birth_year: 1967,
    date_precision: "YEAR",
    preferred_language: "bn",
    synthetic: 1,
  });

  const tanvirUserId = "user_tanvir";
  UserRepo.insert({
    id: tanvirUserId,
    auth_subject: "tanvir@demo",
    role: "CAREGIVER",
    display_name: "Tanvir (demo)",
    locale: "bn",
    disabled_at: null,
    password_hash: hashPassword(passwords["tanvir@demo"]),
    created_at: now,
  });

  const doctorAUserId = "user_dra";
  UserRepo.insert({
    id: doctorAUserId,
    auth_subject: "dra@demo",
    role: "DOCTOR",
    display_name: "Dr Aisha Rahman",
    locale: "en",
    disabled_at: null,
    password_hash: hashPassword(passwords["dra@demo"]),
    created_at: now,
  });
  ClinicianProfileRepo.insert({
    user_id: doctorAUserId,
    display_name: "Dr Aisha Rahman",
    verification_state: "VERIFIED",
    verification_evidence_ref: "demo://seed/doctor-a",
  });

  const doctorBUserId = "user_drb";
  UserRepo.insert({
    id: doctorBUserId,
    auth_subject: "drb@demo",
    role: "DOCTOR",
    display_name: "Dr Bilal Hossain",
    locale: "en",
    disabled_at: null,
    password_hash: hashPassword(passwords["drb@demo"]),
    created_at: now,
  });
  ClinicianProfileRepo.insert({
    user_id: doctorBUserId,
    display_name: "Dr Bilal Hossain",
    verification_state: "VERIFIED",
    verification_evidence_ref: "demo://seed/doctor-b",
  });

  const operatorUserId = "user_operator";
  UserRepo.insert({
    id: operatorUserId,
    auth_subject: "operator@demo",
    role: "OPERATOR",
    display_name: "Demo Operator",
    locale: "en",
    disabled_at: null,
    password_hash: hashPassword(passwords["operator@demo"]),
    created_at: now,
  });

  const evaluatorUserId = "user_evaluator";
  UserRepo.insert({
    id: evaluatorUserId,
    auth_subject: "evaluator@demo",
    role: "EVALUATOR",
    display_name: "Evaluator",
    locale: "en",
    disabled_at: null,
    password_hash: hashPassword(passwords["evaluator@demo"]),
    created_at: now,
  });

  const caseId = "case_rahima";
  CaseRepo.insert({
    id: caseId,
    patient_id: patientId,
    context_version: 1,
    privacy_epoch: 1,
    synthetic: 1,
    status: "OPEN",
    created_at: now,
    updated_at: now,
    created_by: rahimaUserId,
  });

  // Provider
  const providerId = "prv_dr_a";
  ProviderRepo.insert({
    id: providerId,
    case_id: caseId,
    display_name: "Dr Aisha Rahman",
    specialty_as_documented: "Internal Medicine",
    source_anchor_id: null,
  });

  // Consents
  const consentGeneralId = id("consent");
  ConsentRepo.insert({
    id: consentGeneralId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "GENERAL_COLLECTION",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: "{}",
  });
  const consentAiId = id("consent");
  ConsentRepo.insert({
    id: consentAiId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "AI_PROCESSING",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: "{}",
  });
  const consentWellbeingId = id("consent");
  ConsentRepo.insert({
    id: consentWellbeingId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "WELLBEING_COLLECTION",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: "{}",
  });
  const consentAssessmentId = id("consent");
  ConsentRepo.insert({
    id: consentAssessmentId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "ASSESSMENT_PARTICIPATION",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: "{}",
  });
  const consentSharingId = id("consent");
  ConsentRepo.insert({
    id: consentSharingId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "SHARING_NAMED_DOCTOR",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: "{}",
  });
  const consentGeneralQrId = id("consent");
  ConsentRepo.insert({
    id: consentGeneralQrId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "SHARING_GENERAL_QR",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: "{}",
  });
  const consentCaregiverId = id("consent");
  ConsentRepo.insert({
    id: consentCaregiverId,
    case_id: caseId,
    patient_id: patientId,
    actor_id: rahimaUserId,
    purpose: "GENERAL_COLLECTION",
    wording_version: "demo-1",
    understanding_check_passed: 1,
    decision: "GRANTED",
    valid_from: now,
    revoked_at: null,
    supersedes_id: null,
    metadata: JSON.stringify({ caregiver: tanvirUserId }),
  });

  // Encounter (today)
  const encounterId = id("enc");
  EncounterRepo.insert({
    id: encounterId,
    case_id: caseId,
    provider_id: providerId,
    event_date: now,
    date_precision: "DAY",
    kind: "WALK_IN",
    status: "OPEN",
    created_at: now,
  });

  // Helper to register source artifact + admit a fact in one shot.
  type AdmitMedicationArgs = {
    sourceId: string;
    kind: "PRESCRIBED" | "SEEN_AT_HOME" | "PATIENT_REPORTED_USE" | "CAREGIVER_REPORTED_USE";
    raw: string;
    brand: string;
    ingredientId: string;
    ingredientName: string;
    strength: number;
    strengthUnit: string;
    eventDate: string;
    datePrecision: string;
    anchors: string[];
    uncertain?: boolean;
  };

  function admitMedication(a: AdmitMedicationArgs): string {
    const sourceRow = SourceArtifactRepo.byId(a.sourceId);
    if (!sourceRow) throw new Error(`Missing source ${a.sourceId}`);
    const factId = id("fact");
    FactRepo.insert({
      id: factId,
      resource_id: id("res"),
      case_id: caseId,
      kind: "MEDICATION",
      current_revision_id: null,
      logical_key: `${a.brand.toLowerCase()}-${a.strength}`,
    });
    const revisionId = id("rev");
    FactRevisionRepo.insert({
      id: revisionId,
      resource_id: id("res"),
      fact_id: factId,
      revision_no: 1,
      raw_representation: a.raw,
      normalized_payload: JSON.stringify({
        brand: a.brand,
        ingredientName: a.ingredientName,
        strength: a.strength,
        unit: a.strengthUnit,
      }),
      event_date: a.eventDate,
      date_precision: a.datePrecision,
      origin_kind: "DOCUMENT",
      processing_state: a.uncertain ? "NEEDS_REVIEW" : "NORMALIZED",
      review_state: "CONTRIBUTOR_CONFIRMED",
      validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([
        { stage: "OCR", value: a.uncertain ? 0.62 : 0.96, method: a.uncertain ? "HANDWRITING_FIXTURE" : "PRINTED_RX_FIXTURE" },
        { stage: "ENTITY_LINK", value: 0.95, method: "DEMO_REGISTRY_LOOKUP" },
      ]),
      author_id: rahimaUserId,
      supersedes_revision_id: null,
      created_at: now,
    });
    FactRepo.setCurrentRevision(factId, revisionId);

    MedicationClaimRepo.insert({
      fact_revision_id: revisionId,
      product_id: a.brand.toLowerCase().includes("secure") || a.brand.toLowerCase().includes("seclo") ? "p_secure"
        : a.brand.toLowerCase().includes("maxpro") ? "p_maxpro"
        : a.brand.toLowerCase().includes("amlopres 5") ? "p_amlopres_5"
        : a.brand.toLowerCase().includes("amlopres 10") ? "p_amlopres_10"
        : a.brand.toLowerCase().includes("metformin") ? "p_metformin_500"
        : a.brand.toLowerCase().includes("atorvastatin") ? null
        : null,
      brand: a.brand,
      manufacturer: null,
      ingredient_ids: JSON.stringify([a.ingredientId]),
      ingredient_names: JSON.stringify([a.ingredientName]),
      strength_value: a.strength,
      strength_unit: a.strengthUnit,
      form: "TABLET",
      route: "ORAL",
      dose_raw: "1 tablet",
      frequency_raw: "1+0+1",
      parsed_schedule: JSON.stringify(["morning"]),
      duration_raw: "30 days",
      evidence_kind: a.kind,
      claimed_lifecycle: a.kind === "PRESCRIBED" ? "STARTED" : "CONTINUED",
      effective_start: a.eventDate,
      effective_end: null,
      provider_id: providerId,
      unknown_reason: null,
    });

    // Evidence anchors + edges
    for (const anc of a.anchors) {
      EvidenceAnchorRepo.insert({
        id: anc,
        resource_id: id("res"),
        source_artifact_id: a.sourceId,
        page_id: null,
        bbox: JSON.stringify({ x0: 0.1, y0: 0.1, x1: 0.4, y1: 0.18 }),
        text_start: null,
        text_end: null,
        audio_start_ms: null,
        audio_end_ms: null,
        quote_original: a.raw,
        source_version_hash: sha(a.sourceId + revisionId),
      });
      EvidenceEdgeRepo.insert({
        id: id("edge"),
        case_id: caseId,
        derived_resource_id: revisionId,
        source_resource_id: anc,
        relation: "DERIVES_FROM",
        transformation_version: "demo-1",
      });
    }
    return revisionId;
  }

  function admitLabObservation(args: {
    sourceId: string;
    rawText: string;
    analyte: string;
    value: number;
    unit: string;
    labDefId: string;
    date: string;
    anchor: string;
  }): string {
    const factId = id("fact");
    FactRepo.insert({
      id: factId,
      resource_id: id("res"),
      case_id: caseId,
      kind: "LAB",
      current_revision_id: null,
      logical_key: `${args.analyte.toLowerCase()}-${args.date}`,
    });
    const revisionId = id("rev");
    FactRevisionRepo.insert({
      id: revisionId,
      resource_id: id("res"),
      fact_id: factId,
      revision_no: 1,
      raw_representation: args.rawText,
      normalized_payload: JSON.stringify({ analyte: args.analyte, value: args.value, unit: args.unit }),
      event_date: args.date,
      date_precision: "DAY",
      origin_kind: "DOCUMENT",
      processing_state: "NORMALIZED",
      review_state: "CONTRIBUTOR_CONFIRMED",
      validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([{ stage: "OCR", value: 0.95, method: "LAB_FIXTURE" }]),
      author_id: rahimaUserId,
      supersedes_revision_id: null,
      created_at: now,
    });
    FactRepo.setCurrentRevision(factId, revisionId);
    LabObservationRepo.insert({
      fact_revision_id: revisionId,
      lab_definition_id: args.labDefId,
      analyte: args.analyte,
      original_test: args.analyte,
      original_value: String(args.value),
      original_unit: args.unit,
      original_range: null,
      normalized_decimal: args.value,
      normalized_unit: args.unit,
      conversion_version: "demo-1",
      method: "HPLC",
      specimen: "BLOOD_SERUM",
      laboratory: "Demo Lab",
      result_date: args.date,
      date_precision: "DAY",
    });
    EvidenceAnchorRepo.insert({
      id: args.anchor,
      resource_id: id("res"),
      source_artifact_id: args.sourceId,
      page_id: null,
      bbox: JSON.stringify({ x0: 0.1, y0: 0.3, x1: 0.6, y1: 0.4 }),
      text_start: null,
      text_end: null,
      audio_start_ms: null,
      audio_end_ms: null,
      quote_original: args.rawText,
      source_version_hash: sha(args.sourceId + revisionId),
    });
    EvidenceEdgeRepo.insert({
      id: id("edge"),
      case_id: caseId,
      derived_resource_id: revisionId,
      source_resource_id: args.anchor,
      relation: "DERIVES_FROM",
      transformation_version: "demo-1",
    });
    return revisionId;
  }

  function admitAllergy(args: {
    sourceId: string;
    substance: string;
    reactionText: string;
    anchor: string;
  }): string {
    const factId = id("fact");
    FactRepo.insert({
      id: factId,
      resource_id: id("res"),
      case_id: caseId,
      kind: "ALLERGY",
      current_revision_id: null,
      logical_key: `allergy-${args.substance.toLowerCase()}`,
    });
    const revisionId = id("rev");
    FactRevisionRepo.insert({
      id: revisionId,
      resource_id: id("res"),
      fact_id: factId,
      revision_no: 1,
      raw_representation: `${args.substance}: ${args.reactionText}`,
      normalized_payload: JSON.stringify({ substance: args.substance, reactionText: args.reactionText, verification: "REPORTED" }),
      event_date: iso(2023, 5, 10),
      date_precision: "DAY",
      origin_kind: "DOCUMENT",
      processing_state: "NORMALIZED",
      review_state: "CONTRIBUTOR_CONFIRMED",
      validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([{ stage: "OCR", value: 0.78, method: "DISCHARGE_FIXTURE" }]),
      author_id: rahimaUserId,
      supersedes_revision_id: null,
      created_at: now,
    });
    FactRepo.setCurrentRevision(factId, revisionId);
    EvidenceAnchorRepo.insert({
      id: args.anchor,
      resource_id: id("res"),
      source_artifact_id: args.sourceId,
      page_id: null,
      bbox: JSON.stringify({ x0: 0.1, y0: 0.5, x1: 0.6, y1: 0.6 }),
      text_start: null,
      text_end: null,
      audio_start_ms: null,
      audio_end_ms: null,
      quote_original: `${args.substance}: ${args.reactionText}`,
      source_version_hash: sha(args.sourceId + revisionId),
    });
    EvidenceEdgeRepo.insert({
      id: id("edge"),
      case_id: caseId,
      derived_resource_id: revisionId,
      source_resource_id: args.anchor,
      relation: "DERIVES_FROM",
      transformation_version: "demo-1",
    });
    return revisionId;
  }

  // Register all source artifacts first (consistent ordering).
  const sources: Array<{ id: string; kind: "DOCUMENT" | "STRIP" | "AUDIO" | "TYPED"; state: "ADMITTED" | "QUARANTINED" | "REVIEW_REQUIRED"; filename: string; eventDate: string; hash: string; payload: string }> = [
    { id: "src_rx_a", kind: "DOCUMENT", state: "ADMITTED", filename: "prescription-2026-03.pdf", eventDate: iso(2026, 3, 15), hash: sha("src_rx_a"), payload: "demo-payload" },
    { id: "src_rx_b_handwritten", kind: "DOCUMENT", state: "REVIEW_REQUIRED", filename: "prescription-handwritten-2026-06.pdf", eventDate: iso(2026, 6, 2), hash: sha("src_rx_b_handwritten"), payload: "demo-payload" },
    { id: "src_discharge_2023", kind: "DOCUMENT", state: "ADMITTED", filename: "discharge-2023.pdf", eventDate: iso(2023, 5, 10), hash: sha("src_discharge_2023"), payload: "demo-payload" },
    { id: "src_lab_2024", kind: "DOCUMENT", state: "ADMITTED", filename: "lab-2024.pdf", eventDate: iso(2024, 9, 14), hash: sha("src_lab_2024"), payload: "demo-payload" },
    { id: "src_lab_2025", kind: "DOCUMENT", state: "ADMITTED", filename: "lab-2025.pdf", eventDate: iso(2025, 12, 8), hash: sha("src_lab_2025"), payload: "demo-payload" },
    { id: "src_wrong_patient", kind: "DOCUMENT", state: "QUARANTINED", filename: "wrong-patient.pdf", eventDate: iso(2024, 8, 1), hash: sha("src_wrong_patient"), payload: "demo-payload" },
    { id: "src_followup", kind: "DOCUMENT", state: "ADMITTED", filename: "followup-2025.pdf", eventDate: iso(2025, 6, 22), hash: sha("src_followup"), payload: "demo-payload" },
    { id: "src_strip_a", kind: "STRIP", state: "ADMITTED", filename: "strip-amlopres10.jpg", eventDate: iso(2026, 8, 20), hash: sha("src_strip_a"), payload: "demo-payload" },
    { id: "src_strip_b", kind: "STRIP", state: "ADMITTED", filename: "strip-seclo20.jpg", eventDate: iso(2026, 8, 20), hash: sha("src_strip_b"), payload: "demo-payload" },
    { id: "src_rx_today", kind: "DOCUMENT", state: "ADMITTED", filename: "prescription-today.pdf", eventDate: now, hash: sha("src_rx_today"), payload: "demo-payload" },
  ];
  for (const s of sources) {
    SourceArtifactRepo.insert({
      id: s.id,
      resource_id: id("res"),
      case_id: caseId,
      kind: s.kind,
      object_key: null,
      content_hash: s.hash,
      mime_type: s.kind === "STRIP" ? "image/jpeg" : "application/pdf",
      size_bytes: 1024,
      filename_safe: s.filename,
      source_payload: s.payload,
      respondent_id: null,
      respondent_role: null,
      captured_at: s.eventDate,
      event_date: s.eventDate,
      consent_id: consentGeneralId,
      question_id: null,
      transcript_of_id: null,
      deletion_due_at: null,
      state: s.state,
    });
    ProcessingRunRepo.insert({
      id: id("run"),
      source_id: s.id,
      stage: s.state === "QUARANTINED" ? "IDENTITY_REVIEW" : "ADMIT",
      adapter: "mock",
      provider: "demo",
      model_id: "mock-demo-1.0.0",
      prompt_version: "demo-1",
      schema_version: "ai-adapter-1.0.0",
      input_hash: s.hash,
      output_resource_id: null,
      dictionary_version: TERMINOLOGY_VERSION,
      policy_fingerprint: "demo-1.0.0",
      privacy_epoch: 1,
    });
    ProcessingRunRepo.finish(`run_${s.id.replace(/^src_/, "")}`, "SUCCEEDED", null, 80);
  }

  // Medications
  admitMedication({ sourceId: "src_rx_a", kind: "PRESCRIBED", raw: "Seclo 20", brand: "Seclo 20", ingredientId: "c_omeprazole", ingredientName: "omeprazole", strength: 20, strengthUnit: "mg", eventDate: iso(2026, 3, 15), datePrecision: "DAY", anchors: ["anc_rx_a_1"] });
  admitMedication({ sourceId: "src_rx_a", kind: "PRESCRIBED", raw: "Amlopres 5", brand: "Amlopres 5", ingredientId: "c_amlodipine", ingredientName: "amlodipine", strength: 5, strengthUnit: "mg", eventDate: iso(2026, 3, 15), datePrecision: "DAY", anchors: ["anc_rx_a_2"] });
  admitMedication({ sourceId: "src_rx_a", kind: "PRESCRIBED", raw: "Metformin 500", brand: "Metformin 500", ingredientId: "c_metformin", ingredientName: "metformin", strength: 500, strengthUnit: "mg", eventDate: iso(2026, 3, 15), datePrecision: "DAY", anchors: ["anc_rx_a_3"] });
  // Handwritten: requires review
  admitMedication({ sourceId: "src_rx_b_handwritten", kind: "PRESCRIBED", raw: "Amlopres 10 (handwritten)", brand: "Amlopres 10", ingredientId: "c_amlodipine", ingredientName: "amlodipine", strength: 10, strengthUnit: "mg", eventDate: iso(2026, 6, 2), datePrecision: "DAY", anchors: ["anc_rx_b_1"], uncertain: true });
  // Strip evidence
  admitMedication({ sourceId: "src_strip_a", kind: "SEEN_AT_HOME", raw: "Strip: Amlopres 10", brand: "Amlopres 10", ingredientId: "c_amlodipine", ingredientName: "amlodipine", strength: 10, strengthUnit: "mg", eventDate: iso(2026, 8, 20), datePrecision: "DAY", anchors: ["anc_strip_a_1"] });
  admitMedication({ sourceId: "src_strip_b", kind: "SEEN_AT_HOME", raw: "Strip: Seclo 20", brand: "Seclo 20", ingredientId: "c_omeprazole", ingredientName: "omeprazole", strength: 20, strengthUnit: "mg", eventDate: iso(2026, 8, 20), datePrecision: "DAY", anchors: ["anc_strip_b_1"] });
  // Today's Rx
  admitMedication({ sourceId: "src_rx_today", kind: "PRESCRIBED", raw: "Maxpro 20", brand: "Maxpro 20", ingredientId: "c_esomeprazole", ingredientName: "esomeprazole", strength: 20, strengthUnit: "mg", eventDate: now, datePrecision: "DAY", anchors: ["anc_rx_today_1"] });
  admitMedication({ sourceId: "src_rx_today", kind: "PRESCRIBED", raw: "Amlopres 5", brand: "Amlopres 5", ingredientId: "c_amlodipine", ingredientName: "amlodipine", strength: 5, strengthUnit: "mg", eventDate: now, datePrecision: "DAY", anchors: ["anc_rx_today_2"] });
  admitMedication({ sourceId: "src_rx_today", kind: "PRESCRIBED", raw: "Metformin 500", brand: "Metformin 500", ingredientId: "c_metformin", ingredientName: "metformin", strength: 500, strengthUnit: "mg", eventDate: now, datePrecision: "DAY", anchors: ["anc_rx_today_3"] });
  // Follow-up paper continues Amlopres 5 + Metformin
  admitMedication({ sourceId: "src_followup", kind: "PRESCRIBED", raw: "Amlopres 5", brand: "Amlopres 5", ingredientId: "c_amlodipine", ingredientName: "amlodipine", strength: 5, strengthUnit: "mg", eventDate: iso(2025, 6, 22), datePrecision: "DAY", anchors: ["anc_followup_1"] });
  admitMedication({ sourceId: "src_followup", kind: "PRESCRIBED", raw: "Metformin 500", brand: "Metformin 500", ingredientId: "c_metformin", ingredientName: "metformin", strength: 500, strengthUnit: "mg", eventDate: iso(2025, 6, 22), datePrecision: "DAY", anchors: ["anc_followup_2"] });

  // Test order from src_rx_a (HbA1c advised)
  {
    const factId = id("fact");
    FactRepo.insert({
      id: factId,
      resource_id: id("res"),
      case_id: caseId,
      kind: "TEST_ORDER",
      current_revision_id: null,
      logical_key: "order-hba1c-2026-03",
    });
    const revisionId = id("rev");
    FactRevisionRepo.insert({
      id: revisionId,
      resource_id: id("res"),
      fact_id: factId,
      revision_no: 1,
      raw_representation: "Advised HbA1c in 3 months",
      normalized_payload: JSON.stringify({ analyte: "HbA1c" }),
      event_date: iso(2026, 3, 15),
      date_precision: "DAY",
      origin_kind: "DOCUMENT",
      processing_state: "NORMALIZED",
      review_state: "CONTRIBUTOR_CONFIRMED",
      validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([{ stage: "OCR", value: 0.92, method: "PRINTED_RX_FIXTURE" }]),
      author_id: rahimaUserId,
      supersedes_revision_id: null,
      created_at: now,
    });
    FactRepo.setCurrentRevision(factId, revisionId);
    TestOrderRepo.insert({
      fact_revision_id: revisionId,
      lab_definition_id: "l_hba1c",
      test_name: "HbA1c",
      instruction_raw: "HbA1c in 3 months",
      ordered_date: iso(2026, 3, 15),
      encounter_id: encounterId,
    });
    EvidenceAnchorRepo.insert({
      id: "anc_rx_a_4",
      resource_id: id("res"),
      source_artifact_id: "src_rx_a",
      page_id: null,
      bbox: JSON.stringify({ x0: 0.1, y0: 0.7, x1: 0.5, y1: 0.78 }),
      text_start: null,
      text_end: null,
      audio_start_ms: null,
      audio_end_ms: null,
      quote_original: "HbA1c in 3 months",
      source_version_hash: sha("src_rx_a" + revisionId),
    });
  }

  admitLabObservation({ sourceId: "src_lab_2024", rawText: "HbA1c 7.2 %", analyte: "HbA1c", value: 7.2, unit: "%", labDefId: "l_hba1c", date: iso(2024, 9, 14), anchor: "anc_lab_2024_1" });
  admitLabObservation({ sourceId: "src_lab_2024", rawText: "Creatinine 0.9 mg/dL", analyte: "creatinine", value: 0.9, unit: "mg/dL", labDefId: "l_creatinine", date: iso(2024, 9, 14), anchor: "anc_lab_2024_2" });
  admitLabObservation({ sourceId: "src_lab_2025", rawText: "HbA1c 6.8 %", analyte: "HbA1c", value: 6.8, unit: "%", labDefId: "l_hba1c", date: iso(2025, 12, 8), anchor: "anc_lab_2025_1" });
  admitLabObservation({ sourceId: "src_lab_2025", rawText: "FPG 6.1 mmol/L", analyte: "FPG", value: 6.1, unit: "mmol/L", labDefId: "l_fpg", date: iso(2025, 12, 8), anchor: "anc_lab_2025_2" });

  // Allergy
  admitAllergy({ sourceId: "src_discharge_2023", substance: "amoxicillin", reactionText: "rash reported after amoxicillin", anchor: "anc_discharge_1" });

  // Narrative complaint + agenda
  {
    const factId = id("fact");
    FactRepo.insert({ id: factId, resource_id: id("res"), case_id: caseId, kind: "COMPLAINT", current_revision_id: null, logical_key: "complaint-current" });
    const revisionId = id("rev");
    FactRevisionRepo.insert({
      id: revisionId, resource_id: id("res"), fact_id: factId, revision_no: 1,
      raw_representation: "বুক জ্বালা করে, গলা শুকিয়ে যায়, রাতে ঘুম হয় না",
      normalized_payload: JSON.stringify({ complaintBn: "বুক জ্বালা করে, গলা শুকিয়ে যায়, রাতে ঘুম হয় না", complaintEn: "Acid reflux, dry throat, poor sleep at night" }),
      event_date: now, date_precision: "DAY", origin_kind: "PATIENT",
      processing_state: "NORMALIZED", review_state: "CONTRIBUTOR_CONFIRMED", validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([{ stage: "ASR", value: 0.81, method: "MOCK_BN_FIXTURE" }]),
      author_id: rahimaUserId, supersedes_revision_id: null, created_at: now,
    });
    FactRepo.setCurrentRevision(factId, revisionId);
  }

  // Wellbeing entry (demo): patient chose to share with Dr A.
  {
    const factId = id("fact");
    FactRepo.insert({ id: factId, resource_id: id("res"), case_id: caseId, kind: "WELLBEING", current_revision_id: null, logical_key: "wellbeing-entry-1" });
    const revisionId = id("rev");
    FactRevisionRepo.insert({
      id: revisionId, resource_id: id("res"), fact_id: factId, revision_no: 1,
      raw_representation: "ঘুম কম হচ্ছে, মাঝে মাঝে মন খারাপ লাগে, স্বামী হারানোর পর থেকে",
      normalized_payload: JSON.stringify({
        topicSelected: "sleep",
        onset: "2024-01-01", datePrecision: "MONTH",
        requestDiscussion: true, presentationPreference: "RESPECTFUL",
      }),
      event_date: iso(2024, 1, 1), date_precision: "MONTH", origin_kind: "PATIENT",
      processing_state: "NORMALIZED", review_state: "CONTRIBUTOR_CONFIRMED", validity_state: "CURRENT",
      confidence_by_stage: JSON.stringify([]),
      author_id: rahimaUserId, supersedes_revision_id: null, created_at: now,
    });
    FactRepo.setCurrentRevision(factId, revisionId);
    WellbeingRepo.insert({
      fact_revision_id: revisionId,
      resource_id: id("res"),
      case_id: caseId,
      respondent_id: rahimaUserId,
      original_input_id: null,
      topic_selected: "sleep",
      onset: iso(2024, 1, 1),
      date_precision: "MONTH",
      original_wording: "ঘুম কম হচ্ছে, মাঝে মাঝে মন খারাপ লাগে",
      confirmed_summary: "Patient reports reduced sleep and occasional low mood since bereavement.",
      request_discussion: 1,
      presentation_preference: "RESPECTFUL",
      confirmation_at: now,
    });
  }

  // WHO-5 instrument definition (DEMO_ONLY) + items.
  const who5DefId = "inst_who5_bn";
  InstrumentDefinitionRepo.insert({
    id: who5DefId,
    instrument_key: "WHO5",
    definition_version: WHO5_DEFINITION_VERSION,
    language: "bn",
    source_url: "https://www.who.int/publications/m/item/WHO-UCN-MSD-MHE-2024.01",
    source_file_hash: sha("who5-demo"),
    content_checksum: WHO5_DEFINITION_CHECKSUM,
    rights_metadata: "Demo paraphrase of the WHO-5 Well-Being Index. NOT the verbatim official text.",
    attribution: "WHO-5 Well-Being Index — demo paraphrase; replace with verbatim text after G02.",
    timeframe: "last 2 weeks",
    scoring_version: WHO5_SCORE_VERSION,
    activation_status: "DEMO_ONLY",
    content_reviewer: "demo-reviewer",
    reviewed_at: now,
  });
  for (const [idx, item] of WHO5_FIXED_DEMO_ITEMS.entries()) {
    InstrumentItemRepo.insert({
      id: `inst_item_who5_${idx + 1}`,
      definition_id: who5DefId,
      item_key: item.id,
      ordinal: idx + 1,
      exact_text: item.bn,
      exact_options_json: JSON.stringify(item.options.map((o) => ({ value: o.value, label: o.bn }))),
      value_min: 0,
      value_max: 5,
    });
  }

  // Pre-built WHO-5 session with synthetic responses [2,3,1,4,2] -> raw 12, transformed 48
  const sessionId = id("assn");
  AssessmentSessionRepo.insert({
    id: sessionId,
    resource_id: id("res"),
    definition_id: who5DefId,
    case_id: caseId,
    patient_id: patientId,
    respondent_id: rahimaUserId,
    consent_id: consentAssessmentId,
    administration_mode: "FIXED_TEXT",
    current_revision: 1,
    started_at: now,
    submitted_at: now,
    completion_state: "SCORED",
  });
  const revisionId = id("rev");
  const responseValues: Record<string, number> = { who5_1: 2, who5_2: 3, who5_3: 1, who5_4: 4, who5_5: 2 };
  const responseHash = ["who5_1=2", "who5_2=3", "who5_3=1", "who5_4=4", "who5_5=2"].join("|");
  AssessmentRevisionRepo.insert({
    id: revisionId,
    resource_id: id("res"),
    session_id: sessionId,
    revision_no: 1,
    definition_checksum: WHO5_DEFINITION_CHECKSUM,
    response_hash: responseHash,
    scoring_version: WHO5_SCORE_VERSION,
    raw_total: 12,
    transformed_score: 48,
    submitted_at: now,
    scored_at: now,
    supersedes_id: null,
  });
  for (const [itemId, value] of Object.entries(responseValues)) {
    AssessmentResponseRepo.insert({
      id: id("resp"),
      assessment_revision_id: revisionId,
      item_id: itemId,
      value,
      disposition: "ANSWERED",
      confirmed_at: now,
      source_input_id: null,
    });
  }

  // Support resources (DEMO_ONLY)
  SupportResourceRepo.insert({
    id: id("supres"),
    jurisdiction: "BD",
    language: "bn",
    channel: "Hotline",
    display_contact: "Kaan Pete Roi (demo placeholder)",
    hours: "Daily 8am–10pm",
    source_url: "https://example.org/demo-support",
    last_verified_at: now,
    expires_at: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    review_owner: "demo-operator",
    status: "VERIFIED",
  });
  SupportProtocolRepo.insert({
    id: id("supproto"),
    version: "demo-1.0.0",
    language: "bn",
    templates: JSON.stringify([
      { id: "explicit", bn: "আপনি একা নন। সাহায্য নেওয়া সাহসের কাজ।", en: "You are not alone. Asking for help is brave." },
      { id: "ambiguous", bn: "আপনার অনুভূতি গুরুত্বপূর্ণ। কেউ একজন আছেন যিনি শুনতে চান।", en: "Your feelings matter. Someone is here to listen." },
    ]),
    observation_rules: "demo-rules-v1",
    source_refs: "demo",
    reviewed_by: "demo-reviewer",
    activation_mode: "DEMO_ONLY",
    content_checksum: sha("support-protocol-demo"),
  });

  // Evaluation set: 9 frozen fixtures covering the A01–A09 acceptance scenarios.
  const evSetId = "ev_set_demo";
  EvaluationSetRepo.insert({
    id: evSetId,
    name: "MedLens AI Acceptance Fixtures",
    version: "demo-1.0.0",
    manifest_hash: sha("manifest-demo"),
    synthetic_only: 1,
    frozen_at: now,
  });
  const evFixtures: { key: string; expected: { admitted: number; accepted: number; rejected: number }; slices: string[] }[] = [
    { key: "A01_known_brand_resolved", expected: { admitted: 1, accepted: 1, rejected: 0 }, slices: ["brand_resolution"] },
    { key: "A02_handwritten_needs_review", expected: { admitted: 0, accepted: 0, rejected: 1 }, slices: ["needs_review"] },
    { key: "A03_lab_alias_normalized", expected: { admitted: 1, accepted: 1, rejected: 0 }, slices: ["lab_normalization"] },
    { key: "A04_wrong_patient_quarantined", expected: { admitted: 0, accepted: 0, rejected: 1 }, slices: ["quarantine"] },
    { key: "A05_duplicate_strength_resolved", expected: { admitted: 1, accepted: 1, rejected: 0 }, slices: ["duplicate"] },
    { key: "A06_brand_conflict_escalated", expected: { admitted: 0, accepted: 0, rejected: 1 }, slices: ["escalation"] },
    { key: "A07_wellbeing_current_recognized", expected: { admitted: 1, accepted: 1, rejected: 0 }, slices: ["wellbeing"] },
    { key: "A08_wellbeing_negated_ignored", expected: { admitted: 0, accepted: 0, rejected: 1 }, slices: ["wellbeing"] },
    { key: "A09_wellbeing_quoted_ignored", expected: { admitted: 0, accepted: 0, rejected: 1 }, slices: ["wellbeing"] },
  ];
  for (const fx of evFixtures) {
    EvaluationCaseRepo.insert({
      id: `evcase_${nanoid(8)}`,
      set_id: evSetId,
      fixture_key: fx.key,
      asset_hashes: "{}",
      expected_json: JSON.stringify({ expectedAdmitted: fx.expected.admitted, expectedAccepted: fx.expected.accepted, expectedRejected: fx.expected.rejected }),
      label_author: "demo-author",
      adjudicator: "demo-adjudicator",
      slice_tags: fx.slices.join(","),
    });
  }

  return {
    caseId,
    patientUserId: rahimaUserId,
    caregiverUserId: tanvirUserId,
    doctorAUserId,
    doctorBUserId,
    evaluatorUserId,
    operatorUserId,
    passwords,
  };
}

if (require.main === module) {
  const r = seedDemo();
  // Print the credentials so the demo operator can copy/paste.
  // eslint-disable-next-line no-console
  console.log("Seeded demo case:", r.caseId);
  // eslint-disable-next-line no-console
  console.log("Login credentials (demo):");
  for (const [subject, pw] of Object.entries(r.passwords)) {
    // eslint-disable-next-line no-console
    console.log(`  ${subject}  /  ${pw}`);
  }
  getDb().close();
}
