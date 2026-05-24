import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import Database from 'better-sqlite3';
import { setDatabase } from '../../../src/main/db/index';
import { migrate } from '../../../src/main/db/migrations';
import {
  createWorkflow,
  getWorkflowById,
  getAllWorkflows,
  updateWorkflow,
  deleteWorkflow,
  isWorkflowNameTaken,
  incrementExecutionCount,
} from '../../../src/main/db/workflow-repo';

describe('workflow-repo', () => {
  beforeAll(() => {
    const db = new Database(':memory:');
    migrate(db);
    setDatabase(db);
  });

  it('createWorkflow 创建并返回工作流', () => {
    const wf = createWorkflow({ name: '测试工作流', description: '描述' });
    expect(wf.id).toBeTruthy();
    expect(wf.name).toBe('测试工作流');
    expect(wf.description).toBe('描述');
    expect(wf.nodes).toEqual([]);
    expect(wf.edges).toEqual([]);
  });

  it('getWorkflowById 返回指定工作流', () => {
    const created = createWorkflow({ name: '查询测试' });
    const found = getWorkflowById(created.id);
    expect(found).toBeDefined();
    expect(found!.id).toBe(created.id);
    expect(found!.name).toBe('查询测试');
  });

  it('getWorkflowById 不存在时返回 undefined', () => {
    expect(getWorkflowById('nonexistent')).toBeUndefined();
  });

  it('getAllWorkflows 返回所有工作流', () => {
    const all = getAllWorkflows();
    expect(all.length).toBeGreaterThanOrEqual(2);
  });

  it('updateWorkflow 更新工作流字段', () => {
    const wf = createWorkflow({ name: '更新前' });
    const updated = updateWorkflow(wf.id, { name: '更新后', description: '新描述' });
    expect(updated).toBeDefined();
    expect(updated!.name).toBe('更新后');
    expect(updated!.description).toBe('新描述');

    const refetched = getWorkflowById(wf.id);
    expect(refetched!.name).toBe('更新后');
  });

  it('deleteWorkflow 删除工作流', () => {
    const wf = createWorkflow({ name: '待删除' });
    expect(deleteWorkflow(wf.id)).toBe(true);
    expect(getWorkflowById(wf.id)).toBeUndefined();
  });

  it('deleteWorkflow 不存在时返回 false', () => {
    expect(deleteWorkflow('nonexistent')).toBe(false);
  });

  it('isWorkflowNameTaken 检测名称冲突', () => {
    createWorkflow({ name: '唯一名称' });
    expect(isWorkflowNameTaken('唯一名称')).toBe(true);
    expect(isWorkflowNameTaken('不存在的名称')).toBe(false);
  });

  it('isWorkflowNameTaken 排除指定 ID', () => {
    const wf = createWorkflow({ name: '排除测试' });
    expect(isWorkflowNameTaken('排除测试', wf.id)).toBe(false);
    expect(isWorkflowNameTaken('排除测试', 'other-id')).toBe(true);
  });

  it('incrementExecutionCount 增加执行次数', () => {
    const wf = createWorkflow({ name: '计数测试' });
    expect(wf.executionCount).toBe(0);

    incrementExecutionCount(wf.id);
    const updated = getWorkflowById(wf.id);
    expect(updated!.executionCount).toBe(1);

    incrementExecutionCount(wf.id);
    const updated2 = getWorkflowById(wf.id);
    expect(updated2!.executionCount).toBe(2);
  });
});
