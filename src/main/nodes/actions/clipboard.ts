import { clipboard } from 'electron';
import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('clipboard', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { operation, content } = config as any;

  if (operation === 'read') {
    const text = clipboard.readText();
    return { text };
  }

  if (operation === 'write') {
    clipboard.writeText(content || '');
    return { written: content || '' };
  }

  throw new Error(`未知的剪贴板操作: ${operation}`);
});
