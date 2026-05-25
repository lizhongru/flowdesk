import { nodeRegistry } from '../registry';

nodeRegistry.set('startup', async (_data, _input, _context) => {
  return { triggeredAt: new Date().toISOString() };
});
