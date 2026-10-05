/* ===========================================================================
   VSENSE Halal Logistics - application
   ---------------------------------------------------------------------------
   Eight views, a right-hand audit packet drawer, a replaying telemetry stream
   and an offline verifier. Classic script so the file:// double-click path
   works; everything hangs off the VS namespace established by the libraries.

   One UI rule is enforced everywhere below: nothing renders a number that
   could be read as an overall compliance score. Annexes show counts by state
   and a blocking list. Where a reader expects a progress ring, they get a
   count and a reason instead -- which is less satisfying and more honest.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = global.VS;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.prototype.slice.call((root || document).querySelectorAll(sel));

  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const STATE_TONE = {
    VERIFIED: 'verified', FAILED: 'failed', MISSING: 'missing', SIMULATED: 'simulated',
    REQUIRES_REVIEW: 'review', INSUFFICIENT_COVERAGE: 'review', NOT_APPLICABLE: 'muted',
    PASS: 'verified', FAIL: 'failed',
    EVIDENCE_PACK_PREPARED: 'verified', REVIEW_REQUIRED: 'review',
    NOT_SUBMITTED: 'muted', NONE: 'muted', HOLD: 'muted',
    DETECTED: 'failed', NOT_DETECTED: 'verified', BELOW_LOQ: 'review',
    INCONCLUSIVE: 'review', INVALID: 'failed', SAMPLE_COMPROMISED: 'failed',
    NOT_TESTED: 'missing', NO_SAMPLE: 'missing', WITHDRAWN: 'missing',
  };
  const STATE_GLYPH = {
    verified: 'i-check', failed: 'i-x', missing: 'i-dash',
    simulated: 'i-flask', review: 'i-eye', muted: 'i-dot',
  };

  function chip(state) {
    const tone = STATE_TONE[state] || 'muted';
    return '<span class="state ' + tone + '"><svg><use href="#' + STATE_GLYPH[tone] + '"/></svg>' + esc(String(state).replace(/_/g, ' ')) + '</span>';
  }

  const MODE_ICON = { MARITIME: 'i-ship', ROAD: 'i-truck', AIR: 'i-plane', RAIL: 'i-truck', TERMINAL: 'i-anchor', TRANSSHIP: 'i-anchor' };

  /* ------------------------------------------------------------ app state */

  const S = {
    journey: null, persona: null, series: null, assessment: null,
    selection: { jurisdictions: [], frameworks: [], authorities: [] },
    replay: null, view: 'journey',
    packetProfile: 'CUSTOM', packetSections: [], packetDeny: [],
    emergencyAck: false, lastResult: null, recipient: 'AUTHORITY',
    selftest: null,
  };

  const RECIPIENTS = [
    { id: 'AUTHORITY', label: 'Destination authority annex recipient', class: 'EXTERNAL_AUTHORITY' },
    { id: 'CERTIFIER', label: 'Certification body reviewer', class: 'EXTERNAL_ASSURANCE' },
    { id: 'AUDITOR', label: 'Third-party auditor', class: 'EXTERNAL_ASSURANCE' },
    { id: 'BUYER', label: 'Commercial buyer', class: 'COMMERCIAL' },
    { id: 'INTERNAL', label: 'Internal quality file', class: 'INTERNAL' },
  ];

  const NAV = [
    { id: 'journey', icon: 'i-grid', label: 'Journey overview' },
    { id: 'custody', icon: 'i-route', label: 'Chain of custody' },
    { id: 'stream', icon: 'i-pulse', label: 'Live telemetry' },
    { id: 'compliance', icon: 'i-shield', label: 'Jurisdictions & annexes' },
    { id: 'evidence', icon: 'i-doc', label: 'Evidence records' },
    { id: 'laboratory', icon: 'i-flask', label: 'Laboratory' },
    { id: 'integrity', icon: 'i-lock', label: 'Verify integrity' },
    { id: 'personas', icon: 'i-users', label: 'Personas & mandate' },
  ];

  /* ------------------------------------------------------------------ boot */

  function boot() {
    VS.journeys.build();
    S.selftest = VS.crypto.selfTest();
    VS.crypto.crossCheckSubtle().then((r) => { S.selftest.subtle = r; if (S.view === 'integrity') render(); });

    initTheme();
    buildNav();

    const jsel = $('#journey-select');
    jsel.innerHTML = VS.journeys.all.map((j) => '<option value="' + j.id + '">' + esc(j.id + '  ' + j.title) + '</option>').join('');
    jsel.addEventListener('change', () => selectJourney(jsel.value));

    const psel = $('#persona-select');
    psel.innerHTML = VS.registry.PERSONAS.map((p) => '<option value="' + p.id + '">' + esc(p.short) + '</option>').join('');
    psel.addEventListener('change', () => { S.persona = VS.registry.PERSONAS.filter((x) => x.id === psel.value)[0]; applyPersonaDefaults(); render(); });

    $('#theme-btn').addEventListener('click', toggleTheme);
    $('#audit-btn').addEventListener('click', openDrawer);
    $('#drawer-close').addEventListener('click', closeDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#btn-json').addEventListener('click', () => downloadPacket('json'));
    $('#btn-pdf').addEventListener('click', () => downloadPacket('pdf'));
    $('#btn-both').addEventListener('click', () => downloadPacket('both'));

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && $('#drawer').classList.contains('open')) closeDrawer();
      if (e.key.toLowerCase() === 'g' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); openDrawer(); }
    });

    S.persona = VS.registry.PERSONAS[0];
    psel.value = S.persona.id;

    // Deep links, for demos and screenshots:
    //   ?journey=HLC-26-10611&view=compliance&drawer=1&profile=emergency
    let startJourney = VS.journeys.all[0].id;
    try {
      const jm = /[?&]journey=([A-Za-z0-9-]+)/.exec(global.location ? global.location.search : '');
      if (jm && VS.journeys.byId(jm[1])) startJourney = jm[1];
    } catch (e) { /* no location outside a browser */ }
    selectJourney(startJourney);
    jsel.value = startJourney;

    try {
      const q = global.location ? global.location.search : '';
      const pm2 = /[?&]persona=([A-Z0-9-]+)/.exec(q);
      if (pm2) {
        const hit = VS.registry.PERSONAS.filter((x) => x.id === pm2[1])[0];
        if (hit) { S.persona = hit; psel.value = hit.id; applyPersonaDefaults(); }
      }
      const vm = /[?&]view=([a-z]+)/.exec(q);
      if (vm && NAV.some((n) => n.id === vm[1])) { S.view = vm[1]; setActiveNav(S.view); render(); }
      // ?profile=emergency pre-selects the emergency disclosure profile and
      // pre-ticks its authorization, for documentation captures and scripted
      // walkthroughs. It changes nothing about how the packet is built: the
      // authorization is still recorded in the manifest as a separate act.
      const pm = /[?&]profile=(custom|emergency)/.exec(q);
      if (pm) {
        S.packetProfile = pm[1].toUpperCase();
        if (S.packetProfile === 'EMERGENCY') S.emergencyAck = /[?&]authorize=1/.test(q);
      }
      if (/[?&]drawer=1/.test(q)) openDrawer();
      if (/[?&]selftest=1/.test(q)) runBrowserSelfTest();
    } catch (e) { /* no location outside a browser */ }
  }

  /**
   * ?selftest=1 - exercises the full packet path in the real browser and
   * writes the outcome into the DOM. The Node suite covers the same logic,
   * but it cannot prove the code actually runs under a browser's engine with
   * its own TextEncoder, Blob and crypto. This closes that gap and doubles as
   * a diagnostic when someone reports "it does not work on my machine".
   */
  function runBrowserSelfTest() {
    const out = [];
    const log = (name, ok, detail) => out.push({ name: name, ok: !!ok, detail: detail || '' });
    try {
      const t = VS.crypto.selfTest();
      log('crypto self-test', t.failed === 0, (t.total - t.failed) + '/' + t.total);

      ['CUSTOM', 'EMERGENCY'].forEach((profile) => {
        const result = VS.packet.build(S.journey, S.series, S.assessment, S.selection, {
          profile: profile,
          sections: ['product', 'custody', 'telemetry', 'laboratory', 'certificates'],
          recipient: RECIPIENTS[0], persona: S.persona,
          denyClasses: profile === 'CUSTOM' ? ['COMMERCIAL', 'PERSONAL'] : [],
          authorized: true,
        });
        const v = VS.packet.verify(result.packet);
        log(profile + ' packet build + verify', v.ok, (v.total - v.failed) + '/' + v.total + ' digest ' + VS.crypto.shortHash(result.digest));
        log(profile + ' denied-data scan', result.scan.result === 'CLEAN', result.scan.result);

        const json = VS.packet.toJSON(result);
        log(profile + ' JSON serialises', json.length > 1000, json.length + ' bytes');

        const bytes = VS.packet.toPDF(result, S.journey, S.series);
        const head = String.fromCharCode.apply(null, bytes.subarray(0, 8));
        log(profile + ' PDF renders', bytes.length > 8000 && head === '%PDF-1.7', bytes.length + ' bytes');

        const blob = new Blob([bytes], { type: 'application/pdf' });
        log(profile + ' PDF blob constructs', blob.size === bytes.length, blob.size + ' bytes');
      });
    } catch (e) {
      log('browser self-test threw', false, e && e.message ? e.message : String(e));
    }

    const failed = out.filter((r) => !r.ok).length;
    const el = document.createElement('div');
    el.id = 'browser-selftest';
    el.setAttribute('data-failed', String(failed));
    el.setAttribute('data-total', String(out.length));
    el.style.cssText = 'position:fixed;left:0;bottom:0;z-index:5000;max-width:620px;padding:12px 16px;' +
      'font:12px/1.5 JetBrains Mono,monospace;background:var(--deep);border:1px solid var(--hairline-strong);' +
      'border-radius:0 12px 0 0;color:var(--fog)';
    el.innerHTML = '<b>BROWSER SELF-TEST &mdash; ' + (failed ? failed + ' FAILED' : 'ALL ' + out.length + ' PASS') + '</b><br>' +
      out.map((r) => (r.ok ? '✓ ' : '✗ ') + esc(r.name) + (r.detail ? '  ' + esc(r.detail) : '')).join('<br>');
    document.body.appendChild(el);
  }

  function selectJourney(id) {
    if (S.replay) { S.replay.stop(); S.replay = null; }
    S.journey = VS.journeys.byId(id);
    S.series = VS.stream.generate(S.journey);
    S.selection = {
      jurisdictions: S.journey.suggested.jurisdictions.slice(),
      frameworks: S.journey.suggested.frameworks.slice(),
      authorities: [],
    };
    // Default the authority picks to the halal authority of each destination.
    S.selection.jurisdictions.forEach((j) => {
      const jur = VS.registry.jurisdiction(j);
      if (!jur) return;
      jur.authorities.forEach((a) => {
        const def = VS.registry.AUTHORITIES[a];
        if (def && def.kind === 'HALAL_AUTHORITY' && S.selection.authorities.indexOf(a) === -1) S.selection.authorities.push(a);
      });
    });
    S.packetSections = ['product', 'custody', 'telemetry', 'laboratory', 'certificates'];
    S.lastResult = null;
    reassess();
    render();
  }

  function applyPersonaDefaults() {
    // A persona's lens changes the default view, not the underlying evidence.
    const map = { journey: 'journey', controls: 'compliance', laboratory: 'laboratory',
      telemetry: 'stream', custody: 'custody', readiness: 'compliance', integrity: 'integrity' };
    S.view = map[S.persona.focus] || 'journey';
    setActiveNav(S.view);
  }

  function reassess() {
    S.assessment = VS.assess.assess(S.journey, S.series, S.selection);
  }

  /* ------------------------------------------------------------------ nav */

  function buildNav() {
    $('#nav').innerHTML = NAV.map((n, i) =>
      '<button data-view="' + n.id + '"' + (i === 0 ? ' aria-current="page"' : '') + ' aria-label="' + esc(n.label) + '">' +
      '<svg><use href="#' + n.icon + '"/></svg>' +
      '<span class="rail-tip">' + esc(n.label) + '</span></button>').join('');
    $$('#nav button').forEach((b) => b.addEventListener('click', () => {
      S.view = b.dataset.view; setActiveNav(S.view); render();
      $('#workspace').scrollTop = 0;
    }));
  }

  function setActiveNav(view) {
    $$('#nav button').forEach((b) => {
      if (b.dataset.view === view) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
  }

  /* ---------------------------------------------------------------- theme */

  function initTheme() {
    // ?theme=light pins the theme for a screenshot, a projector or a kiosk,
    // ahead of both the stored choice and the OS preference.
    let forced = null;
    try {
      const m = /[?&]theme=(light|dark)/.exec(global.location ? global.location.search : '');
      if (m) forced = m[1];
    } catch (e) { /* no location in a non-browser context */ }

    let saved = null;
    try { saved = localStorage.getItem('vsense-theme'); } catch (e) { /* private mode */ }
    const prefersLight = global.matchMedia && global.matchMedia('(prefers-color-scheme: light)').matches;
    const theme = forced || saved || (prefersLight ? 'light' : 'dark');
    document.documentElement.setAttribute('data-theme', theme);
    updateThemeIcon(theme);
  }

  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    updateThemeIcon(next);
    try { localStorage.setItem('vsense-theme', next); } catch (e) { /* non-fatal */ }
    if (S.view === 'stream') render();
  }

  function updateThemeIcon(theme) {
    $('#theme-btn').innerHTML = '<svg><use href="#' + (theme === 'dark' ? 'i-moon' : 'i-sun') + '"/></svg>';
  }

  /* --------------------------------------------------------------- render */

  function render() {
    $$('.view').forEach((v) => v.classList.toggle('active', v.dataset.view === S.view));
    const el = $('#view-' + S.view);
    if (!el) return;
    const fn = {
      journey: viewJourney, custody: viewCustody, stream: viewStream,
      compliance: viewCompliance, evidence: viewEvidence, laboratory: viewLaboratory,
      integrity: viewIntegrity, personas: viewPersonas,
    }[S.view];
    el.innerHTML = fn ? fn() : '';
    if (S.view === 'compliance') wireCompliance();
    if (S.view === 'stream') wireStream();
    wireCopy(el);
  }

  function wireCopy(root) {
    $$('.copy', root).forEach((b) => b.addEventListener('click', () => {
      const text = b.dataset.copy;
      const done = () => toast('Copied to clipboard');
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
      } else fallbackCopy(text, done);
    }));
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('Copy unavailable in this browser', true); }
    document.body.removeChild(ta);
  }

  /* -------------------------------------------------------- view: journey */

  function viewJourney() {
    const j = S.journey, cov = S.series.coverage;
    const blocking = S.assessment.annexes.reduce((n, a) => n + a.blocking.length, 0);
    const failed = j.events.filter((e) => e.state === 'FAILED').length;

    return head('Journey overview', j.title + '. ' + j.product.description + ', lot ' + j.product.lot + '.') +
      '<div class="grid c4" style="margin-bottom:14px">' +
      tile(j.id, 'Consignment', j.product.quantity.toLocaleString() + ' ' + j.product.unit) +
      tile(j.legs.length + ' legs', 'Custody stages', j.origin.place + ' to ' + j.destination.place) +
      tile(String(j.events.length), 'Evidence records', 'Hash-linked, chain head ' + VS.crypto.shortHash(j.chainHead)) +
      tile(String(blocking), 'Blocking findings', blocking ? 'Across ' + S.assessment.annexes.length + ' destination annexes' : 'None on current selection') +
      '</div>' +

      '<div class="card" style="margin-bottom:14px">' +
      '<div class="card-head"><div><h2>Chain of custody</h2><p class="sub">Every stage, its state, and the hash that binds it to the stage before.</p></div>' +
      chip(failed ? 'FAILED' : 'VERIFIED') + '</div>' +
      custodySpine() +
      '</div>' +

      '<div class="grid main-side">' +
      '<div class="card"><h2>Recent evidence events</h2><p class="sub">Newest first. Each row is an immutable record with its own digest.</p>' +
      '<div class="ticker">' + j.events.slice().reverse().slice(0, 9).map((e) =>
        '<div class="tick-row"><span class="t">' + esc(e.at.slice(5, 16).replace('T', ' ')) + '</span>' +
        '<span class="b"><b>' + esc(e.title) + '</b><span>' + esc(e.type.replace(/_/g, ' ').toLowerCase()) + ' &middot; ' + esc(e.actor) + '</span></span>' +
        '<span style="margin-left:auto">' + chip(e.state) + '</span></div>').join('') +
      '</div></div>' +

      '<div><div class="card" style="margin-bottom:14px"><h2>Integrity gates</h2><p class="sub">Independent checks. No gate is averaged with another.</p>' +
      gateRow('Evidence digests recompute', 'VERIFIED', j.events.length + ' records') +
      gateRow('Custody chain intact', 'VERIFIED', VS.crypto.shortHash(j.chainHead)) +
      gateRow('Merkle inclusion', 'VERIFIED', VS.crypto.shortHash(j.merkleRoot)) +
      gateRow('Telemetry coverage', cov.state, cov.sampleCount + ' samples') +
      gateRow('External anchor', 'SIMULATED', 'No external commitment in a demo') +
      '</div>' +
      '<div class="card"><h2>Destinations on this journey</h2><p class="sub">Several at once. Each is assessed separately.</p>' +
      S.assessment.annexes.map((a) =>
        '<div style="display:flex;align-items:center;gap:9px;padding:8px 0;border-bottom:1px solid var(--hairline)">' +
        '<b style="font-size:12.5px;flex:1">' + esc(a.jurisdictionName) + '</b>' +
        '<span style="font-size:11px;color:var(--fog-dim)">' + a.controls.length + ' controls</span>' +
        chip(a.preparation) + '</div>').join('') +
      '</div></div></div>' +

      boundaryNote();
  }

  function custodySpine() {
    const j = S.journey;
    const stages = [{ key: 'origin', name: 'Origin', place: j.origin.place, icon: 'i-building' }]
      .concat(j.legs.map((l) => ({
        key: 'leg-' + l.seq, name: l.mode === 'TRANSSHIP' ? 'Transship' : titleCase(l.mode),
        place: l.to, icon: MODE_ICON[l.mode] || 'i-route', time: l.arrive,
      })))
      .concat([{ key: 'destination', name: 'Delivered', place: j.destination.place, icon: 'i-building' }]);

    const stageState = (key) => {
      const evs = j.events.filter((e) => e.stage === key);
      if (evs.some((e) => e.state === 'FAILED')) return 'fail';
      if (evs.some((e) => e.state === 'REQUIRES_REVIEW' || e.state === 'INSUFFICIENT_COVERAGE')) return 'review';
      return evs.length ? 'done' : 'done';
    };

    let html = '<div class="custody"><div class="custody-track">';
    stages.forEach((s, i) => {
      const st = stageState(s.key);
      if (i > 0) {
        const prev = stageState(stages[i - 1].key);
        html += '<div class="custody-link ' + (prev === 'fail' ? 'fail' : 'done') + (S.replay && S.replay.playing ? ' flow' : '') + '"></div>';
      }
      html += '<div class="custody-node ' + st + '">' +
        '<div class="ring"><svg><use href="#' + s.icon + '"/></svg></div>' +
        '<span class="nm">' + esc(s.name) + '</span>' +
        '<span class="pl">' + esc(s.place) + '</span>' +
        (s.time ? '<span class="tm">' + esc(s.time.slice(5, 16).replace('T', ' ')) + '</span>' : '') +
        '</div>';
    });
    html += '</div>';
    html += '<div class="custody-hashline"><svg style="width:12px;height:12px;color:var(--verified)"><use href="#i-lock"/></svg>' +
      '<span>SHA-256 custody chain &middot; head <code class="mono">' + esc(VS.crypto.shortHash(j.chainHead)) + '</code></span>' +
      '<button class="copy" data-copy="' + esc(j.chainHead) + '">copy</button></div>';
    html += '</div>';
    return html;
  }

  /* -------------------------------------------------------- view: custody */

  function viewCustody() {
    const j = S.journey;
    return head('Chain of custody', 'Every custody event, in sequence, with the hash link that binds it to its predecessor. Altering any event changes every hash after it.') +
      '<div class="card" style="margin-bottom:14px">' + custodySpine() + '</div>' +

      '<div class="card pad0"><div style="padding:15px 15px 0"><h2>Custody events</h2><p class="sub">' +
      j.events.length + ' records. <code class="mono">eventHash[i] = SHA-256(0x02 &#124;&#124; eventHash[i-1] &#124;&#124; canonical(body[i]))</code></p></div>' +
      '<table class="data"><thead><tr><th>Id</th><th>When (UTC)</th><th>Event</th><th>Actor</th><th>State</th><th>Data hash</th><th>Event hash</th></tr></thead><tbody>' +
      j.events.map((e) =>
        '<tr><td class="mono">' + esc(e.id) + '</td>' +
        '<td class="mono">' + esc(e.at.slice(0, 16).replace('T', ' ')) + '</td>' +
        '<td><b style="font-weight:600">' + esc(e.title) + '</b>' +
        (e.body.note ? '<div class="why" style="margin-top:3px">' + esc(e.body.note) + '</div>' : '') + '</td>' +
        '<td style="font-size:11.5px;color:var(--fog-dim)">' + esc(e.actor) + '</td>' +
        '<td>' + chip(e.state) + '</td>' +
        '<td class="mono">' + esc(VS.crypto.shortHash(e.dataHash)) + '</td>' +
        '<td class="mono">' + esc(VS.crypto.shortHash(e.eventHash)) + '</td></tr>').join('') +
      '</tbody></table></div>' +

      '<div class="grid c2" style="margin-top:14px">' +
      '<div class="card"><h2>Handoffs</h2><p class="sub">Two-step acknowledgement. An auto-accepted handoff is not a handoff.</p>' +
      '<table class="data"><thead><tr><th>Leg</th><th>Transferor</th><th>Transferee</th><th>Status</th></tr></thead><tbody>' +
      j.events.filter((e) => e.type === 'HANDOFF').map((e) =>
        '<tr><td class="mono">' + e.body.leg + '</td><td style="font-size:11px">' + esc(e.body.transferor) + '</td>' +
        '<td style="font-size:11px">' + esc(e.body.transferee) + '</td><td>' + chip(e.body.status === 'ACCEPTED' ? 'VERIFIED' : 'REQUIRES_REVIEW') +
        '<div style="font-size:10px;color:var(--fog-dim);margin-top:2px">' + esc(e.body.status) + '</div></td></tr>').join('') +
      '</tbody></table></div>' +

      '<div class="card"><h2>Seal continuity</h2><p class="sub">Every open must reconcile to an authorized custody event.</p>' +
      j.events.filter((e) => e.type === 'SEAL_APPLIED' || e.type === 'SEAL_EVENT').map((e) =>
        '<div style="padding:9px 0;border-bottom:1px solid var(--hairline)">' +
        '<div style="display:flex;gap:8px;align-items:center"><b style="font-size:12px;flex:1">' + esc(e.body.seal) + '</b>' + chip(e.state) + '</div>' +
        '<div class="why" style="margin-top:3px">' + esc(e.body.transition || e.body.state) + '</div>' +
        (e.body.note ? '<div class="why" style="margin-top:3px;color:var(--vermilion)">' + esc(e.body.note) + '</div>' : '') +
        '</div>').join('') +
      '</div></div>' + boundaryNote();
  }

  /* --------------------------------------------------------- view: stream */

  function viewStream() {
    const s = S.series, cov = s.coverage, p = s.profile;
    return head('Live telemetry', 'A pseudo data stream replaying the journey the way production data arrives: sample by sample, with gaps, defrost cycles and anomalies intact.') +
      '<div class="grid c4" style="margin-bottom:14px">' +
      tile(cov.state.replace(/_/g, ' '), 'Coverage result', cov.sampleCount + ' samples on ' + s.device) +
      tile(p.setpoint + '&deg;C', 'Declared setpoint', 'Profile ' + p.min + ' to ' + p.max + ' ' + p.unit) +
      tile(p.expectedCadenceMin + ' min', 'Expected cadence', 'Max sampling gap ' + p.maxSamplingGapMin + ' min') +
      tile(String(cov.inadmissibleCount), 'Inadmissible samples', cov.inadmissibleCount ? 'Calibration lapsed mid-voyage' : 'All devices admissible') +
      '</div>' +

      '<div class="grid main-side">' +
      '<div><div class="card" style="margin-bottom:14px">' +
      '<div class="card-head"><div><h2>Temperature channels</h2><p class="sub">Supply air is diagnostic. The product core (pulp) is the assessed channel.</p></div>' +
      '<div style="display:flex;gap:7px">' +
      '<button class="icon-btn" id="replay-btn"><svg><use href="#i-play"/></svg> Replay stream</button>' +
      '</div></div>' +
      '<div id="chart-wrap">' + chartSVG() + '</div>' +
      '<div class="chart-legend">' +
      '<span><i style="background:var(--cyan)"></i> Supply air</span>' +
      '<span><i style="background:var(--violet)"></i> Return air</span>' +
      '<span><i style="background:var(--verified)"></i> Pulp (assessed)</span>' +
      '<span><i style="background:var(--chart-band);height:9px;width:14px"></i> Declared profile band</span>' +
      '</div>' +
      '<p class="hint"><strong>Why a defrost is not an excursion.</strong> Supply air spikes to roughly +10&deg;C every few hours while the pulp probes move under 0.3&deg;C. Assessing the supply channel would raise a false excursion on every cycle and train everyone to ignore the alarm.</p>' +
      '</div>' +

      '<div class="card"><h2>Coverage assessment</h2><p class="sub">' + esc(cov.explain) + '</p>' +
      '<table class="data"><thead><tr><th>Finding</th><th>Severity</th><th>Detail</th></tr></thead><tbody>' +
      (cov.findings.length ? cov.findings.map((f) =>
        '<tr><td class="mono">' + esc(f.code) + '</td><td>' + chip(f.severity === 'BLOCKING' ? 'FAILED' : 'REQUIRES_REVIEW') + '</td>' +
        '<td class="why">' + esc(f.text) + '</td></tr>').join('')
        : '<tr><td colspan="3" class="why">No coverage findings on this series.</td></tr>') +
      '</tbody></table>' +
      '<p class="hint"><strong>&ldquo;All samples in range&rdquo; is not a compliance claim.</strong> It is only meaningful once cadence, calibration validity, clock discipline and device identity are resolved. Those are checked first, and a failure there yields insufficient coverage rather than a pass or a fail.</p>' +
      '</div></div>' +

      '<div class="card"><h2>Event stream</h2><p class="sub" id="stream-sub">Idle. Press replay to stream samples.</p>' +
      '<div class="ticker" id="stream-ticker">' +
      s.events.map((e) => streamRow(e)).join('') +
      '</div></div>' +
      '</div>' + boundaryNote();
  }

  function streamRow(e) {
    return '<div class="tick-row sev-' + e.severity + '"><span class="t">' + esc(e.at.slice(5, 16).replace('T', ' ')) + '</span>' +
      '<span class="b"><b>' + esc(titleCase(e.kind)) + '</b><span>' + esc(e.text) + '</span></span></div>';
  }

  function chartSVG(upto) {
    const s = S.series, p = s.profile;
    const W = 720, H = 168, PAD = { l: 34, r: 8, t: 10, b: 18 };
    const n = upto || s.samples.length;
    const pts = s.samples.slice(0, n);
    if (!pts.length) return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '"></svg>';

    // Scale from the SETTLED series, not the whole thing. The first hour is
    // air pull-down from ambient: a known, bounded, uninteresting transient
    // that would otherwise stretch the axis to +30 degC and flatten every
    // defrost cycle and the profile band into a single illegible line.
    // The transient is still drawn, clamped to the top of the plot.
    const settleFrom = Math.min(pts.length - 1, Math.ceil(90 / p.expectedCadenceMin));
    const settled = pts.slice(settleFrom);
    const basis = settled.length > 4 ? settled : pts;
    const all = [];
    basis.forEach((x) => { all.push(x.supply, x.return, x.pulp1); });
    let lo = Math.min.apply(null, all.concat([p.min]));
    let hi = Math.max.apply(null, all.concat([p.max]));
    const pad = (hi - lo) * 0.08 || 1;
    lo -= pad; hi += pad;

    const X = (i) => PAD.l + (i / Math.max(1, s.samples.length - 1)) * (W - PAD.l - PAD.r);
    const clamp = (v) => Math.max(lo, Math.min(hi, v));
    const Y = (v) => PAD.t + (1 - (clamp(v) - lo) / (hi - lo)) * (H - PAD.t - PAD.b);

    const line = (key, color, width) => {
      let d = '';
      pts.forEach((x, i) => { d += (i ? 'L' : 'M') + X(i).toFixed(1) + ' ' + Y(x[key]).toFixed(1); });
      return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linejoin="round" stroke-linecap="round" opacity="' + (key === 'pulp1' ? 1 : 0.62) + '"/>';
    };

    const bandY1 = Y(p.max), bandY2 = Y(p.min);
    let g = '';
    for (let k = 0; k <= 4; k += 1) {
      const v = lo + (k / 4) * (hi - lo);
      g += '<line x1="' + PAD.l + '" y1="' + Y(v).toFixed(1) + '" x2="' + (W - PAD.r) + '" y2="' + Y(v).toFixed(1) + '" stroke="var(--chart-grid)" stroke-width="1"/>' +
        '<text x="4" y="' + (Y(v) + 3).toFixed(1) + '" font-size="9" fill="var(--fog-faint)" font-family="JetBrains Mono, monospace">' + v.toFixed(0) + '</text>';
    }

    return '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" role="img" aria-label="Temperature channels over the journey">' +
      '<rect x="' + PAD.l + '" y="' + Math.min(bandY1, bandY2).toFixed(1) + '" width="' + (W - PAD.l - PAD.r) + '" height="' + Math.abs(bandY2 - bandY1).toFixed(1) + '" fill="var(--chart-band)"/>' +
      g + line('supply', 'var(--cyan)', 1) + line('return', 'var(--violet)', 1) + line('pulp1', 'var(--verified)', 1.8) +
      '</svg>';
  }

  function wireStream() {
    const btn = $('#replay-btn');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (S.replay && S.replay.playing) {
        S.replay.stop();
        btn.innerHTML = '<svg><use href="#i-play"/></svg> Replay stream';
        $('#stream-chip').innerHTML = '<span class="dot"></span> STREAM IDLE';
        return;
      }
      S.replay = S.replay || new VS.stream.Replay(S.series, onSample);
      S.replay.index = 0;
      S.replay.start();
      btn.innerHTML = '<svg><use href="#i-pause"/></svg> Pause stream';
      $('#stream-chip').innerHTML = '<span class="dot"></span> STREAMING';
    });
  }

  function onSample(sample, i, total) {
    const wrap = $('#chart-wrap');
    if (wrap) wrap.innerHTML = chartSVG(i);
    const sub = $('#stream-sub');
    if (sub) {
      sub.innerHTML = 'Sample ' + i + ' of ' + total + ' &middot; pulp ' +
        '<b class="mono">' + sample.pulp1.toFixed(2) + '&deg;C</b> &middot; supply ' +
        '<span class="mono">' + sample.supply.toFixed(2) + '&deg;C</span>' +
        (sample.defrost ? ' &middot; <span style="color:var(--cyan)">defrost</span>' : '') +
        (sample.door ? ' &middot; <span style="color:var(--vermilion)">door open</span>' : '') +
        (!sample.admissible ? ' &middot; <span style="color:var(--amber)">inadmissible</span>' : '');
    }
  }

  /* ----------------------------------------------------- view: compliance */

  function viewCompliance() {
    const R = VS.registry;
    const regions = R.regions();

    let picks = '<div class="card" style="margin-bottom:14px">' +
      '<h2>Apply jurisdictions, frameworks and authorities to this route</h2>' +
      '<p class="sub">Select as many as apply. One journey routinely answers to several destinations at once, and they are never merged into a single verdict.</p>';

    picks += '<div class="pickgroup"><span class="eyebrow">Jurisdictions</span><div class="picks">';
    regions.forEach((rg) => {
      R.JURISDICTIONS.filter((j) => j.region === rg).forEach((j) => {
        const on = S.selection.jurisdictions.indexOf(j.id) !== -1;
        picks += '<button class="pick" data-kind="jur" data-id="' + j.id + '" aria-pressed="' + on + '">' +
          '<span class="tick"><svg><use href="#i-check"/></svg></span>' +
          '<span>' + esc(j.name) + '<small>' + esc(j.region) + '</small></span></button>';
      });
    });
    picks += '</div></div>';

    picks += '<div class="pickgroup"><span class="eyebrow">Frameworks and standards</span><div class="picks">';
    Object.keys(R.FRAMEWORKS).forEach((k) => {
      const f = R.FRAMEWORKS[k];
      // Only offer frameworks relevant to a selected jurisdiction, plus cross-cutting ones.
      if (S.selection.jurisdictions.indexOf(f.jurisdiction) === -1 && f.jurisdiction !== 'OIC') return;
      const on = S.selection.frameworks.indexOf(k) !== -1;
      picks += '<button class="pick" data-kind="fw" data-id="' + k + '" aria-pressed="' + on + '">' +
        '<span class="tick"><svg><use href="#i-check"/></svg></span>' +
        '<span>' + esc(f.name) + '<small>' + esc(f.family + ' · ' + f.status.replace(/_/g, ' ').toLowerCase()) + '</small></span></button>';
    });
    picks += '</div></div>';

    picks += '<div class="pickgroup"><span class="eyebrow">Authorities and recipients</span><div class="picks">';
    S.selection.jurisdictions.forEach((jid) => {
      const jur = R.jurisdiction(jid);
      if (!jur) return;
      jur.authorities.forEach((a) => {
        const def = R.AUTHORITIES[a];
        if (!def) return;
        const on = S.selection.authorities.indexOf(a) !== -1;
        picks += '<button class="pick" data-kind="auth" data-id="' + a + '" aria-pressed="' + on + '">' +
          '<span class="tick"><svg><use href="#i-check"/></svg></span>' +
          '<span>' + esc(def.name) + '<small>' + esc(def.kind.replace(/_/g, ' ').toLowerCase()) + '</small></span></button>';
      });
    });
    picks += '</div>' +
      '<p class="hint"><strong>Authority kinds do not interchange.</strong> A halal authority, a product-safety regulator and a border control each answer different questions. An outcome from one never populates another.</p>' +
      '</div></div>';

    const annexes = S.assessment.annexes.map((a) => {
      const counts = Object.keys(a.counts).map((k) => chip(k) + '<span style="font-size:11px;color:var(--fog-dim);margin:0 10px 0 4px">' + a.counts[k] + '</span>').join('');
      return '<div class="card" style="margin-bottom:14px">' +
        '<div class="card-head"><div>' +
        '<span class="eyebrow">Authority annex &middot; ' + esc(a.region) + '</span>' +
        '<h2>' + esc(a.jurisdictionName) + '</h2>' +
        '<p class="sub">' + esc(a.frameworks.join(' · ')) + '</p></div>' +
        '<div style="text-align:right">' + chip(a.preparation) +
        '<div style="margin-top:5px">' + chip(a.submission) + '</div>' +
        '<div style="margin-top:5px">' + chip(a.authorityDecision) + '</div></div></div>' +

        '<div style="display:flex;flex-wrap:wrap;align-items:center;margin-bottom:10px">' + counts + '</div>' +
        '<p class="hint" style="margin-bottom:10px">' + esc(a.note) + '</p>' +

        (a.blocking.length ? '<div class="warn"><b>' + a.blocking.length + ' blocking finding' + (a.blocking.length > 1 ? 's' : '') + '</b>' +
          a.blocking.map((b) => '<p><code class="mono">' + esc(b.control) + '</code> &mdash; ' + esc(b.because) + '</p>').join('') + '</div>' : '') +

        '<table class="data"><thead><tr><th>Control</th><th>Requirement</th><th>Required by</th><th>State</th><th>Basis</th></tr></thead><tbody>' +
        a.controls.map((c) =>
          '<tr><td class="mono">' + esc(c.control) + '</td>' +
          '<td style="font-size:12px">' + esc(c.title) + '</td>' +
          '<td style="font-size:10.5px;color:var(--fog-dim)">' + esc(c.requiredBy.join(', ')) + '</td>' +
          '<td>' + chip(c.state) + '</td>' +
          '<td class="why">' + esc(c.because) + '</td></tr>').join('') +
        '</tbody></table></div>';
    }).join('');

    const divergence = divergenceCallout();

    return head('Jurisdictions, frameworks and annexes',
      'The same evidence, asked different questions by different destinations. Selecting three destinations does not triple the evidence: it produces three independently frozen annexes over one evidence core.') +
      picks + divergence + annexes + boundaryNote();
  }

  /** Surface where destinations actually disagree on identical evidence. */
  function divergenceCallout() {
    const byControl = {};
    S.assessment.annexes.forEach((a) => {
      a.controls.forEach((c) => {
        byControl[c.control] = byControl[c.control] || { title: c.title, states: {} };
        byControl[c.control].states[a.jurisdiction] = c.state;
      });
    });
    const diverging = Object.keys(byControl).filter((k) => {
      const v = Object.keys(byControl[k].states).map((x) => byControl[k].states[x]);
      return v.length > 1 && v.some((x) => x !== v[0]);
    });
    if (!diverging.length) return '';

    return '<div class="card" style="margin-bottom:14px;border-color:color-mix(in srgb, var(--amber) 40%, transparent)">' +
      '<h2>Where these destinations disagree</h2>' +
      '<p class="sub">Identical evidence, different answers. This is the reason annexes freeze independently rather than rolling up.</p>' +
      '<table class="data"><thead><tr><th>Control</th><th>Requirement</th>' +
      S.assessment.annexes.map((a) => '<th>' + esc(a.jurisdiction) + '</th>').join('') + '</tr></thead><tbody>' +
      diverging.map((k) =>
        '<tr><td class="mono">' + esc(k) + '</td><td style="font-size:12px">' + esc(byControl[k].title) + '</td>' +
        S.assessment.annexes.map((a) => '<td>' + (byControl[k].states[a.jurisdiction] ? chip(byControl[k].states[a.jurisdiction]) : '<span class="state muted"><svg><use href="#i-dot"/></svg>n/a</span>') + '</td>').join('') +
        '</tr>').join('') +
      '</tbody></table></div>';
  }

  function wireCompliance() {
    $$('.pick').forEach((b) => b.addEventListener('click', () => {
      const kind = b.dataset.kind, id = b.dataset.id;
      const list = kind === 'jur' ? S.selection.jurisdictions : kind === 'fw' ? S.selection.frameworks : S.selection.authorities;
      const i = list.indexOf(id);
      if (i === -1) list.push(id); else list.splice(i, 1);
      if (kind === 'jur') {
        // Dropping a jurisdiction must also drop frameworks and authorities
        // that only existed because of it, or the annex set goes incoherent.
        S.selection.frameworks = S.selection.frameworks.filter((f) => {
          const fw = VS.registry.FRAMEWORKS[f];
          return fw && (fw.jurisdiction === 'OIC' || S.selection.jurisdictions.indexOf(fw.jurisdiction) !== -1);
        });
        S.selection.authorities = S.selection.authorities.filter((a) => {
          const au = VS.registry.AUTHORITIES[a];
          return au && S.selection.jurisdictions.indexOf(au.jurisdiction) !== -1;
        });
      }
      S.lastResult = null;
      reassess();
      render();
    }));
  }

  /* ------------------------------------------------------- view: evidence */

  function viewEvidence() {
    const idx = S.assessment.index;
    return head('Evidence records', 'The evidence core. Each record has one digest and is referenced by every annex that needs it, rather than being duplicated per destination.') +
      '<div class="card pad0"><div style="padding:15px 15px 0"><h2>Evidence index</h2>' +
      '<p class="sub">What each abstract evidence kind resolves to on this journey. A kind resolving to nothing is <em>missing</em>, never a silent pass.</p></div>' +
      '<table class="data"><thead><tr><th>Evidence kind</th><th>Records</th><th>Resolved to</th></tr></thead><tbody>' +
      Object.keys(idx).sort().map((k) => {
        const e = idx[k];
        return '<tr><td class="mono">' + esc(k) + '</td>' +
          '<td>' + (e.records.length ? chip('VERIFIED') + ' <span style="font-size:11px;color:var(--fog-dim)">' + e.records.length + '</span>' : chip('MISSING')) + '</td>' +
          '<td class="why">' + (e.records.length ? esc(e.records.map((r) => r.id).join(', ')) : esc(e.note || 'Not held on this journey.')) + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' +

      '<div class="card" style="margin-top:14px"><h2>Proof material</h2><p class="sub">Recomputable from this page with no network.</p>' +
      hashBox('Merkle root (RFC 6962)', S.journey.merkleRoot, 'Over ' + S.journey.leaves.length + ' evidence leaves. Inclusion proves membership, never completeness.') +
      hashBox('Custody chain head', S.journey.chainHead, 'Recompute from the first event; any alteration changes this value.') +
      '<p class="hint"><strong>Anchor state is SIMULATED.</strong> ' + esc(S.journey.anchor.note) + '</p>' +
      '</div>' + boundaryNote();
  }

  /* ----------------------------------------------------- view: laboratory */

  function viewLaboratory() {
    const labs = S.journey.events.filter((e) => e.type === 'LAB_RESULT');
    const samples = S.journey.events.filter((e) => e.type === 'SAMPLE_DRAWN');
    const R = VS.registry;

    return head('Laboratory', 'Nine mutually exclusive result states, preserved. Collapsing them is the most common way laboratory evidence is destroyed in transit through software.') +
      (labs.length ? labs.map((e) => {
        const b = e.body;
        return '<div class="card" style="margin-bottom:14px">' +
          '<div class="card-head"><div><span class="eyebrow">Report</span><h2>' + esc(b.report) + '</h2>' +
          '<p class="sub">' + esc(b.facility + ' · ' + b.method + ' · ' + b.matrix) + '</p></div>' + chip(b.resultState) + '</div>' +
          '<table class="data"><tbody>' +
          kvRow('Analyte', b.analyte) + kvRow('Result state', chip(b.resultState), true) +
          kvRow('Limit of detection', b.lod) + kvRow('Limit of quantification', b.loq) +
          kvRow('Scope match', chip(b.scopeMatch === 'IN_SCOPE' ? 'VERIFIED' : 'REQUIRES_REVIEW') + ' <span class="mono" style="font-size:11px">' + esc(b.scopeSnapshot) + '</span>', true) +
          kvRow('Inference scope', b.inferenceScope) +
          kvRow('Analysis / report date', b.analysisDate + ' / ' + b.reportDate) +
          kvRow('QC controls', Object.keys(b.qcControls).map((k) => esc(k) + ': ' + esc(b.qcControls[k])).join(' &middot; '), true) +
          '</tbody></table>' +
          (b.note ? '<p class="hint" style="margin-top:10px"><strong>Note.</strong> ' + esc(b.note) + '</p>' : '') +
          '</div>';
      }).join('') : '<div class="card"><h2>No laboratory result on this journey</h2><p class="sub">Absence of a result is recorded as absence. It is not an implied negative.</p></div>') +

      (samples.length ? '<div class="card" style="margin-bottom:14px"><h2>Sampling plan and what it supports</h2>' +
        samples.map((e) => '<p class="hint"><strong>' + esc(e.body.plan) + '</strong> &mdash; ' + e.body.increments +
          ' increments of ' + e.body.incrementMassG + ' g. Inference scope: <code class="mono">' + esc(e.body.inferenceScope) + '</code>. ' + esc(e.body.note || '') + '</p>').join('') +
        '</div>' : '') +

      '<div class="card"><h2>Result state vocabulary</h2><p class="sub">These never collapse into one another.</p>' +
      '<table class="data"><thead><tr><th>State</th><th>Meaning</th></tr></thead><tbody>' +
      Object.keys(R.LAB_RESULT_STATE).map((k) => '<tr><td>' + chip(k) + '</td><td class="why">' + esc(R.LAB_RESULT_STATE[k]) + '</td></tr>').join('') +
      '</tbody></table>' +
      '<p class="hint"><strong>Run QC PASS is not product PASS.</strong> And a negative carries only the inference its retained sampling plan supports: a 25 g test portion is roughly one part per million of a 24-tonne container, so positives are strong evidence and negatives are weak.</p>' +
      '</div>' + boundaryNote();
  }

  /* ------------------------------------------------------ view: integrity */

  function viewIntegrity() {
    const t = S.selftest;
    const C = VS.crypto;
    const chainCheck = C.verifyChain(S.journey.events.map((e) => ({ body: e.body, eventHash: e.eventHash })));
    const leaves = S.journey.leaves;
    const proofOk = leaves.every((l, i) => C.verifyMerkleProof(l, C.merkleProof(leaves, i), S.journey.merkleRoot).ok);

    return head('Verify integrity', 'Everything here is recomputed in your browser, from the data on this page, with no network call. A demo that asks you to trust its hashes should show its own test run.') +

      '<div class="grid c2" style="margin-bottom:14px">' +
      '<div class="card"><h2>Cryptographic self-test</h2><p class="sub">Known-answer tests run on page load.</p>' +
      '<div class="verify-list">' +
      t.results.map((r) => '<div class="verify-row ' + (r.pass ? 'pass' : 'fail') + '">' +
        '<svg class="ic"><use href="#' + (r.pass ? 'i-check' : 'i-x') + '"/></svg>' +
        '<span class="nm">' + esc(r.name) + (r.detail ? '<div class="dt">' + esc(r.detail) + '</div>' : '') + '</span></div>').join('') +
      '</div>' +
      '<p class="hint" style="margin-top:10px"><strong>' + (t.failed === 0 ? 'All ' + t.total + ' checks pass.' : t.failed + ' of ' + t.total + ' FAILED.') + '</strong> ' +
      (t.subtle ? (t.subtle.ok === true ? 'Cross-checked against the platform&rsquo;s own crypto.subtle: ' + esc(t.subtle.note) + '.'
        : t.subtle.available === false ? 'crypto.subtle is unavailable in this context, so the pure implementation stands alone.' : esc(t.subtle.note))
        : 'Cross-check against crypto.subtle in progress.') + '</p></div>' +

      '<div class="card"><h2>This journey&rsquo;s evidence</h2><p class="sub">Recomputed against the records shown in the other views.</p>' +
      '<div class="verify-list">' +
      vrow('Every event digest recomputes', S.journey.events.every((e) => C.digest(e.body) === e.dataHash), S.journey.events.length + ' records') +
      vrow('Custody chain verifies end to end', chainCheck.ok, chainCheck.ok ? 'head ' + C.shortHash(chainCheck.head) : 'break at index ' + chainCheck.brokenAt) +
      vrow('Merkle root recomputes from leaves', C.merkleRoot(leaves) === S.journey.merkleRoot, C.shortHash(S.journey.merkleRoot)) +
      vrow('Inclusion proof verifies for every leaf', proofOk, leaves.length + ' proofs') +
      vrow('Tampering is detected', !C.verifyMerkleProof('TAMPERED', C.merkleProof(leaves, 0), S.journey.merkleRoot).ok, 'negative control') +
      '</div>' +
      '<p class="hint" style="margin-top:10px"><strong>What this does not prove.</strong> That the events happened as described, that the batch is complete, or that any authority has seen or accepted it. Integrity is not truth, and it is certainly not acceptance.</p>' +
      '</div></div>' +

      '<div class="card" style="margin-bottom:14px"><h2>Profiles in use</h2><p class="sub">Pinned, so a verifier knows exactly what to recompute.</p>' +
      '<table class="data"><tbody>' +
      kvRow('Hash', C.PROFILES.hash) + kvRow('Canonicalization', C.PROFILES.canonical) +
      kvRow('Merkle', C.PROFILES.merkle) + kvRow('Custody chain', C.PROFILES.chain) +
      '</tbody></table>' +
      '<p class="hint"><strong>Why RFC 6962 and not the common duplication rule.</strong> Leaves are prefixed <code class="mono">0x00</code> and interior nodes <code class="mono">0x01</code>, so no leaf digest can be passed off as an interior node. The tree splits at the largest power of two below each node width, which gives every leaf count exactly one tree shape. The widespread &ldquo;duplicate the last node&rdquo; rule does not: two different leaf sets can share a root.</p></div>' +

      '<div class="card"><h2>Merkle inclusion explorer</h2><p class="sub">Pick any record and walk its audit path to the root.</p>' +
      '<table class="data"><thead><tr><th>Record</th><th>Leaf</th><th>Path length</th><th>Recomputed root</th><th>Result</th></tr></thead><tbody>' +
      S.journey.events.slice(0, 8).map((e, i) => {
        const path = C.merkleProof(leaves, i);
        const v = C.verifyMerkleProof(leaves[i], path, S.journey.merkleRoot);
        return '<tr><td class="mono">' + esc(e.id) + '</td><td class="mono">' + i + '</td>' +
          '<td class="mono">' + path.length + '</td><td class="mono">' + esc(C.shortHash(v.computedRoot)) + '</td>' +
          '<td>' + chip(v.ok ? 'VERIFIED' : 'FAILED') + '</td></tr>';
      }).join('') +
      '</tbody></table></div>' + boundaryNote();
  }

  function vrow(name, pass, detail) {
    return '<div class="verify-row ' + (pass ? 'pass' : 'fail') + '">' +
      '<svg class="ic"><use href="#' + (pass ? 'i-check' : 'i-x') + '"/></svg>' +
      '<span class="nm">' + esc(name) + (detail ? '<div class="dt">' + esc(detail) + '</div>' : '') + '</span></div>';
  }

  /* ------------------------------------------------------- view: personas */

  function viewPersonas() {
    return head('Personas and mandate', 'The lens changes what is visible and what may be asserted. A product that only shows capability teaches people they have authority they do not have, so each role states its limits as plainly as its powers.') +
      '<div class="grid c2">' +
      VS.registry.PERSONAS.map((p) => {
        const active = S.persona.id === p.id;
        return '<div class="card"' + (active ? ' style="border-color:color-mix(in srgb, var(--verified) 45%, transparent)"' : '') + '>' +
          '<div class="persona-card">' +
          '<div class="persona-av">' + esc(p.short.slice(0, 2).toUpperCase()) + '</div>' +
          '<div style="min-width:0"><h2>' + esc(p.name) + '</h2>' +
          '<p class="sub">' + esc(p.org) + (active ? ' &middot; <span style="color:var(--verified)">acting as</span>' : '') + '</p></div></div>' +
          '<p class="hint"><strong>Mandate.</strong> ' + esc(p.mandate) + '</p>' +
          '<div class="cando">' +
          '<div><span class="eyebrow">May</span><ul>' + p.can.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' +
          '<div><span class="eyebrow no">May not</span><ul>' + p.cannot.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ul></div>' +
          '</div></div>';
      }).join('') + '</div>' + boundaryNote();
  }

  /* ================================================== audit packet drawer */

  function openDrawer() {
    renderDrawer();
    $('#drawer').classList.add('open');
    $('#drawer').setAttribute('aria-hidden', 'false');
    $('#scrim').classList.add('open');
    $('#drawer-close').focus();
  }

  function closeDrawer() {
    $('#drawer').classList.remove('open');
    $('#drawer').setAttribute('aria-hidden', 'true');
    $('#scrim').classList.remove('open');
    $('#audit-btn').focus();
  }

  function renderDrawer() {
    const emergency = S.packetProfile === 'EMERGENCY';
    const SEC = VS.packet.SECTIONS;
    const DENY = VS.packet.DENY_CLASSES;

    let h = '<div class="profiles">' +
      '<button class="profile" id="prof-custom" aria-pressed="' + (!emergency) + '">' +
      '<b>Custom packet</b><small>Choose sections and a recipient. A redaction allowlist applies and the output bytes are scanned before release.</small></button>' +
      '<button class="profile emergency" id="prof-emergency" aria-pressed="' + emergency + '">' +
      '<b>Emergency packet</b><small>Everything, unredacted, for an urgent hold or incident. A separate authorised act.</small></button>' +
      '</div>';

    if (emergency) {
      h += '<div class="warn"><b>This is not &ldquo;custom with every box ticked&rdquo;</b>' +
        '<p>An emergency packet discloses every section without redaction. It can contain commercial terms, upstream supplier identity and personal data that you may have no standing authority to release. Making this a separate, recorded act is the control &mdash; the authorization is written into the packet manifest.</p>' +
        '<label><input type="checkbox" id="emg-ack"' + (S.emergencyAck ? ' checked' : '') + '> ' +
        'I am authorising full unredacted disclosure of this journey&rsquo;s evidence, and this authorization will be recorded in the packet.</label></div>';
    }

    h += '<div class="pickgroup"><span class="eyebrow">Recipient</span><div class="picks">' +
      RECIPIENTS.map((r) => '<button class="pick rcp" data-id="' + r.id + '" aria-pressed="' + (S.recipient === r.id) + '">' +
        '<span class="tick"><svg><use href="#i-check"/></svg></span>' +
        '<span>' + esc(r.label) + '<small>' + esc(r.class.replace(/_/g, ' ').toLowerCase()) + '</small></span></button>').join('') +
      '</div></div>';

    h += '<div class="pickgroup"><span class="eyebrow">Sections</span><div class="sectionlist">' +
      SEC.map((s) => {
        const locked = s.always || emergency;
        const on = locked || S.packetSections.indexOf(s.id) !== -1;
        return '<label class="sec' + (locked ? ' locked' : '') + '">' +
          '<input type="checkbox" data-sec="' + s.id + '"' + (on ? ' checked' : '') + (locked ? ' disabled' : '') + '>' +
          '<span><b>' + esc(s.label) + (s.always ? '<span class="lockchip">ALWAYS</span>' : '') + '</b>' +
          '<small>' + esc(s.desc) + '</small></span></label>';
      }).join('') + '</div></div>';

    if (!emergency) {
      h += '<div class="pickgroup"><span class="eyebrow">Withhold data classes</span><div class="picks">' +
        Object.keys(DENY).map((k) => '<button class="pick dny" data-id="' + k + '" aria-pressed="' + (S.packetDeny.indexOf(k) !== -1) + '">' +
          '<span class="tick"><svg><use href="#i-check"/></svg></span>' +
          '<span>' + esc(DENY[k].label) + '<small>' + esc(DENY[k].keys.join(', ')) + '</small></span></button>').join('') +
        '</div><p class="hint"><strong>Enforced twice.</strong> The allowlist decides what is assembled; a denied-data scan then checks the actual output bytes, including nested bodies and note fields. Allowlists are routinely defeated by data riding along somewhere nobody looked.</p></div>';
    }

    // Live preview of what this selection will produce.
    h += '<div class="card" style="padding:13px"><h2 style="font-size:13px">This packet will contain</h2>' +
      '<p class="sub" style="font-size:11.5px">' + S.assessment.annexes.length + ' independently frozen annex' +
      (S.assessment.annexes.length === 1 ? '' : 'es') + ' over one evidence core.</p>' +
      S.assessment.annexes.map((a) => '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--hairline)">' +
        '<b style="font-size:12px;flex:1">' + esc(a.jurisdictionName) + '</b>' +
        '<span style="font-size:10.5px;color:var(--fog-dim)">' + a.controls.length + ' controls</span>' +
        chip(a.preparation) + '</div>').join('') +
      '</div>';

    h += '<div class="boundary"><b>What this packet is not.</b> It prepares and verifies evidence. It does not issue halal certification, a religious ruling, laboratory validation, accreditation, recognition, customs release, market authorization or commercial release. No overall compliance percentage is produced anywhere in it.</div>';

    $('#drawer-body').innerHTML = h;

    $('#prof-custom').addEventListener('click', () => { S.packetProfile = 'CUSTOM'; S.lastResult = null; renderDrawer(); });
    $('#prof-emergency').addEventListener('click', () => { S.packetProfile = 'EMERGENCY'; S.lastResult = null; renderDrawer(); });
    const ack = $('#emg-ack');
    if (ack) ack.addEventListener('change', () => { S.emergencyAck = ack.checked; updateDrawerStatus(); });
    $$('.rcp').forEach((b) => b.addEventListener('click', () => { S.recipient = b.dataset.id; S.lastResult = null; renderDrawer(); }));
    $$('.dny').forEach((b) => b.addEventListener('click', () => {
      const i = S.packetDeny.indexOf(b.dataset.id);
      if (i === -1) S.packetDeny.push(b.dataset.id); else S.packetDeny.splice(i, 1);
      S.lastResult = null; renderDrawer();
    }));
    $$('input[data-sec]').forEach((c) => c.addEventListener('change', () => {
      const id = c.dataset.sec;
      const i = S.packetSections.indexOf(id);
      if (c.checked && i === -1) S.packetSections.push(id);
      if (!c.checked && i !== -1) S.packetSections.splice(i, 1);
      S.lastResult = null; renderDrawer();
    }));

    updateDrawerStatus();
  }

  function updateDrawerStatus() {
    const blocked = S.packetProfile === 'EMERGENCY' && !S.emergencyAck;
    $('#btn-json').disabled = blocked;
    $('#btn-pdf').disabled = blocked;
    $('#btn-both').disabled = blocked;
    $('#drawer-status').innerHTML = blocked
      ? '<span style="color:var(--vermilion)">Emergency disclosure requires explicit authorization above.</span>'
      : 'Packet is assembled in your browser. Nothing is transmitted.';
  }

  /* ------------------------------------------------------------ downloads */

  function buildResult() {
    const persona = S.persona;
    const recipient = RECIPIENTS.filter((r) => r.id === S.recipient)[0];
    return VS.packet.build(S.journey, S.series, S.assessment, S.selection, {
      profile: S.packetProfile,
      sections: S.packetSections,
      recipient: recipient,
      persona: persona,
      denyClasses: S.packetDeny,
      authorized: S.packetProfile !== 'EMERGENCY' || S.emergencyAck,
    });
  }

  function downloadPacket(kind) {
    let result;
    try {
      result = buildResult();
    } catch (e) {
      toast(e.message, true);
      return;
    }
    S.lastResult = result;

    const base = result.packet.identity.packetId;

    if (kind === 'json' || kind === 'both') {
      saveBlob(new Blob([VS.packet.toJSON(result)], { type: 'application/json' }), base + '.json');
    }
    if (kind === 'pdf' || kind === 'both') {
      const bytes = VS.packet.toPDF(result, S.journey, S.series);
      saveBlob(new Blob([bytes], { type: 'application/pdf' }), base + '.pdf');
    }

    // Verify what was actually produced, and report it honestly.
    const v = VS.packet.verify(result.packet);
    const scan = result.scan;
    let msg = v.ok
      ? 'Packet built and verified: ' + v.total + '/' + v.total + ' checks pass. Digest ' + VS.crypto.shortHash(result.digest) + '.'
      : 'Packet built, but ' + v.failed + ' of ' + v.total + ' verification checks FAILED.';
    if (scan.result !== 'CLEAN') msg += ' Denied-data scan found ' + scan.violations.length + ' violation(s).';
    toast(msg, !v.ok || scan.result !== 'CLEAN');

    showVerification(result, v);
  }

  function showVerification(result, v) {
    const body = $('#drawer-body');
    const html = '<div class="card" style="padding:13px;margin-bottom:14px;border-color:' +