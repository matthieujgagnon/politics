import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

// DB_DIR lets a host with a mounted persistent disk (e.g. Render) point
// this at the disk's mount path via an env var, instead of the app
// guessing where that host's filesystem layout puts process.cwd().
const DB_DIR = process.env.DB_DIR ?? path.join(process.cwd(), ".data");
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
