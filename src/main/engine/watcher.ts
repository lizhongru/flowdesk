import chokidar, { type FSWatcher } from 'chokidar';
import path from 'node:path';
import { getMainWindow } from '../index';
import { getDatabase } from '../db';
import { getWorkflowById } from '../db/workflow-repo';
import { executeWorkflow } from './executor';
import { saveExecutionLog } from '../db/execution-log-repo';
import type { Workflow } from '../../../shared/types';

const watchers = new Map<string, FSWatcher>();

export async function restoreWatchers(): Promise<void> {
  // 从数据库中获取所有启用的 file-watch 工作流
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT * FROM workflows WHERE enabled = 1
  `).all() as any[];

  for (const row of rows) {
    const workflow: Workflow = {
      id: row.id,
      name: row.name,
      description: row.description,
      nodes: JSON.parse(row.nodes),
      edges: JSON.parse(row.edges),
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      executionCount: row.execution_count,
      lastExecutedAt: row.last_executed_at,
    };

    if (workflow.nodes.some(n => (n.data.nodeType as string) === 'file-watch')) {
      registerFileWatcher(workflow);
    }
  }

  console.log(`[Watcher] 恢复了 ${watchers.size} 个文件监听`);
}

export function registerFileWatcher(workflow: Workflow): void {
  unregisterFileWatcher(workflow.id);

  const watchNode = workflow.nodes.find(n => (n.data.nodeType as string) === 'file-watch');
  if (!watchNode) return;

  const watchPath = watchNode.data.watchPath as string;
  if (!watchPath) return;

  const patterns = (watchNode.data.patterns as string || '').split(',').map(p => p.trim()).filter(Boolean);
  const events = (watchNode.data.events as string || 'add').split(',').map(e => e.trim());

  const watcher = chokidar.watch(watchPath, {
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 500 },
  });

  watcher.on('error', (err) => {
    console.error(`[Watcher] 监听 "${watchPath}" 出错 (${workflow.name}):`, err);
  });

  const handleEvent = async (eventType: string, filePath: string) => {
    // 如果有匹配模式，检查文件是否匹配
    if (patterns.length > 0) {
      const ext = path.extname(filePath).toLowerCase();
      const matches = patterns.some(p => {
        if (p.startsWith('*.')) {
          return ext === p.slice(1).toLowerCase();
        }
        return filePath.includes(p);
      });
      if (!matches) return;
    }

    console.log(`[Watcher] ${eventType}: ${filePath} (${workflow.name})`);
    try {
      // 从数据库重新加载最新工作流，确保 edges 是最新的
      const latestWorkflow = getWorkflowById(workflow.id);
      if (!latestWorkflow) {
        console.warn(`[Watcher] 工作流已不存在: "${workflow.name}"`);
        return;
      }
      console.log(`[Watcher] 节点数: ${latestWorkflow.nodes.length}, 连线数: ${latestWorkflow.edges.length}`);

      const win = getMainWindow();
      if (win) {
        const log = await executeWorkflow(latestWorkflow, {
          filePath,
          fileName: path.basename(filePath),
          eventType,
          fileSize: 0,
        }, win, 'file-watch');
        saveExecutionLog(log);
        console.log(`[Watcher] 执行完成: ${log.status}`);
        for (const nl of log.nodeLogs) {
          console.log(`  [${nl.status}] ${nl.nodeType} (${nl.nodeId})${nl.error ? ` - ${nl.error}` : ''}`);
        }
      } else {
        console.warn(`[Watcher] 主窗口不可用，跳过执行: "${workflow.name}"`);
      }
    } catch (err) {
      console.error(`[Watcher] 工作流 "${workflow.name}" 执行失败:`, err);
    }
  };

  for (const evt of events) {
    if (evt === 'add') {
      watcher.on('add', (filePath) => handleEvent('add', filePath));
    } else if (evt === 'change') {
      watcher.on('change', (filePath) => handleEvent('change', filePath));
    } else if (evt === 'delete') {
      watcher.on('unlink', (filePath) => handleEvent('delete', filePath));
    }
  }

  watchers.set(workflow.id, watcher);
  console.log(`[Watcher] 已注册: "${workflow.name}" → ${watchPath}`);
}

export function unregisterFileWatcher(workflowId: string): void {
  const watcher = watchers.get(workflowId);
  if (watcher) {
    watcher.close();
    watchers.delete(workflowId);
  }
}

export function destroyAllWatchers(): void {
  for (const [, watcher] of watchers) {
    watcher.close();
  }
  watchers.clear();
}
