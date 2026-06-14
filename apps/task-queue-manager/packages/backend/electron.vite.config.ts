import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import path from 'path';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/main',
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'src/main/main.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@tqm/shared': path.resolve(__dirname, '../../shared/src'),
      },
    },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'dist/preload',
      rollupOptions: {
        input: {
          preload: path.resolve(__dirname, 'src/preload/preload.ts'),
        },
      },
    },
    resolve: {
      alias: {
        '@tqm/shared': path.resolve(__dirname, '../../shared/src'),
      },
    },
  },
});
