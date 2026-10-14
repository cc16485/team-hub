/* node tests/admin-nurse-services-test.js
   Nurse services on the Admin page (2026-10-14, the LPN nurse visit plan; Desktop 707): the list nurse-visit-check reads
   (ops_settings.nurse_services). The real code, cut out of admin.html, runs against a fake database that does what
   app_data_save does (compare-and-save on version) and a fake nurse-visit-check that hands back the built-in list. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return html.slice(a, b); };
const code = [cut('async function readKeyV(', '/* ── status'), cut('/* ── Nurse services', '/* ── Switches')].join('\n');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 700))); };
const DEFAULTS = [
  { key: 'med_setup', name: 'Weekly medication organizer setup', axis: ['medication organizer', 'med setup'], lpn: true, auth: true, rn_sign: false, rn_sign_if_lpn: false, note: true, tasks: [], generic: false, priority: true, active: true },
  { key: 'ghe', name: 'General Health Evaluation', axis: ['general health evaluation', 'GHE'], lpn: true, auth: true, rn_sign: false, rn_sign_if_lpn: true, note: false, tasks: [], generic: false, priority: true, active: true },
  { key: 'nurse_visit', name: 'Authorized nurse visit (not named more exactly)', axis: ['T1001'], lpn: true, auth: true, rn_sign: false, rn_sign_if_lpn: false, note: true, tasks: [], generic: true, priority: false, active: true }]
function world(opt = {}) {
  const db = { ops_settings: { data: JSON.parse(JSON.stringify(opt.start || { ghe_watch_live: true })), version: 4 } };
  const events = [], confirms = [], card = { innerHTML: '' }; let reads = 0
  const ctx = { console, JSON, Object, Array, String, Number, Date, Error,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    say() {}, alert() {}, confirm: m => { confirms.push(m); return opt.yes !== false; },
    recordEvent: async (row) => { events.push(row); return { ok: true }; },
    ME: { email: 'samantha@mo-care.com' }, OPS: JSON.parse(JSON.stringify(db.ops_settings.data)),
    document: { getElementById: id => id === 'nsvcCard' ? card : null }, window: {},
    sb: {
      functions: { invoke: async (name, o) => opt.noServer ? { data: null, error: { message: 'not found' } } : { data: { ok: true, defaults: JSON.parse(JSON.stringify(DEFAULTS)), current: null, from: 'built-in' } } },
      from: () => { const b = { select() { return b; }, eq(k, v) { b.key = v; return b; }, async maybeSingle() { reads++; const r = db[b.key];
        if (opt.raceOnFirstRead && reads === 1) { const out = { data: { data: JSON.parse(JSON.stringify(r.data)), version: r.version }, error: null }; db.ops_settings.data.late_watch_live = true; db.ops_settings.version++; return out; }
        return { data: r ? { data: JSON.parse(JSON.stringify(r.data)), version: r.version } : null, error: null }; } }; return b; },
      async rpc(name, a) { if (name !== 'app_data_save') return { error: { message: 'unexpected ' + name } };
        const r = db[a.p_key]; if (r.version !== a.p_expected_version) return { data: { ok: false }, error: null };
        db[a.p_key] = { data: a.p_data, version: r.version + 1 }; return { data: { ok: true }, error: null }; } } };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.__x={ nsvcLoad, nsvcSet, nsvcAdd, nsvcSave, nsvcClean, renderNurseServices, get NSVC(){ return NSVC }, get MSG(){ return NSVC_MSG } };', ctx);
  return { X: ctx.__x, ctx, db, events, confirms, card };
}
(async () => {
  let W = world(); await W.X.nsvcLoad();
  ck('nothing saved yet: shows the built-in list from the server, says nothing is saved until Save', W.X.NSVC.length === 3 && /Using the built-in list\. Nothing is saved until you press Save\./.test(W.card.innerHTML) && /Weekly medication organizer setup/.test(W.card.innerHTML) && (W.card.innerHTML.match(/type="checkbox"/g) || []).length === 21, W.card.innerHTML.slice(0, 400));
  ck('...each service: name, AxisCare match, care tasks, and the seven flags with words', /AxisCare service names or codes, separated by commas/.test(W.card.innerHTML) && /AxisCare care tasks that must be marked done/.test(W.card.innerHTML) && /RN signs when an LPN did it/.test(W.card.innerHTML) && /Catch-all \(any other T1001 visit\)/.test(W.card.innerHTML));
  W.X.nsvcAdd(); const n = W.X.NSVC.length - 1;
  W.X.nsvcSet(n, 'name', 'Wound check'); W.X.nsvcSet(n, 'axis', 'wound check, T1001-W'); W.X.nsvcSet(0, 'name', 'Medication organizer setup and review'); W.X.nsvcSet(1, 'note', true)
  await W.X.nsvcSave();
  const saved = W.db.ops_settings.data.nurse_services;
  ck('add and rename, then Save: asks first, saves the list through mergeSave (compare-and-save), only that setting', /^Save the nurse services for everyone\?/.test(W.confirms[0]) && W.db.ops_settings.version === 5 && saved.length === 4 && saved[0].name === 'Medication organizer setup and review' && saved[0].key === 'med_setup' && saved[3].key === 'wound_check' && saved[3].axis.join('|') === 'wound check|T1001-W' && saved[1].note === true && W.db.ops_settings.data.ghe_watch_live === true, W.db.ops_settings.data);
  ck('...who and when are kept, and it is recorded (setting_changed)', W.db.ops_settings.data.nurse_services_by === 'samantha@mo-care.com' && !!W.db.ops_settings.data.nurse_services_at && W.events.length === 1 && W.events[0].verb === 'setting_changed' && /saved the nurse services: .*Wound check/.test(W.events[0].summary), W.events);
  ck('...a renamed service keeps its key (the check and any cards stay the same)', saved[0].key === 'med_setup');
  await W.X.nsvcSave();
  ck('Save again with no change: nothing saved', W.db.ops_settings.version === 5 && W.events.length === 1 && W.X.MSG === 'Nothing changed.');
  W = world(); await W.X.nsvcLoad(); W.X.nsvcAdd(); await W.X.nsvcSave();
  ck('a new service with no name is refused, in words, nothing saved', W.db.ops_settings.version === 4 && /Service 4 needs a name\./.test(W.card.innerHTML));
  W.X.nsvcSet(3, 'name', 'Skin assessment'); W.X.nsvcSet(3, 'axis', 'skin'); await W.X.nsvcSave();
  ck('..."assessment" is refused: an LPN does skin monitoring', W.db.ops_settings.version === 4 && /skin monitoring, not an assessment/.test(W.card.innerHTML));
  W.X.nsvcSet(3, 'name', 'Skin monitoring'); W.X.nsvcSet(3, 'axis', ''); await W.X.nsvcSave();
  ck('...a service with no AxisCare match is refused', W.db.ops_settings.version === 4 && /needs at least one AxisCare service name or code/.test(W.card.innerHTML));
  W.X.nsvcSet(3, 'name', 'General Health Evaluation'); W.X.nsvcSet(3, 'axis', 'x'); await W.X.nsvcSave();
  ck('...two services with the same name are refused', W.db.ops_settings.version === 4 && /Two services have the same name/.test(W.card.innerHTML));
  W = world({ raceOnFirstRead: true }); await W.X.nsvcLoad(); W.X.nsvcSet(2, 'active', false); await W.X.nsvcSave();
  ck('someone else saves a setting at the same moment: theirs is kept and the list is still saved', W.db.ops_settings.data.late_watch_live === true && W.db.ops_settings.data.nurse_services[2].active === false && W.db.ops_settings.version === 6, W.db.ops_settings);
  W = world({ yes: false }); await W.X.nsvcLoad(); W.X.nsvcSet(0, 'name', 'X setup'); await W.X.nsvcSave();
  ck('Cancel: nothing saved', W.db.ops_settings.version === 4 && !W.events.length);
  W = world({ start: { nurse_services: [{ key: 'only', name: 'Only one', axis: ['T1001'], active: true }], nurse_services_by: 'krystal@mo-care.com' } }); await W.X.nsvcLoad();
  ck('a saved list is what is shown, with who saved it', W.X.NSVC.length === 1 && /Using the list saved here \(last saved by krystal@mo-care\.com\)/.test(W.card.innerHTML));
  W = world({ noServer: true }); await W.X.nsvcLoad();
  ck('before Desktop 707 has run (no server, nothing saved): says so', /appears once Desktop step 707 has run/.test(W.card.innerHTML));
  const added = cut('/* ── Nurse services', '/* ── Switches') + cut('<section id="nsvcSection">', '</section>');
  ck('no em dash and never "plain language" in anything new', !/—/.test(added) && !/plain (language|english)/i.test(added));
  ck('the page loads it at sign-in, not awaited', /\n  nsvcLoad\(\);   \/\/ 2026-10-14 nurse services \(not awaited\)\n/.test(html));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
