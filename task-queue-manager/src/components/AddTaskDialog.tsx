import { useState, useMemo } from 'react';
import { TaskType, TaskCategory, TASK_CATEGORIES, TASK_META, TaskConfig, TaskTemplate } from '@/types';
import { useAppStore } from '@/store/appStore';
import { TaskConfigPanel } from './TaskConfigPanel';
import styles from './AddTaskDialog.module.css';
import clsx from 'clsx';

interface AddTaskDialogProps {
  isOpen: boolean;
  onClose: () => void;
  queueId?: string;
  workflowId?: string;
  mode: 'queue' | 'workflow';
}

type DialogStep = 'select' | 'configure';

const CATEGORY_ORDER: TaskCategory[] = [
  'custom',
  'file_operations',
  'archives',
  'media',
  'sync_transfer',
  'advanced',
  'flow_control',
];

export function AddTaskDialog({ isOpen, onClose, queueId, workflowId: _workflowId, mode }: AddTaskDialogProps) {
  const { taskTemplates, createTask } = useAppStore();
  const [step, setStep] = useState<DialogStep>('select');
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [config, setConfig] = useState<Partial<TaskConfig>>({});

  // Filter tasks by search query
  const filteredCategories = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return CATEGORY_ORDER;

    return CATEGORY_ORDER.filter((category) => {
      if (category === 'custom') {
        return taskTemplates.some(
          (t) =>
            t.name.toLowerCase().includes(query) ||
            t.description?.toLowerCase().includes(query)
        );
      }
      const tasks = TASK_CATEGORIES[category].tasks;
      return tasks.some((taskType) => {
        const meta = TASK_META[taskType];
        return (
          meta.label.toLowerCase().includes(query) ||
          meta.description.toLowerCase().includes(query)
        );
      });
    });
  }, [searchQuery, taskTemplates]);

  const getFilteredTasks = (category: TaskCategory): TaskType[] => {
    const query = searchQuery.toLowerCase().trim();
    const tasks = TASK_CATEGORIES[category].tasks;
    if (!query) return tasks;

    return tasks.filter((taskType) => {
      const meta = TASK_META[taskType];
      return (
        meta.label.toLowerCase().includes(query) ||
        meta.description.toLowerCase().includes(query)
      );
    });
  };

  const getFilteredTemplates = (): TaskTemplate[] => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return taskTemplates;

    return taskTemplates.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.description?.toLowerCase().includes(query)
    );
  };

  const handleTaskSelect = (taskType: TaskType) => {
    setSelectedType(taskType);
    setSelectedTemplate(null);
    setConfig(getDefaultConfig(taskType));
    setStep('configure');
  };

  const handleTemplateSelect = (template: TaskTemplate) => {
    setSelectedType(template.baseTask);
    setSelectedTemplate(template);
    setConfig({ ...getDefaultConfig(template.baseTask), ...template.config });
    setStep('configure');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedType(null);
    setSelectedTemplate(null);
    setConfig({});
  };

  const handleCreate = async () => {
    if (!selectedType || !queueId) return;

    try {
      await createTask(queueId, selectedType, config as TaskConfig);
      handleClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleClose = () => {
    setStep('select');
    setSelectedType(null);
    setSelectedTemplate(null);
    setSearchQuery('');
    setConfig({});
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <header className={styles.header}>
          <h2 className={styles.title}>
            {step === 'select' ? 'Add Task' : `Configure ${TASK_META[selectedType!]?.label}`}
          </h2>
          <button className={styles.closeButton} onClick={handleClose}>
            ×
          </button>
        </header>

        {step === 'select' ? (
          <div className={styles.selectStep}>
            <div className={styles.searchContainer}>
              <span className={styles.searchIcon}>🔍</span>
              <input
                type="text"
                className={styles.searchInput}
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
              {searchQuery && (
                <button
                  className={styles.clearSearch}
                  onClick={() => setSearchQuery('')}
                >
                  ×
                </button>
              )}
            </div>

            <div className={styles.categoriesContainer}>
              {filteredCategories.map((category) => {
                if (category === 'custom') {
                  const templates = getFilteredTemplates();
                  if (templates.length === 0 && taskTemplates.length === 0) {
                    return (
                      <div key={category} className={styles.category}>
                        <h3 className={styles.categoryTitle}>
                          {TASK_CATEGORIES[category].label}
                        </h3>
                        <div className={styles.taskGrid}>
                          <button
                            className={clsx(styles.taskCard, styles.createTemplate)}
                            onClick={() => {/* TODO: Open template creator */}}
                          >
                            <span className={styles.taskIcon}>➕</span>
                            <span className={styles.taskLabel}>Create Template</span>
                          </button>
                        </div>
                      </div>
                    );
                  }
                  if (templates.length === 0) return null;

                  return (
                    <div key={category} className={styles.category}>
                      <h3 className={styles.categoryTitle}>
                        {TASK_CATEGORIES[category].label}
                      </h3>
                      <div className={styles.taskGrid}>
                        {templates.map((template) => (
                          <button
                            key={template.id}
                            className={styles.taskCard}
                            onClick={() => handleTemplateSelect(template)}
                            title={template.description}
                          >
                            <span className={styles.taskIcon}>
                              {template.icon || TASK_META[template.baseTask].icon}
                            </span>
                            <span className={styles.taskLabel}>{template.name}</span>
                          </button>
                        ))}
                        <button
                          className={clsx(styles.taskCard, styles.createTemplate)}
                          onClick={() => {/* TODO: Open template creator */}}
                        >
                          <span className={styles.taskIcon}>➕</span>
                          <span className={styles.taskLabel}>Create New</span>
                        </button>
                      </div>
                    </div>
                  );
                }

                const tasks = getFilteredTasks(category);
                if (tasks.length === 0) return null;

                return (
                  <div key={category} className={styles.category}>
                    <h3 className={styles.categoryTitle}>
                      {TASK_CATEGORIES[category].label}
                    </h3>
                    <div className={styles.taskGrid}>
                      {tasks.map((taskType) => {
                        const meta = TASK_META[taskType];
                        return (
                          <button
                            key={taskType}
                            className={styles.taskCard}
                            onClick={() => handleTaskSelect(taskType)}
                            title={meta.description}
                          >
                            <span className={styles.taskIcon}>{meta.icon}</span>
                            <span className={styles.taskLabel}>{meta.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className={styles.configureStep}>
            <TaskConfigPanel
              taskType={selectedType!}
              config={config}
              onChange={setConfig}
              template={selectedTemplate}
              mode={mode}
            />

            <footer className={styles.footer}>
              <button className={styles.backButton} onClick={handleBack}>
                ← Back
              </button>
              <div className={styles.footerActions}>
                <button className={styles.cancelButton} onClick={handleClose}>
                  Cancel
                </button>
                <button className={styles.createButton} onClick={handleCreate}>
                  {mode === 'queue' ? 'Add Task' : 'Add to Pipeline'}
                </button>
              </div>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}

// Default configurations for each task type
function getDefaultConfig(taskType: TaskType): Partial<TaskConfig> {
  switch (taskType) {
    case 'copy':
      return {
        sourcePath: '',
        destinationPath: '',
        overwrite: false,
        preserveTimestamps: true,
        passThrough: 'copy',
      };
    case 'move':
      return {
        sourcePath: '',
        destinationPath: '',
        overwrite: false,
      };
    case 'rename':
      return {
        sourcePath: '',
        pattern: '',
        replacement: '',
      };
    case 'delete':
      return {
        sourcePath: '',
        permanent: false,
      };
    case 'extract':
      return {
        sourcePath: '',
        destinationPath: '',
      };
    case 'archive':
      return {
        sourcePaths: [],
        destinationPath: '',
        format: 'zip',
        zipCompression: 'deflate',
        compressionLevel: 6,
        cpuUsage: 'fast',
      };
    case 'transcode':
      return {
        sourcePath: '',
        destinationPath: '',
        videoCodec: 'libx264',
        audioCodec: 'aac',
        preset: 'medium',
        crf: 23,
        audioBitrate: '192k',
        cpuUsage: 'fast',
      };
    case 'download':
      return {
        urls: [],
        headerPresetIds: [],
        customHeaders: {},
        authentication: { type: 'none' },
        followRedirects: true,
        maxRedirects: 10,
        timeout: 30,
        retryAttempts: 3,
        retryDelay: 5,
        resumePartialDownloads: true,
        maxConcurrent: 3,
        outputDirectory: '',
        outputTemplate: '{filename}',
        overwriteExisting: 'skip',
      };
    case 'shell_command':
      return {
        command: '',
        workingDirectory: '',
        environment: {},
        timeout: 0,
      };
    case 'script':
      return {
        scriptPath: '',
        arguments: [],
        workingDirectory: '',
      };
    case 'http_request':
      return {
        url: '',
        method: 'GET',
        headers: {},
        body: '',
      };
    case 'filter':
      return {
        condition: '',
        matchAction: 'continue',
        noMatchAction: 'skip',
      };
    case 'wait':
      return {
        duration: 1000,
      };
    case 'branch':
      return {
        condition: '',
        trueBranch: [],
        falseBranch: [],
      };
    default:
      return {};
  }
}
