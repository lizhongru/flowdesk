import { nodeRegistry } from '../registry';
import { getWorkflowById } from '../../db/workflow-repo';
import { executeWorkflow } from '../../engine/executor';

nodeRegistry.set('call-workflow', async (data, input, context) => {
  const workflowId = (data as any).workflowId as string;
  if (!workflowId) throw new Error('未指定目标工作流');

  // 防止递归调用
  if (context.callStack?.includes(workflowId)) {
    throw new Error(`检测到循环调用: ${context.callStack.join(' → ')} → ${workflowId}`);
  }

  const workflow = getWorkflowById(workflowId);
  if (!workflow) throw new Error(`工作流不存在: ${workflowId}`);

  // 获取主窗口（通过全局引用）
  const { BrowserWindow } = require('electron');
  const win = BrowserWindow.getAllWindows()[0];
  if (!win) throw new Error('主窗口不存在');

  const childLog = await executeWorkflow(
    workflow,
    input || {},
    win,
    'sub-workflow',
    context.callStack
  );

  return {
    result: childLog.nodeLogs,
    status: childLog.status,
    ...(typeof input === 'object' ? input : {}),
  };
});
