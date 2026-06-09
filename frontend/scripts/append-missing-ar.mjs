import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load T and KEEP from gen-ar-translations.py by importing as text and eval-like parse
const pyContent = fs.readFileSync(path.join(__dirname, 'gen-ar-translations.py'), 'utf8');
const tMatch = pyContent.match(/T = \{([\s\S]*?)\n\}/);
const keepMatch = pyContent.match(/KEEP = \{([\s\S]*?)\n\}/);

function parsePyDict(block) {
  const dict = {};
  const re = /"((?:\\.|[^"\\])*)":\s*"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = re.exec(block))) {
    dict[m[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')] =
      m[2].replace(/\\"/g, '"').replace(/\\n/g, '\n');
  }
  return dict;
}

const T = parsePyDict(tMatch[1]);
const KEEP = new Set(
  [...keepMatch[1].matchAll(/"([^"]+)"/g)].map((m) => m[1])
);

function parseTsKeys(content) {
  const map = {};
  const re = /^\s+'([^']+)':\s+'((?:\\'|[^'])*)',/gm;
  let m;
  while ((m = re.exec(content))) {
    map[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return map;
}

function translate(en) {
  if (KEEP.has(en)) return en;
  if (T[en]) return T[en];
  return null;
}

function escapeTs(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

const enPath = path.join(ROOT, 'src/app/core/i18n/translations/en.ts');
const arPath = path.join(ROOT, 'src/app/core/i18n/translations/ar.ts');

const en = parseTsKeys(fs.readFileSync(enPath, 'utf8'));
const ar = parseTsKeys(fs.readFileSync(arPath, 'utf8'));

const missing = Object.keys(en).filter((k) => !(k in ar)).sort();
console.log(`EN: ${Object.keys(en).length}, AR: ${Object.keys(ar).length}, Missing: ${missing.length}`);

const lines = [];
const untranslated = [];

for (const k of missing) {
  const enVal = en[k];
  let arVal = translate(enVal);
  if (arVal === null) {
    untranslated.push([k, enVal]);
    arVal = enVal;
  }
  lines.push(`  '${k}': '${escapeTs(arVal)}',`);
}

console.log(`Untranslated (fallback to EN): ${untranslated.length}`);
if (untranslated.length) {
  fs.writeFileSync(
    path.join(__dirname, 'untranslated-keys.json'),
    JSON.stringify(untranslated, null, 2),
    'utf8'
  );
  untranslated.slice(0, 10).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
}

const block =
  '\n  // ─── Synced missing keys ───\n' + lines.join('\n') + '\n';

let arContent = fs.readFileSync(arPath, 'utf8');
if (arContent.includes('// ─── Synced missing keys ───')) {
  console.error('Synced section already exists — aborting to avoid duplicates');
  process.exit(1);
}

arContent = arContent.replace(/\n\};\s*$/, block + '};\n');
fs.writeFileSync(arPath, arContent, 'utf8');
console.log(`Appended ${missing.length} keys to ar.ts`);
