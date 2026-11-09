"""Owners Hub Cockpit: "Did our content work this month?" (content scorecard, 2026-11-09). The real page, offline,
made-up numbers. python3 tests/owners-content-score-look.py   (SHOTS=1 writes content-desktop.png / content-phone.png)
heard-about.js comes from the CC Hub checkout beside this one (HEARD_JS to point elsewhere) until it is live."""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HEARD=os.environ.get('HEARD_JS') or os.path.join(HERE,'..','cc-hub-heard-about','heard-about.js')
SHOTS=os.environ.get('SHOTS')
def route(r):
    u=r.request.url
    if 'heard-about.js' in u and os.path.exists(HEARD): return r.fulfill(path=HEARD, content_type='application/javascript')
    if 'supabase.co' in u: return r.abort()
    return r.continue_()
JS=r"""async()=>{
  for(const id of ['signin','notowner']){ const g=document.getElementById(id); if(g) g.style.display='none'; }
  document.getElementById('app').style.display='block';
  const now=new Date(), d=(m,day)=>new Date(now.getFullYear(),now.getMonth()+m,day,10).toISOString();
  const box=()=>document.getElementById('cockpit-content').innerText;
  SITE_EV=null; HIRE_D=null; LEADS=[]; renderContentScore(); const waiting=box();
  SITE_EV={error:'permission denied for table website_events'}; renderContentScore(); const err=box();
  const ev=(sid,e,at,ref,props)=>({session_id:sid,event:e,created_at:at,referrer:ref||'',props:props||{}});
  SITE_EV={rows:[
    ev('a','page_view',d(0,1),'https://www.google.com/'), ev('a','page_view',d(0,1),'https://mo-care.com/'), ev('a','lead_submitted',d(0,1)),
    ev('b','page_view',d(0,1),'',{from:'youtube'}), ev('b','call_click',d(0,1)),
    ev('c','page_view',d(0,1),'https://m.facebook.com/'),
    ev('e','page_view',d(0,1),''), ev('f','page_view',d(0,2),'https://www.bing.com/'), ev('g','page_view',d(0,2),'',{from:'fb-starter'}), ev('h','page_view',d(0,2),'android-app://com.google.android.googlequicksearchbox/'), ev('i','page_view',d(0,2),'https://www.caring.com/x'), ev('j','page_view',d(0,2),'',{from:'email-2612'}),
    ev('p','page_view',d(-1,5),'https://www.google.com/'), ev('q','page_view',d(-1,6),''), ev('q','lead_submitted',d(-1,6)),
    ev('old','page_view',d(-2,6),'https://www.google.com/')]};
  const ym=x=>x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0');
  HIRE_D={months:[{month:ym(new Date(now.getFullYear(),now.getMonth(),1)),applied:9,started:2},{month:ym(new Date(now.getFullYear(),now.getMonth()-1,1)),applied:14,started:3}]};
  LEADS=[{id:'1',created_at:d(0,1),heard_about:'youtube'},{id:'2',created_at:d(0,1),heard_about:'youtube'},{id:'3',created_at:d(0,1),heard_about:'friend'},{id:'4',created_at:d(0,1)},
         {id:'5',created_at:d(0,1),heard_about:'google',spam:{at:d(0,1)}},{id:'6',created_at:d(-1,3),heard_about:'google'}];
  renderContentScore(); const full=box();
  const rowTxt=l=>[...document.querySelectorAll('#cockpit-content tr')].map(t=>t.innerText.replace(/\s+/g,' ').trim()).find(t=>t.startsWith(l))||'';
  return { waiting, err, full, visits:rowTxt('Visits'), google:rowTxt('Google'), yt:rowTxt('YouTube'), typed:rowTxt('Typed the address'),
    forms:rowTxt('Website forms'), taps:rowTxt('Phone number'), fams:rowTxt('New families'), apps:rowTxt('Job applications'), cgs:rowTxt('Caregivers started'),
    views:rowTxt('Facebook and YouTube'), em:/—/.test(document.getElementById('panel-cockpit').innerText) };
}"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1100,'height':1200})
    pg.route('**/*', route)
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(1500)
    r=pg.evaluate(JS)
    if SHOTS:
        pg.evaluate("document.getElementById('cockpit-content').scrollIntoView()")
        pg.locator('#cockpit-content').screenshot(path=os.path.join(HERE,'content-desktop.png'))
        pg.set_viewport_size({'width':375,'height':900}); pg.wait_for_timeout(200)
        pg.locator('#cockpit-content').screenshot(path=os.path.join(HERE,'content-phone.png'))
        r['hscroll']=pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
    b.close()
ok=[('while loading it says counting', 'counting' in r['waiting']),
    ('website unreadable: says so in words, no zeros guessed', 'could not be read' in r['err'] and 'permission denied' in r['err'] and 'could not read' in r['err']),
    ('views honestly not connected', 'not connected yet' in r['views']),
    ('4 visits this month (a tab counts once), 2 last month, older month left out', r['visits'].endswith('9 2')),
    ('Google 2 this month (incl. Android app), 1 last; own-site page did not count twice', r['google'].endswith('2 1')),
    ('YouTube tag counted', r['yt'].endswith('1 0')),
    ('typed in counted', r['typed'].endswith('1 1')),
    ('Bing counted as other search', 'Bing, DuckDuckGo or Yahoo 1 0' in r['full'].replace('\t',' ')),
    ('fb-starter tag folds into Facebook (2)', 'Facebook 2 0' in r['full'].replace('\t',' ')),
    ('email letter tag counted', 'Our email letter 1 0' in r['full'].replace('\t',' ')),
    ('other website counted', 'Other websites 1 0' in r['full'].replace('\t',' ')),
    ('forms 1 and 1', r['forms'].endswith('1 1')),
    ('phone taps 1 and 0', r['taps'].endswith('1 0')),
    ('new families 4 vs 1, spam left out', r['fams'].endswith('4 1')),
    ('job applications 9 vs 14', r['apps'].endswith('9 14')),
    ('caregivers started 2 vs 3', r['cgs'].endswith('2 3')),
    ('heard about: YouTube 2, friend 1, not asked 1, spam left out', 'YouTube 2' in r['full'] and 'A friend or family member 1' in r['full'] and 'not asked yet 1' in r['full'] and 'Google search' not in r['full']),
    ('no em dash', not r['em']), ('no page errors', not errs)]
if SHOTS: ok.append(('no sideways scroll on a phone', not r.get('hscroll')))
for n,c in ok: print(('PASS ' if c else 'FAIL ')+n)
print(sum(bool(c) for _,c in ok),'/',len(ok))
if errs: print(errs)
if not all(c for _,c in ok): print(r)
