import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('database', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { dbType, dbPath, host, port, user, password, database, query, params } = config as any;

  if (!query) throw new Error('未指定 SQL 查询');

  let queryParams: unknown[] = [];
  if (params) {
    if (typeof params === 'string') {
      try { queryParams = JSON.parse(params); } catch { queryParams = []; }
    } else if (Array.isArray(params)) {
      queryParams = params;
    }
  }

  const isSelect = /^\s*select/i.test(query);

  if (dbType === 'sqlite') {
    if (!dbPath) throw new Error('未指定 SQLite 数据库文件路径');

    const Database = (await import('better-sqlite3')).default;
    const db = new Database(dbPath);

    try {
      if (isSelect) {
        const stmt = db.prepare(query);
        const rows = queryParams.length > 0 ? stmt.all(...queryParams) : stmt.all();
        return { rows, changes: 0, lastInsertRowid: null };
      } else {
        const stmt = db.prepare(query);
        const result = queryParams.length > 0 ? stmt.run(...queryParams) : stmt.run();
        return { rows: [], changes: result.changes, lastInsertRowid: result.lastInsertRowid };
      }
    } finally {
      db.close();
    }
  }

  if (dbType === 'mysql') {
    if (!host) throw new Error('未指定 MySQL 主机');
    if (!database) throw new Error('未指定数据库名');

    const mysql = await import('mysql2/promise');
    const conn = await mysql.createConnection({
      host,
      port: Number(port) || 3306,
      user,
      password,
      database,
    });

    try {
      const [rowsOrResult] = await conn.execute(query, queryParams);

      if (isSelect) {
        return { rows: rowsOrResult, changes: 0, lastInsertRowid: null };
      } else {
        const result = rowsOrResult as any;
        return { rows: [], changes: result.affectedRows || 0, lastInsertRowid: result.insertId || null };
      }
    } finally {
      await conn.end();
    }
  }

  throw new Error(`不支持的数据库类型: ${dbType}`);
});
