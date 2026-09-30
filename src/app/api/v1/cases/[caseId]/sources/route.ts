import { NextRequest } from "next/server";
import { SourceArtifactRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    return jsonOk({ sources: SourceArtifactRepo.forCase(caseId) });
  } catch (e) {
    return jsonError(e);
  }
}
