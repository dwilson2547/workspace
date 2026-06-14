import { TaskType, TaskConfig, TaskTemplate, TASK_META } from '@/types';
import { useAppStore } from '@/store/appStore';
import styles from './TaskConfigPanel.module.css';
import clsx from 'clsx';

interface TaskConfigPanelProps {
  taskType: TaskType;
  config: Partial<TaskConfig>;
  onChange: (config: Partial<TaskConfig>) => void;
  template?: TaskTemplate | null;
  mode: 'queue' | 'workflow';
}

export function TaskConfigPanel({
  taskType,
  config,
  onChange,
  template,
  mode,
}: TaskConfigPanelProps) {
  const { userContexts, headerPresets } = useAppStore();
  const lockedFields = template?.lockedFields || [];

  const isLocked = (field: string) => lockedFields.includes(field);

  const updateConfig = (updates: Partial<TaskConfig>) => {
    onChange({ ...config, ...updates });
  };

  // Render different panels based on task type
  switch (taskType) {
    case 'copy':
      return (
        <CopyConfigPanel
          config={config}
          updateConfig={updateConfig}
          isLocked={isLocked}
          mode={mode}
        />
      );
    case 'move':
      return (
        <MoveConfigPanel
          config={config}
          updateConfig={updateConfig}
          isLocked={isLocked}
          mode={mode}
        />
      );
    case 'archive':
      return (
        <ArchiveConfigPanel
          config={config}
          updateConfig={updateConfig}
          isLocked={isLocked}
        />
      );
    case 'transcode':
      return (
        <TranscodeConfigPanel
          config={config}
          updateConfig={updateConfig}
          isLocked={isLocked}
        />
      );
    case 'download':
      return (
        <DownloadConfigPanel
          config={config}
          updateConfig={updateConfig}
          isLocked={isLocked}
          userContexts={userContexts}
          headerPresets={headerPresets}
        />
      );
    case 'shell_command':
      return (
        <ShellCommandConfigPanel
          config={config}
          updateConfig={updateConfig}
          isLocked={isLocked}
        />
      );
    default:
      return (
        <GenericConfigPanel
          taskType={taskType}
          config={config}
          updateConfig={updateConfig}
        />
      );
  }
}

// =============================================================================
// Copy Task Config
// =============================================================================

interface ConfigPanelProps {
  config: Partial<TaskConfig>;
  updateConfig: (updates: Partial<TaskConfig>) => void;
  isLocked: (field: string) => boolean;
  mode?: 'queue' | 'workflow';
}

function CopyConfigPanel({ config, updateConfig, isLocked, mode }: ConfigPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Source Path
          {isLocked('sourcePath') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).sourcePath || ''}
            onChange={(e) => updateConfig({ sourcePath: e.target.value } as any)}
            disabled={isLocked('sourcePath')}
            placeholder={mode === 'workflow' ? 'Set by pipeline input' : '/path/to/source'}
          />
          <button className={styles.browseButton} disabled={isLocked('sourcePath')}>
            📁
          </button>
        </div>
        {mode === 'workflow' && (
          <span className={styles.hint}>In pipelines, the source is provided by the previous task</span>
        )}
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Destination Path
          {isLocked('destinationPath') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).destinationPath || ''}
            onChange={(e) => updateConfig({ destinationPath: e.target.value } as any)}
            disabled={isLocked('destinationPath')}
            placeholder="/path/to/destination"
          />
          <button className={styles.browseButton} disabled={isLocked('destinationPath')}>
            📁
          </button>
        </div>
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={(config as any).overwrite || false}
            onChange={(e) => updateConfig({ overwrite: e.target.checked } as any)}
            disabled={isLocked('overwrite')}
          />
          <span>Overwrite existing files</span>
          {isLocked('overwrite') && <span className={styles.lockIcon}>🔒</span>}
        </label>
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={(config as any).preserveTimestamps ?? true}
            onChange={(e) => updateConfig({ preserveTimestamps: e.target.checked } as any)}
            disabled={isLocked('preserveTimestamps')}
          />
          <span>Preserve timestamps</span>
          {isLocked('preserveTimestamps') && <span className={styles.lockIcon}>🔒</span>}
        </label>
      </div>

      {mode === 'workflow' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Pass Through
            {isLocked('passThrough') && <span className={styles.lockIcon}>🔒</span>}
          </label>
          <div className={styles.radioGroup}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="passThrough"
                value="original"
                checked={(config as any).passThrough === 'original'}
                onChange={() => updateConfig({ passThrough: 'original' } as any)}
                disabled={isLocked('passThrough')}
              />
              <span>Pass original file to next task</span>
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="passThrough"
                value="copy"
                checked={(config as any).passThrough === 'copy'}
                onChange={() => updateConfig({ passThrough: 'copy' } as any)}
                disabled={isLocked('passThrough')}
              />
              <span>Pass copied file to next task</span>
            </label>
          </div>
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Move Task Config
// =============================================================================

function MoveConfigPanel({ config, updateConfig, isLocked, mode }: ConfigPanelProps) {
  return (
    <div className={styles.panel}>
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Source Path
          {isLocked('sourcePath') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).sourcePath || ''}
            onChange={(e) => updateConfig({ sourcePath: e.target.value } as any)}
            disabled={isLocked('sourcePath')}
            placeholder={mode === 'workflow' ? 'Set by pipeline input' : '/path/to/source'}
          />
          <button className={styles.browseButton} disabled={isLocked('sourcePath')}>
            📁
          </button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Destination Path
          {isLocked('destinationPath') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).destinationPath || ''}
            onChange={(e) => updateConfig({ destinationPath: e.target.value } as any)}
            disabled={isLocked('destinationPath')}
            placeholder="/path/to/destination"
          />
          <button className={styles.browseButton} disabled={isLocked('destinationPath')}>
            📁
          </button>
        </div>
      </div>

      <div className={styles.checkboxGroup}>
        <label className={styles.checkbox}>
          <input
            type="checkbox"
            checked={(config as any).overwrite || false}
            onChange={(e) => updateConfig({ overwrite: e.target.checked } as any)}
            disabled={isLocked('overwrite')}
          />
          <span>Overwrite existing files</span>
          {isLocked('overwrite') && <span className={styles.lockIcon}>🔒</span>}
        </label>
      </div>
    </div>
  );
}

// =============================================================================
// Archive Task Config
// =============================================================================

function ArchiveConfigPanel({ config, updateConfig, isLocked }: Omit<ConfigPanelProps, 'mode'>) {
  const format = (config as any).format || 'zip';

  return (
    <div className={styles.panel}>
      <div className={styles.formGroup}>
        <label className={styles.label}>Format</label>
        <div className={styles.tabGroup}>
          <button
            className={clsx(styles.tab, format === 'zip' && styles.tabActive)}
            onClick={() => updateConfig({ format: 'zip', zipCompression: 'deflate' } as any)}
            disabled={isLocked('format')}
          >
            ZIP
          </button>
          <button
            className={clsx(styles.tab, format === 'tar' && styles.tabActive)}
            onClick={() => updateConfig({ format: 'tar', tarCompression: 'gzip' } as any)}
            disabled={isLocked('format')}
          >
            TAR
          </button>
        </div>
      </div>

      {format === 'zip' ? (
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Compression
            {isLocked('zipCompression') && <span className={styles.lockIcon}>🔒</span>}
          </label>
          <select
            className={styles.select}
            value={(config as any).zipCompression || 'deflate'}
            onChange={(e) => updateConfig({ zipCompression: e.target.value } as any)}
            disabled={isLocked('zipCompression')}
          >
            <option value="store">Store (no compression)</option>
            <option value="deflate">Deflate</option>
            <option value="lzma">LZMA</option>
            <option value="zstd">Zstandard</option>
          </select>
        </div>
      ) : (
        <div className={styles.formGroup}>
          <label className={styles.label}>
            Compression
            {isLocked('tarCompression') && <span className={styles.lockIcon}>🔒</span>}
          </label>
          <select
            className={styles.select}
            value={(config as any).tarCompression || 'gzip'}
            onChange={(e) => updateConfig({ tarCompression: e.target.value } as any)}
            disabled={isLocked('tarCompression')}
          >
            <option value="none">None</option>
            <option value="gzip">Gzip (.tar.gz)</option>
            <option value="bzip2">Bzip2 (.tar.bz2)</option>
            <option value="xz">XZ (.tar.xz)</option>
            <option value="zstd">Zstandard (.tar.zst)</option>
          </select>
        </div>
      )}

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Compression Level: {(config as any).compressionLevel || 6}
          {isLocked('compressionLevel') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <input
          type="range"
          className={styles.slider}
          min={1}
          max={9}
          value={(config as any).compressionLevel || 6}
          onChange={(e) => updateConfig({ compressionLevel: parseInt(e.target.value) } as any)}
          disabled={isLocked('compressionLevel')}
        />
        <div className={styles.sliderLabels}>
          <span>Fast</span>
          <span>Best</span>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          CPU Usage
          {isLocked('cpuUsage') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.radioGroup}>
          <label className={styles.radio}>
            <input
              type="radio"
              name="cpuUsage"
              value="fast"
              checked={(config as any).cpuUsage === 'fast'}
              onChange={() => updateConfig({ cpuUsage: 'fast' } as any)}
              disabled={isLocked('cpuUsage')}
            />
            <span>Fast (all cores)</span>
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name="cpuUsage"
              value="slow"
              checked={(config as any).cpuUsage === 'slow'}
              onChange={() => updateConfig({ cpuUsage: 'slow' } as any)}
              disabled={isLocked('cpuUsage')}
            />
            <span>Slow (background)</span>
          </label>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Output
          {isLocked('destinationPath') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).destinationPath || ''}
            onChange={(e) => updateConfig({ destinationPath: e.target.value } as any)}
            disabled={isLocked('destinationPath')}
            placeholder="{filename}.zip"
          />
          <button className={styles.browseButton} disabled={isLocked('destinationPath')}>
            📁
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Transcode Task Config
// =============================================================================

const CPU_CODECS = ['libx264', 'libx265', 'libvpx-vp9', 'libaom-av1'];

function TranscodeConfigPanel({ config, updateConfig, isLocked }: Omit<ConfigPanelProps, 'mode'>) {
  const videoCodec = (config as any).videoCodec || 'libx264';
  const showCpuUsage = CPU_CODECS.includes(videoCodec);

  return (
    <div className={styles.panel}>
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Video Codec
          {isLocked('videoCodec') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <select
          className={styles.select}
          value={videoCodec}
          onChange={(e) => updateConfig({ videoCodec: e.target.value } as any)}
          disabled={isLocked('videoCodec')}
        >
          <optgroup label="CPU Codecs">
            <option value="libx264">H.264 (libx264)</option>
            <option value="libx265">H.265/HEVC (libx265)</option>
            <option value="libvpx-vp9">VP9 (libvpx)</option>
            <option value="libaom-av1">AV1 (libaom)</option>
          </optgroup>
          <optgroup label="NVIDIA GPU">
            <option value="h264_nvenc">H.264 (NVENC)</option>
            <option value="hevc_nvenc">H.265 (NVENC)</option>
          </optgroup>
          <optgroup label="Intel QuickSync">
            <option value="h264_qsv">H.264 (QSV)</option>
            <option value="hevc_qsv">H.265 (QSV)</option>
          </optgroup>
          <optgroup label="macOS">
            <option value="h264_videotoolbox">H.264 (VideoToolbox)</option>
            <option value="hevc_videotoolbox">H.265 (VideoToolbox)</option>
          </optgroup>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Preset
          {isLocked('preset') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <select
          className={styles.select}
          value={(config as any).preset || 'medium'}
          onChange={(e) => updateConfig({ preset: e.target.value } as any)}
          disabled={isLocked('preset')}
        >
          <option value="ultrafast">Ultra Fast</option>
          <option value="superfast">Super Fast</option>
          <option value="veryfast">Very Fast</option>
          <option value="faster">Faster</option>
          <option value="fast">Fast</option>
          <option value="medium">Medium</option>
          <option value="slow">Slow</option>
          <option value="slower">Slower</option>
          <option value="veryslow">Very Slow</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Quality (CRF): {(config as any).crf || 23}
          {isLocked('crf') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <input
          type="range"
          className={styles.slider}
          min={0}
          max={51}
          value={(config as any).crf || 23}
          onChange={(e) => updateConfig({ crf: parseInt(e.target.value) } as any)}
          disabled={isLocked('crf')}
        />
        <div className={styles.sliderLabels}>
          <span>Best (large)</span>
          <span>Worst (small)</span>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Audio Codec
          {isLocked('audioCodec') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <select
          className={styles.select}
          value={(config as any).audioCodec || 'aac'}
          onChange={(e) => updateConfig({ audioCodec: e.target.value } as any)}
          disabled={isLocked('audioCodec')}
        >
          <option value="aac">AAC</option>
          <option value="mp3">MP3</option>
          <option value="opus">Opus</option>
          <option value="flac">FLAC</option>
          <option value="copy">Copy (no re-encode)</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Audio Bitrate
          {isLocked('audioBitrate') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <select
          className={styles.select}
          value={(config as any).audioBitrate || '192k'}
          onChange={(e) => updateConfig({ audioBitrate: e.target.value } as any)}
          disabled={isLocked('audioBitrate')}
        >
          <option value="64k">64 kbps</option>
          <option value="128k">128 kbps</option>
          <option value="192k">192 kbps</option>
          <option value="256k">256 kbps</option>
          <option value="320k">320 kbps</option>
        </select>
      </div>

      {showCpuUsage && (
        <div className={styles.formGroup}>
          <label className={styles.label}>
            CPU Usage
            {isLocked('cpuUsage') && <span className={styles.lockIcon}>🔒</span>}
          </label>
          <div className={styles.radioGroup}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="cpuUsage"
                value="fast"
                checked={(config as any).cpuUsage === 'fast'}
                onChange={() => updateConfig({ cpuUsage: 'fast' } as any)}
                disabled={isLocked('cpuUsage')}
              />
              <span>Fast (all cores)</span>
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="cpuUsage"
                value="slow"
                checked={(config as any).cpuUsage === 'slow'}
                onChange={() => updateConfig({ cpuUsage: 'slow' } as any)}
                disabled={isLocked('cpuUsage')}
              />
              <span>Slow (limited)</span>
            </label>
          </div>
        </div>
      )}

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Output
          {isLocked('destinationPath') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).destinationPath || ''}
            onChange={(e) => updateConfig({ destinationPath: e.target.value } as any)}
            disabled={isLocked('destinationPath')}
            placeholder="{filename}_transcoded.mp4"
          />
          <button className={styles.browseButton} disabled={isLocked('destinationPath')}>
            📁
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Download Task Config
// =============================================================================

interface DownloadConfigPanelProps extends Omit<ConfigPanelProps, 'mode'> {
  userContexts: any[];
  headerPresets: any[];
}

function DownloadConfigPanel({
  config,
  updateConfig,
  isLocked,
  userContexts,
  headerPresets,
}: DownloadConfigPanelProps) {
  const authType = (config as any).authentication?.type || 'none';

  const handleUrlsChange = (value: string) => {
    const urls = value.split('\n').filter((url: string) => url.trim());
    updateConfig({ urls } as any);
  };

  const handleAuthTypeChange = (type: string) => {
    updateConfig({
      authentication: { type, username: '', password: '', token: '', headerName: 'X-API-Key', apiKey: '' },
    } as any);
  };

  return (
    <div className={styles.panel}>
      <div className={styles.formGroup}>
        <label className={styles.label}>
          URLs (one per line)
          {isLocked('urls') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <textarea
          className={styles.textarea}
          value={((config as any).urls || []).join('\n')}
          onChange={(e) => handleUrlsChange(e.target.value)}
          disabled={isLocked('urls')}
          placeholder="https://example.com/file1.zip&#10;https://example.com/file2.zip"
          rows={4}
        />
      </div>

      <div className={styles.divider} />
      <h4 className={styles.sectionTitle}>Request Settings</h4>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          User Context
          {isLocked('userContextId') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <select
          className={styles.select}
          value={(config as any).userContextId || ''}
          onChange={(e) => updateConfig({ userContextId: e.target.value || undefined } as any)}
          disabled={isLocked('userContextId')}
        >
          <option value="">None</option>
          {userContexts.map((ctx) => (
            <option key={ctx.id} value={ctx.id}>
              {ctx.name}
            </option>
          ))}
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Header Presets
          {isLocked('headerPresetIds') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.checkboxList}>
          {headerPresets.length === 0 ? (
            <span className={styles.emptyState}>No header presets configured</span>
          ) : (
            headerPresets.map((preset) => (
              <label key={preset.id} className={styles.checkbox}>
                <input
                  type="checkbox"
                  checked={((config as any).headerPresetIds || []).includes(preset.id)}
                  onChange={(e) => {
                    const current = (config as any).headerPresetIds || [];
                    const updated = e.target.checked
                      ? [...current, preset.id]
                      : current.filter((id: string) => id !== preset.id);
                    updateConfig({ headerPresetIds: updated } as any);
                  }}
                  disabled={isLocked('headerPresetIds')}
                />
                <span>{preset.name}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className={styles.divider} />
      <h4 className={styles.sectionTitle}>Authentication</h4>

      <div className={styles.formGroup}>
        <div className={styles.radioGroup}>
          {['none', 'basic', 'bearer', 'api_key'].map((type) => (
            <label key={type} className={styles.radio}>
              <input
                type="radio"
                name="authType"
                value={type}
                checked={authType === type}
                onChange={() => handleAuthTypeChange(type)}
                disabled={isLocked('authentication')}
              />
              <span>
                {type === 'none' && 'None'}
                {type === 'basic' && 'Basic Auth'}
                {type === 'bearer' && 'Bearer Token'}
                {type === 'api_key' && 'API Key'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {authType === 'basic' && (
        <>
          <div className={styles.formGroup}>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              className={styles.input}
              value={(config as any).authentication?.username || ''}
              onChange={(e) =>
                updateConfig({
                  authentication: { ...(config as any).authentication, username: e.target.value },
                } as any)
              }
              disabled={isLocked('authentication')}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              value={(config as any).authentication?.password || ''}
              onChange={(e) =>
                updateConfig({
                  authentication: { ...(config as any).authentication, password: e.target.value },
                } as any)
              }
              disabled={isLocked('authentication')}
            />
          </div>
        </>
      )}

      {authType === 'bearer' && (
        <div className={styles.formGroup}>
          <label className={styles.label}>Token</label>
          <input
            type="password"
            className={styles.input}
            value={(config as any).authentication?.token || ''}
            onChange={(e) =>
              updateConfig({
                authentication: { ...(config as any).authentication, token: e.target.value },
              } as any)
            }
            disabled={isLocked('authentication')}
            placeholder="eyJhbGciOiJIUzI1..."
          />
        </div>
      )}

      {authType === 'api_key' && (
        <>
          <div className={styles.formGroup}>
            <label className={styles.label}>Header Name</label>
            <input
              type="text"
              className={styles.input}
              value={(config as any).authentication?.headerName || 'X-API-Key'}
              onChange={(e) =>
                updateConfig({
                  authentication: { ...(config as any).authentication, headerName: e.target.value },
                } as any)
              }
              disabled={isLocked('authentication')}
            />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>API Key</label>
            <input
              type="password"
              className={styles.input}
              value={(config as any).authentication?.apiKey || ''}
              onChange={(e) =>
                updateConfig({
                  authentication: { ...(config as any).authentication, apiKey: e.target.value },
                } as any)
              }
              disabled={isLocked('authentication')}
            />
          </div>
        </>
      )}

      <div className={styles.divider} />
      <h4 className={styles.sectionTitle}>Download Options</h4>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={(config as any).followRedirects ?? true}
              onChange={(e) => updateConfig({ followRedirects: e.target.checked } as any)}
              disabled={isLocked('followRedirects')}
            />
            <span>Follow redirects</span>
          </label>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Max Redirects</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config as any).maxRedirects || 10}
            onChange={(e) => updateConfig({ maxRedirects: parseInt(e.target.value) } as any)}
            disabled={isLocked('maxRedirects')}
            min={0}
            max={50}
          />
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={(config as any).resumePartialDownloads ?? true}
              onChange={(e) => updateConfig({ resumePartialDownloads: e.target.checked } as any)}
              disabled={isLocked('resumePartialDownloads')}
            />
            <span>Resume partial downloads</span>
          </label>
        </div>
      </div>

      <div className={styles.formRow}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Timeout (seconds)</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config as any).timeout || 30}
            onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) } as any)}
            disabled={isLocked('timeout')}
            min={0}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Retry Attempts</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config as any).retryAttempts || 3}
            onChange={(e) => updateConfig({ retryAttempts: parseInt(e.target.value) } as any)}
            disabled={isLocked('retryAttempts')}
            min={0}
            max={10}
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Concurrent</label>
          <input
            type="number"
            className={styles.inputSmall}
            value={(config as any).maxConcurrent || 3}
            onChange={(e) => updateConfig({ maxConcurrent: parseInt(e.target.value) } as any)}
            disabled={isLocked('maxConcurrent')}
            min={1}
            max={10}
          />
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>If File Exists</label>
        <select
          className={styles.select}
          value={(config as any).overwriteExisting || 'skip'}
          onChange={(e) => updateConfig({ overwriteExisting: e.target.value } as any)}
          disabled={isLocked('overwriteExisting')}
        >
          <option value="skip">Skip</option>
          <option value="overwrite">Overwrite</option>
          <option value="rename">Rename</option>
        </select>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Output Directory
          {isLocked('outputDirectory') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).outputDirectory || ''}
            onChange={(e) => updateConfig({ outputDirectory: e.target.value } as any)}
            disabled={isLocked('outputDirectory')}
            placeholder="/path/to/downloads"
          />
          <button className={styles.browseButton} disabled={isLocked('outputDirectory')}>
            📁
          </button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Shell Command Config
// =============================================================================

function ShellCommandConfigPanel({ config, updateConfig, isLocked }: Omit<ConfigPanelProps, 'mode'>) {
  return (
    <div className={styles.panel}>
      <div className={styles.formGroup}>
        <label className={styles.label}>
          Command
          {isLocked('command') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <textarea
          className={styles.textarea}
          value={(config as any).command || ''}
          onChange={(e) => updateConfig({ command: e.target.value } as any)}
          disabled={isLocked('command')}
          placeholder="echo 'Hello World'"
          rows={4}
        />
        <span className={styles.hint}>
          Use {'${input}'} for input file path, {'${output}'} for output path
        </span>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Working Directory
          {isLocked('workingDirectory') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <div className={styles.inputWithButton}>
          <input
            type="text"
            className={styles.input}
            value={(config as any).workingDirectory || ''}
            onChange={(e) => updateConfig({ workingDirectory: e.target.value } as any)}
            disabled={isLocked('workingDirectory')}
            placeholder="Current directory"
          />
          <button className={styles.browseButton} disabled={isLocked('workingDirectory')}>
            📁
          </button>
        </div>
      </div>

      <div className={styles.formGroup}>
        <label className={styles.label}>
          Timeout (seconds, 0 = no limit)
          {isLocked('timeout') && <span className={styles.lockIcon}>🔒</span>}
        </label>
        <input
          type="number"
          className={styles.input}
          value={(config as any).timeout || 0}
          onChange={(e) => updateConfig({ timeout: parseInt(e.target.value) } as any)}
          disabled={isLocked('timeout')}
          min={0}
        />
      </div>
    </div>
  );
}

// =============================================================================
// Generic Config (fallback)
// =============================================================================

interface GenericConfigPanelProps {
  taskType: TaskType;
  config: Partial<TaskConfig>;
  updateConfig: (updates: Partial<TaskConfig>) => void;
}

function GenericConfigPanel({ taskType, config: _config, updateConfig: _updateConfig }: GenericConfigPanelProps) {
  const meta = TASK_META[taskType];

  return (
    <div className={styles.panel}>
      <div className={styles.placeholder}>
        <span className={styles.placeholderIcon}>{meta.icon}</span>
        <p className={styles.placeholderText}>
          Configuration for <strong>{meta.label}</strong> task is coming soon.
        </p>
        <p className={styles.placeholderHint}>{meta.description}</p>
      </div>
    </div>
  );
}
