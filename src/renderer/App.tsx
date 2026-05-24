import { useState, useEffect, lazy, Suspense } from 'react';
import Layout from './components/Layout/Layout';
import { applyTheme, getStoredTheme } from './lib/theme-transition';

const HomePage = lazy(() => import('./pages/HomePage'));
const EditorPage = lazy(() => import('./pages/EditorPage'));
const HistoryPage = lazy(() => import('./pages/HistoryPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

export default function App() {
  const [activePage, setActivePage] = useState('home');
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | undefined>();

  // Apply stored theme on startup
  useEffect(() => {
    applyTheme(getStoredTheme());
  }, []);

  useEffect(() => {
    const splash = document.getElementById('splash');
    if (splash) {
      splash.classList.add('fade-out');
      setTimeout(() => splash.remove(), 400);
    }
  }, []);

  const handleNavigate = (page: string) => {
    setActivePage(page);
    if (page !== 'editor') {
      setEditingWorkflowId(undefined);
    }
  };

  const handleOpenEditor = (workflowId?: string) => {
    setEditingWorkflowId(workflowId);
    setActivePage('editor');
  };

  const handleBack = () => {
    setActivePage('home');
    setEditingWorkflowId(undefined);
  };

  return (
    <Layout activePage={activePage} onNavigate={handleNavigate}>
      <Suspense fallback={null}>
        {activePage === 'home' && <HomePage onOpenEditor={handleOpenEditor} />}
        {activePage === 'editor' && <EditorPage workflowId={editingWorkflowId} onBack={handleBack} />}
        {activePage === 'history' && <HistoryPage />}
        {activePage === 'settings' && <SettingsPage />}
      </Suspense>
    </Layout>
  );
}
