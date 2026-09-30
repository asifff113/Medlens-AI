/**
 * Fixed WHO-5 assessment contract (Section 11).
 *
 * The implementation performs integer arithmetic in the domain layer. The
 * client may propose totals but the server recomputes and rejects any
 * mismatch. The instrument is UNAVAILABLE in this prototype by default — it
 * is enabled only after G02 (downloaded asset, content checksum, rights
 * review) is satisfied. The demo runs in DEMO_ONLY mode and surfaces a
 * synthetic fixed-text instrument so the scorer code path can be exercised.
 */

import { DomainError } from "./errors";

export const WHO5_INSTRUMENT_ID = "WHO5";
export const WHO5_SCORE_VERSION = "who5-demo-1.0.0";
export const WHO5_DEFINITION_VERSION = "WHO2024-bn-reviewed-1";
export const WHO5_DEFINITION_CHECKSUM = "DEMO_WHO5_CHECKSUM_REPLACE_AFTER_G02";
export const WHO5_ITEMS: readonly string[] = ["who5_1", "who5_2", "who5_3", "who5_4", "who5_5"] as const;

export interface Who5Item {
  id: string;
  bn: string;
  en: string;
  options: { value: number; bn: string; en: string }[];
}

/**
 * The wording below is a synthetic demo paraphrase that captures the official
 * 5-item, 6-response structure with the 0=all-the-time anchor and 5=at-no-time
 * direction. It MUST be replaced by the verbatim official text once G02
 * passes (Section 11.1). Until that gate is satisfied the registry keeps the
 * instrument in UNAVAILABLE state; the demo only uses these items in a clearly
 * labelled DEMO_ONLY session.
 */
export const WHO5_FIXED_DEMO_ITEMS: Who5Item[] = [
  {
    id: "who5_1",
    bn: "গত দুই সপ্তাহে আমি হাসিখুশি ও ভালো বোধ করেছি",
    en: "I have felt cheerful and in good spirits (last 2 weeks)",
    options: [
      { value: 5, bn: "কখনো না", en: "At no time" },
      { value: 4, bn: "মাঝে মাঝে", en: "Some of the time" },
      { value: 3, bn: "অর্ধেকের কম", en: "Less than half of the time" },
      { value: 2, bn: "অর্ধেকের বেশি", en: "More than half of the time" },
      { value: 1, bn: "প্রায়ই", en: "Most of the time" },
      { value: 0, bn: "সবসময়", en: "All of the time" },
    ],
  },
  {
    id: "who5_2",
    bn: "গত দুই সপ্তাহে আমি শান্ত ও স্বাচ্ছন্দ্য বোধ করেছি",
    en: "I have felt calm and relaxed (last 2 weeks)",
    options: [
      { value: 5, bn: "কখনো না", en: "At no time" },
      { value: 4, bn: "মাঝে মাঝে", en: "Some of the time" },
      { value: 3, bn: "অর্ধেকের কম", en: "Less than half of the time" },
      { value: 2, bn: "অর্ধেকের বেশি", en: "More than half of the time" },
      { value: 1, bn: "প্রায়ই", en: "Most of the time" },
      { value: 0, bn: "সবসময়", en: "All of the time" },
    ],
  },
  {
    id: "who5_3",
    bn: "গত দুই সপ্তাহে আমি সক্রিয় ও কর্মঠ বোধ করেছি",
    en: "I have felt active and vigorous (last 2 weeks)",
    options: [
      { value: 5, bn: "কখনো না", en: "At no time" },
      { value: 4, bn: "মাঝে মাঝে", en: "Some of the time" },
      { value: 3, bn: "অর্ধেকের কম", en: "Less than half of the time" },
      { value: 2, bn: "অর্ধেকের বেশি", en: "More than half of the time" },
      { value: 1, bn: "প্রায়ই", en: "Most of the time" },
      { value: 0, bn: "সবসময়", en: "All of the time" },
    ],
  },
  {
    id: "who5_4",
    bn: "গত দুই সপ্তাহে আমি সকালে তাজা ও বিশ্রাম নিয়ে উঠেছি",
    en: "I woke up feeling fresh and rested (last 2 weeks)",
    options: [
      { value: 5, bn: "কখনো না", en: "At no time" },
      { value: 4, bn: "মাঝে মাঝে", en: "Some of the time" },
      { value: 3, bn: "অর্ধেকের কম", en: "Less than half of the time" },
      { value: 2, bn: "অর্ধেকের বেশি", en: "More than half of the time" },
      { value: 1, bn: "প্রায়ই", en: "Most of the time" },
      { value: 0, bn: "সবসময়", en: "All of the time" },
    ],
  },
  {
    id: "who5_5",
    bn: "গত দুই সপ্তাহে আমার দৈনন্দিন জীবন আগ্রহপূর্ণ ছিল",
    en: "My daily life has been filled with things that interest me (last 2 weeks)",
    options: [
      { value: 5, bn: "কখনো না", en: "At no time" },
      { value: 4, bn: "মাঝে মাঝে", en: "Some of the time" },
      { value: 3, bn: "অর্ধেকের কম", en: "Less than half of the time" },
      { value: 2, bn: "অর্ধেকের বেশি", en: "More than half of the time" },
      { value: 1, bn: "প্রায়ই", en: "Most of the time" },
      { value: 0, bn: "সবসময়", en: "All of the time" },
    ],
  },
];

export interface ScoredWho5 {
  rawTotal: number;
  transformedScore: number;
  responseHash: string;
  scoringVersion: string;
  definitionChecksum: string;
  runtimeMode: "DEMO_ONLY";
}

export function hashResponses(responses: { itemId: string; value: number }[]): string {
  const ordered = [...responses].sort((a, b) => a.itemId.localeCompare(b.itemId));
  return ordered.map((r) => `${r.itemId}=${r.value}`).join("|");
}

export function scoreWho5Submission(responses: {
  itemId: string;
  value: number;
  confirmed: boolean;
}[]): ScoredWho5 {
  if (responses.length !== 5) {
    throw new DomainError(
      "ASSESSMENT_INCOMPLETE",
      "Assessment requires exactly five confirmed responses.",
      422,
    );
  }
  const ids = new Set<string>();
  for (const r of responses) {
    if (!WHO5_ITEMS.includes(r.itemId)) {
      throw new DomainError("INVALID_RESPONSE", `Unknown item id: ${r.itemId}`, 422, { itemId: r.itemId });
    }
    if (!Number.isInteger(r.value) || r.value < 0 || r.value > 5) {
      throw new DomainError(
        "INVALID_RESPONSE",
        `Response value for ${r.itemId} must be an integer between 0 and 5.`,
        422,
        { itemId: r.itemId },
      );
    }
    if (!r.confirmed) {
      throw new DomainError(
        "INVALID_RESPONSE",
        `Response for ${r.itemId} must be confirmed by the patient.`,
        422,
        { itemId: r.itemId },
      );
    }
    if (ids.has(r.itemId)) {
      throw new DomainError(
        "INVALID_RESPONSE",
        `Duplicate response for item ${r.itemId}.`,
        422,
        { itemId: r.itemId },
      );
    }
    ids.add(r.itemId);
  }
  const rawTotal = responses.reduce((acc, r) => acc + r.value, 0);
  const transformedScore = rawTotal * 4;
  return {
    rawTotal,
    transformedScore,
    responseHash: hashResponses(responses),
    scoringVersion: WHO5_SCORE_VERSION,
    definitionChecksum: WHO5_DEFINITION_CHECKSUM,
    runtimeMode: "DEMO_ONLY",
  };
}
