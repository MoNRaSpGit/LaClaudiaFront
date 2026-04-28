import { spawnSync } from 'node:child_process';

function runCommand(command, args) {
  if (process.platform === 'win32') {
    return spawnSync('cmd.exe', ['/d', '/s', '/c', command, ...args], {
      stdio: 'inherit',
      env: process.env
    });
  }

  return spawnSync(command, args, {
    stdio: 'inherit',
    env: process.env
  });
}

const buildResult = runCommand('npm', ['run', 'build:gh:prod']);

if (buildResult.status !== 0) {
  process.exit(buildResult.status || 1);
}

const publishResult = runCommand('npx', ['gh-pages', '-d', 'dist']);

process.exit(publishResult.status || 1);
