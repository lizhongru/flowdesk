import { nodeRegistry } from '../registry';

// try-catch 节点本身只是透传输入，错误分支路由由 executor 处理
nodeRegistry.set('try-catch', async (_data, input) => {
  return input;
});
