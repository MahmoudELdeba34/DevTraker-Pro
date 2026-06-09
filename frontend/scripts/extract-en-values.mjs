import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const enPath = path.join(root, 'src/app/core/i18n/translations/en.ts');
const content = fs.readFileSync(enPath, 'utf8');
const pattern = /^\s+'([^']+)':\s+'((?:\\'|[^'])*)',/gm;
const entries = [];
let m;
while ((m = pattern.exec(content)) !== null) {
  entries.push({ key: m[1], val: m[2].replace(/\\'/g, "'") });
}
console.log('keys:', entries.length);
const unique = [...new Set(entries.map((e) => e.val))];
console.log('unique values:', unique.length);
fs.writeFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'en-keys.json'), JSON.stringify(entries, null, 2));
