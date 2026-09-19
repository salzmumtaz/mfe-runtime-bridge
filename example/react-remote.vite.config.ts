import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify('production'),
  },
  build: {
    lib: {
      entry: resolve(import.meta.dirname, 'src/remote/index.tsx'),
      formats: ['es'],
      fileName: () => 'react-remote.js',
    },
    outDir: resolve(import.meta.dirname, 'angular-host/public/remote'),
    emptyOutDir: true,
  },
});
