/**
 * Build a single folder ready to upload to MonsterASP.NET /wwwroot
 *
 * Usage:  node scripts/build-monsterasp.mjs
 * Output: monsterasp-publish/
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'monsterasp-publish');

function run(cmd, cwd) {
  console.log(`\n> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function rmDir(dir) {
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) copyDir(from, to);
    else fs.copyFileSync(from, to);
  }
}

console.log('=== DevTracker Pro — MonsterASP build ===\n');

run('npm run build', path.join(ROOT, 'backend'));
run('npm run build -- --configuration production', path.join(ROOT, 'frontend'));

const angularOut = path.join(ROOT, 'frontend', 'dist', 'frontend', 'browser');
if (!fs.existsSync(angularOut)) {
  console.error(`Angular build not found at ${angularOut}`);
  process.exit(1);
}

rmDir(OUT);
fs.mkdirSync(OUT, { recursive: true });

copyDir(path.join(ROOT, 'backend', 'dist'), path.join(OUT, 'dist'));
copyDir(angularOut, path.join(OUT, 'public'));

fs.copyFileSync(path.join(ROOT, 'deploy', 'server.js'), path.join(OUT, 'server.js'));
fs.copyFileSync(path.join(ROOT, 'deploy', 'web.config'), path.join(OUT, 'web.config'));
fs.copyFileSync(path.join(ROOT, 'backend', 'package.json'), path.join(OUT, 'package.json'));
fs.copyFileSync(path.join(ROOT, 'backend', 'package-lock.json'), path.join(OUT, 'package-lock.json'));
fs.copyFileSync(path.join(ROOT, 'backend', '.env.example'), path.join(OUT, '.env.example'));

fs.mkdirSync(path.join(OUT, 'logs'), { recursive: true });
fs.writeFileSync(path.join(OUT, 'logs', '.gitkeep'), '');

console.log('\n> npm ci --omit=dev (production dependencies only)');
run('npm ci --omit=dev', OUT);

const readme = `# MonsterASP upload folder

Upload ALL files in this folder to your website /wwwroot via FTP or WebDeploy.

Before first run:
1. Copy .env.example to .env on the server (or set variables in Control Panel)
2. Set MONGODB_URI, JWT_SECRET, FRONTEND_URL=https://your-domain.monsterasp.net
3. Restart App Pool in MonsterASP Control Panel

Test: https://your-site/api/health
`;
fs.writeFileSync(path.join(OUT, 'UPLOAD-README.txt'), readme);

console.log('\n✅ Done! Upload folder: monsterasp-publish/');
console.log('   See MONSTERASP_DEPLOY.md for full steps.\n');
