import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { buildVariableGroups } from '../../lib/variable-utils';
import type { WorkflowNode } from '../../../../shared/types';

interface VariablePickerProps {
  nodes: WorkflowNode[];
  currentValue: string;
  onSelect: (value: string) => void;
}

const typeColors: Record<string, string> = {
  string: '#4ade80',
  number: '#fb923c',
  boolean: '#a78bfa',
  object: '#60a5fa',
  array: '#f472b6',
};

const typeLabels: Record<string, string> = {
  string: 'str',
  number: 'num',
  boolean: 'bool',
  object: 'obj',
  array: 'arr',
};

export default function VariablePicker({ nodes, currentValue, onSelect }: VariablePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const groups = buildVariableGroups(nodes);

  const updatePos = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let left = rect.left;
    if (left + 260 > window.innerWidth - 8) {
      left = window.innerWidth - 268;
    }
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 4, left });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('mousedown', handleClick);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('scroll', updatePos, true);
    window.addEventListener('resize', updatePos);
    return () => {
      window.removeEventListener('mousedown', handleClick);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('scroll', updatePos, true);
      window.removeEventListener('resize', updatePos);
    };
  }, [isOpen, updatePos]);

  const hasFields = groups.some(g => g.items.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-md transition-all duration-150"
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${isOpen ? 'var(--accent)' : 'var(--border)'}`,
          color: 'var(--text-secondary)',
        }}
      >
        插入变量
        <ChevronDown
          size={12}
          className="transition-transform duration-200"
          style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
        />
      </button>
      {isOpen && (
        <div
          ref={dropdownRef}
          className="fixed z-[999] rounded-lg shadow-xl overflow-hidden"
          style={{
            top: pos.top,
            left: pos.left,
            width: 260,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            animation: 'dropdownIn 0.15s ease-out',
          }}
        >
          <div className="max-h-64 overflow-y-auto py-0.5">
            {!hasFields ? (
              <div className="px-3 py-3 text-[11px] text-center" style={{ color: 'var(--text-muted)' }}>
                无可用变量，请先添加上游节点
              </div>
            ) : (
              groups.map((group, gi) => (
                <div key={gi}>
                  <div
                    className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)' }}
                  >
                    {group.icon} {group.label}
                  </div>
                  {group.items.map((item, ii) => {
                    const isHeader = item.value.startsWith('__header__');
                    if (isHeader) {
                      return (
                        <div
                          key={ii}
                          className="px-3 py-1.5 text-[11px] font-medium"
                          style={{ color: 'var(--text-secondary)', borderTop: '1px solid var(--border)' }}
                        >
                          {item.label}
                        </div>
                      );
                    }
                    return (
                      <button
                        key={ii}
                        title={`${item.label}  →  ${item.value}`}
                        onClick={() => { onSelect(item.value); setIsOpen(false); }}
                        className="w-full flex items-center justify-between px-4 py-1.5 text-[11px] transition-colors duration-100"
                        style={{ color: 'var(--text-primary)' }}
                        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-surface)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span className="truncate">{item.label}</span>
                        <span
                          className="font-mono text-[10px] px-1 py-0.5 rounded flex-shrink-0 ml-2"
                          style={{
                            color: typeColors[item.type] || 'var(--text-muted)',
                            background: (typeColors[item.type] || 'var(--text-muted)') + '15',
                          }}
                        >
                          {typeLabels[item.type] || item.type}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
