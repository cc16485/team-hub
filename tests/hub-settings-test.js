/* node tests/hub-settings-test.js
   2026-10-05 (her call): every Care Coordinator Hub setting is on the Admin page, in its own Hub settings tab: the list
   on the left, the setting itself on the right (the Hub's own, shown in place with ?embed=settings). Checks the tab,
   the list, the frame address, that every name is a setting the Hub really has (read from ../cc-hub-live/index.html
   when it is next to this folder), the height message only trusted from cc.mo-care.com, and no em dashes. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
let pass = 0, fail = 0; const ck = (n, c, d) => { if (c) { pass++; console.log('PASS  ' + n) } else { fail++; console.log('FAIL  ' + n + '  ' + JSON.stringify(d ?? '').slice(0, 400)) } };
const code = html.slice(html.indexOf('const HUB_SETTINGS=['), html.indexOf('const swIsOn='));
const els = {}, mk = (id) => els[id] = els[id] || { id, innerHTML: '', textContent: '', style: {}, href: '', _src: null,
  setAttribute(k, v) { if (k === 'src') this._src = v; }, getAttribute(k) { return k === 'src' ? this._src : null; },
  classList: { toggle() {} } };
let onMsg = null; const store = {};
const ctx = { document: { getElementById: mk, querySelectorAll: () => [] }, history: { replaceState() {} }, location: { pathname: '/admin.html', hash: '' },
  localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
  window: { addEventListener: (t, f) => { if (t === 'message') onMsg = f; } },
  esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])), Math, Number };
vm.createContext(ctx); vm.runInContext(code + '\nthis.__l=HUB_SETTINGS; this.__t=adminTab; this.__s=hsShow;', ctx);
const keys = ctx.__l.flatMap(([, l]) => l.map(x => x[0]));
ck('the Admin page has two tabs: Admin and Hub settings', /<button data-t="admin"[^>]*>Admin<\/button>/.test(html) && /<button data-t="hubsettings"[^>]*>Hub settings<\/button>/.test(html) && html.includes('<main id="adminView">') && html.includes('<div id="hsView">'));
ctx.__t('hubsettings');
ck('opening the tab shows the Missed clock-ins setting first, in place', els.hsFrame._src === 'https://cc.mo-care.com/?embed=settings#settings/missed-clockins' && els.hsTitle.textContent === 'Missed clock-ins' && els.hsView.style.display === 'block' && els.adminView.style.display === 'none', [els.hsFrame._src, els.hsTitle.textContent]);
ck('the list on the left has every setting, plus all of them on one page', keys.length >= 21 && keys.every(k => els.hsList.innerHTML.includes('data-k="' + k + '"')) && /All Hub settings on one page/.test(els.hsList.innerHTML), keys.length);
ctx.__s('cadences');
ck('choosing another: same frame, new setting, its name and what it controls', els.hsFrame._src === 'https://cc.mo-care.com/?embed=settings#settings/cadences' && els.hsTitle.textContent === 'Cadences' && /check-in/.test(els.hsWhat.textContent) && els.hsOwn.href === 'https://cc.mo-care.com/#settings/cadences');
ck('...and it is remembered for next time', store.admin_hs === 'cadences');
ctx.__s(''); ck('"All Hub settings on one page" shows them all', els.hsFrame._src === 'https://cc.mo-care.com/?embed=settings#settings' && els.hsTitle.textContent === 'All Hub settings');
ctx.__t('admin'); ck('back to Admin', els.adminView.style.display === '' && els.hsView.style.display === 'none');
els.hsFrame.style.height = '';
onMsg({ origin: 'https://evil.example', data: { type: 'cc-settings-height', h: 9000 } });
ck('a height message from anywhere but cc.mo-care.com is ignored', els.hsFrame.style.height === '');
onMsg({ origin: 'https://cc.mo-care.com', data: { type: 'cc-settings-height', h: 1400 } });
ck('the Hub frame grows to the setting\'s height (no inner scroll bar)', els.hsFrame.style.height === '1400px');
ck('each one listed once', new Set(keys).size === keys.length);
ck('the address opens the tab: admin#hubsettings/<name>', /#hubsettings\(\?:\\\/\(\[a-z-\]\*\)\)\?\$/.test(html) && html.includes("adminTab('hubsettings')"));
ck('the switch groups point at the tab, not a new window', html.includes('href="#hubsettings" onclick="adminTab(\\\'hubsettings\\\');return false;">More settings</a>'));
const hub = path.join(__dirname, '..', '..', 'cc-hub-live', 'index.html');
if (fs.existsSync(hub)) {
  const h = fs.readFileSync(hub, 'utf8'), have = new Set([...h.matchAll(/data-set="([a-z-]+)"|dataset\.set='([a-z-]+)'/g)].map(m => m[1] || m[2]));
  const missing = keys.filter(k => !have.has(k));
  ck('every name is a setting the Hub really has', !missing.length, missing);
  ck('the Hub has the settings-only mode the frame uses', h.includes("embed=settings") && h.includes("cc-settings-height"));
} else console.log('SKIP  the Hub is not next to this folder');
const view = html.slice(html.indexOf('<div id="hsView">'), html.indexOf('<script>', html.indexOf('<div id="hsView">')));
ck('no em dashes in anything new', !/—/.test(view + code));
console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
