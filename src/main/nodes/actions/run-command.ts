import { exec } from 'node:child_process';
import { nodeRegistry } from '../registry';
import { resolveConfig } from '../../engine/resolver';

nodeRegistry.set('run-command', async (data, _input, context) => {
  const config = resolveConfig(data as any, context);
  const { command, workingDir, timeout } = config as any;

  if (!command) throw new Error('未指定命令');

  return new Promise((resolve, reject) => {
    const child = exec(command, {
      cwd: workingDir || process.cwd(),
      timeout: (timeout || 30) * 1000,
      windowsHide: true,
    }, (error, stdout, stderr) => {
      if (error && error.killed) {
        reject(new Error(`命令超时: ${command}`));
        return;
      }
      const exitCode = error?.code ?? 0;
      const MAX = 512 * 1024; // 512KB
      const truncate = (s: string) => s.length > MAX ? s.slice(0, MAX) + '\n... [输出已截断]' : s;
      const result = {
        stdout: truncate(stdout?.toString() || ''),
        stderr: truncate(stderr?.toString() || ''),
        exitCode,
      };
      if (exitCode !== 0) {
        reject(new Error(`命令执行失败 (exitCode: ${exitCode}): ${stderr?.toString().trim() || command}`));
        return;
      }
      resolve(result);
    });
  });
});
