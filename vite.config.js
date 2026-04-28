import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || '/',
    test: {
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**']
    }
  };
});
