import { nodeRegistry } from '../registry';

nodeRegistry.set('file-watch', async (data, input, _context) => {
  // 文件监听触发时，input 由 watcher 提供（包含 filePath 字段）
  if (input && typeof input === 'object' && 'filePath' in input) {
    return input;
  }
  // 手动运行时，提供模拟触发数据
  const watchPath = (data.watchPath as string) || '';
  return {
    filePath: watchPath ? `${watchPath}\\test-file.jpg` : '',
    fileName: 'test-file.jpg',
    eventType: 'add',
    fileSize: 0,
  };
});
