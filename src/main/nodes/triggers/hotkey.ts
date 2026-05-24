import { nodeRegistry } from '../registry';

nodeRegistry.set('hotkey', async (_data, _input, _context) => {
  return { triggeredAt: new Date().toISOString() };
});
