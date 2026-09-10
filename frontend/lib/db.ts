import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = path.join(process.cwd(), ".data");
const DB_PATH = path.join(DB_DIR, "app.db");
const SCHEMA_PATH = path.join(process.cwd(), "db", "schema.sql");

// Survives Next.js dev-mode module reloads (same pattern used for Prisma
// clients) so `next dev` doesn't open a new connection on every edit.
declare global {
  var __appDb: Database.Database | undefined;
}

export function getDb(): Database.Database {
  if (global.__appDb) return global.__appDb;

  fs.mkdirSync(DB_DIR, { recursive: true });
  const db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf-8"));

  global.__appDb = db;
  return db;
}
