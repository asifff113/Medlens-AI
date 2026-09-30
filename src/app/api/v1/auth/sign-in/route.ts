import { NextRequest, NextResponse } from "next/server";
import { signIn } from "@/lib/server/session";
import { jsonError, jsonOk, readJson } from "@/lib/server/api";
import { z } from "zod";

const Body = z.object({
  authSubject: z.string().min(1).max(120).optional(),
  usernameOrEmail: z.string().min(1).max(120).optional(),
  password: z.string().min(1).max(120),
});

export async function POST(req: NextRequest) {
  try {
    const raw = await readJson(req);
    const body = Body.parse(raw);
    const subject = body.authSubject ?? body.usernameOrEmail;
    if (!subject) throw new Error("BAD_REQUEST");
    const result = signIn(subject, body.password);
    if (!result) {
      return NextResponse.json(
        { error: { code: "UNAUTHENTICATED", message: "Invalid credentials.", requestId: crypto.randomUUID() } },
        { status: 401 },
      );
    }
    const res = await jsonOk({ user: { id: result.user.id, displayName: result.user.display_name, role: result.user.role, locale: result.user.locale } });
    res.cookies.set("medlens_session", result.sessionId, { httpOnly: true, sameSite: "lax", path: "/" });
    return res;
  } catch (e) {
    return await jsonError(e);
  }
}