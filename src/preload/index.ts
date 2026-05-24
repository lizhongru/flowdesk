import { contextBridge, ipcRenderer } from 'electron';
import type {
  Workflow, ExecutionLog, ExecutionEvent, ExecutionHistoryEntry, WorkflowTemplate
} from '../../shared/types';

const api = {
  // ---- 工作流 CRUD ----
  workflow: {
    list: (): Promise<Workflow[]> =>
      ipcRenderer.invoke('workflow:list'),
    get: (id: string): Promise<Workflow> =>
      ipcRenderer.invoke('workflow:get', id),
    create: (data: Partial<Workflow>): Promise<Workflow> =>
      ipcRenderer.invoke('workflow:create', data),
    update: (id: string, data: Partial<Workflow>): Promise<Workflow> =>
      ipcRenderer.invoke('workflow:update', id, data),
    delete: (id: string): Promise<void> =>
      ipcRenderer.invoke('workflow:delete', id),
    toggleEnabled: (id: string): Promise<Workflow> =>
      ipcRenderer.invoke('workflow:toggle', id),
    checkHotkeyConflict: (id: string): Promise<string | null> =>
      ipcRenderer.invoke('workflow:check-hotkey-conflict', id),
    getTemplates: (): Promise<WorkflowTemplate[]> =>
      ipcRenderer.invoke('workflow:templates'),
    createFromTemplate: (templateId: string): Promise<Workflow> =>
      ipcRenderer.invoke('workflow:create-from-template', templateId),
  },

  // ---- 执行 ----
  execution: {
    run: (workflowId: string, triggerData?: unknown): Promise<ExecutionLog> =>
      ipcRenderer.invoke('execution:run', workflowId, triggerData),
    cancel: (executionId: string): Promise<void> =>
      ipcRenderer.invoke('execution:cancel', executionId),
    getLogs: (workflowId: string, limit?: number): Promise<ExecutionLog[]> =>
      ipcRenderer.invoke('execution:logs', workflowId, limit),
    getHistory: (options?: { status?: string; offset?: number; limit?: number }): Promise<{ items: ExecutionHistoryEntry[]; total: number }> =>
      ipcRenderer.invoke('execution:history', options),
    getLogDetail: (executionId: string): Promise<ExecutionLog | undefined> =>
      ipcRenderer.invoke('execution:log-detail', executionId),
  },

  // ---- 文件系统 ----
  file: {
    showOpenDialog: (options: Electron.OpenDialogOptions): Promise<string | string[] | null> =>
      ipcRenderer.invoke('file:open-dialog', options),
    showSaveDialog: (options: Electron.SaveDialogOptions): Promise<string | null> =>
      ipcRenderer.invoke('file:save-dialog', options),
    readJson: (filePath: string): Promise<unknown> =>
      ipcRenderer.invoke('file:read-json', filePath),
    writeJson: (filePath: string, data: unknown): Promise<void> =>
      ipcRenderer.invoke('file:write-json', filePath, data),
    openPath: (filePath: string): Promise<void> =>
      ipcRenderer.invoke('file:open-path', filePath),
  },

  // ---- 实时事件监听（主进程 → 渲染进程，批量） ----
  onExecutionEvents: (callback: (events: ExecutionEvent[]) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, events: ExecutionEvent[]) => {
      callback(events);
    };
    ipcRenderer.on('execution:events-batch', handler);
    return () => ipcRenderer.removeListener('execution:events-batch', handler);
  },

  // ---- 窗口控制 ----
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: (): Promise<boolean> => ipcRenderer.invoke('window:is-maximized'),
    toggleDevtools: () => ipcRenderer.invoke('window:toggle-devtools'),
  },
};

contextBridge.exposeInMainWorld('api', api);

// 导出类型供渲染进程使用
export type FlowDeskAPI = typeof api;
