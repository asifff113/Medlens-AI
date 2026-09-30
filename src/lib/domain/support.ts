/**
 * Distress support workflow (Section 11.3).
 *
 * Pure, deterministic recognition based on the actual typed words or confirmed
 * transcript. Never asserts a current concern from tone, face, medication or
 * score. The SupportEvent states are explicit; the UI distinguishes an
 * unmonitored service from a created request and an actual clinician
 * acknowledgement.
 */

import type { DistressSupportEvent } from "./ids";

const SUPPORT_PROTOCOL_VERSION = "demo-1.0.0";

const EXPLICIT_CURRENT_PATTERNS_BN = [
  /আত্মহত্যা/i,
  /আমি মরতে চাই/i,
  /বাঁচতে চাই না/i,
  /নিজেকে ক্ষতি/i,
];

const EXPLICIT_CURRENT_PATTERNS_EN = [
  /suicide/i,
  /kill myself/i,
  /end my life/i,
  /hurt myself/i,
];

const AMBIGUOUS_BN = [/বিষণ্ণ/i, /একা বোধ/i, /ঘুম হয় না/i, /কান্না আসছে/i];
const AMBIGUOUS_EN = [/hopeless/i, /worthless/i, /can't sleep/i, /crying/i];

const NEGATED_BN = [/কখনো না/i, /আর না/i];
const HISTORICAL_BN = [/আগে একবার/i, /গত বছর/i];
const QUOTED_BN = [/বলেছিল/i, /তার বন্ধু/i];

const HELP_PATTERNS = [/\bhelp\b/i, /সাহায্য/i, /কেউ নেই/i];

export interface RecognitionInput {
  text: string;
  language: "bn" | "en" | "bn-Latn";
  transcriptConfirmed: boolean;
}

export interface RecognitionResult {
  observation: DistressSupportEvent["observation"];
  shouldShowSupport: boolean;
  trigger: "HELP_REQUEST" | "EXPLICIT_DISCLOSURE" | "INTAKE_DETECTED" | null;
  protocolVersion: string;
}

export function recognizeSupportSignal(input: RecognitionInput): RecognitionResult {
  const text = input.text.trim();
  if (!text) {
    return {
      observation: "UNRECOGNIZED",
      shouldShowSupport: false,
      trigger: null,
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }

  if (!input.transcriptConfirmed) {
    return {
      observation: "AMBIGUOUS",
      shouldShowSupport: true,
      trigger: "INTAKE_DETECTED",
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }

  if (HISTORICAL_BN.some((r) => r.test(text))) {
    return {
      observation: "HISTORICAL",
      shouldShowSupport: false,
      trigger: null,
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }
  if (QUOTED_BN.some((r) => r.test(text))) {
    return {
      observation: "QUOTED_THIRD_PERSON",
      shouldShowSupport: false,
      trigger: null,
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }
  if (NEGATED_BN.some((r) => r.test(text))) {
    return {
      observation: "NEGATED",
      shouldShowSupport: false,
      trigger: null,
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }

  const explicit = [...EXPLICIT_CURRENT_PATTERNS_BN, ...EXPLICIT_CURRENT_PATTERNS_EN].some((r) =>
    r.test(text),
  );
  if (explicit) {
    return {
      observation: "CURRENT_EXPLICIT",
      shouldShowSupport: true,
      trigger: "EXPLICIT_DISCLOSURE",
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }

  const helpHit = HELP_PATTERNS.some((r) => r.test(text));
  if (helpHit) {
    return {
      observation: "HELP_REQUEST",
      shouldShowSupport: true,
      trigger: "HELP_REQUEST",
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }

  if (AMBIGUOUS_BN.some((r) => r.test(text)) || AMBIGUOUS_EN.some((r) => r.test(text))) {
    return {
      observation: "AMBIGUOUS",
      shouldShowSupport: true,
      trigger: "INTAKE_DETECTED",
      protocolVersion: SUPPORT_PROTOCOL_VERSION,
    };
  }

  return {
    observation: "UNRECOGNIZED",
    shouldShowSupport: false,
    trigger: null,
    protocolVersion: SUPPORT_PROTOCOL_VERSION,
  };
}

export const SUPPORT_PROTOCOL = {
  version: SUPPORT_PROTOCOL_VERSION,
  handoffTimeoutMs: 5 * 60 * 1000,
  monitoringAvailable: false,
  deliveryMode: "SIMULATED" as const,
};
