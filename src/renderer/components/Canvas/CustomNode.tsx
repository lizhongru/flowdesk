import { memo } from 'react';
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { clsx } from 'clsx';
import NodeIcon from '../NodeIcon';

type CustomNodeData = {
  label: string;
  nodeType: string;
  category: 'trigger' | 'action' | 'logic';
  icon: string;
  color: string;
  summary?: string;
  executionStatus?: 'idle' | 'running' | 'success' | 'failed';
};

type CustomNodeType = Node<CustomNodeData>;

const categoryColors: Record<string, string> = {
  trigger: 'var(--node-trigger)',
  action: 'var(--node-action)',
  logic: 'var(--node-logic)',
};

function CustomNodeComponent({ data, selected }: NodeProps<CustomNodeType>) {
  const borderColor = categoryColors[data.category] || 'var(--border)';
  const statusColor = data.executionStatus === 'running'
    ? '#60a5fa'
    : data.executionStatus === 'success'
    ? '#4ade80'
    : data.executionStatus === 'failed'
    ? '#f87171'
    : null;

  return (
    <div
      className={clsx(
        'rounded-lg shadow-lg min-w-[220px] max-w-[280px] transition-all relative',
        selected && 'ring-2 ring-[var(--accent)]'
      )}
      style={{ background: 'var(--bg-surface)', border: `1px solid ${borderColor}` }}
    >
      {/* 执行状态指示器 */}
      {statusColor && (
        <div
          className={clsx(
            'absolute -right-1 top-1/2 -translate-y-1/2 w-2.5 h-8 rounded-full',
            data.executionStatus === 'running' && 'animate-pulse'
          )}
          style={{
            background: statusColor,
            boxShadow: `0 0 8px ${statusColor}80`,
          }}
        />
      )}
      {/* 标题栏 */}
      <div
        className="flex items-center gap-2 px-3 py-2 rounded-t-lg"
        style={{ background: borderColor + '20' }}
      >
        <NodeIcon name={data.icon} size={14} style={{ color: borderColor }} />
        <span className="text-sm font-medium truncate" style={{ color: borderColor }}>
          {data.label}
        </span>
      </div>

      {/* 配置预览 */}
      {data.summary && (
        <div className="px-3 py-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
          {data.summary}
        </div>
      )}

      {/* 输入端口 */}
      {data.category !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-[var(--border)] !border-2 !border-[var(--bg-surface)]"
        />
      )}

      {/* 输出端口 */}
      {data.nodeType === 'condition' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="true"
            className="!w-3 !h-3 !bg-green-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '40%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="false"
            className="!w-3 !h-3 !bg-red-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '70%' }}
          />
        </>
      ) : data.nodeType === 'try-catch' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="success"
            className="!w-3 !h-3 !bg-green-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '40%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="error"
            className="!w-3 !h-3 !bg-red-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '70%' }}
          />
        </>
      ) : data.nodeType === 'retry' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="task"
            className="!w-3 !h-3 !bg-blue-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '30%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="success"
            className="!w-3 !h-3 !bg-green-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '55%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="error"
            className="!w-3 !h-3 !bg-red-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '80%' }}
          />
        </>
      ) : data.nodeType === 'loop' ? (
        <>
          <Handle
            type="source"
            position={Position.Right}
            id="item"
            className="!w-3 !h-3 !bg-blue-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '40%' }}
          />
          <Handle
            type="source"
            position={Position.Right}
            id="done"
            className="!w-3 !h-3 !bg-yellow-400 !border-2 !border-[var(--bg-surface)]"
            style={{ top: '70%' }}
          />
        </>
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-[var(--border)] !border-2 !border-[var(--bg-surface)]"
        />
      )}
    </div>
  );
}

export default memo(CustomNodeComponent, (prev, next) => {
  return (
    prev.selected === next.selected &&
    prev.data.executionStatus === next.data.executionStatus &&
    prev.data.summary === next.data.summary &&
    prev.data.label === next.data.label &&
    prev.data.icon === next.data.icon
  );
});
