import { NextRequest } from "next/server";
import { CaseRepo, ConsentRepo, GrantRepo, GrantResourceRepo, AuditRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { hashSourceClosure } from "@/lib/server/access";
import { nanoid } from "nanoid";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "PATIENT") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const body = (await req.json()) as {
      recipientUserId?: string;
      purpose: string;
      resourceIds: string[];
      expiresAt: string;
      previewHash: string;
      kind: "GENERAL_QR" | "SENSITIVE_NAMED";
    };
    const consent = ConsentRepo.activeFor(caseId, "SHARING_NAMED_DOCTOR");
    if (!consent) throw new Error("FORBIDDEN");

    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");

    const closureHash = hashSourceClosure(body.resourceIds);
    const grantId = `grant_${nanoid(10)}`;
    GrantRepo.insert({
      id: grantId,
      case_id: caseId,
      patient_id: c.patient_id,
      recipient_user_id: body.recipientUserId ?? null,
      kind: body.kind,
      purpose: body.purpose,
      consent_id: consent.id,
      starts_at: new Date().toISOString(),
      expires_at: body.expiresAt,
      revoked_at: null,
      export_allowed: 0,
      version: 1,
      preview_hash: body.previewHash,
      source_closure_hash: closureHash,
    });
    for (const rid of body.resourceIds) {
      GrantResourceRepo.insert({
        id: `gres_${nanoid(8)}`,
        grant_id: grantId,
        resource_id: rid,
        field_paths: "[]",
        source_closure_hash: closureHash,
      });
    }

    AuditRepo.insert({
      id: nanoid(8),
      case_id: caseId,
      actor_or_service_id: actor.user.id,
      action: "CREATE_GRANT",
      target_resource_id: grantId,
      outcome: "OK",
      request_id: nanoid(8),
      policy_version: "demo-1.0.0",
      occurred_at: new Date().toISOString(),
      prior_version: null,
      new_version: null,
    });

    return jsonOk({ grantId, state: "ACTIVE", version: 1, privacyEpoch: c.privacy_epoch, expiresAt: body.expiresAt });
  } catch (e) {
    return jsonError(e);
  }
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    return jsonOk({ grants: GrantRepo.forCase(caseId) });
  } catch (e) {
    return jsonError(e);
  }
}
