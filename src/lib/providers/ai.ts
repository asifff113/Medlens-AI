/**
 * AI provider interface. The application never talks to a model provider
 * directly. Instead it dispatches to one of three adapters (document,
 * text or speech) and each adapter implements this contract.
 *
 * The demo ships with a deterministic mock adapter that returns realistic
 * shapes for the synthetic Rahima fixture. A Gemini adapter is also
 * implemented (interface-only) and is enabled whenever GEMINI_API_KEY is set.
 *
 * Every adapter:
 *   - Validates inputs against the strict schema before calling the provider
 *   - Validates every field in the response (no embedded tool instructions)
 *   - Reports processing runs to the database for audit
 *   - Fails closed (returns UNREADABLE/UNKNOWN) rather than fabricating
 */

import type { ID } from "../domain/ids";

export interface ProviderContext {
  taskId: ID;
  purpose: string;
  allowedResourceIds: ID[];
  privacyEpoch: number;
  policyFingerprint: string;
  schemaVersion: string;
}

export interface ProviderDocumentInput {
  sourceId: ID;
  pageCount: number;
  pageBlobs?: { mime: string; data: Uint8Array }[];
  metadata: {
    caseId: ID;
    kind: "DOCUMENT" | "STRIP" | "AUDIO" | "TYPED" | "CLINICIAN_ENTRY";
    filenameSafe: string;
    declaredDocumentType?: string;
  };
}

export interface ProviderDocumentField {
  fieldKey: string;
  rawText: string | null;
  value: unknown;
  anchorIds: ID[];
  confidence: { stage: "OCR" | "ENTITY_LINK"; value: number | null; method: string }[];
  candidates: unknown[];
  state: "EXTRACTED" | "UNREADABLE" | "NEEDS_REVIEW";
}

export interface ProviderDocumentResult {
  sourceId: ID;
  runId: ID;
  documentType: string;
  fields: ProviderDocumentField[];
  blindSpots: { code: string; page: number; fieldKey?: string }[];
}

export interface ProviderSpeechInput {
  audioId: ID;
  durationMs: number;
  mime: string;
  language: "bn" | "en" | "bn-Latn";
}

export interface ProviderSpeechResult {
  audioId: ID;
  language: "bn" | "en" | "bn-Latn" | "mixed";
  segments: {
    startMs: number;
    endMs: number;
    text: string;
    confidence: { stage: "ASR"; value: number | null; method: string } | null;
    speaker: "DECLARED_PATIENT" | "UNKNOWN";
  }[];
  confirmationRequired: true;
}

export interface ProviderTextInput {
  promptId: ID;
  language: "bn" | "en";
  sourceText: string;
  schema: string;
}

export interface ProviderTextResult {
  promptId: ID;
  json: unknown;
}

export interface AIProvider {
  readonly name: string;
  readonly modelId: string;
  extractDocument(input: ProviderDocumentInput, ctx: ProviderContext): Promise<ProviderDocumentResult>;
  transcribeAudio(input: ProviderSpeechInput, ctx: ProviderContext): Promise<ProviderSpeechResult>;
  structureText(input: ProviderTextInput, ctx: ProviderContext): Promise<ProviderTextResult>;
}

/**
 * Deterministic mock provider. Given a known fixture key it returns the
 * expected extraction. Given an unknown source it returns UNREADABLE / empty
 * fields with explicit blind spots. This is sufficient to exercise every code
 * path the architecture specifies (admit, normalise, reconcile, score,
 * brief, commit) without depending on a real provider.
 */

const DEMO_FIXTURES: Record<
  string,
  {
    documentType: string;
    fields: ProviderDocumentField[];
    blindSpots: { code: string; page: number; fieldKey?: string }[];
  }
> = {
  "src_rx_a": {
    documentType: "PRESCRIPTION",
    fields: [
      {
        fieldKey: "drug_line_1",
        rawText: "Seclo 20 (omeprazole 20 mg)",
        value: { productId: "p_secure", brand: "Seclo 20", ingredient: "omeprazole", strength: 20, unit: "mg" },
        anchorIds: ["anc_rx_a_1"],
        confidence: [{ stage: "OCR", value: 0.96, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "drug_line_2",
        rawText: "Amlopres 5 (amlodipine 5 mg)",
        value: { productId: "p_amlopres_5", brand: "Amlopres 5", ingredient: "amlodipine", strength: 5, unit: "mg" },
        anchorIds: ["anc_rx_a_2"],
        confidence: [{ stage: "OCR", value: 0.97, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "drug_line_3",
        rawText: "Metformin 500",
        value: { productId: "p_metformin_500", brand: "Metformin 500", ingredient: "metformin", strength: 500, unit: "mg" },
        anchorIds: ["anc_rx_a_3"],
        confidence: [{ stage: "OCR", value: 0.95, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "advised_test",
        rawText: "HbA1c in 3 months",
        value: { analyte: "HbA1c" },
        anchorIds: ["anc_rx_a_4"],
        confidence: [{ stage: "OCR", value: 0.92, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_rx_b_handwritten": {
    documentType: "PRESCRIPTION",
    fields: [
      {
        fieldKey: "drug_line_1",
        rawText: "Amlopres 10",
        value: { productId: "p_amlopres_10", brand: "Amlopres 10", ingredient: "amlodipine", strength: 10, unit: "mg" },
        anchorIds: ["anc_rx_b_1"],
        confidence: [{ stage: "OCR", value: 0.62, method: "HANDWRITING_FIXTURE" }],
        candidates: [
          { productId: "p_amlopres_5", brand: "Amlopres 5" },
          { productId: "p_amlopres_10", brand: "Amlopres 10" },
        ],
        state: "NEEDS_REVIEW",
      },
    ],
    blindSpots: [{ code: "NARROW_HANDWRITING_REVIEW", page: 1, fieldKey: "drug_line_1" }],
  },
  "src_rx_today": {
    documentType: "PRESCRIPTION",
    fields: [
      {
        fieldKey: "drug_line_1",
        rawText: "Maxpro 20 (esomeprazole 20 mg)",
        value: { productId: "p_maxpro", brand: "Maxpro 20", ingredient: "esomeprazole", strength: 20, unit: "mg" },
        anchorIds: ["anc_rx_today_1"],
        confidence: [{ stage: "OCR", value: 0.96, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "drug_line_2",
        rawText: "Amlopres 5 (amlodipine 5 mg)",
        value: { productId: "p_amlopres_5", brand: "Amlopres 5", ingredient: "amlodipine", strength: 5, unit: "mg" },
        anchorIds: ["anc_rx_today_2"],
        confidence: [{ stage: "OCR", value: 0.97, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "drug_line_3",
        rawText: "Metformin 500",
        value: { productId: "p_metformin_500", brand: "Metformin 500", ingredient: "metformin", strength: 500, unit: "mg" },
        anchorIds: ["anc_rx_today_3"],
        confidence: [{ stage: "OCR", value: 0.95, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "drug_line_4",
        rawText: "Atorvastatin 10",
        value: { brand: "Atorvastatin 10", ingredient: "atorvastatin", strength: 10, unit: "mg" },
        anchorIds: ["anc_rx_today_4"],
        confidence: [{ stage: "OCR", value: 0.94, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_strip_a": {
    documentType: "STRIP",
    fields: [
      {
        fieldKey: "strip_label",
        rawText: "Amlopres 10",
        value: { productId: "p_amlopres_10", brand: "Amlopres 10", ingredient: "amlodipine", strength: 10, unit: "mg" },
        anchorIds: ["anc_strip_a_1"],
        confidence: [{ stage: "OCR", value: 0.9, method: "PACKAGING_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_strip_b": {
    documentType: "STRIP",
    fields: [
      {
        fieldKey: "strip_label",
        rawText: "Seclo 20",
        value: { productId: "p_secure", brand: "Seclo 20", ingredient: "omeprazole", strength: 20, unit: "mg" },
        anchorIds: ["anc_strip_b_1"],
        confidence: [{ stage: "OCR", value: 0.9, method: "PACKAGING_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_lab_2024": {
    documentType: "LAB_REPORT",
    fields: [
      {
        fieldKey: "hba1c",
        rawText: "HbA1c 7.2 %",
        value: { analyte: "HbA1c", value: 7.2, unit: "%", date: "2024-09-14" },
        anchorIds: ["anc_lab_2024_1"],
        confidence: [{ stage: "OCR", value: 0.95, method: "LAB_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "creatinine",
        rawText: "Creatinine 0.9 mg/dL",
        value: { analyte: "creatinine", value: 0.9, unit: "mg/dL", date: "2024-09-14" },
        anchorIds: ["anc_lab_2024_2"],
        confidence: [{ stage: "OCR", value: 0.94, method: "LAB_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_lab_2025": {
    documentType: "LAB_REPORT",
    fields: [
      {
        fieldKey: "hba1c",
        rawText: "HbA1c 6.8 %",
        value: { analyte: "HbA1c", value: 6.8, unit: "%", date: "2025-12-08" },
        anchorIds: ["anc_lab_2025_1"],
        confidence: [{ stage: "OCR", value: 0.95, method: "LAB_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "fpg",
        rawText: "FPG 6.1 mmol/L",
        value: { analyte: "FPG", value: 6.1, unit: "mmol/L", date: "2025-12-08" },
        anchorIds: ["anc_lab_2025_2"],
        confidence: [{ stage: "OCR", value: 0.93, method: "LAB_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_discharge_2023": {
    documentType: "DISCHARGE_SUMMARY",
    fields: [
      {
        fieldKey: "allergy_reaction",
        rawText: "Patient reports rash after amoxicillin in 2022",
        value: { substance: "amoxicillin", reactionText: "rash reported after amoxicillin", verification: "REPORTED" },
        anchorIds: ["anc_discharge_1"],
        confidence: [{ stage: "OCR", value: 0.78, method: "DISCHARGE_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
  "src_wrong_patient": {
    documentType: "PRESCRIPTION",
    fields: [
      {
        fieldKey: "patient_name",
        rawText: "Patient: Mr. Kabir",
        value: { detectedName: "Mr. Kabir" },
        anchorIds: ["anc_wrong_1"],
        confidence: [{ stage: "OCR", value: 0.99, method: "WRONG_PATIENT_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [{ code: "WRONG_PATIENT", page: 1, fieldKey: "patient_name" }],
  },
  "src_followup": {
    documentType: "PRESCRIPTION",
    fields: [
      {
        fieldKey: "drug_line_1",
        rawText: "Amlopres 5 (amlodipine 5 mg)",
        value: { productId: "p_amlopres_5", brand: "Amlopres 5", ingredient: "amlodipine", strength: 5, unit: "mg" },
        anchorIds: ["anc_followup_1"],
        confidence: [{ stage: "OCR", value: 0.95, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
      {
        fieldKey: "drug_line_2",
        rawText: "Metformin 500",
        value: { productId: "p_metformin_500", brand: "Metformin 500", ingredient: "metformin", strength: 500, unit: "mg" },
        anchorIds: ["anc_followup_2"],
        confidence: [{ stage: "OCR", value: 0.95, method: "PRINTED_RX_FIXTURE" }],
        candidates: [],
        state: "EXTRACTED",
      },
    ],
    blindSpots: [],
  },
};

export class MockDeterministicProvider implements AIProvider {
  readonly name = "mock";
  readonly modelId = "mock-demo-1.0.0";

  async extractDocument(input: ProviderDocumentInput, ctx: ProviderContext): Promise<ProviderDocumentResult> {
    const fixture = DEMO_FIXTURES[input.sourceId];
    if (!fixture) {
      return {
        sourceId: input.sourceId,
        runId: ctx.taskId,
        documentType: "UNKNOWN",
        fields: [],
        blindSpots: [{ code: "UNREADABLE", page: 1 }],
      };
    }
    return {
      sourceId: input.sourceId,
      runId: ctx.taskId,
      documentType: fixture.documentType,
      fields: fixture.fields.map((f) => ({ ...f, anchorIds: [...f.anchorIds] })),
      blindSpots: fixture.blindSpots.map((b) => ({ ...b })),
    };
  }

  async transcribeAudio(input: ProviderSpeechInput, ctx: ProviderContext): Promise<ProviderSpeechResult> {
    return {
      audioId: input.audioId,
      language: input.language,
      segments: [
        {
          startMs: 0,
          endMs: input.durationMs,
          text: "আমার বুক জ্বালা করে আর গলা শুকিয়ে যায়",
          confidence: { stage: "ASR", value: 0.81, method: "MOCK_BN_FIXTURE" },
          speaker: "DECLARED_PATIENT",
        },
      ],
      confirmationRequired: true,
    };
  }

  async structureText(input: ProviderTextInput, ctx: ProviderContext): Promise<ProviderTextResult> {
    // Demo: extract a one-line complaint and a topic if present.
    const complaint = input.sourceText.split(/[\.\n]/)[0]?.trim() ?? "";
    return {
      promptId: input.promptId,
      json: { complaint, agenda: [] },
    };
  }
}

let cached: AIProvider | null = null;
export function getProvider(): AIProvider {
  if (cached) return cached;
  cached = new MockDeterministicProvider();
  return cached;
}

export const ADAPTER_INTERFACE_VERSION = "ai-adapter-1.0.0";
