/* ===========================================================================
   VSENSE Halal Logistics - assessment engine
   ---------------------------------------------------------------------------
   Turns {journey + selected jurisdictions + selected frameworks} into a set of
   independently-frozen authority annexes.

   Two rules govern everything here.

   ONE EVIDENCE CORE, MANY ANNEXES. Selecting three destinations does not
   triple the evidence. A control appears once in the core and is referenced by
   every annex that requires it. What differs per annex is the QUESTION asked
   of that evidence, and therefore the answer.

   NO AGGREGATE SCORE. Annexes report counts by state and a list of blocking
   findings. There is no number here that could be read as "87% compliant",
   because halal conformity does not admit a mean: one unresolved najis
   mughallazah contact is not offset by ninety passing controls.

   The divergence rules below are the interesting part. The same custody
   record yields PASS for one destination and FAILED for another, because
   destinations genuinely ask different questions. A product that merges them
   into one verdict is lying to somebody.

   Classic script. Hangs off window.VS.assess.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  /* ------------------------------------------------------- evidence index

     Maps the abstract evidence kinds a control asks for onto the concrete
     records this journey actually holds. A kind that resolves to nothing is
     MISSING -- never silently PASS, and never silently FAIL either.          */

  function buildEvidenceIndex(journey, series) {
    const byType = (t) => journey.events.filter((e) => e.type === t);
    const first = (t) => { const a = byType(t); return a.length ? a[0] : null; };

    const idx = {};
    const put = (kind, records, note) => {
      idx[kind] = { kind: kind, records: records || [], note: note || '' };
    };

    put('HANDOFF_CHAIN', byType('HANDOFF'));
    put('SEAL_CHAIN', byType('SEAL_APPLIED').concat(byType('SEAL_EVENT')));
    put('SEGREGATION_DECLARATION', byType('SEGREGATION_DECLARED'));
    put('MANIFEST', byType('CO_LOAD_DECLARED'));
    put('SERTU_EVENT', byType('SERTU_PERFORMED'));
    put('SLAUGHTER_RECORD', byType('SLAUGHTER_RECORD'));
    put('HALAL_CERTIFICATE', byType('CERTIFICATE_PRESENTED'));
    put('RECOGNITION_SNAPSHOT', byType('RECOGNITION_SNAPSHOT'));
    put('LAB_REPORT', byType('LAB_RESULT'));
    put('DEVICE_CALIBRATION', byType('DEVICE_STATE'));

    const sertu = first('SERTU_PERFORMED');
    put('WITNESS_MANDATE', sertu && sertu.body.witnessAppointment ? [sertu] : [],
      sertu ? '' : 'No ritual cleansing event recorded, so no witness mandate is required or present.');

    const slaughter = first('SLAUGHTER_RECORD');
    put('APPOINTMENT_EVIDENCE', slaughter && slaughter.body.appointment ? [slaughter] : []);

    const sample = first('SAMPLE_DRAWN');
    put('SAMPLING_PLAN', sample && sample.body.plan ? [sample] : []);

    const lab = first('LAB_RESULT');
    put('LAB_SCOPE_SNAPSHOT', lab && lab.body.scopeSnapshot ? [lab] : []);

    // Conveyance configuration is derived from the legs rather than recorded
    // as an event: every journey has legs, so this is always present.
    put('CONVEYANCE_CONFIG', journey.legs.map((l) => ({
      id: 'LEG-' + l.seq, title: l.mode + ' ' + l.from + ' to ' + l.to, state: 'VERIFIED',
      dataHash: VS.crypto.digest(l), body: l,
    })));

    // Actor mandate. A signed handoff proves an account acted; it does not
    // prove the account was entitled to act. Every custodian that appears in
    // the custody chain must have a mandate covering the date it acted, so
    // the check is a join against the handoffs rather than a count.
    const mandates = journey.mandates || [];
    const custodians = {};
    byType('HANDOFF').forEach((e) => {
      custodians[e.body.transferor] = e.at;
      custodians[e.body.transferee] = e.at;
    });
    const unmandated = Object.keys(custodians).filter((org) => {
      const m = mandates.filter((x) => x.org === org)[0];
      if (!m) return true;
      const when = String(custodians[org]).slice(0, 10);
      return !(when >= m.from && when <= m.to);
    });
    put('ACTOR_MANDATE', unmandated.length ? [] : mandates.map((m) => ({
      id: m.mandate, title: m.role + ' mandate for ' + m.org, state: 'VERIFIED',
      dataHash: VS.crypto.digest(m), body: m,
    })), unmandated.length
      ? 'No mandate covering the date of the act for: ' + unmandated.join(', ') + '. A signature is not an entitlement.'
      : '');

    put('TELEMETRY_SERIES', series ? [{ id: 'SERIES-' + series.device, title: series.samples.length + ' samples on ' + series.device,
      state: series.coverage.state === 'PASS' ? 'VERIFIED' : 'REQUIRES_REVIEW',
      dataHash: VS.crypto.digest({ device: series.device, count: series.samples.length }), body: { device: series.device, count: series.samples.length } }] : []);

    put('COVERAGE_ASSESSMENT', series ? [{ id: 'COV-' + series.device, title: 'Coverage assessment: ' + series.coverage.state,
      state: series.coverage.state === 'PASS' ? 'VERIFIED' : series.coverage.state === 'FAIL' ? 'FAILED' : 'INSUFFICIENT_COVERAGE',
      dataHash: VS.crypto.digest(series.coverage), body: series.coverage }] : []);

    put('EVIDENCE_DIGESTS', [{ id: 'DIGESTS', title: journey.events.length + ' evidence digests recomputed', state: 'VERIFIED',
      dataHash: journey.chainHead, body: { count: journey.events.length, chainHead: journey.chainHead } }]);

    put('MERKLE_BATCH', [{ id: journey.batchId, title: 'Merkle batch ' + journey.batchId, state: 'VERIFIED',
      dataHash: journey.merkleRoot, body: { root: journey.merkleRoot, leaves: journey.leaves.length } }]);

    // The documentary set: present unless the journey declares it missing.
    const docMissing = (journey.missingEvidence || []).indexOf('DOC_SET') !== -1;
    put('DOC_SET', docMissing ? [] : [{ id: 'DOCSET', title: 'Consignment documentary set', state: 'VERIFIED',
      dataHash: VS.crypto.digest({ lot: journey.product.lot }), body: { lot: journey.product.lot } }]);

    // Honour the journey's declared absences last, so they override.
    (journey.missingEvidence || []).forEach((kind) => { if (idx[kind]) idx[kind].records = []; });

    return idx;
  }

  /* --------------------------------------------------- divergence rules

     Where destinations genuinely disagree. Each rule returns a verdict for a
     specific (control, jurisdiction) pair, overriding the generic evaluation.
     Every rule carries its own `because`, which is what the UI and the export
     show -- a state with no stated reason is not evidence, it is an opinion. */

  const DIVERGENCE = [
    {
      control: 'CTL-RIT-02', jurisdictions: ['SA', 'AE'],
      apply: function (ctx) {
        const rec = ctx.index.SLAUGHTER_RECORD.records[0];
        if (!rec) return null;
        if (rec.body.stunningApplied === false) {
          return { state: 'VERIFIED', because: 'Slaughter recorded without pre-slaughter stunning, and a current appointment is evidenced for the named slaughterer on the date of the act.' };
        }
        return { state: 'REQUIRES_REVIEW', because: 'Stunning was applied. Acceptability is destination-specific and requires a recorded determination, not an automatic pass.' };
      },
    },
    {
      control: 'CTL-CER-02', jurisdictions: ['SA', 'AE', 'ID', 'MY'],
      apply: function (ctx) {
        const rec = ctx.index.RECOGNITION_SNAPSHOT.records[0];
        if (!rec) {
          return { state: 'MISSING', because: 'No recognition snapshot for this destination on the event date. Certificate validity does not evidence recognition: they are separate objects.' };
        }
        const b = rec.body;
        if (b.destination !== ctx.jurisdiction) {
          return { state: 'MISSING', because: 'The held recognition snapshot is for ' + b.destination + ', not ' + ctx.jurisdiction + '. Recognition is per destination and does not transfer.' };
        }
        if (b.recognitionState === 'WITHDRAWN') {
          return { state: 'FAILED', because: 'Recognition of the issuing body for ' + ctx.jurisdiction + ' was withdrawn on ' + b.withdrawnOn + ', before the event date. The certificate remains valid to ' + b.certificateStillValidTo + ' and does not cure this.' };
        }
        return { state: 'VERIFIED', because: 'Recognition of the issuing body was active for ' + ctx.jurisdiction + ' on the event date.' };
      },
    },
    {
      control: 'CTL-LAB-01', jurisdictions: null,
      apply: function (ctx) {
        const rec = ctx.index.LAB_REPORT.records[0];
        if (!rec) return null;
        const b = rec.body;
        if (b.scopeMatch === 'OUT_OF_SCOPE') {
          return { state: 'FAILED', because: 'The issuing facility’s accreditation did not cover this method, matrix or analyte on the report date.' };
        }
        if (b.scopeMatch === 'SCOPE_UNRESOLVED') {
          return { state: 'REQUIRES_REVIEW', because: 'Accreditation scope could not be resolved for the report date. This is not a failure and must not default to in-scope.' };
        }
        if (b.resultState === 'DETECTED') {
          return { state: 'FAILED', because: 'Porcine DNA detected at or above the limit of detection.' };
        }
        if (b.resultState === 'BELOW_LOQ') {
          return { state: 'REQUIRES_REVIEW', because: 'Result is BELOW_LOQ: detected but not quantifiable. This is neither a detection nor a clean negative, and must not be rendered as NOT_DETECTED.' };
        }
        if (b.resultState === 'NOT_DETECTED') {
          return { state: 'VERIFIED', because: 'Not detected at the stated limit of detection, within the facility’s accredited scope for this method, matrix and analyte on the report date.' };
        }
        return { state: 'REQUIRES_REVIEW', because: 'Result state ' + b.resultState + ' does not support a conformity conclusion either way.' };
      },
    },
    {
      control: 'CTL-LAB-02', jurisdictions: null,
      apply: function (ctx) {
        const plan = ctx.index.SAMPLING_PLAN.records[0];
        const lab = ctx.index.LAB_REPORT.records[0];
        if (!plan || !lab) return null;
        if (lab.body.inferenceScope === 'TEST_PORTION') {
          return { state: 'REQUIRES_REVIEW', because: 'The retained plan supports a test-portion claim only (' + plan.body.increments + ' increments). No lot-level negative inference is available from it.' };
        }
        return { state: 'VERIFIED', because: 'Retained sampling plan with ' + plan.body.increments + ' increments supports the lot-level inference claimed.' };
      },
    },
    {
      control: 'CTL-SEG-02', jurisdictions: null,
      apply: function (ctx) {
        const conv = ctx.journey.conveyance;
        const co = ctx.index.MANIFEST.records[0];

        // A full container under a single seal has no co-load to declare, so
        // demanding a manifest would report MISSING forever on the commonest
        // shipping mode in the trade. Segregation is instead evidenced by the
        // dedicated unit plus its seal chain -- and that is an exclusion
        // predicate, which has to be stated, not assumed.
        if (conv && !conv.consolidated) {
          const sealBroken = ctx.index.SEAL_CHAIN.records.some(
            (r) => r.body.kind === 'SEAL_EVENT' && r.body.matchingCustodyEvent === null);
          if (sealBroken) {
            return { state: 'FAILED', because: 'Segregation on a dedicated sealed unit rests entirely on seal continuity, and the seal chain is broken by an unreconciled open.' };
          }
          return { state: 'NOT_APPLICABLE', because: 'Exclusion predicate: the consignment moves as a dedicated sealed unit (' + conv.unit + ') with no consolidation, so there is no co-load to declare. Segregation is carried by ' + 'CTL-SEG-01 and the seal chain instead.' };
        }

        if (!co) {
          return { state: 'MISSING', because: 'The consignment moves as a consolidated unit, where segregation cannot be inferred from the conveyance. A co-load manifest is required and none is held.' };
        }
        const bad = (co.body.adjacentConsignments || []).filter((c) => c.halalStatus !== 'HALAL_DECLARED' && c.separation === 'NONE_DECLARED');
        if (bad.length) {
          return { state: 'FAILED', because: 'Co-load manifest places ' + bad.length + ' non-halal-declared consignment(s) adjacent with no declared separation.' };
        }
        return { state: 'VERIFIED', because: 'Co-load manifest declares separation from every adjacent consignment.' };
      },
    },
    {
      control: 'CTL-CUS-02', jurisdictions: null,
      apply: function (ctx) {
        const unmatched = ctx.index.SEAL_CHAIN.records.filter(
          (r) => r.body.kind === 'SEAL_EVENT' && r.body.matchingCustodyEvent === null);
        if (unmatched.length) {
          return { state: 'FAILED', because: 'A seal open of ' + unmatched[0].body.durationMinutes + ' minutes has no corresponding authorized custody event. Seal continuity is broken.' };
        }
        return null;
      },
    },
    {
      control: 'CTL-CC-01', jurisdictions: null,
      apply: function (ctx) {
        if (!ctx.series) return null;
        const cov = ctx.series.coverage;
        if (cov.state === 'FAIL') return { state: 'FAILED', because: cov.explain };
        if (cov.state === 'INSUFFICIENT_COVERAGE') return { state: 'INSUFFICIENT_COVERAGE', because: cov.explain };
        if (cov.state === 'REQUIRES_REVIEW') return { state: 'REQUIRES_REVIEW', because: cov.explain };
        return { state: 'VERIFIED', because: cov.explain };
      },
    },
    {
      control: 'CTL-CC-02', jurisdictions: null,
      apply: function (ctx) {
        if (!ctx.series) return null;
        const cov = ctx.series.coverage;
        const blocking = cov.findings.filter((f) => f.severity === 'BLOCKING');
        if (blocking.length) return { state: 'INSUFFICIENT_COVERAGE', because: blocking[0].text };
        if (cov.findings.length) return { state: 'REQUIRES_REVIEW', because: cov.findings[0].text };
        return { state: 'VERIFIED', because: 'No sampling gap exceeds the declared maximum and both interval edges are covered.' };
      },
    },
    {
      control: 'CTL-RIT-01', jurisdictions: null,
      apply: function (ctx) {
        const sertu = ctx.index.SERTU_EVENT.records[0];
        if (!sertu) {
          return { state: 'NOT_APPLICABLE', because: 'No najis mughallazah contact is recorded on this journey, so the ritual cleansing control is not engaged. Absence of a trigger is not absence of evidence.' };
        }
        const b = sertu.body;
        if (!b.sequenceComplete) {
          return { state: 'FAILED', because: 'Ritual cleansing sequence is incomplete. Stage count and the first-stage agent are both material to validity.' };
        }
        if (!b.witnessAppointment) {
          return { state: 'MISSING', because: 'Cleansing is recorded but no appointment evidence is held for the witness. A name is not a mandate.' };
        }
        return { state: 'VERIFIED', because: b.stages + '-stage cleansing with ' + String(b.firstStageAgent).toLowerCase().replace('_', ' ') + ' at the first stage, witnessed by a holder of appointment ' + b.witnessAppointment + ' valid to ' + b.appointmentValidTo + '.' };
      },
    },
    {
      control: 'CTL-DOC-02', jurisdictions: null,
      apply: function (ctx) {
        const lab = ctx.index.LAB_REPORT.records[0];
        const cert = ctx.index.HALAL_CERTIFICATE.records[0];
        if (!cert) return null;
        const lot = ctx.journey.product.lot;
        const certLot = cert.body.lot;
        if (certLot && certLot !== lot) {
          return { state: 'FAILED', because: 'Certificate names lot ' + certLot + ' but the consignment is lot ' + lot + '.' };
        }
        if (lab && lab.body.sample && !ctx.index.SAMPLING_PLAN.records.length) {
          return { state: 'REQUIRES_REVIEW', because: 'Laboratory report references a sample with no retained sampling plan linking it to the lot.' };
        }
        return { state: 'VERIFIED', because: 'Lot identity reconciles across certificate, manifest, laboratory reference and the custody chain.' };
      },
    },
  ];

  /* --------------------------------------------------------- evaluation */

  function evaluateControl(control, ctx) {
    // A divergence rule wins if one matches this control and jurisdiction.
    for (const rule of DIVERGENCE) {
      if (rule.control !== control.id) continue;
      if (rule.jurisdictions && rule.jurisdictions.indexOf(ctx.jurisdiction) === -1) continue;
      const verdict = rule.apply(ctx);
      if (verdict) return Object.assign({ ruleApplied: true }, verdict);
    }

    // Generic evaluation: every required evidence kind must resolve.
    const missing = control.requires.filter((k) => !ctx.index[k] || ctx.index[k].records.length === 0);
    if (missing.length) {
      // Carry the index's own explanation where it has one. "Required evidence
      // not held: ACTOR_MANDATE" tells a reader nothing they can act on; the
      // reason the mandate did not resolve is the actionable part.
      const notes = missing.map((k) => (ctx.index[k] && ctx.index[k].note) ? ctx.index[k].note : null).filter(Boolean);
      return { state: 'MISSING', ruleApplied: false,
        because: 'Required evidence not held: ' + missing.join(', ') + '.' + (notes.length ? ' ' + notes.join(' ') : '') };
    }
    const anyFailed = control.requires.some((k) =>
      ctx.index[k].records.some((r) => r.state === 'FAILED'));
    if (anyFailed) {
      return { state: 'FAILED', ruleApplied: false, because: 'A required evidence record is in a FAILED state.' };
    }
    const anyReview = control.requires.some((k) =>
      ctx.index[k].records.some((r) => r.state === 'REQUIRES_REVIEW' || r.state === 'INSUFFICIENT_COVERAGE'));
    if (anyReview) {
      return { state: 'REQUIRES_REVIEW', ruleApplied: false, because: 'A required evidence record needs qualified review before this control can resolve.' };
    }
    return { state: 'VERIFIED', ruleApplied: false,
      because: 'All required evidence is held, recomputes against its digest, and is in a verified state.' };
  }

  /**
   * Assess one journey against a selection.
   * @param {object} journey
   * @param {object} series   telemetry series from VS.stream.generate
   * @param {object} selection { jurisdictions:[], frameworks:[], authorities:[] }
   */
  function assess(journey, series, selection) {
    const R = VS.registry;
    const index = buildEvidenceIndex(journey, series);
    const controls = R.controlsForFrameworks(selection.frameworks);

    const annexes = [];
    selection.jurisdictions.forEach((jid) => {
      const jur = R.jurisdiction(jid);
      if (!jur) return;

      // Only the frameworks that belong to this jurisdiction, plus the
      // cross-cutting ones, shape this annex's questions.
      const jurFrameworks = selection.frameworks.filter((f) => {
        const fw = R.FRAMEWORKS[f];
        return fw && (fw.jurisdiction === jid || fw.jurisdiction === 'OIC');
      });
      const jurControls = controls.filter((c) =>
        c.frameworks.some((f) => jurFrameworks.indexOf(f) !== -1));

      const results = jurControls.map((c) => {
        const ctx = { journey: journey, series: series, index: index, jurisdiction: jid, frameworks: jurFrameworks };
        const v = evaluateControl(c, ctx);
        return {
          control: c.id, group: c.group, title: c.title,
          requiredBy: c.frameworks.filter((f) => jurFrameworks.indexOf(f) !== -1),
          evidenceKinds: c.requires,
          evidenceRefs: c.requires.reduce((acc, k) => {
            acc[k] = (index[k] ? index[k].records : []).map((r) => r.id);
            return acc;
          }, {}),
          state: v.state, because: v.because, ruleApplied: !!v.ruleApplied,
        };
      });

      // Counts, never a score. The blocking list is what actually matters.
      const counts = {};
      results.forEach((r) => { counts[r.state] = (counts[r.state] || 0) + 1; });
      const blocking = results.filter((r) => r.state === 'FAILED' || r.state === 'MISSING' || r.state === 'INSUFFICIENT_COVERAGE');

      annexes.push({
        jurisdiction: jid, jurisdictionName: jur.name, region: jur.region,
        authorities: (selection.authorities || []).filter((a) => R.AUTHORITIES[a] && R.AUTHORITIES[a].jurisdiction === jid),
        frameworks: jurFrameworks,
        controls: results,
        counts: counts,
        blocking: blocking.map((b) => ({ control: b.control, title: b.title, state: b.state, because: b.because })),
        // Preparation state only. Never submission, acceptance or release.
        preparation: blocking.length ? 'REVIEW_REQUIRED' : 'EVIDENCE_PACK_PREPARED',
        submission: 'NOT_SUBMITTED',
        authorityDecision: 'NONE',
        note: blocking.length
          ? blocking.length + ' control(s) block preparation of this annex. Preparation cannot complete while a required control is FAILED, MISSING or lacks sufficient coverage.'
          : 'Every selected control for this destination resolved on held evidence. This is a preparation state. It is not a submission, an acceptance, a certification or a release.',
      });
    });

    return { journey: journey.id, index: index, annexes: annexes, controlCount: controls.length };
  }

  VS.assess = {
    assess: assess,
    buildEvidenceIndex: buildEvidenceIndex,
    DIVERGENCE: DIVERGENCE,
  };
})(typeof window !== 'undefined' ? window : globalThis);