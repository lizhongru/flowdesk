import type Database from 'better-sqlite3';

export const migration = {
  version: 3,
  name: 'history-index',
  up: (db: Database.Database) => {
    db.exec('CREATE INDEX IF NOT EXISTS idx_exec_logs_started_at ON execution_logs(started_at DESC)');
  },
};
