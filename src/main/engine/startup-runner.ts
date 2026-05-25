import { getMainWindow } from '../index';
import { getEnabledStartupWorkflows } from '../db/workflow-repo';
import { executeWorkflow } from './executor';
import { saveExecutionLog } from '../db/execution-log-repo';

export async function restoreStartupWorkflows(): Promise<void> {
  const workflows = getEnabledStartupWorkflows();

  if (workflows.length === 0) {
    console.log('[Startup] 无启动工作流');
    return;
  }

  console.log(`[Startup] 发现 ${workflows.length} 个启动工作流`);

  for (const workflow of workflows) {
    const win = getMainWindow();
    if (!win) break;

    console.log(`[Startup] 执行工作流: ${workflow.name}`);
    try {
      const log = await executeWorkflow(
        workflow,
        { triggeredAt: new Date().toISOString() },
        win,
        'startup'
      );
      saveExecutionLog(log);
    } catch (err) {
      console.error(`[Startup] 工作流 "${workflow.name}" 执行失败:`, err);
    }
  }
}
