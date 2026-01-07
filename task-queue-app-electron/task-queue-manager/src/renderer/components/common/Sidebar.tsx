import React from 'react';
import { useAppStore } from '../../stores/appStore';
import { 
  LayoutDashboard, 
  ListTodo, 
  History, 
  Settings, 
  Plus,
  ChevronLeft,
  ChevronRight,
  Workflow,
  FolderKanban
} from 'lucide-react';

interface SidebarProps {
  onCreateQueue: () => void;
}

export default function Sidebar({ onCreateQueue }: SidebarProps) {
  const { 
    queues, 
    activeTab, 
    sidebarCollapsed, 
    selectedQueueId,
    setActiveTab, 
    toggleSidebar,
    setSelectedQueueId
  } = useAppStore();

  const navItems = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'history' as const, label: 'History', icon: History },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tab: typeof activeTab) => {
    setActiveTab(tab);
    setSelectedQueueId(null);
  };

  return (
    <aside 
      className={`
        flex flex-col bg-surface-darker border-r border-surface-light
        transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-surface-light">
        {!sidebarCollapsed && (
          <div className="flex items-center gap-2">
            <FolderKanban className="w-6 h-6 text-cyan-400" />
            <h1 className="text-lg font-bold text-cyan-400">TaskQueue</h1>
          </div>
        )}
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-surface-light transition-colors"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronLeft className="w-5 h-5 text-gray-400" />
          )}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {/* Main nav */}
        <div className="space-y-1 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id && !selectedQueueId;
            
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`
                  w-full flex items-center gap-3 px-3 py-2.5 rounded-lg
                  transition-all duration-200
                  ${isActive 
                    ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' 
                    : 'text-gray-400 hover:bg-surface-light hover:text-gray-200'
                  }
                `}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-cyan-400' : ''}`} />
                {!sidebarCollapsed && (
                  <span className="font-medium">{item.label}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Queues section */}
        <div className="mt-6 pt-4 border-t border-surface-light">
          <div className="px-4 mb-2 flex items-center justify-between">
            {!sidebarCollapsed && (
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Queues & Workflows
              </span>
            )}
            <button
              onClick={onCreateQueue}
              className="p-1 rounded hover:bg-surface-light transition-colors"
              title="Create new queue"
            >
              <Plus className="w-4 h-4 text-cyan-400" />
            </button>
          </div>
          
          <div className="space-y-1 px-2 max-h-[40vh] overflow-y-auto">
            {queues.map((queue) => {
              const isSelected = selectedQueueId === queue.id;
              const isWorkflow = queue.type === 'workflow';
              
              return (
                <button
                  key={queue.id}
                  onClick={() => setSelectedQueueId(queue.id)}
                  className={`
                    w-full flex items-center gap-3 px-3 py-2 rounded-lg
                    transition-all duration-200
                    ${isSelected
                      ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                      : 'text-gray-400 hover:bg-surface-light hover:text-gray-200'
                    }
                  `}
                  title={sidebarCollapsed ? queue.name : undefined}
                >
                  {isWorkflow ? (
                    <Workflow className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-purple-400'}`} />
                  ) : (
                    <ListTodo className={`w-4 h-4 shrink-0 ${isSelected ? 'text-cyan-400' : 'text-emerald-400'}`} />
                  )}
                  {!sidebarCollapsed && (
                    <div className="flex-1 min-w-0 text-left">
                      <span className="block truncate text-sm">{queue.name}</span>
                      <span className={`
                        text-xs capitalize
                        ${queue.status === 'running' ? 'text-emerald-400' : 
                          queue.status === 'paused' ? 'text-amber-400' : 'text-gray-500'}
                      `}>
                        {queue.status}
                      </span>
                    </div>
                  )}
                  {sidebarCollapsed && (
                    <span className={`
                      w-2 h-2 rounded-full shrink-0
                      ${queue.status === 'running' ? 'bg-emerald-400 animate-pulse' : 
                        queue.status === 'paused' ? 'bg-amber-400' : 'bg-gray-600'}
                    `} />
                  )}
                </button>
              );
            })}
            
            {queues.length === 0 && !sidebarCollapsed && (
              <p className="text-gray-500 text-sm px-3 py-2">
                No queues yet. Create one to get started.
              </p>
            )}
          </div>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-surface-light">
        {!sidebarCollapsed && (
          <div className="text-xs text-gray-500">
            <p>Task Queue Manager v1.0.0</p>
          </div>
        )}
      </div>
    </aside>
  );
}
