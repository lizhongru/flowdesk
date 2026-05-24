import { describe, it, expect, beforeEach } from 'vitest';
import Database from 'better-sqlite3';
import { migrate } from '../../../src/main/db/migrations';

function createTestDb(): Database.Database {
  return new Database(':memory:');
}

describe('migrate', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDb();
  });

  it('新数据库运行所有迁移', () => {
    migrate(db);

    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all() as { name: string }[];
    const tableNames = tables.map(t => t.name);

    expect(tableNames).toContain('workflows');
    expect(tableNames).toContain('execution_logs');
    expect(tableNames).toContain('schema_migrations');
  });

  it('新数据库有正确的 schema_migrations 记录', () => {
    migrate(db);

    const rows = db.prepare('SELECT version, name FROM schema_migrations ORDER BY version').all() as { version: number; name: string }[];
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ version: 1, name: 'initial-schema' });
    expect(rows[1]).toEqual({ version: 2, name: 'add-category-and-notify' });
    expect(rows[2]).toEqual({ version: 3, name: 'history-index' });
  });

  it('幂等性：重复运行不会重复应用迁移', () => {
    migrate(db);
    migrate(db);

    const rows = db.prepare('SELECT version FROM schema_migrations').all();
    expect(rows).toHaveLength(3);
  });

  it('workflows 表有正确的列', () => {
    migrate(db);

    const columns = db.prepare('PRAGMA table_info(workflows)').all() as { name: string }[];
    const colNames = columns.map(c => c.name);

    expect(colNames).toContain('id');
    expect(colNames).toContain('name');
    expect(colNames).toContain('category');
    expect(colNames).toContain('notify_on_complete');
    expect(colNames).toContain('nodes');
    expect(colNames).toContain('edges');
  });

  it('execution_logs 表有正确的列和索引', () => {
    migrate(db);

    const columns = db.prepare('PRAGMA table_info(execution_logs)').all() as { name: string }[];
    const colNames = columns.map(c => c.name);
    expect(colNames).toContain('id');
    expect(colNames).toContain('workflow_id');
    expect(colNames).toContain('status');

    const indexes = db.prepare("PRAGMA index_list('execution_logs')").all() as { name: string }[];
    const indexNames = indexes.map(i => i.name);
    expect(indexNames).toContain('idx_exec_logs_workflow');
    expect(indexNames).toContain('idx_exec_logs_started_at');
  });

  it('遗留数据库向后兼容：已有表和列时正确标记迁移', () => {
    // 模拟旧数据库：手动创建表结构
    db.exec(`
      CREATE TABLE workflows (
        id TEXT PRIMARY KEY, name TEXT, description TEXT, category TEXT,
        nodes TEXT, edges TEXT, enabled INTEGER, created_at TEXT, updated_at TEXT,
        execution_count INTEGER, last_executed_at TEXT, notify_on_complete INTEGER
      );
      CREATE TABLE execution_logs (
        id TEXT PRIMARY KEY, workflow_id TEXT, status TEXT, trigger_type TEXT,
        started_at TEXT, finished_at TEXT, node_logs TEXT
      );
    `);

    migrate(db);

    const rows = db.prepare('SELECT version FROM schema_migrations ORDER BY version').all() as { version: number }[];
    const versions = rows.map(r => r.version);

    // 迁移 1 和 2 应被标记为已应用（表和列已存在）
    expect(versions).toContain(1);
    expect(versions).toContain(2);
    // 迁移 3（history-index）应被执行
    expect(versions).toContain(3);

    // 验证索引已创建
    const indexes = db.prepare("PRAGMA index_list('execution_logs')").all() as { name: string }[];
    expect(indexes.map(i => i.name)).toContain('idx_exec_logs_started_at');
  });
});
