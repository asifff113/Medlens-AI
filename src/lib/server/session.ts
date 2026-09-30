/**
 * Authentication, session and current-actor helpers.
 *
 * This module exposes the only API for verifying who is making a request.
 * It is deliberately small and self-contained: a per-user demo password
 * (case-sensitive), a session cookie and helpers that read the cookie off a
 * Next.js request and resolve a typed actor.
 *
 * In production we would wire this to Better Auth. The integration surface
 * is identical (issue / verify session, sign-in / sign-out, reauthenticate)
 * so swapping the implementation later is a localised change.
 */

import { cookies, headers } from "next/headers";
import { nanoid } from "nanoid";
import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { SessionRepo, UserRepo } from "../data/repo";
import type { UserRow } from "../data/schema";
import type { Role } from "../domain/ids";

const COOKIE_NAME = "medlens_session";
const SESSION_TTL_HOURS = 12;

export interface AuthenticatedActor {
  user: UserRow;
  sessionId: string;
  purpose: "DEFAULT" | "PRIVATE_WELLBEING" | "DOCTOR_REVIEW";
}

export function hashPassword(plain: string): string {
  const salt = "medlens-demo-salt";
  const derived = scryptSync(plain, salt, 64);
  return `${salt}:${derived.toString("hex")}`;
}

export function verifyPassword(plain: string, hash: string | null): boolean {
  if (!hash) return false;
  const [salt, expectedHex] = hash.split(":");
  if (!salt || !expectedHex) return false;
  const derived = scryptSync(plain, salt, 64);
  const expected = Buffer.from(expectedHex, "hex");
  if (derived.length !== expected.length) return false;
  return timingSafeEqual(derived, expected);
}

export function signIn(authSubject: string, password: string): { sessionId: string; user: UserRow } | null {
  const user = UserRepo.byAuthSubject(authSubject);
  if (!user) return null;
  if (user.disabled_at) return null;
  if (!verifyPassword(password, user.password_hash)) return null;
  const sessionId = nanoid(32);
  SessionRepo.create({
    id: sessionId,
    user_id: user.id,
    expires_at: new Date(Date.now() + SESSION_TTL_HOURS * 3600 * 1000).toISOString(),
    purpose: "DEFAULT",
    created_at: new Date().toISOString(),
  });
  return { sessionId, user };
}

export function signOut(sessionId: string) {
  SessionRepo.delete(sessionId);
}

export async function getActor(): Promise<AuthenticatedActor | null> {
  const cookieStore = await cookies();
  const sid = cookieStore.get(COOKIE_NAME)?.value;
  if (!sid) return null;
  const session = SessionRepo.byId(sid);
  if (!session) return null;
  const user = UserRepo.byId(session.user_id);
  if (!user) return null;
  return { user, sessionId: sid, purpose: session.purpose as AuthenticatedActor["purpose"] };
}

export async function requireActor(): Promise<AuthenticatedActor> {
  const actor = await getActor();
  if (!actor) {
    throw new Error("UNAUTHENTICATED");
  }
  return actor;
}

export async function requireRole(roles: Role[]): Promise<AuthenticatedActor> {
  const actor = await requireActor();
  if (!roles.includes(actor.user.role)) {
    throw new Error("FORBIDDEN");
  }
  return actor;
}

export async function setSessionCookie(sessionId: string) {
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: false, // demo; production would set true behind TLS
    path: "/",
    maxAge: SESSION_TTL_HOURS * 3600,
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

export function fingerprintAudience(user: UserRow, caseId: string, role: Role): string {
  return createHash("sha256")
    .update(`${user.id}|${caseId}|${role}`)
    .digest("hex")
    .slice(0, 16);
}

export function fingerprintGeneralAudience(caseId: string): string {
  return createHash("sha256").update(`general|${caseId}`).digest("hex").slice(0, 16);
}

export async function requestId(): Promise<string> {
  const incoming = (await headers()).get("x-request-id");
  if (incoming && incoming.length <= 64) return incoming;
  return nanoid(16);
}
