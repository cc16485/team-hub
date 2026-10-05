"""Stand-Up and Team Meetings moved to the CC Hub (Today), 2026-10-05. The Team Hub page shows where they went (and
keeps the video room button), draws nothing from the old board, and the no-sign-in quick-add page only points to the
Hub: it no longer talks to the database. Offline (python3 tests/standup-moved-look.py)."""
import re, pathlib
from playwright.sync_api import sync_playwright
D = pathlib.Path(__file__).resolve().parent.parent
HUB, QA = (D / 'index.html').read_text(), (D / 'quick-add.html').read_text()
R = []
def ok(n, c, d=''): R.append(['PASS' if c else 'FAIL', n, '' if c else d])

ok('quick-add page has no database code at all', not re.search(r'supabase|\.rpc\(|submit_standup_note_public|ANON', QA, re.I))
ok('quick-add page points to the Hub Stand-Up tab', 'https://cc.mo-care.com/#standup' in QA)
ok('the Team Hub no longer offers the quick-add link', 'Copy Quick-Add Link' not in HUB)
ok('renderAll no longer draws the old board or meetings', re.search(r'function renderAll\(\)\{ renderDirectory\(\); renderAccessPanel\(\); \}', HUB) is not None)

with sync_playwright() as pw:
    b = pw.chromium.launch()
    for name in ('index.html', 'quick-add.html'):
        pg = b.new_page(viewport={'width': 1200, 'height': 900})
        reqs = []
        pg.route('**/*', lambda r: (reqs.append(r.request.url), r.abort() if 'supabase.co' in r.request.url else r.continue_()))
        errs = []; pg.on('pageerror', lambda e: errs.append(str(e)[:200]))
        pg.goto((D / name).as_uri()); pg.wait_for_timeout(900)
        if name == 'index.html':
            res = pg.evaluate("""()=>{ let err=null; try{ renderAll(); }catch(e){ err=String(e); }
              const card=document.getElementById('standupMovedSection');
              return { err, card: !!card, links:[...(card?card.querySelectorAll('a'):[])].map(a=>a.getAttribute('href')),
                video: !!(card && [...card.querySelectorAll('button')].some(x=>/startVideoMeeting/.test(x.getAttribute('onclick')))),
                old: ['standupListWrap','meetingsListWrap','standupSection','meetingsSection'].filter(id=>document.getElementById(id)) }; }""")
            ok('Team Hub: renderAll runs without the old sections', res['err'] is None, res['err'])
            ok('Team Hub: the moved card links to Stand-Up and Team Meetings', res['links'] == ['https://cc.mo-care.com/#standup', 'https://cc.mo-care.com/#teammeetings'], res['links'])
            ok('Team Hub: the video room button stays', res['video'])
            ok('Team Hub: the old board and meetings sections are gone', res['old'] == [], res['old'])
        else:
            ok('quick-add: makes no requests to anything', [u for u in reqs if not u.startswith('file:')] == [], reqs)
            ok('quick-add: the button opens the Hub Stand-Up tab', pg.get_attribute('a.btn', 'href') == 'https://cc.mo-care.com/#standup')
        ok(name + ': no page errors', not errs, errs[:3])
        pg.close()
    b.close()
for s_, n, d in R: print(s_, '·', n, '' if s_ == 'PASS' else d)
print(sum(r[0] == 'PASS' for r in R), '/', len(R))
