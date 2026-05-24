import { useState, useEffect } from 'react';
import { Sun, Moon, Monitor, Terminal } from 'lucide-react';
import { getStoredTheme, animateThemeSwitch } from '../lib/theme-transition';

type Theme = 'dark' | 'light' | 'system';

export default function SettingsPage() {
  const [theme, setTheme] = useState<Theme>(getStoredTheme);

  const handleThemeChange = (newTheme: Theme, e: React.MouseEvent) => {
    setTheme(newTheme);
    animateThemeSwitch(newTheme, e.clientX, e.clientY);
  };

  // Listen for system theme changes when in 'system' mode
  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => animateThemeSwitch('system');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <div className="h-full overflow-auto p-6" style={{ background: 'var(--bg-primary)' }}>
      <h1 className="text-xl font-semibold mb-6" style={{ color: 'var(--text-primary)' }}>
        设置
      </h1>

      <div className="max-w-lg space-y-4">
        {/* 主题设置 */}
        <div
          className="p-4 rounded-lg"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            外观主题
          </h2>
          <div className="flex gap-2">
            {[
              { id: 'dark' as const, label: '深色', icon: Moon },
              { id: 'light' as const, label: '浅色', icon: Sun },
              { id: 'system' as const, label: '跟随系统', icon: Monitor },
            ].map((opt) => {
              const Icon = opt.icon;
              const isActive = theme === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={(e) => handleThemeChange(opt.id, e)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
                  style={{
                    background: isActive ? 'var(--accent)' + '20' : 'var(--bg-elevated)',
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  }}
                >
                  <Icon size={14} />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* 开发者工具 */}
        <div
          className="p-4 rounded-lg"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
            开发者工具
          </h2>
          <button
            onClick={() => window.api.window.toggleDevtools()}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text-secondary)',
            }}
          >
            <Terminal size={14} />
            打开控制台
          </button>
        </div>

        {/* 关于 */}
        <div
          className="p-4 rounded-lg"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        >
          <h2 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
            关于 FlowDesk
          </h2>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            版本 0.1.0
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            桌面自动化工作流引擎
          </p>
        </div>
      </div>
    </div>
  );
}
