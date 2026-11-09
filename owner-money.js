/* Owners Hub Money tab (2026-11-09, Samantha: "Yes, build it").
   Four cards: cash alert, weekly book questions, debts, tax set-aside.
   The numbers are never in this file or this repo. Each morning a Claude task on
   Samantha's Mac reads QuickBooks and saves one snapshot to the Training server's
   owner-money function (private table, owners only). This page only reads that
   snapshot with the owner's own Hub sign-in, and saves her answers to book questions.
   Answering a question in the Hub is her OK for Claude to post it at the next Monday run. */
(function(root){
  'use strict';
  const FN='https://rdqujxiycycwhskyvrwa.supabase.co/functions/v1/owner-money';
  const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num=v=>{ const n=Number(v); return isFinite(n)?n:null; };
  function usd(v,cents){
    const n=num(v); if(n===null) return '';
    const s=Math.abs(n).toLocaleString('en-US',{minimumFractionDigits:cents?2:0,maximumFractionDigits:cents?2:0});
    return (n<0?'-$':'$')+s;
  }
  function day(iso){
    if(!iso) return '';
    const d=new Date(String(iso).length===10?iso+'T12:00:00':iso);
    return isNaN(d)?esc(iso):d.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  }
  function ageText(iso, now){
    if(!iso) return 'never';
    const h=((now||Date.now())-new Date(iso).getTime())/36e5;
    if(!isFinite(h)) return 'unknown';
    if(h<1) return 'less than an hour ago';
    if(h<36) return Math.round(h)+' hours ago';
    return Math.round(h/24)+' days ago';
  }
  /* A snapshot older than about a day and a half means the morning run did not happen. */
  function isStale(iso, now){ return !iso || ((now||Date.now())-new Date(iso).getTime())>36*36e5; }

  const STATUS={
    ok:{ bg:'var(--green-bg)', fg:'var(--green)', word:'Covered' },
    watch:{ bg:'var(--amber-bg)', fg:'var(--amber)', word:'Tight' },
    short:{ bg:'var(--red-bg)', fg:'var(--red)', word:'Short' }
  };
  const est=flag=>flag?' <span class="chip" style="background:var(--amber-bg);color:var(--amber)">estimate</span>':'';

  function cashCard(c){
    c=c||{};
    const st=STATUS[c.status]||STATUS.watch;
    const accts=(c.accounts||[]).map(a=>'<tr style="border-top:1px solid var(--border)"><td style="padding:.35rem 0">'+esc(a.name)
      +(a.note?'<div class="muted">'+esc(a.note)+'</div>':'')+'</td><td style="text-align:right;font-weight:700">'+usd(a.balance,true)+'</td>'
      +'<td class="muted" style="text-align:right;padding-left:.8rem">'+esc(a.as_of?('as of '+a.as_of):'')+'</td></tr>').join('');
    const up=(c.upcoming||[]).map(u=>'<tr style="border-top:1px solid var(--border)"><td style="padding:.35rem 0;white-space:nowrap">'+day(u.date)+'</td>'
      +'<td>'+esc(u.what)+est(u.estimate)+(u.from?'<div class="muted">from '+esc(u.from)+'</div>':'')+'</td>'
      +'<td style="text-align:right;font-weight:700;color:'+(num(u.amount)<0?'var(--text)':'var(--green)')+'">'+usd(u.amount,true)+'</td></tr>').join('');
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap">'
      +'<b style="font-size:1rem;color:var(--navy)">Cash: will payroll clear?</b>'
      +'<span class="chip" style="background:'+st.bg+';color:'+st.fg+';font-size:.8rem">'+st.word+'</span></div>'
      +(c.message?'<div style="margin:.5rem 0;padding:.6rem .8rem;border-radius:8px;background:'+st.bg+';color:'+st.fg+';font-weight:700;font-size:.9rem">'+esc(c.message)+'</div>':'')
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-top:.5rem">'
      +'<div><div class="muted" style="font-weight:700;margin-bottom:.2rem">In the bank today</div><table style="width:100%;font-size:.86rem;border-collapse:collapse">'+(accts||'<tr><td class="muted">No balances yet.</td></tr>')
      +(num(c.total)!==null?'<tr style="border-top:2px solid var(--navy)"><td style="padding:.35rem 0;font-weight:800">Total</td><td style="text-align:right;font-weight:800">'+usd(c.total,true)+'</td><td></td></tr>':'')+'</table></div>'
      +'<div><div class="muted" style="font-weight:700;margin-bottom:.2rem">Going out in the next 7 days</div><table style="width:100%;font-size:.86rem;border-collapse:collapse">'+(up||'<tr><td class="muted">Nothing found.</td></tr>')+'</table>'
      +(num(c.low_point)!==null?'<div class="muted" style="margin-top:.4rem">Lowest point: <b>'+usd(c.low_point,true)+'</b>'+(c.low_date?' on '+day(c.low_date):'')+'</div>':'')+'</div></div>'
      +(c.note?'<div class="muted" style="margin-top:.6rem">'+esc(c.note)+'</div>':'')+'</div>';
  }

  function questionRow(q, saved){
    const id=esc(q.id);
    const chosen=saved&&saved.answer;
    const choices=(q.choices||[]).map(ch=>'<button class="btn '+(chosen===ch?'green':'ghost')+'" style="margin:.15rem .25rem .15rem 0;padding:.3rem .7rem" data-omq="'+id+'" data-oma="'+esc(ch)+'">'+esc(ch)+'</button>').join('');
    return '<div class="checkrow" style="display:block" id="omq-'+id+'">'
      +'<div style="display:flex;justify-content:space-between;gap:.8rem;flex-wrap:wrap"><div><b>'+usd(q.amount,true)+'</b> · '+esc(q.desc)
      +'<div class="muted">'+day(q.date)+(q.account?' · '+esc(q.account):'')+'</div></div>'
      +(chosen?'<span class="chip" style="background:var(--green-bg);color:var(--green);align-self:flex-start">Answered, posts Monday</span>':'')+'</div>'
      +'<div style="margin:.3rem 0 .15rem;font-size:.86rem">'+esc(q.ask||'Business or personal, and what for?')+'</div>'
      +'<div>'+choices+'</div>'
      +'<div style="display:flex;gap:.4rem;margin-top:.3rem;flex-wrap:wrap"><input type="text" maxlength="500" style="flex:1;min-width:200px" placeholder="Or type your answer" value="'+esc(chosen&&!(q.choices||[]).includes(chosen)?chosen:'')+'" data-omt="'+id+'">'
      +'<button class="btn" style="padding:.3rem .8rem" data-oms="'+id+'">Save</button>'
      +(chosen?'<button class="linklike" data-omc="'+id+'">clear</button>':'')+'</div></div>';
  }
  function booksCard(b, answers){
    b=b||{}; answers=answers||{};
    const qs=b.questions||[];
    const open=qs.filter(q=>!answers[q.id]).length;
    return '<div class="card"><div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem;flex-wrap:wrap">'
      +'<b style="font-size:1rem;color:var(--navy)">Weekly books catch-up</b>'
      +'<span class="chip" style="background:'+(open?'var(--amber-bg);color:var(--amber)':'var(--green-bg);color:var(--green)')+'">'+(open?open+' waiting on you':'Nothing waiting')+'</span></div>'
      +'<div class="muted" style="margin:.3rem 0 .5rem">Every Monday Claude sorts the week\'s new bank and card charges with the answers you have already given. Only new ones land here. '
      +'<b>Answering one is your OK to post it</b> at the next Monday run. Nothing posts that you have not answered.</div>'
      +(b.last_run?'<div class="muted" style="margin-bottom:.4rem">Last run '+day(b.last_run)+(num(b.posted)!==null?': '+esc(b.posted)+' posted from your earlier answers and rules':'')+(num(b.left)?', '+esc(b.left)+' still in the old pile':'')+'.</div>':'')
      +(qs.length?qs.map(q=>questionRow(q,answers[q.id])).join(''):'<div class="muted">No questions this week.</div>')
      +(b.note?'<div class="muted" style="margin-top:.6rem">'+esc(b.note)+'</div>':'')+'</div>';
  }

  function debtsCard(d){
    d=d||{};
    const items=d.items||[];
    const tot=items.reduce((s,x)=>s+(num(x.balance)||0),0);
    const rows=items.map((x,i)=>'<tr style="border-top:1px solid var(--border);'+(x.pay_first?'background:var(--green-bg)':'')+'"><td style="padding:.4rem .3rem">'+esc(x.name)+est(x.estimate)
      +(x.pay_first?' <span class="chip" style="background:var(--green);color:#fff">pay this first</span>':'')+(x.note?'<div class="muted">'+esc(x.note)+'</div>':'')+'</td>'
      +'<td style="text-align:right">'+usd(x.balance)+'</td><td style="text-align:right">'+(num(x.rate)!==null?esc(x.rate)+'%':'')+'</td>'
      +'<td style="text-align:right">'+usd(x.payment)+(x.every?'<div class="muted">'+esc(x.every)+'</div>':'')+'</td><td style="text-align:right">'+usd(x.interest_ytd)+'</td></tr>').join('');
    return '<div class="card"><b style="font-size:1rem;color:var(--navy)">Debts</b>'
      +'<div style="overflow-x:auto;margin-top:.4rem"><table style="width:100%;font-size:.86rem;border-collapse:collapse;min-width:560px"><thead><tr class="muted" style="text-align:right"><th style="text-align:left;padding:.3rem">Loan or card</th><th>Balance</th><th>Rate</th><th>Payment</th><th>Interest this year</th></tr></thead><tbody>'
      +(rows||'<tr><td class="muted" colspan="5">No debts listed yet.</td></tr>')
      +(items.length?'<tr style="border-top:2px solid var(--navy);font-weight:800"><td style="padding:.4rem .3rem">Total</td><td style="text-align:right">'+usd(tot)+'</td><td colspan="2"></td><td style="text-align:right">'+usd(items.reduce((s,x)=>s+(num(x.interest_ytd)||0),0))+'</td></tr>':'')
      +'</tbody></table></div>'
      +(d.pay_first?'<div style="margin-top:.6rem;font-size:.88rem"><b>Why that one first:</b> '+esc(d.pay_first)+'</div>':'')
      +(d.note?'<div class="muted" style="margin-top:.4rem">'+esc(d.note)+'</div>':'')+'</div>';
  }

  function taxesCard(t){
    t=t||{};
    const yrs=(t.years||[]).map(y=>'<tr style="border-top:1px solid var(--border)"><td style="padding:.35rem 0;font-weight:700">'+esc(y.year)+'</td><td>'+esc(y.status)+'</td><td style="color:'+(/past due/i.test(y.due||'')?'var(--red)':'var(--muted)')+';font-weight:700;text-align:right">'+esc(y.due||'')+'</td></tr>').join('');
    const open=(t.open_items||[]).map(x=>'<li style="margin:.2rem 0 .2rem 1.1rem">'+esc(x)+'</li>').join('');
    return '<div class="card"><b style="font-size:1rem;color:var(--navy)">Tax set-aside</b>'
      +'<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:1rem;margin-top:.5rem">'
      +'<div><div class="muted" style="font-weight:700">Set aside this month</div><div style="font-size:1.6rem;font-weight:800;color:var(--navy)">'+(num(t.set_aside_month)!==null?usd(t.set_aside_month):'Not worked out yet')+est(t.estimate)+'</div>'
      +(t.basis?'<div class="muted" style="margin-top:.2rem">'+esc(t.basis)+'</div>':'')
      +(num(t.saved)!==null?'<div style="margin-top:.4rem;font-size:.86rem">In the tax savings account now: <b>'+usd(t.saved,true)+'</b></div>':'')+'</div>'
      +'<div><div class="muted" style="font-weight:700;margin-bottom:.2rem">Returns</div><table style="width:100%;font-size:.86rem;border-collapse:collapse">'+(yrs||'<tr><td class="muted">None listed.</td></tr>')+'</table></div></div>'
      +(open?'<div style="margin-top:.6rem"><div class="muted" style="font-weight:700">For your tax preparer</div><ul style="font-size:.86rem">'+open+'</ul></div>':'')
      +(t.note?'<div class="muted" style="margin-top:.4rem">'+esc(t.note)+'</div>':'')+'</div>';
  }

  function render(box, snap, answers, now){
    snap=snap||{};
    if(!snap.saved_at){
      box.innerHTML='<div class="card"><b>No numbers yet.</b><div class="muted" style="margin-top:.3rem">The first morning run has not saved anything. Claude fills this in from QuickBooks every weekday morning.</div></div>';
      return;
    }
    const stale=isStale(snap.saved_at, now);
    box.innerHTML='<div class="muted" style="margin-bottom:.7rem'+(stale?';color:var(--red);font-weight:700':'')+'">'
      +(stale?'These numbers are old: the morning run last saved '+ageText(snap.saved_at,now)+'. Ask Claude to check the Money task. ':'From QuickBooks, saved '+ageText(snap.saved_at,now)+'. ')
      +(snap.source_note?esc(snap.source_note):'')+'</div>'
      +cashCard(snap.cash)+booksCard(snap.books, answers)+debtsCard(snap.debts)+taxesCard(snap.taxes);
  }

  async function call(sb, anon, body){
    const { data:{ session } }=await sb.auth.getSession();
    const r=await fetch(FN,{ method:'POST', headers:{ 'x-hub-token':(session&&session.access_token)||'', 'apikey':anon, 'Authorization':'Bearer '+anon, 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    let d={}; try{ d=await r.json(); }catch(e){}
    if(!r.ok||d.error) throw new Error(d.error||('HTTP '+r.status));
    return d;
  }

  const state={ snap:null, answers:{} };
  async function load(sb, anon, box){
    if(!box) return;
    box.innerHTML='<div class="card"><div class="muted">Loading the Money numbers…</div></div>';
    try{
      const d=await call(sb, anon, { mode:'read' });
      state.snap=d.snapshot||{}; state.answers=d.answers||{};
      render(box, state.snap, state.answers);
    }catch(e){
      box.innerHTML='<div class="card"><div style="color:var(--red);font-weight:700">Could not load the Money numbers: '+esc(e.message||e)+'</div><div class="muted" style="margin-top:.3rem">Nothing was changed. <button class="linklike" data-omr="1">try again</button></div></div>';
    }
  }
  async function answer(sb, anon, box, qid, text){
    try{
      await call(sb, anon, { mode:'answer', qid, answer:text });
      if(text) state.answers[qid]={ answer:text, at:new Date().toISOString() }; else delete state.answers[qid];
      render(box, state.snap, state.answers);
    }catch(e){ alert('Not saved: '+(e.message||e)+'\n\nYour answer is still in the box. Try again.'); }
  }
  function wire(sb, anon, box){
    if(!box||box.dataset.omWired) return; box.dataset.omWired='1';
    box.addEventListener('click', ev=>{
      const t=ev.target.closest('button'); if(!t) return;
      if(t.dataset.omr){ load(sb, anon, box); return; }
      if(t.dataset.omq){ answer(sb, anon, box, t.dataset.omq, t.dataset.oma); return; }
      if(t.dataset.oms){ const inp=box.querySelector('input[data-omt="'+t.dataset.oms+'"]'); const v=(inp&&inp.value||'').trim(); if(!v){ alert('Type an answer first, or tap one of the choices.'); return; } answer(sb, anon, box, t.dataset.oms, v); return; }
      if(t.dataset.omc){ answer(sb, anon, box, t.dataset.omc, ''); return; }
    });
  }

  root.OwnerMoney={ load, wire, render, usd, isStale, ageText, _state:state };
  if(typeof module!=='undefined') module.exports=root.OwnerMoney;
})(typeof window!=='undefined'?window:globalThis);
