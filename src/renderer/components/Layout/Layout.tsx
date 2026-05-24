import { type ReactNode } from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';

interface LayoutProps {
  activePage: string;
  onNavigate: (page: string) => void;
  children: ReactNode;
}

export default function Layout({ activePage, onNavigate, children }: LayoutProps) {
  return (
    <div className="h-screen flex flex-col">
      <TopBar />
      <div className="flex flex-1 overflow-hidden main-content">
        <Sidebar activePage={activePage} onNavigate={onNavigate} />
        <main className="flex-1 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  );
}
