"""Owners Hub "New families from calls: is the AI tagging them right?" (2026-10-18, her "build all"). The real page, offline,
made-up calls and leads: what the office decided on each New family? card, counted for the last 7 and 30 days.
The clock is Oct 18 2026. python3 tests/owners-aitag-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 1200})
    pg.clock.install(time='2026-10-18T10:00:00-05:00'); pg.clock.resume()
    pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + HERE + '/owners.html'); pg.wait_for_timeout(800)
    r = pg.evaluate("""async()=>{
      document.querySelectorAll('section.panel').forEach(x=>x.classList.remove('active')); document.getElementById('panel-growth').classList.add('active');
      const app=document.getElementById('app'); if(app) app.style.display='block';
      const d=n=>new Date(Date.now()-n*864e5).toISOString();
      const READ=[
        { message_id:'a', call_type:'new_client_inquiry', call_at:d(1), read_at:d(1), lead_id:null },   /* became a lead */
        { message_id:'b', call_type:'new_client_inquiry', call_at:d(2), read_at:d(2), lead_id:null },   /* not: caregiver */
        { message_id:'c', call_type:'new_client_inquiry', call_at:d(3), read_at:d(3), lead_id:null },   /* not: spam */
        { message_id:'d', call_type:'new_client_inquiry', call_at:d(1), read_at:d(1), lead_id:null },   /* waiting */
        { message_id:'e', call_type:'new_client_inquiry', call_at:d(20), read_at:d(20), lead_id:'L2' }, /* already a lead, 30 days only */
        { message_id:'f', call_type:'other', call_at:d(4), read_at:d(4), lead_id:null },                 /* missed: a lead was made from it */
        { message_id:'a', call_type:'other', call_at:d(1), read_at:d(5), lead_id:null } ];               /* an older reading of a: ignored */
      window.aiTagRead=async()=>window.__fail?{data:null,error:{message:'down'}}:{data:READ,error:null};
      LEADS=[{ id:'L1', from_calls:[{ message_id:'a', at:d(1) }] }, { id:'L3', from_calls:[{ message_id:'f', at:d(4) }] }];
      CALL_MARKS=[{ id:'b', verdict:'not', reason:'caregiver' }, { id:'c', verdict:'not', reason:'spam' }, { id:'d', verdict:'', reason:'' }];
      await renderAiTag(); const t=document.getElementById('growth-aitag').innerText;
      window.__fail=true; await renderAiTag(); const f=document.getElementById('growth-aitag').innerText;
      window.__fail=false; await renderAiTag(); document.getElementById('growth-aitag').scrollIntoView();
      return [t,f]; }""")
    t, f = r
    pg.wait_for_timeout(200); pg.screenshot(path=os.environ.get('SHOT', '/tmp/owners_aitag.png')); b.close()
row = lambda n: next((l for l in t.split('\n') if l.startswith(n)), '')
w, m = row('Last 7 days').split('\t'), row('Last 30 days').split('\t')
ok = [('7 days: 4 tagged, 1 lead, 2 not, 1 waiting, 1 missed', w[1:3] == ['4', '1'] and w[3].startswith('2') and w[4:6] == ['1', '1']),
      ('the reasons are named', 'caregiver or applicant' in w[3] and 'spam or sales' in w[3]),
      ('7 days: right = 1 of 3 decided = 33%', w[6].strip() == '33%'),
      ('30 days adds the call that was already a lead', m[1:3] == ['5', '2'] and m[6].strip() == '50%'),
      ('the newest reading of a call counts, once', m[1] == '5'),
      ('a failed read says so and shows no numbers', 'could not be read' in f and 'Last 7 days' not in f),
      ('no em dash', '—' not in t),
      ('no page errors', not errs)]
for n, c in ok: print('PASS' if c else 'FAIL', '·', n)
if not all(c for _, c in ok): print(t + '\n' + f + '\n' + str(errs))
print(f"{sum(1 for _, c in ok if c)} / {len(ok)}")
raise SystemExit(0 if all(c for _, c in ok) else 1)
