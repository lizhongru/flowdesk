import { describe, it, expect, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { setDatabase } from '../../../src/main/db/index';
import { migrate } from '../../../src/main/db/migrations';
import { createWorkflow } from '../../../src/main/db/workflow-repo';
import {
  saveExecutionLog,
  getExecutionLogs,
  getExecutionLogById,
  getAllExecutionHistory,
} from '../../../src/main/db/execution-log-repo';
import type { ExecutionLog } from '../../../shared/types';

function makeLog(overrides: Partial<ExecutionLog> = {}): ExecutionLog {
  return {
    id: `exec-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    workflowId: 'test-wf',
    status: 'success',
    triggerType: 'manual',
    startedAt: new Date().toISOString(),
    finishedAt: null,
    nodeLogs: [],
    ...overrides,
  };
}

describe('execution-log-repo', () => {
  let wfId: string;

  beforeAll(() => {
    const db = new Database(':memory:');
    migrate(db);
    setDatabase(db);

    const wf = createWorkflow({ name: '测试工作流' });
    wfId = wf.id;
  });

  it('saveExecutionLog 插入执行日志', () => {
    const log = makeLog({ workflowId: wfId });
    saveExecutionLog(log);

    const found = getExecutionLogById(log.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(log.id);
    expect(found!.workflowId).toBe(wfId);
    expect(found!.status).toBe('success');
  });

  it('getExecutionLogs 返回指定工作流的日志', () => {
    const log1 = makeLog({ workflowId: wfId, startedAt: '2026-01-01T00:00:00Z' });
    const log2 = makeLog({ workflowId: wfId, startedAt: '2026-01-02T00:00:00Z' });
    saveExecutionLog(log1);
    saveExecutionLog(log2);

    const logs = getExecutionLogs(wfId);
    expect(logs.length).toBeGreaterThanOrEqual(2);
    // 按 started_at DESC 排序
    expect(new Date(logs[0].startedAt).getTime()).toBeGreaterThanOrEqual(new Date(logs[1].startedAt).getTime());
  });

  it('getExecutionLogs 支持 limit', () => {
    const logs = getExecutionLogs(wfId, 1);
    expect(logs).toHaveLength(1);
  });

  it('getExecutionLogById 返回指定日志', () => {
    const log = makeLog({ workflowId: wfId, status: 'failed' });
    saveExecutionLog(log);

    const found = getExecutionLogById(log.id);
    expect(found).toBeDefined();
    expect(found!.status).toBe('failed');
  });

  it('getExecutionLogById 不存在时返回 undefined', () => {
    expect(getExecutionLogById('nonexistent')).toBeUndefined();
  });

  describe('getAllExecutionHistory', () => {
    it('返回所有执行历史', () => {
      const result = getAllExecutionHistory();
      expect(result.items.length).toBeGreaterThan(0);
      expect(result.total).toBeGreaterThan(0);
    });

    it('包含工作流名称', () => {
      const result = getAllExecutionHistory({ limit: 1 });
      expect(result.items[0].workflowName).toBe('测试工作流');
    });

    it('支持状态筛选', () => {
      const result = getAllExecutionHistory({ status: 'failed' });
      for (const item of result.items) {
        expect(item.status).toBe('failed');
      }
    });

    it('支持分页', () => {
      const page1 = getAllExecutionHistory({ limit: 2, offset: 0 });
      const page2 = getAllExecutionHistory({ limit: 2, offset: 2 });
      if (page1.total > 2) {
        expect(page1.items[0].id).not.toBe(page2.items[0]?.id);
      }
    });

    it('计算 duration', () => {
      const now = new Date();
      const log = makeLog({
        workflowId: wfId,
        startedAt: now.toISOString(),
        finishedAt: new Date(now.getTime() + 5000).toISOString(),
      });
      saveExecutionLog(log);

      const result = getAllExecutionHistory({ status: 'success', limit: 1 });
      const found = result.items.find(i => i.id === log.id);
      expect(found).toBeDefined();
      expect(found!.duration).toBe(5000);
    });
  });
});
