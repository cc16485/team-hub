"""Owners Hub "GHE scorecard" (GHE fix slice 4, 2026-10-08): the real page, offline, made-up nurses and clients, the CC Hub's
own ghe-forms-rules.js injected from the sibling checkout (the live page loads it from cc.mo-care.com). The clock is Nov 20
2026. python3 tests/owners-ghe-scorecard-look.py  (HUB_DIR = the CC Hub checkout)"""
from playwright.sync_api import sync_playwright
import os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HUBDIR = os.environ.get("HUB_DIR", os.path.join(HERE, "..", "cc-hub-live"))
RULES = os.path.join(HUBDIR, "ghe-forms-rules.js")
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 1200})
    pg.clock.install(time='2026-11-20T10:00:00-06:00'); pg.clock.resume()
    pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + HERE + '/owners.html'); pg.wait_for_timeout(800)
    before = pg.evaluate("""()=>{ document.querySelectorAll('section.panel').forEach(x=>x.classList.remove('active')); document.getElementById('panel-growth').classList.add('active');
      const app=document.getElementById('app'); if(app) app.style.display='block'; renderGheScorecard(); return document.getElementById('ghe-scorecard').innerText; }""")
    pg.add_script_tag(path=RULES)
    r = pg.evaluate("""()=>{
      NURSE_CLIENTS=[{ id:'c1', name:'Ann', ghe1:'2026-11', assigned_nurse:'Lena Lowe' }, { id:'c2', name:'Bea', ghe1:'2026-11', assigned_nurse:'Lena Lowe' },
        { id:'c3', name:'Cal', ghe1:'2026-11', assigned_nurse:'Rita Reed' }, { id:'c4', name:'Dee', ghe2:'2026-10', assigned_nurse:'Rita Reed' }];
      GHE_WATCH=[{ id:'gw_c1_2026-11', state:'visited' }, { id:'gw_c2_2026-11', state:'none', stage:'not_booked' }, { id:'gw_c3_2026-11', state:'visited' }, { id:'gw_c4_2026-10', state:'not_visited', stage:'missed' }];
      GHE_FORMS=[{ id:'f3', client_id:'c3', client:'Cal', visit_date:'2026-11-05', status:'uploaded', uploaded_on:'2026-11-12', uploaded_on_time:true }];
      GHE_MONTH=''; renderGheScorecard(); const now=document.getElementById('ghe-scorecard').innerText;
      GHE_MONTH='2026-10'; renderGheScorecard(); const last=document.getElementById('ghe-scorecard').innerText;
      return [now,last]; }""")
    now, last = r
    pg.evaluate("()=>{ GHE_MONTH=''; renderGheScorecard(); document.getElementById('ghe-scorecard').scrollIntoView(); }"); pg.wait_for_timeout(200)
    pg.screenshot(path='/tmp/owners_ghe_scorecard.png'); b.close()
rows = lambda t, n: next((l for l in t.split('\n') if l.startswith(n)), '')
ok = [('without the rules file the card says so and shows no numbers', 'did not load' in before and 'Visited' not in before),
      ('this month (2026-11) is the default, with last month (2026-10) one click away', 'This month (2026-11)' in now and 'Last month (2026-10)' in now),
      ('Lena: 2 due, 1 visited (its form missing), 1 still open', rows(now, 'Lena Lowe').split('\t')[1:6] == ['2', '1', '0', '1', '1']),
      ('Rita: 1 due in November, visited, uploaded on time (1 of 1), not yet seen in Fusion', rows(now, 'Rita Reed').split('\t')[1:3] == ['1', '1'] and '1 of 1' in rows(now, 'Rita Reed')),
      ('a total row adds the nurses up', rows(now, 'All nurses').split('\t')[1:3] == ['3', '2']),
      ('the independent check: uploads not yet confirmed in Fusion are counted in red text', '1 upload not yet confirmed in Fusion' in now),
      ('last month: Dee\'s October GHE counted as missed for Rita', rows(last, 'Rita Reed').split('\t')[1:4] == ['1', '0', '1']),
      ('no page errors', not errs)]
for n, c in ok: print('PASS' if c else 'FAIL', '·', n)
if not all(c for _, c in ok): print('NOW:\n' + now + '\nLAST:\n' + last + '\n' + str(errs))
print(f"{sum(1 for _, c in ok if c)} / {len(ok)}")
raise SystemExit(0 if all(c for _, c in ok) else 1)
