import { spawn } from 'node:child_process';

const children = new Set();
let shuttingDown = false;

const startProcess = (command, args, options = {}) => {
  const child = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    ...options,
  });
  children.add(child);
  child.on('exit', (code) => {
    if (!shuttingDown) {
      shutdown(typeof code === 'number' ? code : 0);
    }
  });
  return child;
};

const shutdown = (code = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  children.forEach((child) => {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  });
  setTimeout(() => {
    process.exit(code);
  }, 200);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

startProcess('vite', ['--host'], { shell: true });
startProcess(process.execPath, ['scripts/collabServer.mjs']);
