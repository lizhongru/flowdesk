import { Minus, Square, X } from 'lucide-react';

const isMac = navigator.platform.includes('Mac');

export default function TopBar() {
  return (
    <div
      className="titlebar-drag flex items-center justify-between h-10 px-4 select-none"
      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
    >
      {!isMac && (
        <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
          FlowDesk
        </span>
      )}
      {isMac && <div />}

      <div className="titlebar-no-drag flex items-center gap-1">
        {!isMac && (
          <>
            <button
              onClick={() => window.api?.window?.minimize()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            >
              <Minus size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={() => window.api?.window?.maximize()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 transition-colors"
            >
              <Square size={12} style={{ color: 'var(--text-secondary)' }} />
            </button>
            <button
              onClick={() => window.api?.window?.close()}
              className="w-8 h-8 flex items-center justify-center rounded hover:bg-red-500/80 transition-colors"
            >
              <X size={14} style={{ color: 'var(--text-secondary)' }} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
