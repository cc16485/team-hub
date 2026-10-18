"""Springfield lead runs resignation and end-of-assignment offboarding (Samantha, 2026-10-18): the real Owners Hub page,
offline, sign-in and database faked. The lead sees Offboarding only, can start and tick a Resignation (saved to
'offboardings_team'), cannot pick Termination, and never reads another slot. A Care Coordinator without the role is
turned away. An owner sees both lists as one, and a Termination still saves to the owners-only 'offboardings'.
Screenshot of the lead view.   python3 tests/owners-offboarding-lead-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); OUT=os.environ.get('OUT','/tmp')
FAKE=r"""(email)=>{
  const PEOPLE=[{person_id:'p-sam',primary_email:'samantha@mo-care.com'},{person_id:'p-kry',primary_email:'krystal@mo-care.com'},{person_id:'p-cc',primary_email:'casey@mo-care.com'}];
  const ROLES=[{person_id:'p-sam',role:'owner_admin',entity:'cc_ihs'},{person_id:'p-kry',role:'care_coordinator',entity:'cc_ihs'},{person_id:'p-kry',role:'springfield_lead',entity:'cc_ihs'},{person_id:'p-cc',role:'care_coordinator',entity:'cc_ihs'}];
  const step=(l,i)=>({i,label:l,done_at:null,done_by:null});
  const APP={
    offboardings:[{id:'offT',name:'Terry Term',kind:'Termination',status:'open',reason:'no-call no-show',steps:[step('sign-off',0),step('file',1)]}],
    offboardings_team:[{id:'offR',name:'Rita Resign',kind:'Resignation',status:'open',reason:'moving',steps:[step('file',0),step('schedule',1)]}],
    finance_snapshots:[{id:'2026-09',rev:99999}], discipline_actions:[{id:'d1',caregiver:'Secret Person'}]
  };
  window.__keys=[]; window.__saves=[];
  const q=(t)=>{ let r=t==='persons'?PEOPLE.slice():t==='staff_roles'?ROLES.slice():t==='app_data'?Object.keys(APP).map(k=>({key:k,data:APP[k]})):[];
    const o={ eq:(k,v)=>{ if(t==='app_data'&&k==='key') window.__keys.push(v); r=r.filter(x=>String(x[k])===String(v)); return o; },
      in:(k,vs)=>{ if(t==='app_data'&&k==='key') window.__keys.push(...vs); r=r.filter(x=>vs.includes(x[k])); return o; },
      order:()=>o, limit:()=>o, gte:()=>o, lte:()=>o, not:()=>o, is:()=>o, then:(ok)=>ok({data:r,error:null}) }; return o; };
  sb.auth.getSession=async()=>({data:{session:{user:{email}}}});
  sb.from=(t)=>({ select:()=>q(t) });
  sb.rpc=async(n,args)=>{ if(n==='upsert_app_data_item') window.__saves.push({key:args.target_key,id:args.item.id,kind:args.item.kind}); return {data:[],error:null}; };
  window.confirm=()=>true; window.alert=(m)=>{ (window.__alerts=window.__alerts||[]).push(m); };
  return boot().then(async()=>{
    const out={ app:getComputedStyle(document.getElementById('app')).display, notowner:getComputedStyle(document.getElementById('notowner')).display,
      tabs:[...document.querySelectorAll('nav.tabs button')].map(b=>b.dataset.t), panels:[...document.querySelectorAll('.panel')].map(p=>p.id),
      kinds:[...document.querySelectorAll('#off-kind option')].map(o=>o.value), list:document.getElementById('off-list')?document.getElementById('off-list').innerText:'',
      who:document.getElementById('who').textContent };
    if(out.app==='block'){
      document.getElementById('off-name').value='Nina New'; document.getElementById('off-kind').value='Resignation'; await startOffboarding();
      const nn=OFFBOARDINGS.find(x=>x.name==='Nina New'); await offStep(nn.id,0,true);
      if(email.startsWith('samantha')){ document.getElementById('off-name').value='Tom Fired'; document.getElementById('off-kind').value='Termination'; await startOffboarding(); }
    }
    out.keys=window.__keys; out.saves=window.__saves; out.list2=document.getElementById('off-list')?document.getElementById('off-list').innerText:'';
    return out; });
}"""
res={}; errs={}
with sync_playwright() as pw:
    b=pw.chromium.launch()
    for who in ('krystal@mo-care.com','casey@mo-care.com','samantha@mo-care.com'):
        errs[who]=[]
        pg=b.new_page(viewport={'width':1100,'height':1300})
        pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
        pg.on('pageerror', lambda e, w=who: errs[w].append(str(e)[:200]))
        pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(700)
        res[who]=pg.evaluate(FAKE, who); pg.wait_for_timeout(200)
        if who.startswith('krystal'): pg.screenshot(path=os.path.join(OUT,'owners_offboarding_lead.png'), full_page=True)
        pg.close()
    b.close()
k,c,s=res['krystal@mo-care.com'],res['casey@mo-care.com'],res['samantha@mo-care.com']
checks=[('the lead gets in, labelled Springfield lead', k['app']=='block' and k['notowner']=='none' and 'Springfield lead' in k['who']),
        ('the lead sees the Offboarding tab and panel only', k['tabs']==['offboarding'] and k['panels']==['panel-offboarding']),
        ('the lead can pick Resignation or End of assignment, never Termination', 'Termination' not in k['kinds'] and 'Resignation' in k['kinds'] and len(k['kinds'])==2),
        ('the lead reads only offboardings_team (no owner slot, no finance, no discipline)', set(k['keys'])=={'offboardings_team'}),
        ('the lead sees the existing resignation and not the termination', 'Rita Resign' in k['list'] and 'Terry Term' not in k['list']),
        ('the lead starts and ticks a resignation, saved to offboardings_team only', len(k['saves'])==2 and all(x['key']=='offboardings_team' for x in k['saves']) and 'Nina New' in k['list2'] and '1/' in k['list2']),
        ('a Care Coordinator without the role is turned away and nothing is read or saved', c['notowner']=='flex' and c['app']!='block' and not c['keys'] and not c['saves']),
        ('an owner sees every tab and both lists as one', len(s['tabs'])>=6 and 'Rita Resign' in s['list'] and 'Terry Term' in s['list'] and 'Termination' in s['kinds']),
        ('an owner saves a resignation to offboardings_team and a termination to offboardings',
            [x['key'] for x in s['saves'] if x['kind']=='Resignation']==['offboardings_team','offboardings_team'] and [x['key'] for x in s['saves'] if x['kind']=='Termination']==['offboardings']),
        ('no page errors for the lead or the coordinator', not errs['krystal@mo-care.com'] and not errs['casey@mo-care.com'])]
for n,ok in checks: print(('PASS  ' if ok else 'FAIL  ')+n)
if any(errs.values()): print(errs)
print('saved owners_offboarding_lead.png in', OUT); raise SystemExit(0 if all(ok for _,ok in checks) else 1)
