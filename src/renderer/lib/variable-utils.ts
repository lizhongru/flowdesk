import { getNodeDefinition } from './node-definitions';
import type { WorkflowNode, OutputField } from '../../../shared/types';

export interface VariableGroup {
  label: string;
  icon: string;
  items: { label: string; value: string; type: OutputField['type'] }[];
}

/**
 * 根据上游节点列表，构建变量选择树。
 * 使用节点名称作为变量引用，如 {{文件监听.filePath}}
 * 重名节点自动加编号：{{文件监听.filePath}}, {{文件监听2.filePath}}
 */
export function buildVariableGroups(nodes: WorkflowNode[]): VariableGroup[] {
  const groups: VariableGroup[] = [];

  const categoryLabels: Record<string, string> = {
    trigger: '触发器输出',
    action: '动作输出',
    logic: '逻辑输出',
  };

  const byCategory: Record<string, VariableGroup> = {};

  // 统计每个名称出现的次数，处理重名
  const labelCount = new Map<string, number>();
  const nodeRefMap = new Map<string, string>(); // nodeId → 引用名

  for (const node of nodes) {
    const def = getNodeDefinition(node.data.nodeType as string);
    if (!def) continue;

    // 变量设置节点：暴露 {{var.变量名}} 格式
    const isVarNode = node.data.nodeType === 'variable';
    const varName = isVarNode ? (node.data.name as string) : '';
    if (isVarNode && !varName) continue;
    if (!isVarNode && def.outputFields.length === 0) continue;

    const rawLabel = (node.data.label as string) || def.label;
    const count = labelCount.get(rawLabel) || 0;
    labelCount.set(rawLabel, count + 1);

    // 第一个不加编号，第二个起加 2、3、4...
    const refName = count === 0 ? rawLabel : `${rawLabel}${count + 1}`;
    nodeRefMap.set(node.id, refName);

    const cat = def.category;
    if (!byCategory[cat]) {
      byCategory[cat] = {
        label: categoryLabels[cat] || cat,
        icon: cat === 'trigger' ? '⚡' : cat === 'action' ? '⚙️' : '🔗',
        items: [],
      };
    }

    // 节点标题（不可点击）
    byCategory[cat].items.push({
      label: `${def.icon} ${rawLabel}${count > 0 ? ` (${refName})` : ''}`,
      value: `__header__${node.id}`,
      type: 'string',
    });

    if (isVarNode) {
      // 变量设置节点：显示变量名
      byCategory[cat].items.push({
        label: varName,
        value: `{{var.${varName}}}`,
        type: 'string',
      });
    } else {
      // 输出字段
      for (const field of def.outputFields) {
        byCategory[cat].items.push({
          label: field.label,
          value: `{{${refName}.${field.key}}}`,
          type: field.type,
        });
      }
    }
  }

  for (const cat of ['trigger', 'action', 'logic']) {
    if (byCategory[cat]) {
      groups.push(byCategory[cat]);
    }
  }

  return groups;
}
