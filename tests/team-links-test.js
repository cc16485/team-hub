/* node tests/team-links-test.js
   2026-10-05 (her call): the Care Coordinator Hub's My Team tab is gone; the Admin page's Team section starts the team
   tools, each opening the Hub's own tool in a new tab. Checks the Admin page renders those buttons for each person
   (from staff_access_overview) and that the old wording pointing at My Team is gone. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '..', 'admin.html'), 'utf8');
const idx = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
let pass = 0, fail = 0; const ck = (n, c, d) => { if (c) { pass++; console.log('PASS  ' + n) } else { fail++; console.log('FAIL  ' + n + '  ' + JSON.stringify(d ?? '').slice(0, 400)) } };
const code = html.slice(html.indexOf('async function renderStaffAccess(){'), html.indexOf('/* ── staff ─'));
(async () => {
  const el = { innerHTML: '' };
  const ctx = { document: { getElementById: () => el }, esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    sb: { rpc: async () => ({ data: [{ full_name: 'Kat Smith', email: 'Kat@mo-care.com', has_account: true, account_confirmed: true, active: true, entities: ['cc_ihs'], hub_access: ['care_coordinator'], roles: [] },
                                       { full_name: '<b>x</b>', email: '', has_account: false, active: true, entities: [], hub_access: [], roles: [] }], error: null }) },
    Date, Math };
  vm.createContext(ctx); vm.runInContext(code + '\nthis.__r=renderStaffAccess;', ctx);
  await ctx.__r();
  ck('each person has Hub access and Open role, opening the Hub in a new tab', el.innerHTML.includes('href="https://cc.mo-care.com/#myteam/access/kat%40mo-care.com"') && el.innerHTML.includes('href="https://cc.mo-care.com/#myteam/role/kat%40mo-care.com"') && /target="_blank" rel="noopener"/.test(el.innerHTML), el.innerHTML.slice(0, 600));
  ck('someone with no email gets no buttons, and typed HTML stays text', !el.innerHTML.includes('#myteam/access/"') && el.innerHTML.includes('&lt;b&gt;x&lt;/b&gt;'));
  ck('the Team section: "＋ Add staff member" and "Open the whole team"', html.includes('href="https://cc.mo-care.com/#myteam/add"') && html.includes('＋ Add staff member') && html.includes('<section id="team">') && !/— read only/.test(html.slice(html.indexOf('<section id="team">'), html.indexOf('<section id="team">') + 400)));
  ck('the Team Hub tells people to use the Admin page, not My Team', !idx.includes('Care Coordinator Hub → My Team') && idx.includes('Owners Hub Admin page → Team'));
  ck('no em dashes in anything new', !/—/.test(html.slice(html.indexOf('<section id="team">'), html.indexOf('</section>', html.indexOf('<section id="team">')))));
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
