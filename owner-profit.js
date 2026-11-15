/* Owners Hub "Profit & Plan" tab and the Cockpit profit tiles (2026-11-15, Samantha: "Yes, build it").
   The numbers are never in this file or this repo. At each monthly close Claude reads QuickBooks on
   Samantha's Mac and saves them, with the Money snapshot, to the Training server's owner-money function
   (private table, owners only). This page only reads that snapshot (snap.profit) with the owner's Hub sign-in.
   Owner settings it uses (owner_settings, owners only): goal_price, mult_low, mult_high, replace_pay.
   Anything that cannot be read says so instead of showing $0. */
(function(root){
  'use strict';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{ const n=Number(v); return v==null||v===''||!isFinite(n)?null:n; };
  const usd=v=>{ const n=num(v); if(n===null) return ''; const s=Math.round(Math.abs(n)).toLocaleString('en-US'); return (n<0?'-$':'$')+s; };
  const pct=(a,b)=>b?Math.round(a/b*1000)/10:null;
  const MONTHS=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const mName=m=>{ const [y,mm]=String(m).split('-'); return MONTHS[(+mm||1)-1]+' '+y; };
  const mShort=m=>{ const [y,mm]=String(m).split('-'); return MONTHS[(+mm||1)-1].slice(0,3)+' '+y; };
  const RED='var(--red)', GREEN='var(--green)';

  /* ---- math from the lines (every number on the page comes from these) ---- */
  function kinds(p){ const k={}; (p.lines||[]).forEach(l=>k[l.key]=l.kind); return k; }
  function sumV(list){ const t={}; list.forEach(x=>Object.entries(x||{}).forEach(([k,v])=>t[k]=(t[k]||0)+(num(v)||0))); return t; }
  function calc(p, v){
    v=v||{}; const K=kinds(p);
    let income=0,pay=0,cost=0,interest=0;
    Object.entries(v).forEach(([k,a])=>{ a=num(a)||0; const kind=K[k]||'cost';
      if(kind==='income') income+=a; else if(kind==='pay') pay+=a; else if(kind==='interest') interest+=a; else cost+=a; });
    const op=income-pay-cost-interest;
    return { income, pay, cost, interest, gross:income-pay, op, ebitda:op+interest,
             payPct:pct(pay,income), grossPct:pct(income-pay,income), opPct:pct(op,income) };
  }
  function lastTwelve(p){ return (p.months||[]).slice().sort((a,b)=>a.m<b.m?-1:1).slice(-12); }
  function t12(p){ const L=lastTwelve(p); return { list:L, v:sumV(L.map(x=>x.v)), o:sumV(L.map(x=>x.o)) }; }

  /* ---- Cockpit: three tiles ---- */
  function cockpitHtml(snap){
    const p=snap&&snap.profit, cash=snap&&snap.cash;
    if(!p||!(p.months||[]).length)
      return '<div class="card"><b style="font-size:.95rem;color:var(--navy)">Profit and cash</b><div class="muted" style="margin-top:.4rem">No profit numbers saved yet. Claude adds them from QuickBooks at each monthly close.</div></div>';
    const L=lastTwelve(p), last=L[L.length-1], c=calc(p,last.v);
    const yr=String(last.m).slice(0,4);
    const all=(p.months||[]).filter(x=>String(x.m).startsWith(yr)); const cy=calc(p,sumV(all.map(x=>x.v)));
    const b=p.budget&&String(p.budget.year)===yr?p.budget:null;
    let vsBudget='<div class="muted">no budget set for '+esc(yr)+'</div>';
    if(b){ const months=all.map(x=>x.m), bm=(b.months||[]).filter(x=>months.includes(x.m)); const cb=calc(p,sumV(bm.map(x=>x.v))); const d=cy.op-cb.op;
      vsBudget='<div style="color:'+(d>=0?GREEN:RED)+';font-weight:700">'+(d>=0?usd(d)+' ahead of':usd(-d)+' behind')+' budget</div>'; }
    const tile=(lab,big,color,sub)=>'<div style="flex:1;min-width:180px"><div class="muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;font-weight:800">'+lab+'</div>'
      +'<div style="font-size:1.4rem;font-weight:800;color:'+(color||'var(--navy)')+'">'+big+'</div>'+sub+'</div>';
    const cashTile=cash&&num(cash.total)!==null
      ? tile('Cash today', usd(cash.total), null, '<div class="muted">'+esc(({ok:'Payroll covered',watch:'Tight this week',short:'Short this week'})[cash.status]||'')+' · Money tab</div>')
      : tile('Cash today','<span class="muted" style="font-size:1rem">not read yet</span>',null,'<div class="muted">see the Money tab</div>');
    return '<div class="card"><div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:baseline;justify-content:space-between"><b style="font-size:.95rem;color:var(--navy)">Profit and cash</b>'
      +'<button class="linklike" onclick="go(\'money\',document.querySelector(\'nav.tabs button[data-t=money]\'))">Profit &amp; Plan</button></div>'
      +'<div style="display:flex;gap:.8rem;flex-wrap:wrap;margin-top:.5rem">'
      +tile('Profit, '+mName(last.m), usd(c.op), c.op<0?RED:null, '<div class="muted">'+(c.opPct!==null?c.opPct+'% of '+usd(c.income)+' income':'')+'</div>')
      +tile('Profit, '+esc(yr)+' so far', usd(cy.op), cy.op<0?RED:null, vsBudget)
      +cashTile+'</div>'
      +'<div class="muted" style="margin-top:.45rem">Operating profit from QuickBooks, before owner pay, closed through '+esc(mName(p.closed_through||last.m))+'.'+(p.reconciled_through&&p.reconciled_through<last.m?' Not reconciled after '+esc(mName(p.reconciled_through))+' yet, so it may still move.':'')+'</div></div>';
  }

  /* ---- Profit & Plan tab ---- */
  function headline(p){
    const T=t12(p), c=calc(p,T.v), n=T.list.length;
    const tile=(lab,big,sub,color)=>'<div style="flex:1;min-width:170px"><div class="muted" style="font-size:.7rem;text-transform:uppercase;letter-spacing:.05em;font-weight:800">'+lab+'</div><div style="font-size:1.45rem;font-weight:800;color:'+(color||'var(--navy)')+'">'+big+'</div><div class="muted">'+sub+'</div></div>';
    return '<div class="card"><b style="font-size:1rem;color:var(--navy)">The last '+n+' months: '+esc(mShort(T.list[0].m))+' to '+esc(mShort(T.list[n-1].m))+'</b>'
      +'<div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:.6rem">'
      +tile('Client income',usd(c.income),'received in these 12 months')
      +tile('Pay',c.payPct+'%','of income goes to pay; healthy agencies keep it at 55 to 65%',c.payPct>70?RED:null)
      +tile('Operating profit',usd(c.op),c.opPct+'% of income',c.op<0?RED:null)
      +tile('Owner earnings',usd(c.ebitda),'profit before interest and before any owner pay')+'</div>'
      +(p.by_business?'<div class="muted" style="margin-top:.6rem">'+esc(p.by_business)+'</div>':'')+'</div>';
  }
  function monthTable(p){
    const K=kinds(p), rows=[];
    const r=(label,c,cls,recon)=>'<tr style="border-top:1px solid var(--border)'+(cls?';'+cls:'')+'"><td style="padding:.35rem .4rem;white-space:nowrap"><b>'+label+'</b>'+(recon===false?' <span class="chip" style="background:var(--amber-bg);color:var(--amber)">not reconciled</span>':'')+'</td>'
      +'<td style="text-align:right">'+usd(c.income)+'</td><td style="text-align:right">'+usd(c.pay)+'</td><td style="text-align:right;color:'+(c.payPct>70?RED:'inherit')+'">'+(c.payPct!==null?c.payPct+'%':'')+'</td>'
      +'<td style="text-align:right">'+usd(c.cost+c.interest)+'</td><td style="text-align:right;font-weight:700;color:'+(c.op<0?RED:GREEN)+'">'+usd(c.op)+'</td><td style="text-align:right" class="muted">'+(c.opPct!==null?c.opPct+'%':'')+'</td></tr>';
    lastTwelve(p).slice().reverse().forEach(x=>rows.push(r(esc(mShort(x.m)),calc(p,x.v),'',x.reconciled)));
    const yrs=(p.years||[]).slice().sort((a,b)=>b.y-a.y);
    const yearRows=yrs.map(y=>r('All of '+esc(y.y),calc(p,y.v),'background:var(--bg)',y.reconciled)).join('');
    return '<div class="card"><b style="font-size:.95rem;color:var(--navy)">Month by month</b>'
      +'<div style="overflow-x:auto;margin-top:.5rem"><table style="width:100%;border-collapse:collapse;font-size:.82rem;min-width:600px"><thead><tr style="text-align:right;color:var(--muted)"><th style="text-align:left;padding:.3rem .4rem">Month</th><th>Income</th><th>Pay</th><th>Pay %</th><th>Other costs</th><th>Operating profit</th><th></th></tr></thead><tbody>'
      +rows.join('')+yearRows+'</tbody></table></div>'
      +'<div class="muted" style="margin-top:.4rem">Cash basis: income is money received, costs are money paid. Owner pay, personal spending and loan payments are not costs and are left out. '+esc(p.status||'')+'</div></div>';
  }
  function budgetCard(p){
    const b=p.budget; if(!b||!(b.months||[]).length) return '<div class="card"><b style="font-size:.95rem;color:var(--navy)">Budget</b><div class="muted" style="margin-top:.4rem">No budget saved yet. Tell Claude your targets and it is added here.</div></div>';
    const yr=String(b.year), actual=(p.months||[]).filter(x=>String(x.m).startsWith(yr)), done=actual.map(x=>x.m);
    const bAll=sumV(b.months.map(x=>x.v)), bYtd=sumV(b.months.filter(x=>done.includes(x.m)).map(x=>x.v)), aYtd=sumV(actual.map(x=>x.v));
    const K=kinds(p); const sign=k=>K[k]==='income'?1:-1;
    const lineRow=l=>{ const bud=num(bAll[l.key])||0, by=num(bYtd[l.key])||0, ay=num(aYtd[l.key])||0;
      if(!bud&&!ay) return '';
      const diff=(ay-by)*sign(l.key), off=done.length&&by&&Math.abs(ay-by)/by>0.10&&diff<0;
      return '<tr style="border-top:1px solid var(--border)"><td style="padding:.3rem .4rem">'+esc(l.label)+'</td><td style="text-align:right">'+usd(bud)+'</td>'
        +(done.length?'<td style="text-align:right">'+usd(by)+'</td><td style="text-align:right">'+usd(ay)+'</td><td style="text-align:right;font-weight:700;color:'+(off?RED:(diff>=0?GREEN:'inherit'))+'">'+usd(diff)+'</td>':'')+'</tr>'; };
    const cb=calc(p,bAll), cby=calc(p,bYtd), cay=calc(p,aYtd), d=cay.op-cby.op;
    const tot='<tr style="border-top:2px solid var(--navy);font-weight:800"><td style="padding:.35rem .4rem">Operating profit</td><td style="text-align:right">'+usd(cb.op)+'</td>'
      +(done.length?'<td style="text-align:right">'+usd(cby.op)+'</td><td style="text-align:right">'+usd(cay.op)+'</td><td style="text-align:right;color:'+(d>=0?GREEN:RED)+'">'+usd(d)+'</td>':'')+'</tr>';
    const bo=sumV(b.months.map(x=>x.o)), outSum=Object.values(bo).reduce((t,v)=>t+(num(v)||0),0);
    const outside=(p.outside||[]).map(o=>{ const v=bo[o.key]; return v?'<div class="muted">Plus '+esc(o.label.toLowerCase())+': '+usd(v)+' (kept out of operating profit)</div>':''; }).join('');
    /* Below the line: what the year's profit has to cover (2026-11-15, her owner pay target). Not costs; draws and loan principal. */
    const af=b.after||{}, op=num(af.owner_pay), lp=num(af.loan_pay);
    const left=cb.op+outSum-(op||0)-(lp||0);
    const after=(op!==null||lp!==null)?'<table style="width:100%;max-width:560px;border-collapse:collapse;font-size:.84rem;margin-top:.6rem">'
      +'<tr><td style="padding:.25rem 0">Operating profit for the year'+(outSum?', plus items kept out':'')+'</td><td style="text-align:right">'+usd(cb.op+outSum)+'</td></tr>'
      +(op!==null?'<tr><td style="padding:.25rem 0">Less owner pay (you and Zach)</td><td style="text-align:right">'+usd(-op)+'</td></tr>':'')
      +(lp!==null?'<tr><td style="padding:.25rem 0">Less loan payments</td><td style="text-align:right">'+usd(-lp)+'</td></tr>':'')
      +'<tr style="border-top:2px solid var(--navy);font-weight:800"><td style="padding:.3rem 0">Left for taxes and savings</td><td style="text-align:right;color:'+(left<0?RED:GREEN)+'">'+usd(left)+'</td></tr></table>':'';
    const lastB=b.months[b.months.length-1]||{};
    const targets=(num(lastB.hours)!==null||num(lastB.cds_consumers)!==null)?'<div style="margin:.2rem 0 .5rem;font-size:.86rem">By '+esc(mName(lastB.m))+': <b>'+(num(lastB.hours)!==null?Math.round(lastB.hours).toLocaleString('en-US')+' billed hours a week':'')+'</b>'+(num(lastB.cds_consumers)!==null?' and <b>'+Math.round(lastB.cds_consumers)+' CDS consumers</b>':'')+'.</div>':'';
    return '<div class="card"><div style="display:flex;gap:.6rem;align-items:center;flex-wrap:wrap"><b style="font-size:.95rem;color:var(--navy)">'+esc(yr)+' budget</b>'
      +(b.status==='draft'?'<span class="chip" style="background:var(--amber-bg);color:var(--amber)">draft, waiting on your targets</span>':'')+'</div>'
      +targets+(b.note?'<div class="muted" style="margin:.3rem 0 .4rem">'+esc(b.note)+'</div>':'')
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem;min-width:'+(done.length?560:340)+'px"><thead><tr style="text-align:right;color:var(--muted)"><th style="text-align:left;padding:.3rem .4rem">Line</th><th>Budget, full year</th>'
      +(done.length?'<th>Budget so far</th><th>Actual so far</th><th>Better or worse</th>':'')+'</tr></thead><tbody>'
      +(p.lines||[]).map(lineRow).join('')+tot+'</tbody></table></div>'+outside+after
      +'<div class="muted" style="margin-top:.4rem">'+(done.length?'Through '+esc(mName(done[done.length-1]))+'. Red means a line is more than 10% worse than budget so far.':'Actuals start showing here once '+esc(mName(yr+'-01'))+' is closed.')+' To change the budget, ask Claude; every change is dated.</div></div>';
  }
  function outsideCard(p){
    const T=t12(p), yrs=(p.years||[]).slice().sort((a,b)=>a.y-b.y);
    const items=(p.outside||[]).map(o=>{ const cells=yrs.map(y=>num(y.o&&y.o[o.key])).concat([num(T.o[o.key])]);
      if(!cells.some(Boolean)) return '';
      return '<tr style="border-top:1px solid var(--border)"><td style="padding:.35rem .4rem"><b>'+esc(o.label)+'</b><div class="muted">'+esc(o.why)+'</div></td>'+cells.map(v=>'<td style="text-align:right;vertical-align:top;padding-top:.35rem">'+(v?usd(v):'')+'</td>').join('')+'</tr>'; }).join('');
    if(!items) return '';
    return '<div class="card"><b style="font-size:.95rem;color:var(--navy)">Kept out of operating profit</b><div class="muted" style="margin:.25rem 0 .4rem">Real money, but not from care. A buyer leaves these out, so the Hub does too.</div>'
      +'<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;font-size:.82rem;min-width:520px"><thead><tr style="text-align:right;color:var(--muted)"><th style="text-align:left;padding:.3rem .4rem">Item</th>'+yrs.map(y=>'<th>'+esc(y.y)+'</th>').join('')+'<th>Last 12 months</th></tr></thead><tbody>'+items+'</tbody></table></div></div>';
  }
  function valueCard(p, oset){
    oset=oset||{}; const T=t12(p), c=calc(p,T.v), n=T.list.length;
    const rp=num(oset.replace_pay), base=c.ebitda-(rp||0), lo=base*(+oset.mult_low||3), hi=base*(+oset.mult_high||5), goal=num(oset.goal_price)||0;
    const mid=(lo+hi)/2, pc=goal?Math.max(0,Math.min(100,Math.round(mid/goal*100))):0;
    const needed=goal?goal/(((+oset.mult_low||3)+(+oset.mult_high||5))/2)+(rp||0):0;
    return '<div class="card" style="border-color:#F0A63A;background:#FFFDF5">'
      +'<div style="display:flex;align-items:center;gap:.7rem;flex-wrap:wrap"><b style="font-size:1rem;color:var(--navy)">What the business could sell for</b><span style="flex:1"></span>'
      +'<span class="muted">sale goal '+(goal?usd(goal):'not set')+' · <button class="linklike" onclick="editGoal()">'+(goal?'change':'set it')+'</button></span></div>'
      +'<table style="width:100%;max-width:560px;border-collapse:collapse;font-size:.86rem;margin-top:.6rem">'
      +'<tr><td style="padding:.25rem 0">Owner earnings, last '+n+' months</td><td style="text-align:right">'+usd(c.ebitda)+'</td></tr>'
      +'<tr><td style="padding:.25rem 0">Less pay for a manager to do the owners\' work <button class="linklike" onclick="editReplacePay()">'+(rp===null?'set it':'change')+'</button></td><td style="text-align:right">'+(rp===null?'<span class="muted">not set</span>':usd(-rp))+'</td></tr>'
      +'<tr style="border-top:2px solid var(--navy);font-weight:800"><td style="padding:.3rem 0">What a buyer would earn</td><td style="text-align:right;color:'+(base<0?RED:'var(--navy)')+'">'+usd(base)+'</td></tr>'
      +'<tr><td style="padding:.25rem 0">Times '+esc(oset.mult_low||3)+' to '+esc(oset.mult_high||5)+' <button class="linklike" onclick="editMults()">change</button></td><td style="text-align:right;font-weight:800;color:var(--navy)">'+(base>0?usd(lo)+' to '+usd(hi):'<span style="color:'+RED+'">no value on today\'s profit</span>')+'</td></tr></table>'
      +(goal&&base>0?'<div style="height:10px;background:#faf9f6;border-radius:99px;overflow:hidden;margin:.6rem 0;max-width:560px"><div style="height:100%;width:'+pc+'%;background:linear-gradient(90deg,var(--gold),var(--green))"></div></div><div style="font-size:.84rem">'+pc+'% of the way. The goal needs owner earnings of about <b>'+usd(needed)+' a year</b>.</div>':'')
      +'<div class="muted" style="margin-top:.5rem">Worked from the last 12 months, never one good month. Owners are paid by draw, so these books show profit before any owner pay; a buyer subtracts what a manager would cost. A broker who sells home care agencies sets the real multiple.'+(rp===null?' Until the manager pay is set, the value above is too high.':'')+'</div></div>';
  }
  function checksHtml(p){
    const ST={ok:['var(--green-bg)','var(--green)','Done'],warn:['var(--amber-bg)','var(--amber)','Check'],no:['var(--red-bg)','var(--red)','Not yet']};
    return (p.checks||[]).map(c=>{ const s=ST[c.state]||ST.warn;
      return '<div class="checkrow" style="align-items:flex-start"><span class="chip" style="background:'+s[0]+';color:'+s[1]+';min-width:62px;text-align:center">'+s[2]+'</span><div><b>'+esc(c.label)+'</b><div class="muted">'+esc(c.text)+'</div></div></div>'; }).join('');
  }
  function render(box, snap, oset, now){
    if(!box) return;
    const p=snap&&snap.profit;
    if(!p||!(p.months||[]).length){
      box.innerHTML='<div class="card"><b>No profit numbers yet.</b><div class="muted" style="margin-top:.3rem">Claude saves them from QuickBooks at each monthly close, with the Money numbers.</div></div>'; return; }
    box.innerHTML='<div class="muted" style="margin-bottom:.7rem">From QuickBooks, closed through '+esc(mName(p.closed_through))+'. Read '+esc(p.as_of||'')+'.</div>'
      +headline(p)+monthTable(p)+budgetCard(p)+valueCard(p,oset)+outsideCard(p);
  }
  root.OwnerProfit={ render, cockpitHtml, checksHtml, calc, t12, usd };
  if(typeof module!=='undefined') module.exports=root.OwnerProfit;
})(typeof window!=='undefined'?window:globalThis);
