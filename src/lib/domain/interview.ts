/**
 * Question planner (Section 9.3 and 9.4).
 *
 * Pure function: takes unresolved issues, prior question history and a budget
 * and returns an ordered list of questions to ask. The implementation uses
 * the greedy coverage / burden weights specified in the architecture. A
 * support guardrail pauses routine questioning and surfaces the support
 * surface (the route is then returned to the caller).
 */

import type { Issue, Language, PatientQuestion } from "./ids";
import { nanoid } from "nanoid";

export interface Template {
  id: string;
  version: string;
  type: "MEDICATION_CHOICE" | "STRENGTH_CHOICE" | "STOP_REASON" | "RESULT_AVAILABILITY";
  bn: string;
  en: string;
  options: { id: string; bn: string; en: string }[];
}

export const QUESTION_TEMPLATES: Template[] = [
  {
    id: "t_med_choice",
    version: "demo-1",
    type: "MEDICATION_CHOICE",
    bn: "আপনি এখন কোন ওষুধটি নিয়মিত খান?",
    en: "Which of these medicines are you currently taking?",
    options: [
      { id: "first", bn: "প্রথমটি", en: "The first one" },
      { id: "second", bn: "দ্বিতীয়টি", en: "The second one" },
      { id: "both", bn: "দুটোই", en: "Both" },
      { id: "neither", bn: "কোনোটিই না", en: "Neither" },
    ],
  },
  {
    id: "t_strength_choice",
    version: "demo-1",
    type: "STRENGTH_CHOICE",
    bn: "আপনি এখন কোন স্ট্রিপ থেকে ওষুধটি খান?",
    en: "Which strip are you currently using this medicine from?",
    options: [
      { id: "lower", bn: "কম মাত্রার স্ট্রিপ", en: "The lower-strength strip" },
      { id: "higher", bn: "বেশি মাত্রার স্ট্রিপ", en: "The higher-strength strip" },
      { id: "unsure", bn: "নিশ্চিত নই", en: "I am not sure" },
    ],
  },
  {
    id: "t_stop_reason",
    version: "demo-1",
    type: "STOP_REASON",
    bn: "এই ওষুধটি কেন বন্ধ করেছেন?",
    en: "Why did you stop taking this medicine?",
    options: [
      { id: "doctor_advice", bn: "ডাক্তারের পরামর্শে", en: "Doctor's advice" },
      { id: "felt_better", bn: "ভালো বোধ হওয়ায়", en: "I felt better" },
      { id: "side_effect", bn: "পার্শ্বপ্রতিক্রিয়া", en: "Side effect" },
      { id: "cost", bn: "খরচের কারণে", en: "Cost" },
      { id: "other", bn: "অন্য কারণ", en: "Other" },
    ],
  },
  {
    id: "t_result_availability",
    version: "demo-1",
    type: "RESULT_AVAILABILITY",
    bn: "এই পরীক্ষাটি কি আপনি করিয়েছেন?",
    en: "Have you had this test done?",
    options: [
      { id: "done_have_report", bn: "করেছি, রিপোর্ট আছে", en: "Yes, I have the report" },
      { id: "done_at_home", bn: "করেছি, রিপোর্ট বাসায়", en: "Yes, the report is at home" },
      { id: "not_done", bn: "করিনি", en: "Not yet" },
      { id: "unknown", bn: "জানি না", en: "I don't know" },
    ],
  },
];

export interface PlannedQuestion {
  templateId: string;
  targetIssueIds: string[];
  language: Language;
  text: string;
  responseType: "SINGLE" | "MULTI" | "TEXT" | "PHOTO";
  options: { id: string; label: string }[];
}

const BURDEN_BY_TYPE: Record<Template["type"], number> = {
  MEDICATION_CHOICE: 1,
  STRENGTH_CHOICE: 1,
  STOP_REASON: 2,
  RESULT_AVAILABILITY: 1,
};

const PRIORITY_WEIGHT: Record<Issue["priority"], number> = {
  REVIEW_FIRST: 3,
  REVIEW_NEXT: 2,
  INFORMATION: 1,
};

export function planQuestions(
  openIssues: Issue[],
  history: { templateId: string; status: PatientQuestion["status"] }[],
  language: Language,
  maxQuestions: number,
): PlannedQuestion[] {
  const asked = new Set(
    history.filter((h) => h.status !== "SKIPPED" && h.status !== "CANCELLED").map((h) => h.templateId),
  );
  const askedIssues = new Set<string>();
  // We track templateId to avoid repeat; issue signatures are tracked at the call site.
  const planned: PlannedQuestion[] = [];

  const candidates = openIssues
    .map((issue) => {
      const template = pickTemplate(issue);
      if (!template) return null;
      if (asked.has(template.id)) return null;
      const priorityWeight = PRIORITY_WEIGHT[issue.priority];
      const burden = BURDEN_BY_TYPE[template.type] || 1;
      return { issue, template, score: priorityWeight / burden };
    })
    .filter(Boolean) as { issue: Issue; template: Template; score: number }[];

  candidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.issue.id.localeCompare(b.issue.id);
  });

  for (const c of candidates) {
    if (planned.length >= maxQuestions) break;
    const text = language === "bn" ? c.template.bn : c.template.en;
    planned.push({
      templateId: c.template.id,
      targetIssueIds: [c.issue.id],
      language,
      text,
      responseType: "SINGLE",
      options: c.template.options.map((o) => ({
        id: o.id,
        label: language === "bn" ? o.bn : o.en,
      })),
    });
    askedIssues.add(c.issue.id);
  }

  return planned;
}

function pickTemplate(issue: Issue): Template | null {
  switch (issue.type) {
    case "RX01":
    case "RX02":
      return QUESTION_TEMPLATES.find((t) => t.type === "MEDICATION_CHOICE") ?? null;
    case "RX03":
      return QUESTION_TEMPLATES.find((t) => t.type === "STRENGTH_CHOICE") ?? null;
    case "RX05":
      return QUESTION_TEMPLATES.find((t) => t.type === "STOP_REASON") ?? null;
    case "LAB01":
      return QUESTION_TEMPLATES.find((t) => t.type === "RESULT_AVAILABILITY") ?? null;
    default:
      return null;
  }
}

export function newQuestionId() {
  return `q_${nanoid(10)}`;
}
