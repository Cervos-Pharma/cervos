// One-off: list every t('key') used in src/ that has no English translation,
// alongside the Kiswahili value (source for the English rewrite).
const fs = require('fs'), path = require('path');
const used = new Set();
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f);
    const st = fs.statSync(p);
    if (st.isDirectory()) { if (f === 'node_modules') continue; walk(p); continue; }
    if (!/\.(tsx|ts)$/.test(f)) continue;
    const src = fs.readFileSync(p, 'utf8');
    for (const m of src.matchAll(/\bt\(\s*'([^']+)'\s*\)/g)) used.add(m[1]);
  }
}
walk(path.join(__dirname, '..', 'cervos-desktop', 'src'));
const i18n = fs.readFileSync(path.join(__dirname, '..', 'cervos-desktop', 'src', 'lib', 'i18n.ts'), 'utf8');
const enStart = i18n.indexOf('  en: {');
const swStart = i18n.indexOf('  sw: {');
const enBlock = i18n.slice(enStart, swStart);
const swBlock = i18n.slice(swStart);
const kv = (block) => {
  const map = {};
  const re = /'([a-zA-Z0-9_.]+)':\s*(?:'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)")/g;
  for (const m of block.matchAll(re)) map[m[1]] = m[2] !== undefined ? m[2] : m[3];
  return map;
};
const sw = kv(swBlock), en = kv(enBlock);
const missing = [...used].filter(k => !(k in en)).sort();
console.log('missing in EN:', missing.length);
for (const k of missing) {
  const v = sw[k] !== undefined ? sw[k] : '???MISSING_SW_TOO???';
  console.log(JSON.stringify(k) + ' => ' + JSON.stringify(v));
}
