import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Copy, Check } from 'lucide-react';
import type { WorkflowNode, ConfigField } from '../../../../shared/types';
import { getNodeDefinition } from '../../lib/node-definitions';
import NodeIcon from '../NodeIcon';
import { useWorkflowStore } from '../../stores/workflow-store';
import TextField from './fields/TextField';
import SelectField from './fields/SelectField';
import JsonField from './fields/JsonField';
import FilePickerField from './fields/FilePickerField';
import CronField from './fields/CronField';
import HotkeyField from './fields/HotkeyField';
import WorkflowPickerField from './fields/WorkflowPickerField';
import VariablePicker from './VariablePicker';

interface PropertiesPanelProps {
  node: WorkflowNode | null;
  allNodes: WorkflowNode[];
  currentWorkflowId?: string;
  onUpdateNode: (nodeId: string, data: Record<string, unknown>) => void;
  onClose: () => void;
}

export default function PropertiesPanel({ node, allNodes, currentWorkflowId, onUpdateNode, onClose }: PropertiesPanelProps) {
  const [localData, setLocalData] = useState<Record<string, unknown>>({});
  const [copied, setCopied] = useState(false);
  const { workflows, fetchWorkflows } = useWorkflowStore();

  useEffect(() => {
    fetchWorkflows();
  }, [fetchWorkflows]);

  useEffect(() => {
    if (node) {
      setLocalData({ ...node.data });
    }
  }, [node]);

  if (!node) return null;

  const definition = getNodeDefinition(node.data.nodeType as string);
  if (!definition) return null;

  // 防抖保存：localData 立即更新（UI 响应），onUpdateNode 延迟触发（避免频繁写 store/DB）
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestDataRef = useRef(localData);
  latestDataRef.current = localData;

  const debouncedSave = useCallback((nodeId: string, data: Record<string, unknown>) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      onUpdateNode(nodeId, data);
    }, 300);
  }, [onUpdateNode]);

  // 组件卸载或节点切换时，立即保存未提交的数据
  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
        // 用最新的数据做一次同步保存
        if (node) onUpdateNode(node.id, latestDataRef.current);
      }
    };
  }, [node?.id]);

  const handleChange = (key: string, value: unknown) => {
    const newData = { ...localData, [key]: value };
    setLocalData(newData);
    debouncedSave(node.id, newData);
  };

  const otherNodes = allNodes.filter((n) => n.id !== node.id);

  // 构建快捷键 → 工作流名称的映射（排除当前工作流）
  const hotkeyMap = new Map<string, string>();
  for (const wf of workflows) {
    if (currentWorkflowId && wf.id === currentWorkflowId) continue;
    const hotkeyNode = wf.nodes.find(n => (n.data.nodeType as string) === 'hotkey');
    if (hotkeyNode) {
      const accelerator = (hotkeyNode.data.accelerator as string || '').trim();
      if (accelerator && accelerator.includes('+') && !accelerator.endsWith('+')) {
        hotkeyMap.set(accelerator, wf.name);
      }
    }
  }

  const renderField = (field: ConfigField) => {
    const value = localData[field.key] as string;

    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <TextField
            key={field.key}
            label={field.label}
            value={String(value ?? field.defaultValue ?? '')}
            onChange={(v) => handleChange(field.key, field.type === 'number' ? Number(v) : v)}
            placeholder={field.placeholder}
            required={field.required}
            nodes={otherNodes}
          />
        );
      case 'textarea':
        return (
          <div key={field.key} className="mb-3">
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
              {field.label}
              {field.required && <span style={{ color: 'var(--error)' }}> *</span>}
            </label>
            <textarea
              value={value || ''}
              onChange={(e) => handleChange(field.key, e.target.value)}
              rows={3}
              className="w-full px-2 py-1.5 text-xs rounded-md outline-none transition-colors resize-none"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border)',
                color: 'var(--text-primary)',
              }}
            />
          </div>
        );
      case 'select':
        return (
          <SelectField
            key={field.key}
            label={field.label}
            value={value || (field.defaultValue as string) || ''}
            onChange={(v) => handleChange(field.key, v)}
            options={field.options || []}
            required={field.required}
          />
        );
      case 'json':
        return (
          <JsonField
            key={field.key}
            label={field.label}
            value={value || '{}'}
            onChange={(v) => handleChange(field.key, v)}
          />
        );
      case 'file-picker':
        return (
          <FilePickerField
            key={field.key}
            label={field.label}
            value={value || ''}
            onChange={(v) => handleChange(field.key, v)}
            required={field.required}
          />
        );
      case 'cron':
        return (
          <CronField
            key={field.key}
            label={field.label}
            value={value || ''}
            onChange={(v) => handleChange(field.key, v)}
            placeholder={field.placeholder}
            required={field.required}
          />
        );
      case 'hotkey': {
        const conflict = value ? hotkeyMap.get(value) : undefined;
        return (
          <HotkeyField
            key={field.key}
            label={field.label}
            value={value || ''}
            onChange={(v) => handleChange(field.key, v)}
            required={field.required}
            conflictWith={conflict}
          />
        );
      }
      case 'variable':
        return (
          <TextField
            key={field.key}
            label={field.label}
            value={value || ''}
            onChange={(v) => handleChange(field.key, v)}
            placeholder={field.placeholder}
            required={field.required}
            nodes={otherNodes}
            suffix={
              <VariablePicker
                nodes={otherNodes}
                currentValue={value || ''}
                onSelect={(v) => handleChange(field.key, v)}
              />
            }
          />
        );
      case 'workflow-picker':
        return (
          <WorkflowPickerField
            key={field.key}
            label={field.label}
            value={value || ''}
            onChange={(v) => handleChange(field.key, v)}
            required={field.required}
            currentWorkflowId={currentWorkflowId}
          />
        );
      case 'toggle':
        return (
          <div key={field.key} className="flex items-center gap-2 mb-3 cursor-pointer select-none" onClick={() => handleChange(field.key, !value)}>
            <div
              className="w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors duration-150"
              style={{
                background: value ? 'var(--accent)' : 'transparent',
                border: `1.5px solid ${value ? 'var(--accent)' : 'var(--border)'}`,
              }}
            >
              {value && <Check size={10} strokeWidth={3} style={{ color: '#fff' }} />}
            </div>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
              {field.label}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div
      className="w-80 h-full overflow-auto p-3"
      style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
          节点属性
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
        >
          <X size={12} style={{ color: 'var(--text-muted)' }} />
        </button>
      </div>

      <div
        className="flex items-center gap-2 p-2 rounded-lg mb-3"
        style={{ background: definition.color + '20', border: `1px solid ${definition.color}40` }}
      >
        <NodeIcon name={definition.icon} size={16} style={{ color: definition.color }} />
        <div>
          <div className="text-xs font-medium" style={{ color: definition.color }}>
            {definition.label}
          </div>
          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
            {definition.description}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 px-2 py-1.5 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        <span className="text-xs font-mono select-all" style={{ color: 'var(--text-secondary)' }}>
          ID: {node.id}
        </span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(node.id);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] transition-colors"
          style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}
          onMouseEnter={e => { if (!copied) e.currentTarget.style.background = 'var(--bg-surface)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          title="复制节点 ID"
        >
          {copied ? <Check size={10} /> : <Copy size={10} />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>

      <TextField
        label="节点名称"
        value={(localData.label as string) || ''}
        onChange={(v) => handleChange('label', v)}
        required
      />

      {definition.configSchema.map(renderField)}
    </div>
  );
}
