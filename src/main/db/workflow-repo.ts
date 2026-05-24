import { randomUUID } from 'node:crypto';
import { getDatabase } from './index';
import type { Workflow, WorkflowNode, WorkflowEdge } from '../../../shared/types';

interface WorkflowRow {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: string;
  edges: string;
  enabled: number;
  notify_on_complete: number;
  created_at: string;
  updated_at: string;
  execution_count: number;
  last_executed_at: string | null;
}

const ICON_MIGRATION: Record<string, string> = {
  '▶': 'Play', '⏰': 'Clock', '📁': 'Eye', '⌨': 'Keyboard',
  '📂': 'FolderSync', '💻': 'Terminal', '🌐': 'Globe', '📋': 'Clipboard',
  '🔔': 'Bell', '⏳': 'Timer', '❓': 'GitBranch', '🔄': 'Repeat', '📝': 'Variable',
};

function rowToWorkflow(row: WorkflowRow): Workflow {
  const nodes = (JSON.parse(row.nodes) as WorkflowNode[]).map(n => {
    const migrated = ICON_MIGRATION[n.data?.icon as string];
    if (migrated) return { ...n, data: { ...n.data, icon: migrated } };
    return n;
  });
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    category: row.category || '其他',
    nodes,
    edges: JSON.parse(row.edges) as WorkflowEdge[],
    enabled: row.enabled === 1,
    notifyOnComplete: row.notify_on_complete === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    executionCount: row.execution_count,
    lastExecutedAt: row.last_executed_at,
  };
}

export function getAllWorkflows(): Workflow[] {
  const db = getDatabase();
  const rows = db.prepare('SELECT * FROM workflows ORDER BY updated_at DESC').all() as WorkflowRow[];
  return rows.map(rowToWorkflow);
}

export function getWorkflowById(id: string): Workflow | undefined {
  const db = getDatabase();
  const row = db.prepare('SELECT * FROM workflows WHERE id = ?').get(id) as WorkflowRow | undefined;
  return row ? rowToWorkflow(row) : undefined;
}

export function isWorkflowNameTaken(name: string, excludeId?: string): boolean {
  const db = getDatabase();
  if (excludeId) {
    const row = db.prepare('SELECT 1 FROM workflows WHERE name = ? AND id != ?').get(name, excludeId);
    return !!row;
  }
  const row = db.prepare('SELECT 1 FROM workflows WHERE name = ?').get(name);
  return !!row;
}

export function createWorkflow(data: Partial<Workflow>): Workflow {
  const db = getDatabase();
  const id = randomUUID();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO workflows (id, name, description, category, nodes, edges, enabled, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.name || '未命名工作流',
    data.description || '',
    data.category || '其他',
    JSON.stringify(data.nodes || []),
    JSON.stringify(data.edges || []),
    data.enabled ? 1 : 0,
    now,
    now
  );

  return getWorkflowById(id)!;
}

export function updateWorkflow(id: string, data: Partial<Workflow>): Workflow | undefined {
  const db = getDatabase();
  const existing = getWorkflowById(id);
  if (!existing) return undefined;

  const now = new Date().toISOString();

  db.prepare(`
    UPDATE workflows SET
      name = ?, description = ?, category = ?, nodes = ?, edges = ?,
      enabled = ?, notify_on_complete = ?, updated_at = ?
    WHERE id = ?
  `).run(
    data.name ?? existing.name,
    data.description ?? existing.description,
    data.category ?? existing.category,
    JSON.stringify(data.nodes ?? existing.nodes),
    JSON.stringify(data.edges ?? existing.edges),
    (data.enabled ?? existing.enabled) ? 1 : 0,
    (data.notifyOnComplete ?? existing.notifyOnComplete) ? 1 : 0,
    now,
    id
  );

  return getWorkflowById(id)!;
}

export function deleteWorkflow(id: string): boolean {
  const db = getDatabase();
  const result = db.prepare('DELETE FROM workflows WHERE id = ?').run(id);
  return result.changes > 0;
}

export function toggleWorkflowEnabled(id: string): Workflow | undefined {
  const existing = getWorkflowById(id);
  if (!existing) return undefined;
  return updateWorkflow(id, { enabled: !existing.enabled });
}

export function incrementExecutionCount(id: string): void {
  const db = getDatabase();
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE workflows SET
      execution_count = execution_count + 1,
      last_executed_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(now, now, id);
}

export function getEnabledCronWorkflows(): Workflow[] {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM workflows WHERE enabled = 1
  `).all() as WorkflowRow[];

  return rows
    .map(rowToWorkflow)
    .filter(w => w.nodes.some(n => (n.data.nodeType as string) === 'cron'));
}
