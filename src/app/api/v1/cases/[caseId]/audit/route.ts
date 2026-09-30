import { NextRequest } from "next/server";
import { AuditRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { assertCaseAccess } from "@/lib/server/access";
import { jsonError, jsonOk } from "@/lib/server/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    assertCaseAccess(actor, caseId);
    return jsonOk({ events: AuditRepo.forCase(caseId) });
  } catch (e) {
    return jsonError(e);
  }
}