import { NextRequest } from "next/server";
import { UserRepo } from "@/lib/data/repo";
import { getActor } from "@/lib/server/session";
import { jsonError, jsonOk } from "@/lib/server/api";

export async function GET(req: NextRequest) {
  try {
    const actor = await getActor();
    if (!actor) throw new Error("UNAUTHENTICATED");
    const url = new URL(req.url);
    const role = url.searchParams.get("role");
    const all = UserRepo.all();
    return jsonOk({ users: role ? all.filter((u) => u.role === role) : all });
  } catch (e) {
    return await jsonError(e);
  }
}