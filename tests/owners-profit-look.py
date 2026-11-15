"""Owners Hub Profit & Plan tab and Cockpit profit tiles (2026-11-15): the real page, offline, MADE-UP numbers only.
python3 tests/owners-profit-look.py   (SHOTS=1 writes profit-desktop.png, profit-phone.png, cockpit-profit.png)"""
from playwright.sync_api import sync_playwright
import os
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHOTS=os.environ.get('SHOTS')
LINES=[{"key":"income","label":"Client income","kind":"income"},{"key":"wages","label":"Wages","kind":"pay"},
       {"key":"rent","label":"Office rent","kind":"cost"},{"key":"interest","label":"Interest","kind":"interest"}]
def mo(m,inc,w,r,i,rec=False,o=None): return {"m":m,"v":{"income":inc,"wages":w,"rent":r,"interest":i},"o":o or {},"reconciled":rec}
MONTHS=[mo("2025-%02d"%k,10000,6000,1000,100,True) for k in (11,12)]+[mo("2026-%02d"%k,10000,6000,1000,100) for k in range(1,10)]+[mo("2026-10",10000,12000,1000,100,o={"rent_in":500})]
PROFIT={"as_of":"2026-11-15","closed_through":"2026-10","reconciled_through":"2025-12","status":"Test status.","by_business":"Test by business.",
  "lines":LINES,"outside":[{"key":"rent_in","label":"Rent received","why":"Not care."},{"key":"erc","label":"One-time refund","why":"Once."}],
  "months":MONTHS,"years":[{"y":2025,"v":{"income":100000,"wages":60000,"rent":12000,"interest":1000},"o":{"erc":5000},"reconciled":True}],
  "budget":{"year":2026,"status":"draft","note":"Test budget.","months":[{"m":"2026-%02d"%k,"v":{"income":10000,"wages":6000,"rent":500,"interest":100},"o":{}} for k in range(1,13)]},
  "checks":[{"state":"ok","label":"Clean months","text":"Twenty four."},{"state":"no","label":"Returns filed","text":"Not yet <b>x</b>."}]}
SNAP={"saved_at":"2026-11-15T12:00:00Z","cash":{"status":"ok","total":5000},"profit":PROFIT}
def run(pg):
    return pg.evaluate(r"""async(snap)=>{
      for(const id of ['signin','notowner']){ const g=document.getElementById(id); if(g) g.style.display='none'; }
      document.getElementById('app').style.display='block';
      const tabs=[...document.querySelectorAll('nav.tabs button')].map(b=>b.innerText.trim());
      const box=document.getElementById('owner-profit');
      OwnerProfit.render(box,{}, {}); const empty=box.innerText;
      document.dispatchEvent(new CustomEvent('owner-money:failed',{detail:'Sign in to the Hub first.'}));
      const failed=box.innerText, ckFailed=document.getElementById('cockpit-profit').innerText;
      OSET.goal_price=600000; OSET.mult_low=3; OSET.mult_high=5; OSET.replace_pay=null;
      document.dispatchEvent(new CustomEvent('owner-money:loaded',{detail:snap}));
      go('money', document.querySelector('nav.tabs button[data-t=money]'));
      const full=box.innerText, html=box.innerHTML, checks=document.getElementById('profit-checks').innerText, checksHtml=document.getElementById('profit-checks').innerHTML;
      const cockpit=document.getElementById('cockpit-profit').innerText;
      OSET.replace_pay=30000; renderProfit(); const withPay=box.innerText;
      const sp=Object.assign({},snap); delete sp.cash; document.dispatchEvent(new CustomEvent('owner-money:loaded',{detail:sp}));
      const noCash=document.getElementById('cockpit-profit').innerText;
      document.dispatchEvent(new CustomEvent('owner-money:loaded',{detail:snap}));
      const all=document.getElementById('panel-money').innerText+document.getElementById('panel-cockpit').innerText;
      return {tabs,empty,failed,ckFailed,full,html,checks,checksHtml,cockpit,withPay,noCash,
        old:!!document.getElementById('fs-month')||!!document.getElementById('budget-table'),
        em:/—/.test(full+cockpit+checks), all};
    }""", SNAP)
with sync_playwright() as pw:
    b=pw.chromium.launch()
    pg=b.new_page(viewport={'width':1100,'height':1100})
    pg.route('**/*', lambda r: r.abort() if 'supabase.co' in r.request.url else r.continue_())
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(1200)
    r=run(pg)
    if SHOTS:
        pg.screenshot(path=os.path.join(HERE,'profit-desktop.png'), full_page=True)
        pg.evaluate("go('cockpit', document.querySelector('nav.tabs button[data-t=cockpit]'))")
        pg.screenshot(path=os.path.join(HERE,'cockpit-profit.png'))
        pg.evaluate("go('money', document.querySelector('nav.tabs button[data-t=money]'))")
        pg.set_viewport_size({'width':375,'height':900}); pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(HERE,'profit-phone.png'), full_page=True)
        r['hscroll']=pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
    b.close()
f=r['full']; c=r['cockpit']
# made-up math: a normal month = 10,000 - 6,000 - 1,000 - 100 = 2,900; Oct = 10,000 - 12,000 - 1,000 - 100 = -3,100
# last 12 months: income 120,000; pay 78,000 (65%); profit 11*2,900 - 3,100 = 28,800; owner earnings 28,800 + 1,200 = 30,000
ok=[('tab is called Profit & Plan', any('Profit & Plan' in t for t in r['tabs']) and not any(t.startswith('Financials') for t in r['tabs'])),
    ('the old typed form and typed budget are gone', not r['old']),
    ('no snapshot: says so, no numbers', 'No profit numbers yet' in r['empty'] and '$' not in r['empty']),
    ('load failure is said in red on both, never $0', 'Could not load the profit numbers' in r['failed'] and 'Could not load' in r['ckFailed']),
    ('last 12 months tiles add up', '$120,000' in f and '65%' in f and '$28,800' in f and '$30,000' in f),
    ('a losing month shows as a negative', '-$3,100' in f),
    ('unreconciled months are marked, reconciled ones are not', 'not reconciled' in f),
    ('full-year row', 'All of 2025' in f),
    ('budget: draft chip, so-far columns, worse line flagged', 'draft, waiting on your targets' in f and 'Budget so far' in f and 'Through October 2026' in f),
    ('budget vs actual: profit 23,000 vs 34,000 so far = -11,000', '$34,000' in f and '$23,000' in f and '-$11,000' in f),
    ('outside items listed with reasons, kept out of profit', 'Kept out of operating profit' in f and 'Rent received' in f and 'Not care.' in f and '$5,000' in f),
    ('value: no manager pay set warns it is too high', 'Until the manager pay is set, the value above is too high' in f and '$90,000 to $150,000' in f),
    ('value with manager pay set: (30,000-30,000) gives no value', 'no value on today' in r['withPay']),
    ('checks: states shown, text escaped', 'Done' in r['checks'] and 'Not yet' in r['checks'] and '&lt;b&gt;x' in r['checksHtml']),
    ('cockpit: last month, year so far vs budget, cash', 'Profit, October 2026' in c and '-$3,100' in c and 'Profit, 2026 so far' in c and '$11,000 behind budget' in c and '$5,000' in c),
    ('cockpit says it is not reconciled after December 2025', 'Not reconciled after December 2025' in c),
    ('cockpit with no cash: not read yet, never $0', 'not read yet' in r['noCash']),
    ('no em dashes in the new words', not r['em']),
    ('no page errors', not errs)]
if SHOTS: ok.append(('phone: no sideways scroll', not r.get('hscroll')))
bad=[n for n,v in ok if not v]
for n,v in ok: print(('PASS ' if v else 'FAIL ')+n)
if errs: print(errs)
print(f'{len(ok)-len(bad)}/{len(ok)}')
raise SystemExit(1 if bad else 0)
