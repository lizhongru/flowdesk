import type { NodeDefinition } from '../../../../shared/types';
import NodeCard from './NodeCard';

interface NodeCategoryProps {
  label: string;
  nodes: NodeDefinition[];
}

export default function NodeCategory({ label, nodes }: NodeCategoryProps) {
  return (
    <div className="mb-4">
      <h3
        className="text-xs font-medium mb-2 px-1"
        style={{ color: 'var(--text-muted)' }}
      >
        {label}
      </h3>
      <div className="grid gap-1.5">
        {nodes.map((node) => (
          <NodeCard key={node.type} definition={node} />
        ))}
      </div>
    </div>
  );
}
