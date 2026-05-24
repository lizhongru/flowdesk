import { describe, it, expect, vi } from 'vitest';
import { resolveVariables, resolveConfig } from '../../../src/main/engine/resolver';
import type { ExecutionContext } from '../../../shared/types';

function makeContext(overrides: Partial<ExecutionContext> = {}): ExecutionContext {
  return {
    workflowId: 'test-wf',
    executionId: 'test-exec',
    triggerData: {},
    variables: new Map(),
    nodeOutputs: new Map(),
    aborted: false,
    log: vi.fn(),
    ...overrides,
  };
}

describe('resolveVariables', () => {
  it('返回非字符串值原样返回', () => {
    const ctx = makeContext();
    expect(resolveVariables(null as any, ctx)).toBeNull();
    expect(resolveVariables(undefined as any, ctx)).toBeUndefined();
    expect(resolveVariables(123 as any, ctx)).toBe(123);
  });

  it('替换 trigger 变量', () => {
    const ctx = makeContext({ triggerData: { name: 'World', count: 42 } });
    expect(resolveVariables('Hello {{trigger.name}}', ctx)).toBe('Hello World');
    expect(resolveVariables('Count: {{trigger.count}}', ctx)).toBe('Count: 42');
  });

  it('替换节点输出变量', () => {
    const ctx = makeContext({
      nodeOutputs: new Map([
        ['node1', { status: 200, data: { items: ['a', 'b'] } }],
      ]),
    });
    expect(resolveVariables('Status: {{node1.status}}', ctx)).toBe('Status: 200');
    expect(resolveVariables('First: {{node1.data.items.0}}', ctx)).toBe('First: a');
  });

  it('替换变量管理器中的变量', () => {
    const ctx = makeContext({
      variables: new Map([['myVar', 'hello']]),
    });
    expect(resolveVariables('Value: {{var.myVar}}', ctx)).toBe('Value: hello');
  });

  it('对象值被 JSON 序列化', () => {
    const ctx = makeContext({
      nodeOutputs: new Map([['n1', { nested: { key: 'val' } }]]),
    });
    expect(resolveVariables('{{n1.nested}}', ctx)).toBe('{"key":"val"}');
  });

  it('缺失变量返回空字符串并记录警告', () => {
    const ctx = makeContext();
    expect(resolveVariables('{{missing.var}}', ctx)).toBe('');
    expect(ctx.log).toHaveBeenCalledWith('resolver', 'warn', expect.stringContaining('missing.var'));
  });

  it('处理多个变量', () => {
    const ctx = makeContext({
      triggerData: { a: '1' },
      nodeOutputs: new Map([['n1', { b: '2' }]]),
    });
    expect(resolveVariables('{{trigger.a}} and {{n1.b}}', ctx)).toBe('1 and 2');
  });

  it('无占位符时原样返回', () => {
    const ctx = makeContext();
    expect(resolveVariables('no placeholders here', ctx)).toBe('no placeholders here');
  });

  it('空字符串返回空字符串', () => {
    const ctx = makeContext();
    expect(resolveVariables('', ctx)).toBe('');
  });
});

describe('resolveConfig', () => {
  it('解析字符串字段中的变量', () => {
    const ctx = makeContext({ triggerData: { name: 'test' } });
    const config = { title: 'Hello {{trigger.name}}', count: 42 };
    const result = resolveConfig(config, ctx);
    expect(result.title).toBe('Hello test');
    expect(result.count).toBe(42);
  });

  it('解析数组中的字符串元素', () => {
    const ctx = makeContext({ triggerData: { x: '10' } });
    const config = { items: ['{{trigger.x}}', 'static', 123] };
    const result = resolveConfig(config, ctx);
    expect(result.items).toEqual(['10', 'static', 123]);
  });

  it('不修改原对象', () => {
    const ctx = makeContext({ triggerData: { v: 'new' } });
    const config = { key: '{{trigger.v}}' };
    const result = resolveConfig(config, ctx);
    expect(config.key).toBe('{{trigger.v}}');
    expect(result.key).toBe('new');
  });
});
