"""Owners Hub Cockpit tab (CEO cockpit v1, 2026-11-07): the real page, offline, made-up numbers.
python3 tests/owners-cockpit-look.py  (writes cockpit-desktop.png and cockpit-phone.png next to this file's folder when SHOTS=1)"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHOTS=os.environ.get('SHOTS')
def run(pg):
    return pg.evaluate(r"""async()=>{
      for(const id of ['signin','notowner']){ const g=document.getElementById(id); if(g) g.style.display='none'; }
      document.getElementById('app').style.display='block';
      const first=document.querySelector('nav.tabs button').dataset.t, active=document.querySelector('section.panel.active').id;
      const saved=[]; window.save=async(k,item)=>{ saved.push([k,JSON.parse(JSON.stringify(item))]); };
      ME.name='Test';
      LEADS=[]; OSET.cockpit=null;
      PULSE=null; renderCockpit(); const loading=document.getElementById('cockpit-springfield').innerText;
      PULSE={ error:'AxisCare answered 403' }; renderCockpit(); const err=document.getElementById('cockpit-springfield').innerText;
      PULSE={ recent:{ hours:3000, est_revenue:93000, clients:40, caregivers:30 }, prior:{} }; renderCockpit();
      const sf=document.getElementById('cockpit-springfield').innerText, tot1=document.getElementById('cockpit-total').innerText;
      PULSE={ recent:{ hours:3000, est_revenue:93000, clients:40, caregivers:30 }, prior:{}, incomplete_dates:['2026-11-01','2026-11-02'] }; renderCockpit();
      const gapTxt=document.getElementById('cockpit-springfield').innerText;
      PULSE={ recent:{ hours:3000, est_revenue:93000, clients:40, caregivers:30 }, prior:{} }; renderCockpit();
      ckEdit(); document.getElementById('ck-cds').value='12'; document.getElementById('ck-ok').value=''; document.getElementById('ck-smn').value='';
      await ckSave();
      const tot2=document.getElementById('cockpit-total').innerText, leads=document.getElementById('cockpit-leads').innerText;
      const all=document.getElementById('panel-cockpit').innerText;
      return { first, active, loading, err, sf, gapTxt, tot1, tot2, leads, saved, em:/—/.test(all+err+loading) };
    }""")
with sync_playwright() as pw:
    b=pw.chromium.launch()
    pg=b.new_page(viewport={'width':1100,'height':1100})
    pg.route('**/*', lambda r: r.abort() if 'supabase.co' in r.request.url else r.continue_())
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(1200)
    r=run(pg)
    if SHOTS:
        pg.screenshot(path=os.path.join(HERE,'cockpit-desktop.png'), full_page=True)
        pg.set_viewport_size({'width':375,'height':900}); pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(HERE,'cockpit-phone.png'), full_page=True)
        r['hscroll']=pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
    b.close()
sv=r['saved'][-1][1] if r['saved'] else {}
ok=[('Cockpit is the first tab and opens first', r['first']=='cockpit' and r['active']=='panel-cockpit'),
    ('waiting for AxisCare says so', 'Pulling Springfield' in r['loading']),
    ('AxisCare unreachable: says so, never shows zero', 'could not be read just now' in r['err'] and '403' in r['err'] and 'more hours a week' not in r['err']),
    ('Springfield: 3,000 hours in 30 days is 700 a week, 800 to go to 1,500', '700' in r['sf'] and '800 more hours a week' in r['sf'] and '47% there' in r['sf']),
    ('days AxisCare did not answer are named: hours may be low', 'did not answer in full for 2 days' in r['gapTxt'] and 'did not answer' not in r['sf']),
    ('Springfield rate and caregivers shown', '$31' in r['sf'] and '30 caregivers' in r['sf']),
    ('before typing: CDS not entered, Oklahoma shows its status', 'not entered yet' in r['tot1'] and 'License pending' in r['tot1']),
    ('saving goes to owner_settings with the typed date', r['saved'] and r['saved'][-1][0]=='owner_settings' and sv.get('cockpit',{}).get('cds_consumers')==12 and sv['cockpit'].get('typed_at')),
    ('after typing: 12 CDS consumers shown and counted', '12 consumers' in r['tot2'] and 'Typed-in numbers last updated' in r['tot2']),
    ('yearly goal shown as $5.0M', '$5.0M' in r['tot2']),
    ('new families card renders', 'inquiries' in r['leads'].lower() or 'did not load' in r['leads']),
    ('no em dash', not r['em']), ('no page errors', not errs)]
if SHOTS: ok.append(('no sideways scroll on a phone', not r.get('hscroll')))
for n,c in ok: print(('PASS ' if c else 'FAIL ')+n)
print(sum(bool(c) for _,c in ok),'/',len(ok))
if errs: print(errs)
