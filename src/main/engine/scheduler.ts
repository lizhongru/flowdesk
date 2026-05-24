import cron from 'node-cron';
import { getMainWindow } from '../index';
import { getEnabledCronWorkflows } from '../db/workflow-repo';
import { executeWorkflow } from './executor';
import { saveExecutionLog } from '../db/execution-log-repo';
import type { Workflow } from '../../../shared/types';

const scheduledTasks = new Map<string, cron.ScheduledTask>();

export async function restoreSchedulers(): Promise<void> {
  const workflows = getEnabledCronWorkflows();

  for (const workflow of workflows) {
    registerCronTask(workflow);
  }

  console.log(`[Scheduler] 恢复了 ${scheduledTasks.size} 个定时任务`);
}

export function registerCronTask(workflow: Workflow): void {
  unregisterCronTask(workflow.id);

  const cronNode = workflow.nodes.find(n => (n.data.nodeType as string) === 'cron');
  if (!cronNode) return;

  const cronExpression = cronNode.data.cronExpression as string;
  if (!cron.validate(cronExpression)) {
    console.error(`[Scheduler] 工作流 "${workflow.name}" 的 cron 表达式无效: ${cronExpression}`);
    return;
  }

  const task = cron.schedule(cronExpression, async () => {
    console.log(`[Scheduler] 触发工作流: ${workflow.name}`);
    try {
      const win = getMainWindow();
      if (win) {
        const log = await executeWorkflow(workflow, { triggeredAt: new Date().toISOString() }, win, 'cron');
        saveExecutionLog(log);
      }
    } catch (err) {
      console.error(`[Scheduler] 工作流 "${workflow.name}" 执行失败:`, err);
    }
  }, {
    timezone: (cronNode.data.timezone as string) || undefined,
  });

  scheduledTasks.set(workflow.id, task);
  console.log(`[Scheduler] 已注册: "${workflow.name}" → ${cronExpression}`);
}

export function unregisterCronTask(workflowId: string): void {
  const task = scheduledTasks.get(workflowId);
  if (task) {
    task.stop();
    scheduledTasks.delete(workflowId);
  }
}

export function destroyAllSchedulers(): void {
  for (const [, task] of scheduledTasks) {
    task.stop();
  }
  scheduledTasks.clear();
}
