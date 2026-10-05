/* ===========================================================================
   VSENSE Halal Logistics - pseudo telemetry stream
   ---------------------------------------------------------------------------
   A deterministic, physically plausible reefer telemetry generator, so the
   demo shows what production data actually looks like rather than a smooth
   sine wave that never challenges anything.

   The physics that matter, per Council A member M3:

   - SUPPLY AIR is the fastest and noisiest channel. It sawtooths around the
     setpoint on the compressor cycle.
   - RETURN AIR lags supply by roughly the box transit time and sits warmer.
   - PULP probes are in the product. They have enormous thermal mass, so they
     barely move. This is the whole reason a defrost cycle is not an excursion:
     supply air spikes to +10 degC while pulp moves less than 0.3 degC.
   - A DOOR OPEN looks different from a defrost: supply, return AND pulp all
     rise, and pulp keeps rising for several minutes after the door shuts,
     because heat is still soaking inward.

   An assessor who cannot tell a defrost from a door open will either raise
   false excursions or miss real ones. The generator produces both so the
   coverage model has something to be right about.

   Determinism: a seeded PRNG, seeded from the journey id. The same journey
   always yields the same series, so every digest over it is reproducible.

   Classic script. Hangs off window.VS.stream.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  /* ------------------------------------------------------- seeded PRNG

     mulberry32: small, fast, good enough for plausible sensor noise, and
     fully reproducible. Never use this for anything security-bearing.       */

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function seedFrom(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i += 1) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  }

  const MIN = 60 * 1000;

  /* ------------------------------------------------------------- generator */

  /**
   * Build the full telemetry series for a journey.
   * Returns { channels, samples, events, coverage } where `samples` is an
   * array ordered by (device, channel, sequence) -- never by wall clock,
   * because one journey deliberately contains a clock rollback.
   */
  function generate(journey) {
    const prof = journey.declaredProfile;
    const rnd = mulberry32(seedFrom(journey.id));
    const start = Date.parse(journey.legs[0].depart);
    const end = Date.parse(journey.legs[journey.legs.length - 1].arrive);
    const cadence = prof.expectedCadenceMin * MIN;
    const chilled = prof.setpoint > -5;

    // Scheduled disturbances, derived from the journey's planted events so
    // the stream and the custody record cannot disagree.
    const blackout = findEvent(journey, 'TELEMETRY_GAP');
    const doorEvent = findEvent(journey, 'SEAL_EVENT', (e) => e.body.transition && e.body.transition.indexOf('OPEN_UNAUTHORIZED') !== -1);
    const authorizedOpen = findEvent(journey, 'SEAL_EVENT', (e) => e.body.transition && e.body.transition.indexOf('OPEN_AUTHORIZED') !== -1);
    const clockEvent = findEvent(journey, 'CLOCK_ANOMALY');
    const backfill = findEvent(journey, 'BACKFILL');
    const calLapse = findEvent(journey, 'DEVICE_STATE');

    const blackoutFrom = blackout ? Date.parse(blackout.at) : null;
    const blackoutTo = blackout ? blackoutFrom + blackout.body.gapMinutes * MIN : null;

    // Defrost schedule: every ~8 h, 22-30 min, supply only.
    const defrosts = [];
    for (let t = start + 7.5 * 60 * MIN; t < end; t += (7.5 + rnd() * 1.5) * 60 * MIN) {
      defrosts.push({ from: t, to: t + (22 + rnd() * 8) * MIN, peak: 9.4 + rnd() * 3.4 });
    }

    const device = 'DEV-SYN-REEFER-' + (seedFrom(journey.id) % 9000 + 1000);
    const samples = [];
    const streamEvents = [];
    let seq = 0;

    // Pull-down. The AIR starts near ambient and reaches setpoint on a ~46 min
    // exponential. The PRODUCT does not: frozen and chilled cargo is stuffed
    // already at temperature, so the pulp probes start only slightly warm from
    // door-open heat gain during stuffing, and recover on the load's much
    // longer ~5.5 h thermal constant. Modelling the product as pulling down
    // from ambient would put the core above the profile for the first half-day
    // of every voyage, which is not what a reefer does and would make the
    // coverage assessment cry wolf on every single journey.
    const ambientStart = chilled ? 28.0 : 34.0;
    // Core heat gain at departure. Kept small deliberately: the probes sit in
    // the product, which is only exposed for the minutes it takes to stuff the
    // box. Sized so the warmest probe (top of stack, +0.6) plus noise plus a
    // defrost cycle still sits inside the declared ceiling -- if the model
    // started the load out of profile, every journey would open with a
    // spurious excursion before anything had happened to it.
    const stuffingGain = chilled ? 0.7 : 0.9;   // degC above setpoint at departure
    const tauAir = 46 * MIN;
    const tauPulp = 5.5 * 60 * MIN;

    let pulpCarry = 0;         // residual heat soak after a door open
    let microGapMinutes = 0;
    let samplingGapMinutes = 0;

    for (let t = start; t <= end; t += cadence) {
      // ---- sampling blackout: no sample exists. Not buffered, not late: absent.
      if (blackoutFrom && t >= blackoutFrom && t < blackoutTo) {
        samplingGapMinutes += prof.expectedCadenceMin;
        continue;
      }

      const elapsed = t - start;
      const pullAir = ambientStart * Math.exp(-elapsed / tauAir);
      const pullPulp = stuffingGain * Math.exp(-elapsed / tauPulp);

      // ---- supply air: sawtooth on a 42 min compressor cycle, plus noise
      const phase = ((t - start) % (42 * MIN)) / (42 * MIN);
      const saw = (phase < 0.5 ? phase * 2 : 2 - phase * 2) - 0.5;   // -0.5 .. +0.5
      let supply = prof.setpoint + saw * 1.2 + (rnd() - 0.5) * 0.18 + pullAir;

      // ---- defrost: supply spikes hard, return barely moves, pulp does not
      let inDefrost = null;
      for (const d of defrosts) {
        if (t >= d.from && t <= d.to) { inDefrost = d; break; }
      }
      let returnAir = supply + 2.2 + (rnd() - 0.5) * 0.2 + (pullAir * 0.3);
      let pulp1 = prof.setpoint + 0.6 + (rnd() - 0.5) * 0.12 + pullPulp;
      let pulp2 = prof.setpoint + 0.1 + (rnd() - 0.5) * 0.12 + pullPulp;
      let pulp3 = prof.setpoint - 0.6 + (rnd() - 0.5) * 0.12 + pullPulp;

      if (inDefrost) {
        const p = (t - inDefrost.from) / (inDefrost.to - inDefrost.from);
        const shape = Math.sin(Math.PI * p);
        supply = prof.setpoint + shape * (inDefrost.peak - prof.setpoint);
        returnAir += shape * 1.2;      // +0.5 .. +1.5 band
        pulp1 += shape * 0.22;         // < 0.3, the defrost signature
        pulp2 += shape * 0.16;
        pulp3 += shape * 0.11;
      }

      // ---- door open: everything rises, and pulp keeps rising after close
      let doorOpen = false;
      [doorEvent, authorizedOpen].forEach((ev) => {
        if (!ev) return;
        const from = Date.parse(ev.body.openedAt);
        const to = Date.parse(ev.body.closedAt);
        if (t >= from && t <= to) {
          doorOpen = true;
          const mins = (t - from) / MIN;
          // Air responds almost linearly for the first several minutes.
          supply += 0.80 * mins;
          returnAir += 0.55 * mins;
          // The product core does NOT. It approaches a ceiling on its own
          // thermal constant, so a 45-minute door open warms a frozen core by
          // around a degree, not by thirty-six. A linear core model makes
          // every long authorized inspection look like a profile breach,
          // which would bury the real excursions in false ones.
          const soak = (max, tau) => max * (1 - Math.exp(-mins / tau));
          pulp1 += soak(1.25, 24);
          pulp2 += soak(0.85, 28);
          pulp3 += soak(0.55, 32);
          pulpCarry = soak(1.25, 24) * 0.35;
        } else if (t > to && t <= to + 9 * MIN) {
          // Heat soak: the product is still warming after the door shut.
          const decay = 1 - (t - to) / (9 * MIN);
          pulp1 += pulpCarry * decay;
          pulp2 += pulpCarry * decay * 0.7;
        }
      });

      const admissible = !(calLapse && t >= Date.parse(calLapse.body.lapsedAt));

      samples.push({
        seq: seq++, device: device, at: new Date(t).toISOString(),
        supply: round2(supply), return: round2(returnAir),
        pulp1: round2(pulp1), pulp2: round2(pulp2), pulp3: round2(pulp3),
        rh: round1(82 + (rnd() - 0.5) * 6),
        shock: round2(rnd() < 0.985 ? rnd() * 0.4 : 1.2 + rnd() * 2.4),
        door: doorOpen, defrost: !!inDefrost,
        admissible: admissible,
        // The channel the profile is actually assessed against. Supply air
        // is diagnostic; it is NOT the compliance channel, because a defrost
        // would otherwise read as an excursion every eight hours.
        assessChannel: 'pulp1',
      });
    }

    // ---- one hard shock at a handoff, the tine strike
    if (samples.length > 40) {
      const idx = Math.floor(samples.length * 0.62);
      samples[idx].shock = 6.1;
      streamEvents.push({ at: samples[idx].at, kind: 'SHOCK', severity: 'REVIEW',
        text: 'Shock of 6.1 g recorded at a handling event. Flagged for review, not auto-rejected: a shock is not by itself a halal-integrity finding.' });
    }

    if (blackout) {
      streamEvents.push({ at: blackout.at, kind: 'BLACKOUT', severity: 'BLOCKING',
        text: 'Sampling blackout of ' + blackout.body.gapMinutes + ' min. No samples exist for this window, so coverage cannot be asserted across it.' });
    }
    if (doorEvent) {
      streamEvents.push({ at: doorEvent.body.openedAt, kind: 'DOOR', severity: 'BLOCKING',
        text: 'Door open for ' + doorEvent.body.durationMinutes + ' min with no matching custody event. Pulp rise distinguishes this from a defrost.' });
    }
    if (clockEvent) {
      streamEvents.push({ at: clockEvent.at, kind: 'CLOCK', severity: 'REVIEW',
        text: 'Device clock rolled back ' + clockEvent.body.rollbackMinutes + ' min. Sequence counter stayed monotonic, so ordering survives; interval arithmetic on timestamps does not.' });
    }
    if (backfill) {
      streamEvents.push({ at: backfill.at, kind: 'BACKFILL', severity: 'INFO',
        text: backfill.body.samples + ' samples backfilled after reconnection. Transmit gap, not sampling gap: signed at capture, appended without rewriting history.' });
    }
    if (calLapse) {
      streamEvents.push({ at: calLapse.at, kind: 'CALIBRATION', severity: 'REVIEW',
        text: 'Calibration lapsed mid-voyage on ' + calLapse.body.channels.join(', ') + '. ' + calLapse.body.samplesAfterLapse + ' later samples are inadmissible without review.' });
    }
    defrosts.slice(0, 3).forEach((d) => {
      streamEvents.push({ at: new Date(d.from).toISOString(), kind: 'DEFROST', severity: 'INFO',
        text: 'Defrost cycle: supply air peaked near ' + d.peak.toFixed(1) + ' degC while pulp moved under 0.3 degC. Within the declared supply-air exemption.' });
    });
    streamEvents.sort((a, b) => (a.at < b.at ? -1 : 1));

    const coverage = assessCoverage(journey, samples, {
      samplingGapMinutes: samplingGapMinutes, microGapMinutes: microGapMinutes,
      blackout: blackout, calLapse: calLapse, device: device,
    });

    return { device: device, channels: CHANNELS, samples: samples, events: streamEvents, coverage: coverage, profile: prof };
  }

  const CHANNELS = [
    { key: 'supply', label: 'Supply air', unit: 'degC', role: 'Diagnostic. Fastest channel; spikes on every defrost.' },
    { key: 'return', label: 'Return air', unit: 'degC', role: 'Diagnostic. Lags supply, warmer by roughly 2 degC.' },
    { key: 'pulp1', label: 'Pulp probe 1', unit: 'degC', role: 'Assessed channel. Product core; high thermal mass.' },
    { key: 'pulp2', label: 'Pulp probe 2', unit: 'degC', role: 'Assessed channel, mid-stack.' },
    { key: 'pulp3', label: 'Pulp probe 3', unit: 'degC', role: 'Assessed channel, deep stack.' },
    { key: 'rh', label: 'Relative humidity', unit: '%', role: 'Supporting.' },
    { key: 'shock', label: 'Shock', unit: 'g', role: 'Handling events. Flag, never an automatic rejection.' },
  ];

  /* ------------------------------------------------------ coverage model

     The predicate from Council A member M3, implemented rather than
     described. The order of the tests is the substance: admissibility is
     checked BEFORE values, so an out-of-range reading from an inadmissible
     device never silently becomes a clean PASS, and never silently becomes
     a FAIL either. It becomes INSUFFICIENT_COVERAGE plus a recorded adverse
     observation -- because the honest answer is "this device should not be
     deciding anything, and separately, it is telling us something bad".    */

  function assessCoverage(journey, samples, ctx) {
    const prof = journey.declaredProfile;
    const findings = [];

    const inadmissible = samples.filter((s) => !s.admissible).length;
    const deviceTrustOk = inadmissible === 0;
    if (!deviceTrustOk) {
      findings.push({ code: 'CALIBRATION_LAPSED', severity: 'REVIEW',
        text: inadmissible + ' samples were recorded after the calibration certificate expired. Not wrong, but not admissible without a recorded review.' });
    }

    const clockOk = !findEvent(journey, 'CLOCK_ANOMALY');
    if (!clockOk) {
      findings.push({ code: 'CLOCK_ROLLBACK', severity: 'REVIEW',
        text: 'A clock rollback means wall-clock interval arithmetic is unreliable in that window. Ordering falls back to the sequence counter.' });
    }

    const hasBlackout = !!ctx.blackout;
    if (hasBlackout) {
      findings.push({ code: 'SAMPLING_BLACKOUT', severity: 'BLOCKING',
        text: 'A ' + ctx.blackout.body.gapMinutes + ' minute sampling gap exceeds the declared maximum of ' + prof.maxSamplingGapMin + ' minutes. No value can be asserted across it.' });
    }

    // Values are assessed on the PULP channel only. Supply-air defrost peaks
    // are explicitly exempt; counting them would generate a false excursion
    // roughly every eight hours and train everyone to ignore the alarm.
    const admissibleSamples = samples.filter((s) => s.admissible);
    const outOfProfile = (s) => s.pulp1 > prof.max || s.pulp1 < prof.min;
    const breaches = admissibleSamples.filter(outOfProfile);
    const valueOk = breaches.length === 0;
    if (!valueOk) {
      findings.push({ code: 'PROFILE_BREACH', severity: 'BLOCKING',
        text: breaches.length + ' pulp samples fell outside the declared profile of ' + prof.min + ' to ' + prof.max + ' ' + prof.unit + '.' });
    }

    // An adverse reading from a device that is NOT admissible is the awkward
    // case, and the asymmetry here is deliberate. The device cannot be allowed
    // to decide the control -- so the result is INSUFFICIENT_COVERAGE, not
    // FAIL. But the reading is still telling us something bad, and discarding
    // it because the paperwork lapsed would be the worst of both worlds. So it
    // is retained and raised separately, and it can never resolve to PASS.
    const inadmissibleBreaches = samples.filter((s) => !s.admissible && outOfProfile(s));
    if (inadmissibleBreaches.length) {
      findings.push({ code: 'ADVERSE_OBSERVATION_FROM_INADMISSIBLE_DEVICE', severity: 'BLOCKING',
        text: inadmissibleBreaches.length + ' out-of-profile readings came from a device that was not admissible at the time. '
          + 'The readings cannot establish a failure, and they absolutely cannot be discarded: this control cannot resolve to PASS without a recorded review.' });
    }

    const doorUnmatched = findEvent(journey, 'SEAL_EVENT', (e) => e.body.matchingCustodyEvent === null);
    if (doorUnmatched) {
      findings.push({ code: 'UNMATCHED_DOOR_EVENT', severity: 'BLOCKING',
        text: 'A door/seal open has no corresponding custody event. Telemetry coverage across the interval is intact; custody continuity is not.' });
    }

    let state;
    if (!deviceTrustOk || hasBlackout) state = 'INSUFFICIENT_COVERAGE';
    else if (!valueOk) state = 'FAIL';
    else if (!clockOk) state = 'REQUIRES_REVIEW';
    else state = 'PASS';

    return {
      state: state,
      sampleCount: samples.length,
      admissibleCount: admissibleSamples.length,
      inadmissibleCount: inadmissible,
      expectedCadenceMin: prof.expectedCadenceMin,
      maxSamplingGapMin: prof.maxSamplingGapMin,
      samplingGapMinutes: ctx.samplingGapMinutes,
      breachCount: breaches.length,
      findings: findings,
      explain: state === 'PASS'
        ? 'Admissible devices, continuous coverage, pulp values inside the declared profile.'
        : state === 'FAIL'
          ? 'An admissible series shows product-core values outside the declared profile.'
          : state === 'INSUFFICIENT_COVERAGE'
            ? 'Values may look acceptable, but coverage or device admissibility is unresolved. "All samples in range" is not a compliance claim when the samples are sparse or the device is not admissible.'
            : 'Gaps or anomalies exist with compensating evidence; a qualified reviewer must weigh them.',
    };
  }

  /* ---------------------------------------------------------------- utils */

  function findEvent(journey, type, pred) {
    const hits = journey.events.filter((e) => e.type === type && (!pred || pred(e)));
    return hits.length ? hits[0] : null;
  }

  const round2 = (n) => Math.round(n * 100) / 100;
  const round1 = (n) => Math.round(n * 10) / 10;

  /* ------------------------------------------------------- live replay

     The "pseudo data stream" the brief asks for: a replay cursor that walks
     the generated series at a chosen rate, so the UI shows data arriving the
     way it would in production rather than appearing all at once.           */

  function Replay(series, onTick) {
    this.series = series;
    this.onTick = onTick;
    this.index = 0;
    this.timer = null;
    this.rate = 240;    // ms between emitted samples
    this.playing = false;
  }

  Replay.prototype.start = function () {
    if (this.playing) return;
    this.playing = true;
    const step = () => {
      if (!this.playing) return;
      if (this.index >= this.series.samples.length) { this.index = 0; }
      const s = this.series.samples[this.index++];
      this.onTick(s, this.index, this.series.samples.length);
      this.timer = setTimeout(step, this.rate);
    };
    step();
  };

  Replay.prototype.stop = function () {
    this.playing = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  };

  Replay.prototype.seek = function (fraction) {
    this.index = Math.max(0, Math.min(this.series.samples.length - 1,
      Math.floor(fraction * this.series.samples.length)));
  };

  VS.stream = {
    generate: generate,
    Replay: Replay,
    CHANNELS: CHANNELS,
  };
})(typeof window !== 'undefined' ? window : globalThis);