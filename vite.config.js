import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const packageJson = JSON.parse(fs.readFileSync(new URL('./package.json', import.meta.url), 'utf8'));

function buildAppVersion(env) {
  if (env.VITE_APP_VERSION) {
    return String(env.VITE_APP_VERSION).trim();
  }

  return `${packageJson.version}-${new Date().toISOString()}`;
}

function buildForceLogoutFlag(env) {
  return String(env.VITE_APP_FORCE_LOGOUT || '').trim().toLowerCase() === 'true';
}

function createAppVersionPlugin(appVersion, forceLogout) {
  const payload = JSON.stringify(
    {
      version: appVersion,
      forceLogout,
      generatedAt: new Date().toISOString()
    },
    null,
    2
  );

  return {
    name: 'app-version-manifest',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = String(req.url || '').split('?')[0];
        if (!pathname.endsWith('/app-version.json')) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.end(payload);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'app-version.json',
        source: payload
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const appVersion = buildAppVersion(env);
  const forceLogout = buildForceLogoutFlag(env);
  const cacheDir = path.join(os.tmpdir(), 'laclau-vite-cache');

  return {
    plugins: [react(), createAppVersionPlugin(appVersion, forceLogout)],
    base: env.VITE_BASE_PATH || '/',
    cacheDir,
    define: {
      __APP_BUILD_VERSION__: JSON.stringify(appVersion)
    },
    test: {
      exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**']
    }
  };
});
