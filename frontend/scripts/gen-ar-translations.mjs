import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EN_PATH = path.join(__dirname, '../src/app/core/i18n/translations/en.ts');
const AR_PATH = path.join(__dirname, '../src/app/core/i18n/translations/ar.ts');

const KEEP = new Set([
  'ProTrack', 'DevTracker Pro', 'English', 'HR', 'SMTP', 'API', 'WhatsApp', 'Slack', 'PDF',
  'Engineering', 'Lead Dev', 'John Doe', 'employee@company.com', 'you@example.com', 'name@company.com',
]);

// Load translation map from embedded JSON-like object - read from separate file if needed
const T = JSON.parse(fs.readFileSync(path.join(__dirname, 'ar-map.json'), 'utf8'));

function translate(en) {
  if (KEEP.has(en)) return en;
  if (T[en]) return T[en];
  return en;
}

const content = fs.readFileSync(EN_PATH, 'utf8');
const pattern = /^(\s+'([^']+)':\s+)'((?:\\'|[^'])*)'(,?)$/gm;
const missing = [];

const out = content.replace(pattern, (full, prefix, key, val, comma) => {
  const raw = val.replace(/\\'/g, "'");
  const ar = translate(raw);
  if (ar === raw && !KEEP.has(raw)) missing.push({ key, raw });
  const escaped = ar.replace(/'/g, "\\'");
  return `${prefix}'${escaped}'${comma}`;
});

fs.writeFileSync(AR_PATH, out.replace('export const EN:', 'export const AR:'));
console.log(`Wrote ${AR_PATH}`);
console.log(`Untranslated: ${missing.length}`);
missing.slice(0, 40).forEach(({ key, raw }) => console.log(`  ${key}: ${raw}`));
