import { spawnSync } from 'node:child_process';

const prodApiUrl = String(process.env.VITE_API_URL_PROD || '').trim();

if (!prodApiUrl) {
  console.error('Falta VITE_API_URL_PROD para build de produccion de GitHub Pages.');
  console.error('Definila antes de ejecutar: npm run build:gh:prod');
  process.exit(1);
}

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npmCmd, ['run', 'build:gh'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VITE_API_URL: prodApiUrl
  }
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

process.exit(1);

