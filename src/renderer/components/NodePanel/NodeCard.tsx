import NodeIcon from '../NodeIcon';
import type { NodeDefinition } from '../../../../shared/types';

interface NodeCardProps {
  definition: NodeDefinition;
}

export default function NodeCard({ definition }: NodeCardProps) {
  const onDragStart = (event: React.DragEvent) => {
    event.dataTransfer.setData('application/reactflow-type', definition.type);
    event.dataTransfer.setData('application/reactflow-category', definition.category);
    event.dataTransfer.setData('application/reactflow-label', definition.label);
    event.dataTransfer.setData('application/reactflow-icon', definition.icon);
    event.dataTransfer.setData('application/reactflow-color', definition.color);
    event.dataTransfer.effectAllowed = 'move';
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      className="flex items-center gap-2 p-2 rounded-lg cursor-grab active:cursor-grabbing transition-colors hover:brightness-110"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
    >
      <NodeIcon name={definition.icon} size={14} style={{ color: definition.color }} />
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
          {definition.label}
        </div>
        <div className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>
          {definition.description}
        </div>
      </div>
    </div>
  );
}
