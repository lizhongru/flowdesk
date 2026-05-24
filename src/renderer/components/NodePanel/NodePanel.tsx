import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import { nodeDefinitions } from '../../lib/node-definitions';
import NodeCategory from './NodeCategory';

export default function NodePanel() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return nodeDefinitions;
    const q = query.toLowerCase();
    return nodeDefinitions.filter(
      (d) => d.label.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    );
  }, [query]);

  const triggers = filtered.filter((d) => d.category === 'trigger');
  const actions = filtered.filter((d) => d.category === 'action');
  const logic = filtered.filter((d) => d.category === 'logic');

  return (
    <div
      className="w-56 h-full overflow-auto p-3"
      style={{ background: 'var(--bg-secondary)', borderLeft: '1px solid var(--border)' }}
    >
      <h2
        className="text-xs font-semibold mb-2 px-1"
        style={{ color: 'var(--text-primary)' }}
      >
        节点面板
      </h2>
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-md mb-3"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border)' }}
      >
        <Search size={12} style={{ color: 'var(--text-muted)' }} />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="搜索节点..."
          className="w-full bg-transparent text-xs outline-none"
          style={{ color: 'var(--text-primary)' }}
        />
      </div>
      {triggers.length > 0 && <NodeCategory label="触发器" nodes={triggers} />}
      {actions.length > 0 && <NodeCategory label="动作" nodes={actions} />}
      {logic.length > 0 && <NodeCategory label="逻辑" nodes={logic} />}
      {filtered.length === 0 && (
        <p className="text-xs text-center py-4" style={{ color: 'var(--text-muted)' }}>
          无匹配节点
        </p>
      )}
    </div>
  );
}
