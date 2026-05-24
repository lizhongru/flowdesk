import Database from 'better-sqlite3';
import path from 'node:path';
import { app } from 'electron';
import { migrate } from './migrations';

let db: Database.Database;

export function getDatabase(): Database.Database {
  return db;
}

export function setDatabase(database: Database.Database): void {
  db = database;
}

export function initDatabase(): void {
  const dbPath = path.join(app.getPath('userData'), 'flowdesk.db');
  db = new Database(dbPath);

  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
}
