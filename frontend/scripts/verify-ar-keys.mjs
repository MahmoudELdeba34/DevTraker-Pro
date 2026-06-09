import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parse(content) {
  const map = {};
  const re = /^\s+'([^']+)':\s+'((?:\\'|[^'])*)',/gm;
  let m;
  while ((m = re.exec(content))) {
    map[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return map;
}

const enPath = path.join(ROOT, 'src/app/core/i18n/translations/en.ts');
const arPath = path.join(ROOT, 'src/app/core/i18n/translations/ar.ts');
const arContent = fs.readFileSync(arPath, 'utf8');

const en = parse(fs.readFileSync(enPath, 'utf8'));
const ar = parse(arContent);

const missing = Object.keys(en).filter((k) => !(k in ar));
const syncedStart = arContent.indexOf('// ─── Synced missing keys ───');
const synced = parse(arContent.slice(syncedStart));

const identical = Object.keys(en)
  .filter((k) => k in synced && synced[k] === en[k]);

console.log('EN keys:', Object.keys(en).length);
console.log('AR keys:', Object.keys(ar).length);
console.log('Missing EN keys in AR:', missing.length);
console.log('Synced section keys:', Object.keys(synced).length);
console.log('Synced keys still identical to EN:', identical.length);
identical.forEach((k) => console.log(`  ${k}: ${en[k]}`));

if (missing.length > 0) process.exit(1);
