import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { signOut } from "@/lib/server/session";

export async function POST() {
  const cookieStore = await cookies();
  const sid = cookieStore.get("medlens_session")?.value;
  if (sid) signOut(sid);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete("medlens_session");
  return res;
}
