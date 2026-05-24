import { useState, useEffect } from 'react';
import cronstrue from 'cronstrue';
import 'cronstrue/locales/zh_CN';

interface CronFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
}

export default function CronField({ label, value, onChange, placeholder, required }: CronFieldProps) {
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState<string>('');

  useEffect(() => {
    if (!value || !value.trim()) {
      setError(null);
      setDescription('');
      return;
    }

    try {
      const desc = cronstrue.toString(value, { locale: 'zh_CN', throwExceptionOnParseError: true });
      setDescription(desc);
      setError(null);
    } catch {
      setError('无效的 cron 表达式');
      setDescription('');
    }
  }, [value]);

  return (
    <div className="mb-3">
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      <input
        type="text"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || '* * * * *'}
        className="w-full px-2 py-1.5 text-xs rounded-md outline-none transition-colors font-mono"
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`,
          color: 'var(--text-primary)',
        }}
      />
      {description && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {error && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}
      {!description && !error && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
          格式: 分 时 日 月 周
        </p>
      )}
    </div>
  );
}
