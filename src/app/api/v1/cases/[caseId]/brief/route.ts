import { NextRequest } from "next/server";
import { CaseRepo, FactRepo, FactRevisionRepo, GrantRepo, GrantResourceRepo, MedicationClaimRepo, LabObservationRepo, WellbeingRepo, IssueRepo, BriefRepo, BriefItemRepo, EvidenceAnchorRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { composeBrief, type AuthorizedFactView } from "@/lib/domain/brief";
import { fingerprintAudience, fingerprintGeneralAudience } from "@/lib/server/session";
import { nanoid } from "nanoid";
import { AuditRepo } from "@/lib/data/repo";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");

    const audience = actor.user.role === "DOCTOR" ? "NAMED" : "SELF";
    const audienceFingerprint =
      audience === "NAMED"
        ? fingerprintAudience(actor.user, caseId, actor.user.role)
        : fingerprintAudience(actor.user, caseId, actor.user.role);

    // Collect admissible facts.
    const facts = FactRepo.forCase(caseId);
    const admitted: AuthorizedFactView[] = [];
    const criticalBanner: { text: string; factRevisionId: string; anchorIds: string[] }[] = [];
    const wellbeing: AuthorizedFactView[] = [];
    const medications: AuthorizedFactView[] = [];
    const labs: AuthorizedFactView[] = [];
    const allergies: AuthorizedFactView[] = [];

    for (const f of facts) {
      if (!f.current_revision_id) continue;
      const rev = FactRevisionRepo.byId(f.current_revision_id);
      if (!rev) continue;
      const anchorIds = EvidenceAnchorRepo.forResource(rev.resource_id).map((a) => a.id);

      if (f.kind === "MEDICATION") {
        const claim = MedicationClaimRepo.byFactRevision(rev.id);
        if (!claim) continue;
        const text = `${claim.brand ?? claim.ingredient_names} ${claim.strength_value ?? ""}${claim.strength_unit ?? "mg"} (${claim.evidence_kind.toLowerCase().replaceAll("_", " ")})`;
        const view: AuthorizedFactView = {
          factRevisionId: rev.id,
          kind: "MEDICATION",
          displayText: text,
          evidenceAnchorIds: anchorIds,
          reviewStatus: rev.review_state,
          originLabel: rev.origin_kind,
          eventDate: rev.event_date,
          sensitivity: "GENERAL",
          whyCodes: ["MEDICATION_RELEVANCE"],
          medication: {
            productId: claim.product_id,
            brand: claim.brand,
            manufacturer: claim.manufacturer,
            ingredientIds: JSON.parse(claim.ingredient_ids || "[]"),
            ingredientNames: JSON.parse(claim.ingredient_names || "[]"),
            strengthValue: claim.strength_value,
            strengthUnit: claim.strength_unit,
            form: claim.form,
            route: claim.route,
            doseRaw: claim.dose_raw,
            frequencyRaw: claim.frequency_raw,
            parsedSchedule: claim.parsed_schedule ? JSON.parse(claim.parsed_schedule) : null,
            durationRaw: claim.duration_raw,
            evidenceKind: claim.evidence_kind as AuthorizedFactView["medication"] extends infer M ? (M extends { evidenceKind?: infer K } ? K : never) : never,
            claimedLifecycle: claim.claimed_lifecycle as AuthorizedFactView["medication"] extends infer M ? (M extends { claimedLifecycle?: infer K } ? K : never) : never,
            effectiveStart: claim.effective_start,
            effectiveEnd: claim.effective_end,
            providerId: claim.provider_id,
          },
        };
        medications.push(view);
      }
      if (f.kind === "LAB") {
        const lab = LabObservationRepo.byFactRevision(rev.id);
        if (!lab) continue;
        labs.push({
          factRevisionId: rev.id,
          kind: "LAB",
          displayText: `${lab.analyte ?? lab.original_test}: ${lab.original_value ?? lab.normalized_decimal ?? ""} ${lab.original_unit ?? lab.normalized_unit ?? ""} (${lab.result_date ?? ""})`,
          evidenceAnchorIds: anchorIds,
          reviewStatus: rev.review_state,
          originLabel: rev.origin_kind,
          eventDate: rev.event_date,
          sensitivity: "GENERAL",
          whyCodes: ["LAB_RELEVANCE"],
        });
      }
      if (f.kind === "ALLERGY") {
        const data = JSON.parse(rev.normalized_payload);
        allergies.push({
          factRevisionId: rev.id,
          kind: "ALLERGY",
          displayText: `${data.substance}: ${data.reactionText}`,
          evidenceAnchorIds: anchorIds,
          reviewStatus: rev.review_state,
          originLabel: rev.origin_kind,
          eventDate: rev.event_date,
          sensitivity: "GENERAL",
          whyCodes: ["ALLERGY_RELEVANCE"],
        });
        criticalBanner.push({
          text: `Allergy: ${data.substance} — ${data.reactionText}`,
          factRevisionId: rev.id,
          anchorIds,
        });
      }
      if (f.kind === "WELLBEING") {
        const wb = WellbeingRepo.forCase(caseId).find((w) => w.fact_revision_id === rev.id);
        if (wb) {
          wellbeing.push({
            factRevisionId: rev.id,
            kind: "WELLBEING",
            displayText: wb.confirmed_summary ?? wb.original_wording,
            evidenceAnchorIds: anchorIds,
            reviewStatus: rev.review_state,
            originLabel: rev.origin_kind,
            eventDate: rev.event_date,
            sensitivity: "RESTRICTED_WELLBEING",
            whyCodes: ["WELLBEING_RELEVANCE"],
          });
        }
      }
      if (f.kind === "COMPLAINT") {
        admitted.push({
          factRevisionId: rev.id,
          kind: "COMPLAINT",
          displayText: rev.raw_representation,
          evidenceAnchorIds: anchorIds,
          reviewStatus: rev.review_state,
          originLabel: rev.origin_kind,
          eventDate: rev.event_date,
          sensitivity: "GENERAL",
          whyCodes: ["PATIENT_COMPLAINT"],
        });
      }
    }

    const composed = composeBrief({
      caseId,
      contextVersion: c.context_version,
      audienceFingerprint,
      complaint: admitted.find((a) => a.kind === "COMPLAINT")?.displayText ?? null,
      agenda: [],
      criticalBanner,
      medications,
      labs,
      allergies,
      wellbeing,
      issues: IssueRepo.forCase(caseId)
        .filter((i) => i.status === "OPEN")
        .map((i) => ({
          id: i.id,
          kind: i.kind as "CONFLICT" | "GAP",
          type: i.type,
          ruleId: i.rule_id,
          ruleVersion: i.rule_version,
          signature: i.signature,
          contextVersion: i.context_version,
          audienceFingerprint: i.audience_fingerprint,
          priority: i.priority as "REVIEW_FIRST" | "REVIEW_NEXT" | "INFORMATION",
          uncertaintyCodes: JSON.parse(i.uncertainty_codes || "[]"),
          status: i.status as any,
          claimRevisionIds: JSON.parse(i.claim_revision_ids || "[]"),
          summary: i.summary,
          doctorOnly: !!i.doctor_only,
          createdAt: i.created_at,
          updatedAt: i.updated_at,
        })),
      includeWellbeing: actor.user.role === "DOCTOR", // only doctors see wellbeing if granted
    });

    const briefId = `br_${nanoid(8)}`;
    const now = new Date().toISOString();
    const grantIds = GrantRepo.forCase(caseId)
      .filter((g) => !g.revoked_at && new Date(g.expires_at) > new Date())
      .map((g) => g.id);
    BriefRepo.insert({
      id: briefId,
      resource_id: `res_${nanoid(8)}`,
      case_id: caseId,
      context_version: c.context_version,
      audience_fingerprint: audienceFingerprint,
      grant_ids: JSON.stringify(grantIds),
      privacy_epoch: c.privacy_epoch,
      composition_version: "brief-demo-1.0.0",
      generated_at: now,
      status: "READY",
      export_artifact_id: null,
    });
    let rank = 0;
    for (const [section, items] of Object.entries(composed.sections)) {
      for (const item of items) {
        BriefItemRepo.insert({
          id: item.id,
          resource_id: `res_${nanoid(8)}`,
          brief_id: briefId,
          section,
          rank: ++rank,
          kind: item.kind,
          text: item.displayText,
          why_code: item.whyCode,
          status_labels: JSON.stringify({ sourceStatus: item.sourceStatus, reviewStatus: item.reviewStatus }),
          structured_payload: "{}",
          fact_revision_ids: JSON.stringify(item.factRevisionIds),
          evidence_anchor_ids: JSON.stringify(item.evidenceAnchorIds),
        });
      }
    }

    AuditRepo.insert({
      id: nanoid(12),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "COMPOSE_BRIEF",
      target_resource_id: briefId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: now,
      prior_version: c.context_version,
      new_version: c.context_version,
    });

    return jsonOk({
      briefId,
      contextVersion: c.context_version,
      audienceFingerprint,
      sections: composed.sections,
      abstained: composed.abstained,
      whyCodesUsed: composed.whyCodesUsed,
      includeWellbeing: actor.user.role === "DOCTOR",
    });
  } catch (e) {
    return jsonError(e);
  }
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId } = await params;
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const url = new URL(req.url);
    const briefId = url.searchParams.get("briefId");
    if (!briefId) throw new Error("BAD_REQUEST");
    const brief = BriefRepo.byId(briefId);
    if (!brief || brief.case_id !== caseId) throw new Error("FORBIDDEN");
    const items = BriefItemRepo.forBrief(briefId);
    return jsonOk({ brief, items });
  } catch (e) {
    return jsonError(e);
  }
}
