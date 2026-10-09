/* node tests/admin-onboarding-test.js
   Onboarding workflow settings on the Admin page (Slice 0, Samantha approved 2026-10-08). The real code, cut out of
   admin.html, against a fake database that does what app_data_save does (compare-and-save) and a fake permissions
   function. Fake settings and people only; nothing reaches a server. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return html.slice(a, b); };
const code = [cut('async function readKeyV(', '/* ── status'), cut('/* ── Onboarding workflow', '/* ── boot')].join('\n')
  .replace('const ONB_FN=', 'var ONB_FN=').replace('let ONB_PERMS=null, ONB_PEOPLE=[];', 'var ONB_PERMS=null, ONB_PEOPLE=[];');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 160))); };
function world(opt = {}) {
  const db = { ops_settings: { data: JSON.parse(JSON.stringify(opt.start || { cg_connect_live: true })), version: 5 } };
  const events = [], alerts = [], confirms = [], fetches = []; let yes = opt.yes !== false;
  const els = {}; const el = (id) => els[id] || (els[id] = { innerHTML: '', value: '', disabled: false, href: '' });
  let perms = opt.perms || { ok: true, version: 1, advance: [], work: [{ person_id: 'p-sam', email: 'samantha@mo-care.com', name: 'Samantha', added_at: '2026-10-08T00:00:00Z', added_by: 'install' }], history: [], me: { person_id: 'p-sam', may_change_work: true, may_change_advance: true } };
  const ctx = { console, JSON, Object, Array, String, Number, Date, Error, Set, Math, RegExp, Promise, setTimeout,
    esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    say() {}, alert: m => alerts.push(m), confirm: m => { confirms.push(m); return yes; },
    ME: { email: 'samantha@mo-care.com' }, OPS: JSON.parse(JSON.stringify(db.ops_settings.data)), SUPA_ANON: 'anon',
    document: { getElementById: id => el(id) }, window: {},
    fetch: async (url, o) => { const body = JSON.parse(o.body); fetches.push(body);
      if (opt.fnRefuse) return { ok: false, status: 403, json: async () => ({ error: opt.fnRefuse }) };
      if (body.action === 'get') return { ok: true, status: 200, json: async () => perms };
      const list = body.kind === 'work' ? perms.work : perms.advance;
      if (body.action === 'add') list.push({ person_id: body.person_id, email: body.person_id + '@x', name: body.person_id, added_at: '2026-10-09T00:00:00Z', added_by: 'samantha@mo-care.com' });
      if (body.action === 'remove') { const i = list.findIndex(m => m.person_id === body.person_id); if (i >= 0) list.splice(i, 1); }
      perms.history.push({ at: '2026-10-09T00:00:00Z', by_email: 'samantha@mo-care.com', action: body.action, kind: body.kind, name: body.person_id });
      return { ok: true, status: 200, json: async () => perms }; },
    sb: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok' } } }) },
      from: (t) => { if (t === 'op_events') return { insert: (r) => { events.push(r); return Promise.resolve({ error: null }); } };
        const b = { select() { return b; }, eq(k, v) { b.key = v; return b; }, async maybeSingle() { const r = db[b.key];
          const out = { data: r ? { data: JSON.parse(JSON.stringify(r.data)), version: r.version } : null, error: null };
          if (opt.serverChange && !opt._done) { opt._done = true; Object.assign(db.ops_settings.data, opt.serverChange); db.ops_settings.version++; out.data = { data: JSON.parse(JSON.stringify(db.ops_settings.data)), version: db.ops_settings.version }; }
          return out; } }; return b; },
      async rpc(name, a) { if (name === 'staff_access_overview') return { data: opt.people || [{ person_id: 'p-sam', full_name: 'Samantha', email: 'samantha@mo-care.com', active: true }, { person_id: 'p-kry', full_name: 'Krystal', email: 'krystal@mo-care.com', active: true }, { person_id: 'p-old', full_name: 'Gone', email: 'gone@mo-care.com', active: false }], error: null };
        if (name !== 'app_data_save') return { error: { message: 'unexpected ' + name } };
        const r = db[a.p_key]; if (!r || Number(a.p_expected_version) !== r.version) return { data: { ok: false, version: r && r.version }, error: null };
        r.data = JSON.parse(JSON.stringify(a.p_data)); r.version++; return { data: { ok: true }, error: null }; } } };
  ctx.globalThis = ctx; vm.createContext(ctx); vm.runInContext(code, ctx);
  return { ctx, db, events, alerts, confirms, fetches, el, perms: () => perms };
}
(async () => {
  // reading the settings
  { const w = world(); const o = w.ctx.onbSettings({});
    ck('defaults are the approved numbers: 2,5 / 2,4 / 3,6 / 5pm / 1 business day each', JSON.stringify([o.offer_days, o.step1_days, o.step2_days, o.due_hour, o.step2_sent_due_days, o.verify_due_days, o.final_approval_due_days]) === '[[2,5],[2,4],[3,6],17,1,1,1]', o);
    const o2 = w.ctx.onbSettings({ onboarding: { offer_days: [1, 'x', 99], due_hour: 30, verify_due_days: 2 } });
    ck('junk in a saved setting falls back to the default; good values are kept', JSON.stringify(o2.offer_days) === '[1]' && o2.due_hour === 17 && o2.verify_due_days === 2, o2);
    ck('holidays: only real dates, sorted', JSON.stringify(w.ctx.onbHolidays({ company_holidays: [{ date: '2026-12-25', name: 'Christmas' }, { date: 'x' }, { date: '2026-01-01' }] }).map(h => h.date)) === '["2026-01-01","2026-12-25"]');
    const fed = w.ctx.onbFederal(2026);
    ck('federal holidays 2026: 11 dates, Independence Day observed Friday Jul 3, Thanksgiving Nov 26', fed.length === 11 && fed.find(h => h.name === 'Independence Day').date === '2026-07-03' && fed.find(h => h.name === 'Thanksgiving Day').date === '2026-11-26', fed);
    ck('checklist: the starting list is version 0 with seven items', w.ctx.onbChecklist({}).version === 0 && w.ctx.onbChecklist({}).items.length === 7);
  }
  // the card renders and loads the lists
  { const w = world(); await w.ctx.onbLoadPerms(); const h = w.el('onbCard').innerHTML;
    ck('the card shows the two lists, Samantha on Approve to Work, reminder boxes, holidays, the checklist and the locked switch date', /Approve to Advance to Orientation/.test(h) && /Approve to Work/.test(h) && /Samantha/.test(h) && /onb_offer/.test(h) && /Company holidays/.test(h) && /onb_checklist/.test(h) && /Not set/.test(h) && /Locked/.test(h), h.slice(0, 300));
    ck('the switch date has no input and no save button anywhere on the card', !/onboarding_switch_date/.test(h) && !/id="onb_switch/.test(h));
    const workPick = (h.match(/<select id="onbAdd_work">[\s\S]*?<\/select>/) || [''])[0], advPick = (h.match(/<select id="onbAdd_advance">[\s\S]*?<\/select>/) || [''])[0];
    ck('the add-a-person pickers leave out inactive people and people already on that list', /Krystal/.test(workPick) && !/Gone/.test(h) && !/Samantha/.test(workPick) && /Samantha/.test(advPick), [workPick, advPick]);
  }
  // permissions: asking the function, confirming, not deciding anything here
  { const w = world(); await w.ctx.onbLoadPerms(); await w.ctx.onbPermChange('advance', 'add', 'p-kry', null);
    ck('adding to Approve to Advance asks the function (add, advance, person id) after a confirm, and re-renders with Krystal', w.confirms.length === 1 && w.fetches.some(f => f.action === 'add' && f.kind === 'advance' && f.person_id === 'p-kry') && /Krystal · p-kry@x|Krystal<\/span>|>p-kry<\/span>/.test(w.el('onbCard').innerHTML), w.el('onbCard').innerHTML.slice(0, 400));
    ck('the page writes no permission to the settings record itself', w.db.ops_settings.version === 5);
    await w.ctx.onbPermChange('work', 'remove', 'p-sam', null);
    ck('the history shows on the card after a change', /Change history/.test(w.el('onbCard').innerHTML));
  }
  { const w = world({ yes: false }); await w.ctx.onbLoadPerms(); await w.ctx.onbPermChange('work', 'add', 'p-kry', null);
    ck('cancelling the confirm sends nothing', !w.fetches.some(f => f.action === 'add')); }
  { const w = world({ fnRefuse: 'Only someone already on the Approve to Work list can change it.' }); await w.ctx.onbLoadPerms(); await w.ctx.onbPermChange('work', 'add', 'p-kry', null);
    ck('a refusal from the function is shown, nothing else changes', w.alerts.some(a => /Only someone already on the Approve to Work list/.test(a)) && w.db.ops_settings.version === 5, w.alerts); }
  // timing saves field by field, logged
  { const w = world(); w.ctx.renderOnboarding(); w.el('onb_offer').value = '3, 7'; w.el('onb_step1').value = '2, 4'; w.el('onb_step2').value = '3, 6'; w.el('onb_hour').value = '17'; w.el('onb_sentdue').value = '1'; w.el('onb_verifydue').value = '2'; w.el('onb_finaldue').value = '1';
    await w.ctx.onbSaveTiming(null);
    const d = w.db.ops_settings.data;
    ck('reminder days and deadlines save into ops_settings.onboarding with who and when; other settings untouched', JSON.stringify(d.onboarding.offer_days) === '[3,7]' && d.onboarding.verify_due_days === 2 && d.onboarding.changed_by === 'samantha@mo-care.com' && d.cg_connect_live === true && w.db.ops_settings.version === 6, d);
    ck('the change is logged in op_events with what changed', w.events.length === 1 && /offer_days/.test(w.events[0].summary) && /verify_due_days/.test(w.events[0].summary), w.events);
    w.el('onb_offer').value = 'soon'; await w.ctx.onbSaveTiming(null);
    ck('bad input is refused with a message and saves nothing', w.alerts.length === 1 && w.db.ops_settings.version === 6, w.alerts); }
  { const w = world({ serverChange: { late_watch_live: false } }); w.ctx.renderOnboarding(); w.el('onb_offer').value = '2, 5'; w.el('onb_step1').value = '1, 3'; w.el('onb_step2').value = '3, 6'; w.el('onb_hour').value = '17'; w.el('onb_sentdue').value = '1'; w.el('onb_verifydue').value = '1'; w.el('onb_finaldue').value = '1';
    await w.ctx.onbSaveTiming(null); const d = w.db.ops_settings.data;
    ck('a switch someone else flipped meanwhile is kept (merge-save, not a whole save)', d.late_watch_live === false && JSON.stringify(d.onboarding.step1_days) === '[1,3]', d); }
  // holidays
  { const w = world(); w.ctx.renderOnboarding(); w.el('onb_hdate').value = '2026-12-24'; w.el('onb_hname').value = 'Christmas Eve'; await w.ctx.onbHolidayAdd(null);
    ck('a holiday is added and logged', JSON.stringify(w.db.ops_settings.data.company_holidays) === '[{"date":"2026-12-24","name":"Christmas Eve"}]' && w.events.length === 1, w.db.ops_settings.data.company_holidays);
    await w.ctx.onbHolidayAdd(null); ck('the same date twice is not added again', w.db.ops_settings.data.company_holidays.length === 1 && w.db.ops_settings.version === 6);
    await w.ctx.onbHolidaysFederal(2026, null); const hs = w.db.ops_settings.data.company_holidays;
    ck('the federal holidays add eleven dates, sorted, keeping Christmas Eve', hs.length === 12 && hs[0].date === '2026-01-01' && hs.some(h => h.name === 'Christmas Eve') && hs.every((h, i) => !i || hs[i - 1].date < h.date), hs.map(h => h.date));
    await w.ctx.onbHolidayRemove('2026-10-12', null); ck('a holiday is removed after a confirm', !w.db.ops_settings.data.company_holidays.some(h => h.date === '2026-10-12') && w.confirms.length === 2); }
  // checklist versions
  { const w = world(); w.ctx.renderOnboarding(); w.el('onb_checklist').value = 'Offer letter signed\nI-9 Section 1\n\nDirect deposit  '; await w.ctx.onbSaveChecklist(null);
    const c = w.db.ops_settings.data.viventium_step2_checklist;
    ck('saving the checklist makes version 1 with three trimmed items, who and when', c.version === 1 && JSON.stringify(c.items) === '["Offer letter signed","I-9 Section 1","Direct deposit"]' && c.changed_by === 'samantha@mo-care.com' && c.history.length === 0, c);
    w.ctx.OPS = w.db.ops_settings.data; w.ctx.renderOnboarding(); w.el('onb_checklist').value = 'Offer letter signed\nI-9 Section 1\nDirect deposit\nFCSR registration'; await w.ctx.onbSaveChecklist(null);
    const c2 = w.db.ops_settings.data.viventium_step2_checklist;
    ck('a second save is version 2 and keeps version 1 in history unchanged', c2.version === 2 && c2.items.length === 4 && c2.history.length === 1 && c2.history[0].version === 1 && c2.history[0].items.length === 3, c2);
    w.ctx.OPS = w.db.ops_settings.data; w.ctx.renderOnboarding(); await w.ctx.onbSaveChecklist(null);
    ck('saving the same list again makes no new version', w.db.ops_settings.data.viventium_step2_checklist.version === 2 && w.db.ops_settings.version === 7);
    w.el('onb_checklist').value = '  \n'; await w.ctx.onbSaveChecklist(null); ck('an empty checklist is refused', w.alerts.length === 1); }
  // the switch date can never be saved from this page
  { const src = cut('/* ── Onboarding workflow', '/* ── boot');
    ck('no code on the card writes onboarding_switch_date', !/m\.onboarding_switch_date|onboarding_switch_date\s*=[^=]/.test(src)); }
  console.log(`${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
