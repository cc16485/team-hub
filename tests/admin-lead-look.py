"""Springfield lead on the Owners Hub Admin page (SOP ruling 9, 2026-10-17): the real page, offline, sign-in and database faked.
The lead sees Staff, Team, On call and the on-duty schedule link, nothing owner-only; a plain Care Coordinator is turned away;
an owner still sees everything. Screenshot of the lead view.   python3 tests/admin-lead-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); OUT=os.environ.get('OUT','/tmp')
FAKE=r"""(email)=>{
  const PEOPLE=[{person_id:'p-sam',primary_email:'samantha@mo-care.com'},{person_id:'p-kry',primary_email:'krystal@mo-care.com'},{person_id:'p-cc',primary_email:'casey@mo-care.com'}];
  const ROLES=[{person_id:'p-sam',role:'owner_admin',entity:'cc_ihs'},{person_id:'p-kry',role:'care_coordinator',entity:'cc_ihs'},{person_id:'p-kry',role:'springfield_lead',entity:'cc_ihs'},{person_id:'p-cc',role:'care_coordinator',entity:'cc_ihs'}];
  window.__reads=[];
  const q=(rows)=>{ let r=rows.slice(); const o={ eq:(k,v)=>{ r=r.filter(x=>String(x[k])===String(v)); return o; }, in:(k,vs)=>{ r=r.filter(x=>vs.includes(x[k])); return o; },
    order:()=>o, limit:()=>o, then:(ok)=>ok({data:r,error:null}) }; return o; };
  sb.auth.getSession=async()=>({data:{session:{user:{email}}}});
  sb.from=(t)=>({ select:()=>q(t==='persons'?PEOPLE:t==='staff_roles'?ROLES:[]) });
  sb.rpc=async(n)=>({data:[],error:null});
  readKey=async(k)=>{ window.__reads.push(k); return k==='coordinator_staff'?[{id:'s1',name:'Krystal Land',email:'krystal@mo-care.com',phone:'(417) 555-0111',shift:'day'}]:k==='on_call_schedule'?[]:null; };
  loadHubCfg=async()=>{}; renderAuthority=async()=>{}; onbLoadPerms=async()=>{};
  return boot().then(()=>({ app:getComputedStyle(document.getElementById('app')).display, notadmin:getComputedStyle(document.getElementById('notadmin')).display,
    h2:[...document.querySelectorAll('#adminView section h2')].map(h=>h.textContent), tabs:!!document.getElementById('atabs'),
    hs:!!document.getElementById('hsView'), who:document.getElementById('whopill').textContent, reads:window.__reads }));
}"""
res={}; errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for who in ('krystal@mo-care.com','casey@mo-care.com','samantha@mo-care.com'):
        pg=b.new_page(viewport={'width':1100,'height':1400})
        pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://'+HERE+'/admin.html'); pg.wait_for_timeout(700)
        res[who]=pg.evaluate(FAKE, who); pg.wait_for_timeout(200)
        if who.startswith('krystal'): pg.screenshot(path=os.path.join(OUT,'admin_lead.png'), full_page=True)
        pg.close()
    b.close()
k,c,s=res['krystal@mo-care.com'],res['casey@mo-care.com'],res['samantha@mo-care.com']
OWNER_ONLY={'System status','Switches','Onboarding workflow','Who may do what','Missed call chasing','Care hub settings','Where everything lives'}
checks=[('the lead gets in', k['app']=='block' and k['notadmin']=='none' and 'Springfield lead' in k['who']),
        ('the lead sees Staff, Team, On call and the on-duty schedule', all(x in k['h2'] for x in ('Staff','Team','On call','On-duty schedule'))),
        ('the lead sees nothing owner-only (no switches, settings, status, Hub settings tab)', not (OWNER_ONLY & set(k['h2'])) and not k['tabs'] and not k['hs']),
        ('the lead view never reads ops_settings or ops_items', 'ops_settings' not in k['reads'] and 'ops_items' not in k['reads']),
        ('a Care Coordinator without the role is turned away and nothing is read', c['notadmin']=='flex' and c['app']!='block' and not c['reads']),
        ('an owner still sees every section and the Hub settings tab', OWNER_ONLY <= set(s['h2']) and s['tabs'] and s['hs']),
        ('no page errors', not errs)]
for n,ok in checks: print(('PASS  ' if ok else 'FAIL  ')+n)
if errs: print(errs)
print('saved admin_lead.png in', OUT); raise SystemExit(0 if all(ok for _,ok in checks) else 1)
