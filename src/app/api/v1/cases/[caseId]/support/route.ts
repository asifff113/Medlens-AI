import { NextRequest } from "next/server";
import { SupportEventRepo, SupportResourceRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";
import { recognizeSupportSignal, SUPPORT_PROTOCOL } from "@/lib/domain/support";
import { nanoid } from "nanoid";

export async function GET(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const url = new URL(req.url);
    const lang = (url.searchParams.get("lang") ?? "bn") as "bn" | "en";
    const resources = SupportResourceRepo.active("BD", lang);
    const events = SupportEventRepo.forCase((await params).caseId);
    return jsonOk({ resources, events, protocol: SUPPORT_PROTOCOL });
  } catch (e) {
    return jsonError(e);
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { caseId } = await params;
    const body = (await req.json()) as { text?: string; language: "bn" | "en" | "bn-Latn"; transcriptConfirmed?: boolean };
    const recognition = recognizeSupportSignal({
      text: body.text ?? "",
      language: body.language ?? "bn",
      transcriptConfirmed: body.transcriptConfirmed ?? false,
    });
    const id = `sup_${nanoid(8)}`;
    SupportEventRepo.insert({
      id,
      resource_id: `res_${nanoid(8)}`,
      case_id: caseId,
      evidence_resource_id: null,
      protocol_version: recognition.protocolVersion,
      observation_type: recognition.observation,
      presentation_state: recognition.shouldShowSupport ? "SHOWN" : "NOT_SHOWN",
      handoff_state: "NOT_REQUESTED",
      shown_at: recognition.shouldShowSupport ? new Date().toISOString() : null,
      grant_id: null,
      recipient_id: null,
      monitoring_available: 0,
      last_transition_at: new Date().toISOString(),
    });
    return jsonOk({ eventId: id, observation: recognition.observation, shouldShowSupport: recognition.shouldShowSupport, protocol: SUPPORT_PROTOCOL });
  } catch (e) {
    return jsonError(e);
  }
}
