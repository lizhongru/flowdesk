import { Workflow, ScrollText, Settings } from 'lucide-react';

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
}

export default function Sidebar({ activePage, onNavigate }: SidebarProps) {
  const items = [
    { id: 'home', label: '工作流', icon: Workflow },
    { id: 'history', label: '执行历史', icon: ScrollText },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <div
      className="w-14 flex flex-col items-center py-4 gap-2"
      style={{ background: 'var(--bg-secondary)', borderRight: '1px solid var(--border)' }}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activePage === item.id;
        return (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className="w-10 h-10 flex items-center justify-center rounded-lg transition-colors"
            style={{
              background: isActive ? 'var(--accent)' + '20' : 'transparent',
              color: isActive ? 'var(--accent)' : 'var(--text-muted)',
            }}
            title={item.label}
          >
            <Icon size={20} />
          </button>
        );
      })}
    </div>
  );
}
