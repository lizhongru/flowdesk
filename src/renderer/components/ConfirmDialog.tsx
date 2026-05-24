import { useEffect, useRef } from 'react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  onConfirm?: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  message,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }}
      onClick={(e) => { if (e.target === backdropRef.current) onCancel(); }}
    >
      <div
        className="rounded-lg shadow-xl p-5 w-80"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--border)',
          animation: 'dialogIn 0.15s ease-out',
        }}
      >
        <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
          {title}
        </h3>
        <p className="text-xs mb-5" style={{ color: 'var(--text-secondary)' }}>
          {message}
        </p>
        <div className="flex justify-end gap-2">
          {onConfirm ? (
            <>
              <button
                onClick={onCancel}
                className="px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                autoFocus
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{
                  background: danger ? 'var(--error)' : 'var(--accent)',
                  color: '#fff',
                }}
              >
                {confirmText}
              </button>
            </>
          ) : (
            <button
              onClick={onCancel}
              autoFocus
              className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
              style={{ background: 'var(--accent)', color: '#fff' }}
            >
              {cancelText || '知道了'}
            </button>
          )}
        </div>
      </div>
      <style>{`
        @keyframes dialogIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
