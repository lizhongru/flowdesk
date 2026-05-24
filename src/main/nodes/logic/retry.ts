import { nodeRegistry } from '../registry';

// retry 节点本身只是透传输入，重试路由由 executor 处理
nodeRegistry.set('retry', async (_data, input) => {
  return input;
});
