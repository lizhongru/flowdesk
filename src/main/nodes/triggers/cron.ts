import { nodeRegistry } from '../registry';

nodeRegistry.set('cron', async (data, _input, _context) => {
  return {
    triggeredAt: new Date().toISOString(),
    cronExpression: data.cronExpression || '',
  };
});
