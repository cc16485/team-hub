"""Owners Hub "Grievance log" (528, 2026-10-08): the real page, offline, made-up grievances served by a pretend database;
read only. python3 tests/owners-grievance-log-look.py"""
from playwright.sync_api import sync_playwright
import os
HERE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
with sync_playwright() as pw:
    b = pw.chromium.launch(); pg = b.new_page(viewport={'width': 1100, 'height': 1000})
    import json
    ROWS=[{ 'id':'g2', 'reported_at':'2026-10-07T15:00:00Z', 'client_name_free_text':'Rhoda Real', 'reported_by_name':'Pam', 'reported_by_role':'family', 'summary':'Schedule keeps changing', 'owner':'angiel@mo-care.com', 'state':'in_progress' },
        { 'id':'g1', 'reported_at':'2026-09-01T15:00:00Z', 'client_name_free_text':'Ed Anderson', 'reported_by_name':'Ed', 'reported_by_role':'client', 'summary':'Caregiver rushed', 'owner':'krystal@mo-care.com', 'state':'follow_up', 'resolved_at':'2026-09-04T15:00:00Z', 'resolution_note':'Retrained; letter sent. [Written answer given; told they can also file with DSDS.]', 'follow_up_due':'2026-09-18', 'follow_up_done':False }]
    MODE={'rows':ROWS}; ASKED=[]
    def handle(r):
        u=r.request.url
        if '/rest/v1/client_issue' in u:
            ASKED.append(u); return r.fulfill(status=200, content_type='application/json', body=json.dumps(MODE['rows']))
        if 'supabase.co' in u or 'cc.mo-care.com' in u: return r.abort()
        return r.continue_()
    pg.route('**/*', handle)
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://' + HERE + '/owners.html'); pg.wait_for_timeout(800)
    pg.evaluate("""()=>{ document.querySelectorAll('section.panel').forEach(x=>x.classList.remove('active')); document.getElementById('panel-audits').classList.add('active'); const app=document.getElementById('app'); if(app) app.style.display='block'; }""")
    t1 = pg.evaluate("async()=>{ await renderGrievanceLog(); return document.getElementById('grievance-log').innerText; }")
    asked = ASKED[-1] if ASKED else ''
    MODE['rows'] = []
    t0 = pg.evaluate("async()=>{ await renderGrievanceLog(); return document.getElementById('grievance-log').innerText; }")
    pg.screenshot(path='/tmp/owners_grievance_log.png'); b.close()
ok = [('reads client issues of the Grievance kind only', '/rest/v1/client_issue' in asked and 'category=eq.grievance' in asked),
      ('a summary: 1 open, 1 resolved, typically answered in 3 days', '1 open' in t1 and '1 resolved' in t1 and 'typically answered in 3 days' in t1),
      ('each grievance: reported, client, from, what, owner, where it stands (with the follow-up check), resolved, how it was answered', 'Rhoda Real' in t1 and 'Pam, family' in t1 and 'being worked' in t1 and 'follow-up check (check 2026-09-18)' in t1 and 'told they can also file with DSDS' in t1),
      ('none yet: says where to report one', 'Grievance' in t0 and 'No grievances recorded' in t0),
      ('no page errors', not errs)]
for n, c in ok: print('PASS' if c else 'FAIL', '·', n)
if not all(c for _, c in ok): print(t1, '\n', t0, '\n', asked, errs)
print(f"{sum(1 for _, c in ok if c)} / {len(ok)}")
raise SystemExit(0 if all(c for _, c in ok) else 1)
