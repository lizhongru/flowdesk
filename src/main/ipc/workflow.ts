import { ipcMain, globalShortcut } from 'electron';
import {
  getAllWorkflows,
  getWorkflowById,
  createWorkflow,
  updateWorkflow,
  deleteWorkflow,
  toggleWorkflowEnabled,
  isWorkflowNameTaken,
} from '../db/workflow-repo';
import { registerCronTask, unregisterCronTask } from '../engine/scheduler';
import { registerFileWatcher, unregisterFileWatcher } from '../engine/watcher';
import { executeWorkflow } from '../engine/executor';
import { saveExecutionLog } from '../db/execution-log-repo';
import { getTemplates, getTemplateById } from '../db/templates';
import { getMainWindow } from '../index';
import { refreshTrayMenu } from '../tray';
import type { Workflow } from '../../../shared/types';

function getHotkeyAccelerator(workflow: Workflow): string | null {
  const hotkeyNode = workflow.nodes.find(n => (n.data.nodeType as string) === 'hotkey');
  if (!hotkeyNode) return null;
  const accelerator = (hotkeyNode.data.accelerator as string || '').trim();
  if (accelerator && accelerator.includes('+') && !accelerator.endsWith('+')) {
    return accelerator;
  }
  return null;
}

function registerTriggers(workflow: Workflow): void {
  if (!workflow.enabled) return;

  if (workflow.nodes.some(n => (n.data.nodeType as string) === 'cron')) {
    registerCronTask(workflow);
  }
  if (workflow.nodes.some(n => (n.data.nodeType as string) === 'file-watch')) {
    registerFileWatcher(workflow);
  }

  const accelerator = getHotkeyAccelerator(workflow);
  if (accelerator) {
    if (globalShortcut.isRegistered(accelerator)) {
      console.warn(`[Hotkey] 快捷键冲突: ${accelerator} 已被注册，跳过「${workflow.name}」`);
      return;
    }
    try {
      globalShortcut.register(accelerator, async () => {
        console.log(`[Hotkey] 触发工作流: ${workflow.name}`);
        try {
          const win = getMainWindow();
          if (win) {
            const log = await executeWorkflow(workflow, { triggeredAt: new Date().toISOString() }, win, 'hotkey');
            saveExecutionLog(log);
          }
        } catch (err) {
          console.error(`[Hotkey] 执行失败: ${workflow.name}`, err);
        }
      });
      console.log(`[Hotkey] 注册成功: ${accelerator} → ${workflow.name}`);
    } catch (err) {
      console.error(`[Hotkey] 注册失败: ${accelerator}`, err);
    }
  }
}

function unregisterTriggers(workflow: Workflow): void {
  unregisterCronTask(workflow.id);
  unregisterFileWatcher(workflow.id);

  const accelerator = getHotkeyAccelerator(workflow);
  if (accelerator && globalShortcut.isRegistered(accelerator)) {
    globalShortcut.unregister(accelerator);
    console.log(`[Hotkey] 已注销: ${accelerator}`);
  }
}

function checkHotkeyConflict(workflowId: string): string | null {
  const workflow = getWorkflowById(workflowId);
  if (!workflow) return null;
  const accelerator = getHotkeyAccelerator(workflow);
  if (!accelerator) return null;

  const allWorkflows = getAllWorkflows();
  for (const other of allWorkflows) {
    if (other.id === workflowId || !other.enabled) continue;
    const otherAcc = getHotkeyAccelerator(other);
    if (otherAcc && otherAcc === accelerator) {
      return other.name;
    }
  }
  return null;
}

export function registerWorkflowIPC(): void {
  ipcMain.handle('workflow:list', () => {
    return getAllWorkflows();
  });

  ipcMain.handle('workflow:get', (_event, id: string) => {
    const workflow = getWorkflowById(id);
    if (!workflow) throw new Error(`工作流不存在: ${id}`);
    return workflow;
  });

  ipcMain.handle('workflow:create', (_event, data: Partial<Workflow>) => {
    if (data.name && isWorkflowNameTaken(data.name)) {
      throw new Error(`名称「${data.name}」已被其他工作流使用`);
    }
    const wf = createWorkflow(data);
    refreshTrayMenu(getMainWindow);
    return wf;
  });

  ipcMain.handle('workflow:update', (_event, id: string, data: Partial<Workflow>) => {
    if (data.name && isWorkflowNameTaken(data.name, id)) {
      throw new Error(`名称「${data.name}」已被其他工作流使用`);
    }
    const old = getWorkflowById(id);
    const updated = updateWorkflow(id, data);
    if (!updated) throw new Error(`工作流不存在: ${id}`);

    // 如果节点发生变化，重新注册触发器
    if (data.nodes || data.edges) {
      if (old) unregisterTriggers(old);
      registerTriggers(updated);
    }

    refreshTrayMenu(getMainWindow);
    return updated;
  });

  ipcMain.handle('workflow:delete', (_event, id: string) => {
    const workflow = getWorkflowById(id);
    if (workflow) unregisterTriggers(workflow);
    const ok = deleteWorkflow(id);
    if (!ok) throw new Error(`工作流不存在: ${id}`);
    refreshTrayMenu(getMainWindow);
  });

  ipcMain.handle('workflow:toggle', (_event, id: string) => {
    const old = getWorkflowById(id);
    const updated = toggleWorkflowEnabled(id);
    if (!updated) throw new Error(`工作流不存在: ${id}`);

    // 启用时注册触发器，禁用时注销
    if (updated.enabled) {
      registerTriggers(updated);
    } else {
      // 先用旧的工作流数据注销（它还是 enabled 的）
      if (old) unregisterTriggers(old);
    }

    refreshTrayMenu(getMainWindow);
    return updated;
  });

  ipcMain.handle('workflow:check-hotkey-conflict', (_event, id: string) => {
    return checkHotkeyConflict(id);
  });

  ipcMain.handle('workflow:templates', () => {
    return getTemplates();
  });

  ipcMain.handle('workflow:create-from-template', (_event, templateId: string) => {
    const template = getTemplateById(templateId);
    if (!template) throw new Error(`模板不存在: ${templateId}`);
    const wf = createWorkflow({
      name: template.name,
      description: template.description,
      category: template.category,
      nodes: template.nodes,
      edges: template.edges,
    });
    refreshTrayMenu(getMainWindow);
    return wf;
  });
}
