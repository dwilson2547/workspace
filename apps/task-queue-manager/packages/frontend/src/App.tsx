import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { QueueView } from './views/QueueView';
import { WorkflowView } from './views/WorkflowView';
import { SettingsView } from './views/SettingsView';
import { useAppStore } from './store/appStore';
import { useEffect } from 'react';

function App() {
  const { initialize, isInitialized, isLoading, error } = useAppStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="card" style={{ maxWidth: 400, textAlign: 'center' }}>
          <h3 style={{ color: 'var(--color-error)', marginBottom: 'var(--space-2)' }}>
            Failed to Initialize
          </h3>
          <p className="text-secondary" style={{ marginBottom: 'var(--space-4)' }}>
            {error}
          </p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!isInitialized || isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin" style={{ width: 32, height: 32 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2">
              <circle cx="12" cy="12" r="10" strokeOpacity="0.25" />
              <path d="M12 2a10 10 0 0 1 10 10" strokeLinecap="round" />
            </svg>
          </div>
          <p className="text-secondary">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/queues" replace />} />
        <Route path="/queues" element={<QueueView />} />
        <Route path="/queues/:queueId" element={<QueueView />} />
        <Route path="/workflows" element={<WorkflowView />} />
        <Route path="/workflows/:workflowId" element={<WorkflowView />} />
        <Route path="/settings" element={<SettingsView />} />
      </Routes>
    </Layout>
  );
}

export default App;
