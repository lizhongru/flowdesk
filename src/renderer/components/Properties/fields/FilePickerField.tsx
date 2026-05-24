import { FolderOpen } from 'lucide-react';

interface FilePickerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}

export default function FilePickerField({ label, value, onChange, required }: FilePickerFieldProps) {
  const handlePick = async () => {
    const result = await window.api.file.showOpenDialog({
      properties: ['openFile', 'openDirectory'],
    });
    if (result) {
      onChange(result);
    }
  };

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      <div className="flex gap-1">
        <input
          type="text"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-2 py-1.5 text-xs rounded-md outline-none transition-colors"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
          }}
        />
        <button
          onClick={handlePick}
          className="px-2 py-1.5 rounded-md transition-colors"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
        >
          <FolderOpen size={14} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </div>
  );
}
