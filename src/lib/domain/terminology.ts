/**
 * Curated terminology registries.
 *
 * Section 8.2 requires that terminology lookups never invent a drug identity
 * or an inferred condition. The registries below are intentionally explicit
 * and short. They are versioned so callers always see which dictionary
 * version produced a result.
 *
 * In production these assets live in /assets/registries. For the demo we
 * inline the small curated subset that the synthetic Rahima case actually
 * uses plus a small buffer of related Bangladesh brands.
 */

import type { ID } from "./ids";

export interface ConceptRecord {
  id: ID;
  kind: "MEDICATION_INGREDIENT" | "MEDICATION_CLASS" | "LAB_TEST" | "SYMPTOM_IDIOM";
  canonicalLabel: string;
  codeSystem?: string;
  code?: string;
  dictionaryVersion: string;
  aliases?: string[];
}

export interface DrugProductRecord {
  id: ID;
  brand: string;
  manufacturer: string;
  form: "TABLET" | "CAPSULE" | "STRIP" | "SYRUP" | "INJECTION";
  ingredientStrengths: { ingredientId: ID; ingredientName: string; strengthValue: number; strengthUnit: string }[];
  classIds: ID[];
  sourceUrl: string;
  sourceCheckedAt: string;
  rightsStatus: "VERIFIED" | "DEMO_ONLY";
  dictionaryVersion: string;
  synthetic: boolean;
}

export interface LabDefinitionRecord {
  id: ID;
  analyte: string;
  specimen: "BLOOD_SERUM" | "BLOOD_PLASMA" | "WHOLE_BLOOD" | "URINE";
  aliases: string[];
  canonicalUnit: string;
  permittedConversions: { from: string; to: string; factor: number }[];
  conversionVersion: string;
  methodComparability: string[];
  status: "VERIFIED" | "DEMO_ONLY";
  dictionaryVersion: string;
}

export interface IdiomRecord {
  id: ID;
  layTerm: string;
  layTermBn: string;
  possibleMeanings: string[];
  clarifyingTemplate: { bn: string; en: string };
  dictionaryVersion: string;
}

export const TERMINOLOGY_VERSION = "demo-1.0.0";

export const CONCEPTS: ConceptRecord[] = [
  { id: "c_amlodipine", kind: "MEDICATION_INGREDIENT", canonicalLabel: "amlodipine", codeSystem: "INN", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["amlodipine besylate", "amlodipine besilate"] },
  { id: "c_omeprazole", kind: "MEDICATION_INGREDIENT", canonicalLabel: "omeprazole", codeSystem: "INN", dictionaryVersion: TERMINOLOGY_VERSION, aliases: [] },
  { id: "c_esomeprazole", kind: "MEDICATION_INGREDIENT", canonicalLabel: "esomeprazole", codeSystem: "INN", dictionaryVersion: TERMINOLOGY_VERSION, aliases: [] },
  { id: "c_metformin", kind: "MEDICATION_INGREDIENT", canonicalLabel: "metformin", codeSystem: "INN", dictionaryVersion: TERMINOLOGY_VERSION, aliases: [] },
  { id: "c_atorvastatin", kind: "MEDICATION_INGREDIENT", canonicalLabel: "atorvastatin", codeSystem: "INN", dictionaryVersion: TERMINOLOGY_VERSION, aliases: [] },
  { id: "c_amoxicillin", kind: "MEDICATION_INGREDIENT", canonicalLabel: "amoxicillin", codeSystem: "INN", dictionaryVersion: TERMINOLOGY_VERSION, aliases: [] },
  { id: "c_ppi", kind: "MEDICATION_CLASS", canonicalLabel: "proton pump inhibitor", codeSystem: "ATC", code: "A02BC", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["PPI"] },
  { id: "c_ccb_dhp", kind: "MEDICATION_CLASS", canonicalLabel: "dihydropyridine calcium channel blocker", codeSystem: "ATC", code: "C08CA", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["DHP CCB"] },
  { id: "c_biguanide", kind: "MEDICATION_CLASS", canonicalLabel: "biguanide", codeSystem: "ATC", code: "A10BA", dictionaryVersion: TERMINOLOGY_VERSION, aliases: [] },
  { id: "c_hba1c", kind: "LAB_TEST", canonicalLabel: "HbA1c", codeSystem: "LOINC", code: "4548-4", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["glycated haemoglobin", "A1c"] },
  { id: "c_fpg", kind: "LAB_TEST", canonicalLabel: "fasting plasma glucose", codeSystem: "LOINC", code: "14749-6", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["FPG", "fasting glucose"] },
  { id: "c_creatinine", kind: "LAB_TEST", canonicalLabel: "serum creatinine", codeSystem: "LOINC", code: "2160-0", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["creatinine", "s.creatinine"] },
  { id: "c_gas_idiom", kind: "SYMPTOM_IDIOM", canonicalLabel: "gas (lay)", dictionaryVersion: TERMINOLOGY_VERSION, aliases: ["gas"] },
];

export const DRUG_PRODUCTS: DrugProductRecord[] = [
  {
    id: "p_secure", brand: "Secure 20", manufacturer: "Square", form: "CAPSULE",
    ingredientStrengths: [{ ingredientId: "c_omeprazole", ingredientName: "omeprazole", strengthValue: 20, strengthUnit: "mg" }],
    classIds: ["c_ppi"], sourceUrl: "demo://seclo-secure-20", sourceCheckedAt: "2026-09-30",
    rightsStatus: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION, synthetic: true,
  },
  {
    id: "p_maxpro", brand: "Maxpro 20", manufacturer: "Renata", form: "CAPSULE",
    ingredientStrengths: [{ ingredientId: "c_esomeprazole", ingredientName: "esomeprazole", strengthValue: 20, strengthUnit: "mg" }],
    classIds: ["c_ppi"], sourceUrl: "demo://maxpro-20", sourceCheckedAt: "2026-09-30",
    rightsStatus: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION, synthetic: true,
  },
  {
    id: "p_amlopres_5", brand: "Amlopres 5", manufacturer: "Cipla", form: "TABLET",
    ingredientStrengths: [{ ingredientId: "c_amlodipine", ingredientName: "amlodipine", strengthValue: 5, strengthUnit: "mg" }],
    classIds: ["c_ccb_dhp"], sourceUrl: "demo://amlopres-5", sourceCheckedAt: "2026-09-30",
    rightsStatus: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION, synthetic: true,
  },
  {
    id: "p_amlopres_10", brand: "Amlopres 10", manufacturer: "Cipla", form: "TABLET",
    ingredientStrengths: [{ ingredientId: "c_amlodipine", ingredientName: "amlodipine", strengthValue: 10, strengthUnit: "mg" }],
    classIds: ["c_ccb_dhp"], sourceUrl: "demo://amlopres-10", sourceCheckedAt: "2026-09-30",
    rightsStatus: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION, synthetic: true,
  },
  {
    id: "p_metformin_500", brand: "Metformin 500", manufacturer: "Beximco", form: "TABLET",
    ingredientStrengths: [{ ingredientId: "c_metformin", ingredientName: "metformin", strengthValue: 500, strengthUnit: "mg" }],
    classIds: ["c_biguanide"], sourceUrl: "demo://metformin-500", sourceCheckedAt: "2026-09-30",
    rightsStatus: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION, synthetic: true,
  },
  {
    id: "p_amoxicillin_500", brand: "Amoxil 500", manufacturer: "Square", form: "CAPSULE",
    ingredientStrengths: [{ ingredientId: "c_amoxicillin", ingredientName: "amoxicillin", strengthValue: 500, strengthUnit: "mg" }],
    classIds: [], sourceUrl: "demo://amoxil-500", sourceCheckedAt: "2026-09-30",
    rightsStatus: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION, synthetic: true,
  },
];

export const LAB_DEFINITIONS: LabDefinitionRecord[] = [
  {
    id: "l_hba1c", analyte: "HbA1c", specimen: "WHOLE_BLOOD", aliases: ["HbA1c", "A1c", "glycated haemoglobin"],
    canonicalUnit: "%", permittedConversions: [{ from: "%", to: "mmol/mol", factor: 10.93 }],
    conversionVersion: "demo-1", methodComparability: ["HPLC", "immunoassay"], status: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION,
  },
  {
    id: "l_fpg", analyte: "fasting plasma glucose", specimen: "BLOOD_PLASMA", aliases: ["FPG", "fasting glucose"],
    canonicalUnit: "mmol/L", permittedConversions: [{ from: "mg/dL", to: "mmol/L", factor: 0.0555 }],
    conversionVersion: "demo-1", methodComparability: ["hexokinase"], status: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION,
  },
  {
    id: "l_creatinine", analyte: "serum creatinine", specimen: "BLOOD_SERUM", aliases: ["creatinine", "s.creatinine"],
    canonicalUnit: "mg/dL", permittedConversions: [{ from: "mg/dL", to: "umol/L", factor: 88.4 }],
    conversionVersion: "demo-1", methodComparability: ["Jaffe", "enzymatic"], status: "DEMO_ONLY", dictionaryVersion: TERMINOLOGY_VERSION,
  },
];

export const IDIOMS: IdiomRecord[] = [
  {
    id: "i_gas", layTerm: "gas", layTermBn: "গ্যাস",
    possibleMeanings: ["bloating", "acid reflux", "abdominal discomfort"],
    clarifyingTemplate: {
      bn: "‘গ্যাস’ বলতে আপনি কী বোঝাচ্ছেন — পেট ফাঁপা, বুক জ্বালা, নাকি অন্য কিছু?",
      en: "When you say ‘gas’, do you mean bloating, acid reflux in the chest, or something else?",
    },
    dictionaryVersion: TERMINOLOGY_VERSION,
  },
  {
    id: "i_matha_ghur", layTerm: "matha ghur (spinning head)", layTermBn: "মাথা ঘুরে",
    possibleMeanings: ["vertigo", "lightheadedness", "unsteadiness"],
    clarifyingTemplate: {
      bn: "‘মাথা ঘুরে’ বলতে আপনি কী বোঝাচ্ছেন — চোখে অন্ধকার, ঘর ঘুরছে, নাকি হঠাৎ পড়ে যাচ্ছেন?",
      en: "When you say ‘matha ghur’, do you mean blackout, spinning room, or feeling unsteady?",
    },
    dictionaryVersion: TERMINOLOGY_VERSION,
  },
];

export interface NormalizedEntityResult {
  raw: string;
  dictionaryVersion: string;
  selectedConceptId: ID | null;
  candidates: { conceptId: ID; matchMethod: string }[];
  status: "EXACT" | "HUMAN_SELECTED" | "AMBIGUOUS" | "UNKNOWN";
}

export function normalizeBrand(rawBrand: string): NormalizedEntityResult {
  const cleaned = rawBrand.trim().toLowerCase();
  const exact = DRUG_PRODUCTS.find((p) => p.brand.toLowerCase() === cleaned);
  if (exact) {
    return {
      raw: rawBrand,
      dictionaryVersion: TERMINOLOGY_VERSION,
      selectedConceptId: exact.id,
      candidates: [{ conceptId: exact.id, matchMethod: "EXACT_BRAND" }],
      status: "EXACT",
    };
  }
  const fuzzy = DRUG_PRODUCTS.filter((p) =>
    p.brand.toLowerCase().includes(cleaned) || cleaned.includes(p.brand.toLowerCase().split(" ")[0]),
  );
  if (fuzzy.length > 0) {
    return {
      raw: rawBrand,
      dictionaryVersion: TERMINOLOGY_VERSION,
      selectedConceptId: null,
      candidates: fuzzy.map((p) => ({ conceptId: p.id, matchMethod: "FUZZY_SUBSTRING" })),
      status: "AMBIGUOUS",
    };
  }
  return {
    raw: rawBrand,
    dictionaryVersion: TERMINOLOGY_VERSION,
    selectedConceptId: null,
    candidates: [],
    status: "UNKNOWN",
  };
}

export function normalizeIngredient(raw: string): NormalizedEntityResult {
  const cleaned = raw.trim().toLowerCase();
  const exact = CONCEPTS.find(
    (c) => c.kind === "MEDICATION_INGREDIENT" && c.canonicalLabel.toLowerCase() === cleaned,
  );
  if (exact) {
    return {
      raw,
      dictionaryVersion: TERMINOLOGY_VERSION,
      selectedConceptId: exact.id,
      candidates: [{ conceptId: exact.id, matchMethod: "EXACT_INGREDIENT" }],
      status: "EXACT",
    };
  }
  return { raw, dictionaryVersion: TERMINOLOGY_VERSION, selectedConceptId: null, candidates: [], status: "UNKNOWN" };
}

export function lookupLabByAlias(rawTest: string): LabDefinitionRecord | null {
  const cleaned = rawTest.trim().toLowerCase();
  return LAB_DEFINITIONS.find(
    (l) =>
      l.analyte.toLowerCase() === cleaned ||
      l.aliases.some((a) => a.toLowerCase() === cleaned),
  ) ?? null;
}
