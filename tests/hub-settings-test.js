/* node tests/hub-settings-test.js
   2026-10-05 (her call): every Care Coordinator Hub setting starts from the Admin page's Hub settings list; each opens
   that one setting in the Hub (#settings/<name>). Checks the list draws, every link is a setting the Hub really has
   (read from ../cc-hub-live/index.html when it is next to this folder), and nothing new has an em dash. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
let pass = 0, fail = 0; const ck = (n, c, d) => { if (c) { pass++; console.log('PASS  ' + n) } else { fail++; console.log('FAIL  ' + n + '  ' + JSON.stringify(d ?? '').slice(0, 400)) } };
const code = html.slice(html.indexOf('const HUB_SETTINGS=['), html.indexOf('const swIsOn='));
const el = { innerHTML: '' };
const ctx = { document: { getElementById: () => el }, esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])) };
vm.createContext(ctx); vm.runInContext(code + '\nthis.__l=HUB_SETTINGS; renderHubSettings();', ctx);
const keys = ctx.__l.flatMap(([, l]) => l.map(x => x[0]));
ck('the Hub settings section is on the page, drawn at load', html.includes('<section id="hubsettings">') && /renderSwitches\(\); renderHubSettings\(\);/.test(html));
ck('every setting has a name, what it controls, and opens in the Hub in a new tab', keys.length >= 20 && keys.every(k => el.innerHTML.includes('href="https://cc.mo-care.com/#settings/' + k + '" target="_blank" rel="noopener"')), keys);
ck('the missed clock-in text is one of them', el.innerHTML.includes('#settings/missed-clockins') && /Missed clock-ins/.test(el.innerHTML));
ck('each one listed once', new Set(keys).size === keys.length);
const hub = path.join(__dirname, '..', '..', 'cc-hub-live', 'index.html');
if (fs.existsSync(hub)) {
  const h = fs.readFileSync(hub, 'utf8'), have = new Set([...h.matchAll(/data-set="([a-z-]+)"/g)].map(m => m[1]));
  const missing = keys.filter(k => !have.has(k));
  ck('every link is a setting the Hub really has', !missing.length, missing);
} else console.log('SKIP  the Hub is not next to this folder');
const sec = html.slice(html.indexOf('<section id="hubsettings">'), html.indexOf('</section>', html.indexOf('<section id="hubsettings">')));
ck('no em dashes in anything new', !/—/.test(sec + code));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
