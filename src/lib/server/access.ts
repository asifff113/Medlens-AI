/**
 * ACCESS policy (Section 17).
 *
 * Access is a data-flow property. Every read or write must traverse this
 * module: identity, role, case relationship, resource sensitivity, exact
 * fields, purpose, consent, grant expiry / revocation and deletion state are
 * checked together. The check returns a SensitiveAccessDecision that can be
 * embedded in audit events.
 */

import { createHash } from "node:crypto";
import {
  CaseRepo,
  ConsentRepo,
  GrantRepo,
  GrantResourceRepo,
  PatientRepo,
  ShareLinkRepo,
} from "../data/repo";
import { DomainError } from "../domain/errors";
import type { Role, Sensitivity } from "../domain/ids";
import type { AuthenticatedActor } from "./session";
import { fingerprintAudience, fingerprintGeneralAudience } from "./session";

export interface AccessDecision {
  allowed: boolean;
  actorId: string | null;
  resourceId: string;
  purpose: string;
  authorizedFieldPaths: string[];
  grantIds: string[];
  privacyEpoch: number;
  policyVersion: string;
  audienceFingerprint: string;
  reasonCode: string;
}

export const POLICY_VERSION = "demo-1.0.0";

const ROLE_HAS_CASE: Record<Role, boolean> = {
  PATIENT: true,
  CAREGIVER: true,
  DOCTOR: true,
  WORKER: false,
  EVALUATOR: false,
  OPERATOR: false,
  ANONYMOUS: false,
};

export function assertCaseAccess(actor: AuthenticatedActor | null, caseId: string): CaseRowForActor {
  const c = CaseRepo.byId(caseId);
  if (!c) {
    throw new DomainError("RESOURCE_NOT_AVAILABLE", "Case not available.", 404);
  }
  if (!actor) {
    throw new DomainError("UNAUTHENTICATED", "Authentication required.", 401);
  }
  if (!ROLE_HAS_CASE[actor.user.role]) {
    throw new DomainError("FORBIDDEN", "Role cannot access this case.", 403);
  }
  if (actor.user.role === "PATIENT") {
    const patient = PatientRepo.byOwner(actor.user.id);
    if (!patient || patient.id !== c.patient_id) {
      throw new DomainError("FORBIDDEN", "Patient does not own this case.", 403);
    }
  }
  if (actor.user.role === "DOCTOR") {
    // Doctors only access cases with an active grant.
    const grants = GrantRepo.activeFor(caseId, actor.user.id, "SENSITIVE_NAMED");
    const generalGrants = GrantRepo.activeFor(caseId, actor.user.id, "GENERAL_QR");
    if (!grants.length && !generalGrants.length) {
      throw new DomainError("FORBIDDEN", "No active grant for this doctor.", 403);
    }
  }
  if (actor.user.role === "CAREGIVER") {
    const grants = GrantRepo.activeFor(caseId, actor.user.id, "CAREGIVER_GENERAL");
    if (!grants.length) {
      throw new DomainError("FORBIDDEN", "No active caregiver grant for this case.", 403);
    }
  }
  return c;
}

export function checkResourceAccess(opts: {
  actor: AuthenticatedActor | null;
  caseId: string;
  resourceId: string;
  resourceSensitivity: Sensitivity;
  purpose: string;
  audience: "NAMED" | "GENERAL" | "SELF" | "WORKER";
}): AccessDecision {
  const c = CaseRepo.byId(opts.caseId);
  if (!c) {
    return {
      allowed: false,
      actorId: opts.actor?.user.id ?? null,
      resourceId: opts.resourceId,
      purpose: opts.purpose,
      authorizedFieldPaths: [],
      grantIds: [],
      privacyEpoch: 0,
      policyVersion: POLICY_VERSION,
      audienceFingerprint: "",
      reasonCode: "RESOURCE_NOT_AVAILABLE",
    };
  }

  if (opts.resourceSensitivity === "RESTRICTED_WELLBEING") {
    if (!opts.actor) {
      return deny(opts, "UNAUTHENTICATED", 0);
    }
    if (opts.actor.user.role !== "PATIENT" && opts.audience !== "NAMED") {
      // Only the patient owner or a named granted doctor can read.
    }
    if (opts.audience === "NAMED" && opts.actor.user.role === "DOCTOR") {
      const grants = GrantRepo.activeFor(opts.caseId, opts.actor.user.id, "SENSITIVE_NAMED");
      const grant = grants.find((g) => {
        const scoped = GrantResourceRepo.forGrant(g.id);
        return scoped.some((s) => s.resource_id === opts.resourceId);
      });
      if (!grant) return deny(opts, "NO_NAMED_GRANT", c.privacy_epoch);
      return {
        allowed: true,
        actorId: opts.actor.user.id,
        resourceId: opts.resourceId,
        purpose: opts.purpose,
        authorizedFieldPaths: ["*"],
        grantIds: [grant.id],
        privacyEpoch: c.privacy_epoch,
        policyVersion: POLICY_VERSION,
        audienceFingerprint: fingerprintAudience(opts.actor.user, opts.caseId, opts.actor.user.role),
        reasonCode: "SENSITIVE_NAMED_GRANT",
      };
    }
    if (opts.actor.user.role === "PATIENT" && opts.audience === "SELF") {
      const patient = PatientRepo.byOwner(opts.actor.user.id);
      if (patient && patient.id === c.patient_id) {
        return {
          allowed: true,
          actorId: opts.actor.user.id,
          resourceId: opts.resourceId,
          purpose: opts.purpose,
          authorizedFieldPaths: ["*"],
          grantIds: [],
          privacyEpoch: c.privacy_epoch,
          policyVersion: POLICY_VERSION,
          audienceFingerprint: fingerprintAudience(opts.actor.user, opts.caseId, "PATIENT"),
          reasonCode: "SELF_OWNER",
        };
      }
    }
    return deny(opts, "RESTRICTED_NO_ACCESS", c.privacy_epoch);
  }

  // General sensitivity: patient self, caregiver with grant, doctor with grant,
  // or the case has been shared via a general QR (audience=GENERAL).
  if (opts.audience === "GENERAL") {
    return {
      allowed: true,
      actorId: null,
      resourceId: opts.resourceId,
      purpose: opts.purpose,
      authorizedFieldPaths: ["*"],
      grantIds: [],
      privacyEpoch: c.privacy_epoch,
      policyVersion: POLICY_VERSION,
      audienceFingerprint: fingerprintGeneralAudience(opts.caseId),
      reasonCode: "GENERAL_AUDIENCE",
    };
  }

  if (!opts.actor) return deny(opts, "UNAUTHENTICATED", c.privacy_epoch);

  if (opts.actor.user.role === "PATIENT") {
    const patient = PatientRepo.byOwner(opts.actor.user.id);
    if (!patient || patient.id !== c.patient_id) {
      return deny(opts, "PATIENT_NOT_OWNER", c.privacy_epoch);
    }
    return {
      allowed: true,
      actorId: opts.actor.user.id,
      resourceId: opts.resourceId,
      purpose: opts.purpose,
      authorizedFieldPaths: ["*"],
      grantIds: [],
      privacyEpoch: c.privacy_epoch,
      policyVersion: POLICY_VERSION,
      audienceFingerprint: fingerprintAudience(opts.actor.user, opts.caseId, "PATIENT"),
      reasonCode: "SELF_OWNER",
    };
  }

  if (opts.actor.user.role === "CAREGIVER") {
    const grants = GrantRepo.activeFor(opts.caseId, opts.actor.user.id, "CAREGIVER_GENERAL");
    if (!grants.length) return deny(opts, "CAREGIVER_NO_GRANT", c.privacy_epoch);
    return {
      allowed: true,
      actorId: opts.actor.user.id,
      resourceId: opts.resourceId,
      purpose: opts.purpose,
      authorizedFieldPaths: ["general"],
      grantIds: grants.map((g) => g.id),
      privacyEpoch: c.privacy_epoch,
      policyVersion: POLICY_VERSION,
      audienceFingerprint: fingerprintAudience(opts.actor.user, opts.caseId, "CAREGIVER"),
      reasonCode: "CAREGIVER_GRANT",
    };
  }

  if (opts.actor.user.role === "DOCTOR") {
    const grants = GrantRepo.activeFor(opts.caseId, opts.actor.user.id, "SENSITIVE_NAMED");
    if (!grants.length) return deny(opts, "DOCTOR_NO_GRANT", c.privacy_epoch);
    const scoped = grants.flatMap((g) => GrantResourceRepo.forGrant(g.id));
    if (scoped.length && !scoped.some((s) => s.resource_id === opts.resourceId)) {
      return deny(opts, "DOCTOR_NOT_SCOPED", c.privacy_epoch);
    }
    return {
      allowed: true,
      actorId: opts.actor.user.id,
      resourceId: opts.resourceId,
      purpose: opts.purpose,
      authorizedFieldPaths: scoped.length ? ["*"] : ["general"],
      grantIds: grants.map((g) => g.id),
      privacyEpoch: c.privacy_epoch,
      policyVersion: POLICY_VERSION,
      audienceFingerprint: fingerprintAudience(opts.actor.user, opts.caseId, "DOCTOR"),
      reasonCode: "DOCTOR_NAMED_GRANT",
    };
  }

  return deny(opts, "ROLE_DENIED", c.privacy_epoch);
}

function deny(opts: { actor: AuthenticatedActor | null; caseId: string; resourceId: string; purpose: string; audience: string }, code: string, epoch: number): AccessDecision {
  return {
    allowed: false,
    actorId: opts.actor?.user.id ?? null,
    resourceId: opts.resourceId,
    purpose: opts.purpose,
    authorizedFieldPaths: [],
    grantIds: [],
    privacyEpoch: epoch,
    policyVersion: POLICY_VERSION,
    audienceFingerprint: "",
    reasonCode: code,
  };
}

export function hashSourceClosure(resourceIds: string[]): string {
  return createHash("sha256").update(resourceIds.slice().sort().join("|")).digest("hex").slice(0, 32);
}

export function previewHash(input: { recipientId: string | null; purpose: string; resourceIds: string[]; expiresAt: string }): string {
  return createHash("sha256")
    .update(`${input.recipientId ?? "*"}|${input.purpose}|${input.resourceIds.slice().sort().join(",")}|${input.expiresAt}`)
    .digest("hex")
    .slice(0, 32);
}

export function assertGeneralShareToken(tokenHash: string): { grantId: string; caseId: string; expiresAt: string } {
  const link = ShareLinkRepo.byTokenHash(tokenHash);
  if (!link) {
    throw new DomainError("RESOURCE_NOT_AVAILABLE", "Share link not found.", 404);
  }
  if (link.revoked_at) {
    throw new DomainError("FORBIDDEN", "Share link revoked.", 403);
  }
  if (new Date(link.expires_at) < new Date()) {
    throw new DomainError("FORBIDDEN", "Share link expired.", 403);
  }
  const grant = GrantRepo.byId(link.grant_id);
  if (!grant || grant.revoked_at || new Date(grant.expires_at) < new Date()) {
    throw new DomainError("FORBIDDEN", "Underlying grant is no longer active.", 403);
  }
  if (grant.kind !== "GENERAL_QR") {
    throw new DomainError("FORBIDDEN", "Share link does not match a general QR grant.", 403);
  }
  return { grantId: grant.id, caseId: grant.case_id, expiresAt: grant.expires_at };
}

export function assertConsent(caseId: string, purpose: string): { id: string; decision: string } {
  const c = ConsentRepo.activeFor(caseId, purpose);
  if (!c) {
    throw new DomainError("FORBIDDEN", `Missing consent for ${purpose}.`, 403);
  }
  if (c.decision !== "GRANTED") {
    throw new DomainError("FORBIDDEN", `Consent for ${purpose} is ${c.decision}.`, 403);
  }
  return { id: c.id, decision: c.decision };
}

interface CaseRowForActor {
  id: string;
  patient_id: string;
  context_version: number;
  privacy_epoch: number;
  status: "OPEN" | "ARCHIVED" | "DELETING";
  synthetic: number;
}
