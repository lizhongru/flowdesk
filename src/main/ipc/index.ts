import { registerWorkflowIPC } from './workflow';
import { registerExecutionIPC } from './execution';
import { registerFileSystemIPC } from './file-system';

export function registerAllIPC(): void {
  registerWorkflowIPC();
  registerExecutionIPC();
  registerFileSystemIPC();
}
