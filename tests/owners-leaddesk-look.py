"""Owners Hub "Lead response and losses" card (Leads intake desk Stage 5, 2026-10-07): the real page, offline, made-up leads, the
CC Hub's own lead-rules.js injected from the sibling checkout (the live page loads it from cc.mo-care.com). The clock is frozen
at Oct 6 2026 10:10 am Chicago. python3 tests/owners-leaddesk-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
HUBDIR=os.environ.get("HUB_DIR", os.path.join(HERE, "..", "cc-hub-live"))
RULES=os.path.join(HUBDIR, "lead-rules.js"); PRULES=os.path.join(HUBDIR, "partner-rules.js"); SRULES=os.path.join(HUBDIR, "speed-rules.js")
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1100,'height':1400})
    pg.route('**/*', lambda r: r.abort() if ('supabase.co' in r.request.url or 'cc.mo-care.com' in r.request.url) else r.continue_())
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(800)
    before=pg.evaluate(r"""()=>{ document.querySelectorAll('section.panel').forEach(x=>x.classList.remove('active')); document.getElementById('panel-growth').classList.add('active');
      const app=document.getElementById('app'); if(app) app.style.display='block'; renderLeadDesk(); return document.getElementById('growth-leaddesk').innerText; }""")
    pg.add_script_tag(path=RULES); pg.add_script_tag(path=PRULES); pg.add_script_tag(path=SRULES)
    r=pg.evaluate(r"""()=>{
      window.__RealDate=Date; window.__NOW=new __RealDate('2026-10-06T15:10:00Z').getTime();
      Date=class extends __RealDate{ constructor(...a){ if(a.length) super(...a); else super(window.__NOW); } static now(){ return window.__NOW; } };
      OPS_SET={ lead_response_hours:{ days:[0,1,2,3,4,5,6], start:'08:00', end:'18:00' } }; ORGS={ org1:{ id:'org1', name:'Mercy Rehab', type:'Rehab / Skilled Nursing', created_at:'2025-01-01T00:00:00Z', owner_email:'krystal@mo-care.com', contacts:[{ id:'c1', name:'Lisa Marsh' }] },
        org2:{ id:'org2', name:'Ozark Rehab', type:'Rehab / Skilled Nursing', created_at:'2026-10-20T00:00:00Z' }, org3:{ id:'org3', name:'Quiet Clinic', type:'Physician Office', created_at:'2024-01-01T00:00:00Z' } };
      REF_ACTS=[{ org_id:'org1', kind:'dropby', at:'2026-10-01T15:00:00Z' }, { org_id:'org3', kind:'call', at:'2026-06-01T15:00:00Z' }]; REF_NEXT=[]; LEADS=[];
      LEADS=[
        { id:'a', source:'Website', created_at:'2026-10-06T14:58:00Z', first_human_attempt_at:'2026-10-06T15:02:00Z', first_human_contact_at:'2026-10-06T15:02:00Z', assigned_coordinator:'Krystal', rungs:{ owner_at:'2026-10-06T15:03:00Z' }, speed_miss:{ owner:'krystal@mo-care.com', minutes:30 }, comm_log:[{ kind:'owner', body:'Angiel took this inquiry from Krystal' }] },
        { id:'b', created_at:'2026-10-06T02:02:00Z', first_human_attempt_at:'2026-10-06T13:12:00Z', assigned_coordinator:'Krystal' },
        { id:'c', created_at:'2026-10-01T15:00:00Z', assigned_coordinator:'Krystal' },
        { id:'d', source:'Referral', created_at:'2026-09-20T15:00:00Z', first_human_attempt_at:'2026-09-20T16:30:00Z', first_human_contact_at:'2026-09-20T16:30:00Z', said_yes_at:'2026-09-28T15:00:00Z', status:'Converted', converted_at:'2026-09-28T15:00:00Z', first_shift_at:'2026-10-02T13:00:00Z', referral_org_id:'org1', schedule:{ days:['Mon'], times:'', hours_per_week:20 }, assigned_coordinator:'Samantha' },
        { id:'e', created_at:'2026-09-25T15:00:00Z', first_human_attempt_at:'2026-09-25T15:03:00Z', status:'Lost', lost_at:'2026-10-02T15:00:00Z', lost_reason_key:'could_not_staff', lost_schedule:{ hours_per_week:20, city:'Ozark' }, assigned_coordinator:'Krystal' },
        { id:'f', created_at:'2026-09-26T15:00:00Z', first_human_attempt_at:'2026-09-26T15:03:00Z', status:'Lost', lost_at:'2026-10-03T15:00:00Z', lost_reason:'Price', schedule:{ days:['Mon'], times:'', hours_per_week:8 }, assigned_coordinator:'Krystal' },
        { id:'g', created_at:'2026-09-01T15:00:00Z', first_human_attempt_at:'2026-09-01T15:30:00Z', assigned_coordinator:'Krystal' },
        { id:'s', created_at:'2026-10-05T15:00:00Z', spam:{ at:'x' } } ];
      LEADS.find(l=>l.id==='d').referral_contact_id='c1';
      renderLeadDesk(); renderFunnel(); renderSpeed('week'); const sw=document.getElementById('growth-speed').innerText; renderSpeed('quarter'); const sq=document.getElementById('growth-speed').innerText; window.__SPEED=[sw,sq,document.getElementById('speed-periods').innerText]; REL_FILTER='attention'; renderRelationships(); document.getElementById('growth-leaddesk').scrollIntoView();
      const att=document.getElementById('growth-relationships').innerText; REL_FILTER='all'; renderRelationships();
      return [document.getElementById('growth-leaddesk').innerText, document.getElementById('growth-funnel').innerText, att, document.getElementById('growth-relationships').innerText, window.__SPEED]; }""")
    r,f,ra,rall,sp=r; sw,sq,spills=sp
    pg.wait_for_timeout(200); b.close()
ok=[('without the rules file the card says so and shows no numbers', 'did not load' in before and '%' not in before),
    ('2026-10-22: the speed tiles moved to Speed to lead; this card points there and keeps the outcomes', 'is in Speed to lead above' in r and 'median first attempt' not in r and 'never attempted\n' not in r.split('By Care Coordinator')[0]),
    ('Speed to lead · the answer, the tiles, the wait bar, 8 weeks, the days, how they reached us, every family', 'IS IT A PROBLEM?' in sw.upper() and 'middle wait to the first call' in sw and 'How long families waited' in sw and 'The last 8 weeks' in sw and 'Where the time goes' in sw and 'Called us:' in sw and 'Every family' in sw),
    ('Speed to lead · this week counts only this week (Oct 5 on); the quarter counts the older families too', 'this week' in sw.lower() and 'this quarter' in sq.lower() and sq.count('\n') > sw.count('\n')),
    ('Speed to lead · three period buttons', 'This week' in spills and 'Last 4 weeks' in spills and 'This quarter' in spills),
    ('said yes 1, typically 8 days from inquiry to yes', 'typically 8 days from inquiry to yes' in r),
    ('lost 2 for 28 hrs/wk', '28 hrs/wk walked away' in r),
    ('started care 1, typically 4 days from yes to first shift', 'started care' in r and 'typically 4 days from yes to first shift' in r),
    ('referral partners (step 6): Mercy Rehab sent 1, first try 1.5 h, reached 1, said yes 1, started 1, 12 days, 0 open, 0 didn\'t start, 20 hrs', 'Mercy Rehab · Rehab / Skilled Nursing\t1\t1.5 h\t1\t1\t1\t12\t0\t0\t20' in r),
    ('...labelled: referrals received in the period; started = the first clock-in', 'referrals received in the period; started = the first clock-in' in r and 'the first clock-in in AxisCare' in r),
    ('...by the person who referred: Lisa Marsh', 'By the person who referred' in r and 'Lisa Marsh · Mercy Rehab\t1' in r),
    ('relationships: Needs attention shows the new partner (needs an owner) and the overdue one, not Mercy (visited Oct 1)', 'Needs an owner' in ra and 'Ozark Rehab' in ra and 'Quiet Clinic' in ra and 'Mercy Rehab' not in ra),
    ('...All shows every partner with owner, tier, last touch and next due (Mercy: Krystal)', 'Mercy Rehab' in rall and 'Krystal' in rall and 'Next due' in rall and 'Owner' in rall),
    ('the old speed bar is gone from this card (it is the wait bar in Speed to lead)', '≤5 min' not in r),
    ('lost by reason: could not staff (20 hrs, Ozark) above Price (8)', 'Could not staff the schedule\t1\t20\tOzark' in r and 'Price\t1\t8' in r and r.index('Could not staff') < r.index('Price')),
    ('by owner: Krystal 5 inquiries, median 4 min, 1 never attempted; Samantha 1, 1 h 30 min, said yes', 'Krystal\t5\t4 min\t1\t1\t0' in r and 'Samantha\t1\t1 h 30 min\t1\t0\t1' in r),
    ('item 4 · Medicaid pipeline block: waiting on the state, heard from us this week, over 45 days, bridge hours offered', 'waiting on the state' in r and 'heard from us this week' in r and 'over 45 days' in r and 'bridge hours offered' in r),
    ('item 4 · by source table with Website and the referral subtype', 'By source, this period' in r and 'Website' in r and 'Referral · Rehab / skilled nursing' in r),
    ('item 4 · the team table has Late, Misses, Took and Missing required; Krystal 1 late, 1 miss; Angiel took 1', 'Late\tMisses\tTook\tMissing required' in r and 'Krystal\t5\t4 min\t1\t1\t0\t1\t1\t0' in r and 'Angiel' in r),
    ('item 4 · the funnel card is bars for this month and last with %', 'Inquiry' in f and 'First shift' in f and '%' in f and 'This month' in f and 'Last month' in f),
    ('no em dash', '—' not in r and '—' not in f and '—' not in sw and '—' not in sq), ('no page errors', not errs)]
for n,c in ok: print(('PASS ' if c else 'FAIL ')+n)
if not all(c for _,c in ok): print(r[r.find("By Care Coordinator"):][:700])
print(sum(c for _,c in ok),'/',len(ok))
