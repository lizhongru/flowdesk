import { nodeRegistry } from '../registry';
import { resolveConfig, resolveVariables } from '../../engine/resolver';

nodeRegistry.set('transform', async (data, input, context) => {
  const config = resolveConfig(data as any, context);
  const { operation, path, pattern, replacement, separator, template } = config as any;

  const inputStr = typeof input === 'string' ? input : JSON.stringify(input);

  switch (operation) {
    case 'json-extract': {
      if (!path) throw new Error('未指定 JSON 路径');
      let obj = input;
      if (typeof input === 'string') {
        try { obj = JSON.parse(input); } catch { throw new Error('输入不是有效的 JSON'); }
      } else if (typeof input !== 'object' || input === null) {
        throw new Error('输入必须是 JSON 对象或字符串');
      }
      const parts = path.split('.');
      let current: unknown = obj;
      for (const part of parts) {
        if (current == null || typeof current !== 'object') {
          return { result: undefined, type: 'undefined' };
        }
        if (Array.isArray(current)) {
          const idx = parseInt(part, 10);
          if (isNaN(idx)) throw new Error(`数组索引无效: ${part}`);
          current = (current as unknown[])[idx];
        } else {
          current = (current as Record<string, unknown>)[part];
        }
      }
      return { result: current, type: typeof current };
    }

    case 'regex-match': {
      if (!pattern) throw new Error('未指定正则表达式');
      const regex = new RegExp(pattern);
      const match = regex.exec(inputStr);
      if (!match) return { result: null, type: 'null' };
      if (replacement) {
        const result = inputStr.replace(regex, replacement);
        return { result, type: 'string' };
      }
      return { result: match.length > 1 ? match.slice(1) : match[0], type: match.length > 1 ? 'array' : 'string' };
    }

    case 'string-replace': {
      if (!pattern) throw new Error('未指定查找文本');
      const result = inputStr.replaceAll(pattern, replacement || '');
      return { result, type: 'string' };
    }

    case 'string-split': {
      const sep = separator || ',';
      const result = inputStr.split(sep);
      return { result, type: 'array' };
    }

    case 'string-join': {
      if (!Array.isArray(input)) throw new Error('输入必须是数组');
      const sep = separator || ',';
      const result = input.join(sep);
      return { result, type: 'string' };
    }

    case 'to-json': {
      try {
        const result = JSON.parse(inputStr);
        return { result, type: typeof result };
      } catch {
        throw new Error('无法解析为 JSON');
      }
    }

    case 'to-string': {
      if (typeof input === 'object') {
        return { result: JSON.stringify(input, null, 2), type: 'string' };
      }
      return { result: String(input), type: 'string' };
    }

    case 'template': {
      if (!template) throw new Error('未指定模板');
      const result = resolveVariables(template, context);
      return { result, type: 'string' };
    }

    default:
      throw new Error(`未知的转换操作: ${operation}`);
  }
});
