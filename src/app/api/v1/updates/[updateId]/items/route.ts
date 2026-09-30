import { NextRequest } from "next/server";
import { UpdateItemRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ updateId: string }> }) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const { updateId } = await params;
    return jsonOk({ items: UpdateItemRepo.forUpdate(updateId) });
  } catch (e) {
    return jsonError(e);
  }
}