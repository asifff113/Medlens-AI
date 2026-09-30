/**
 * SQLite database bootstrap. The schema is created on first import and the
 * data directory is created on demand. This module is server-only — it must
 * never be imported from a client component.
 */

import Database from "better-sqlite3";
import { mkdirSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { SCHEMA_STATEMENTS } from "./schema-sql";

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;
  const dbPath = process.env.DATABASE_URL ?? "./data/medlens.db";
  const absPath = resolve(dbPath);
  if (!existsSync(dirname(absPath))) mkdirSync(dirname(absPath), { recursive: true });
  const db = new Database(absPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  for (const stmt of SCHEMA_STATEMENTS) {
    db.exec(stmt);
  }
  _db = db;
  return db;
}

export function resetDb() {
  const db = getDb();
  // Drop all known tables (demo only).
  const tables = [
    "evaluation_metric",
    "evaluation_run",
    "evaluation_case",
    "evaluation_set",
    "support_event",
    "support_resource",
    "support_protocol",
    "instrument_item",
    "instrument_definition",
    "assessment_response",
    "assessment_revision",
    "assessment_session",
    "wellbeing_entry",
    "medication_event",
    "audit_event",
    "idempotency_receipt",
    "job",
    "brief_item",
    "brief",
    "update_item",
    "visit_update",
    "review_task",
    "review_action",
    "question",
    "interview",
    "issue",
    "context_snapshot",
    "order_result_link",
    "test_order",
    "lab_observation",
    "medication_claim",
    "evidence_anchor",
    "document_page",
    "source_artifact",
    "fact_revision",
    "fact",
    "grant_resource",
    "share_link",
    "grant",
    "consent",
    "encounter",
    "caregiver_relationship",
    "provider",
    "clinician_profile",
    "case",
    "patient",
    "session",
    "evidence_edge",
    "user",
  ];
  for (const t of tables) {
    try {
      db.exec(`DROP TABLE IF EXISTS "${t}"`);
    } catch {
      // ignore
    }
  }
  for (const stmt of SCHEMA_STATEMENTS) {
    db.exec(stmt);
  }
}

export function closeDb() {
  if (_db) {
    _db.close();
    _db = null;
  }
}
