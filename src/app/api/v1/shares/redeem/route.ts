import { NextRequest } from "next/server";
import { GrantRepo, ShareLinkRepo, BriefRepo, BriefItemRepo, CaseRepo, FactRepo, FactRevisionRepo } from "@/lib/data/repo";
import { jsonError, jsonOk } from "@/lib/server/api";
import { createHash } from "node:crypto";
import { fingerprintGeneralAudience } from "@/lib/server/session";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { token: string };
    if (!body.token) throw new Error("UNAUTHENTICATED");
    const tokenHash = createHash("sha256").update(body.token).digest("hex");
    const link = ShareLinkRepo.byTokenHash(tokenHash);
    if (!link || link.revoked_at) throw new Error("FORBIDDEN");
    if (new Date(link.expires_at) < new Date()) throw new Error("FORBIDDEN");
    const grant = GrantRepo.byId(link.grant_id);
    if (!grant || grant.revoked_at || grant.kind !== "GENERAL_QR") throw new Error("FORBIDDEN");

    ShareLinkRepo.redeem(link.id, createHash("sha256").update(tokenHash + Date.now()).digest("hex"));

    // Read the latest brief if it exists.
    const latestBrief = BriefRepo.forCase(grant.case_id).find((b) => b.status === "READY");
    const items = latestBrief ? BriefItemRepo.forBrief(latestBrief.id) : [];
    const c = CaseRepo.byId(grant.case_id);
    return jsonOk({
      caseId: grant.case_id,
      grantId: grant.id,
      brief: latestBrief,
      items,
      audienceFingerprint: fingerprintGeneralAudience(grant.case_id),
      privacyEpoch: c?.privacy_epoch ?? 0,
      warning: "GENERAL_VIEW_NO_WELLBEING",
    });
  } catch (e) {
    return await jsonError(e);
  }
}
