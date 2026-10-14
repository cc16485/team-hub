/* node tests/owners-attendance-by-id-test.js
   Step 4 (2026-10-14): the Owners Hub Discipline Center attendance board stops matching caregivers by typed name.
   A record with the AxisCare caregiver id groups by that id; one without an id groups by name, as before; a name-only
   group joins an id group only when exactly one id group has that same name. The real attCgId / attGroups / ladder /
   renderDiscipline, cut out of owners.html, run against made-up people. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'owners.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return html.slice(a, b); };
const code = [cut('const esc=s=>', '\n'), cut('function attCfg(', '\n// One list, two jobs')].join('\n');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 700))); };
const day = (n) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
const E = (cg, type, ax, n = 3) => ({ caregiver: cg, type, shift_date: day(n), ...(ax ? { axiscare_caregiver_id: ax } : {}) });
const WU = (cg, extra = {}) => ({ caregiver: cg, status: 'issued', issued_at: new Date(Date.now() - 10 * 864e5).toISOString(), level: 'Verbal Warning', ...extra });
function world(events, actions) {
  const el = {}; const doc = { getElementById: (i) => (el[i] = el[i] || { innerHTML: '', style: {} }) };
  const ctx = { console, JSON, Object, Number, Array, String, Date, Set, document: doc, ATT_EVENTS: events, DISC_ACTIONS: actions, STAFF_SETTINGS: {}, ME: { email: 'x@mo-care.com' } };
  vm.createContext(ctx);
  vm.runInContext(code.replace(/^const esc=/m, 'var esc=') + '\nconst OWNERS=["samantha@mo-care.com"]; const DISC_APPROVERS=OWNERS;\nthis.__x={ attGroups, ladder, renderDiscipline };', ctx);
  ctx.__x.renderDiscipline();
  const rows = el['disc-board'].innerHTML.split('<b style="min-width:150px">').slice(1).map((r) => ({ name: r.split('</b>')[0], counts: (r.match(/(\d+) call-ins · (\d+) tardies/) || []).slice(1).join('/'), warn: (r.match(/(\d+) warnings? on file/) || [])[1] || '0' }));
  return { X: ctx.__x, rows };
}

/* no ids anywhere: exactly as before */
let w = world([E('Ann Cole', 'callin'), E('Ann Cole', 'callin'), E('Bo Fox', 'tardy')], [WU('Ann Cole')]);
ck('no ids: one row per typed name, sorted, counts and warnings by name as before',
  JSON.stringify(w.rows) === JSON.stringify([{ name: 'Ann Cole', counts: '2/0', warn: '1' }, { name: 'Bo Fox', counts: '0/1', warn: '0' }]), w.rows);

/* id groups */
w = world([E('Ann Cole', 'callin', '801'), E('Ann Cole', 'callin'), E('Ann Cole', 'tardy', '801'),
  E('Bo Fox', 'callin', '911'), E('Bo Fox', 'callin', '912'), E('Bo Fox', 'callin'),
  E('Cy Doe', 'callin', '930'), E('Cy Doe', 'callin', '930'), E('Dee Lane', 'callin', '930'), E('Dee Lane', 'tardy')],
  [WU('Ann Cole'), WU('Someone Typed Wrong', { ax_caregiver_id: '801' }), WU('Bo Fox', { axiscare_caregiver_id: '912' }), WU('Dee Lane', { axiscare_caregiver_id: '930' }), WU('Dee Lane')]);
const row = (n) => w.rows.filter((r) => r.name === n);
ck('an id group and the name-only records of the same name (exactly one id has it) show as ONE row',
  row('Ann Cole').length === 1 && row('Ann Cole')[0].counts === '2/1', w.rows);
ck('...its write-ups join it: the name-only one, and one with the id under a different typed name (older ax_caregiver_id)', row('Ann Cole')[0].warn === '2', w.rows);
ck('two different people with the same name stay apart, and the name-only record joins neither (3 Bo Fox rows, 1 call-in each)',
  row('Bo Fox').length === 3 && row('Bo Fox').every((r) => r.counts === '1/0'), w.rows);
ck('...a write-up with id 912 lands only on that person\'s row', row('Bo Fox').filter((r) => r.warn === '1').length === 1, w.rows);
ck('a record with an id never matches another person by name: id 930 once typed "Dee Lane" stays on Cy Doe\'s row (3 call-ins)',
  row('Cy Doe').length === 1 && row('Cy Doe')[0].counts === '3/0' && row('Cy Doe')[0].warn === '1', w.rows);
ck('...and the name-only Dee Lane keeps only her own record and her own name-only write-up', row('Dee Lane').length === 1 && row('Dee Lane')[0].counts === '0/1' && row('Dee Lane')[0].warn === '1', w.rows);
const G = w.X.attGroups();
ck('group keys: ax:<id> with an id, nm:<name> without', G.keyOf({ caregiver: 'Zed', axiscare_caregiver_id: 5 }) === 'ax:5' && G.keyOf({ caregiver: 'Zed', ax_caregiver_id: '6' }) === 'ax:6' && G.keyOf({ caregiver: 'Zed' }) === 'nm:Zed'
  && G.keyOf({ caregiver: 'Zed', axiscare_caregiver_id: '' , ax_caregiver_id: '7' }) === 'ax:7');
ck('the label shown is the name', G.labelOf('ax:801') === 'Ann Cole' && G.labelOf('nm:Dee Lane') === 'Dee Lane');
ck('no em dashes added in the new code', !/—/.test(cut('/* One row per person', 'function ladder(')));

console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
