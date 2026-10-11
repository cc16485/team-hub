// 582 · Phase 1 Slice 3: the Owners Hub "Who may do what" card (view only, decision 1). Runs the REAL renderAuthority
// from admin.html with a fake database.   node tests/admin-authority-582-test.js
const fs = require('fs'), path = require('path'), vm = require('vm');
const res = []; const ck = (n, c, note) => res.push([n, !!c, c ? '' : String(note ?? '').slice(0, 600)]);
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a); if (a < 0 || b < 0) throw new Error('missing ' + from); return html.slice(a, b); };
const code = cut('const esc=', '\n', 0) + '\n' + cut('const AUTH_KIND=', '\n/* ── Care hub settings');
const OFFICE = ['owner_admin', 'care_coordinator', 'staffing_coordinator'];
const ACT = [['call_place.place', 'say who an unmatched call was with', true], ['client_fact.care_began', 'check whether care has begun', false], ['client_fact.record', 'record a fact about a client', true]];
function run(T) {
  const el = { innerHTML: '' }; const WRITES = [];
  const q = (tb) => { const p = { select() { return p }, order() { return p }, limit() { return p }, insert() { WRITES.push(tb); return p }, update() { WRITES.push(tb); return p }, delete() { WRITES.push(tb); return p }, upsert() { WRITES.push(tb); return p },
    then(ok) { return Promise.resolve(T[tb] || { data: [], error: null }).then(ok) } }; return p };
  const ctx = { document: { getElementById: (id) => id === 'authCard' ? el : null }, sb: { from: q, rpc: (n) => { WRITES.push('rpc:' + n); return Promise.resolve({}) } }, console, Date, Promise };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.renderAuthority=renderAuthority;', ctx);
  return ctx.renderAuthority().then(() => ({ h: el.innerHTML, WRITES }));
}
(async () => {
  const reg = { data: ACT.map(([a, l, m]) => ({ action: a, label: l, area: 'x', audience: 'none', mutating: m })), error: null };
  const au = { data: ACT.flatMap(([a]) => [{ action: a, actor_kind: 'person', actor_id: '', level: 'allowed', roles: OFFICE }, { action: a, actor_kind: 'job', actor_id: '', level: 'never', roles: [] }, { action: a, actor_kind: 'employee', actor_id: '', level: 'never', roles: [] }]), error: null };
  const seedLog = { data: [{ at: '2026-10-11T04:00:00Z', action: 'call_place.place', actor_kind: 'person', actor_id: '', old_level: null, new_level: 'allowed', new_roles: OFFICE, note: '582 seed', set_by: '582 installer' }], error: null };
  let { h, WRITES } = await run({ action_registry: reg, action_authority: au, action_authority_log: seedLog });
  ck('every action is listed with its words, and a read is marked', ACT.every(([a, l]) => h.includes(l) && h.includes(a)) && h.includes('a read'), h);
  ck('people: "Yes: owners, care coordinators, staffing coordinators"; jobs and AI employees: Never', (h.match(/Yes: owners, care coordinators, staffing coordinators/g) || []).length === 3 && (h.match(/<td>Never<\/td>/g) || []).length === 6, h);
  ck('no changes yet: says everyone has the rights they had before (the installer seed is not shown as a change)', /None since it was set up/.test(h) && /exactly the rights they had before/.test(h) && !h.includes('582 seed'), h);
  ck('the card writes nothing and calls nothing (view only)', WRITES.length === 0, WRITES);
  ck('there is no button or input on the card', !/<button|<input|<select|onclick/.test(h), h);
  const changed = { data: [{ at: '2026-10-20T15:00:00Z', action: 'call_place.place', actor_kind: 'employee', actor_id: '', old_level: 'never', new_level: 'recommend', new_roles: [], note: 'shadow mode test', set_by: 'owner@cc.test' }, ...seedLog.data], error: null };
  ({ h } = await run({ action_registry: reg, action_authority: au, action_authority_log: changed }));
  ck('an owner\'s change shows: when, which action, AI employees, Never to Suggest only, by whom, why', /AI employees/.test(h) && /<td>Never<\/td><td>Suggest only<\/td><td>owner@cc.test<\/td><td>shadow mode test<\/td>/.test(h), h);
  ({ h } = await run({ action_registry: { data: null, error: { message: 'relation "public.action_registry" does not exist' } } }));
  ck('before 582 has run: "This appears once Desktop step 582 has run."', h.includes('appears once Desktop step 582 has run'), h);
  ({ h } = await run({ action_registry: reg, action_authority: { data: [], error: null }, action_authority_log: { data: [], error: null } }));
  ck('an action with no row says so: "no row (refused)"', (h.match(/no row \(refused\)/g) || []).length === 9, h);
  ({ h } = await run({ action_registry: { data: [{ action: 'x.y', label: '<img src=x onerror=alert(1)>', audience: 'none', mutating: true }], error: null }, action_authority: { data: [], error: null }, action_authority_log: { data: [], error: null } }));
  ck('text from the database is escaped', !h.includes('<img') && h.includes('&lt;img'), h);
  const failed = res.filter((r) => !r[1]);
  for (const [n, ok, note] of res) console.log(`${ok ? 'PASS' : 'FAIL'}  ${n}${ok ? '' : '\n      ' + note}`);
  console.log(`\n${res.length - failed.length}/${res.length} passed${failed.length ? ' · FAIL' : ''}`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.log('FAIL  crashed: ' + e.message); process.exit(1); });
