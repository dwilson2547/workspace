import { useState } from 'react';
import type { FilePickerOptions } from '@shared/types';

interface FilePickerProps {
  label: string;
  value: string;
  placeholder?: string;
  mode: FilePickerOptions['mode'];
  onChange: (value: string) => void;
}

declare global {
  interface Window {
    api: {
      pickPath: (options: FilePickerOptions) => Promise<string[]>;
    };
  }
}

export default function FilePicker({ label, value, placeholder, mode, onChange }: FilePickerProps) {
  const [selectionMode, setSelectionMode] = useState<FilePickerOptions['mode']>(
    mode === 'fileOrDirectory' ? 'file' : mode
  );

  const handleBrowse = async () => {
    const selection = await window.api.pickPath({
      mode: mode === 'fileOrDirectory' ? selectionMode : mode,
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
          {mode === 'fileOrDirectory' && (
            <select
              value={selectionMode}
              onChange={(event) => setSelectionMode(event.target.value as FilePickerOptions['mode'])}
            >
              <option value="file">File</option>
              <option value="directory">Directory</option>
            </select>
          )}
          <button type="button" className="secondary" onClick={handleBrowse}>
            Browse
          </button>
        </div>
      </div>
    </label>
  );
}
