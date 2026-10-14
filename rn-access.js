/* rn-access.js · Owners Hub Admin page, Team: give the supervising RN a sign-in that opens ONLY the RN review page
   (cc.mo-care.com/rn.html). Loaded after the page's own script (it uses SUPA_URL, SUPA_ANON, sb and esc from there). */
/* ── RN review only access (2026-10-14, Desktop 706): the hub-access function, hub rn_review. The server decides everything
   (owners only, the slug alone, never an owner, never on top of another hub); this card shows its words. ── */
const HUB_ACCESS_FN=SUPA_URL+'/functions/v1/hub-access';
const RNA_STATE={ active:'Can sign in to the RN review page only', invited:'Invitation sent (it opens the RN review page); not accepted yet', revoked:'No RN review access', none:'No account yet' };
async function rnaCall(action, email){
  const { data:{ session } } = await sb.auth.getSession();
  if(!session) return { error:'Your session has expired. Sign in again.' };
  try{
    const r=await fetch(HUB_ACCESS_FN,{ method:'POST', headers:{ 'Content-Type':'application/json', 'apikey':SUPA_ANON, 'Authorization':'Bearer '+session.access_token },
      body:JSON.stringify({ action, target_email:String(email||'').trim().toLowerCase(), hub:'rn_review' }) });
    const j=await r.json().catch(()=>({}));
    return r.ok ? j : { error:j.error||('Request failed ('+r.status+')'), detail:j.detail };
  }catch(e){ return { error:'Could not reach the Hub access service.' }; }
}
async function rnaRun(what){
  const msg=document.getElementById('rnaMsg'), email=(document.getElementById('rnaEmail').value||'').trim().toLowerCase();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){ msg.innerHTML='<span style="color:var(--red)">Type the work email first.</span>'; return; }
  let action=what;
  if(what==='give' || what==='revoke'){
    const st=await rnaCall('status', email);
    if(st.error){ msg.innerHTML='<span style="color:var(--red)">'+esc(st.error)+'</span>'; return; }
    if(what==='give') action = st.state==='none' ? 'invite' : 'restore';
    const q = what==='give'
      ? 'Give '+email+' RN review only?\n\nTheir sign-in will open only the RN review page (cc.mo-care.com/rn.html) and see nothing else in the Hub.'+(st.state==='none'?' They get one invitation email and choose their own password.':'')
      : 'Remove RN review from '+email+'?\n\nThey can no longer sign in to the review page. Nothing they signed or reviewed changes.';
    if(!confirm(q)) return;
  }
  msg.textContent='Working…';
  const r=await rnaCall(action, email);
  if(r.error){ msg.innerHTML='<span style="color:var(--red)">'+esc(r.error)+'</span>'+(r.detail?'<div>'+esc(r.detail)+'</div>':''); return; }
  const access=Array.isArray(r.access)?(r.access.length?r.access.join(', '):'none'):'every hub (no list)';
  msg.innerHTML='<b>'+esc(RNA_STATE[r.state]||r.label||r.state)+'</b> · Hub access: '+esc(access)+(r.did?' · '+esc(r.did):'');
}
