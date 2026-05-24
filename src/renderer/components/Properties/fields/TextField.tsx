import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { buildVariableGroups } from '../../../lib/variable-utils';
import type { WorkflowNode } from '../../../../../shared/types';

const TOKENIZE_MAX = 2000; // 超过此长度跳过变量着色，避免卡顿

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  nodes?: WorkflowNode[];
  suffix?: React.ReactNode;
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

interface Token {
  type: 'text' | 'variable';
  value: string;
}

/** 将文本解析为 token 序列，{{xxx.yyy}} 识别为变量 */
function tokenize(text: string): Token[] {
  if (!text) return [];
  const tokens: Token[] = [];
  const regex = /\{\{(.+?)\}\}/g;
  let lastIdx = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIdx) {
      tokens.push({ type: 'text', value: text.slice(lastIdx, match.index) });
    }
    tokens.push({ type: 'variable', value: match[0] });
    lastIdx = regex.lastIndex;
  }
  if (lastIdx < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIdx) });
  }
  return tokens;
}

/** 从变量 token 中提取显示名：{{文件监听.filePath}} → 文件监听.filePath */
function varDisplayName(token: string): string {
  return token.replace(/^\{\{|\}\}$/g, '');
}

export default function TextField({ label, value, onChange, placeholder, required, nodes, suffix }: TextFieldProps) {
  const [showVars, setShowVars] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const groups = nodes ? buildVariableGroups(nodes) : [];
  const hasFields = groups.some(g => g.items.length > 0);

  // 变量值 → 颜色映射
  const varColorMap = new Map<string, string>();
  for (const g of groups) {
    for (const item of g.items) {
      if (!item.value.startsWith('__header__')) {
        varColorMap.set(item.value, typeColors[item.type] || '#60a5fa');
      }
    }
  }

  const updatePos = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let left = rect.left;
    if (left + 260 > window.innerWidth - 8) {
      left = window.innerWidth - 268;
    }
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 2, left });
  }, []);

  useEffect(() => {
    if (!showVars) return;
    updatePos();
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setShowVars(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowVars(false);
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
  }, [showVars, updatePos]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(newValue);

    if (!nodes || nodes.length === 0) return;
    const cursor = e.target.selectionStart ?? newValue.length;
    const before = newValue.slice(0, cursor);
    if (before.endsWith('{{')) {
      setShowVars(true);
    }
  };

  const insertVariable = (varValue: string) => {
    const input = inputRef.current;
    if (!input) {
      onChange(value + varValue);
      setShowVars(false);
      return;
    }

    const selStart = input.selectionStart ?? value.length;
    const selEnd = input.selectionEnd ?? selStart;

    if (selStart !== selEnd) {
      // 有选区：直接替换选中内容
      const newValue = value.slice(0, selStart) + varValue + value.slice(selEnd);
      onChange(newValue);
    } else {
      // 无选区：找光标前的 {{ 并替换
      const before = value.slice(0, selStart);
      const dblBraceIdx = before.lastIndexOf('{{');
      if (dblBraceIdx === -1) {
        onChange(value.slice(0, selStart) + varValue + value.slice(selStart));
      } else {
        onChange(value.slice(0, dblBraceIdx) + varValue + value.slice(selStart));
      }
    }
    setShowVars(false);
    setTimeout(() => input.focus(), 0);
  };

  const shouldTokenize = (value || '').length <= TOKENIZE_MAX;
  const tokens = useMemo(() => shouldTokenize ? tokenize(value || '') : [], [value, shouldTokenize]);
  const isEmpty = !value;

  // 计算每个 token 在原始字符串中的起止位置
  const tokenPositions = useMemo(() => {
    const positions: { start: number; end: number }[] = [];
    let cumIdx = 0;
    for (const token of tokens) {
      positions.push({ start: cumIdx, end: cumIdx + token.value.length });
      cumIdx += token.value.length;
    }
    return positions;
  }, [tokens]);

  /** 点击变量标签：选中 input 中对应的 {{xxx.yyy}} 文本 */
  const handleTagClick = (start: number, end: number, e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止冒泡到视觉层的 onClick
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(start, end);
  };

  const dropdown = showVars && hasFields ? (
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
        {groups.map((group, gi) => (
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
                  onClick={() => insertVariable(item.value)}
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
        ))}
      </div>
    </div>
  ) : null;

  const inputArea = (
    <div
      ref={containerRef}
      className={`${suffix ? 'flex-1 min-w-0' : 'w-full'} relative`}
    >
      {/* 视觉层：显示标签和文本 */}
      <div
        className="px-2 py-1.5 text-xs rounded-md min-h-[28px] flex flex-wrap items-center gap-0.5 cursor-text overflow-hidden"
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${showVars ? 'var(--accent)' : 'var(--border)'}`,
          wordBreak: 'break-all',
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {isEmpty && (
          <span className="pointer-events-none" style={{ color: 'var(--text-muted)' }}>
            {placeholder}
          </span>
        )}
        {shouldTokenize ? tokens.map((token, i) => {
          if (token.type === 'text') {
            return <span key={i} style={{ color: 'var(--text-primary)' }}>{token.value}</span>;
          }
          const pos = tokenPositions[i];
          return (
            <span
              key={i}
              className="cursor-pointer hover:opacity-80"
              style={{ color: '#4ade80' }}
              onMouseDown={e => {
                e.preventDefault();
                handleTagClick(pos.start, pos.end, e);
              }}
            >
              {token.value}
            </span>
          );
        }) : (
          <span style={{ color: 'var(--text-primary)' }}>{value}</span>
        )}
      </div>

      {/* 真正的 input：透明覆盖在视觉层上 */}
      <input
        ref={inputRef}
        type="text"
        value={value || ''}
        onChange={handleChange}
        className="absolute inset-0 w-full h-full px-2 py-1.5 text-xs outline-none"
        style={{
          background: 'transparent',
          color: 'transparent',
          caretColor: 'var(--text-primary)',
          border: 'none',
        }}
      />
    </div>
  );

  // 无 label 时由外部控制布局（用于嵌套场景）
  if (label === '' && !suffix) {
    return (
      <>
        {inputArea}
        {dropdown}
        <style>{`
          @keyframes dropdownIn {
            from { opacity: 0; transform: translateY(-4px) scale(0.97); }
            to { opacity: 1; transform: translateY(0) scale(1); }
          }
        `}</style>
      </>
    );
  }

  return (
    <div className="mb-3">
      {label && (
        <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
          {label}
          {required && <span style={{ color: 'var(--error)' }}> *</span>}
        </label>
      )}
      <div className="flex gap-1">
        {inputArea}
        {suffix}
      </div>
      {dropdown}
      <style>{`
        @keyframes dropdownIn {
          from { opacity: 0; transform: translateY(-4px) scale(0.97); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
