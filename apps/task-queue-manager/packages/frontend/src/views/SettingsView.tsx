import { useAppStore } from '@/store/appStore';
import styles from './SettingsView.module.css';

export function SettingsView() {
  const { settings, updateSettings, userContexts, headerPresets } = useAppStore();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Settings</h1>
      </header>

      <div className={styles.content}>
        {/* General Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>General</h2>
          <div className={styles.settingsList}>
            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <label className={styles.settingLabel}>Pause all on startup</label>
                <p className={styles.settingDescription}>
                  Start with all queues and workflows paused for safety
                </p>
              </div>
              <label className={styles.toggle}>
                <input
                  type="checkbox"
                  checked={settings.pauseAllOnStartup}
                  onChange={(e) => updateSettings({ pauseAllOnStartup: e.target.checked })}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>

            <div className={styles.settingItem}>
              <div className={styles.settingInfo}>
                <label className={styles.settingLabel}>Theme</label>
                <p className={styles.settingDescription}>
                  Application color scheme
                </p>
              </div>
              <select
                className="input select"
                style={{ width: 'auto', minWidth: 120 }}
                value={settings.theme}
                onChange={(e) => updateSettings({ theme: e.target.value as 'light' | 'dark' | 'system' })}
              >
                <option value="system">System</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </div>
          </div>
        </section>

        {/* Download Presets Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Download Presets</h2>
          
          {/* User Contexts */}
          <div className={styles.subsection}>
            <div className={styles.subsectionHeader}>
              <h3 className={styles.subsectionTitle}>User Contexts</h3>
              <button className="btn btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add
              </button>
            </div>
            <div className={styles.presetList}>
              {userContexts.map(context => (
                <div key={context.id} className={styles.presetItem}>
                  <div className={styles.presetInfo}>
                    <span className={styles.presetName}>
                      {context.isBuiltIn && <span className={styles.builtInBadge}>🔒</span>}
                      {context.name}
                    </span>
                    {context.description && (
                      <span className={styles.presetDescription}>{context.description}</span>
                    )}
                  </div>
                  {!context.isBuiltIn && (
                    <div className={styles.presetActions}>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Edit">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                        </svg>
                      </button>
                      <button className="btn btn-ghost btn-sm btn-icon" title="Delete">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {userContexts.length === 0 && (
                <p className={styles.emptyText}>No user contexts configured</p>
              )}
            </div>
          </div>

          {/* Header Presets */}
          <div className={styles.subsection}>
            <div className={styles.subsectionHeader}>
              <h3 className={styles.subsectionTitle}>Header Presets</h3>
              <button className="btn btn-sm">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add
              </button>
            </div>
            <div className={styles.presetList}>
              {headerPresets.map(preset => (
                <div key={preset.id} className={styles.presetItem}>
                  <div className={styles.presetInfo}>
                    <span className={styles.presetName}>{preset.name}</span>
                    {preset.description && (
                      <span className={styles.presetDescription}>{preset.description}</span>
                    )}
                  </div>
                  <div className={styles.presetActions}>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Edit">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                    </button>
                    <button className="btn btn-ghost btn-sm btn-icon" title="Delete">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
              {headerPresets.length === 0 && (
                <p className={styles.emptyText}>No header presets configured</p>
              )}
            </div>
          </div>

          {/* Download Defaults */}
          <div className={styles.subsection}>
            <h3 className={styles.subsectionTitle}>Download Defaults</h3>
            <div className={styles.settingsList}>
              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label className={styles.settingLabel}>Default User Context</label>
                </div>
                <select
                  className="input select"
                  style={{ width: 'auto', minWidth: 160 }}
                  value={settings.downloadDefaults.defaultUserContextId || ''}
                  onChange={(e) => updateSettings({
                    downloadDefaults: {
                      ...settings.downloadDefaults,
                      defaultUserContextId: e.target.value || undefined,
                    },
                  })}
                >
                  <option value="">None</option>
                  {userContexts.map(ctx => (
                    <option key={ctx.id} value={ctx.id}>{ctx.name}</option>
                  ))}
                </select>
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label className={styles.settingLabel}>Default Timeout</label>
                  <p className={styles.settingDescription}>Seconds</p>
                </div>
                <input
                  type="number"
                  className="input"
                  style={{ width: 80 }}
                  value={settings.downloadDefaults.defaultTimeout}
                  onChange={(e) => updateSettings({
                    downloadDefaults: {
                      ...settings.downloadDefaults,
                      defaultTimeout: parseInt(e.target.value) || 30,
                    },
                  })}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label className={styles.settingLabel}>Default Retry Attempts</label>
                </div>
                <input
                  type="number"
                  className="input"
                  style={{ width: 80 }}
                  value={settings.downloadDefaults.defaultRetryAttempts}
                  onChange={(e) => updateSettings({
                    downloadDefaults: {
                      ...settings.downloadDefaults,
                      defaultRetryAttempts: parseInt(e.target.value) || 3,
                    },
                  })}
                />
              </div>

              <div className={styles.settingItem}>
                <div className={styles.settingInfo}>
                  <label className={styles.settingLabel}>Default Max Concurrent</label>
                </div>
                <input
                  type="number"
                  className="input"
                  style={{ width: 80 }}
                  value={settings.downloadDefaults.defaultMaxConcurrent}
                  onChange={(e) => updateSettings({
                    downloadDefaults: {
                      ...settings.downloadDefaults,
                      defaultMaxConcurrent: parseInt(e.target.value) || 3,
                    },
                  })}
                />
              </div>
            </div>
          </div>
        </section>

        {/* About Section */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About</h2>
          <div className={styles.aboutInfo}>
            <p><strong>Task Queue Manager</strong></p>
            <p className="text-tertiary">Version 0.1.0</p>
            <p className="text-tertiary" style={{ marginTop: 'var(--space-2)' }}>
              A desktop task queue manager for file processing workflows.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
