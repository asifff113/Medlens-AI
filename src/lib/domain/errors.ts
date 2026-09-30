/**
 * Domain errors map directly to the API error contract (Section 15.1).
 * Route handlers translate these into HTTP responses with the correct status,
 * non-revealing message and requestId.
 */

export type DomainErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "RESOURCE_NOT_AVAILABLE"
  | "STALE_VERSION"
  | "IDEMPOTENCY_CONFLICT"
  | "VALIDATION_FAILED"
  | "ASSESSMENT_INCOMPLETE"
  | "INVALID_RESPONSE"
  | "INSTRUMENT_UNAVAILABLE"
  | "CONSENT_REVOKED"
  | "CONTEXT_CHANGED"
  | "UPLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "BAD_REQUEST";

export class DomainError extends Error {
  public readonly code: DomainErrorCode;
  public readonly status: number;
  public readonly fieldErrors?: Record<string, string>;

  constructor(code: DomainErrorCode, message: string, status?: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status ?? defaultStatusFor(code);
    this.fieldErrors = fieldErrors;
  }
}

function defaultStatusFor(code: DomainErrorCode): number {
  switch (code) {
    case "UNAUTHENTICATED":
      return 401;
    case "FORBIDDEN":
    case "CONSENT_REVOKED":
      return 403;
    case "RESOURCE_NOT_AVAILABLE":
      return 404;
    case "STALE_VERSION":
    case "IDEMPOTENCY_CONFLICT":
    case "CONTEXT_CHANGED":
      return 409;
    case "UPLOAD_TOO_LARGE":
      return 413;
    case "UNSUPPORTED_MEDIA":
      return 415;
    case "VALIDATION_FAILED":
    case "ASSESSMENT_INCOMPLETE":
    case "INVALID_RESPONSE":
      return 422;
    case "RATE_LIMITED":
      return 429;
    case "PROVIDER_UNAVAILABLE":
    case "INSTRUMENT_UNAVAILABLE":
      return 503;
    default:
      return 400;
  }
}

export function isDomainError(e: unknown): e is DomainError {
  return e instanceof DomainError;
}
