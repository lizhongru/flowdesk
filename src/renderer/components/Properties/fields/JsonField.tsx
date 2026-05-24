import { useState, useEffect } from 'react';
import { Braces, List } from 'lucide-react';
import KeyValueEditor from './KeyValueEditor';
import JsonCodeEditor from './JsonCodeEditor';

interface JsonFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

function isSimpleObject(json: string): boolean {
  try {
    const obj = JSON.parse(json || '{}');
    if (typeof obj !== 'object' || Array.isArray(obj)) return false;
    return Object.values(obj).every(
      v => typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean'
    );
  } catch {
    return false;
  }
}

export default function JsonField({ label, value, onChange }: JsonFieldProps) {
  const [mode, setMode] = useState<'kv' | 'json'>(() =>
    isSimpleObject(value) ? 'kv' : 'json'
  );

  // Re-detect mode when value changes externally (e.g., node selection)
  useEffect(() => {
    // Only auto-switch if user hasn't manually selected
    // Keep current mode, don't auto-switch
  }, [value]);

  const modeButton = (targetMode: 'kv' | 'json', icon: React.ReactNode, tooltip: string) => (
    <button
      onClick={() => setMode(targetMode)}
      className="p-1 rounded transition-colors"
      style={{
        color: mode === targetMode ? 'var(--accent)' : 'var(--text-muted)',
        background: mode === targetMode ? 'var(--accent)' + '18' : 'transparent',
      }}
      title={tooltip}
    >
      {icon}
    </button>
  );

  return (
    <div className="mb-3">
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </label>
        <div className="flex items-center gap-0.5 p-0.5 rounded" style={{ background: 'var(--bg-elevated)' }}>
          {modeButton('kv', <List size={11} />, '键值对模式')}
          {modeButton('json', <Braces size={11} />, 'JSON 模式')}
        </div>
      </div>

      {mode === 'kv' ? (
        <KeyValueEditor value={value} onChange={onChange} />
      ) : (
        <JsonCodeEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}
