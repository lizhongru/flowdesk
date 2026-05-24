import type { ExecutionContext } from '../../../shared/types';

export function resolveVariables(
  template: string,
  context: ExecutionContext
): string {
  if (!template || typeof template !== 'string') return template;

  return template.replace(/\{\{(.+?)\}\}/g, (_match, path: string) => {
    const trimmedPath = path.trim();
    const value = resolvePath(trimmedPath, context);

    if (value === undefined || value === null) {
      context.log('resolver', 'warn', `变量 {{${trimmedPath}}} 未找到`);
      return '';
    }

    if (typeof value === 'object') {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

function resolvePath(path: string, context: ExecutionContext): unknown {
  const parts = path.split('.');
  const root = parts[0];

  let current: unknown;

  if (root === 'trigger') {
    current = context.triggerData;
  } else if (root === 'var' || root === '__loop_item' || root === '__loop_index' || root === '__loop_total') {
    current = context.variables.get(root === 'var' ? parts.slice(1).join('.') : root);
    if (root === 'var') return current;
  } else {
    current = context.nodeOutputs.get(root);
  }

  for (let i = 1; i < parts.length; i++) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[parts[i]];
  }

  return current;
}

export function resolveConfig<T extends Record<string, unknown>>(
  config: T,
  context: ExecutionContext
): T {
  const resolved = { ...config };
  for (const key of Object.keys(resolved)) {
    const value = resolved[key];
    if (typeof value === 'string') {
      (resolved as any)[key] = resolveVariables(value, context);
    } else if (Array.isArray(value)) {
      (resolved as any)[key] = value.map(item =>
        typeof item === 'string' ? resolveVariables(item, context) : item
      );
    }
  }
  return resolved;
}
