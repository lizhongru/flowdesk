import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('variable', async (data, input, context) => {
  const config = resolveConfig(data as any, context);
  const { name, value } = config as any;

  if (name) {
    context.variables.set(name, value);
  }

  return value ?? input;
});
