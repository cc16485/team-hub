/* node tests/admin-switches-test.js
   Switches on the Admin page (2026-10-04, Samantha "yes to all"): every Hub on/off switch, the same ops_settings keys,
   questions and rules as the Care Coordinator Hub. The real code, cut out of admin.html, runs against a fake database
   that does what app_data_save does (compare-and-save on version). Fake settings only. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return html.slice(a, b); };
const code = [cut('async function readKeyV(', '/* ── status'), cut('/* ── Switches', 'async function boot(){')].join('\n')
  .replace('const CC_SETTINGS=', 'var CC_SETTINGS=').replace('const SWITCHES=', 'var SWITCHES=');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 700))); };
const START = { cg_connect_live: true, timekeeper_watch_live: true, timekeeper_text_live: false, late_watch_live: true, late_cg_reply_live: true, late_admin_live: true,
  coverage_alert_admins: ['a@x.com'], office_quiet_from: '20:00', live: true, levels: [{ after_min: 15 }], missed_notes_live_since: '2026-09-29T00:00:00Z' };
function world(opt = {}) {
  const db = { ops_settings: { data: JSON.parse(JSON.stringify(opt.start || START)), version: 5 } };
  const events = [], alerts = [], confirms = []; let reads = 0, yes = opt.yes !== false;
  const box = { innerHTML: '' };
  const ctx = { console, JSON, Object, Array, String, Number, Date, Error,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    say() {}, alert: m => alerts.push(m), confirm: m => { confirms.push(m); return yes; }, renderStatus() {},
    ME: { email: 'samantha@mo-care.com' }, OPS: JSON.parse(JSON.stringify(opt.page || db.ops_settings.data)),
    document: { getElementById: id => id === 'swBox' ? box : null }, window: {},
    sb: {
      from: (t) => { if (t === 'op_events') return { insert: (r) => { events.push(r); return Promise.resolve({ error: null }); } };
        const b = { select() { return b; }, eq(k, v) { b.key = v; return b; }, async maybeSingle() { reads++; const r = db[b.key];
          const out = { data: r ? { data: JSON.parse(JSON.stringify(r.data)), version: r.version } : null, error: null };
          if (opt.raceOnFirstRead && reads === 1) { db.ops_settings.data.callin_reminder_max = 3; db.ops_settings.version++; }
          if (opt.serverChange && reads === 1) { Object.assign(db.ops_settings.data, opt.serverChange); db.ops_settings.version++; out.data = { data: JSON.parse(JSON.stringify(db.ops_settings.data)), version: db.ops_settings.version }; }
          return out; } }; return b; },
      async rpc(name, a) { if (name !== 'app_data_save') return { error: { message: 'unexpected ' + name } };
        const r = db[a.p_key]; if (r.version !== a.p_expected_version) return { data: { ok: false }, error: null };
        db[a.p_key] = { data: a.p_data, version: r.version + 1 }; return { data: { ok: true }, error: null }; } } };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.__x={ renderSwitches, swToggle, SWITCHES };', ctx);
  return { X: ctx.__x, ctx, db, events, alerts, confirms, box };
}
const rows = (h) => h.split('<div class="swrow">').slice(1).map((r) => ({
  name: (r.match(/<div class="what">([^<]*)/) || [])[1], on: /chip ok">On/.test(r), btn: (r.match(/onclick="swToggle\('([^']+)'/) || [])[1] || null,
  disabled: /<button[^>]* disabled/.test(r), text: r }));
(async () => {
  let W = world(); W.X.renderSwitches(); let R = rows(W.box.innerHTML);
  ck('all the switches are listed, grouped: Families, Hiring, Shifts and visits, Today and the office, Clients, Calls, and the three set by a Desktop step', R.length === 34 && /Offer letter link goes out \(new path\)/.test(W.box.innerHTML) && /Offer reminders go out \(new path\)/.test(W.box.innerHTML) && /Step 1 sends itself after the signature \(new path\)/.test(W.box.innerHTML) && /Families/.test(W.box.innerHTML) && /Inquiry acknowledgment/.test(W.box.innerHTML) && /Hiring/.test(W.box.innerHTML) && /Shifts and visits/.test(W.box.innerHTML) && /Today and the office/.test(W.box.innerHTML) && /Clients/.test(W.box.innerHTML) && /Calls/.test(W.box.innerHTML) && /Shown here, switched by a Desktop step/.test(W.box.innerHTML), R.map((r) => r.name));
  ck('31 have a Turn on / Turn off button; the three Desktop ones have none', R.filter((r) => r.btn).length === 31 && R.filter((r) => !r.btn).map((r) => r.name).join() === 'Open-shift texts,Missed clock-ins watched,Client promises', R.filter((r) => !r.btn).map((r) => r.name));
  ck('the state is read from the shared settings: caregiver connect On, start forms Off (practice), running-late calls On by default', R.find((r) => r.name === 'Caregiver connect').on && !R.find((r) => r.name === 'Start forms import themselves').on && /Off · practice/.test(R.find((r) => r.name === 'Start forms import themselves').text) && R.find((r) => r.name === 'Running late: calls').on);
  ck('"More settings" opens the Hub settings tab on this page', (W.box.innerHTML.match(/href="#hubsettings" onclick="adminTab\('hubsettings'\);return false;">More settings</g) || []).length === 3, W.box.innerHTML.slice(0, 300));

  W = world({ start: { ...START, timekeeper_watch_live: false, late_watch_live: false, late_cg_reply_live: false, late_admin_live: false } }); W.X.renderSwitches(); R = rows(W.box.innerHTML);
  ck('a switch that needs another one can\'t be turned on: caregiver missed clock-in text (watching off), running-late replies and admin texts (notices off)', R.find((r) => r.name === 'Missed clock-ins: caregiver text').disabled && R.find((r) => r.name === 'Running late: caregiver replies').disabled && R.find((r) => r.name === 'Running late: admin texts').disabled && /Can't turn on yet: missed clock-ins are not being watched yet/.test(R.find((r) => r.name === 'Missed clock-ins: caregiver text').text));
  await W.X.swToggle('timekeeper_text_live');
  ck('...and pressing it anyway changes nothing', W.db.ops_settings.version === 5 && W.db.ops_settings.data.timekeeper_text_live === false && /Can't turn this on yet/.test(W.alerts[0]));

  W = world(); await W.X.swToggle('intake_auto_import_live');
  ck('turning one on asks first, with the Care Coordinator Hub\'s own words', /^Turn on start forms importing themselves\? From the next check \(every 5 minutes\)/.test(W.confirms[0]));
  ck('...only that switch changes; every other setting is kept exactly', W.db.ops_settings.data.intake_auto_import_live === true && JSON.stringify({ ...W.db.ops_settings.data, intake_auto_import_live: undefined }) === JSON.stringify({ ...START, intake_auto_import_live: undefined }), W.db.ops_settings.data);
  ck('...recorded with who did it (op_events, setting_changed)', W.events.length === 1 && W.events[0].actor_email === 'samantha@mo-care.com' && W.events[0].verb === 'setting_changed' && /Start forms import themselves ON/.test(W.events[0].summary), W.events);
  ck('...and the page now shows it On', rows(W.box.innerHTML).find((r) => r.name === 'Start forms import themselves').on);
  W = world({ yes: false }); await W.X.swToggle('cg_connect_live');
  ck('Cancel: nothing saved, nothing recorded', W.db.ops_settings.version === 5 && W.db.ops_settings.data.cg_connect_live === true && !W.events.length);
  W = world(); await W.X.swToggle('late_watch_live');
  ck('turning running-late notices off also turns off its replies and admin texts (as in the Hub)', W.db.ops_settings.data.late_watch_live === false && W.db.ops_settings.data.late_cg_reply_live === false && W.db.ops_settings.data.late_admin_live === false && /Running late: caregiver replies OFF/.test(W.events[0].summary));
  W = world(); await W.X.swToggle('missed_notes_live');
  ck('missed care notes on: keeps its original "counting since" date (not reset)', W.db.ops_settings.data.missed_notes_live === true && W.db.ops_settings.data.missed_notes_live_since === '2026-09-29T00:00:00Z');
  W = world({ start: { cg_connect_live: false } }); await W.X.swToggle('call_pull_live');
  ck('calls from GoHighLevel on: stamps when it started, like the Hub', W.db.ops_settings.data.call_pull_live === true && !!W.db.ops_settings.data.call_pull_live_since);
  W = world(); await W.X.swToggle('late_call_live');
  ck('running-late calls (on unless turned off): Turn off saves false', W.db.ops_settings.data.late_call_live === false && /^Turn off calls\?/.test(W.confirms[0]));
  W = world({ serverChange: { timekeeper_watch_live: false } }); await W.X.swToggle('timekeeper_text_live');
  ck('decided against the record as it is NOW: someone turned watching off a moment ago, so the caregiver text is refused and nothing changes', W.db.ops_settings.data.timekeeper_text_live === false && /Not changed: missed clock-ins are not being watched yet/.test(W.alerts.at(-1)) && !W.events.length, [W.db.ops_settings.data, W.alerts]);
  W = world({ raceOnFirstRead: true }); await W.X.swToggle('prn_reconfirm_live');
  ck('someone else saves at the same moment: their change is kept and this switch still goes on', W.db.ops_settings.data.prn_reconfirm_live === true && W.db.ops_settings.data.callin_reminder_max === 3);
  W = world(); await W.X.swToggle('coverage_send_live');
  ck('a Desktop-step switch can\'t be flipped here', W.db.ops_settings.version === 5 && !W.confirms.length);

  /* the same questions as the Hub */
  const hub = path.join(__dirname, '..', '..', 'cc-hub-live', 'index.html');
  if (fs.existsSync(hub)) {
    /* My Desk's switch (kind words from shift notes) lives in desk.js, next to index.html */
    const H = (fs.readFileSync(hub, 'utf8') + ['desk.js', 'shift-flags.js', 'standup-board.js', 'live-calendar.js', 'client-journey.js', 'review-ask.js'].map((f) => fs.existsSync(path.join(path.dirname(hub), f)) ? fs.readFileSync(path.join(path.dirname(hub), f), 'utf8') : '').join('')).replace(/\\'/g, "'").replace(/\\n/g, '\n');
    const W2 = world(); const same = []; const diff = [];
    for (const [, list] of W2.X.SWITCHES) for (const sw of list) { if (sw.readOnly || ['timekeeper_admin_loop_live', 'callin_reminders_live'].includes(sw.k)) continue;
      for (const t of [sw.on, sw.off]) (H.includes(t.replace(' Caregiver replies and admin texts for running late turn off too.', '')) || H.includes(t.replace('only in practice: no card', 'only in practice (listed below): no card')) ? same : diff).push(sw.k) }
    ck('every question matches the Care Coordinator Hub word for word (the two whose Hub wording counts minutes say where to find them)', diff.length === 0, diff);
  } else console.log('SKIP  the Care Coordinator Hub copy is not next to this folder, so the wording was not compared');

  const added = cut('/* ── Switches', 'async function boot(){') + cut('<h2>Switches</h2>', '<h2>Staff</h2>');
  ck('no em dashes in anything new', !/—/.test(added));
  ck('"Where everything lives" no longer says Augusta or the Staffing Hub', !/Augusta, which books/.test(html) && !/Staffing Hub, Orientations tab/.test(html));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
