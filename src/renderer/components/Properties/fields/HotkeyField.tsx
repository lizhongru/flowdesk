import { useState, useRef, useEffect, useCallback } from 'react';
import { Circle } from 'lucide-react';

interface HotkeyFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  conflictWith?: string; // 冲突的工作流名称
}

// 键盘按键 → Electron Accelerator 映射
const keyMap: Record<string, string> = {
  Control: 'Ctrl',
  Meta: 'CommandOrControl',
  Alt: 'Alt',
  Shift: 'Shift',
  ArrowUp: 'Up',
  ArrowDown: 'Down',
  ArrowLeft: 'Left',
  ArrowRight: 'Right',
  ' ': 'Space',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  Delete: 'Delete',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  F1: 'F1', F2: 'F2', F3: 'F3', F4: 'F4',
  F5: 'F5', F6: 'F6', F7: 'F7', F8: 'F8',
  F9: 'F9', F10: 'F10', F11: 'F11', F12: 'F12',
  CapsLock: 'Capslock',
  NumLock: 'Numlock',
  ScrollLock: 'Scrolllock',
  PrintScreen: 'Printscreen',
};

// 按键显示名称（中文友好）
const keyDisplay: Record<string, string> = {
  CommandOrControl: 'Ctrl',
  Ctrl: 'Ctrl',
  Alt: 'Alt',
  Shift: 'Shift',
  Up: '↑',
  Down: '↓',
  Left: '←',
  Right: '→',
  Space: '空格',
  Escape: 'Esc',
  Enter: '回车',
  Tab: 'Tab',
  Backspace: '退格',
  Delete: '删除',
  Insert: 'Insert',
  Home: 'Home',
  End: 'End',
  PageUp: 'PageUp',
  PageDown: 'PageDown',
  Capslock: 'CapsLock',
  Numlock: 'NumLock',
  Scrolllock: 'ScrollLock',
  Printscreen: 'PrintScreen',
};

function toAccelerator(key: string): string {
  if (keyMap[key]) return keyMap[key];
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function formatDisplay(accelerator: string): string {
  if (!accelerator) return '';
  return accelerator.split('+').map(part => keyDisplay[part] || part).join(' + ');
}

export default function HotkeyField({ label, value, onChange, required, conflictWith }: HotkeyFieldProps) {
  const [recording, setRecording] = useState(false);
  const [pressed, setPressed] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const stopRecording = useCallback(() => {
    setRecording(false);
    setPressed(new Set());
  }, []);

  useEffect(() => {
    if (!recording) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      const key = e.key;
      const acceleratorKey = toAccelerator(key);

      // 仅按了修饰键，记录但不完成
      if (['Control', 'Meta', 'Alt', 'Shift'].includes(key)) {
        setPressed(prev => new Set(prev).add(acceleratorKey));
        return;
      }

      // 有修饰键 + 普通键 = 完成录入
      const modifiers = ['Ctrl', 'CommandOrControl', 'Alt', 'Shift'];
      const currentMods = [...pressed].filter(k => modifiers.includes(k));
      if (currentMods.length > 0) {
        const combo = [...currentMods, acceleratorKey].join('+');
        onChange(combo);
        stopRecording();
      } else {
        // 无修饰键，直接用单键
        onChange(acceleratorKey);
        stopRecording();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = e.key;
      const acceleratorKey = toAccelerator(key);
      setPressed(prev => {
        const next = new Set(prev);
        next.delete(acceleratorKey);
        return next;
      });
    };

    // 点击外部取消录制
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        stopRecording();
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('mousedown', handleClick);

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('mousedown', handleClick);
    };
  }, [recording, pressed, onChange, stopRecording]);

  const displayValue = recording
    ? (pressed.size > 0 ? [...pressed].map(k => keyDisplay[k] || k).join(' + ') + ' + ...' : '请按下快捷键...')
    : (value ? formatDisplay(value) : '');

  return (
    <div className="mb-3" ref={containerRef}>
      <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>
        {label}
        {required && <span style={{ color: 'var(--error)' }}> *</span>}
      </label>
      <div
        className="w-full px-2 py-1.5 text-xs rounded-md outline-none transition-all duration-150 cursor-pointer flex items-center gap-2"
        style={{
          background: 'var(--bg-elevated)',
          border: `1px solid ${recording ? 'var(--accent)' : 'var(--border)'}`,
          color: displayValue ? 'var(--text-primary)' : 'var(--text-muted)',
          ...(recording ? { boxShadow: '0 0 0 2px var(--accent)20' } : {}),
        }}
        onClick={() => !recording && setRecording(true)}
        tabIndex={0}
        onKeyDown={e => {
          // 防止触发编辑器快捷键
          if (recording) { e.preventDefault(); e.stopPropagation(); }
        }}
      >
        {recording && (
          <Circle
            size={8}
            className="animate-pulse flex-shrink-0"
            style={{ color: 'var(--error)', fill: 'var(--error)' }}
          />
        )}
        <span className="flex-1">
          {recording ? (displayValue || '请按下快捷键...') : (displayValue || '点击录制快捷键')}
        </span>
        {recording && (
          <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>
            Esc 取消
          </span>
        )}
      </div>
      {!recording && value && (
        <p className="text-[10px] mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
          {value}
        </p>
      )}
      {conflictWith && !recording && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>
          ⚠ 与工作流「{conflictWith}」快捷键冲突
        </p>
      )}
    </div>
  );
}
