/**
 * Production build for Render / Railway / VPS.
 * Output: backend/dist + backend/public (Angular)
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BACKEND = path.join(ROOT, 'backend');
const FRONTEND = path.join(ROOT, 'frontend');
const PUBLIC = path.join(BACKEND, 'public');
const ANGULAR_OUT = path.join(FRONTEND, 'dist', 'frontend', 'browser');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function copyDir(src, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

console.log('=== WorkTrack — Render production build ===\n');

run('npm ci', BACKEND);
run('npm run build', BACKEND);

run('npm ci', FRONTEND);
run('npm run build -- --configuration production', FRONTEND);

if (!fs.existsSync(ANGULAR_OUT)) {
  console.error(`Angular build missing: ${ANGULAR_OUT}`);
  process.exit(1);
}

copyDir(ANGULAR_OUT, PUBLIC);
console.log(`\n✅ Built API → backend/dist`);
console.log(`✅ Built SPA → backend/public\n`);
