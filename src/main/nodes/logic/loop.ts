import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('loop', async (data, input, context) => {
  const config = resolveConfig(data as any, context);
  const { mode, count } = config as any;

  let items: unknown[] = [];

  if (mode === 'array') {
    // 用原始 data.arrayVar 解析变量引用，避免 resolveConfig 把 {{var.xxx}} 解析成值
    const rawArrayVar = (data as any).arrayVar || '';
    if (rawArrayVar && typeof rawArrayVar === 'string' && rawArrayVar.startsWith('{{')) {
      const varName = rawArrayVar.replace(/\{\{|\}\}/g, '').trim();
      let arr: unknown;
      if (varName.startsWith('var.')) {
        arr = context.variables.get(varName.slice(4));
      } else {
        arr = context.nodeOutputs.get(varName);
      }
      if (Array.isArray(arr)) {
        items = arr;
      } else if (typeof arr === 'string') {
        try { items = JSON.parse(arr); } catch { items = [arr]; }
      }
    } else if (rawArrayVar) {
      // 直接输入的值（非变量引用）
      const val = config.arrayVar;
      if (Array.isArray(val)) {
        items = val;
      } else if (typeof val === 'string') {
        try { items = JSON.parse(val); } catch { items = [val]; }
      }
    } else if (Array.isArray(input)) {
      items = input;
    }
  } else if (mode === 'count') {
    const n = Number(count) || 1;
    items = Array.from({ length: n }, (_, i) => i);
  }

  return { items, mode };
});
