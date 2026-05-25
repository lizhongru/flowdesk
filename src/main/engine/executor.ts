import { randomUUID } from 'node:crypto';
import { BrowserWindow } from 'electron';
import type {
  Workflow, WorkflowNode, WorkflowEdge,
  ExecutionContext, ExecutionLog, NodeExecutionLog, ExecutionEvent
} from '../../../shared/types';
import { runNode } from './node-runner';
import { EventBatcher } from './event-batcher';

function getNodeActualType(node: WorkflowNode): string {
  return (node.data.nodeType as string) || node.type;
}

const activeExecutions = new Map<string, AbortController>();

export async function executeWorkflow(
  workflow: Workflow,
  triggerData: unknown,
  mainWindow: BrowserWindow,
  triggerType: string = 'manual',
  parentCallStack?: string[]
): Promise<ExecutionLog> {
  const executionId = randomUUID();
  const abortController = new AbortController();
  activeExecutions.set(executionId, abortController);

  const batcher = new EventBatcher(mainWindow);
  batcher.start();

  const callStack = [...(parentCallStack || []), workflow.id];

  const context: ExecutionContext = {
    workflowId: workflow.id,
    executionId,
    triggerData,
    variables: new Map(),
    nodeOutputs: new Map(),
    aborted: false,
    callStack,
    log: (nodeId, level, message) => {
      batcher.push({ type: 'log', executionId, nodeId, level, message });
    },
  };

  const nodeLogs: NodeExecutionLog[] = [];
  let finalStatus: 'success' | 'failed' | 'cancelled' = 'success';

  batcher.push({
    type: 'started', executionId, workflowId: workflow.id, triggerType,
  });

  const triggerLabels: Record<string, string> = {
    manual: '手动触发',
    cron: '定时触发',
    'file-watch': '文件监听',
    hotkey: '快捷键触发',
    startup: '启动触发',
  };
  context.log('system', 'info', `▶ 执行工作流「${workflow.name}」— ${triggerLabels[triggerType] || triggerType}`);

  try {
    const triggerNode = workflow.nodes.find(n => {
      const hasIncoming = workflow.edges.some(e => e.target === n.id);
      return !hasIncoming;
    });

    if (!triggerNode) {
      throw new Error('未找到触发器节点');
    }

    await executeNodeRecursive(
      triggerNode, triggerData, workflow.nodes, workflow.edges,
      context, nodeLogs, batcher, abortController.signal
    );

  } catch (err: any) {
    if (abortController.signal.aborted) {
      finalStatus = 'cancelled';
    } else {
      finalStatus = 'failed';
    }
    context.log('system', 'error', err.message || '执行失败');
  } finally {
    activeExecutions.delete(executionId);
  }

  const statusIcons: Record<string, string> = { success: '✓', failed: '✗', cancelled: '■' };
  context.log('system', 'info', `${statusIcons[finalStatus] || '?'} 执行${finalStatus === 'success' ? '成功' : finalStatus === 'failed' ? '失败' : '已取消'}`);

  const log: ExecutionLog = {
    id: executionId,
    workflowId: workflow.id,
    status: finalStatus,
    triggerType,
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    nodeLogs,
  };

  batcher.push({ type: 'complete', executionId, status: finalStatus });
  batcher.stop();

  return log;
}

async function executeNodeRecursive(
  node: WorkflowNode,
  input: unknown,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: ExecutionContext,
  nodeLogs: NodeExecutionLog[],
  batcher: EventBatcher,
  signal: AbortSignal,
  options?: { silent?: boolean; instanceId?: string }
): Promise<void> {
  if (signal.aborted) {
    context.aborted = true;
    throw new Error('执行已取消');
  }

  const { silent = false, instanceId } = options || {};
  const key = instanceId || node.id;

  // 非 silent 模式才推送 UI 事件
  if (!silent) {
    batcher.push({
      type: 'node-status', executionId: context.executionId,
      nodeId: node.id, instanceId, status: 'running',
    });
  }

  const nodeLog: NodeExecutionLog = {
    nodeId: node.id,
    nodeType: getNodeActualType(node),
    status: 'running',
    input,
    output: null,
    error: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    duration: null,
  };
  nodeLogs.push(nodeLog);

  const startTime = Date.now();

  try {
    const actualType = getNodeActualType(node);
    const result = await runNode(actualType, node.data, input, context);
    const duration = Date.now() - startTime;

    context.nodeOutputs.set(node.id, result.output);
    const label = node.data.label as string;
    if (label) {
      context.nodeOutputs.set(label, result.output);
    }

    nodeLog.status = 'success';
    nodeLog.output = result.output;
    nodeLog.outputFile = (result as any).outputFile;
    nodeLog.finishedAt = new Date().toISOString();
    nodeLog.duration = duration;

    if (!silent) {
      batcher.push({
        type: 'node-status', executionId: context.executionId,
        nodeId: node.id, instanceId, status: 'success',
      });
      batcher.push({
        type: 'node-output', executionId: context.executionId,
        nodeId: node.id, instanceId, output: result.output,
        outputFile: (result as any).outputFile,
      });
    }

    await executeDownstream(
      node, result.output, allNodes, edges,
      context, nodeLogs, batcher, signal, silent
    );

  } catch (err: any) {
    const duration = Date.now() - startTime;
    nodeLog.status = 'failed';
    nodeLog.error = err.message || '节点执行失败';
    nodeLog.finishedAt = new Date().toISOString();
    nodeLog.duration = duration;

    // 错误始终推送（即使是 silent 模式）
    batcher.push({
      type: 'node-status', executionId: context.executionId,
      nodeId: node.id, instanceId, status: 'failed',
    });
    batcher.push({
      type: 'node-error', executionId: context.executionId,
      nodeId: node.id, instanceId, error: nodeLog.error!,
    });

    throw err;
  }
}

async function executeDownstream(
  currentNode: WorkflowNode,
  output: unknown,
  allNodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: ExecutionContext,
  nodeLogs: NodeExecutionLog[],
  batcher: EventBatcher,
  signal: AbortSignal,
  parentSilent: boolean
): Promise<void> {
  const outgoingEdges = edges.filter(e => e.source === currentNode.id);
  if (outgoingEdges.length === 0) return;

  if (getNodeActualType(currentNode) === 'condition') {
    const passed = (output as any)?.passed === true;
    const targetHandle = passed ? 'true' : 'false';
    const matchedEdge = outgoingEdges.find(e => e.sourceHandle === targetHandle);

    if (matchedEdge) {
      const nextNode = allNodes.find(n => n.id === matchedEdge.target);
      if (nextNode) {
        await executeNodeRecursive(
          nextNode, output, allNodes, edges,
          context, nodeLogs, batcher, signal,
          { silent: parentSilent }
        );
      }
    }
    return;
  }

  if (getNodeActualType(currentNode) === 'try-catch') {
    const successEdges = outgoingEdges.filter(e => e.sourceHandle === 'success');
    const errorEdges = outgoingEdges.filter(e => e.sourceHandle === 'error');

    try {
      for (const edge of successEdges) {
        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode) {
          await executeNodeRecursive(
            nextNode, output, allNodes, edges,
            context, nodeLogs, batcher, signal,
            { silent: parentSilent }
          );
        }
      }
    } catch (err: any) {
      const errorInput = { error: true, message: err.message || '未知错误' };
      // 将错误信息存入 nodeOutputs，供错误分支的节点通过 {{try-catch_id.message}} 引用
      context.nodeOutputs.set(currentNode.id, errorInput);
      const label = currentNode.data.label as string;
      if (label) context.nodeOutputs.set(label, errorInput);

      for (const edge of errorEdges) {
        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode) {
          await executeNodeRecursive(
            nextNode, errorInput, allNodes, edges,
            context, nodeLogs, batcher, signal,
            { silent: parentSilent }
          );
        }
      }
    }
    return;
  }

  if (getNodeActualType(currentNode) === 'retry') {
    const taskEdges = outgoingEdges.filter(e => e.sourceHandle === 'task');
    const successEdges = outgoingEdges.filter(e => e.sourceHandle === 'success');
    const errorEdges = outgoingEdges.filter(e => e.sourceHandle === 'error');

    const maxRetries = (currentNode.data.maxRetries as number) || 3;
    const delayMs = (currentNode.data.delayMs as number) || 1000;
    let lastError: string | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      if (signal.aborted) throw new Error('执行已取消');

      try {
        // 执行 task 端口的下游节点
        for (const edge of taskEdges) {
          const nextNode = allNodes.find(n => n.id === edge.target);
          if (nextNode) {
            await executeNodeRecursive(
              nextNode, output, allNodes, edges,
              context, nodeLogs, batcher, signal,
              { silent: parentSilent }
            );
          }
        }

        // 成功：存储结果，执行 success 分支
        const successResult = { attempts: attempt, success: true, lastError: null };
        context.nodeOutputs.set(currentNode.id, successResult);
        const label = currentNode.data.label as string;
        if (label) context.nodeOutputs.set(label, successResult);

        for (const edge of successEdges) {
          const nextNode = allNodes.find(n => n.id === edge.target);
          if (nextNode) {
            await executeNodeRecursive(
              nextNode, successResult, allNodes, edges,
              context, nodeLogs, batcher, signal,
              { silent: parentSilent }
            );
          }
        }
        return;
      } catch (err: any) {
        lastError = err.message || '未知错误';
        context.log(currentNode.id, 'warn', `重试 ${attempt}/${maxRetries} 失败: ${lastError}`);

        if (attempt < maxRetries && delayMs > 0) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // 全部重试耗尽：执行 error 分支
    const errorResult = { attempts: maxRetries, success: false, lastError };
    context.nodeOutputs.set(currentNode.id, errorResult);
    const label = currentNode.data.label as string;
    if (label) context.nodeOutputs.set(label, errorResult);

    for (const edge of errorEdges) {
      const nextNode = allNodes.find(n => n.id === edge.target);
      if (nextNode) {
        await executeNodeRecursive(
          nextNode, errorResult, allNodes, edges,
          context, nodeLogs, batcher, signal,
          { silent: parentSilent }
        );
      }
    }
    return;
  }

  if (getNodeActualType(currentNode) === 'loop') {
    const loopResult = output as { items: unknown[]; mode: string };
    const itemEdges = outgoingEdges.filter(e => e.sourceHandle === 'item');
    const doneEdges = outgoingEdges.filter(e => e.sourceHandle === 'done');
    const total = loopResult.items.length;

    for (let i = 0; i < total; i++) {
      if (signal.aborted) throw new Error('执行已取消');

      context.variables.set('__loop_item', loopResult.items[i]);
      context.variables.set('__loop_index', i);
      context.variables.set('__loop_total', total);

      for (const edge of itemEdges) {
        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode) {
          const iterInstanceId = `${nextNode.id}#${i}`;
          await executeNodeRecursive(
            nextNode, loopResult.items[i], allNodes, edges,
            context, nodeLogs, batcher, signal,
            { silent: true, instanceId: iterInstanceId }  // 循环体内 silent
          );
        }
      }

      // 每 100 次推送一次进度
      if (i % 100 === 0) {
        batcher.push({
          type: 'log', executionId: context.executionId,
          nodeId: currentNode.id, level: 'info',
          message: `循环进度: ${i + 1}/${total}`,
        });
      }
    }

    // done 端口恢复正常推送
    for (const edge of doneEdges) {
      const nextNode = allNodes.find(n => n.id === edge.target);
      if (nextNode) {
        await executeNodeRecursive(
          nextNode, output, allNodes, edges,
          context, nodeLogs, batcher, signal
        );
      }
    }
    return;
  }

  // 多分支并行执行（Promise.all），单分支串行
  if (outgoingEdges.length > 1) {
    await Promise.all(
      outgoingEdges.map(edge => {
        const nextNode = allNodes.find(n => n.id === edge.target);
        if (nextNode) {
          return executeNodeRecursive(
            nextNode, output, allNodes, edges,
            context, nodeLogs, batcher, signal,
            { silent: parentSilent }
          );
        }
        return Promise.resolve();
      })
    );
  } else {
    const nextNode = allNodes.find(n => n.id === outgoingEdges[0].target);
    if (nextNode) {
      await executeNodeRecursive(
        nextNode, output, allNodes, edges,
        context, nodeLogs, batcher, signal,
        { silent: parentSilent }
      );
    }
  }
}

export function cancelExecution(executionId: string): void {
  const controller = activeExecutions.get(executionId);
  if (controller) {
    controller.abort();
  }
}
