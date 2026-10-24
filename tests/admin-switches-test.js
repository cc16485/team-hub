/* node tests/admin-switches-test.js
   Switches on the Admin page (2026-10-04, Samantha "yes to all"): every Hub on/off switch, the same ops_settings keys,
   questions and rules as the Care Coordinator Hub. The real code, cut out of admin.html, runs against a fake database
   that does what app_data_save does (compare-and-save on version). Fake settings only. */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const cut = (from, to) => { const a = html.indexOf(from), b = html.indexOf(to, a + 1); if (a < 0 || b < 0) throw new Error('not found: ' + from); return html.slice(a, b); };
const code = [cut('const CC_FRAMED', 'const SUPA_URL='), cut('async function readKeyV(', '/* ── status'), cut('/* ── Switches', 'async function boot(){')].join('\n')
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
    say() {}, alert: m => alerts.push(m),
    /* 578 (another session, 2026-10-11) moved the Admin page's event write to recordEvent(record_event); the test records it the same way */
    recordEvent: async (row) => { events.push(row); return { ok: true }; }, confirm: m => { confirms.push(m); return yes; }, renderStatus() {},
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
  ck('all the switches are listed, grouped: Families, Hiring, Shifts and visits, Today and the office, Clients, Calls, and the three set by a Desktop step', R.length === 102 && /* +1 2026-10-24 caregiver_preview_live */ /* +2 2026-10-24 cara_board_live, shift_page_live */ /* +6 2026-10-23 Cara Phase 1: cara_list_live, cara_visit_match_live, cara_urgency_live, cara_reply_ai_practice, cara_reply_ai_live, cara_today_live */ /* +3 2026-10-22 In Training Part B: orientation_button_live, auto_approve_work_live, checkin_call_live */ /* +1 2026-10-22 in_training_lock_live */ /* +1 2026-10-22 lead_one_text */ /* +1 2026-10-19 ask_help_live */ /* +1 2026-10-18 my_work_tiers_live */ /* +1 2026-10-18 open_shift_cards_live */ /* +1 2026-10-18 team_work_live */ /* +5 2026-10-18 HR step 10: hr_agent_live, hr_alerts_live, hr_sop_reminders_live, hr_ack_live, hr_coaching_calls_live (shown only) */ /* +1 2026-10-18 client_anniversaries_live */ /* +1 2026-10-18 991 call_unread_cards_live */ /* +2 2026-10-18 fun step 4: seasons_live, anniversaries_live */ /* +1 2026-10-18 975 call_promise_cards_live */ /* +2 2026-10-17 919 call cards: Looks done, close on proof */ /* +1 2026-10-17 cm_checks_live */ /* +1 2026-10-17 soc_nine_steps_live */ /* +1 2026-10-16 family_choose_live */ /* +1 2026-10-16 family_offer_live */ /* 66 on main 2026-10-16, +2 808 ok_applicant_office_msgs_live, ok_applicant_auto_msgs_live */ /* +1 2026-10-14 roster_follow_axis_live */ /* +1 2026-10-14 avail_checkin_live */ /* +1 2026-10-13 call_tasks_live */ /* +2 2026-10-13 driver_link_send_live, hepb_offer_live; */ /* +2 587; 58 on 2026-10-12 incl. 671 ref_land_live; 59 on 2026-10-13 with driver_reminders_live; 60 with driver_schedule_gate_live */ /Delete inquiry LTC policies after 90 days/.test(W.box.innerHTML) && /Nightly client audit tasks/.test(W.box.innerHTML) && /Hire date to AxisCare/.test(W.box.innerHTML) && /Level of Care class to AxisCare/.test(W.box.innerHTML) && /Step 2 message and receipt/.test(W.box.innerHTML) && /Orientation Video Call invitation at Step 2 Verified/.test(W.box.innerHTML) && /Training Platform to Hub, nightly/.test(W.box.innerHTML) && /OIG monthly re-check/.test(W.box.innerHTML) && /Nightly audit tasks/.test(W.box.innerHTML) && /Approve to Work updates AxisCare \(new path\)/.test(W.box.innerHTML) && /Cleared text after Approve to Work \(new path\)/.test(W.box.innerHTML) && /Offer letter link goes out \(new path\)/.test(W.box.innerHTML) && /Offer reminders go out \(new path\)/.test(W.box.innerHTML) && /Step 1 sends itself after the signature \(new path\)/.test(W.box.innerHTML) && /Families/.test(W.box.innerHTML) && /Inquiry acknowledgment/.test(W.box.innerHTML) && /Hiring/.test(W.box.innerHTML) && /Shifts and visits/.test(W.box.innerHTML) && /Today and the office/.test(W.box.innerHTML) && /Clients/.test(W.box.innerHTML) && /Calls/.test(W.box.innerHTML) && /Shown here, switched by a Desktop step/.test(W.box.innerHTML), R.map((r) => r.name));
  ck('98 have a Turn on / Turn off button; the four set elsewhere have none', R.filter((r) => r.btn).length === 98 && /* +1 2026-10-24 caregiver preview */ /* +2 2026-10-24 board, shift page */ /* +6 2026-10-23 Cara Phase 1 */ /* +3 2026-10-22 In Training Part B */ /* +1 2026-10-22 in_training_lock_live */ /* +1 2026-10-22 lead_one_text */ /* +1 2026-10-19 ask_help_live */ /* 2026-10-18 test refresh: 83 counted (client_anniversaries_live and the 10-18 additions) */ /* +1 2026-10-18 my_work_tiers_live */ /* +1 2026-10-18 team_work_live */ /* 2026-10-18 HR step 10: +4 (and the count corrected: main had 76, the comment trail below had not kept up) */ /* +1 client anniversaries */ /* +2 2026-10-18 fun step 4 */ /* +2 2026-10-17 919 call cards */ /* +1 2026-10-16 family_choose_live */ /* +1 2026-10-16 family_offer_live */ /* +2 587: new applicant messages, Krystal's name; 671 reference answers */ R.filter((r) => !r.btn).map((r) => r.name).join() === 'Coaching by recorded phone call,Open-shift texts,Missed clock-ins watched,Client promises', R.filter((r) => !r.btn).map((r) => r.name));
  ck('the state is read from the shared settings: caregiver connect On, start forms Off (practice), running-late calls On by default', R.find((r) => r.name === 'Caregiver connect').on && !R.find((r) => r.name === 'Start forms import themselves').on && /Off · practice/.test(R.find((r) => r.name === 'Start forms import themselves').text) && R.find((r) => r.name === 'Running late: calls').on);
  { const d = R.find((r) => r.btn === 'driver_reminders_live');
    ck('2026-10-13 driver renewal reminders: one switch with her label, off by default (practice), with a Turn on button', !!d && d.name === 'Driver license and insurance renewal reminders (texts and emails to caregivers)' && !d.on && /Off · practice/.test(d.text) && /Turn on/.test(d.text), d && d.text.slice(0, 300));
    ck('...its words say what it sends and when, and nothing in it uses an em dash', !!d && /30 and 14 days/.test(d.text) && /9am to 6pm Central/.test(d.text) && !/\u2014/.test(d.text)); }
  { const W2 = world(); await W2.X.swToggle('driver_reminders_live');
    ck('...turning it on asks first, then saves only driver_reminders_live = true in ops_settings', W2.confirms.length === 1 && /driver renewal reminders/.test(W2.confirms[0]) && W2.db.ops_settings.data.driver_reminders_live === true && W2.db.ops_settings.data.cg_connect_live === true, W2.db.ops_settings.data); }
  { const g = R.find((r) => r.btn === 'driver_schedule_gate_live')
    ck('2026-10-13 driver check for transportation shifts: one switch with her label, off by default, with a Turn on button, after the renewal reminders, the link switch and the Hepatitis B offer', !!g && g.name === 'Only Approved Drivers get shifts that need transportation (turn on after current drivers are set up)' && !g.on && /Turn on/.test(g.text) && R.indexOf(g) === R.findIndex((r) => r.btn === 'driver_reminders_live') + 3 && R[R.indexOf(g) - 2].btn === 'driver_link_send_live' && R[R.indexOf(g) - 1].btn === 'hepb_offer_live', g && g.text.slice(0, 300))
    ck('...its words say off = a warning only, nobody left out, and no em dash', !!g && /not enforced yet/.test(g.text) && /nobody is left out/.test(g.text) && !/\u2014/.test(g.text)) }
  { const W3 = world(); W3.confirms.length = 0; await W3.X.swToggle('driver_schedule_gate_live')
    ck('...turning it on asks first (current drivers set up?), then saves only driver_schedule_gate_live = true', W3.confirms.length === 1 && /current drivers are set up in Driver Compliance first/.test(W3.confirms[0]) && W3.db.ops_settings.data.driver_schedule_gate_live === true && W3.db.ops_settings.data.cg_connect_live === true && W3.db.ops_settings.data.driver_reminders_live !== true, W3.db.ops_settings.data) }
  ck('Test people: its own row under the switches, with Change; says nobody is on it until someone is added', /Test people/.test(W.box.innerHTML) && /<div class="swrow tp">/.test(W.box.innerHTML) && /tpEdit\(this\)/.test(W.box.innerHTML) && /Nobody on it/.test(W.box.innerHTML));
  ck('"More settings" opens the Hub settings tab on this page', (W.box.innerHTML.match(/href="#hubsettings" onclick="adminTab\('hubsettings'\);return false;">More settings</g) || []).length === 3, W.box.innerHTML.slice(0, 300));

  W = world({ start: { ...START, timekeeper_watch_live: false, late_watch_live: false, late_cg_reply_live: false, late_admin_live: false } }); W.X.renderSwitches(); R = rows(W.box.innerHTML);
  ck('a switch that needs another one can\'t be turned on: caregiver missed clock-in text (watching off), running-late replies and admin texts (notices off)', R.find((r) => r.name === 'Missed clock-ins: caregiver text').disabled && R.find((r) => r.name === 'Running late: caregiver replies').disabled && R.find((r) => r.name === 'Running late: admin texts').disabled && /Can't turn on yet: missed clock-ins are not being watched yet/.test(R.find((r) => r.name === 'Missed clock-ins: caregiver text').text));
  await W.X.swToggle('timekeeper_text_live');
  ck('...and pressing it anyway changes nothing', W.db.ops_settings.version === 5 && W.db.ops_settings.data.timekeeper_text_live === false && /Can't turn this on yet/.test(W.alerts[0]));

  W = world(); await W.X.swToggle('intake_auto_import_live');
  ck('turning one on asks first, with the Care Coordinator Hub\'s own words', /^Turn on start forms importing themselves\? From the next check \(every 5 minutes\)/.test(W.confirms[0]));
  ck('...only that switch changes; every other setting is kept exactly', W.db.ops_settings.data.intake_auto_import_live === true && JSON.stringify({ ...W.db.ops_settings.data, intake_auto_import_live: undefined }) === JSON.stringify({ ...START, intake_auto_import_live: undefined }), W.db.ops_settings.data);
  /* 2026-10-18 test refresh: since 578 the record goes through record_event, and the SERVER stamps who from the sign-in, so the page sends no name; the summary still says who */
  ck('...recorded (op_events, setting_changed, through record_event; the server stamps who)', W.events.length === 1 && W.events[0].verb === 'setting_changed' && W.events[0].item_id === 'ops_settings' && /samantha changed switches/.test(W.events[0].summary) && /Start forms import themselves ON/.test(W.events[0].summary), W.events);
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

  /* 671 (2026-10-12): reference answers land by themselves */
  W = world({ start: { cg_connect_live: false } }); W.X.renderSwitches(); R = rows(W.box.innerHTML);
  const RL = R.find((r) => r.name === 'Reference answers land by themselves');
  ck('671: "Reference answers land by themselves" is listed under Hiring, off (practice) until turned on, with her one-line description', !!RL && !RL.on && RL.btn === 'ref_land_live' && /Off · practice/.test(RL.text)
    && RL.text.includes('When a reference answers the online form, their answers go onto the person&#39;s record and set the reference&#39;s status. Nobody is contacted. A negative answer opens a card for today.')
    && W.box.innerHTML.indexOf('Reference answers land by themselves') > W.box.innerHTML.indexOf('>Hiring<') && W.box.innerHTML.indexOf('Reference answers land by themselves') < W.box.innerHTML.indexOf('>Shifts and visits<'), RL);
  await W.X.swToggle('ref_land_live');
  ck('671: turning it on asks first (nobody texted or emailed; old negatives open no card), saves only ref_land_live, and is recorded', /^Turn on reference answers landing by themselves\?/.test(W.confirms[0]) && /Nobody is texted or emailed/.test(W.confirms[0]) && /older than 14 days/.test(W.confirms[0])
    && W.db.ops_settings.data.ref_land_live === true && W.db.ops_settings.data.cg_connect_live === false && Object.keys(W.db.ops_settings.data).length === 2 && W.events.length === 1 && /Reference answers land by themselves ON/.test(W.events[0].summary), [W.confirms, W.db.ops_settings.data, W.events]);
  await W.X.swToggle('ref_land_live');
  ck('671: turning it off saves false, and says the Hub button still works', W.db.ops_settings.data.ref_land_live === false && /Sync reference answers/.test(W.confirms[1]));

  { const se = R.find((r) => r.btn === 'seasons_live'), an = R.find((r) => r.btn === 'anniversaries_live');
    ck('2026-10-18 fun step 4: Seasons and Work anniversaries, both off, with Turn on buttons', !!se && !!an && !se.on && !an.on && /Turn on/.test(se.text) && /Turn on/.test(an.text), [se && se.text.slice(0, 200), an && an.text.slice(0, 200)]);
    const W5 = world(); await W5.X.swToggle('anniversaries_live');
    { const ca = R.find((r) => r.btn === 'client_anniversaries_live'); ck('2026-10-18: Client anniversaries, off, with a Turn on button', !!ca && !ca.on && /Turn on/.test(ca.text), ca && ca.text.slice(0, 200)); }
    ck('...turning on work anniversaries asks first, says nothing is sent, and saves true', /Nothing is texted or emailed/.test(W5.confirms[0] || '') && W5.db.ops_settings.data.anniversaries_live === true, W5.confirms); }

  /* the same questions as the Hub */
  /* 2026-10-18 test refresh: HUB_DIR points at an up-to-date Care Coordinator Hub checkout (the old sibling cc-hub-live is
     often far behind main). Only switches the Hub itself uses are compared: many newer switches live on this page alone. */
  const hub = path.join(process.env.HUB_DIR || path.join(__dirname, '..', '..', 'cc-hub-live'), 'index.html');
  if (fs.existsSync(hub)) {
    /* My Desk's switch (kind words from shift notes) lives in desk.js, next to index.html */
    const H = (fs.readFileSync(hub, 'utf8') + ['desk.js', 'shift-flags.js', 'standup-board.js', 'live-calendar.js', 'client-journey.js', 'review-ask.js'].map((f) => fs.existsSync(path.join(path.dirname(hub), f)) ? fs.readFileSync(path.join(path.dirname(hub), f), 'utf8') : '').join('')).replace(/\\'/g, "'").replace(/\\n/g, '\n');
    const W2 = world(); const same = []; const diff = [];
    for (const [, list] of W2.X.SWITCHES) for (const sw of list) { if (sw.readOnly || ['timekeeper_admin_loop_live', 'callin_reminders_live', 'ref_land_live', 'family_offer_live', 'family_choose_live'].includes(sw.k)) continue;   /* 671: ref_land_live lives only on this page; so does family_offer_live (2026-10-16) */
      if (!new RegExp("\\bk:\\s*'" + sw.k + "'").test(H)) continue;   /* the Hub has no question of its own for it: it lives on this page only */
      for (const t of [sw.on, sw.off]) (H.includes(t.replace(' Caregiver replies and admin texts for running late turn off too.', '')) || H.includes(t.replace('only in practice: no card', 'only in practice (listed below): no card')) ? same : diff).push(sw.k) }
    ck('every question matches the Care Coordinator Hub word for word (the two whose Hub wording counts minutes say where to find them)', diff.length === 0, diff);
  } else console.log('SKIP  the Care Coordinator Hub copy is not next to this folder, so the wording was not compared');

  { const d = R.find((r) => r.btn === 'family_choose_live')
    ck('2026-10-16 Let me choose: one switch, off by default, under Shifts and visits, with a Turn on button', !!d && d.name === 'Booking App: Let me choose' && !d.on && /Turn on/.test(d.text), d && d.text.slice(0, 300))
    const W3 = world(); await W3.X.swToggle('family_choose_live')
    ck('...it can\'t be turned on while caregiver offers are off (it says why), nothing saved', W3.alerts.some((x) => /aren't offered to caregivers yet/.test(x)) && W3.db.ops_settings.data.family_choose_live !== true, [W3.alerts, W3.db.ops_settings.data.family_choose_live])
    const W4 = world({ start: { ...START, family_offer_live: true, family_app_live: true } }); await W4.X.swToggle('family_choose_live')
    ck('...with offers on: asks first, saves family_choose_live = true, and records the change', W4.confirms.length === 1 && /Turn on Let me choose/.test(W4.confirms[0]) && W4.db.ops_settings.data.family_choose_live === true && W4.events.some((e) => e.verb === 'setting_changed'), [W4.db.ops_settings.data.family_choose_live, W4.events])
    await W4.X.swToggle('family_offer_live')
    ck('...turning caregiver offers off turns Let me choose off too', W4.db.ops_settings.data.family_offer_live === false && W4.db.ops_settings.data.family_choose_live === false, W4.db.ops_settings.data)
    ck('...no em dashes in its words', !!d && !/\u2014/.test(d.text)) }
  const added = cut('/* ── Switches', 'async function boot(){') + cut('<h2>Switches</h2>', '<h2>Staff</h2>');
  ck('no em dashes in anything new', !/—/.test(added));
  ck('"Where everything lives" no longer says Augusta or the Staffing Hub', !/Augusta, which books/.test(html) && !/Staffing Hub, Orientations tab/.test(html));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
