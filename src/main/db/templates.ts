import type { WorkflowNode, WorkflowEdge } from '../../../shared/types';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const templates: WorkflowTemplate[] = [
  {
    id: 'tpl-file-monitor',
    name: '文件监控与通知',
    description: '监听指定目录的文件变化，新增文件时发送系统通知',
    category: '文件管理',
    icon: 'Eye',
    nodes: [
      {
        id: 'trigger-1',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: { label: '文件监听', nodeType: 'file-watch', category: 'trigger', icon: 'Eye', color: '#818cf8', watchPath: '', patterns: '*.pdf,*.docx', events: 'add' },
      },
      {
        id: 'action-1',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: { label: '系统通知', nodeType: 'notify', category: 'action', icon: 'Bell', color: '#4f6ef7', title: '检测到新文件', body: '{{trigger-1.fileName}} 已添加到监控目录' },
      },
    ],
    edges: [
      { id: 'e-trigger-1-action-1', source: 'trigger-1', sourceHandle: null, target: 'action-1', targetHandle: null, animated: true },
    ],
  },
  {
    id: 'tpl-http-scheduled',
    name: '定时 HTTP 请求',
    description: '定时发送 HTTP 请求，根据状态码判断是否成功并通知',
    category: '网络工具',
    icon: 'Globe',
    nodes: [
      {
        id: 'trigger-1',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: { label: '定时触发', nodeType: 'cron', category: 'trigger', icon: 'Clock', color: '#818cf8', cronExpression: '0 9 * * *', timezone: 'Asia/Shanghai' },
      },
      {
        id: 'action-1',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: { label: 'HTTP 请求', nodeType: 'http-request', category: 'action', icon: 'Globe', color: '#4f6ef7', method: 'GET', url: 'https://httpbin.org/get', headers: '{}', body: '{}', timeout: 30 },
      },
      {
        id: 'logic-1',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: { label: '条件判断', nodeType: 'condition', category: 'logic', icon: 'GitBranch', color: '#fbbf24', field: '{{action-1.status}}', operator: 'eq', value: '200' },
      },
      {
        id: 'action-2',
        type: 'custom',
        position: { x: 1000, y: 120 },
        data: { label: '成功通知', nodeType: 'notify', category: 'action', icon: 'Bell', color: '#4f6ef7', title: '请求成功', body: 'HTTP 请求返回状态码 200' },
      },
      {
        id: 'action-3',
        type: 'custom',
        position: { x: 1000, y: 300 },
        data: { label: '失败通知', nodeType: 'notify', category: 'action', icon: 'Bell', color: '#4f6ef7', title: '请求异常', body: 'HTTP 请求返回状态码 {{action-1.status}}' },
      },
    ],
    edges: [
      { id: 'e-trigger-1-action-1', source: 'trigger-1', sourceHandle: null, target: 'action-1', targetHandle: null, animated: true },
      { id: 'e-action-1-logic-1', source: 'action-1', sourceHandle: null, target: 'logic-1', targetHandle: null, animated: true },
      { id: 'e-logic-1-action-2', source: 'logic-1', sourceHandle: 'true', target: 'action-2', targetHandle: null, animated: true },
      { id: 'e-logic-1-action-3', source: 'logic-1', sourceHandle: 'false', target: 'action-3', targetHandle: null, animated: true },
    ],
  },
  {
    id: 'tpl-condition-demo',
    name: '条件逻辑演示',
    description: '演示变量设置和条件判断，根据条件走不同通知分支',
    category: '效率工具',
    icon: 'GitBranch',
    nodes: [
      {
        id: 'trigger-1',
        type: 'custom',
        position: { x: 100, y: 200 },
        data: { label: '手动触发', nodeType: 'manual', category: 'trigger', icon: 'Play', color: '#818cf8' },
      },
      {
        id: 'logic-1',
        type: 'custom',
        position: { x: 400, y: 200 },
        data: { label: '设置变量', nodeType: 'variable', category: 'logic', icon: 'Variable', color: '#fbbf24', name: 'testValue', value: 'hello' },
      },
      {
        id: 'logic-2',
        type: 'custom',
        position: { x: 700, y: 200 },
        data: { label: '条件判断', nodeType: 'condition', category: 'logic', icon: 'GitBranch', color: '#fbbf24', field: '{{logic-1.testValue}}', operator: 'eq', value: 'hello' },
      },
      {
        id: 'action-1',
        type: 'custom',
        position: { x: 1000, y: 120 },
        data: { label: '条件为真', nodeType: 'notify', category: 'action', icon: 'Bell', color: '#4f6ef7', title: '条件满足', body: '变量值等于 hello' },
      },
      {
        id: 'action-2',
        type: 'custom',
        position: { x: 1000, y: 300 },
        data: { label: '条件为假', nodeType: 'notify', category: 'action', icon: 'Bell', color: '#4f6ef7', title: '条件不满足', body: '变量值不是 hello' },
      },
    ],
    edges: [
      { id: 'e-trigger-1-logic-1', source: 'trigger-1', sourceHandle: null, target: 'logic-1', targetHandle: null, animated: true },
      { id: 'e-logic-1-logic-2', source: 'logic-1', sourceHandle: null, target: 'logic-2', targetHandle: null, animated: true },
      { id: 'e-logic-2-action-1', source: 'logic-2', sourceHandle: 'true', target: 'action-1', targetHandle: null, animated: true },
      { id: 'e-logic-2-action-2', source: 'logic-2', sourceHandle: 'false', target: 'action-2', targetHandle: null, animated: true },
    ],
  },
];

export function getTemplates(): WorkflowTemplate[] {
  return templates;
}

export function getTemplateById(id: string): WorkflowTemplate | undefined {
  return templates.find(t => t.id === id);
}
