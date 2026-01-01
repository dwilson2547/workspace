import { useState, useEffect } from 'react';
import type { FormEvent } from 'react';
import { open } from '@tauri-apps/api/dialog';
import { XIcon, FolderIcon, FileIcon, PlusIcon, TrashIcon } from '../Icons';
import { VIDEO_CODECS, PRESETS, COMMON_RESOLUTIONS, AUDIO_CODECS } from '../../types';
import { useFfmpegStatus } from '../../hooks/useQueues';

interface AddTaskModalProps {
  isOpen: boolean;
  taskType: string;
  onClose: () => void;
  onSubmit: (taskType: string, config: any) => Promise<void>;
  isSubmitting: boolean;
}

export function AddTaskModal({
  isOpen,
  taskType,
  onClose,
  onSubmit,
  isSubmitting,
}: AddTaskModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const titles: Record<string, string> = {
    copy: 'Add Copy Task',
    zip: 'Add Zip Task',
    tar: 'Add Tar Task',
    transcode: 'Add Transcode Task',
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-700">
          <h2 className="text-lg font-semibold text-gray-100">{titles[taskType] || 'Add Task'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-surface-700">
            <XIcon size={18} />
          </button>
        </div>
        {taskType === 'copy' && <CopyForm onSubmit={onSubmit} onClose={onClose} isSubmitting={isSubmitting} />}
        {taskType === 'zip' && <ZipForm onSubmit={onSubmit} onClose={onClose} isSubmitting={isSubmitting} />}
        {taskType === 'tar' && <TarForm onSubmit={onSubmit} onClose={onClose} isSubmitting={isSubmitting} />}
        {taskType === 'transcode' && <TranscodeForm onSubmit={onSubmit} onClose={onClose} isSubmitting={isSubmitting} />}
      </div>
    </div>
  );
}

interface FormProps {
  onSubmit: (taskType: string, config: any) => Promise<void>;
  onClose: () => void;
  isSubmitting: boolean;
}

function CopyForm({ onSubmit, onClose, isSubmitting }: FormProps) {
  const [source, setSource] = useState('');
  const [destination, setDestination] = useState('');
  const [error, setError] = useState<string | null>(null);

  const browseSource = async (isDir: boolean) => {
    const result = await open({ multiple: false, directory: isDir });
    if (result && typeof result === 'string') setSource(result);
  };

  const browseDestination = async () => {
    const result = await open({ multiple: false, directory: true });
    if (result && typeof result === 'string') setDestination(result);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!source.trim()) return setError('Source is required');
    if (!destination.trim()) return setError('Destination is required');
    try {
      await onSubmit('copy', { source: source.trim(), destination: destination.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-5 space-y-4">
        <div>
          <label className="input-label">Source File or Directory</label>
          <div className="flex gap-2">
            <input type="text" value={source} onChange={(e) => setSource(e.target.value)} placeholder="/path/to/source" className="input flex-1 font-mono text-sm" />
            <button type="button" onClick={() => browseSource(false)} className="btn-secondary"><FileIcon size={16} /></button>
            <button type="button" onClick={() => browseSource(true)} className="btn-secondary"><FolderIcon size={16} /></button>
          </div>
        </div>
        <div>
          <label className="input-label">Destination</label>
          <div className="flex gap-2">
            <input type="text" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="/path/to/destination" className="input flex-1 font-mono text-sm" />
            <button type="button" onClick={browseDestination} className="btn-secondary"><FolderIcon size={16} /></button>
          </div>
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
      </div>
      <FormFooter onClose={onClose} isSubmitting={isSubmitting} />
    </form>
  );
}

function MultiInputField({ inputs, setInputs }: { inputs: string[]; setInputs: (v: string[]) => void }) {
  const handleChange = (index: number, value: string) => {
    const next = [...inputs];
    next[index] = value;
    setInputs(next);
  };

  const browse = async (index: number, isDir: boolean) => {
    const result = await open({ multiple: false, directory: isDir });
    if (result && typeof result === 'string') handleChange(index, result);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="input-label mb-0">Input Files/Directories</label>
        <button type="button" onClick={() => setInputs([...inputs, ''])} className="btn-ghost text-xs py-1">
          <PlusIcon size={14} /> Add
        </button>
      </div>
      <div className="space-y-2 max-h-48 overflow-y-auto">
        {inputs.map((input, i) => (
          <div key={i} className="flex gap-2">
            <input type="text" value={input} onChange={(e) => handleChange(i, e.target.value)} placeholder="/path/to/item" className="input flex-1 font-mono text-sm" />
            <button type="button" onClick={() => browse(i, false)} className="btn-secondary p-2"><FileIcon size={14} /></button>
            <button type="button" onClick={() => browse(i, true)} className="btn-secondary p-2"><FolderIcon size={14} /></button>
            {inputs.length > 1 && (
              <button type="button" onClick={() => setInputs(inputs.filter((_, j) => j !== i))} className="btn-ghost p-2 text-gray-500 hover:text-status-error">
                <TrashIcon size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function ZipForm({ onSubmit, onClose, isSubmitting }: FormProps) {
  const [inputs, setInputs] = useState<string[]>(['']);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const browseOutput = async () => {
    const result = await open({ multiple: false, directory: true });
    if (result && typeof result === 'string') setOutput(result + '/archive.zip');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const valid = inputs.map((i) => i.trim()).filter(Boolean);
    if (valid.length === 0) return setError('At least one input is required');
    if (!output.trim()) return setError('Output path is required');
    if (!output.trim().endsWith('.zip')) return setError('Output must have .zip extension');
    try {
      await onSubmit('zip', { inputs: valid, output: output.trim() });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-5 space-y-4">
        <MultiInputField inputs={inputs} setInputs={setInputs} />
        <div>
          <label className="input-label">Output ZIP File</label>
          <div className="flex gap-2">
            <input type="text" value={output} onChange={(e) => setOutput(e.target.value)} placeholder="/path/to/output.zip" className="input flex-1 font-mono text-sm" />
            <button type="button" onClick={browseOutput} className="btn-secondary"><FolderIcon size={16} /></button>
          </div>
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
      </div>
      <FormFooter onClose={onClose} isSubmitting={isSubmitting} />
    </form>
  );
}

function TarForm({ onSubmit, onClose, isSubmitting }: FormProps) {
  const [inputs, setInputs] = useState<string[]>(['']);
  const [output, setOutput] = useState('');
  const [gzip, setGzip] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const browseOutput = async () => {
    const result = await open({ multiple: false, directory: true });
    if (result && typeof result === 'string') setOutput(result + (gzip ? '/archive.tar.gz' : '/archive.tar'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const valid = inputs.map((i) => i.trim()).filter(Boolean);
    if (valid.length === 0) return setError('At least one input is required');
    if (!output.trim()) return setError('Output path is required');
    try {
      await onSubmit('tar', { inputs: valid, output: output.trim(), gzip });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add task');
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-5 space-y-4">
        <MultiInputField inputs={inputs} setInputs={setInputs} />
        <div className="flex items-center gap-3">
          <input type="checkbox" id="gzip" checked={gzip} onChange={(e) => setGzip(e.target.checked)} className="w-4 h-4 rounded border-surface-600 bg-surface-700 text-accent" />
          <label htmlFor="gzip" className="text-sm text-gray-300">Compress with gzip (.tar.gz)</label>
        </div>
        <div>
          <label className="input-label">Output TAR File</label>
          <div className="flex gap-2">
            <input type="text" value={output} onChange={(e) => setOutput(e.target.value)} placeholder={gzip ? '/path/to/output.tar.gz' : '/path/to/output.tar'} className="input flex-1 font-mono text-sm" />
            <button type="button" onClick={browseOutput} className="btn-secondary"><FolderIcon size={16} /></button>
          </div>
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
      </div>
      <FormFooter onClose={onClose} isSubmitting={isSubmitting} />
    </form>
  );
}

function TranscodeForm({ onSubmit, onClose, isSubmitting }: FormProps) {
  const { available, encoders } = useFfmpegStatus();
  const [mode, setMode] = useState<'single' | 'batch'>('single');
  const [input, setInput] = useState('');
  const [inputDir, setInputDir] = useState('');
  const [outputDir, setOutputDir] = useState('');
  const [output, setOutput] = useState('');
  const [filenamePattern, setFilenamePattern] = useState('{filename}_transcoded');
  const [codec, setCodec] = useState('libx264');
  const [preset, setPreset] = useState('medium');
  const [crf, setCrf] = useState(23);
  const [resolution, setResolution] = useState('');
  const [audioCodec, setAudioCodec] = useState('aac');
  const [error, setError] = useState<string | null>(null);

  const browseInput = async () => {
    const result = await open({ multiple: false, filters: [{ name: 'Video', extensions: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv'] }] });
    if (result && typeof result === 'string') {
      setInput(result);
      setOutput(result.replace(/\.[^/.]+$/, '_converted.mp4'));
    }
  };

  const browseInputDir = async () => {
    const result = await open({ multiple: false, directory: true });
    if (result && typeof result === 'string') {
      setInputDir(result);
      if (!outputDir) {
        setOutputDir(result);
      }
    }
  };

  const browseOutputDir = async () => {
    const result = await open({ multiple: false, directory: true });
    if (result && typeof result === 'string') {
      setOutputDir(result);
    }
  };

  const browseOutput = async () => {
    const result = await open({ multiple: false, directory: true });
    if (result && typeof result === 'string') {
      const name = input.split('/').pop()?.replace(/\.[^/.]+$/, '') || 'output';
      setOutput(result + '/' + name + '_converted.mp4');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (mode === 'single') {
      if (!input.trim()) return setError('Input file is required');
      if (!output.trim()) return setError('Output path is required');
      try {
        await onSubmit('transcode', {
          input: input.trim(),
          output: output.trim(),
          codec,
          preset,
          crf,
          resolution: resolution || undefined,
          audio_codec: audioCodec,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add task');
      }
    } else {
      // Batch mode
      if (!inputDir.trim()) return setError('Input directory is required');
      if (!outputDir.trim()) return setError('Output directory is required');
      
      try {
        // Use Tauri's fs to read directory
        const { readDir } = await import('@tauri-apps/api/fs');
        const entries = await readDir(inputDir);
        
        // Filter video files
        const videoExtensions = ['mp4', 'mkv', 'avi', 'mov', 'webm', 'flv', 'wmv', 'mpg', 'mpeg', 'm4v'];
        const videoFiles = entries.filter(entry => {
          if (!entry.name) return false;
          const ext = entry.name.split('.').pop()?.toLowerCase();
          return ext && videoExtensions.includes(ext);
        });
        
        if (videoFiles.length === 0) {
          return setError('No video files found in directory');
        }
        
        // Create tasks for each file
        const outputExt = codec === 'copy' ? 'mp4' : 'mp4'; // Default to mp4
        let successCount = 0;
        
        for (const file of videoFiles) {
          const inputPath = `${inputDir}/${file.name}`;
          const fileNameWithoutExt = file.name!.replace(/\.[^/.]+$/, '');
          const outputFileName = filenamePattern
            .replace('{filename}', fileNameWithoutExt)
            .replace('{ext}', outputExt);
          const outputPath = `${outputDir}/${outputFileName}.${outputExt}`;
          
          try {
            await onSubmit('transcode', {
              input: inputPath,
              output: outputPath,
              codec,
              preset,
              crf,
              resolution: resolution || undefined,
              audio_codec: audioCodec,
            });
            successCount++;
            
            // Small delay between task submissions to prevent overwhelming the backend
            await new Promise(resolve => setTimeout(resolve, 50));
          } catch (err) {
            console.error(`Failed to add task for ${file.name}:`, err);
          }
        }
        
        if (successCount === 0) {
          throw new Error('Failed to add any tasks');
        }
        
        // Close modal after adding all tasks
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add tasks');
      }
    }
  };

  if (available === false) {
    return (
      <div className="p-5">
        <div className="bg-status-error/10 border border-status-error/30 rounded-lg p-4 text-center">
          <p className="text-status-error font-medium mb-2">FFmpeg Not Found</p>
          <p className="text-sm text-gray-400">Please install FFmpeg and ensure it's in your PATH.</p>
        </div>
        <div className="flex justify-end mt-4">
          <button type="button" onClick={onClose} className="btn-secondary">Close</button>
        </div>
      </div>
    );
  }

  const availableCodecs = VIDEO_CODECS.filter((c) => encoders.includes(c.value) || c.value === 'copy' || encoders.length === 0);

  return (
    <form onSubmit={handleSubmit}>
      <div className="p-5 space-y-4">
        {/* Mode selector */}
        <div>
          <label className="input-label">Mode</label>
          <div className="flex bg-surface-800 rounded-lg p-1">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                mode === 'single' ? 'bg-surface-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Single File
            </button>
            <button
              type="button"
              onClick={() => setMode('batch')}
              className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                mode === 'batch' ? 'bg-surface-700 text-gray-100' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              Batch (Directory)
            </button>
          </div>
        </div>

        {mode === 'single' ? (
          // Single file mode
          <>
            <div>
              <label className="input-label">Input Video File</label>
              <div className="flex gap-2">
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="/path/to/video.mp4" className="input flex-1 font-mono text-sm" />
                <button type="button" onClick={browseInput} className="btn-secondary"><FileIcon size={16} /></button>
              </div>
            </div>
            <div>
              <label className="input-label">Output File</label>
              <div className="flex gap-2">
                <input type="text" value={output} onChange={(e) => setOutput(e.target.value)} placeholder="/path/to/output.mp4" className="input flex-1 font-mono text-sm" />
                <button type="button" onClick={browseOutput} className="btn-secondary"><FolderIcon size={16} /></button>
              </div>
            </div>
          </>
        ) : (
          // Batch mode
          <>
            <div>
              <label className="input-label">Input Directory</label>
              <div className="flex gap-2">
                <input type="text" value={inputDir} onChange={(e) => setInputDir(e.target.value)} placeholder="/path/to/videos" className="input flex-1 font-mono text-sm" />
                <button type="button" onClick={browseInputDir} className="btn-secondary"><FolderIcon size={16} /></button>
              </div>
              <p className="text-xs text-gray-500 mt-1">All video files in this directory will be transcoded</p>
            </div>
            <div>
              <label className="input-label">Output Directory</label>
              <div className="flex gap-2">
                <input type="text" value={outputDir} onChange={(e) => setOutputDir(e.target.value)} placeholder="/path/to/output" className="input flex-1 font-mono text-sm" />
                <button type="button" onClick={browseOutputDir} className="btn-secondary"><FolderIcon size={16} /></button>
              </div>
            </div>
            <div>
              <label className="input-label">Output Filename Pattern</label>
              <input 
                type="text" 
                value={filenamePattern} 
                onChange={(e) => setFilenamePattern(e.target.value)} 
                placeholder="{filename}_transcoded" 
                className="input font-mono text-sm" 
              />
              <p className="text-xs text-gray-500 mt-1">
                Use <code className="bg-surface-700 px-1 rounded">{'{filename}'}</code> for the original filename (without extension)
              </p>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Video Codec</label>
            <select value={codec} onChange={(e) => setCodec(e.target.value)} className="input">
              {availableCodecs.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Preset</label>
            <select value={preset} onChange={(e) => setPreset(e.target.value)} className="input" disabled={codec === 'copy'}>
              {PRESETS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="input-label">Quality (CRF: {crf}) <span className="text-gray-500">Lower = better</span></label>
            <input type="range" min="0" max="51" value={crf} onChange={(e) => setCrf(parseInt(e.target.value))} className="w-full h-2 bg-surface-700 rounded-lg accent-accent" disabled={codec === 'copy'} />
          </div>
          <div>
            <label className="input-label">Resolution</label>
            <select value={resolution} onChange={(e) => setResolution(e.target.value)} className="input" disabled={codec === 'copy'}>
              <option value="">Keep original</option>
              {COMMON_RESOLUTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="input-label">Audio Codec</label>
          <select value={audioCodec} onChange={(e) => setAudioCodec(e.target.value)} className="input">
            {AUDIO_CODECS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        {error && <p className="text-sm text-status-error">{error}</p>}
      </div>
      <FormFooter onClose={onClose} isSubmitting={isSubmitting} />
    </form>
  );
}

function FormFooter({ onClose, isSubmitting }: { onClose: () => void; isSubmitting: boolean }) {
  return (
    <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-surface-700 bg-surface-900/50">
      <button type="button" onClick={onClose} className="btn-secondary" disabled={isSubmitting}>Cancel</button>
      <button type="submit" className="btn-primary" disabled={isSubmitting}>
        {isSubmitting ? (
          <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" /> Adding...</>
        ) : 'Add Task'}
      </button>
    </div>
  );
}
