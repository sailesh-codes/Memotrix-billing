import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('\x1b[36m%s\x1b[0m', '   Starting Memotrix Development Environment    ');
console.log('\x1b[36m%s\x1b[0m', '================================================');
console.log('\x1b[90mBackend directory: %s\x1b[0m', path.join(rootDir, 'backend'));
console.log('\x1b[90mFrontend directory: %s\x1b[0m', path.join(rootDir, 'frontend'));
console.log('');

function runProcess(name, color, cwd, command, args) {
  const proc = spawn(command, args, {
    cwd,
    stdio: ['inherit', 'pipe', 'pipe'],
    shell: isWindows,
    env: { ...process.env, FORCE_COLOR: 'true' }
  });

  const prefix = `${color}[${name}]\x1b[0m `;

  proc.stdout.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.log(`${prefix}${line}`);
      }
    }
  });

  proc.stderr.on('data', (data) => {
    const lines = data.toString().split(/\r?\n/);
    for (const line of lines) {
      if (line.trim().length > 0) {
        console.error(`${prefix}\x1b[31m${line}\x1b[0m`);
      }
    }
  });

  proc.on('close', (code) => {
    console.log(`${prefix}process exited with code ${code}`);
  });

  return proc;
}

const backendProc = runProcess(
  'BACKEND',
  '\x1b[34m', // Blue
  path.join(rootDir, 'backend'),
  npmCmd,
  ['run', 'dev']
);

const frontendProc = runProcess(
  'FRONTEND',
  '\x1b[32m', // Green
  path.join(rootDir, 'frontend'),
  npmCmd,
  ['run', 'dev']
);

function cleanup() {
  console.log('\n\x1b[33mShutting down Memotrix processes...\x1b[0m');
  try {
    if (backendProc && !backendProc.killed) {
      if (isWindows) {
        spawn('taskkill', ['/pid', backendProc.pid.toString(), '/f', '/t']);
      } else {
        backendProc.kill('SIGINT');
      }
    }
  } catch (e) {}

  try {
    if (frontendProc && !frontendProc.killed) {
      if (isWindows) {
        spawn('taskkill', ['/pid', frontendProc.pid.toString(), '/f', '/t']);
      } else {
        frontendProc.kill('SIGINT');
      }
    }
  } catch (e) {}

  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
process.on('exit', cleanup);
