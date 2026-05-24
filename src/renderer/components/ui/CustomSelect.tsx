import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface CustomSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  placeholder?: string;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function CustomSelect({
  value,
  onChange,
  options,
  placeholder = '请选择',
  compact = false,
  className = '',
  style,
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value);

  const updatePos = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    let left = rect.left;
    const width = rect.width;
    if (left + width > window.innerWidth - 8) {
      left = window.innerWidth - width - 8;
    }
    if (left < 8) left = 8;
    setPos({ top: rect.bottom + 2, left, width });
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    updatePos();
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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

  const triggerStyle: React.CSSProperties = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: selected ? 'var(--text-primary)' : 'var(--text-muted)',
    ...style,
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between rounded-md outline-none
          transition-all duration-150
          ${compact ? 'px-1.5 py-1 text-[10px]' : 'px-2 py-1.5 text-xs'}
          ${isOpen ? 'ring-1 ring-[var(--accent)]/40' : ''}
        `}
        style={triggerStyle}
      >
        <span className="truncate">{selected?.label || placeholder}</span>
        <ChevronDown
          size={compact ? 10 : 12}
          className="flex-shrink-0 ml-1 transition-transform duration-200"
          style={{
            color: 'var(--text-muted)',
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </button>

      {isOpen && (
        <div
          className="fixed z-[999] rounded-lg shadow-xl overflow-hidden"
          style={{
            top: pos.top,
            left: pos.left,
            width: pos.width,
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            animation: 'dropdownIn 0.15s ease-out',
          }}
        >
          <div className="py-0.5 max-h-48 overflow-y-auto">
            {options.map(opt => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  className={`
                    w-full flex items-center justify-between
                    transition-colors duration-100
                    ${compact ? 'px-2 py-1.5 text-[10px]' : 'px-2.5 py-2 text-xs'}
                  `}
                  style={{
                    color: isSelected ? 'var(--accent)' : 'var(--text-primary)',
                    background: isSelected ? 'var(--accent)' + '10' : 'transparent',
                  }}
                  onMouseEnter={e => {
                    if (!isSelected) e.currentTarget.style.background = 'var(--bg-surface)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = isSelected ? 'var(--accent)' + '10' : 'transparent';
                  }}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={compact ? 10 : 12} className="flex-shrink-0 ml-2" />}
                </button>
              );
            })}
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
