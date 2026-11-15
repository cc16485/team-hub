"""Office team tab on the Owners Hub Admin page (2026-11-14, her ask: "pull the place that i can input new office staff in
it's own stub tab thats easy to find"). An owner sees Admin | Office team | Hub settings; the Office team tab shows the
Office staff list (with its Add form) and the Team section, and the Admin tab no longer does. #officeteam and the older
#team links open it. Adding someone is read back, and a save that did not stick is said plainly. Someone without the tabs
(the lead) still sees both sections where they were. The real page, offline, sign-in and database faked.
   python3 tests/office-team-tab-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FAKE=r"""(a)=>{ const email=a.email;
  const PEOPLE=[{person_id:'p-sam',primary_email:'samantha@mo-care.com'},{person_id:'p-kry',primary_email:'krystal@mo-care.com'}];
  const ROLES=[{person_id:'p-sam',role:'owner_admin',entity:'cc_ihs'},{person_id:'p-kry',role:'care_coordinator',entity:'cc_ihs'},{person_id:'p-kry',role:'springfield_lead',entity:'cc_ihs'}];
  const q=(rows)=>{ let r=rows.slice(); const o={ eq:(k,v)=>{ r=r.filter(x=>String(x[k])===String(v)); return o; }, in:(k,vs)=>{ r=r.filter(x=>vs.includes(x[k])); return o; },
    order:()=>o, limit:()=>o, maybeSingle:async()=>({data:null,error:null}), then:(ok)=>ok({data:r,error:null}) }; return o; };
  sb.auth.getSession=async()=>({data:{session:{user:{email}}}});
  sb.from=(t)=>({ select:()=>q(t==='persons'?PEOPLE:t==='staff_roles'?ROLES:[]) });
  sb.rpc=async(n)=>({data:[],error:null});
  window.__list=[{id:'s1',name:'Krystal Land',email:'krystal@mo-care.com',phone:'(417) 555-0111',shift:'day'}];
  window.__keep=true; window.__saves=[];
  saveItem=async(k,it)=>{ window.__saves.push(k); if(window.__keep) window.__list.push(JSON.parse(JSON.stringify(it))); return true; };
  recordEvent=async()=>{}; window.__tells=[]; ccTell=m=>window.__tells.push(m);
  readKey=async(k)=>k==='coordinator_staff'?JSON.parse(JSON.stringify(window.__list)):null;
  loadHubCfg=async()=>{}; renderAuthority=async()=>{}; onbLoadPerms=async()=>{};
  return boot().then(()=>true);
}"""
VIS=r"""()=>{ const v=id=>{ const e=document.getElementById(id); return !!e && e.offsetParent!==null; };
  return { tabs:[...document.querySelectorAll('#atabs button')].map(b=>b.innerText), staff:v('staffSection'), team:v('team'),
    other:[...document.querySelectorAll('#adminView > section')].filter(s=>s.id!=='staffSection'&&s.id!=='team').some(s=>s.offsetParent!==null),
    on:(document.querySelector('#atabs button.on')||{}).innerText||'', hash:location.hash }; }"""
res={}; errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch()
    def page(who, hash=''):
        pg=b.new_page(viewport={'width':1100,'height':1400})
        pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://'+HERE+'/admin.html'+hash); pg.wait_for_timeout(700)
        pg.evaluate(FAKE, {'email':who}); pg.wait_for_timeout(300); return pg
    pg=page('samantha@mo-care.com')
    res['load']=pg.evaluate(VIS)
    pg.click('#atabs button[data-t=team]'); pg.wait_for_timeout(200); res['team']=pg.evaluate(VIS)
    res['sub']=pg.inner_text('#staffSection')
    pg.fill('#ns-name','Angiel Falig'); pg.fill('#ns-email','angiel@mo-care.com'); pg.fill('#ns-phone','(417) 555-5999'); pg.click('#staffSection button.primary'); pg.wait_for_timeout(300)
    res['added']=pg.evaluate("()=>({tell:window.__tells.slice(-1)[0]||'', rows:document.getElementById('staffTable').innerText, name:document.getElementById('ns-name').value})")
    pg.evaluate("()=>{ window.__keep=false; }")
    pg.fill('#ns-name','Ghost Person'); pg.fill('#ns-email','ghost@mo-care.com'); pg.click('#staffSection button.primary'); pg.wait_for_timeout(300)
    res['lost']=pg.evaluate("()=>({tell:window.__tells.slice(-1)[0]||'', rows:document.getElementById('staffTable').innerText, name:document.getElementById('ns-name').value, pill:(document.getElementById('savepill')||{}).innerText})")
    pg.click('#atabs button[data-t=admin]'); pg.wait_for_timeout(200); res['back']=pg.evaluate(VIS); pg.close()
    for h in ('#team','#officeteam'):
        pg=page('samantha@mo-care.com', h); pg.evaluate("()=>{ }")
        pg.reload(); pg.wait_for_timeout(700); pg.evaluate(FAKE, {'email':'samantha@mo-care.com'}); pg.wait_for_timeout(300); res[h]=pg.evaluate(VIS); pg.close()
    pg=page('krystal@mo-care.com'); res['lead']=pg.evaluate(VIS); pg.close()
    b.close()
L,T,A=res['load'],res['team'],res['back']
checks=[('an owner sees three tabs: Admin, Office team, Hub settings', L['tabs']==['Admin','Office team','Hub settings'], L),
        ('on load the Admin tab no longer shows the office staff list or Team', L['on']=='Admin' and not L['staff'] and not L['team'] and L['other'], L),
        ('the Office team tab shows the office staff list and Team, and nothing else', T['on']=='Office team' and T['staff'] and T['team'] and not T['other'] and T['hash']=='#officeteam', T),
        ('it says office staff never get a caregiver check-in and get the office one', 'never sent a caregiver check-in' in res['sub'] and 'office check-in' in res['sub'] and 'Add to the office' in res['sub'], res['sub'][:300]),
        ('adding Angiel: read back, listed, the form cleared, and it says so', 'Angiel Falig is on the office list' in res['added']['tell'] and 'Angiel Falig' in res['added']['rows'] and res['added']['name']=='', res['added']),
        ('a save that does not stick is said plainly and nothing is shown as added', 'did not save to the office list' in res['lost']['tell'] and 'Ghost' not in res['lost']['rows'] and res['lost']['name']=='Ghost Person' and res['lost']['pill']=='Not saved', res['lost']),
        ('back on Admin: the rest again, without the office list', A['on']=='Admin' and not A['staff'] and not A['team'] and A['other'], A),
        ('#team (the Hub\'s link) opens the Office team tab', res['#team']['on']=='Office team' and res['#team']['staff'] and not res['#team']['other'], res['#team']),
        ('#officeteam opens it too', res['#officeteam']['on']=='Office team' and res['#officeteam']['team'], res['#officeteam']),
        ('the lead (no tabs) still sees the office list and Team where they were', not res['lead']['tabs'] and res['lead']['staff'] and res['lead']['team'], res['lead']),
        ('no page errors', not errs, errs)]
for n,ok,*d in checks: print(('PASS  ' if ok else 'FAIL  ')+n+('' if ok else '  '+str(d[0])[:400] if d else ''))
raise SystemExit(0 if all(c[1] for c in checks) else 1)
