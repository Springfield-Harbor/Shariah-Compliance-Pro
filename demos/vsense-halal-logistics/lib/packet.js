/* ===========================================================================
   VSENSE Halal Logistics - audit packet builder
   ---------------------------------------------------------------------------
   Assembles a disclosable evidence packet, in two profiles:

     CUSTOM    - the operator picks sections and a recipient. A redaction
                 allowlist applies. This is the normal path.
     EMERGENCY - everything, unredacted, for an urgent hold or an incident.
                 It is a SEPARATE disclosure profile requiring its own
                 authorization, not "custom with every box ticked". The
                 difference matters: an emergency pack can contain commercial
                 terms, upstream supplier identity and personal data that the
                 operator has no standing authority to disclose. Making it a
                 distinct, authorised act is the control.

   Redaction is enforced twice. The allowlist decides what is assembled; the
   denied-data scan then checks the ACTUAL OUTPUT BYTES for anything on the
   deny list. Allowlists are routinely defeated by data that rides along in a
   nested object, a note field or a label, so checking the bytes that leave is
   the only check that means anything.

   Classic script. Hangs off window.VS.packet.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  const SECTIONS = [
    { id: 'identity', label: 'Packet identity and state', always: true,
      desc: 'Packet and revision ids, environment, preparation state, and the explicit separation of preparation from submission and outcome.' },
    { id: 'product', label: 'Product, lot and quantities', always: false,
      desc: 'Product category, lot identity, quantity and packaging.' },
    { id: 'corridor', label: 'Corridor and jurisdiction selection', always: true,
      desc: 'Origin, transit, destination and the role each jurisdiction plays on this journey.' },
    { id: 'annexes', label: 'Authority annexes and control results', always: true,
      desc: 'One independently frozen annex per destination, with per-control states and reasons.' },
    { id: 'custody', label: 'Chain of custody and handoffs', always: false,
      desc: 'Every custody event, its hash link, and the two-step handoff record.' },
    { id: 'telemetry', label: 'Telemetry and coverage assessment', always: false,
      desc: 'Series summary, coverage predicate result and every gap or anomaly finding.' },
    { id: 'laboratory', label: 'Laboratory results and scope', always: false,
      desc: 'Result states, limits, QC controls, accreditation scope match and sampling inference scope.' },
    { id: 'certificates', label: 'Certificates and recognition history', always: false,
      desc: 'Certificate events and, separately, recognition events. These never propagate to one another.' },
    { id: 'exceptions', label: 'Exceptions and CAPA', always: false,
      desc: 'Open and closed findings. Closure never deletes a finding.' },
    { id: 'separation', label: 'Separation lattice', always: true,
      desc: 'The eleven distinct objects and what may not be inferred from each.' },
    { id: 'proof', label: 'Proof material and verification instructions', always: true,
      desc: 'Digests, Merkle root, inclusion proofs, chain head and the steps to reproduce them offline.' },
    { id: 'limitations', label: 'Limitations and boundary', always: true,
      desc: 'What this packet is not. Always present, never redactable.' },
  ];

  // Field names whose values must never reach a recipient outside the
  // authorized scope. Checked against output bytes, not against intent.
  const DENY_CLASSES = {
    COMMERCIAL: { label: 'Commercial terms', keys: ['unitPrice', 'contractValue', 'margin', 'incoterm', 'buyerRef'] },
    UPSTREAM_IDENTITY: { label: 'Upstream supplier identity', keys: ['upstreamSupplier', 'supplierName', 'sourceFarm'] },
    PERSONAL: { label: 'Personal data', keys: ['operatorName', 'driverName', 'passportNo', 'personalEmail'] },
  };

  /* ------------------------------------------------------------- building */

  /**
   * @param {object} opts
   *   profile      'CUSTOM' | 'EMERGENCY'
   *   sections     array of section ids (ignored for EMERGENCY: all included)
   *   recipient    { id, label, class }
   *   persona      persona object, for the mandate record
   *   denyClasses  array of DENY_CLASSES keys to withhold (CUSTOM only)
   *   authorized   boolean - EMERGENCY requires explicit true
   */
  function build(journey, series, assessment, selection, opts) {
    const C = VS.crypto;
    const R = VS.registry;
    const emergency = opts.profile === 'EMERGENCY';

    if (emergency && !opts.authorized) {
      throw new Error('An emergency packet requires explicit separate authorization.');
    }

    const included = emergency
      ? SECTIONS.map((s) => s.id)
      : SECTIONS.filter((s) => s.always || (opts.sections || []).indexOf(s.id) !== -1).map((s) => s.id);

    const denied = emergency ? [] : (opts.denyClasses || []);
    const has = (id) => included.indexOf(id) !== -1;

    // ---- the packet body. Key order is irrelevant: VS-JCS-1 sorts it.
    const packet = {};

    packet.identity = {
      packetId: 'VS-AP-' + journey.id + '-' + (emergency ? 'EMG' : 'CUS') + '-001',
      revision: 1,
      environment: 'DEMO',
      synthetic: true,
      generatorProfile: 'VSENSE-HALAL-V7',
      disclosureProfile: emergency ? 'EMERGENCY_FULL_DISCLOSURE' : 'CUSTOM_SCOPED_DISCLOSURE',
      emergencyAuthorization: emergency
        ? { authorized: true, basis: 'OPERATOR_DECLARED_URGENT_DISCLOSURE', note: 'Recorded as a separate authorised act, distinct from routine packet preparation.' }
        : null,
      packetOwner: { persona: opts.persona ? opts.persona.id : null, role: opts.persona ? opts.persona.name : null, mandate: opts.persona ? opts.persona.mandate : null },
      preparation: assessment.annexes.some((a) => a.preparation === 'REVIEW_REQUIRED') ? 'REVIEW_REQUIRED' : 'EVIDENCE_PACK_PREPARED',
      submission: 'NOT_SUBMITTED',
      externalOutcome: 'NONE',
      commercialDisposition: 'HOLD',
      asOf: journey.events[journey.events.length - 1].at,
      canonicalProfile: C.PROFILES.canonical,
      merkleProfile: C.PROFILES.merkle,
      chainProfile: C.PROFILES.chain,
      hashProfile: C.PROFILES.hash,
    };

    if (has('product')) {
      packet.product = {
        sku: journey.product.sku, category: journey.product.category,
        lot: journey.product.lot, quantity: journey.product.quantity,
        unit: journey.product.unit, packaging: journey.product.packaging,
        description: journey.product.description,
      };
    }

    packet.corridor = {
      journeyId: journey.id, title: journey.title,
      origin: { jurisdiction: journey.origin.jurisdiction, place: journey.origin.place, facility: journey.origin.facility, role: 'ORIGIN' },
      transit: journey.transit.map((t) => ({ jurisdiction: t, role: 'TRANSIT' })),
      destination: { jurisdiction: journey.destination.jurisdiction, place: journey.destination.place, facility: journey.destination.facility, role: 'DESTINATION' },
      selectedJurisdictions: selection.jurisdictions.map((j) => {
        const jur = R.jurisdiction(j);
        return { id: j, name: jur ? jur.name : j, region: jur ? jur.region : null,
          role: j === journey.origin.jurisdiction ? 'ORIGIN'
            : j === journey.destination.jurisdiction ? 'DESTINATION'
              : journey.transit.indexOf(j) !== -1 ? 'TRANSIT' : 'ASSESSED_DESTINATION' };
      }),
      selectedFrameworks: selection.frameworks.map((f) => ({
        id: f, name: R.FRAMEWORKS[f] ? R.FRAMEWORKS[f].name : f,
        family: R.FRAMEWORKS[f] ? R.FRAMEWORKS[f].family : null,
        verificationStatus: R.FRAMEWORKS[f] ? R.FRAMEWORKS[f].status : 'UNVERIFIED',
      })),
      legs: journey.legs.map((l) => ({ seq: l.seq, mode: l.mode, from: l.from, to: l.to,
        custodian: l.custodian, asset: l.asset, depart: l.depart, arrive: l.arrive })),
    };

    packet.annexes = assessment.annexes.map((a) => ({
      jurisdiction: a.jurisdiction, jurisdictionName: a.jurisdictionName, region: a.region,
      authorities: a.authorities.map((x) => ({ id: x, name: R.AUTHORITIES[x] ? R.AUTHORITIES[x].name : x, kind: R.AUTHORITIES[x] ? R.AUTHORITIES[x].kind : null })),
      frameworks: a.frameworks,
      preparation: a.preparation, submission: a.submission, authorityDecision: a.authorityDecision,
      stateCounts: a.counts,
      blocking: a.blocking,
      controls: a.controls.map((c) => ({ control: c.control, group: c.group, title: c.title,
        state: c.state, because: c.because, requiredBy: c.requiredBy, evidenceRefs: c.evidenceRefs })),
      note: a.note,
    }));

    if (has('custody')) {
      packet.custody = {
        chainProfile: C.PROFILES.chain,
        chainHead: journey.chainHead,
        events: journey.events.map((e) => ({
          id: e.id, seq: e.seq, at: e.at, type: e.type, stage: e.stage, actor: e.actor,
          title: e.title, state: e.state, dataHash: e.dataHash, eventHash: e.eventHash, prevHash: e.prevHash,
          body: redactBody(e.body, denied),
        })),
      };
    }

    if (has('telemetry') && series) {
      packet.telemetry = {
        device: series.device,
        sampleCount: series.samples.length,
        channels: series.channels.map((c) => ({ key: c.key, label: c.label, unit: c.unit, role: c.role })),
        declaredProfile: series.profile,
        coverage: series.coverage,
        anomalies: series.events,
        note: 'Values are assessed on the product-core (pulp) channel. Supply-air defrost peaks are exempt by the declared profile; counting them would raise a false excursion roughly every eight hours.',
      };
    }

    if (has('laboratory')) {
      const labs = journey.events.filter((e) => e.type === 'LAB_RESULT');
      const samples = journey.events.filter((e) => e.type === 'SAMPLE_DRAWN');
      packet.laboratory = {
        resultStateVocabulary: R.LAB_RESULT_STATE,
        reports: labs.map((e) => ({ id: e.id, at: e.at, dataHash: e.dataHash, body: e.body })),
        sampling: samples.map((e) => ({ id: e.id, at: e.at, dataHash: e.dataHash, body: e.body })),
        note: 'Run QC PASS is not product PASS. Scope match is facility, method, matrix, analyte and date. A negative result carries only the inference its retained sampling plan supports.',
      };
    }

    if (has('certificates')) {
      packet.certificates = {
        certificateEvents: journey.events.filter((e) => e.type === 'CERTIFICATE_PRESENTED')
          .map((e) => ({ id: e.id, at: e.at, dataHash: e.dataHash, body: e.body })),
        recognitionEvents: journey.events.filter((e) => e.type === 'RECOGNITION_SNAPSHOT')
          .map((e) => ({ id: e.id, at: e.at, dataHash: e.dataHash, body: e.body })),
        note: 'Certificate and recognition maintain separate histories. A valid certificate does not evidence recognition, and withdrawal of recognition does not invalidate the certificate.',
      };
    }

    if (has('exceptions')) {
      packet.exceptions = journey.events.filter((e) => e.type === 'EXCEPTION_RAISED')
        .map((e) => ({ id: e.id, at: e.at, dataHash: e.dataHash, body: e.body, status: 'OPEN' }));
    }

    packet.separationLattice = R.SEPARATION_LATTICE.map((s) => ({
      object: s.id, label: s.label, holder: s.holder, states: s.states, mustNotBeInferred: s.notImplied,
    }));

    // ---- proof material. Inclusion proofs are generated for every event, so
    // a recipient can verify any single record without the whole batch.
    const leaves = journey.leaves;
    packet.proof = {
      canonicalProfile: C.PROFILES.canonical,
      merkleProfile: C.PROFILES.merkle,
      merkleRoot: journey.merkleRoot,
      leafCount: leaves.length,
      chainHead: journey.chainHead,
      anchor: journey.anchor,
      inclusionProofs: journey.events.map((e, i) => ({
        evidenceId: e.id, leafIndex: i, path: C.merkleProof(leaves, i),
      })),
      verificationSteps: [
        'Recompute each event digest: sha256(VS-JCS-1(event.body)) and compare with event.dataHash.',
        'Recompute the chain: eventHash[i] = sha256(0x02 || eventHash[i-1] || VS-JCS-1(body[i])), with 32 zero bytes for the genesis predecessor. Compare the final value with proof.chainHead.',
        'Recompute each Merkle leaf as sha256(0x00 || VS-JCS-1(body)) and each interior node as sha256(0x01 || left || right), splitting at the largest power of two below the node width (RFC 6962).',
        'Apply each inclusion proof path to its leaf and confirm it reproduces proof.merkleRoot.',
        'Recompute the manifest digest over this document with the manifest field removed, and compare with manifest.packetDigest.',
      ],
      whatThisProves: 'That these bytes are internally consistent and have not been altered since the manifest was computed.',
      whatThisDoesNotProve: [
        'That the recorded events actually happened as described.',
        'That the batch is COMPLETE. An inclusion proof shows a record is in the tree; it can never show that no record was withheld.',
        'That any authority has seen, accepted or acted on this packet.',
        'That the goods conform, are certified, are cleared, or may be sold.',
      ],
    };

    packet.limitations = {
      boundary: 'This packet prepares and verifies evidence. It does not issue halal certification, a religious ruling, laboratory validation, accreditation, recognition, customs release, market authorization or commercial release.',
      syntheticLabel: 'SYNTHETIC DEMO - NOT FOR SUBMISSION',
      noAggregateScore: 'No overall compliance percentage is produced anywhere in this packet. Annexes report counts by state and a list of blocking findings. Halal conformity does not admit a mean.',
      asOfCaveat: 'States are as at the as-of time. A current-status overlay may differ and does not rewrite this frozen packet.',
      disclosureProfile: emergency
        ? 'EMERGENCY FULL DISCLOSURE. This packet is unredacted and may contain commercial, upstream-identity and personal data. It was authorised as a separate act.'
        : 'CUSTOM SCOPED DISCLOSURE. Sections outside the selected scope are absent, and the denied data classes listed in the manifest were withheld and verified absent from the output bytes.',
    };

    // ---- manifest, computed last over everything above
    const digestable = JSON.parse(JSON.stringify(packet));
    const packetDigest = C.digest(digestable);

    const scan = denyScan(C.canonicalize(digestable), denied);

    packet.manifest = {
      manifestProfile: 'VS-JCS-MANIFEST-1',
      packetDigest: packetDigest,
      digestAlgorithm: C.PROFILES.hash,
      canonicalProfile: C.PROFILES.canonical,
      includedSections: included,
      excludedSections: SECTIONS.map((s) => s.id).filter((s) => included.indexOf(s) === -1),
      recipient: opts.recipient || { id: 'UNSPECIFIED', label: 'Not specified', class: 'INTERNAL' },
      deniedDataClasses: denied.map((d) => ({ id: d, label: DENY_CLASSES[d] ? DENY_CLASSES[d].label : d })),
      denyScan: scan,
      signature: {
        state: 'SIMULATED',
        note: 'No production signing key is present in a browser demo. In production the manifest carries a signature bound to a verified mandate and an effective interval, and key possession alone is not treated as authority.',
      },
      reproduce: 'Remove the "manifest" member from this document, canonicalize the remainder under ' + C.PROFILES.canonical + ', and SHA-256 it. The result must equal manifest.packetDigest.',
    };

    return { packet: packet, included: included, denied: denied, emergency: emergency, digest: packetDigest, scan: scan };
  }

  /* ------------------------------------------------------------ redaction */

  function redactBody(body, deniedClasses) {
    if (!deniedClasses || !deniedClasses.length) return body;
    const keys = [];
    deniedClasses.forEach((c) => {
      if (DENY_CLASSES[c]) keys.push.apply(keys, DENY_CLASSES[c].keys);
    });
    const clone = JSON.parse(JSON.stringify(body));
    (function walk(o) {
      if (!o || typeof o !== 'object') return;
      Object.keys(o).forEach((k) => {
        if (keys.indexOf(k) !== -1) {
          o[k] = '[REDACTED:' + k + ']';
        } else walk(o[k]);
      });
    })(clone);
    return clone;
  }

  /**
   * The second enforcement: scan the bytes that will actually leave.
   * An allowlist expresses intent; this checks the result. Returns a report
   * that goes into the manifest whether it passes or fails, because a scan
   * that is only published when it passes is not a control.
   */
  function denyScan(outputString, deniedClasses) {
    const hits = [];
    (deniedClasses || []).forEach((c) => {
      const def = DENY_CLASSES[c];
      if (!def) return;
      def.keys.forEach((k) => {
        // Look for the key appearing as a JSON member with a real value,
        // i.e. not already replaced by the redaction marker.
        const re = new RegExp('"' + k + '":(?!"\\[REDACTED)', 'g');
        const found = outputString.match(re);
        if (found) hits.push({ class: c, key: k, occurrences: found.length });
      });
    });
    return {
      performed: true,
      scope: 'Canonical output bytes of this packet, including nested bodies and note fields.',
      deniedClasses: deniedClasses || [],
      violations: hits,
      result: hits.length === 0 ? 'CLEAN' : 'VIOLATIONS_PRESENT',
      note: hits.length === 0
        ? 'No denied-class field reached the output bytes.'
        : 'Denied-class fields were found in the output. This packet must not be disclosed until they are removed.',
    };
  }

  /* ----------------------------------------------------------- rendering */

  function toJSON(result) {
    // Pretty-printed for a human recipient. The DIGEST is over the canonical
    // form, not over this pretty form, and the manifest says so explicitly.
    return JSON.stringify(result.packet, null, 2);
  }

  function toCanonical(result) {
    return VS.crypto.canonicalize(result.packet);
  }

  function toPDF(result, journey, series) {
    const C = VS.crypto;
    const P = VS.pdf;
    const p = result.packet;
    const emergency = result.emergency;

    const w = P.create({
      product: 'VSENSE Halal Logistics',
      packetId: p.identity.packetId,
      title: 'Halal import audit packet ' + p.identity.packetId,
      author: 'VSENSE Halal Logistics (synthetic demo)',
      subject: journey.title,
      footer: 'SYNTHETIC DEMO - NOT FOR SUBMISSION - prepares evidence, issues no certification or release',
      // Deterministic: derived from the packet's own as-of time, not the clock.
      pdfDate: 'D:' + String(p.identity.asOf).replace(/[-:]/g, '').replace('T', '').replace(/\.\d+/, ''),
      docId: result.digest,
    });

    w.title(emergency ? 'Emergency audit packet' : 'Halal import audit packet',
      journey.title + '  -  lot ' + (p.product ? p.product.lot : journey.product.lot) + '  -  ' + p.identity.packetId);

    w.note(p.limitations.boundary + ' ' + p.limitations.noAggregateScore);

    if (emergency) {
      w.note('EMERGENCY FULL DISCLOSURE. This packet is unredacted and may contain commercial, upstream-identity and personal data. It was authorised as a separate act from routine packet preparation.');
    }

    w.heading('Packet identity and state');
    w.kv([
      ['Packet id', p.identity.packetId],
      ['Disclosure profile', p.identity.disclosureProfile],
      ['Environment', p.identity.environment + ' (synthetic: ' + p.identity.synthetic + ')'],
      ['Preparation', p.identity.preparation],
      ['Submission', p.identity.submission],
      ['External outcome', p.identity.externalOutcome],
      ['Commercial disposition', p.identity.commercialDisposition],
      ['As of', p.identity.asOf],
      ['Packet owner', (p.identity.packetOwner.role || 'Unspecified')],
      ['Canonicalization', p.identity.canonicalProfile, 'mono'],
      ['Merkle profile', p.identity.merkleProfile, 'mono'],
    ]);

    w.heading('Corridor and jurisdiction selection');
    w.table(
      [{ label: 'Jurisdiction', width: 0.3 }, { label: 'Region', width: 0.26 }, { label: 'Role', width: 0.22 }, { label: 'Code', width: 0.22, mono: true }],
      p.corridor.selectedJurisdictions.map((j) => [j.name, j.region || '-', j.role, j.id]));

    w.subheading('Frameworks applied to this journey');
    w.table(
      [{ label: 'Framework', width: 0.46 }, { label: 'Family', width: 0.24 }, { label: 'Verification status', width: 0.30 }],
      p.corridor.selectedFrameworks.map((f) => [f.name, f.family || '-', f.verificationStatus]));

    w.subheading('Legs');
    w.table(
      [{ label: 'Seq', width: 0.07, mono: true }, { label: 'Mode', width: 0.14 }, { label: 'From', width: 0.22 },
       { label: 'To', width: 0.22 }, { label: 'Depart (UTC)', width: 0.175, mono: true }, { label: 'Arrive (UTC)', width: 0.175, mono: true }],
      p.corridor.legs.map((l) => [String(l.seq), l.mode, l.from, l.to, l.depart.slice(0, 16).replace('T', ' '), l.arrive.slice(0, 16).replace('T', ' ')]));

    // ---- one section per annex, each independently frozen
    p.annexes.forEach((a) => {
      w.pageBreak();
      w.heading('Authority annex - ' + a.jurisdictionName);
      w.kv([
        ['Jurisdiction', a.jurisdiction + ' (' + a.region + ')'],
        ['Frameworks applied', a.frameworks.join(', ')],
        ['Preparation', a.preparation],
        ['Submission', a.submission],
        ['Authority decision', a.authorityDecision],
      ]);
      w.para(a.note, { muted: true, size: 8.5 });

      const counts = Object.keys(a.stateCounts).map((k) => k + ': ' + a.stateCounts[k]).join('   ');
      w.para('Control states - ' + counts, { size: 8.5 });
      w.para('No aggregate percentage is given. These are counts of independent control outcomes.', { muted: true, size: 8 });

      if (a.blocking.length) {
        w.subheading('Blocking findings for this annex');
        w.table(
          [{ label: 'Control', width: 0.16, mono: true }, { label: 'State', width: 0.2 }, { label: 'Why', width: 0.64 }],
          a.blocking.map((b) => [b.control, b.state, b.because]));
      }

      w.subheading('Control assessment');
      w.table(
        [{ label: 'Control', width: 0.14, mono: true }, { label: 'Requirement', width: 0.42 },
         { label: 'State', width: 0.19 }, { label: 'Basis', width: 0.25 }],
        a.controls.map((c) => [c.control, c.title, c.state, c.because]));
    });

    if (p.custody) {
      w.pageBreak();
      w.heading('Chain of custody');
      w.para('Each event binds its predecessor: eventHash[i] = SHA-256(0x02 || eventHash[i-1] || canonical(body[i])). Altering any event changes every hash after it.', { muted: true, size: 8.5 });
      w.table(
        [{ label: 'Id', width: 0.1, mono: true }, { label: 'When (UTC)', width: 0.17, mono: true }, { label: 'Event', width: 0.37 },
         { label: 'State', width: 0.16 }, { label: 'Event hash', width: 0.2, mono: true }],
        p.custody.events.map((e) => [e.id, e.at.slice(0, 16).replace('T', ' '), e.title, e.state, C.shortHash(e.eventHash)]));
      w.hashBlock('Chain head (final event hash)', p.custody.chainHead,
        'Recomputing the chain from the first event must reproduce this value.');
    }

    if (p.telemetry) {
      w.pageBreak();
      w.heading('Telemetry and coverage');
      w.kv([
        ['Device', p.telemetry.device],
        ['Samples', String(p.telemetry.sampleCount)],
        ['Expected cadence', p.telemetry.declaredProfile.expectedCadenceMin + ' min'],
        ['Max sampling gap', p.telemetry.declaredProfile.maxSamplingGapMin + ' min'],
        ['Declared profile', p.telemetry.declaredProfile.min + ' to ' + p.telemetry.declaredProfile.max + ' ' + p.telemetry.declaredProfile.unit],
        ['Coverage result', p.telemetry.coverage.state],
      ]);
      w.para(p.telemetry.coverage.explain, { size: 8.5 });
      w.para(p.telemetry.note, { muted: true, size: 8 });
      if (p.telemetry.coverage.findings.length) {
        w.subheading('Coverage findings');
        w.table(
          [{ label: 'Code', width: 0.22, mono: true }, { label: 'Severity', width: 0.14 }, { label: 'Finding', width: 0.64 }],
          p.telemetry.coverage.findings.map((f) => [f.code, f.severity, f.text]));
      }
    }

    if (p.laboratory) {
      w.pageBreak();
      w.heading('Laboratory');
      w.para(p.laboratory.note, { muted: true, size: 8.5 });
      p.laboratory.reports.forEach((r) => {
        w.subheading('Report ' + r.body.report);
        w.kv([
          ['Facility', r.body.facility], ['Method', r.body.method], ['Matrix', r.body.matrix],
          ['Analyte', r.body.analyte], ['Result state', r.body.resultState],
          ['LOD / LOQ', r.body.lod + ' / ' + r.body.loq],
          ['Scope match', r.body.scopeMatch], ['Scope snapshot', r.body.scopeSnapshot, 'mono'],
          ['Inference scope', r.body.inferenceScope],
          ['Analysis / report date', r.body.analysisDate + ' / ' + r.body.reportDate],
        ]);
        if (r.body.note) w.para(r.body.note, { muted: true, size: 8 });
      });
    }

    if (p.certificates) {
      w.heading('Certificates and recognition');
      w.para(p.certificates.note, { muted: true, size: 8.5 });
      if (p.certificates.certificateEvents.length) {
        w.subheading('Certificate events');
        w.table([{ label: 'Certificate', width: 0.3, mono: true }, { label: 'Issuer', width: 0.24, mono: true },
          { label: 'Standard', width: 0.22, mono: true }, { label: 'Valid to', width: 0.24, mono: true }],
          p.certificates.certificateEvents.map((e) => [e.body.certificate, e.body.issuer, e.body.standard, e.body.validTo]));
      }
      if (p.certificates.recognitionEvents.length) {
        w.subheading('Recognition events (separate history)');
        w.table([{ label: 'Body', width: 0.26, mono: true }, { label: 'Destination', width: 0.18 },
          { label: 'State', width: 0.24 }, { label: 'Effective', width: 0.32, mono: true }],
          p.certificates.recognitionEvents.map((e) => [e.body.body, e.body.destination, e.body.recognitionState, e.body.withdrawnOn || '-']));
      }
    }

    if (p.exceptions && p.exceptions.length) {
      w.heading('Exceptions and CAPA');
      w.table([{ label: 'Issue', width: 0.16, mono: true }, { label: 'Severity', width: 0.14 },
        { label: 'Linked', width: 0.14, mono: true }, { label: 'Containment', width: 0.2 }, { label: 'Status', width: 0.36 }],
        p.exceptions.map((e) => [e.body.issue, e.body.severity, e.body.linkedEvent, e.body.containment, e.status]));
    }

    w.pageBreak();
    w.heading('Separation lattice');
    w.para('Eleven distinct objects. None of them implies another. The most common way an evidence document misleads is by letting "certificate valid" be read as "authority accepted".', { muted: true, size: 8.5 });
    w.table(
      [{ label: 'Object', width: 0.24 }, { label: 'Held by', width: 0.26 }, { label: 'Must not be inferred', width: 0.5 }],
      p.separationLattice.map((s) => [s.label, s.holder, s.mustNotBeInferred]));

    w.pageBreak();
    w.heading('Proof material');
    w.hashBlock('Packet digest (SHA-256 over ' + p.manifest.canonicalProfile + ')', p.manifest.packetDigest, p.manifest.reproduce);
    w.hashBlock('Merkle root (' + p.proof.merkleProfile + ')', p.proof.merkleRoot,
      'Over ' + p.proof.leafCount + ' evidence leaves. Inclusion proves membership, never completeness.');
    w.hashBlock('Custody chain head (' + p.identity.chainProfile + ')', p.proof.chainHead,
      'Recompute from the first event; any alteration changes this value.');

    w.subheading('How to verify this packet offline');
    p.proof.verificationSteps.forEach((s, i) => w.para((i + 1) + '. ' + s, { size: 8.5 }));

    w.subheading('What a successful verification does not prove');
    p.proof.whatThisDoesNotProve.forEach((s) => w.para('- ' + s, { size: 8.5 }));

    w.subheading('Disclosure record');
    w.kv([
      ['Recipient', (p.manifest.recipient.label || '-') + ' (' + (p.manifest.recipient.class || '-') + ')'],
      ['Included sections', p.manifest.includedSections.join(', ')],
      ['Excluded sections', p.manifest.excludedSections.length ? p.manifest.excludedSections.join(', ') : 'none'],
      ['Denied data classes', p.manifest.deniedDataClasses.length ? p.manifest.deniedDataClasses.map((d) => d.label).join(', ') : 'none'],
      ['Denied-data scan', p.manifest.denyScan.result],
      ['Signature', p.manifest.signature.state],
    ]);
    w.para(p.manifest.signature.note, { muted: true, size: 8 });
    w.para(p.limitations.disclosureProfile, { size: 8.5 });

    w.heading('Limitations');
    w.note(p.limitations.boundary);
    w.para(p.limitations.noAggregateScore, { size: 8.5 });
    w.para(p.limitations.asOfCaveat, { size: 8.5 });
    w.para('Fixture label: ' + p.limitations.syntheticLabel, { mono: true, size: 8.5 });

    const jsonBytes = C.utf8(JSON.stringify(result.packet, null, 2));
    return w.finish({
      attachment: { name: 'audit-packet.json', bytes: jsonBytes,
        desc: 'Canonical JSON audit packet. Digest: ' + result.digest },
    });
  }

  /* -------------------------------------------------- independent verify

     The same checks a recipient would run, implemented against the packet
     object rather than against internal state, so running it actually tests
     the exported artifact.                                                   */

  function verify(packetObj) {
    const C = VS.crypto;
    const checks = [];
    const add = (name, pass, detail) => checks.push({ name: name, pass: !!pass, detail: detail || '' });

    // 1. manifest digest
    const copy = JSON.parse(JSON.stringify(packetObj));
    const claimed = copy.manifest ? copy.manifest.packetDigest : null;
    delete copy.manifest;
    const recomputed = C.digest(copy);
    add('Manifest digest recomputes', claimed === recomputed, C.shortHash(recomputed));

    // 2. per-event digests
    if (packetObj.custody) {
      let allOk = true;
      packetObj.custody.events.forEach((e) => {
        if (C.digest(e.body) !== e.dataHash) allOk = false;
      });
      add('Every event digest recomputes', allOk, packetObj.custody.events.length + ' events');

      // 3. chain
      const vr = C.verifyChain(packetObj.custody.events.map((e) => ({ body: e.body, eventHash: e.eventHash })));
      add('Custody chain verifies end to end', vr.ok && vr.head === packetObj.custody.chainHead,
        vr.ok ? C.shortHash(vr.head) : 'break at index ' + vr.brokenAt);

      // 4. merkle inclusion for every proof
      const leaves = packetObj.custody.events.map((e) => C.canonicalize(e.body));
      let incOk = true;
      (packetObj.proof.inclusionProofs || []).forEach((pr) => {
        const leaf = leaves[pr.leafIndex];
        if (leaf === undefined) { incOk = false; return; }
        if (!C.verifyMerkleProof(leaf, pr.path, packetObj.proof.merkleRoot).ok) incOk = false;
      });
      add('Merkle inclusion verifies for every claimed record', incOk,
        (packetObj.proof.inclusionProofs || []).length + ' proofs against root ' + C.shortHash(packetObj.proof.merkleRoot));

      // 5. root recomputes from the leaves actually present
      add('Merkle root recomputes from the included leaves',
        C.merkleRoot(leaves) === packetObj.proof.merkleRoot, C.shortHash(C.merkleRoot(leaves)));
    } else {
      add('Custody section present for chain verification', false, 'section not included in this disclosure profile');
    }

    // 6. the deny scan, re-run against the delivered bytes
    if (packetObj.manifest && packetObj.manifest.denyScan) {
      const rescan = denyScan(C.canonicalize(copy), packetObj.manifest.denyScan.deniedClasses || []);
      add('Denied-data scan re-runs clean on the delivered bytes',
        rescan.result === 'CLEAN', rescan.result);
    }

    // 7. the boundary claims are present and unaltered
    add('Boundary and no-aggregate-score statements present',
      !!(packetObj.limitations && packetObj.limitations.boundary && packetObj.limitations.noAggregateScore));

    const failed = checks.filter((c) => !c.pass).length;
    return { ok: failed === 0, total: checks.length, failed: failed, checks: checks };
  }

  VS.packet = {
    SECTIONS: SECTIONS,
    DENY_CLASSES: DENY_CLASSES,
    build: build,
    toJSON: toJSON,
    toCanonical: toCanonical,
    toPDF: toPDF,
    verify: verify,
    denyScan: denyScan,
  };
})(typeof window !== 'undefined' ? window : globalThis);