import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('condition', async (data, input, context) => {
  const config = resolveConfig(data as any, context);
  const { operator, value } = config as any;

  // 用原始 data.field 解析，避免 resolveConfig 把未找到的变量变成空字符串
  const rawField = (data as any).field || '';
  let fieldValue: unknown;
  if (rawField && typeof rawField === 'string' && rawField.startsWith('{{')) {
    const varName = rawField.replace(/\{\{|\}\}/g, '').trim();
    if (varName === 'trigger') {
      fieldValue = context.triggerData;
    } else if (varName.startsWith('var.')) {
      fieldValue = context.variables.get(varName.slice(4));
    } else {
      fieldValue = context.nodeOutputs.get(varName);
    }
  } else {
    fieldValue = config.field;
  }

  let passed = false;

  switch (operator) {
    case 'eq':
      passed = String(fieldValue) === String(value);
      break;
    case 'neq':
      passed = String(fieldValue) !== String(value);
      break;
    case 'gt':
      passed = Number(fieldValue) > Number(value);
      break;
    case 'lt':
      passed = Number(fieldValue) < Number(value);
      break;
    case 'gte':
      passed = Number(fieldValue) >= Number(value);
      break;
    case 'lte':
      passed = Number(fieldValue) <= Number(value);
      break;
    case 'contains':
      passed = String(value).includes(String(fieldValue));
      break;
    case 'matches':
      passed = new RegExp(String(value)).test(String(fieldValue));
      break;
    case 'exists':
      passed = fieldValue !== undefined && fieldValue !== null;
      break;
    default:
      passed = false;
  }

  return { passed, ...(typeof input === 'object' ? input : {}) };
});
