import React, { useState } from 'react';
import { useCreateTask, useFileDialog } from '../../hooks/useApi';
import { X, Copy, FileArchive, Archive, Film, FolderSync, Trash, Terminal, FolderOpen, File, Plus, Minus } from 'lucide-react';
import { TaskType, TaskConfig } from '@shared/types';

interface CreateTaskModalProps {
  queueId: string;
  onClose: () => void;
}

type TaskTypeOption = {
  type: TaskType;
  label: string;
  icon: React.ReactNode;
  color: string;
};

const taskTypes: TaskTypeOption[] = [
  { type: 'copy', label: 'Copy', icon: <Copy className="w-5 h-5" />, color: 'blue' },
  { type: 'zip', label: 'Zip', icon: <FileArchive className="w-5 h-5" />, color: 'yellow' },
  { type: 'tar', label: 'Tar', icon: <Archive className="w-5 h-5" />, color: 'orange' },
  { type: 'transcode', label: 'Transcode', icon: <Film className="w-5 h-5" />, color: 'purple' },
  { type: 'rsync', label: 'Rsync', icon: <FolderSync className="w-5 h-5" />, color: 'green' },
  { type: 'delete', label: 'Delete', icon: <Trash className="w-5 h-5" />, color: 'red' },
  { type: 'custom', label: 'Custom', icon: <Terminal className="w-5 h-5" />, color: 'cyan' },
];

export default function CreateTaskModal({ queueId, onClose }: CreateTaskModalProps) {
  const [selectedType, setSelectedType] = useState<TaskType | null>(null);
  const [taskName, setTaskName] = useState('');
  
  const createTask = useCreateTask();

  const handleCreate = async (config: TaskConfig) => {
    const name = taskName.trim() || `${selectedType} task`;
    
    try {
      await createTask.mutateAsync({
        queueId,
        name,
        config,
      });
      onClose();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="bg-surface-darker border border-surface-light rounded-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-surface-light shrink-0">
          <h2 className="text-lg font-semibold text-gray-100">
            {selectedType ? `New ${selectedType.charAt(0).toUpperCase() + selectedType.slice(1)} Task` : 'Add Task'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface-light transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!selectedType ? (
            /* Task type selection */
            <div className="space-y-4">
              <p className="text-gray-400 text-sm">Select a task type:</p>
              <div className="grid grid-cols-2 gap-3">
                {taskTypes.map((option) => (
                  <button
                    key={option.type}
                    onClick={() => setSelectedType(option.type)}
                    className={`
                      flex items-center gap-3 p-4 rounded-xl border border-surface-light
                      hover:border-${option.color}-500/50 hover:bg-${option.color}-500/10
                      transition-all text-left
                    `}
                  >
                    <div className={`p-2 rounded-lg bg-${option.color}-500/20 text-${option.color}-400`}>
                      {option.icon}
                    </div>
                    <span className="font-medium text-gray-200">{option.label}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Task configuration */
            <div className="space-y-5">
              <button
                onClick={() => setSelectedType(null)}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                ← Back to task types
              </button>

              {/* Task name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Task Name <span className="text-gray-500">(optional)</span>
                </label>
                <input
                  type="text"
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  placeholder={`${selectedType} task`}
                  className="
                    w-full px-4 py-3 rounded-xl
                    bg-surface-dark border border-surface-light
                    text-gray-100 placeholder-gray-500
                    focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
                  "
                />
              </div>

              {/* Task-specific form */}
              {selectedType === 'copy' && <CopyForm onSubmit={handleCreate} isPending={createTask.isPending} />}
              {selectedType === 'zip' && <ZipForm onSubmit={handleCreate} isPending={createTask.isPending} />}
              {selectedType === 'tar' && <TarForm onSubmit={handleCreate} isPending={createTask.isPending} />}
              {selectedType === 'transcode' && <TranscodeForm onSubmit={handleCreate} isPending={createTask.isPending} />}
              {selectedType === 'rsync' && <RsyncForm onSubmit={handleCreate} isPending={createTask.isPending} />}
              {selectedType === 'delete' && <DeleteForm onSubmit={handleCreate} isPending={createTask.isPending} />}
              {selectedType === 'custom' && <CustomForm onSubmit={handleCreate} isPending={createTask.isPending} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Form Components ============

interface FormProps {
  onSubmit: (config: TaskConfig) => void;
  isPending: boolean;
}

function PathInput({ 
  value, 
  onChange, 
  onBrowse, 
  placeholder, 
  label,
  isDirectory = false 
}: { 
  value: string; 
  onChange: (v: string) => void; 
  onBrowse: () => void;
  placeholder: string;
  label: string;
  isDirectory?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="
            flex-1 px-4 py-3 rounded-xl
            bg-surface-dark border border-surface-light
            text-gray-100 placeholder-gray-500
            focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
          "
        />
        <button
          type="button"
          onClick={onBrowse}
          className="px-4 py-3 rounded-xl bg-surface-light hover:bg-surface-lighter transition-colors"
          title={isDirectory ? 'Browse folder' : 'Browse file'}
        >
          {isDirectory ? <FolderOpen className="w-5 h-5 text-gray-400" /> : <File className="w-5 h-5 text-gray-400" />}
        </button>
      </div>
    </div>
  );
}

function MultiPathInput({
  paths,
  onChange,
  label,
  isDirectory = false
}: {
  paths: string[];
  onChange: (paths: string[]) => void;
  label: string;
  isDirectory?: boolean;
}) {
  const { selectFile, selectDirectory } = useFileDialog();

  const handleAdd = async () => {
    try {
      const selected = isDirectory 
        ? await selectDirectory({ multiple: true })
        : await selectFile({ multiple: true });
      
      if (selected && selected.length > 0) {
        onChange([...paths, ...selected]);
      }
    } catch (error) {
      console.error('Dialog error:', error);
    }
  };

  const handleRemove = (index: number) => {
    onChange(paths.filter((_, i) => i !== index));
  };

  const handleChange = (index: number, value: string) => {
    const newPaths = [...paths];
    newPaths[index] = value;
    onChange(newPaths);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-sm font-medium text-gray-300">{label}</label>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <Plus className="w-3 h-3" /> Add
        </button>
      </div>
      <div className="space-y-2">
        {paths.map((path, index) => (
          <div key={index} className="flex gap-2">
            <input
              type="text"
              value={path}
              onChange={(e) => handleChange(index, e.target.value)}
              placeholder={isDirectory ? '/path/to/folder' : '/path/to/file'}
              className="
                flex-1 px-4 py-2.5 rounded-xl
                bg-surface-dark border border-surface-light
                text-gray-100 placeholder-gray-500
                focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500
                text-sm
              "
            />
            <button
              type="button"
              onClick={() => handleRemove(index)}
              className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
            >
              <Minus className="w-4 h-4 text-red-400" />
            </button>
          </div>
        ))}
        {paths.length === 0 && (
          <p className="text-sm text-gray-500 py-2">No items added yet</p>
        )}
      </div>
    </div>
  );
}

function SubmitButton({ disabled, isPending, label = 'Create Task' }: { disabled: boolean; isPending: boolean; label?: string }) {
  return (
    <button
      type="submit"
      disabled={disabled || isPending}
      className="
        w-full px-6 py-3 rounded-xl font-semibold
        bg-cyan-500 hover:bg-cyan-400 text-surface-dark
        disabled:opacity-50 disabled:cursor-not-allowed
        transition-all mt-6
      "
    >
      {isPending ? 'Creating...' : label}
    </button>
  );
}

// ============ Task Type Forms ============

function CopyForm({ onSubmit, isPending }: FormProps) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [overwrite, setOverwrite] = useState(true);
  const { selectFile, selectDirectory, selectSave } = useFileDialog();

  const handleBrowseSource = async () => {
    const result = await selectFile({ title: 'Select source file or folder' });
    if (result && result.length > 0) setSource(result[0]);
  };

  const handleBrowseDestination = async () => {
    const result = await selectSave({ title: 'Select destination' });
    if (result) setDestination(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !destination) return;
    onSubmit({ type: 'copy', source, destination, overwrite });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PathInput
        value={source}
        onChange={setSource}
        onBrowse={handleBrowseSource}
        placeholder="/path/to/source"
        label="Source"
      />
      <PathInput
        value={destination}
        onChange={setDestination}
        onBrowse={handleBrowseDestination}
        placeholder="/path/to/destination"
        label="Destination"
      />
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={overwrite}
          onChange={(e) => setOverwrite(e.target.checked)}
          className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
        />
        <span className="text-sm text-gray-300">Overwrite existing files</span>
      </label>
      <SubmitButton disabled={!source || !destination} isPending={isPending} />
    </form>
  );
}

function ZipForm({ onSubmit, isPending }: FormProps) {
  const [inputs, setInputs] = useState<string[]>(['']);
  const [output, setOutput] = useState('');
  const [zipIndividually, setZipIndividually] = useState(false);
  const [compressionLevel, setCompressionLevel] = useState(6);
  const { selectSave } = useFileDialog();

  const handleBrowseOutput = async () => {
    if (zipIndividually) {
      const { selectDirectory } = useFileDialog();
      const result = await selectDirectory({ title: 'Select output folder' });
      if (result && result.length > 0) setOutput(result[0]);
    } else {
      const result = await selectSave({ 
        title: 'Save zip file', 
        filters: [{ name: 'ZIP Archives', extensions: ['zip'] }] 
      });
      if (result) setOutput(result);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validInputs = inputs.filter(i => i.trim());
    if (validInputs.length === 0 || !output) return;
    onSubmit({ type: 'zip', inputs: validInputs, output, zipIndividually, compressionLevel });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <MultiPathInput
        paths={inputs}
        onChange={setInputs}
        label="Input files/folders"
        isDirectory
      />
      
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={zipIndividually}
          onChange={(e) => setZipIndividually(e.target.checked)}
          className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
        />
        <span className="text-sm text-gray-300">Zip each folder individually</span>
      </label>

      <PathInput
        value={output}
        onChange={setOutput}
        onBrowse={handleBrowseOutput}
        placeholder={zipIndividually ? '/path/to/output/folder' : '/path/to/output.zip'}
        label={zipIndividually ? 'Output folder' : 'Output file'}
        isDirectory={zipIndividually}
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Compression Level: {compressionLevel}
        </label>
        <input
          type="range"
          min="0"
          max="9"
          value={compressionLevel}
          onChange={(e) => setCompressionLevel(Number(e.target.value))}
          className="w-full"
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>No compression</span>
          <span>Maximum</span>
        </div>
      </div>

      <SubmitButton disabled={inputs.filter(i => i.trim()).length === 0 || !output} isPending={isPending} />
    </form>
  );
}

function TarForm({ onSubmit, isPending }: FormProps) {
  const [inputs, setInputs] = useState<string[]>(['']);
  const [output, setOutput] = useState('');
  const [gzip, setGzip] = useState(true);
  const { selectSave } = useFileDialog();

  const handleBrowseOutput = async () => {
    const result = await selectSave({ 
      title: 'Save tar file',
      filters: [{ name: 'TAR Archives', extensions: gzip ? ['tar.gz', 'tgz'] : ['tar'] }]
    });
    if (result) setOutput(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validInputs = inputs.filter(i => i.trim());
    if (validInputs.length === 0 || !output) return;
    onSubmit({ type: 'tar', inputs: validInputs, output, gzip });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <MultiPathInput
        paths={inputs}
        onChange={setInputs}
        label="Input files/folders"
        isDirectory
      />

      <PathInput
        value={output}
        onChange={setOutput}
        onBrowse={handleBrowseOutput}
        placeholder={gzip ? '/path/to/output.tar.gz' : '/path/to/output.tar'}
        label="Output file"
      />

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={gzip}
          onChange={(e) => setGzip(e.target.checked)}
          className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
        />
        <span className="text-sm text-gray-300">Compress with gzip</span>
      </label>

      <SubmitButton disabled={inputs.filter(i => i.trim()).length === 0 || !output} isPending={isPending} />
    </form>
  );
}

function TranscodeForm({ onSubmit, isPending }: FormProps) {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [preset, setPreset] = useState('medium');
  const [videoCodec, setVideoCodec] = useState('');
  const [audioCodec, setAudioCodec] = useState('');
  const [resolution, setResolution] = useState('');
  const [bitrate, setBitrate] = useState('');
  const { selectFile, selectSave } = useFileDialog();

  const handleBrowseInput = async () => {
    const result = await selectFile({
      title: 'Select video file',
      filters: [{ name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv'] }]
    });
    if (result && result.length > 0) setInput(result[0]);
  };

  const handleBrowseOutput = async () => {
    const result = await selectSave({
      title: 'Save transcoded video',
      filters: [{ name: 'Video Files', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm'] }]
    });
    if (result) setOutput(result);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input || !output) return;
    onSubmit({
      type: 'transcode',
      input,
      output,
      preset: preset || undefined,
      videoCodec: videoCodec || undefined,
      audioCodec: audioCodec || undefined,
      resolution: resolution || undefined,
      bitrate: bitrate || undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PathInput
        value={input}
        onChange={setInput}
        onBrowse={handleBrowseInput}
        placeholder="/path/to/input.mp4"
        label="Input video"
      />

      <PathInput
        value={output}
        onChange={setOutput}
        onBrowse={handleBrowseOutput}
        placeholder="/path/to/output.mp4"
        label="Output video"
      />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Preset</label>
          <select
            value={preset}
            onChange={(e) => setPreset(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100"
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

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Video Codec</label>
          <select
            value={videoCodec}
            onChange={(e) => setVideoCodec(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100"
          >
            <option value="">Default</option>
            <option value="libx264">H.264</option>
            <option value="libx265">H.265/HEVC</option>
            <option value="libvpx-vp9">VP9</option>
            <option value="libaom-av1">AV1</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Resolution</label>
          <select
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100"
          >
            <option value="">Original</option>
            <option value="3840x2160">4K (3840x2160)</option>
            <option value="1920x1080">1080p (1920x1080)</option>
            <option value="1280x720">720p (1280x720)</option>
            <option value="854x480">480p (854x480)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Audio Codec</label>
          <select
            value={audioCodec}
            onChange={(e) => setAudioCodec(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100"
          >
            <option value="">Default</option>
            <option value="aac">AAC</option>
            <option value="libmp3lame">MP3</option>
            <option value="libopus">Opus</option>
            <option value="copy">Copy (no re-encode)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Bitrate <span className="text-gray-500">(e.g., 5M, 2000k)</span>
        </label>
        <input
          type="text"
          value={bitrate}
          onChange={(e) => setBitrate(e.target.value)}
          placeholder="Leave empty for automatic"
          className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100 placeholder-gray-500"
        />
      </div>

      <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
        <p className="text-sm text-amber-400">
          ⚠️ FFmpeg must be installed on your system for transcoding to work.
        </p>
      </div>

      <SubmitButton disabled={!input || !output} isPending={isPending} />
    </form>
  );
}

function RsyncForm({ onSubmit, isPending }: FormProps) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [archive, setArchive] = useState(true);
  const [compress, setCompress] = useState(false);
  const [deleteOnDest, setDeleteOnDest] = useState(false);
  const [dryRun, setDryRun] = useState(false);
  const [exclude, setExclude] = useState<string[]>([]);
  const { selectDirectory } = useFileDialog();

  const handleBrowseSource = async () => {
    const result = await selectDirectory({ title: 'Select source folder' });
    if (result && result.length > 0) setSource(result[0]);
  };

  const handleBrowseDestination = async () => {
    const result = await selectDirectory({ title: 'Select destination folder' });
    if (result && result.length > 0) setDestination(result[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !destination) return;
    onSubmit({
      type: 'rsync',
      source,
      destination,
      archive,
      compress,
      delete: deleteOnDest,
      dryRun,
      exclude: exclude.filter(e => e.trim()),
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PathInput
        value={source}
        onChange={setSource}
        onBrowse={handleBrowseSource}
        placeholder="/path/to/source/"
        label="Source"
        isDirectory
      />

      <PathInput
        value={destination}
        onChange={setDestination}
        onBrowse={handleBrowseDestination}
        placeholder="/path/to/destination/"
        label="Destination"
        isDirectory
      />

      <div className="grid grid-cols-2 gap-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={archive}
            onChange={(e) => setArchive(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Archive mode (-a)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={compress}
            onChange={(e) => setCompress(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Compress (-z)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={deleteOnDest}
            onChange={(e) => setDeleteOnDest(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Delete extra files (--delete)</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Dry run (-n)</span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Exclude patterns <span className="text-gray-500">(one per line)</span>
        </label>
        <textarea
          value={exclude.join('\n')}
          onChange={(e) => setExclude(e.target.value.split('\n'))}
          placeholder="*.tmp&#10;.git&#10;node_modules"
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100 placeholder-gray-500 text-sm font-mono"
        />
      </div>

      <SubmitButton disabled={!source || !destination} isPending={isPending} />
    </form>
  );
}

function DeleteForm({ onSubmit, isPending }: FormProps) {
  const [paths, setPaths] = useState<string[]>(['']);
  const [recursive, setRecursive] = useState(true);
  const [moveToTrash, setMoveToTrash] = useState(true);
  const [force, setForce] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const validPaths = paths.filter(p => p.trim());
    if (validPaths.length === 0) return;
    onSubmit({
      type: 'delete',
      paths: validPaths,
      recursive,
      moveToTrash,
      force,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <MultiPathInput
        paths={paths}
        onChange={setPaths}
        label="Files/folders to delete"
        isDirectory
      />

      <div className="space-y-3">
        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={moveToTrash}
            onChange={(e) => setMoveToTrash(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Move to trash instead of permanent delete</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={recursive}
            onChange={(e) => setRecursive(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Delete folders recursively</span>
        </label>

        <label className="flex items-center gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={force}
            onChange={(e) => setForce(e.target.checked)}
            className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
          />
          <span className="text-sm text-gray-300">Force delete (ignore errors)</span>
        </label>
      </div>

      {!moveToTrash && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl">
          <p className="text-sm text-red-400">
            ⚠️ Files will be permanently deleted and cannot be recovered!
          </p>
        </div>
      )}

      <SubmitButton disabled={paths.filter(p => p.trim()).length === 0} isPending={isPending} />
    </form>
  );
}

function CustomForm({ onSubmit, isPending }: FormProps) {
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [cwd, setCwd] = useState('');
  const [shell, setShell] = useState(true);
  const { selectDirectory } = useFileDialog();

  const handleBrowseCwd = async () => {
    const result = await selectDirectory({ title: 'Select working directory' });
    if (result && result.length > 0) setCwd(result[0]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;
    onSubmit({
      type: 'custom',
      command: command.trim(),
      args: args.trim() ? args.split(/\s+/) : undefined,
      cwd: cwd.trim() || undefined,
      shell,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Command</label>
        <input
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder={shell ? 'echo "Hello World"' : 'echo'}
          className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100 placeholder-gray-500 font-mono"
        />
      </div>

      {!shell && (
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Arguments <span className="text-gray-500">(space-separated)</span>
          </label>
          <input
            type="text"
            value={args}
            onChange={(e) => setArgs(e.target.value)}
            placeholder="-flag1 value1 -flag2"
            className="w-full px-4 py-3 rounded-xl bg-surface-dark border border-surface-light text-gray-100 placeholder-gray-500 font-mono"
          />
        </div>
      )}

      <PathInput
        value={cwd}
        onChange={setCwd}
        onBrowse={handleBrowseCwd}
        placeholder="/path/to/working/directory"
        label="Working Directory (optional)"
        isDirectory
      />

      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={shell}
          onChange={(e) => setShell(e.target.checked)}
          className="w-4 h-4 rounded border-surface-light bg-surface-dark text-cyan-500 focus:ring-cyan-500"
        />
        <span className="text-sm text-gray-300">Run in shell (allows pipes, redirects, etc.)</span>
      </label>

      <SubmitButton disabled={!command.trim()} isPending={isPending} />
    </form>
  );
}
