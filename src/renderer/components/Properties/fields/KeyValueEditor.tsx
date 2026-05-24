import { useState, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import CustomSelect from '../../ui/CustomSelect';

interface KeyValueRow {
  id: number;
  key: string;
  value: string;
  type: 'string' | 'number' | 'boolean';
}

interface KeyValueEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function parseJsonToRows(json: string): KeyValueRow[] {
  try {
    const obj = JSON.parse(json || '{}');
    if (typeof obj !== 'object' || Array.isArray(obj)) return [];
    return Object.entries(obj).map(([key, val], i) => {
      let type: 'string' | 'number' | 'boolean' = 'string';
      let strVal = String(val);
      if (typeof val === 'number') { type = 'number'; }
      else if (typeof val === 'boolean') { type = 'boolean'; strVal = String(val); }
      return { id: i, key, value: strVal, type };
    });
  } catch {
    return [];
  }
}

function rowsToJson(rows: KeyValueRow[]): string {
  const obj: Record<string, unknown> = {};
  for (const row of rows) {
    if (!row.key.trim()) continue;
    if (row.type === 'number') {
      const n = Number(row.value);
      obj[row.key] = isNaN(n) ? row.value : n;
    } else if (row.type === 'boolean') {
      obj[row.key] = row.value === 'true';
    } else {
      obj[row.key] = row.value;
    }
  }
  return JSON.stringify(obj, null, 2);
}

export default function KeyValueEditor({ value, onChange }: KeyValueEditorProps) {
  const [rows, setRows] = useState<KeyValueRow[]>([]);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    const parsed = parseJsonToRows(value);
    setRows(parsed);
    setNextId(parsed.length);
  }, []);

  const updateRows = (newRows: KeyValueRow[]) => {
    setRows(newRows);
    onChange(rowsToJson(newRows));
  };

  const addRow = () => {
    const newRows = [...rows, { id: nextId, key: '', value: '', type: 'string' as const }];
    setNextId(nextId + 1);
    updateRows(newRows);
  };

  const removeRow = (id: number) => {
    updateRows(rows.filter(r => r.id !== id));
  };

  const updateRow = (id: number, field: keyof KeyValueRow, val: string) => {
    updateRows(rows.map(r => r.id === id ? { ...r, [field]: val } : r));
  };

  const inputStyle = {
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    color: 'var(--text-primary)',
  };

  if (rows.length === 0) {
    return (
      <div>
        <p className="text-[10px] mb-2" style={{ color: 'var(--text-muted)' }}>
          空对象 — 点击下方添加键值对
        </p>
        <button
          onClick={addRow}
          className="flex items-center gap-1 px-2 py-1 text-[10px] rounded transition-colors"
          style={{ color: 'var(--accent)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <Plus size={10} /> 添加
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="space-y-1.5">
        {rows.map(row => (
          <div key={row.id} className="flex items-center gap-1">
            <input
              value={row.key}
              onChange={e => updateRow(row.id, 'key', e.target.value)}
              placeholder="key"
              className="flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded outline-none font-mono"
              style={inputStyle}
            />
            <CustomSelect
              compact
              value={row.type}
              onChange={val => updateRow(row.id, 'type', val)}
              options={[
                { label: 'str', value: 'string' },
                { label: 'num', value: 'number' },
                { label: 'bool', value: 'boolean' },
              ]}
              style={{ minWidth: '52px', width: '52px' }}
            />
            {row.type === 'boolean' ? (
              <CustomSelect
                compact
                value={row.value}
                onChange={val => updateRow(row.id, 'value', val)}
                options={[
                  { label: 'true', value: 'true' },
                  { label: 'false', value: 'false' },
                ]}
                className="flex-1 min-w-0"
              />
            ) : (
              <input
                value={row.value}
                onChange={e => updateRow(row.id, 'value', e.target.value)}
                placeholder="value"
                className="flex-1 min-w-0 px-1.5 py-1 text-[11px] rounded outline-none font-mono"
                style={inputStyle}
              />
            )}
            <button
              onClick={() => removeRow(row.id)}
              className="p-1 rounded hover:bg-red-500/20 transition-colors flex-shrink-0"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 size={10} />
            </button>
          </div>
        ))}
      </div>
      <button
        onClick={addRow}
        className="flex items-center gap-1 px-2 py-1 mt-2 text-[10px] rounded transition-colors"
        style={{ color: 'var(--accent)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
      >
        <Plus size={10} /> 添加
      </button>
    </div>
  );
}
