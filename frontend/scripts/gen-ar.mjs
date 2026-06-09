import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const entries = JSON.parse(fs.readFileSync(path.join(scriptDir, 'en-keys.json'), 'utf8'));

// Import translations from Python script by reading and parsing - use inline map file
const mapPath = path.join(scriptDir, 'ar-translations-map.json');
if (!fs.existsSync(mapPath)) {
  console.error('Missing ar-translations-map.json');
  process.exit(1);
}
const T = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

const KEEP = new Set([
  'ProTrack', 'DevTracker Pro', 'English', 'HR', 'SMTP', 'API', 'WhatsApp', 'Slack', 'PDF',
  'Engineering', 'Lead Dev', 'John Doe', 'employee@company.com', 'you@example.com', 'name@company.com',
]);

function translate(en) {
  if (KEEP.has(en)) return en;
  return T[en] ?? en;
}

const enPath = path.join(scriptDir, '../src/app/core/i18n/translations/en.ts');
const arPath = path.join(scriptDir, '../src/app/core/i18n/translations/ar.ts');
const content = fs.readFileSync(enPath, 'utf8');
const pattern = /^(\s+'([^']+)':\s+)'((?:\\'|[^'])*)'(,?)$/gm;
const missing = new Set();

const out = content.replace(pattern, (full, prefix, key, val, comma) => {
  const raw = val.replace(/\\'/g, "'");
  const ar = translate(raw);
  if (ar === raw && !KEEP.has(raw)) missing.add(raw);
  const escaped = ar.replace(/'/g, "\\'");
  return `${prefix}'${escaped}'${comma}`;
});

fs.writeFileSync(arPath, out.replace('export const EN:', 'export const AR:'));
console.log(`Wrote ${arPath}`);
console.log(`Untranslated unique values: ${missing.size}`);
[...missing].sort().slice(0, 50).forEach((v) => console.log(' -', v));
