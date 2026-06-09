import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseTs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const pattern = /^\s+'([^']+)':\s+'((?:\\'|[^'])*)',?$/gm;
  const entries = {};
  let m;
  while ((m = pattern.exec(content)) !== null) {
    entries[m[1]] = m[2].replace(/\\'/g, "'");
  }
  return entries;
}

function parsePythonT(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const start = content.indexOf('T = {');
  const end = content.indexOf('\n}\n\ndef translate');
  const block = content.slice(start + 4, end + 1);
  const T = {};
  const patterns = [
    /^\s+"((?:\\"|[^"])*)":\s+"((?:\\"|[^"])*)",?\s*$/gm,
    /^\s+'((?:\\'|[^'])*)':\s+"((?:\\"|[^"])*)",?\s*$/gm,
    /^\s+'((?:\\'|[^'])*)':\s+'((?:\\'|[^'])*)',?\s*$/gm,
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(block)) !== null) {
      const k = m[1].replace(/\\"/g, '"').replace(/\\'/g, "'");
      const v = m[2].replace(/\\"/g, '"').replace(/\\'/g, "'");
      T[k] = v;
    }
  }
  return T;
}

const KEEP = new Set([
  'ProTrack', 'DevTracker Pro', 'English', 'HR', 'SMTP', 'API', 'WhatsApp', 'Slack', 'PDF',
  'Engineering', 'Lead Dev', 'John Doe', 'employee@company.com', 'you@example.com', 'name@company.com',
  '*',
]);

/** Manual translations not present in gen-ar-translations.py */
const MANUAL = {
  'Employee Roster': 'سجل الموظفين',
  'In {{time}}': 'دخول {{time}}',
  'Out {{time}}': 'خروج {{time}}',
  'No pending leave requests.': 'لا طلبات إجازة معلّقة.',
  'No pending overtime claims.': 'لا مطالبات وقت إضافي معلّقة.',
  'No pending permissions.': 'لا أذونات معلّقة.',
  'Password reset link sent to your email.': 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.',
  'Showing {{shown}} of {{total}} {{memberWord}}': 'عرض {{shown}} من {{total}} {{memberWord}}',
  '{{count}} {{memberWord}}': '{{count}} {{memberWord}}',
  '{{email}} · {{role}}': '{{email}} · {{role}}',
  '{{name}} ({{role}})': '{{name}} ({{role}})',
  '{{userName}} — {{reportType}}': '{{userName}} — {{reportType}}',
  '{{workspaceName}} · {{weekStart}} - {{weekEnd}}': '{{workspaceName}} · {{weekStart}} - {{weekEnd}}',
  'Language switched to English': 'تم التبديل إلى English',
  'Monitor working hours, project contributions, and overtime tracking.':
    'راقب ساعات العمل ومساهمات المشاريع وتتبع الوقت الإضافي.',
};

const enKeys = JSON.parse(fs.readFileSync(path.join(__dirname, 'en-keys.json'), 'utf8'));
const unique = [...new Set(enKeys.map((k) => k.val))].sort();

const pyT = parsePythonT(path.join(__dirname, 'gen-ar-translations.py'));
const en = parseTs(path.join(__dirname, '../src/app/core/i18n/translations/en.ts'));
const ar = parseTs(path.join(__dirname, '../src/app/core/i18n/translations/ar.ts'));

// Primary: Python T, then manual, then ar.ts gaps only
const valueMap = { ...pyT, ...MANUAL };

for (const [key, enVal] of Object.entries(en)) {
  if (!(enVal in valueMap)) {
    const arVal = ar[key];
    if (arVal && arVal !== enVal) {
      valueMap[enVal] = arVal;
    }
  }
}

for (const k of KEEP) {
  valueMap[k] = k;
}

const finalMap = {};
const missing = [];
for (const v of unique) {
  if (valueMap[v]) {
    finalMap[v] = valueMap[v];
  } else {
    missing.push(v);
    finalMap[v] = v;
  }
}

fs.writeFileSync(
  path.join(__dirname, 'ar-translations-map.json'),
  JSON.stringify(finalMap, null, 2) + '\n',
  'utf8'
);

console.log('Unique:', unique.length);
console.log('Final map entries:', Object.keys(finalMap).length);
console.log('Still missing:', missing.length);
if (missing.length) missing.forEach((v) => console.log(' ', JSON.stringify(v)));

const stillEnglish = unique.filter((v) => {
  if (KEEP.has(v)) return false;
  const t = finalMap[v];
  return !t || t === v;
});
console.log('Still English (non-KEEP):', stillEnglish.length);
stillEnglish.forEach((v) => console.log(' ', JSON.stringify(v), '=>', JSON.stringify(finalMap[v])));
