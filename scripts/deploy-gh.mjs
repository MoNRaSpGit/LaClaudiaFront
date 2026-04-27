import { spawnSync } from 'node:child_process';

const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const ghPagesCmd = process.platform === 'win32' ? 'npx.cmd' : 'npx';

const buildResult = spawnSync(npmCmd, ['run', 'build:gh:prod'], {
  stdio: 'inherit',
  env: process.env
});

if (buildResult.status !== 0) {
  process.exit(buildResult.status || 1);
}

const publishResult = spawnSync(ghPagesCmd, ['gh-pages', '-d', 'dist'], {
  stdio: 'inherit',
  env: process.env
});

process.exit(publishResult.status || 1);

