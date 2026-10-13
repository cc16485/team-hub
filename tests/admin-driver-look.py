"""Driver Compliance on the Owners Hub Admin page (2026-10-13): the "Approve drivers" list on the Onboarding workflow card and
the driver renewal reminders switch, in the real page, offline (fake settings and people; supabase and the Hub frame are
blocked). Laptop and phone widths, Chromium. python3 tests/admin-driver-look.py   (OUT=<dir> for the screenshots)"""
from playwright.sync_api import sync_playwright
import os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); OUT = os.environ.get('OUT', '/tmp')
JS = r"""()=>{
  document.getElementById('gate').style.display='none'; document.getElementById('app').style.display='block';
  ME.email='samantha@mo-care.com'; OPS={ cg_connect_live:true };
  ONB_PERMS={ ok:true, version:3, work:[{person_id:'p1',name:'Samantha',email:'samantha@mo-care.com'}], advance:[], screening:[], audit_export:[],
    driver:[{person_id:'p3',name:'Krystal Land',email:'krystal@mo-care.com',added_at:'2026-10-13T14:10:00Z',added_by:'samantha@mo-care.com'}], history:[],
    me:{ person_id:'p1', may_change_work:true, may_change_advance:true, may_change_driver:true } };
  ONB_PEOPLE=[{person_id:'p1',full_name:'Samantha',email:'samantha@mo-care.com',active:true},{person_id:'p3',full_name:'Krystal Land',email:'krystal@mo-care.com',active:true},{person_id:'p4',full_name:'Amber Lee',email:'amber@mo-care.com',active:true}];
  renderOnboarding(); renderSwitches();
  return { onb: document.getElementById('onbDriver').innerText, card: document.getElementById('onbCard').innerText,
    sw: [...document.querySelectorAll('#swBox .swrow')].map(r => r.innerText).find(t => /Driver license and insurance renewal reminders/.test(t)) || '' }; }"""
R = []
def ck(n, c, d=''): R.append(('PASS' if c else 'FAIL', n, '' if c else str(d)[:300]))
with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name, vp in (('laptop', {'width': 1100, 'height': 1600}), ('phone', {'width': 390, 'height': 1800})):
        pg = b.new_page(viewport=vp); errs = []
        pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url or 'hub.mo-care.com' in r.request.url) else r.continue_())
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://' + HERE + '/admin.html'); pg.wait_for_timeout(600)
        t = pg.evaluate(JS); pg.wait_for_timeout(200)
        ck(f'{name}: the Approve drivers list shows on the Onboarding workflow card with her why', 'Approve drivers' in t['card'] and 'By person, never by job title.' in t['card'] and 'Krystal Land' in t['onb'], t['card'][-700:])
        ck(f'{name}: the list has Remove and an Add picker', 'Remove' in t['onb'] and pg.locator('#onbAdd_driver').count() == 1)
        ck(f'{name}: the renewal reminders switch row shows, Off · practice, with Turn on', 'Off · practice' in t['sw'] and 'Turn on' in t['sw'], t['sw'])
        wide = pg.evaluate("(() => { const row = [...document.querySelectorAll('#swBox .swrow')].find(r => /Driver license and insurance renewal/.test(r.innerText)); return [document.getElementById('onbDriver'), row].concat([...document.querySelectorAll('#onbDriver *')]).filter(e => e && e.getBoundingClientRect().right > innerWidth + 1).length })()")
        ck(f'{name}: the new list and switch row fit the screen (the page has an older overflow elsewhere at phone width, not from this change)', wide == 0, wide)
        ck(f'{name}: no page errors', not errs, errs)
        pg.locator('#onbDriver').scroll_into_view_if_needed(); pg.screenshot(path=os.path.join(OUT, 'admin_driver_' + name + '.png'))
        pg.close()
    b.close()
for s, n, d in R: print(s, ' ', n, ('  ' + d) if d else '')
print(f"\n{sum(1 for r in R if r[0]=='PASS')}/{len(R)} passed"); raise SystemExit(0 if all(r[0] == 'PASS' for r in R) else 1)
