import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  root: __dirname,
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: 3000,
    fs: {
      allow: ['../..']
    }
  },
  resolve: {
    alias: {
      '@pecp/pe-domain': path.resolve(__dirname, '../../packages/pe-domain/src/index.ts'),
      '@pecp/workload-engine': path.resolve(__dirname, '../../packages/workload-engine/src/index.ts'),
      '@pecp/artefact-engine': path.resolve(__dirname, '../../packages/artefact-engine/src/index.ts'),
      '@pecp/test-engine': path.resolve(__dirname, '../../packages/test-engine/src/index.ts')
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  }
});
