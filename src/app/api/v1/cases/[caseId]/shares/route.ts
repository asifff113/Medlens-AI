import { NextRequest } from "next/server";
import { CaseRepo, ConsentRepo, GrantRepo, ShareLinkRepo, AuditRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { createHash, randomBytes } from "node:crypto";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "PATIENT") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const body = (await req.json()) as { previewHash?: string; expiresAt: string; generalOnly: boolean };
    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");
    const consent = ConsentRepo.activeFor(caseId, "SHARING_GENERAL_QR");
    if (!consent) throw new Error("FORBIDDEN");

    const grantId = `grant_${nanoid(10)}`;
    GrantRepo.insert({
      id: grantId,
      case_id: caseId,
      patient_id: c.patient_id,
      recipient_user_id: null,
      kind: "GENERAL_QR",
      purpose: "VISIT_CONTEXT",
      consent_id: consent.id,
      starts_at: new Date().toISOString(),
      expires_at: body.expiresAt,
      revoked_at: null,
      export_allowed: 0,
      version: 1,
      preview_hash: body.previewHash ?? null,
      source_closure_hash: null,
    });

    const token = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(token).digest("hex");
    ShareLinkRepo.insert({
      id: `sl_${nanoid(10)}`,
      grant_id: grantId,
      token_hash: tokenHash,
      expires_at: body.expiresAt,
      revoked_at: null,
      redeemed_at: null,
      session_hash: null,
    });

    AuditRepo.insert({
      id: nanoid(8),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "CREATE_SHARE",
      target_resource_id: grantId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });

    return jsonOk({ grantId, token, expiresAt: body.expiresAt });
  } catch (e) {
    return jsonError(e);
  }
}
