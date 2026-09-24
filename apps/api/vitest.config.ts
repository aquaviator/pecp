import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['test/**/*.test.ts']
  },
  resolve: {
    alias: {
      '@pecp/pe-domain': path.resolve(__dirname, '../../packages/pe-domain/src/index.ts'),
      '@pecp/platform-core': path.resolve(__dirname, '../../packages/platform-core/src/index.ts')
    }
  }
});
