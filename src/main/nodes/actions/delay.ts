import { nodeRegistry } from '../registry';

nodeRegistry.set('delay', async (data, input, _context) => {
  const duration = data.duration != null ? (data.duration as number) : 1000;
  await new Promise(resolve => setTimeout(resolve, duration));
  return input; // 透传输入
});
