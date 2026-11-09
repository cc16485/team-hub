"""Owners Hub Money tab (2026-11-09): the real page, offline, MADE-UP numbers only.
python3 tests/owners-money-look.py   (SHOTS=1 writes money-desktop.png and money-phone.png)"""
from playwright.sync_api import sync_playwright
import os, json
HERE=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
SHOTS=os.environ.get('SHOTS')
NOW='2026-11-09T13:00:00Z'
SNAP={"saved_at":"2026-11-09T12:40:00Z","source_note":"Test numbers.",
  "cash":{"status":"short","message":"Payroll Friday is $1,200 more than the main account holds.","total":12000.5,
    "accounts":[{"name":"Main checking","balance":9000.25,"as_of":"2026-11-09"},{"name":"Medicaid checking","balance":3000.25,"as_of":"2026-10-30","note":"from statements"}],
    "upcoming":[{"date":"2026-11-13","what":"Payroll","amount":-10200,"estimate":True,"from":"Main checking"},{"date":"2026-11-14","what":"Loan payment","amount":-500}],
    "low_point":-1200,"low_date":"2026-11-13","note":"Test note."},
  "books":{"last_run":"2026-11-09","posted":42,"questions":[
    {"id":"q1","date":"2026-11-03","account":"Main checking","amount":-52.1,"desc":"STORE 123","ask":"Business or personal?","choices":["Business: supplies","Personal"]},
    {"id":"q2","date":"2026-11-04","account":"Card 1111","amount":-19.99,"desc":"APP <b>X</b>"}]},
  "debts":{"items":[{"name":"Loan A","balance":10000,"rate":36,"payment":800,"every":"monthly","interest_ytd":1500,"pay_first":True},
                    {"name":"Loan B","balance":200000,"rate":10,"payment":3000,"interest_ytd":15000,"estimate":True},
                    {"name":"Loan C","balance":None,"estimate":True}],
           "pay_first":"Loan A costs 36% a year, the highest rate."},
  "taxes":{"set_aside_month":2500,"estimate":True,"basis":"About 25% of this year's profit so far.","saved":4000,
           "years":[{"year":2024,"status":"Draft ready","due":"Past due"},{"year":2026,"status":"Books in progress","due":"April 15, 2027"}],
           "open_items":["Item one","Item two"]}}
def run(pg):
    return pg.evaluate(r"""async([snap,now])=>{
      for(const id of ['signin','notowner']){ const g=document.getElementById(id); if(g) g.style.display='none'; }
      document.getElementById('app').style.display='block';
      const tabs=[...document.querySelectorAll('nav.tabs button')].map(b=>b.dataset.t);
      go('cash', document.querySelector('nav.tabs button[data-t=cash]'));
      const box=document.getElementById('owner-money'), N=new Date(now).getTime();
      OwnerMoney.render(box, {}, {}, N); const empty=box.innerText;
      OwnerMoney.render(box, Object.assign({},snap,{saved_at:'2026-11-06T12:00:00Z'}), {}, N); const stale=box.innerText;
      // answering: fake sign-in + fake server
      snap=Object.assign({},snap,{saved_at:new Date(Date.now()-20*60e3).toISOString()});
      const calls=[]; window.fetch=async(u,o)=>{ const b=JSON.parse(o.body); calls.push(b);
        if(b.mode==='read') return new Response(JSON.stringify({ok:true,snapshot:snap,answers:{}}));
        return new Response(JSON.stringify({ok:true})); };
      const fakeSb={ auth:{ getSession:async()=>({data:{session:{access_token:'tok'}}}) } };
      OwnerMoney.wire(fakeSb,'anon',box); await OwnerMoney.load(fakeSb,'anon',box);
      const fresh=box.innerText, html=box.innerHTML;
      box.querySelector('button[data-omq="q1"][data-oma="Personal"]').click(); await new Promise(r=>setTimeout(r,50));
      const afterPick=box.innerText;
      box.querySelector('input[data-omt="q2"]').value='Business: software'; box.querySelector('button[data-oms="q2"]').click(); await new Promise(r=>setTimeout(r,50));
      const afterType=box.innerText;
      box.querySelector('button[data-omc="q1"]').click(); await new Promise(r=>setTimeout(r,50));
      const afterClear=box.innerText;
      window.fetch=async()=>new Response(JSON.stringify({error:'The Money tab is for owners only.'}),{status:403});
      await OwnerMoney.load(fakeSb,'anon',box); const denied=box.innerText;
      await OwnerMoney.load(fakeSb,'anon',box); // leave it showing the real cards for the screenshot
      window.fetch=async(u,o)=>{ const b=JSON.parse(o.body); return new Response(JSON.stringify(b.mode==='read'?{ok:true,snapshot:snap,answers:{}}:{ok:true})); };
      await OwnerMoney.load(fakeSb,'anon',box);
      const all=document.getElementById('panel-cash').innerText+empty+stale+denied;
      return { tabs, empty, stale, fresh, html, afterPick, afterType, afterClear, denied, calls, em:/—/.test(all) };
    }""", [SNAP, NOW])
with sync_playwright() as pw:
    b=pw.chromium.launch()
    pg=b.new_page(viewport={'width':1100,'height':1100})
    pg.route('**/*', lambda r: r.abort() if 'supabase.co' in r.request.url else r.continue_())
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
    pg.goto('file://'+HERE+'/owners.html'); pg.wait_for_timeout(1200)
    r=run(pg)
    if SHOTS:
        pg.screenshot(path=os.path.join(HERE,'money-desktop.png'), full_page=True)
        pg.set_viewport_size({'width':375,'height':900}); pg.wait_for_timeout(200)
        pg.screenshot(path=os.path.join(HERE,'money-phone.png'), full_page=True)
        r['hscroll']=pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
    b.close()
c=r['calls']; f=r['fresh']
ok=[('Money tab sits right after Cockpit', r['tabs'][:2]==['cockpit','cash']),
    ('no snapshot yet: says so, shows no numbers', 'No numbers yet' in r['empty'] and '$' not in r['empty']),
    ('a 3-day-old snapshot is called old', 'These numbers are old' in r['stale']),
    ('fresh snapshot: saved time shown, not called old', 'saved less than an hour ago' in f and 'old' not in f.split('\n')[0]),
    ('cash: short warning, balances, total, payroll estimate, low point', 'Short' in f and 'Payroll Friday is $1,200 more' in f and '$9,000.25' in f and '$12,000.50' in f and 'estimate' in f and '-$1,200.00' in f),
    ('books: 2 waiting, answering is the OK to post', '2 waiting on you' in f and 'Answering one is your OK to post it' in f),
    ('bank text is shown as text, never as HTML', '<b>X</b>' in f and '&lt;b&gt;X' in r['html']),
    ('debts: totals, pay this first, why', '$210,000' in f and '$16,500' in f and 'pay this first' in f and 'highest rate' in f),
    ('a loan with no balance says not known yet, never $0', 'not known yet' in f and 'plus loans not known yet' in f and '$0\t' not in f and '\t$0\n' not in f),
    ('taxes: set-aside, past due, tax preparer list', '$2,500' in f and 'Past due' in f and 'Item two' in f),
    ('first call reads with the sign-in', c and c[0]=={'mode':'read'}),
    ('tapping a choice saves it and marks it answered', {'mode':'answer','qid':'q1','answer':'Personal'} in c and '1 waiting on you' in r['afterPick'] and 'Answered, posts Monday' in r['afterPick']),
    ('typing an answer saves it', {'mode':'answer','qid':'q2','answer':'Business: software'} in c and 'Nothing waiting' in r['afterType']),
    ('clear sends an empty answer and reopens it', {'mode':'answer','qid':'q1','answer':''} in c and '1 waiting on you' in r['afterClear']),
    ('not an owner: says so, shows no numbers', 'for owners only' in r['denied'] and '$' not in r['denied']),
    ('no em dash', not r['em']), ('no page errors', not errs)]
if SHOTS: ok.append(('no sideways scroll on a phone', not r.get('hscroll')))
for n,cnd in ok: print(('PASS ' if cnd else 'FAIL ')+n)
print(sum(bool(x) for _,x in ok),'/',len(ok))
if errs: print(errs)
