import { getDatabase } from './index';
import type { ExecutionLog, NodeExecutionLog, ExecutionHistoryEntry } from '../../../shared/types';

interface ExecutionLogRow {
  id: string;
  workflow_id: string;
  status: string;
  trigger_type: string;
  started_at: string;
  finished_at: string | null;
  node_logs: string;
}

function rowToExecutionLog(row: ExecutionLogRow): ExecutionLog {
  return {
    id: row.id,
    workflowId: row.workflow_id,
    status: row.status as ExecutionLog['status'],
    triggerType: row.trigger_type,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    nodeLogs: JSON.parse(row.node_logs) as NodeExecutionLog[],
  };
}

export function saveExecutionLog(log: ExecutionLog): void {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO execution_logs (id, workflow_id, status, trigger_type, started_at, finished_at, node_logs)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    log.id,
    log.workflowId,
    log.status,
    log.triggerType,
    log.startedAt,
    log.finishedAt,
    JSON.stringify(log.nodeLogs)
  );
}

export function getExecutionLogs(workflowId: string, limit = 20): ExecutionLog[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM execution_logs
    WHERE workflow_id = ?
    ORDER BY started_at DESC
    LIMIT ?
  `).all(workflowId, limit) as ExecutionLogRow[];

  return rows.map(rowToExecutionLog);
}

export function getExecutionLogById(id: string): ExecutionLog | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM execution_logs WHERE id = ?').get(id) as ExecutionLogRow | undefined;
  return row ? rowToExecutionLog(row) : undefined;
}

interface ExecutionHistoryRow {
  id: string;
  workflow_id: string;
  workflow_name: string | null;
  status: string;
  trigger_type: string;
  started_at: string;
  finished_at: string | null;
}

export function getAllExecutionHistory(
  options: { status?: string; offset?: number; limit?: number } = {}
): { items: ExecutionHistoryEntry[]; total: number } {
  const db = getDatabase();
  const { status, offset = 0, limit = 20 } = options;

  const conditions: string[] = [];
  const params: unknown[] = [];

  if (status && status !== 'all') {
    conditions.push('e.status = ?');
    params.push(status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const countRow = db.prepare(
    `SELECT COUNT(*) as total FROM execution_logs e ${where}`
  ).get(...params) as { total: number };

  const rows = db.prepare(`
    SELECT e.id, e.workflow_id, w.name as workflow_name, e.status, e.trigger_type, e.started_at, e.finished_at
    FROM execution_logs e
    LEFT JOIN workflows w ON w.id = e.workflow_id
    ${where}
    ORDER BY e.started_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset) as ExecutionHistoryRow[];

  const items: ExecutionHistoryEntry[] = rows.map(row => {
    const duration = row.finished_at
      ? new Date(row.finished_at).getTime() - new Date(row.started_at).getTime()
      : null;
    return {
      id: row.id,
      workflowId: row.workflow_id,
      workflowName: row.workflow_name || '(已删除的工作流)',
      status: row.status as ExecutionHistoryEntry['status'],
      triggerType: row.trigger_type,
      startedAt: row.started_at,
      finishedAt: row.finished_at,
      duration,
    };
  });

  return { items, total: countRow.total };
}
