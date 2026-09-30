/**
 * Shared API response helpers.
 */

import { NextResponse } from "next/server";
import { DomainError } from "../domain/errors";
import { requestId } from "./session";

export async function jsonOk<T>(data: T, meta?: Record<string, unknown>) {
  return NextResponse.json({ data, meta: { requestId: await requestId(), ...(meta ?? {}) } });
}

export async function jsonError(err: unknown) {
  const rid = await requestId();
  if (err instanceof DomainError) {
    return NextResponse.json(
      {
        error: {
          code: err.code,
          message: err.message,
          fieldErrors: err.fieldErrors,
          requestId: rid,
        },
      },
      { status: err.status },
    );
  }
  if (err instanceof Error && (err.message === "UNAUTHENTICATED" || err.message === "FORBIDDEN")) {
    return NextResponse.json(
      { error: { code: err.message, message: "Not allowed.", requestId: rid } },
      { status: err.message === "UNAUTHENTICATED" ? 401 : 403 },
    );
  }
  // eslint-disable-next-line no-console
  console.error("[api]", err);
  return NextResponse.json(
    { error: { code: "INTERNAL", message: "Unexpected server error.", requestId: rid } },
    { status: 500 },
  );
}

export async function readJson<T = unknown>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new DomainError("BAD_REQUEST", "Invalid JSON body.", 400);
  }
}
