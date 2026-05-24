import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { ExecutionContext, NodeResult } from '../../../shared/types';
import { nodeRegistry } from '../nodes/registry';

const MAX_OUTPUT_BYTES = 1024 * 1024; // 1MB

export interface RunNodeResult extends NodeResult {
  outputFile?: string; // 完整输出的文件路径
}

/** 截断输出，超大时保存完整数据到文件 */
async function handleOutput(
  output: unknown,
  executionId: string,
  nodeId: string
): Promise<{ value: unknown; outputFile?: string }> {
  try {
    const json = typeof output === 'string' ? output : JSON.stringify(output, null, 2);
    if (json.length <= MAX_OUTPUT_BYTES) return { value: output };

    // 保存完整数据到临时文件
    const dir = join(tmpdir(), 'flowdesk-output');
    await mkdir(dir, { recursive: true });
    const file = join(dir, `${executionId}_${nodeId}.json`);
    await writeFile(file, json, 'utf-8');

    // 返回截断版本
    const truncated = json.slice(0, MAX_OUTPUT_BYTES) + '\n\n... [输出已截断，超过 1MB，点击查看完整数据]';
    return { value: truncated, outputFile: file };
  } catch {
    return { value: output };
  }
}

export async function runNode(
  nodeType: string,
  nodeData: Record<string, unknown>,
  input: unknown,
  context: ExecutionContext
): Promise<RunNodeResult> {
  const handler = nodeRegistry.get(nodeType);
  if (!handler) {
    throw new Error(`未注册的节点类型: ${nodeType}`);
  }

  const startTime = Date.now();
  const output = await handler(nodeData, input, context);

  const { value, outputFile } = await handleOutput(output, context.executionId, nodeType);

  if (outputFile) {
    context.log(nodeType, 'warn', '节点输出超过 1MB，已截断。点击「查看完整数据」查看完整内容。');
  }

  return {
    success: true,
    output: value,
    outputFile,
    duration: Date.now() - startTime,
  };
}
