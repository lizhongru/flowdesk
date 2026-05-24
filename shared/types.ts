// shared/types.ts

// ============ 工作流 ============

export interface Workflow {
  id: string;
  name: string;
  description: string;
  category: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  enabled: boolean;
  notifyOnComplete: boolean;
  createdAt: string;
  updatedAt: string;
  executionCount: number;
  lastExecutedAt: string | null;
}

// ============ 节点 ============

export type NodeCategory = 'trigger' | 'action' | 'logic';

export interface OutputField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
}

export interface NodeDefinition {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: NodePort[];
  outputs: NodePort[];
  outputFields: OutputField[];
  defaultData: Record<string, unknown>;
  configSchema: ConfigField[];
}

export interface NodePort {
  id: string;
  label: string;
  dataType: 'any' | 'string' | 'number' | 'boolean' | 'array' | 'object' | 'file';
}

export interface WorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: {
    label: string;
    [key: string]: unknown;
  };
}

export interface WorkflowEdge {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  animated?: boolean;
}

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'textarea' | 'file-picker'
      | 'cron' | 'json' | 'toggle' | 'variable' | 'hotkey' | 'workflow-picker';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: unknown;
}

// ============ 执行 ============

export interface ExecutionContext {
  workflowId: string;
  executionId: string;
  triggerData: unknown;
  variables: Map<string, unknown>;
  nodeOutputs: Map<string, unknown>;
  aborted: boolean;
  callStack?: string[];
  log: (nodeId: string, level: 'info' | 'warn' | 'error', message: string) => void;
}

export interface NodeResult {
  success: boolean;
  output: unknown;
  error?: string;
  duration: number;
}

export interface ExecutionLog {
  id: string;
  workflowId: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  triggerType: string;
  startedAt: string;
  finishedAt: string | null;
  nodeLogs: NodeExecutionLog[];
}

export interface NodeExecutionLog {
  nodeId: string;
  nodeType: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  input: unknown;
  output: unknown;
  outputFile?: string; // 完整输出保存路径（截断时有值）
  error: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  duration: number | null;
}

// ============ 模板 ============

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

// ============ 执行历史 ============

export interface ExecutionHistoryEntry {
  id: string;
  workflowId: string;
  workflowName: string;
  status: 'running' | 'success' | 'failed' | 'cancelled';
  triggerType: string;
  startedAt: string;
  finishedAt: string | null;
  duration: number | null;
}

// ============ IPC 事件 ============

export type ExecutionEvent =
  | { type: 'node-status'; executionId: string; nodeId: string; instanceId?: string;
      status: 'running' | 'success' | 'failed' | 'skipped'; }
  | { type: 'node-output'; executionId: string; nodeId: string; instanceId?: string; output: unknown; outputFile?: string; }
  | { type: 'node-error'; executionId: string; nodeId: string; instanceId?: string; error: string; }
  | { type: 'log'; executionId: string; nodeId: string; instanceId?: string;
      level: 'info' | 'warn' | 'error'; message: string; }
  | { type: 'complete'; executionId: string; status: 'success' | 'failed' | 'cancelled'; }
  | { type: 'started'; executionId: string; workflowId: string; triggerType: string; };
