import React, { useEffect, useState } from 'react';
import { useAppStore } from './stores/appStore';
import { useQueues, useElectronEvents } from './hooks/useApi';
import Sidebar from './components/common/Sidebar';
import Dashboard from './components/dashboard/Dashboard';
import QueueDetail from './components/queues/QueueDetail';
import History from './components/history/History';
import Settings from './components/settings/Settings';
import CreateQueueModal from './components/modals/CreateQueueModal';
import CreateTaskModal from './components/modals/CreateTaskModal';

export default function App() {
  const { activeTab, selectedQueueId } = useAppStore();
  const [showCreateQueue, setShowCreateQueue] = useState(false);
  const [showCreateTask, setShowCreateTask] = useState(false);
  
  // Set up event listeners
  useElectronEvents();
  
  // Load queues on mount
  const { isLoading, error } = useQueues();

  const renderContent = () => {
    if (selectedQueueId) {
      return (
        <QueueDetail 
          onAddTask={() => setShowCreateTask(true)}
          onBack={() => useAppStore.getState().setSelectedQueueId(null)}
        />
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard onCreateQueue={() => setShowCreateQueue(true)} />;
      case 'history':
        return <History />;
      case 'settings':
        return <Settings />;
      default:
        return <Dashboard onCreateQueue={() => setShowCreateQueue(true)} />;
    }
  };

  return (
    <div className="flex h-screen bg-surface-dark text-gray-100 overflow-hidden">
      <Sidebar onCreateQueue={() => setShowCreateQueue(true)} />
      
      <main className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-cyan-500" />
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-red-400 text-center">
              <p className="text-xl mb-2">Error loading queues</p>
              <p className="text-sm opacity-75">{error.message}</p>
            </div>
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Modals */}
      {showCreateQueue && (
        <CreateQueueModal onClose={() => setShowCreateQueue(false)} />
      )}
      
      {showCreateTask && selectedQueueId && (
        <CreateTaskModal 
          queueId={selectedQueueId}
          onClose={() => setShowCreateTask(false)} 
        />
      )}
    </div>
  );
}
