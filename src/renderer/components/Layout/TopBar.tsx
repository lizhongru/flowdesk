import { Minus, Square, X } from 'lucide-react';
import iconSrc from '../../assets/icon.png';

const isMac = navigator.platform.includes('Mac');

export default function TopBar() {
  return (
    <div
      className="titlebar-drag flex items-center justify-between h-10 px-4 select-none"
      style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)' }}
    >
      <div className={`flex items-center gap-2 ${isMac ? 'pl-[68px]' : ''}`}>
        <img src={iconSrc} alt="FlowDesk" className="w-5 h-5" />
        <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>
          FlowDesk
        </span>
      </div>

      {!isMac && (
        <div className="titlebar-no-drag flex items-center gap-1">
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
        </div>
      )}
    </div>
  );
}
