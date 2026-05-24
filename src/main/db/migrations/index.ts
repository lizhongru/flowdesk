import type Database from 'better-sqlite3';
import { migration as m001 } from './001-initial-schema';
import { migration as m002 } from './002-add-category-and-notify';
import { migration as m003 } from './003-history-index';

export interface Migration {
  version: number;
  name: string;
  up: (db: Database.Database) => void;
}

const allMigrations: Migration[] = [m001, m002, m003].sort((a, b) => a.version - b.version);

export function migrate(db: Database.Database): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`);

  const hasLegacyData = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='workflows'"
  ).get();

  const applied = db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[];
  const appliedVersions = new Set(applied.map(r => r.version));

  // 向后兼容：旧 DB 无 schema_migrations 记录时，探测已存在的表和列
  if (hasLegacyData && appliedVersions.size === 0) {
    const now = new Date().toISOString();
    const insert = db.prepare('INSERT OR IGNORE INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)');

    // 迁移 1（初始表结构）：workflows 表存在即视为已满足
    insert.run(1, 'initial-schema', now);
    appliedVersions.add(1);

    // 迁移 2（category/notify 列）：探测列是否存在
    const columns = db.prepare('PRAGMA table_info(workflows)').all() as { name: string }[];
    const colNames = new Set(columns.map(c => c.name));
    if (colNames.has('category') && colNames.has('notify_on_complete')) {
      insert.run(2, 'add-category-and-notify', now);
      appliedVersions.add(2);
    }
  }

  for (const m of allMigrations) {
    if (appliedVersions.has(m.version)) continue;
    db.transaction(() => {
      m.up(db);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)')
        .run(m.version, m.name, new Date().toISOString());
    })();
    console.log(`[DB] 迁移完成: v${m.version} ${m.name}`);
  }
}
