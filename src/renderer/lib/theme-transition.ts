type Theme = 'dark' | 'light' | 'system';

function resolveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

export function getStoredTheme(): Theme {
  const stored = localStorage.getItem('flowdesk-theme');
  if (stored === 'dark' || stored === 'light' || stored === 'system') return stored;
  return 'dark';
}

export function applyTheme(theme: Theme) {
  const resolved = resolveTheme(theme);
  document.documentElement.setAttribute('data-theme', resolved);
}

const BG_COLORS = { dark: '#0f1117', light: '#f5f6fa' };

function maxRadius(x: number, y: number): number {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  return Math.hypot(Math.max(x, vw - x), Math.max(y, vh - y));
}

// —— View Transitions API + clip-path 圆形扩散 ——
function transitionWithVT(newTheme: 'dark' | 'light', x: number, y: number) {
  const root = document.documentElement;
  root.style.setProperty('--cx', x + 'px');
  root.style.setProperty('--cy', y + 'px');
  root.style.setProperty('--max-r', maxRadius(x, y) + 'px');

  (document as any).startViewTransition(() => {
    applyTheme(newTheme);
    localStorage.setItem('flowdesk-theme', newTheme);
  });
}

// —— 降级：clip-path 手动动画 ——
function transitionWithFallback(newTheme: 'dark' | 'light', x: number, y: number) {
  // 新主题背景色遮罩从点击位置圆形扩大，铺满后切主题
  const mask = document.createElement('div');
  Object.assign(mask.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    pointerEvents: 'none',
    background: BG_COLORS[newTheme],
    clipPath: `circle(0px at ${x}px ${y}px)`,
  });
  document.body.appendChild(mask);

  const maxR = maxRadius(x, y);
  const duration = 450;
  let start: number | null = null;

  function frame(ts: number) {
    if (!start) start = ts;
    const t = Math.min((ts - start) / duration, 1);
    const ease = 1 - Math.pow(1 - t, 3);
    mask.style.clipPath = `circle(${ease * maxR}px at ${x}px ${y}px)`;

    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      applyTheme(newTheme);
      localStorage.setItem('flowdesk-theme', newTheme);
      mask.remove();
    }
  }
  requestAnimationFrame(frame);
}

export function animateThemeSwitch(newTheme: Theme, originX?: number, originY?: number) {
  const resolved = resolveTheme(newTheme);
  const current = document.documentElement.getAttribute('data-theme');
  if (resolved === current) return;

  const x = originX ?? window.innerWidth;
  const y = originY ?? 0;

  // 尊重系统设置
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    applyTheme(newTheme);
    localStorage.setItem('flowdesk-theme', newTheme);
    return;
  }

  // 优先 View Transitions API
  if (typeof (document as any).startViewTransition === 'function') {
    transitionWithVT(resolved, x, y);
    return;
  }

  // 降级 clip-path 动画
  transitionWithFallback(resolved, x, y);
}
