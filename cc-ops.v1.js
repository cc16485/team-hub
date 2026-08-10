/* Caring Companions — operating layer, v1
 * ---------------------------------------------------------------------------
 * Build step 3. This file EXISTS and is not yet included by any hub.
 *
 * Served from hub.mo-care.com and loaded by every hub with a plain
 * <script src>, which needs no CORS and no build step, matching how these
 * hubs already work.
 *
 * ONE FILE, FOUR HUBS, SO IT IS A SINGLE POINT OF FAILURE. Three rules keep
 * that from being reckless:
 *
 *   1. VERSION IN THE FILENAME. Once a hub includes cc-ops.v1.js, this file
 *      is frozen. Changes go in cc-ops.v2.js and each hub upgrades when it
 *      chooses. Editing a pinned file is how one mistake reaches four
 *      production systems at once.
 *
 *   2. IT MUST NEVER THROW. Nothing here is allowed to break a hub that
 *      loads it. Every entry point is wrapped, and failure sets ready=false
 *      rather than raising.
 *
 *   3. IT MUST NEVER GATE ANYTHING IT CANNOT ANSWER. While there is no
 *      authority data, can() returns the hub's existing answer verbatim.
 *      Not a similar answer. The same one.
 *
 * WHAT IT DELIBERATELY DOES NOT DO YET: render anything, enforce anything,
 * or read competency, duty or work items. Those are later builds, each gated
 * on real data existing rather than on this file being ready for them.
 * ---------------------------------------------------------------------------
 */
;(function (global) {
  'use strict';

  var VERSION = '1.0.0';

  var state = {
    ready: false,          // did the operating tables load
    error: null,
    entity: 'cc_ihs',
    email: '',
    person: null,          // { person_id, full_name, primary_email }
    roles: [],             // role strings for the current entity
    memberships: [],       // entity codes this person actively belongs to
    domains: [],           // every domain row for the current entity
    people: [],            // everyone, for lookups and the self test
    legacy: null,          // function(action) -> boolean, the hub's own answer
    ghlLocation: ''
  };

  function warn(what, e) {
    try { console.warn('[cc-ops] ' + what, e && e.message ? e.message : e); } catch (_) {}
  }

  /* ---------------------------------------------------------------------
   * INIT
   * Loads the operating tables for the signed-in person. Every table here
   * is readable by any authenticated user by design: who works here, what
   * roles they hold and who owns which domain are exactly the things
   * everyone should be able to see.
   *
   * If ANY of it fails, ready stays false and the hub carries on exactly as
   * it did before. An operating layer that can break the hub it describes
   * is worse than no operating layer.
   * ------------------------------------------------------------------- */
  async function init(opts) {
    opts = opts || {};
    state.legacy      = typeof opts.legacy === 'function' ? opts.legacy : null;
    state.entity      = opts.entity || 'cc_ihs';
    state.email       = String(opts.email || '').toLowerCase();
    state.ghlLocation = opts.ghlLocation || '';

    var sb = opts.sb;
    if (!sb) { state.error = 'no supabase client'; return false; }

    try {
      var res = await Promise.all([
        sb.from('persons').select('person_id, full_name, primary_email, active'),
        sb.from('entity_memberships').select('person_id, entity, active'),
        sb.from('staff_roles').select('person_id, entity, role'),
        sb.from('domains').select('*')
      ]);

      for (var i = 0; i < res.length; i++) {
        if (res[i].error) throw new Error(res[i].error.message);
      }

      var persons = res[0].data || [];
      var members = res[1].data || [];
      var roles   = res[2].data || [];

      state.people  = persons;
      state.domains = (res[3].data || []).filter(function (d) { return d.entity === state.entity; });

      state.person = persons.filter(function (p) {
        return String(p.primary_email || '').toLowerCase() === state.email;
      })[0] || null;

      if (state.person) {
        var pid = state.person.person_id;
        state.memberships = members
          .filter(function (m) { return m.person_id === pid && m.active; })
          .map(function (m) { return m.entity; });
        state.roles = roles
          .filter(function (r) { return r.person_id === pid && r.entity === state.entity; })
          .map(function (r) { return r.role; });
      } else {
        state.memberships = [];
        state.roles = [];
      }

      state.ready = true;
      return true;
    } catch (e) {
      state.error = e && e.message ? e.message : String(e);
      state.ready = false;
      warn('operating tables unavailable, running on legacy answers only', e);
      return false;
    }
  }

  /* ---------------------------------------------------------------------
   * AUTHORITY
   *
   * structuralAnswer() is the future. It returns null for every action
   * today, on purpose, because no competency or authority rules exist yet.
   * Null means "this layer has nothing to say", and can() then returns the
   * hub's own answer unchanged.
   *
   * So through builds 3 to 7, can() is provably identical to the code it
   * replaces: the structural branch never fires. The self test in build 5
   * proves that rather than assuming it, across every gated action and
   * every real person.
   *
   * THE MEMBERSHIP GATE IS NOT APPLIED WHILE IN LEGACY MODE, and that is
   * deliberate. Denying someone because they have no membership row would
   * be a behaviour change, and anyone not yet seeded would silently lose
   * access. Membership becomes the gate at build 8, when the legacy branch
   * is removed and there is real authority data to gate on.
   * ------------------------------------------------------------------- */
  function structuralAnswer(_action, _opts) {
    return null;   // build 8 replaces this. Not before.
  }

  /* The same, for an arbitrary person. Separate function on purpose: the
   * signed-in case and the about-somebody-else case must never share a code
   * path that can quietly answer about the wrong person. */
  function structuralAnswerFor(_email, _action, _opts) {
    return null;   // build 8 replaces this. Not before.
  }

  function can(action, opts) {
    try {
      var structural = structuralAnswer(action, opts);
      if (structural !== null && structural !== undefined) return !!structural;
      return state.legacy ? !!state.legacy(action, opts) : false;
    } catch (e) {
      warn('can(' + action + ') failed, falling back to legacy', e);
      try { return state.legacy ? !!state.legacy(action, opts) : false; } catch (_) { return false; }
    }
  }

  /* Same question, asked about somebody else. Only the self test needs this,
   * because it has to evaluate every person rather than the signed-in one.
   *
   * legacyFor IS REQUIRED AND IS NOT OPTIONAL, and the first version of this
   * function is the reason why. It fell back to state.legacy, which is bound
   * to the SIGNED-IN person, so asking "can Krystal manage settings" returned
   * Samantha's answer: true. The self test caught it before this file was
   * included anywhere, which is the entire argument for having built the test
   * before the migration rather than alongside it.
   *
   * Missing evaluator returns null, meaning "unknown". Never false, which
   * would read as a confident denial, and never true. The self test records
   * null as a failure rather than a result. */
  function canFor(email, action, legacyFor, opts) {
    try {
      var structural = structuralAnswerFor(email, action, opts);
      if (structural !== null && structural !== undefined) return !!structural;
      if (typeof legacyFor !== 'function') return null;
      return !!legacyFor(String(email || '').toLowerCase(), action);
    } catch (e) {
      warn('canFor(' + email + ', ' + action + ') failed', e);
      return null;
    }
  }

  /* ---------------------------------------------------------------------
   * SELF TEST — build 5's gate
   *
   * For every real person and every gated action, compare the answer the
   * hub gives today against the answer this layer gives. They must match
   * before a single call site is switched over.
   *
   * Deliberately dumb: it does not know which answer is right, only whether
   * they agree. A test that decided what the answer should be would be
   * testing my opinion rather than the migration.
   * ------------------------------------------------------------------- */
  function selfTest(cfg) {
    cfg = cfg || {};
    var people  = cfg.people  || [];
    var actions = cfg.actions || [];
    var legacyFor = cfg.legacyFor;
    var rows = [], mismatches = 0;

    if (typeof legacyFor !== 'function') {
      return { ok: false, error: 'selfTest needs a legacyFor(email, action) function', rows: [], mismatches: 0 };
    }

    for (var p = 0; p < people.length; p++) {
      for (var a = 0; a < actions.length; a++) {
        var email = String(people[p].email || people[p]).toLowerCase();
        var action = actions[a];
        var was = null, now = null, err = null;
        try { was = !!legacyFor(email, action); } catch (e) { was = null; err = String(e); }
        try { now = canFor(email, action, legacyFor); } catch (e) { now = null; err = String(e); }
        // null means this layer could not answer. That is a failure, never a
        // silent false, because a confident denial we did not compute is the
        // most dangerous thing this test could report as a pass.
        var match = (now !== null) && (was === now) && !err;
        if (!match) mismatches++;
        rows.push({ email: email, action: action, legacy: was, next: now, match: match, error: err });
      }
    }
    return { ok: mismatches === 0, rows: rows, mismatches: mismatches,
             people: people.length, actions: actions.length };
  }

  /* ---------------------------------------------------------------------
   * CONTEXT FROM GHL
   *
   * Read once, at load. Says WHAT you are looking at and never WHO you are:
   * identity comes from the Supabase session, always. A ?as= or ?staff=
   * parameter would mean anyone holding a URL is whoever it claims, so
   * there must never be one, and nothing here reads a name or an email.
   * ------------------------------------------------------------------- */
  var _ctx = null;
  function ctx() {
    if (_ctx) return _ctx;
    _ctx = { ghl_contact: '', client: '', caregiver: '', lead: '', work: '', domain: '' };
    try {
      var qs = new URLSearchParams(global.location.search || '');
      var hash = String(global.location.hash || '');
      var q = hash.indexOf('?');
      var hs = q > -1 ? new URLSearchParams(hash.slice(q + 1)) : null;
      Object.keys(_ctx).forEach(function (k) {
        _ctx[k] = (hs && hs.get(k)) || qs.get(k) || '';
      });
    } catch (e) { warn('could not read context params', e); }
    return _ctx;
  }

  function ghlLink(kind, id) {
    if (!id || !state.ghlLocation) return '';
    var base = 'https://app.hirecara.com/v2/location/' + encodeURIComponent(state.ghlLocation);
    if (kind === 'contact')      return base + '/contacts/detail/' + encodeURIComponent(id);
    if (kind === 'conversation') return base + '/conversations/' + encodeURIComponent(id);
    return base;
  }

  /* ------------------------------------------------------------------- */
  function me() {
    return {
      ready: state.ready,
      email: state.email,
      person_id: state.person ? state.person.person_id : null,
      name: state.person ? state.person.full_name : '',
      entity: state.entity,
      roles: state.roles.slice(),
      memberships: state.memberships.slice(),
      // Nothing below exists yet. Named now so later builds add data rather
      // than a new shape, and so anything reading this fails visibly rather
      // than by finding undefined.
      competencies: [],
      capabilities: { O: null, A: null, F: null, C: null },
      duty: null
    };
  }

  function domains()  { return state.domains.slice(); }
  function people()   { return state.people.slice(); }
  function status()   { return { version: VERSION, ready: state.ready, error: state.error,
                                 entity: state.entity, seeded: state.people.length }; }

  global.CC = {
    version: VERSION,
    init: init,
    me: me,
    can: can,
    canFor: canFor,
    selfTest: selfTest,
    domains: domains,
    people: people,
    ctx: ctx,
    ghlLink: ghlLink,
    status: status,
    // Named so build 8 adds a body rather than an export, and so nothing
    // silently no-ops on a hub that has not been upgraded.
    shell: { mount: function () { warn('shell.mount() is not implemented in v1'); } }
  };
})(window);
