import { ipcMain, BrowserWindow, Notification } from 'electron';
import { getWorkflowById, incrementExecutionCount } from '../db/workflow-repo';
import { executeWorkflow, cancelExecution } from '../engine/executor';
import { saveExecutionLog, getExecutionLogs, getAllExecutionHistory, getExecutionLogById } from '../db/execution-log-repo';
import '../nodes/index'; // 触发所有节点注册

// 延迟获取主窗口，避免循环依赖
let _getMainWindow: (() => BrowserWindow | null) | null = null;

export function setMainWindowGetter(getter: () => BrowserWindow | null): void {
  _getMainWindow = getter;
}

export function registerExecutionIPC(): void {
  ipcMain.handle('execution:run', async (_event, workflowId: string, triggerData?: unknown) => {
    const workflow = getWorkflowById(workflowId);
    if (!workflow) throw new Error(`工作流不存在: ${workflowId}`);

    if (!_getMainWindow) throw new Error('主窗口未初始化');
    const win = _getMainWindow();
    if (!win) throw new Error('主窗口不存在');

    const log = await executeWorkflow(workflow, triggerData || {}, win);
    saveExecutionLog(log);
    incrementExecutionCount(workflowId);

    // 完成自动通知
    if (workflow.notifyOnComplete && Notification.isSupported()) {
      const statusText = log.status === 'success' ? '执行完成' : log.status === 'failed' ? '执行失败' : '已取消';
      const title = `工作流${statusText}`;
      const body = workflow.name;
      const notification = new Notification({ title, body });
      notification.show();
    }

    return log;
  });

  ipcMain.handle('execution:cancel', (_event, executionId: string) => {
    cancelExecution(executionId);
  });

  ipcMain.handle('execution:logs', (_event, workflowId: string, limit?: number) => {
    return getExecutionLogs(workflowId, limit);
  });

  ipcMain.handle('execution:history', (_event, options?: { status?: string; offset?: number; limit?: number }) => {
    return getAllExecutionHistory(options);
  });

  ipcMain.handle('execution:log-detail', (_event, executionId: string) => {
    return getExecutionLogById(executionId);
  });
}
