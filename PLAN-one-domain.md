# Plan: one domain, one sign-in

**Status:** not started. Written 2026-07-29.
**Do this only when there is time to test properly.** Everything currently works.

---

## The problem, precisely

Staff sign in repeatedly as they move between Leads, Recruiting and Training.

The cause is **not** that the hubs are separate files. It is that they are separate
**origins**: `cc.mo-care.com`, `sc.mo-care.com`, `hub.mo-care.com`. A browser gives every
origin its own storage, so a Supabase session on one is invisible to the others.

Same origin → one session → sign in once.

## What this is NOT

**Not merging the hubs into one file.** Those files are ~7,100 and ~7,300 lines. Combined
they would be a ~16,000 line page where one bad edit takes down leads, recruiting,
compliance and the owners' financials at the same time. Today a mistake in one hub cannot
touch the other. That containment gets more valuable as the agency grows.

Separate pages, one address.

## Target

```
hub.mo-care.com/                → team landing (already there)
hub.mo-care.com/leads.html      → what cc.mo-care.com serves now
hub.mo-care.com/recruiting.html → what sc.mo-care.com serves now
hub.mo-care.com/owners.html     → already there
hub.mo-care.com/admin.html      → already there
hub.mo-care.com/reports.html    → already there
```

Deep links keep working unchanged: `hub.mo-care.com/leads.html#ops`, `#phone`, `#grow`.

---

## ⚠ Hard constraint: do not break the public pages

Two pages are used by people outside the office and **must keep their current URLs**:

| Page | URL | Why it cannot move |
|---|---|---|
| Orientation booking | `sc.mo-care.com/orientation-booking.html` | The link is texted to candidates. Links already sent are sitting in people's phones, and they carry a long `?sessions=…&first=…` query string that any redirect would have to preserve exactly. |
| EVV correction form | `sc.mo-care.com/evv-correction-form` | Given out to caregivers. |

**Decision: leave both where they are, permanently.** They sign in as `anon` and never need
the shared session, so they gain nothing from moving and risk a lot. Only the internal hubs
move.

## Checked already

- **No localStorage collisions.** Prefixes are distinct: CC hub `cch_*`, Staffing `cc_*` and
  `sc_last_`, Team hub `th_*`/`td_*`, Owners `own_*`. Sharing an origin will not cross wires.
  Re-check this if anyone adds keys before the migration runs.
- All hubs already point at the same Supabase project, so no data moves.

---

## Order of work

Each phase is safe to stop at. The old URLs keep working until phase 4.

**Phase 1 — publish alongside (no user impact)**
Copy `cc-hub-live/index.html` → `team-hub/leads.html` and
`Staffing-Coordinator-Hub/index.html` → `team-hub/recruiting.html`. Fix relative asset paths
(`icons.svg`, any images). Push. Both old and new addresses now serve the same hubs.
*Rollback: delete the new files.*

**Phase 2 — test the new paths with real logins**
Sign in once at `hub.mo-care.com` and confirm you are still signed in on `/leads.html` and
`/recruiting.html` without a second prompt. That single check is the whole point of the
migration, so do not skip it. Then walk every tab, save something in each, and confirm it
appears in the other hub.
*Rollback: same as above.*

**Phase 3 — repoint the GHL menu links**
Change each custom menu link's URL from `cc.` / `sc.` to the `hub.` path. Keep the same link
records so the UUIDs, ordering CSS and Admin visibility all survive.
*Rollback: paste the old URLs back. Two minutes.*

**Phase 4 — turn the old internal addresses into redirects**
In the `care-coordinator-hub` and `Staffing-Coordinator-Hub` repos, replace `index.html`
with a small redirect page that forwards to the new path **carrying the hash and query
string through**. Leave `orientation-booking.html` and `evv-correction-form` untouched.
*Rollback: restore the previous index.html from git history.*

**Phase 5 — soak, then tidy**
Leave it a couple of weeks. Then update any bookmarks, printed material or GHL workflow
links still pointing at the old addresses.

---

## Risks

| Risk | Mitigation |
|---|---|
| A bad push now affects every section, since one repo serves them all | Files stay separate. Syntax-check before pushing. Keep pushes small. |
| Someone has an old address bookmarked | Phase 4 redirects, and the old domains keep serving indefinitely. |
| A texted booking link breaks | Public pages never move. This is the reason phase 4 only touches `index.html`. |
| Two hubs now share a session, so signing out of one signs out of all | This is the intended behaviour, but tell staff before it happens so it does not read as a bug. |
| Assets resolve differently at the new paths | Phase 1 covers it; check `icons.svg` renders on both new pages before phase 3. |

## Split of work

- **Claude:** phases 1, 4 and 5 (file moves, asset paths, redirect pages, verification).
- **Samantha:** phase 2 sign-in test (needs real logins) and phase 3 (GHL menu links).

## Do first

Escalation is still not switched on, which is five minutes of data entry and the thing that
actually stops calls falling through. Do that before starting this.
