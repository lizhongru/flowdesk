import { nodeRegistry } from '../registry';

nodeRegistry.set('manual', async (_data, _input, _context) => {
  return { triggeredAt: new Date().toISOString() };
});
