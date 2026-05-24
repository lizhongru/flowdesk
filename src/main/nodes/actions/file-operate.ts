import fs from 'fs-extra';
import path from 'node:path';
import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('file-operate', async (data, input, context) => {
  const config = resolveConfig(data as any, context);
  const operation = (config as any).operation || 'move';
  const sourcePath = (config as any).sourcePath || '';
  const targetPath = (config as any).targetPath || '';

  const src = sourcePath || (input as any)?.filePath;
  if (!src) throw new Error('未指定源文件路径');

  // 如果目标路径是已存在的目录，自动拼接源文件名
  let dest = targetPath;
  if (dest && await fs.pathExists(dest) && (await fs.stat(dest)).isDirectory()) {
    dest = path.join(dest, path.basename(src));
  }

  switch (operation) {
    case 'move':
      await fs.ensureDir(path.dirname(dest));
      await fs.move(src, dest, { overwrite: true });
      return { moved: src, to: dest };

    case 'copy':
      await fs.ensureDir(path.dirname(dest));
      await fs.copy(src, dest);
      return { copied: src, to: dest };

    case 'delete':
      if (!(await fs.pathExists(src))) {
        throw new Error(`文件不存在，无法删除: ${src}`);
      }
      await fs.remove(src);
      return { deleted: src };

    case 'rename':
      const dir = path.dirname(src);
      const newPath = path.join(dir, targetPath);
      if (await fs.pathExists(newPath)) {
        throw new Error(`目标名称已存在，无法重命名: ${newPath}`);
      }
      await fs.rename(src, newPath);
      return { renamed: src, to: newPath };

    default:
      throw new Error(`未知的文件操作: ${operation}`);
  }
});
