/**
 * Brief composition (Section 7 + Section 9 of the architecture, F116/F118/F158/F201/F119).
 *
 * The brief composer consumes an authorized subset of facts plus a complaint
 * string and produces a ranked list of BriefItem records. Every important
 * item carries at least one evidence anchor id and a why-code. Items that
 * cannot be grounded are suppressed and recorded as abstentions.
 */

import type { BriefItem, Issue, MedicationClaim, Sensitivity } from "./ids";

export interface AuthorizedFactView {
  factRevisionId: string;
  kind: "MEDICATION" | "LAB" | "ALLERGY" | "REACTION" | "COMPLAINT" | "AGENDA" | "WELLBEING" | "ASSESSMENT" | "PROVIDER";
  displayText: string;
  evidenceAnchorIds: string[];
  reviewStatus: string;
  originLabel: string;
  eventDate: string | null;
  sensitivity: Sensitivity;
  whyCodes: string[];
  medication?: MedicationClaim;
}

export interface BriefComposerInput {
  caseId: string;
  contextVersion: number;
  audienceFingerprint: string;
  complaint: string | null;
  agenda: string[];
  criticalBanner: { text: string; factRevisionId: string; anchorIds: string[] }[];
  medications: AuthorizedFactView[];
  labs: AuthorizedFactView[];
  allergies: AuthorizedFactView[];
  wellbeing: AuthorizedFactView[];
  issues: Issue[];
  includeWellbeing: boolean;
}

export interface ComposedBrief {
  sections: Record<string, BriefItem[]>;
  abstained: { reason: string; factRevisionId: string }[];
  whyCodesUsed: string[];
}

const SECTION_RANK: Record<string, number> = {
  complaint: 0,
  banner: 1,
  issues: 2,
  medications: 3,
  labs: 4,
  allergies: 5,
  wellbeing: 6,
  agenda: 7,
};

export function composeBrief(input: BriefComposerInput): ComposedBrief {
  const sections: Record<string, BriefItem[]> = {};
  const abstained: { reason: string; factRevisionId: string }[] = [];
  const whyCodesUsed = new Set<string>();

  function pushItem(
    section: string,
    text: string,
    fact: AuthorizedFactView,
    extraWhyCodes: string[] = [],
  ) {
    if (fact.evidenceAnchorIds.length === 0) {
      abstained.push({ reason: "NO_VALID_ANCHOR", factRevisionId: fact.factRevisionId });
      return;
    }
    const allWhyCodes = [...fact.whyCodes, ...extraWhyCodes];
    const item: BriefItem = {
      id: `bi_${input.contextVersion}_${input.audienceFingerprint.slice(0, 8)}_${fact.factRevisionId}_${section}`,
      briefId: `br_${input.caseId}_${input.contextVersion}`,
      section,
      rank: (sections[section]?.length ?? 0) + 1,
      kind: fact.kind,
      displayText: text,
      factRevisionIds: [fact.factRevisionId],
      evidenceAnchorIds: fact.evidenceAnchorIds,
      whyCode: allWhyCodes[0] ?? "RELEVANCE_GENERAL",
      sourceStatus: fact.originLabel,
      reviewStatus: fact.reviewStatus,
      sensitivity: fact.sensitivity,
      audienceFingerprint: input.audienceFingerprint,
    };
    allWhyCodes.forEach((c) => whyCodesUsed.add(c));
    sections[section] = [...(sections[section] ?? []), item];
  }

  if (input.complaint) {
    sections.complaint = [
      {
        id: `bi_${input.contextVersion}_${input.audienceFingerprint.slice(0, 8)}_complaint`,
        briefId: `br_${input.caseId}_${input.contextVersion}`,
        section: "complaint",
        rank: 1,
        kind: "COMPLAINT",
        displayText: input.complaint,
        factRevisionIds: [],
        evidenceAnchorIds: [],
        whyCode: "PATIENT_REPORTED_COMPLAINT",
        sourceStatus: "PATIENT_REPORTED",
        reviewStatus: "CONTRIBUTOR_CONFIRMED",
        sensitivity: "GENERAL",
        audienceFingerprint: input.audienceFingerprint,
      },
    ];
  }

  for (const banner of input.criticalBanner) {
    sections.banner = [
      ...(sections.banner ?? []),
      {
        id: `bi_${input.contextVersion}_${input.audienceFingerprint.slice(0, 8)}_banner_${banner.factRevisionId}`,
        briefId: `br_${input.caseId}_${input.contextVersion}`,
        section: "banner",
        rank: (sections.banner?.length ?? 0) + 1,
        kind: "ALLERGY",
        displayText: banner.text,
        factRevisionIds: [banner.factRevisionId],
        evidenceAnchorIds: banner.anchorIds,
        whyCode: "CRITICAL_CONTEXT_BANNER",
        sourceStatus: "DOCUMENTED",
        reviewStatus: "UNREVIEWED",
        sensitivity: "GENERAL",
        audienceFingerprint: input.audienceFingerprint,
      },
    ];
    whyCodesUsed.add("CRITICAL_CONTEXT_BANNER");
  }

  const reviewFirstIssues = input.issues.filter((i) => i.priority === "REVIEW_FIRST").slice(0, 3);
  sections.issues = reviewFirstIssues.map((issue, idx) => ({
    id: `bi_${input.contextVersion}_${input.audienceFingerprint.slice(0, 8)}_issue_${issue.id}`,
    briefId: `br_${input.caseId}_${input.contextVersion}`,
    section: "issues",
    rank: idx + 1,
    kind: issue.kind,
    displayText: issue.summary,
    factRevisionIds: issue.claimRevisionIds,
    evidenceAnchorIds: [],
    whyCode: issue.ruleId,
    sourceStatus: "DERIVED",
    reviewStatus: issue.status,
    sensitivity: "GENERAL",
    audienceFingerprint: input.audienceFingerprint,
  }));
  reviewFirstIssues.forEach((i) => whyCodesUsed.add(i.ruleId));

  for (const med of input.medications) {
    const text = formatMedication(med);
    pushItem("medications", text, med, ["MEDICATION_RELEVANCE"]);
  }
  for (const lab of input.labs) {
    pushItem("labs", formatLab(lab), lab, ["LAB_RELEVANCE"]);
  }
  for (const allergy of input.allergies) {
    pushItem("allergies", allergy.displayText, allergy, ["ALLERGY_RELEVANCE"]);
  }
  if (input.includeWellbeing) {
    for (const w of input.wellbeing) {
      pushItem("wellbeing", w.displayText, w, ["WELLBEING_RELEVANCE"]);
    }
  }

  if (input.agenda.length) {
    sections.agenda = input.agenda.map((a, idx) => ({
      id: `bi_${input.contextVersion}_${input.audienceFingerprint.slice(0, 8)}_agenda_${idx}`,
      briefId: `br_${input.caseId}_${input.contextVersion}`,
      section: "agenda",
      rank: idx + 1,
      kind: "AGENDA",
      displayText: a,
      factRevisionIds: [],
      evidenceAnchorIds: [],
      whyCode: "PATIENT_AGENDA",
      sourceStatus: "PATIENT_REPORTED",
      reviewStatus: "CONTRIBUTOR_CONFIRMED",
      sensitivity: "GENERAL",
      audienceFingerprint: input.audienceFingerprint,
    }));
  }

  // Stable section ordering.
  const ordered: Record<string, BriefItem[]> = {};
  for (const key of Object.keys(SECTION_RANK).sort((a, b) => SECTION_RANK[a] - SECTION_RANK[b])) {
    if (sections[key]?.length) ordered[key] = sections[key];
  }

  return { sections: ordered, abstained, whyCodesUsed: [...whyCodesUsed] };
}

function formatMedication(fact: AuthorizedFactView): string {
  const med = fact.medication;
  if (!med) return fact.displayText;
  const strength = med.strengthValue ? `${med.strengthValue}${med.strengthUnit ?? "mg"}` : "";
  const brand = med.brand ?? "";
  const ingredient = (med.ingredientNames ?? []).join("+");
  const kind = med.evidenceKind.replaceAll("_", " ").toLowerCase();
  return [brand || ingredient, strength, kind].filter(Boolean).join(" — ");
}

function formatLab(fact: AuthorizedFactView): string {
  return fact.displayText;
}
