/* node tests/admin-rn-access-test.js
   RN review only access (2026-10-14, Desktop 706): the Team card that gives the supervising RN a sign-in that opens only the
   RN review page. The real code, cut out of admin.html, runs against a fake hub-access function that answers the way the
   server does (Staffing hub_access_rn_test.mjs proves the server). */
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const js = fs.readFileSync(path.join(__dirname, '..', 'rn-access.js'), 'utf8');
const code = js.replace('const HUB_ACCESS_FN=', 'var HUB_ACCESS_FN=').replace('const RNA_STATE=', 'var RNA_STATE=');
let pass = 0, fail = 0;
const ck = (n, ok, x) => { ok ? pass++ : fail++; console.log((ok ? 'PASS  ' : 'FAIL  ') + n + (ok || x === undefined ? '' : '  ' + JSON.stringify(x).slice(0, 500))); };
function world(server, yes = true) {
  const calls = [], confirms = [], el = { rnaEmail: { value: '' }, rnaMsg: { innerHTML: '', textContent: '' } };
  const ctx = { console, JSON, String, Array, Object, Promise, esc: s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    SUPA_URL: 'https://zngsgedlsxinbygwmxwn.supabase.co', SUPA_ANON: 'anon', confirm: m => { confirms.push(m); return yes; },
    document: { getElementById: id => el[id] }, sb: { auth: { getSession: async () => ({ data: { session: { access_token: 'tok-sam' } } }) } },
    fetch: async (url, o) => { const body = JSON.parse(o.body); calls.push({ url, body, auth: o.headers.Authorization }); const [code, j] = server(body); return { ok: code < 300, status: code, json: async () => j }; } };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.__x={ rnaRun };', ctx);
  return { X: ctx.__x, calls, confirms, el };
}
(async () => {
  ck('the card is on the Team section with her words, rn-access.js loads once after the page script, and no em dash', (html.match(/<script src="rn-access\.js\?v=1"><\/script>/g) || []).length === 1 && html.indexOf('rn-access.js') > html.lastIndexOf('const SUPA_ANON=') && /id="rnAccessCard"/.test(html) && /RN review only \(Natasha's review page\)/.test(html) && /cannot be combined with any other hub/.test(html) && !/\u2014/.test(html.slice(html.indexOf('id="rnAccessCard"') - 400, html.indexOf('id="rnaMsg"')) + code));
  let W = world(() => [200, { state: 'none' }]); W.el.rnaEmail.value = 'not an email'; await W.X.rnaRun('give');
  ck('a bad email: said, nothing sent', W.calls.length === 0 && /Type the work email/.test(W.el.rnaMsg.innerHTML));
  W = world((b) => b.action === 'status' ? [200, { state: 'none', access: null }] : [200, { ok: true, did: 'invited', state: 'invited', access: ['rn_review'] }]);
  W.el.rnaEmail.value = ' Natasha@MO-care.com '; await W.X.rnaRun('give');
  ck('Give to someone with no account: asks first, then invites with hub rn_review only, as the signed-in owner', W.confirms.length === 1 && /RN review only/.test(W.confirms[0]) && /one invitation email/.test(W.confirms[0])
    && W.calls.map(c => c.body.action).join() === 'status,invite' && W.calls.every(c => c.body.hub === 'rn_review' && c.body.target_email === 'natasha@mo-care.com' && c.auth === 'Bearer tok-sam' && /\/functions\/v1\/hub-access$/.test(c.url))
    && /Invitation sent/.test(W.el.rnaMsg.innerHTML) && /rn_review/.test(W.el.rnaMsg.innerHTML), [W.calls, W.el.rnaMsg.innerHTML]);
  W = world((b) => b.action === 'status' ? [200, { state: 'active', access: ['care_coordinator'] }] : [409, { error: 'This account already has Care Coordinator Hub, so it cannot be RN review only.', detail: 'Remove that access first. An RN review only account sees nothing but the review page.' }]);
  W.el.rnaEmail.value = 'casey@mo-care.com'; await W.X.rnaRun('give');
  ck('Give to an account that already has another hub: the server refuses and its words are shown (restore, not invite)', W.calls.map(c => c.body.action).join() === 'status,restore' && /cannot be RN review only/.test(W.el.rnaMsg.innerHTML) && /Remove that access first/.test(W.el.rnaMsg.innerHTML), W.el.rnaMsg.innerHTML);
  W = world(() => [200, { state: 'active', access: ['rn_review'] }], false); W.el.rnaEmail.value = 'natasha@mo-care.com'; await W.X.rnaRun('revoke');
  ck('Remove asks first; saying no changes nothing', W.confirms.length === 1 && /Nothing they signed or reviewed changes/.test(W.confirms[0]) && W.calls.map(c => c.body.action).join() === 'status');
  W = world((b) => b.action === 'status' ? [200, { state: 'active', access: ['rn_review'] }] : [200, { ok: true, did: 'revoked', state: 'revoked', access: [] }]); W.el.rnaEmail.value = 'natasha@mo-care.com'; await W.X.rnaRun('revoke');
  ck('Remove: revoke rn_review, the result shown', W.calls.map(c => c.body.action).join() === 'status,revoke' && /No RN review access/.test(W.el.rnaMsg.innerHTML));
  W = world(() => [200, { state: 'active', access: ['rn_review'] }]); W.el.rnaEmail.value = 'natasha@mo-care.com'; await W.X.rnaRun('status');
  ck('Check: status only, nothing asked or changed', W.calls.length === 1 && W.confirms.length === 0 && /RN review page only/.test(W.el.rnaMsg.innerHTML));
  console.log(`\n${pass}/${pass + fail} passed`); process.exit(fail ? 1 : 0);
})();
