import React, { useState } from 'react';
import { useCreateQueue } from '../../hooks/useApi';
import { X, ListTodo, Workflow } from 'lucide-react';
import { QueueType } from '@shared/types';

interface CreateQueueModalProps {
  onClose: () => void;
}

export default function CreateQueueModal({ onClose }: CreateQueueModalProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<QueueType>('queue');
  
  const createQueue = useCreateQueue();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    try {
      await createQueue.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        type,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create queue:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-darker border border-surface-light rounded-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-light">
          <h2 className="text-lg font-semibold text-gray-100">Create New Queue</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-light transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Type selection */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('queue')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${type === 'queue'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-surface-light hover:border-surface-lighter bg-surface-dark'
                  }
                `}
              >
                <div className={`p-2 rounded-lg ${type === 'queue' ? 'bg-emerald-500/20' : 'bg-surface-light'}`}>
                  <ListTodo className={`w-5 h-5 ${type === 'queue' ? 'text-emerald-400' : 'text-gray-400'}`} />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${type === 'queue' ? 'text-emerald-400' : 'text-gray-300'}`}>
                    Task Queue
                  </p>
                  <p className="text-xs text-gray-500">
                    Tasks removed after completion
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('workflow')}
                className={`
                  flex items-center gap-3 p-4 rounded-xl border-2 transition-all
                  ${type === 'workflow'
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-surface-light hover:border-surface-lighter bg-surface-dark'
                  }
                `}
              >
                <div className={`p-2 rounded-lg ${type === 'workflow' ? 'bg-purple-500/20' : 'bg-surface-light'}`}>
                  <Workflow className={`w-5 h-5 ${type === 'workflow' ? 'text-purple-400' : 'text-gray-400'}`} />
                </div>
                <div className="text-left">
                  <p className={`font-medium ${type === 'workflow' ? 'text-purple-400' : 'text-gray-300'}`}>
                    Workflow
                  </p>
                  <p className="text-xs text-gray-500">
                    Persistent, repeatable tasks
                  </p>
                </div>
              </button>
            </div>
          </div>

          {/* Name input */}
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-2">
              Name
            </label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${type === 'workflow' ? 'Workflow' : 'Queue'}`}
              className="
                w-full px-4 py-3 rounded-xl
                bg-surface-dark border border-surface-light
                text-gray-100 placeholder-gray-500
                focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
                transition-all
              "
              autoFocus
            />
          </div>

          {/* Description input */}
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-2">
              Description <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What does this queue do?"
              rows={3}
              className="
                w-full px-4 py-3 rounded-xl
                bg-surface-dark border border-surface-light
                text-gray-100 placeholder-gray-500
                focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
                transition-all resize-none
              "
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-surface-light transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim() || createQueue.isPending}
              className="
                px-6 py-2.5 rounded-lg font-semibold
                bg-cyan-500 hover:bg-cyan-400 text-surface-dark
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-all
              "
            >
              {createQueue.isPending ? 'Creating...' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
