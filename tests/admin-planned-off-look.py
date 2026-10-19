"""Planned time off on the Owners Hub Team page (2026-10-18, ops_settings.planned_time_off_live): with it on an owner sees
an Out from box beside Out until; a future plan shows "planned from", not "out"; Out from needs an Out until on or after it;
clearing Out until clears Out from too. Off: Out until alone, as before. The lead view never reads ops_settings (SOP 9).
The real page, offline, sign-in and database faked.   python3 tests/admin-planned-off-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
FAKE=r"""(a)=>{ const email=a.email;
  const PEOPLE=[{person_id:'p-sam',primary_email:'samantha@mo-care.com'},{person_id:'p-kry',primary_email:'krystal@mo-care.com'},{person_id:'p-cc',primary_email:'casey@mo-care.com'}];
  const ROLES=[{person_id:'p-sam',role:'owner_admin',entity:'cc_ihs'},{person_id:'p-kry',role:'care_coordinator',entity:'cc_ihs'},{person_id:'p-kry',role:'springfield_lead',entity:'cc_ihs'},{person_id:'p-cc',role:'care_coordinator',entity:'cc_ihs'}];
  window.__reads=[];
  const q=(rows)=>{ let r=rows.slice(); const o={ eq:(k,v)=>{ r=r.filter(x=>String(x[k])===String(v)); return o; }, in:(k,vs)=>{ r=r.filter(x=>vs.includes(x[k])); return o; },
    order:()=>o, limit:()=>o, then:(ok)=>ok({data:r,error:null}) }; return o; };
  sb.auth.getSession=async()=>({data:{session:{user:{email}}}});
  sb.from=(t)=>({ select:()=>q(t==='persons'?PEOPLE:t==='staff_roles'?ROLES:[]) });
  sb.rpc=async(n)=>({data:[],error:null});
  window.__saves=[]; saveItem=async(k,it)=>{ window.__saves.push({k, it:JSON.parse(JSON.stringify(it))}); return true; }; recordEvent=async()=>{}; window.__tells=[]; ccTell=m=>window.__tells.push(m);
  readKey=async(k)=>{ window.__reads.push(k); return k==='coordinator_staff'?[{id:'s1',name:'Krystal Land',email:'krystal@mo-care.com',phone:'(417) 555-0111',shift:'day'},{id:'s2',name:'Angiel Rose',email:'angiel@mo-care.com',phone:'(417) 555-0112',shift:'day',out_from:'2099-01-05',out_until:'2099-01-09'}]:k==='on_call_schedule'?[]:k==='ops_settings'?{ planned_time_off_live:a.on }:null; };
  loadHubCfg=async()=>{}; renderAuthority=async()=>{}; onbLoadPerms=async()=>{};
  return boot().then(()=>({ head:document.querySelector('#staffTable thead').innerText, body:document.querySelector('#staffTable tbody').innerText, reads:window.__reads }));
}"""
ACT=r"""async()=>{ const R={};
  window.__tells.length=0; await staffOutFrom('s1','2099-02-01'); R.noUntil=window.__tells.slice(-1)[0]||''; R.s1from=(STAFF.find(x=>x.id==='s1')||{}).out_from||'';
  await staffOut('s1','2099-02-10'); await staffOutFrom('s1','2099-02-12'); R.after=window.__tells.slice(-1)[0]||'';
  await staffOutFrom('s1','2099-02-03'); R.saved=(STAFF.find(x=>x.id==='s1')||{}).out_from;
  await staffOut('s1',''); const k=STAFF.find(x=>x.id==='s1'); R.cleared=!k.out_until&&!k.out_from;
  return R; }"""
res={}; errs=[]
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for who,on in (('samantha@mo-care.com',True),('samantha@mo-care.com',False),('krystal@mo-care.com',True)):
        pg=b.new_page(viewport={'width':1100,'height':1400})
        pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://'+HERE+'/admin.html'); pg.wait_for_timeout(700)
        r=pg.evaluate(FAKE, {'email':who,'on':on})
        if who.startswith('samantha') and on: r['act']=pg.evaluate(ACT)
        res[(who,on)]=r; pg.close()
    b.close()
s_on,s_off,k=res[('samantha@mo-care.com',True)],res[('samantha@mo-care.com',False)],res[('krystal@mo-care.com',True)]
a=s_on.get('act',{})
checks=[('on · the owner sees Out from beside Out until', 'Out from' in s_on['head'] and 'Out until' in s_on['head']),
        ('on · Angiel\'s future time off says "planned from", not "out"', 'planned from 2099-01-05' in s_on['body'] and '\tout' not in s_on['body']),
        ('Out from needs an Out until first', 'Set Out until' in a.get('noUntil','') and not a.get('s1from')),
        ('Out from after the last day is refused', 'after the last day' in a.get('after','')),
        ('a good Out from is saved', a.get('saved')=='2099-02-03'),
        ('clearing Out until clears Out from too', a.get('cleared') is True),
        ('off · Out until alone, as before', 'Out from' not in s_off['head'] and 'Out until' in s_off['head']),
        ('the lead view never reads ops_settings, has no Out from box, still shows "planned from"', 'ops_settings' not in k['reads'] and 'Out from' not in k['head'] and 'planned from 2099-01-05' in k['body']),
        ('no page errors', not errs)]
for n,ok in checks: print(('PASS  ' if ok else 'FAIL  ')+n)
if errs: print(errs)
raise SystemExit(0 if all(ok for _,ok in checks) else 1)
