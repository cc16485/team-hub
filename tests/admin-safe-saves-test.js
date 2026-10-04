/* node tests/admin-safe-saves-test.js
   Safe saves step 1 (2026-10-04): the Owners Hub admin page's "Save chasing settings" used to save ops_settings WHOLE
   with only its five chasing settings, wiping every other Hub switch. The real mergeSave / saveOps / saveHubCfg, cut
   out of admin.html, run against a fake database that does what app_data_save does (compare-and-save on version). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return html.slice(a, b); };
const code = [cut('async function readKeyV(', '/* ── status'), cut('async function saveOps(', '/* ── '), cut('const HUB_CFG_KEY=', 'boot();')].join('\n');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 600))); };
const SWITCHES = { callin_reminders_live: true, timekeeper_admin_loop_live: true, cg_connect_live: true, coverage_alert_admins: ['samantha@mo-care.com', 'krystal@mo-care.com'],
  office_quiet_from: '20:00', late_watch_live: false, live: false, levels: [{ after_min: 15, to: 'owner' }, { after_min: 45, to: 'fallback' }], max_age_hours: 12, callback_window_min: 90 };
function world(opt = {}) {
  const db = { ops_settings: { data: JSON.parse(JSON.stringify(SWITCHES)), version: 7 }, cc_hub_config: { data: { axiscare_site: '16485', checkin_cadence: 30, training_hub_key: 'old-key', other: 'keep' }, version: 3 } };
  const log = [], alerts = []; let reads = 0;
  const el = { 'op-live': { value: 'true' }, 'op-fallback': { value: '4175550000' }, 'op-l1': { value: '20' }, 'op-l2': { value: '60' }, 'op-maxage': { value: '24' },
    cfg_axiscare_site: { value: '16485', type: 'text' }, cfg_checkin_cadence: { value: '45', type: 'number' }, cfg_supervisory_window: { value: '', type: 'number' }, cfg_escalation_protocol: { value: 'Call Samantha', type: 'text' }, cfgNote: { textContent: '' } };
  const sb = {
    from: () => { const b = { select() { return b; }, eq(k, v) { b.key = v; return b; }, async maybeSingle() {
      reads++; const r = db[b.key]; const out = { data: r ? { data: JSON.parse(JSON.stringify(r.data)), version: r.version } : null, error: null };
      if (opt.raceOnFirstRead && reads === 1) { db.ops_settings.data.callin_reminder_max = 3; db.ops_settings.version++; }   /* someone saves right after this read */
      return out; },
      upsert() { log.push('WHOLE-UPSERT'); return Promise.resolve({ error: null }); } }; return b; },
    async rpc(name, a) { log.push(name);
      if (name !== 'app_data_save') return { error: { message: 'unexpected ' + name } };
      const r = db[a.p_key];
      if (opt.alwaysRace) { r.version++; }
      if ((r ? r.version : 0) !== a.p_expected_version) return { data: { ok: false, reason: 'version', version: r && r.version }, error: null };
      db[a.p_key] = { data: a.p_data, version: (r ? r.version : 0) + 1 }; return { data: { ok: true }, error: null }; },
  };
  const ctx = { console, JSON, Object, Number, Array, String, sb, alert: (m) => alerts.push(m), confirm: () => true, say: () => {}, document: { getElementById: (i) => el[i] || null },
    STAFF: [{ phone: '1' }], OPS: JSON.parse(JSON.stringify(SWITCHES)), renderStatus: () => {} };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.__x={ saveOps, saveHubCfg, mergeSave };', ctx);
  return { X: ctx.__x, db, log, alerts, ctx, el };
}
(async () => {
  let w = world(); await w.X.saveOps();
  const o = w.db.ops_settings.data;
  ck('Save chasing settings changes only the chasing settings', o.live === true && o.fallback_phone === '4175550000' && o.max_age_hours === 24 && o.levels[0].after_min === 20 && o.levels[1].after_min === 60, o);
  ck('...and keeps EVERY other Hub switch and setting', o.callin_reminders_live === true && o.timekeeper_admin_loop_live === true && o.cg_connect_live === true && o.office_quiet_from === '20:00'
     && o.late_watch_live === false && JSON.stringify(o.coverage_alert_admins) === JSON.stringify(SWITCHES.coverage_alert_admins) && o.callback_window_min === 90, o);
  ck('it never saves a whole copy (compare-and-save only)', !w.log.includes('WHOLE-UPSERT') && w.log.filter((x) => x === 'app_data_save').length === 1, w.log);
  ck('the page keeps the saved record', w.ctx.OPS && w.ctx.OPS.cg_connect_live === true);
  w = world({ raceOnFirstRead: true }); await w.X.saveOps();
  ck('someone saves a moment before: read again, their change kept, ours reapplied', w.db.ops_settings.data.callin_reminder_max === 3 && w.db.ops_settings.data.max_age_hours === 24 && w.log.filter((x) => x === 'app_data_save').length === 2, [w.db.ops_settings.data, w.log]);
  w = world({ alwaysRace: true }); const before = JSON.stringify(w.db.ops_settings.data); await w.X.saveOps();
  ck('someone keeps saving at the same moment: stops after 5 tries and says so; nothing of ours half-saved', w.alerts.some((a) => /kept saving at the same moment/.test(a)) && JSON.stringify(w.db.ops_settings.data) === before, w.alerts);
  w = world(); w.el['op-live'].value = 'false'; w.el['op-fallback'].value = ''; w.el['op-l1'].value = '15'; w.el['op-l2'].value = '45'; w.el['op-maxage'].value = '12';
  w.db.ops_settings.data.fallback_phone = ''; await w.X.saveOps();
  ck('nothing changed: nothing is saved', !w.log.includes('app_data_save'), w.log);
  w = world(); await w.X.saveHubCfg(null);
  const c = w.db.cc_hub_config.data;
  ck('Save for everyone: changes its fields, takes out the old key, keeps anything else in the record', c.checkin_cadence === 45 && c.escalation_protocol === 'Call Samantha' && !('training_hub_key' in c) && c.other === 'keep' && c.axiscare_site === '16485' && !('supervisory_window' in c), c);
  ck('...through compare-and-save, never a whole copy', !w.log.includes('WHOLE-UPSERT') && w.log.includes('app_data_save') && /Saved\. Everyone picks these up/.test(w.el.cfgNote.textContent), [w.log, w.el.cfgNote.textContent]);
  ck('the page has no whole-record save left', !/sb\.from\('app_data'\)\s*\.upsert|\.from\('app_data'\)\n?\s*\.upsert/.test(html) && !/saveWhole\(/.test(html));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
