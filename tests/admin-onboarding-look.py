"""Onboarding workflow card on the Owners Hub Admin page (Slice 0, 2026-10-08): the real page, offline, fake settings and fake
people, the permissions function faked. Two screenshots (laptop and phone width). python3 tests/admin-onboarding-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."); OUT=os.environ.get('OUT','/tmp')
JS=r"""()=>{
  document.getElementById('gate').style.display='none'; document.getElementById('app').style.display='block';
  ME.email='samantha@mo-care.com';
  OPS={ onboarding:{ offer_days:[2,5], step1_days:[2,4], step2_days:[3,6], due_hour:17, step2_sent_due_days:1, verify_due_days:1, final_approval_due_days:1 },
    company_holidays:[{date:'2026-11-26',name:'Thanksgiving Day'},{date:'2026-12-25',name:'Christmas Day'}],
    viventium_step2_checklist:{ version:1, items:['Offer letter signed in Viventium','I-9 Section 1','Federal W-4','Missouri W-4','Direct deposit','ID documents uploaded','FCSR registration'], changed_at:'2026-10-09T14:00:00Z', changed_by:'samantha@mo-care.com', history:[] } };
  ONB_PERMS={ ok:true, version:2, work:[{person_id:'p1',name:'Samantha',email:'samantha@mo-care.com',added_at:'2026-10-09T14:00:00Z',added_by:'install'},{person_id:'p2',name:'Zach',email:'zach@mo-care.com',added_at:'2026-10-09T14:05:00Z',added_by:'samantha@mo-care.com'}],
    advance:[{person_id:'p3',name:'Krystal Land',email:'krystal@mo-care.com',added_at:'2026-10-09T14:10:00Z',added_by:'samantha@mo-care.com'}],
    history:[{at:'2026-10-09T14:05:00Z',by_email:'samantha@mo-care.com',action:'add',kind:'work',name:'Zach'},{at:'2026-10-09T14:10:00Z',by_email:'samantha@mo-care.com',action:'add',kind:'advance',name:'Krystal Land'}],
    me:{ person_id:'p1', may_change_work:true, may_change_advance:true } };
  ONB_PEOPLE=[{person_id:'p1',full_name:'Samantha',email:'samantha@mo-care.com',active:true},{person_id:'p2',full_name:'Zach',email:'zach@mo-care.com',active:true},{person_id:'p3',full_name:'Krystal Land',email:'krystal@mo-care.com',active:true},{person_id:'p4',full_name:'Amber Lee',email:'amber@mo-care.com',active:true}];
  renderOnboarding(); const s=document.getElementById('onbSection'); s.scrollIntoView(); return s.innerText; }"""
with sync_playwright() as pw:
    b=pw.chromium.launch(); errs=[]
    for name,vp in (('laptop',{'width':1100,'height':1600}),('phone',{'width':390,'height':1800})):
        pg=b.new_page(viewport=vp)
        pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
        pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto('file://'+HERE+'/admin.html'); pg.wait_for_timeout(600)
        text=pg.evaluate(JS); pg.wait_for_timeout(200)
        sec=pg.query_selector('#onbSection'); sec.screenshot(path=os.path.join(OUT,'admin_onboarding_'+name+'.png'))
        pg.close()
    b.close()
checks=[('both approval lists with the right names', 'Samantha' in text and 'Zach' in text and 'Krystal Land' in text),
        ('reminder boxes and deadlines', 'Offer reminders' in text and 'Record Step 2 Sent' in text),
        ('holidays listed', 'Thanksgiving Day' in text and 'Christmas Day' in text),
        ('checklist version shown', 'Version 1' in text),
        ('switch date locked and not set', 'Not set' in text and 'Locked' in text),
        ('no page errors', not errs)]
bad=[c for c,ok in checks if not ok]
for c,ok in checks: print(('PASS  ' if ok else 'FAIL  ')+c)
print('saved admin_onboarding_laptop.png and admin_onboarding_phone.png in', OUT); raise SystemExit(1 if bad else 0)
