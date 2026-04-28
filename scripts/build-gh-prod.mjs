import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function readEnvValueFromFile(filePath, key) {
  if (!existsSync(filePath)) {
    return '';
  }

  const raw = readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) {
      continue;
    }

    const currentKey = trimmed.slice(0, separatorIndex).trim();
    if (currentKey !== key) {
      continue;
    }

    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    return rawValue.replace(/^['"]|['"]$/g, '').trim();
  }

  return '';
}

function resolveProdApiUrl() {
  const envValue = String(process.env.VITE_API_URL_PROD || '').trim();
  if (envValue) {
    return envValue;
  }

  const rootDir = resolve(process.cwd());
  const envCandidates = [
    '.env.local',
    '.env',
    '.env.production.local',
    '.env.production'
  ];

  for (const candidate of envCandidates) {
    const value = readEnvValueFromFile(resolve(rootDir, candidate), 'VITE_API_URL_PROD');
    if (value) {
      return value;
    }
  }

  return '';
}

const prodApiUrl = resolveProdApiUrl();

if (!prodApiUrl) {
  console.error('Falta VITE_API_URL_PROD para build de produccion de GitHub Pages.');
  console.error('Definila en variable de entorno o en .env/.env.local.');
  process.exit(1);
}

function runCommand(command, args, extraEnv = {}) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', command, ...args], {
      stdio: 'inherit',
      env: {
        ...process.env,
        ...extraEnv
      }
    });
  }

  return spawnSync(command, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      ...extraEnv
    }
  });
}

const result = runCommand('npm', ['run', 'build:gh'], {
  VITE_API_URL: prodApiUrl
});

if (typeof result.status === 'number') {
  process.exit(result.status);
}

if (result.error) {
  console.error('Error ejecutando build:gh:', result.error.message);
}

if (result.signal) {
  console.error('build:gh terminado por signal:', result.signal);
}

process.exit(1);
