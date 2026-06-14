/// <reference types="vite/client" />

interface Window {
  electronAPI: {
    selectFolder: () => Promise<string | null>
    selectFiles: () => Promise<string[]>
  }
}
