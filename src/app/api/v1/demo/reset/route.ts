import { NextResponse } from "next/server";
import { resetDb } from "@/lib/data/db";
import { seedDemo } from "@/lib/seed-runtime";

export async function POST() {
  try {
    resetDb();
    seedDemo();
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: { code: "RESEED_FAILED", message: String(e?.message ?? e) } }, { status: 500 });
  }
}