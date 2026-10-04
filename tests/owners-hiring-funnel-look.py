"""Owners Hub hiring funnel card (2026-10-04, idea 5): the real page, offline, made-up numbers. python3 tests/owners-hiring-funnel-look.py"""
from playwright.sync_api import sync_playwright
import json, os, sys
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
with sync_playwright() as pw:
    b=pw.chromium.launch(); pg=b.new_page(viewport={'width':1100,'height':1250})
    pg.route('**/*', lambda r: r.abort() if 'supabase.co' in r.request.url else r.continue_())
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(800)
    r=pg.evaluate(r"""async()=>{
      document.querySelectorAll('section.panel').forEach(x=>x.classList.remove('active')); document.getElementById('panel-growth').classList.add('active');
      for(const id of ['gate','login','signin']){ const g=document.getElementById(id); if(g) g.style.display='none'; }
      const app=document.getElementById('app'); if(app) app.style.display='block';
      const calls=[]; const ans={ ok:true, months:[{month:'2026-08',applied:14,interviewed:9,noshow:3,offered:5,start_form:4,cleared:3,started:3},{month:'2026-09',applied:18,interviewed:11,noshow:4,offered:6,start_form:5,cleared:3,started:2},{month:'2026-10',applied:3,interviewed:0,noshow:0,offered:0,start_form:0,cleared:0,started:0}],
        medians:{applied_to_interview:3,interview_to_offer:1.5,offer_to_start:12}, noshow_rate:26, retention:{hired:11,still_active:8}, census_ok:true };
      Object.defineProperty(sb,'functions',{ configurable:true, get(){ return { invoke: async(n,o)=>{ calls.push(n); return { data: window.__ans, error:null }; } }; } });
      window.__ans=ans; await loadHiringFunnel(); const ok1=document.getElementById('hiring-funnel').innerText;
      window.__ans={ ...ans, retention:null, census_ok:false, census_error:'AxisCare answered 403 on page 1' }; await loadHiringFunnel(); const noAx=document.getElementById('hiring-funnel').innerText;
      window.__ans={ error:'Owners only.' }; await loadHiringFunnel(); const refused=document.getElementById('hiring-funnel').innerText;
      window.__ans=ans; await loadHiringFunnel();
      document.getElementById('growth-funnel').scrollIntoView(); window.scrollBy(0,-60);
      return { calls, ok1, noAx: /AxisCare could not be read just now \(AxisCare answered 403 on page 1\)/.test(noAx), refused, em: /—/.test(ok1+noAx+refused) };
    }""")
    pg.wait_for_timeout(200); b.close()
ok=[('the card asks the server for the funnel', r['calls'][:1]==['hiring-funnel']),
    ('three months, every step with its share of applicants', 'Applied in\tAugust\tSeptember\tOctober' in r['ok1'] and 'Started\t3 (21%)' in r['ok1']),
    ('typical days, no-show rate and 90-day retention', 'Offer to start: 12 days' in r['ok1'] and 'No-show rate: 26%' in r['ok1'] and '8 of 11' in r['ok1']),
    ('AxisCare unreachable: says so, never shows zero', r['noAx']),
    ('a refusal is shown, not hidden', 'Owners only.' in r['refused']),
    ('no em dash', not r['em']), ('no page errors', not errs)]
for n,c in ok: print(('PASS ' if c else 'FAIL ')+n)
print(sum(c for _,c in ok),'/',len(ok))
