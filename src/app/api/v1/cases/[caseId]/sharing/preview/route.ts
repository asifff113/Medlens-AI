import { NextRequest } from "next/server";
import { CaseRepo, ConsentRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { previewHash } from "@/lib/server/access";
import { createHash } from "node:crypto";
import { UserRepo, FactRepo, FactRevisionRepo, EvidenceAnchorRepo } from "@/lib/data/repo";

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    if (actor.user.role !== "PATIENT") throw new Error("FORBIDDEN");
    const { caseId } = await params;
    const body = (await req.json()) as { recipientUserId?: string; purpose: string; resourceIds: string[]; expiresAt: string };
    ConsentRepo.activeFor(caseId, "SHARING_NAMED_DOCTOR");
    const c = CaseRepo.byId(caseId);
    if (!c) throw new Error("FORBIDDEN");

    const recipient = body.recipientUserId ? UserRepo.byId(body.recipientUserId) : null;
    if (recipient && recipient.role !== "DOCTOR") throw new Error("FORBIDDEN");

    const preview = previewHash({
      recipientId: body.recipientUserId ?? null,
      purpose: body.purpose,
      resourceIds: body.resourceIds,
      expiresAt: body.expiresAt,
    });

    const sources = body.resourceIds
      .map((rid) => FactRepo.forCase(caseId).find((f) => f.resource_id === rid))
      .filter(Boolean);
    const items = sources.map((f) => {
      const rev = f?.current_revision_id ? FactRevisionRepo.byId(f.current_revision_id) : null;
      const anchors = rev ? EvidenceAnchorRepo.forResource(rev.resource_id) : [];
      return {
        factRevisionId: rev?.id ?? "",
        kind: f?.kind,
        text: rev?.raw_representation ?? "",
        evidenceAnchorCount: anchors.length,
      };
    });

    return jsonOk({ previewHash: preview, expiresAt: body.expiresAt, recipient: recipient ? { id: recipient.id, displayName: recipient.display_name, role: recipient.role } : null, items });
  } catch (e) {
    return jsonError(e);
  }
}
