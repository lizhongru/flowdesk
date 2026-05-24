import { useState, useEffect, useRef, useCallback } from 'react';
import { AlignLeft, Minus } from 'lucide-react';

interface JsonCodeEditorProps {
  value: string;
  onChange: (value: string) => void;
}

function highlightJson(json: string): string {
  // Escape HTML
  let html = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Preserve {{variable}} templates
  const templates: string[] = [];
  html = html.replace(/\{\{[^}]*\}\}/g, (match) => {
    templates.push(match);
    return `__TPL_${templates.length - 1}__`;
  });

  // Highlight JSON syntax
  // Strings (keys and values)
  html = html.replace(
    /("(?:[^"\\]|\\.)*")/g,
    (match) => {
      // Check if it's a key (followed by :)
      return `<span style="color:#9cdcfe">${match}</span>`;
    }
  );
  // Re-color keys specifically (strings followed by colon)
  html = html.replace(
    /<span style="color:#9cdcfe">("(?:[^"\\]|\\.)*")<\/span>\s*:/g,
    '<span style="color:#6cb6ff">$1</span>:'
  );
  // Numbers
  html = html.replace(
    /\b(-?\d+\.?\d*(?:[eE][+-]?\d+)?)\b/g,
    '<span style="color:#d19a66">$1</span>'
  );
  // Booleans and null
  html = html.replace(
    /\b(true|false|null)\b/g,
    '<span style="color:#c678dd">$1</span>'
  );

  // Restore templates
  html = html.replace(/__TPL_(\d+)__/g, (_, i) => {
    return `<span style="color:#e5c07b">${templates[Number(i)]}</span>`;
  });

  return html;
}

function validateJson(json: string): { valid: boolean; error?: string } {
  if (!json.trim()) return { valid: true };

  // Replace {{...}} templates with valid placeholders for validation
  const sanitized = json.replace(/\{\{[^}]*\}\}/g, '"__placeholder__"');

  try {
    JSON.parse(sanitized);
    return { valid: true };
  } catch (e) {
    const msg = (e as Error).message;
    // Extract position info
    const posMatch = msg.match(/position\s+(\d+)/i);
    if (posMatch) {
      const pos = Number(posMatch[1]);
      const line = json.substring(0, pos).split('\n').length;
      return { valid: false, error: `第 ${line} 行: ${msg}` };
    }
    return { valid: false, error: msg };
  }
}

const HIGHLIGHT_MAX = 8000; // 超过此长度跳过高亮，避免卡顿

export default function JsonCodeEditor({ value, onChange }: JsonCodeEditorProps) {
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  // 防抖校验：避免每次按键都 JSON.parse
  useEffect(() => {
    const timer = setTimeout(() => {
      const result = validateJson(value);
      setError(result.valid ? null : result.error || 'JSON 格式错误');
    }, 300);
    return () => clearTimeout(timer);
  }, [value]);

  const handleFormat = useCallback(() => {
    try {
      const sanitized = value.replace(/\{\{[^}]*\}\}/g, '"__placeholder__"');
      const obj = JSON.parse(sanitized);
      let formatted = JSON.stringify(obj, null, 2);
      const templates = value.match(/\{\{[^}]*\}\}/g) || [];
      formatted = formatted.replace(/"__placeholder__"/g, () => templates.shift() || '"__placeholder__"');
      onChange(formatted);
    } catch {
      // Can't format invalid JSON
    }
  }, [value, onChange]);

  const handleMinify = useCallback(() => {
    try {
      const sanitized = value.replace(/\{\{[^}]*\}\}/g, '"__placeholder__"');
      const obj = JSON.parse(sanitized);
      let minified = JSON.stringify(obj);
      const templates = value.match(/\{\{[^}]*\}\}/g) || [];
      minified = minified.replace(/"__placeholder__"/g, () => templates.shift() || '"__placeholder__"');
      onChange(minified);
    } catch {
      // Can't minify invalid JSON
    }
  }, [value, onChange]);

  const handleScroll = () => {
    if (highlightRef.current && textareaRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end } = ta;
    const before = value.slice(0, start);
    const after = value.slice(end);

    const pairs: Record<string, string> = { '{': '}', '[': ']', '"': '"', "'": "'" };
    const closing = pairs[e.key];

    // Auto-close brackets and quotes
    if (closing && !e.ctrlKey && !e.metaKey) {
      // If there's a selection, wrap it
      if (start !== end) {
        e.preventDefault();
        const selected = value.slice(start, end);
        const newVal = before + e.key + selected + closing + after;
        onChange(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = start + 1;
          ta.selectionEnd = end + 1;
        });
        return;
      }
      // Skip closing if next char is the same closing char
      if (after[0] === closing) {
        e.preventDefault();
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 1;
        });
        return;
      }
      e.preventDefault();
      const newVal = before + e.key + closing + after;
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1;
      });
      return;
    }

    // Enter key — auto-indent and expand
    if (e.key === 'Enter') {
      e.preventDefault();
      const lineStart = before.lastIndexOf('\n') + 1;
      const currentLine = before.slice(lineStart);
      const indentMatch = currentLine.match(/^(\s*)/);
      const currentIndent = indentMatch ? indentMatch[1] : '';
      const charBefore = before.slice(-1);
      const charAfter = after[0];

      // Inside empty braces/brackets: expand
      if ((charBefore === '{' && charAfter === '}') || (charBefore === '[' && charAfter === ']')) {
        const open = charBefore;
        const close = charAfter;
        const innerIndent = currentIndent + '  ';
        const newVal = before + '\n' + innerIndent + '\n' + currentIndent + close;
        onChange(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 1 + innerIndent.length;
        });
        return;
      }

      // After colon: add space
      if (charBefore === ':') {
        const newVal = before + ' ' + after;
        onChange(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
        return;
      }

      // Default: new line with same indent
      const newVal = before + '\n' + currentIndent + after;
      onChange(newVal);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 1 + currentIndent.length;
      });
      return;
    }

    // Tab key — indent/unindent
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Unindent current line
        const lineStart = before.lastIndexOf('\n') + 1;
        const lineIndent = value.slice(lineStart, lineStart + 2);
        if (lineIndent === '  ') {
          const newVal = value.slice(0, lineStart) + value.slice(lineStart + 2);
          onChange(newVal);
          requestAnimationFrame(() => {
            ta.selectionStart = ta.selectionEnd = Math.max(lineStart, start - 2);
          });
        }
      } else {
        const newVal = before + '  ' + after;
        onChange(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start + 2;
        });
      }
      return;
    }

    // Backspace — delete matching pair
    if (e.key === 'Backspace' && start === end) {
      const charBefore = before.slice(-1);
      const charAfter = after[0];
      const matchPairs: Record<string, string> = { '{': '}', '[': ']', '"': '"', "'": "'" };
      if (matchPairs[charBefore] === charAfter) {
        e.preventDefault();
        const newVal = before.slice(0, -1) + after.slice(1);
        onChange(newVal);
        requestAnimationFrame(() => {
          ta.selectionStart = ta.selectionEnd = start - 1;
        });
        return;
      }
    }
  };

  const editorStyle = {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    caretColor: 'var(--text-primary)',
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center gap-1 mb-1">
        <button
          onClick={handleFormat}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          title="格式化"
        >
          <AlignLeft size={9} /> 格式化
        </button>
        <button
          onClick={handleMinify}
          className="flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] rounded transition-colors hover:opacity-80"
          style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
          title="压缩"
        >
          <Minus size={9} /> 压缩
        </button>
      </div>

      {/* Editor with syntax highlight overlay */}
      <div className="relative rounded-md overflow-hidden" style={{ border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}` }}>
        <pre
          ref={highlightRef}
          className="absolute inset-0 px-2 py-1.5 text-xs font-mono pointer-events-none overflow-auto whitespace-pre-wrap break-words m-0"
          style={{ ...editorStyle, border: 'none' }}
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: (value && value.length > HIGHLIGHT_MAX ? (value || '{}') : highlightJson(value || '{}')) + '\n' }}
        />
        <textarea
          ref={textareaRef}
          value={value || '{}'}
          onChange={e => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          rows={6}
          spellCheck={false}
          className="w-full px-2 py-1.5 text-xs font-mono outline-none resize-none relative"
          style={{ ...editorStyle, background: 'transparent', caretColor: 'var(--text-primary)' }}
        />
      </div>

      {/* Error message */}
      {error && (
        <p className="text-[10px] mt-1" style={{ color: 'var(--error)' }}>
          {error}
        </p>
      )}
    </div>
  );
}
