import { jsonOk } from "@/lib/server/api";
import { getActor } from "@/lib/server/session";

export async function GET() {
  const actor = await getActor();
  if (!actor) return jsonOk({ user: null });
  return jsonOk({
    user: {
      id: actor.user.id,
      authSubject: actor.user.auth_subject,
      role: actor.user.role,
      displayName: actor.user.display_name,
      locale: actor.user.locale,
    },
    purpose: actor.purpose,
  });
}
