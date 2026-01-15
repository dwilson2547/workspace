import type { ElectronAPI, FilePickerOptions } from '@shared/types';

interface FilePickerProps {
  label: string;
  value: string;
  placeholder?: string;
  mode: FilePickerOptions['mode'];
  onChange: (value: string) => void;
}

declare global {
  interface Window {
    api: ElectronAPI;
  }
}

export default function FilePicker({ label, value, placeholder, mode, onChange }: FilePickerProps) {
  const handleBrowse = async (overrideMode?: FilePickerOptions['mode']) => {
    const selection = await window.api.pickPath({
      mode: overrideMode ?? mode,
      allowMultiple: false
    });
    if (selection.length > 0) {
      onChange(selection[0]);
    }
  };

  return (
    <label className="file-picker">
      <span>{label}</span>
      <div className="file-picker-row">
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
        />
        <div className="file-picker-controls">
          {mode === 'fileOrDirectory' ? (
            <>
              <button type="button" className="secondary" onClick={() => handleBrowse('file')}>
                Pick File
              </button>
              <button type="button" className="secondary" onClick={() => handleBrowse('directory')}>
                Pick Folder
              </button>
            </>
          ) : (
            <button type="button" className="secondary" onClick={() => handleBrowse()}>
              Browse
            </button>
          )}
        </div>
      </div>
    </label>
  );
}
