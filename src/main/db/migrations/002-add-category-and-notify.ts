import type Database from 'better-sqlite3';

export const migration = {
  version: 2,
  name: 'add-category-and-notify',
  up: (db: Database.Database) => {
    const columns = db.prepare('PRAGMA table_info(workflows)').all() as { name: string }[];
    const colNames = new Set(columns.map(c => c.name));

    if (!colNames.has('category')) {
      db.exec("ALTER TABLE workflows ADD COLUMN category TEXT NOT NULL DEFAULT '其他'");
    }
    if (!colNames.has('notify_on_complete')) {
      db.exec('ALTER TABLE workflows ADD COLUMN notify_on_complete INTEGER NOT NULL DEFAULT 0');
    }
  },
};
