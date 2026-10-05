/* ===========================================================================
   VSENSE Halal Logistics - synthetic import journeys
   ---------------------------------------------------------------------------
   Three import routes, each with legs, custody handoffs, evidence records and
   deliberately planted defects. All identities are obviously invented.

   Every journey carries SEVERAL destinations at once. That is the point: the
   same physical movement is assessed against Indonesian, Malaysian and Gulf
   requirements simultaneously, and those assessments must not be merged. A
   control can pass for one destination and fail for another on identical
   evidence, because the destinations ask different questions.

   Each journey also carries at least one honest failure. A demo in which
   everything verifies teaches nothing, and an evidence product that cannot
   show you a broken seal is not an evidence product.

   Classic script. Hangs off window.VS.journeys.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  const T = (iso) => iso; // ISO-8601 Z strings throughout; no local clock anywhere

  /* ------------------------------------------------------------- journey 1

     Frozen seafood, Jeddah to Jakarta via Colombo and Singapore. The flagship
     route: longest, most legs, and the one carrying the planted seal and
     coverage defects.                                                        */

  const J1 = {
    id: 'HLC-26-10482',
    title: 'Frozen seafood - Jeddah to Jakarta',
    product: { sku: 'SKU-FRZ-SEAFOOD-A2', category: 'FROZEN_SEAFOOD', description: 'Frozen whole round fish, retail pack',
      lot: 'LOT-FS-7782', quantity: 18400, unit: 'kg', packaging: 'Cartoned, palletised, 24 pallets' },
    origin: { facility: 'FAC-SYN-SA-114', name: 'Red Sea processing plant (synthetic)', jurisdiction: 'SA', place: 'Jeddah', lat: 21.4858, lon: 39.1925 },
    destination: { facility: 'FAC-SYN-ID-402', name: 'Tanjung Priok bonded cold store (synthetic)', jurisdiction: 'ID', place: 'Jakarta', lat: -6.1022, lon: 106.8833 },
    transit: ['LK', 'SG'],
    declaredProfile: { channel: 'TEMPERATURE_C', setpoint: -20.0, min: -24.0, max: -18.0, unit: 'degC',
      maxSamplingGapMin: 60, expectedCadenceMin: 10,
      exemption: 'Defrost excursion on the SUPPLY AIR channel only, up to 40 minutes, up to 4 per 24 hours, provided return air and pulp remain within profile.' },
    suggested: { jurisdictions: ['ID', 'MY', 'OIC'], frameworks: ['ID-LAW-33-2014', 'ID-PP-42-2024', 'ID-HAS-23000', 'MS-2400-1-2019', 'OIC-SMIIC-17-1', 'ISO-IEC-17025'] },
    legs: [
      { seq: 1, mode: 'ROAD', from: 'Red Sea processing plant', to: 'Jeddah Islamic Port', custodian: 'ORG-SYN-HAULIER-01', custodianName: 'Inland haulier (synthetic)',
        asset: 'TRK-SYN-4471', assetType: 'Reefer trailer', depart: T('2026-11-03T02:10:00Z'), arrive: T('2026-11-03T04:35:00Z') },
      { seq: 2, mode: 'TERMINAL', from: 'Jeddah Islamic Port gate', to: 'Jeddah Islamic Port stack', custodian: 'ORG-SYN-TERMINAL-JED', custodianName: 'Origin terminal operator (synthetic)',
        asset: 'CNT-SYN-884201', assetType: '40ft reefer container', depart: T('2026-11-03T04:35:00Z'), arrive: T('2026-11-04T09:20:00Z') },
      { seq: 3, mode: 'MARITIME', from: 'Jeddah', to: 'Colombo', custodian: 'ORG-SYN-OCEAN-01', custodianName: 'Ocean carrier (synthetic)',
        asset: 'MV SYNTHETIC MERIDIAN', assetType: 'Container vessel (synthetic, IMO not asserted)', depart: T('2026-11-04T09:20:00Z'), arrive: T('2026-11-09T22:40:00Z') },
      { seq: 4, mode: 'TRANSSHIP', from: 'Colombo', to: 'Colombo', custodian: 'ORG-SYN-TERMINAL-CMB', custodianName: 'Transshipment terminal (synthetic)',
        asset: 'CNT-SYN-884201', assetType: '40ft reefer container', depart: T('2026-11-09T22:40:00Z'), arrive: T('2026-11-10T14:05:00Z') },
      { seq: 5, mode: 'MARITIME', from: 'Colombo', to: 'Singapore', custodian: 'ORG-SYN-OCEAN-01', custodianName: 'Ocean carrier (synthetic)',
        asset: 'MV SYNTHETIC MERIDIAN', assetType: 'Container vessel (synthetic)', depart: T('2026-11-10T14:05:00Z'), arrive: T('2026-11-14T06:15:00Z') },
      { seq: 6, mode: 'TRANSSHIP', from: 'Singapore', to: 'Singapore', custodian: 'ORG-SYN-TERMINAL-SIN', custodianName: 'Transshipment terminal (synthetic)',
        asset: 'CNT-SYN-884201', assetType: '40ft reefer container', depart: T('2026-11-14T06:15:00Z'), arrive: T('2026-11-15T03:30:00Z') },
      { seq: 7, mode: 'MARITIME', from: 'Singapore', to: 'Jakarta', custodian: 'ORG-SYN-OCEAN-02', custodianName: 'Feeder carrier (synthetic)',
        asset: 'MV SYNTHETIC KANTARA', assetType: 'Feeder vessel (synthetic)', depart: T('2026-11-15T03:30:00Z'), arrive: T('2026-11-17T08:50:00Z') },
      { seq: 8, mode: 'ROAD', from: 'Tanjung Priok', to: 'Bonded cold store', custodian: 'ORG-SYN-HAULIER-ID', custodianName: 'Destination haulier (synthetic)',
        asset: 'TRK-SYN-9120', assetType: 'Reefer trailer', depart: T('2026-11-17T13:05:00Z'), arrive: T('2026-11-17T15:35:00Z') },
    ],
    /* Custody events. `body` is what gets canonicalized and hashed; the chain
       links them in order. Defects are planted, not simulated at render time. */
    events: [
      { id: 'EV-0001', at: T('2026-11-02T06:00:00Z'), type: 'CERTIFICATE_PRESENTED', stage: 'origin', actor: 'ORG-SYN-PROCESSOR',
        title: 'Halal certificate presented for the lot', state: 'VERIFIED',
        body: { kind: 'CERTIFICATE_PRESENTED', lot: 'LOT-FS-7782', certificate: 'CERT-SYN-HAL-2026-5512', issuer: 'CB-SYN-GULF-02', standard: 'GSO-2055-1', validFrom: '2026-01-14', validTo: '2027-01-13', scope: 'FROZEN_SEAFOOD' } },
      { id: 'EV-0002', at: T('2026-11-02T09:30:00Z'), type: 'SERTU_PERFORMED', stage: 'origin', actor: 'ORG-SYN-PROCESSOR',
        title: 'Samak/sertu cleansing of line 3 after a recorded najis mughallazah contact', state: 'VERIFIED',
        body: { kind: 'SERTU_PERFORMED', asset: 'LINE-3', trigger: 'NAJIS_MUGHALLAZAH_CONTACT', stages: 7, firstStageAgent: 'RITUAL_CLAY',
          witness: 'PSN-SYN-INSP-8821', witnessAppointment: 'APPT-SYN-2026-441', appointmentValidTo: '2027-03-31', sequenceComplete: true } },
      { id: 'EV-0003', at: T('2026-11-03T01:40:00Z'), type: 'SEAL_APPLIED', stage: 'origin', actor: 'ORG-SYN-PROCESSOR',
        title: 'Electronic seal armed on container CNT-SYN-884201', state: 'VERIFIED',
        body: { kind: 'SEAL_APPLIED', seal: 'ESEAL-SYN-881029', container: 'CNT-SYN-884201', state: 'ARMED', counter: 1 } },
      { id: 'EV-0004', at: T('2026-11-03T02:10:00Z'), type: 'HANDOFF', stage: 'leg-1', actor: 'ORG-SYN-HAULIER-01',
        title: 'Custody transferred to inland haulier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 1, transferor: 'ORG-SYN-PROCESSOR', transferee: 'ORG-SYN-HAULIER-01', offered: '2026-11-03T02:04:00Z', acknowledged: '2026-11-03T02:08:00Z', accepted: '2026-11-03T02:10:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0005', at: T('2026-11-03T04:35:00Z'), type: 'HANDOFF', stage: 'leg-2', actor: 'ORG-SYN-TERMINAL-JED',
        title: 'Custody transferred to origin terminal', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 2, transferor: 'ORG-SYN-HAULIER-01', transferee: 'ORG-SYN-TERMINAL-JED', offered: '2026-11-03T04:28:00Z', acknowledged: '2026-11-03T04:33:00Z', accepted: '2026-11-03T04:35:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0006', at: T('2026-11-04T09:20:00Z'), type: 'HANDOFF', stage: 'leg-3', actor: 'ORG-SYN-OCEAN-01',
        title: 'Custody transferred to ocean carrier at load', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 3, transferor: 'ORG-SYN-TERMINAL-JED', transferee: 'ORG-SYN-OCEAN-01', offered: '2026-11-04T08:50:00Z', acknowledged: '2026-11-04T09:12:00Z', accepted: '2026-11-04T09:20:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0007', at: T('2026-11-06T18:22:00Z'), type: 'TELEMETRY_GAP', stage: 'leg-3', actor: 'DEV-SYN-REEFER-771',
        title: 'Sampling blackout of 40 minutes during a supply-voltage brownout', state: 'INSUFFICIENT_COVERAGE',
        body: { kind: 'TELEMETRY_GAP', device: 'DEV-SYN-REEFER-771', gapClass: 'BLACKOUT', gapMinutes: 40, gapType: 'SAMPLING_GAP',
          cause: 'SUPPLY_BROWNOUT', loggedVoltage: 3.42, straddles: 'DEFROST_CYCLE', note: 'No samples exist for this interval. This is a sampling gap, not a transmit gap: nothing was buffered.' } },
      { id: 'EV-0008', at: T('2026-11-09T22:40:00Z'), type: 'HANDOFF', stage: 'leg-4', actor: 'ORG-SYN-TERMINAL-CMB',
        title: 'Custody transferred at Colombo transshipment', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 4, transferor: 'ORG-SYN-OCEAN-01', transferee: 'ORG-SYN-TERMINAL-CMB', offered: '2026-11-09T22:20:00Z', acknowledged: '2026-11-09T22:36:00Z', accepted: '2026-11-09T22:40:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0009', at: T('2026-11-10T03:12:00Z'), type: 'SEAL_EVENT', stage: 'leg-4', actor: 'DEV-SYN-SEAL-881029',
        title: 'Seal reported OPEN for 9 minutes with no corresponding custody event', state: 'FAILED',
        body: { kind: 'SEAL_EVENT', seal: 'ESEAL-SYN-881029', transition: 'ARMED->OPEN_UNAUTHORIZED', openedAt: '2026-11-10T03:12:00Z', closedAt: '2026-11-10T03:21:00Z',
          durationMinutes: 9, matchingCustodyEvent: null, counter: 2,
          note: 'No authorized open, inspection order or handoff covers this interval. Seal continuity is broken for every destination that requires it.' } },
      { id: 'EV-0010', at: T('2026-11-10T14:05:00Z'), type: 'HANDOFF', stage: 'leg-5', actor: 'ORG-SYN-OCEAN-01',
        title: 'Custody returned to ocean carrier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 5, transferor: 'ORG-SYN-TERMINAL-CMB', transferee: 'ORG-SYN-OCEAN-01', offered: '2026-11-10T13:40:00Z', acknowledged: '2026-11-10T14:00:00Z', accepted: '2026-11-10T14:05:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0011', at: T('2026-11-12T11:00:00Z'), type: 'SAMPLE_DRAWN', stage: 'leg-5', actor: 'ORG-SYN-SAMPLER',
        title: 'Sample drawn under a retained sampling plan', state: 'VERIFIED',
        body: { kind: 'SAMPLE_DRAWN', sample: 'SMP-SYN-3301', lot: 'LOT-FS-7782', plan: 'PLAN-SYN-RAND-16', increments: 16, incrementMassG: 25,
          detectableDefectFraction: 0.17, inferenceScope: 'TEST_PORTION',
          note: 'Sixteen increments support a test-portion claim only. A lot-level negative inference is not available from this plan.' } },
      { id: 'EV-0012', at: T('2026-11-13T16:45:00Z'), type: 'LAB_RESULT', stage: 'leg-5', actor: 'LAB-SYN-SG-01',
        title: 'Species-identity screening: porcine DNA below limit of quantification', state: 'REQUIRES_REVIEW',
        body: { kind: 'LAB_RESULT', report: 'RPT-SYN-99012', sample: 'SMP-SYN-3301', facility: 'LAB-SYN-SG-01', method: 'MTH-SYN-PCR-PORCINE-v4',
          matrix: 'FISH_MUSCLE', analyte: 'PORCINE_DNA', resultState: 'BELOW_LOQ', value: null, lod: '0.01 % w/w', loq: '0.05 % w/w',
          qcControls: { extractionBlank: 'PASS', negativeControl: 'PASS', positiveControl: 'PASS', internalAmplification: 'PASS' },
          scopeMatch: 'IN_SCOPE', scopeSnapshot: 'SCOPE-SYN-2026-Q4-114', analysisDate: '2026-11-13', reportDate: '2026-11-13',
          inferenceScope: 'TEST_PORTION', signer: 'PSN-SYN-SIGNATORY-12',
          note: 'BELOW_LOQ is neither a detection nor a clean negative. It must not be rendered as NOT_DETECTED.' } },
      { id: 'EV-0013', at: T('2026-11-14T06:15:00Z'), type: 'HANDOFF', stage: 'leg-6', actor: 'ORG-SYN-TERMINAL-SIN',
        title: 'Custody transferred at Singapore transshipment', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 6, transferor: 'ORG-SYN-OCEAN-01', transferee: 'ORG-SYN-TERMINAL-SIN', offered: '2026-11-14T05:55:00Z', acknowledged: '2026-11-14T06:10:00Z', accepted: '2026-11-14T06:15:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0014', at: T('2026-11-14T19:30:00Z'), type: 'DEVICE_STATE', stage: 'leg-6', actor: 'DEV-SYN-REEFER-771',
        title: 'Calibration certificate for the pulp probe set lapsed mid-voyage', state: 'REQUIRES_REVIEW',
        body: { kind: 'DEVICE_STATE', device: 'DEV-SYN-REEFER-771', channels: ['PULP_1', 'PULP_2', 'PULP_3'],
          calibrationCertificate: 'CAL-SYN-2025-7741', validFrom: '2025-11-14', validTo: '2026-11-14',
          lapsedAt: '2026-11-14T00:00:00Z', samplesAfterLapse: 412,
          note: 'Samples recorded after the certificate validity window are not automatically wrong, but they are not admissible without a recorded review.' } },
      { id: 'EV-0015', at: T('2026-11-15T03:30:00Z'), type: 'HANDOFF', stage: 'leg-7', actor: 'ORG-SYN-OCEAN-02',
        title: 'Custody transferred to feeder carrier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 7, transferor: 'ORG-SYN-TERMINAL-SIN', transferee: 'ORG-SYN-OCEAN-02', offered: '2026-11-15T03:05:00Z', acknowledged: '2026-11-15T03:25:00Z', accepted: '2026-11-15T03:30:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0016', at: T('2026-11-16T02:00:00Z'), type: 'BACKFILL', stage: 'leg-7', actor: 'DEV-SYN-REEFER-771',
        title: 'Backfill of 31 hours of buffered samples after satellite reconnection', state: 'VERIFIED',
        body: { kind: 'BACKFILL', device: 'DEV-SYN-REEFER-771', bufferedFrom: '2026-11-14T19:00:00Z', bufferedTo: '2026-11-16T02:00:00Z',
          samples: 188, gapType: 'TRANSMIT_GAP', chunkSignature: 'SIG-SYN-CHUNK-4471', signedAtCapture: true, anchoredBatchAtArrival: 'BATCH-SYN-0004',
          note: 'A transmit gap, not a sampling gap: the samples existed and were signed at capture. Admitted as a new append; no prior record was rewritten.' } },
      { id: 'EV-0017', at: T('2026-11-17T08:50:00Z'), type: 'ARRIVAL', stage: 'leg-8', actor: 'ORG-SYN-TERMINAL-JKT',
        title: 'Vessel arrival and discharge at destination port', state: 'VERIFIED',
        body: { kind: 'ARRIVAL', port: 'Tanjung Priok', at: '2026-11-17T08:50:00Z', container: 'CNT-SYN-884201' } },
      { id: 'EV-0018', at: T('2026-11-17T11:20:00Z'), type: 'SEAL_EVENT', stage: 'leg-8', actor: 'ORG-SYN-BORDER-ID',
        title: 'Authorized seal open for border inspection, resealed', state: 'VERIFIED',
        body: { kind: 'SEAL_EVENT', seal: 'ESEAL-SYN-881029', transition: 'ARMED->OPEN_AUTHORIZED->RESEALED->ARMED',
          order: 'INSP-SYN-ID-5512', openedAt: '2026-11-17T11:20:00Z', closedAt: '2026-11-17T12:05:00Z', newSeal: 'ESEAL-SYN-881311', counter: 3 } },
      { id: 'EV-0019', at: T('2026-11-17T15:35:00Z'), type: 'HANDOFF', stage: 'leg-8', actor: 'ORG-SYN-COLDSTORE-ID',
        title: 'Final custody transfer to bonded cold store', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 8, transferor: 'ORG-SYN-HAULIER-ID', transferee: 'ORG-SYN-COLDSTORE-ID', offered: '2026-11-17T15:20:00Z', acknowledged: '2026-11-17T15:32:00Z', accepted: '2026-11-17T15:35:00Z', status: 'ACCEPTED', quantity: 18400, unit: 'kg' } },
      { id: 'EV-0020', at: T('2026-11-17T16:00:00Z'), type: 'SEGREGATION_DECLARED', stage: 'destination', actor: 'ORG-SYN-COLDSTORE-ID',
        title: 'Dedicated halal zoning declared for the storage interval', state: 'VERIFIED',
        body: { kind: 'SEGREGATION_DECLARED', zone: 'ZONE-SYN-H2', tier: 'FULL_DEDICATED_HALAL_FACILITY', from: '2026-11-17T16:00:00Z', to: null, coLoadedLots: [] } },
    ],
    /* Deliberately absent: no sertu witness appointment evidence for the
       destination annex, so CTL-RIT-01 resolves MISSING for ID but not MY. */
    missingEvidence: ['RECOGNITION_SNAPSHOT'],
  };

  /* ------------------------------------------------------------- journey 2

     Chilled beef, Brisbane to Riyadh. Shorter, cleaner, and the contrast
     case: this one's defect is regulatory rather than physical.              */

  const J2 = {
    id: 'HLC-26-10611',
    title: 'Chilled beef - Brisbane to Riyadh',
    product: { sku: 'SKU-CHL-BEEF-P1', category: 'CHILLED_RED_MEAT', description: 'Chilled boneless beef primals, vacuum packed',
      lot: 'LOT-CB-3310', quantity: 12600, unit: 'kg', packaging: 'Vacuum packed cartons, 18 pallets' },
    origin: { facility: 'FAC-SYN-AU-071', name: 'Queensland export abattoir (synthetic)', jurisdiction: 'AU', place: 'Brisbane', lat: -27.4698, lon: 153.0251 },
    destination: { facility: 'FAC-SYN-SA-556', name: 'Riyadh distribution centre (synthetic)', jurisdiction: 'SA', place: 'Riyadh', lat: 24.7136, lon: 46.6753 },
    transit: ['AE'],
    declaredProfile: { channel: 'TEMPERATURE_C', setpoint: -0.5, min: -1.5, max: 2.0, unit: 'degC',
      maxSamplingGapMin: 30, expectedCadenceMin: 5,
      exemption: 'No defrost exemption applies to a chilled profile. Any supply-air excursion counts against the profile.' },
    suggested: { jurisdictions: ['SA', 'AE', 'OIC'], frameworks: ['GSO-2055-1', 'UAE-S-2055-1', 'AU-EXPORT-PROGRAM', 'OIC-SMIIC-1', 'ISO-IEC-17025'] },
    legs: [
      { seq: 1, mode: 'ROAD', from: 'Export abattoir', to: 'Brisbane port', custodian: 'ORG-SYN-HAULIER-AU', custodianName: 'Export haulier (synthetic)',
        asset: 'TRK-SYN-2210', assetType: 'Reefer trailer', depart: T('2026-11-05T22:00:00Z'), arrive: T('2026-11-06T00:40:00Z') },
      { seq: 2, mode: 'MARITIME', from: 'Brisbane', to: 'Jebel Ali', custodian: 'ORG-SYN-OCEAN-03', custodianName: 'Ocean carrier (synthetic)',
        asset: 'MV SYNTHETIC AZURE', assetType: 'Container vessel (synthetic)', depart: T('2026-11-06T06:00:00Z'), arrive: T('2026-11-21T11:30:00Z') },
      { seq: 3, mode: 'TERMINAL', from: 'Jebel Ali', to: 'Jebel Ali bonded', custodian: 'ORG-SYN-TERMINAL-AE', custodianName: 'Gulf terminal operator (synthetic)',
        asset: 'CNT-SYN-771044', assetType: '40ft reefer container', depart: T('2026-11-21T11:30:00Z'), arrive: T('2026-11-22T07:15:00Z') },
      { seq: 4, mode: 'ROAD', from: 'Jebel Ali', to: 'Riyadh DC', custodian: 'ORG-SYN-HAULIER-GULF', custodianName: 'Cross-border haulier (synthetic)',
        asset: 'TRK-SYN-6690', assetType: 'Reefer trailer', depart: T('2026-11-22T07:15:00Z'), arrive: T('2026-11-23T20:40:00Z') },
    ],
    events: [
      { id: 'EV-0101', at: T('2026-11-05T08:00:00Z'), type: 'SLAUGHTER_RECORD', stage: 'origin', actor: 'ORG-SYN-ABATTOIR',
        title: 'Slaughter act recorded under the supervised export program', state: 'VERIFIED',
        body: { kind: 'SLAUGHTER_RECORD', lot: 'LOT-CB-3310', slaughterer: 'PSN-SYN-SLTR-4412', appointment: 'APPT-SYN-AIO-2026-88',
          appointmentValidFrom: '2026-01-01', appointmentValidTo: '2026-12-31', supervisingOrganisation: 'ORG-SYN-AIO-01',
          stunningApplied: false, observedFields: { tasmiyahObserved: true, severanceObserved: true },
          note: 'Observation fields are recorded as observations. Whether they satisfy a destination requirement is a determination made elsewhere.' } },
      { id: 'EV-0102', at: T('2026-11-05T14:00:00Z'), type: 'CERTIFICATE_PRESENTED', stage: 'origin', actor: 'ORG-SYN-AIO-01',
        title: 'Halal certificate presented by the supervising organisation', state: 'VERIFIED',
        body: { kind: 'CERTIFICATE_PRESENTED', lot: 'LOT-CB-3310', certificate: 'CERT-SYN-AIO-2026-1190', issuer: 'ORG-SYN-AIO-01',
          standard: 'AU-EXPORT-PROGRAM', validFrom: '2026-02-01', validTo: '2027-01-31', scope: 'CHILLED_RED_MEAT' } },
      { id: 'EV-0103', at: T('2026-11-05T14:30:00Z'), type: 'RECOGNITION_SNAPSHOT', stage: 'origin', actor: 'SYS-SYN-REGISTRY',
        title: 'Destination recognition of the issuing body lapsed before the event date', state: 'FAILED',
        body: { kind: 'RECOGNITION_SNAPSHOT', body: 'ORG-SYN-AIO-01', destination: 'SA', recognitionState: 'WITHDRAWN',
          withdrawnOn: '2026-10-28', certificateStillValidTo: '2027-01-31', snapshotDigestPinned: 'SNAP-SYN-SA-2026-11-05',
          note: 'The certificate is active and the recognition is withdrawn. These are separate objects and the certificate does not cure the recognition.' } },
      { id: 'EV-0104', at: T('2026-11-05T21:40:00Z'), type: 'SEAL_APPLIED', stage: 'origin', actor: 'ORG-SYN-ABATTOIR',
        title: 'Electronic seal armed', state: 'VERIFIED',
        body: { kind: 'SEAL_APPLIED', seal: 'ESEAL-SYN-771044', container: 'CNT-SYN-771044', state: 'ARMED', counter: 1 } },
      { id: 'EV-0105', at: T('2026-11-05T22:00:00Z'), type: 'HANDOFF', stage: 'leg-1', actor: 'ORG-SYN-HAULIER-AU',
        title: 'Custody transferred to export haulier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 1, transferor: 'ORG-SYN-ABATTOIR', transferee: 'ORG-SYN-HAULIER-AU', offered: '2026-11-05T21:50:00Z', acknowledged: '2026-11-05T21:56:00Z', accepted: '2026-11-05T22:00:00Z', status: 'ACCEPTED', quantity: 12600, unit: 'kg' } },
      { id: 'EV-0106', at: T('2026-11-06T06:00:00Z'), type: 'HANDOFF', stage: 'leg-2', actor: 'ORG-SYN-OCEAN-03',
        title: 'Custody transferred to ocean carrier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 2, transferor: 'ORG-SYN-HAULIER-AU', transferee: 'ORG-SYN-OCEAN-03', offered: '2026-11-06T05:30:00Z', acknowledged: '2026-11-06T05:52:00Z', accepted: '2026-11-06T06:00:00Z', status: 'ACCEPTED', quantity: 12600, unit: 'kg' } },
      { id: 'EV-0107', at: T('2026-11-13T04:15:00Z'), type: 'CLOCK_ANOMALY', stage: 'leg-2', actor: 'DEV-SYN-REEFER-5512',
        title: 'Device clock rolled back 90 minutes; sequence counter remained monotonic', state: 'REQUIRES_REVIEW',
        body: { kind: 'CLOCK_ANOMALY', device: 'DEV-SYN-REEFER-5512', rollbackMinutes: 90, detectedBy: 'SEQUENCE_COUNTER_MONOTONIC',
          sequenceIntact: true, affectedSamples: 1080, resolution: 'ORDER_BY_SEQUENCE_NOT_TIMESTAMP',
          note: 'Ordering falls back to the sequence counter. Wall-clock timestamps in this window are not reliable for interval arithmetic.' } },
      { id: 'EV-0108', at: T('2026-11-21T11:30:00Z'), type: 'HANDOFF', stage: 'leg-3', actor: 'ORG-SYN-TERMINAL-AE',
        title: 'Custody transferred at Gulf terminal', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 3, transferor: 'ORG-SYN-OCEAN-03', transferee: 'ORG-SYN-TERMINAL-AE', offered: '2026-11-21T11:05:00Z', acknowledged: '2026-11-21T11:25:00Z', accepted: '2026-11-21T11:30:00Z', status: 'ACCEPTED', quantity: 12600, unit: 'kg' } },
      { id: 'EV-0109', at: T('2026-11-22T03:00:00Z'), type: 'LAB_RESULT', stage: 'leg-3', actor: 'LAB-SYN-AE-02',
        title: 'Species-identity screening: not detected, within accredited scope', state: 'VERIFIED',
        body: { kind: 'LAB_RESULT', report: 'RPT-SYN-44120', sample: 'SMP-SYN-7742', facility: 'LAB-SYN-AE-02', method: 'MTH-SYN-PCR-PORCINE-v4',
          matrix: 'BOVINE_MUSCLE', analyte: 'PORCINE_DNA', resultState: 'NOT_DETECTED', value: null, lod: '0.01 % w/w', loq: '0.05 % w/w',
          qcControls: { extractionBlank: 'PASS', negativeControl: 'PASS', positiveControl: 'PASS', internalAmplification: 'PASS' },
          scopeMatch: 'IN_SCOPE', scopeSnapshot: 'SCOPE-SYN-AE-2026-Q4-02', analysisDate: '2026-11-22', reportDate: '2026-11-22',
          inferenceScope: 'LOT_UNDER_PLAN', samplingPlan: 'PLAN-SYN-RAND-300', increments: 300, signer: 'PSN-SYN-SIGNATORY-31' } },
      { id: 'EV-0110', at: T('2026-11-22T07:15:00Z'), type: 'HANDOFF', stage: 'leg-4', actor: 'ORG-SYN-HAULIER-GULF',
        title: 'Custody transferred to cross-border haulier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 4, transferor: 'ORG-SYN-TERMINAL-AE', transferee: 'ORG-SYN-HAULIER-GULF', offered: '2026-11-22T07:00:00Z', acknowledged: '2026-11-22T07:12:00Z', accepted: '2026-11-22T07:15:00Z', status: 'ACCEPTED', quantity: 12600, unit: 'kg' } },
      { id: 'EV-0111', at: T('2026-11-23T20:40:00Z'), type: 'ARRIVAL', stage: 'leg-4', actor: 'ORG-SYN-DC-SA',
        title: 'Arrival at destination distribution centre', state: 'VERIFIED',
        body: { kind: 'ARRIVAL', place: 'Riyadh DC', at: '2026-11-23T20:40:00Z', container: 'CNT-SYN-771044' } },
    ],
    missingEvidence: ['SERTU_EVENT'],
  };

  /* ------------------------------------------------------------- journey 3

     Processed ingredients, Chicago to Kuala Lumpur by air then road. The
     short, fast, air-cargo contrast: different gap tolerances, different
     segregation question (ULD co-loading rather than container stuffing).    */

  const J3 = {
    id: 'HLC-26-10733',
    title: 'Processed ingredients - Chicago to Kuala Lumpur',
    product: { sku: 'SKU-ING-EMUL-C4', category: 'FOOD_INGREDIENTS', description: 'Emulsifier blend, animal-derived input declared',
      lot: 'LOT-IN-9041', quantity: 2200, unit: 'kg', packaging: '44 drums on 4 air pallets' },
    origin: { facility: 'FAC-SYN-US-220', name: 'Midwest ingredient plant (synthetic)', jurisdiction: 'US', place: 'Chicago', lat: 41.8781, lon: -87.6298 },
    destination: { facility: 'FAC-SYN-MY-318', name: 'Klang Valley blending facility (synthetic)', jurisdiction: 'MY', place: 'Kuala Lumpur', lat: 3.139, lon: 101.6869 },
    transit: ['NL'],
    declaredProfile: { channel: 'TEMPERATURE_C', setpoint: 18.0, min: 8.0, max: 25.0, unit: 'degC',
      maxSamplingGapMin: 45, expectedCadenceMin: 15,
      exemption: 'Ramp excursions during air-side tarmac exposure are permitted up to 25 minutes provided the product core remains within profile.' },
    suggested: { jurisdictions: ['MY', 'OIC'], frameworks: ['MS-1500-2019', 'MS-2400-1-2019', 'OIC-SMIIC-17-1', 'US-PRIVATE-ASSURANCE'] },
    legs: [
      { seq: 1, mode: 'ROAD', from: 'Ingredient plant', to: 'Chicago air cargo', custodian: 'ORG-SYN-HAULIER-US', custodianName: 'Domestic haulier (synthetic)',
        asset: 'TRK-SYN-3301', assetType: 'Dry van', depart: T('2026-11-08T13:00:00Z'), arrive: T('2026-11-08T15:20:00Z') },
      { seq: 2, mode: 'AIR', from: 'Chicago', to: 'Amsterdam', custodian: 'ORG-SYN-AIR-01', custodianName: 'Air carrier (synthetic)',
        asset: 'ULD-SYN-PMC-4471', assetType: 'PMC air pallet', depart: T('2026-11-08T21:45:00Z'), arrive: T('2026-11-09T09:10:00Z') },
      { seq: 3, mode: 'AIR', from: 'Amsterdam', to: 'Kuala Lumpur', custodian: 'ORG-SYN-AIR-02', custodianName: 'Air carrier (synthetic)',
        asset: 'ULD-SYN-PMC-4471', assetType: 'PMC air pallet', depart: T('2026-11-09T14:30:00Z'), arrive: T('2026-11-10T07:05:00Z') },
      { seq: 4, mode: 'ROAD', from: 'KUL air cargo', to: 'Blending facility', custodian: 'ORG-SYN-HAULIER-MY', custodianName: 'Destination haulier (synthetic)',
        asset: 'TRK-SYN-8812', assetType: 'Box truck', depart: T('2026-11-10T11:40:00Z'), arrive: T('2026-11-10T13:15:00Z') },
    ],
    events: [
      { id: 'EV-0201', at: T('2026-11-07T10:00:00Z'), type: 'INGREDIENT_DECLARATION', stage: 'origin', actor: 'ORG-SYN-PLANT-US',
        title: 'Animal-derived input declared with upstream certificate reference', state: 'REQUIRES_REVIEW',
        body: { kind: 'INGREDIENT_DECLARATION', lot: 'LOT-IN-9041', inputs: [
          { id: 'ING-SYN-001', name: 'Mono- and diglycerides', source: 'ANIMAL_DERIVED', upstreamCertificate: 'CERT-SYN-UP-7781', upstreamCertificateState: 'UNRESOLVED' },
          { id: 'ING-SYN-002', name: 'Vegetable carrier oil', source: 'PLANT_DERIVED', upstreamCertificate: 'CERT-SYN-UP-2210', upstreamCertificateState: 'ACTIVE' }],
          note: 'An animal-derived input whose upstream certificate cannot be resolved is the single highest-risk pattern in ingredient trade.' } },
      { id: 'EV-0202', at: T('2026-11-08T12:30:00Z'), type: 'SEAL_APPLIED', stage: 'origin', actor: 'ORG-SYN-PLANT-US',
        title: 'Tamper-evident seals applied to 4 air pallets', state: 'VERIFIED',
        body: { kind: 'SEAL_APPLIED', seal: 'ESEAL-SYN-PMC-4471', container: 'ULD-SYN-PMC-4471', state: 'ARMED', counter: 1 } },
      { id: 'EV-0203', at: T('2026-11-08T13:00:00Z'), type: 'HANDOFF', stage: 'leg-1', actor: 'ORG-SYN-HAULIER-US',
        title: 'Custody transferred to domestic haulier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 1, transferor: 'ORG-SYN-PLANT-US', transferee: 'ORG-SYN-HAULIER-US', offered: '2026-11-08T12:50:00Z', acknowledged: '2026-11-08T12:56:00Z', accepted: '2026-11-08T13:00:00Z', status: 'ACCEPTED', quantity: 2200, unit: 'kg' } },
      { id: 'EV-0204', at: T('2026-11-08T21:45:00Z'), type: 'HANDOFF', stage: 'leg-2', actor: 'ORG-SYN-AIR-01',
        title: 'Custody transferred to air carrier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 2, transferor: 'ORG-SYN-HAULIER-US', transferee: 'ORG-SYN-AIR-01', offered: '2026-11-08T20:10:00Z', acknowledged: '2026-11-08T21:30:00Z', accepted: '2026-11-08T21:45:00Z', status: 'ACCEPTED', quantity: 2200, unit: 'kg' } },
      { id: 'EV-0205', at: T('2026-11-09T09:40:00Z'), type: 'CO_LOAD_DECLARED', stage: 'leg-2', actor: 'ORG-SYN-AIR-01',
        title: 'ULD co-load manifest declares adjacent non-halal consignment on the same pallet position', state: 'FAILED',
        body: { kind: 'CO_LOAD_DECLARED', uld: 'ULD-SYN-PMC-4471', position: 'MAIN-DECK-3L',
          adjacentConsignments: [{ ref: 'CNS-SYN-OTHER-2201', halalStatus: 'NOT_DECLARED_HALAL', separation: 'NONE_DECLARED' }],
          note: 'Air consolidation is the weakest point in ingredient logistics. Without declared separation this breaks segregation for every destination that requires it.' } },
      { id: 'EV-0206', at: T('2026-11-09T14:30:00Z'), type: 'HANDOFF', stage: 'leg-3', actor: 'ORG-SYN-AIR-02',
        title: 'Custody transferred to onward air carrier', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 3, transferor: 'ORG-SYN-AIR-01', transferee: 'ORG-SYN-AIR-02', offered: '2026-11-09T13:20:00Z', acknowledged: '2026-11-09T14:15:00Z', accepted: '2026-11-09T14:30:00Z', status: 'ACCEPTED', quantity: 2200, unit: 'kg' } },
      { id: 'EV-0207', at: T('2026-11-10T07:05:00Z'), type: 'ARRIVAL', stage: 'leg-3', actor: 'ORG-SYN-AIR-02',
        title: 'Arrival at destination air cargo terminal', state: 'VERIFIED',
        body: { kind: 'ARRIVAL', place: 'KUL air cargo', at: '2026-11-10T07:05:00Z', uld: 'ULD-SYN-PMC-4471' } },
      { id: 'EV-0208', at: T('2026-11-10T09:30:00Z'), type: 'EXCEPTION_RAISED', stage: 'destination', actor: 'ORG-SYN-IMPORTER-MY',
        title: 'Exception raised on the co-load finding; consignment placed on internal hold', state: 'VERIFIED',
        body: { kind: 'EXCEPTION_RAISED', issue: 'ISS-SYN-0031', severity: 'HIGH', linkedEvent: 'EV-0205',
          containment: 'INTERNAL_HOLD', owner: 'PSN-SYN-QA-14', due: '2026-11-17',
          note: 'Containment is a commercial disposition. It is not a regulatory outcome and does not resolve the finding.' } },
      { id: 'EV-0209', at: T('2026-11-10T13:15:00Z'), type: 'HANDOFF', stage: 'leg-4', actor: 'ORG-SYN-BLENDER-MY',
        title: 'Custody transferred to blending facility under hold', state: 'VERIFIED',
        body: { kind: 'HANDOFF', leg: 4, transferor: 'ORG-SYN-HAULIER-MY', transferee: 'ORG-SYN-BLENDER-MY', offered: '2026-11-10T13:05:00Z', acknowledged: '2026-11-10T13:12:00Z', accepted: '2026-11-10T13:15:00Z', status: 'ACCEPTED_WITH_EXCEPTION', quantity: 2200, unit: 'kg' } },
    ],
    missingEvidence: ['SAMPLING_PLAN', 'LAB_REPORT'],
  };

  /* ---------------------------------------------------------- mandates

     A custodian's mandate is separate evidence from the handoff itself. A
     signed handoff proves an account acted; it does not prove the account
     was entitled to act. These records carry the entitlement, with an
     effective interval, so a handoff signed outside the interval can be
     detected rather than assumed valid.

     `conveyance` records whether the unit is a dedicated sealed load or a
     consolidated one. Segregation is evidenced very differently in each:
     a full sealed container needs no co-load manifest, while a consolidated
     air pallet is meaningless without one.                                 */

  J1.mandates = [
    { org: 'ORG-SYN-PROCESSOR', role: 'CONSIGNOR', mandate: 'MND-SYN-0011', from: '2026-01-01', to: '2027-06-30' },
    { org: 'ORG-SYN-HAULIER-01', role: 'CARRIER', mandate: 'MND-SYN-0042', from: '2026-03-01', to: '2027-02-28' },
    { org: 'ORG-SYN-TERMINAL-JED', role: 'TERMINAL', mandate: 'MND-SYN-0077', from: '2025-07-01', to: '2027-06-30' },
    { org: 'ORG-SYN-OCEAN-01', role: 'CARRIER', mandate: 'MND-SYN-0103', from: '2026-01-15', to: '2027-01-14' },
    { org: 'ORG-SYN-TERMINAL-CMB', role: 'TERMINAL', mandate: 'MND-SYN-0118', from: '2026-02-01', to: '2027-01-31' },
    { org: 'ORG-SYN-TERMINAL-SIN', role: 'TERMINAL', mandate: 'MND-SYN-0121', from: '2026-02-01', to: '2027-01-31' },
    { org: 'ORG-SYN-OCEAN-02', role: 'CARRIER', mandate: 'MND-SYN-0140', from: '2026-04-01', to: '2027-03-31' },
    { org: 'ORG-SYN-HAULIER-ID', role: 'CARRIER', mandate: 'MND-SYN-0155', from: '2026-01-01', to: '2027-12-31' },
    { org: 'ORG-SYN-COLDSTORE-ID', role: 'WAREHOUSE', mandate: 'MND-SYN-0162', from: '2026-01-01', to: '2027-12-31' },
  ];
  J1.conveyance = { kind: 'DEDICATED_SEALED_UNIT', unit: 'CNT-SYN-884201', consolidated: false,
    note: 'Full container load under a single seal. Segregation is evidenced by the dedicated sealed unit and its seal chain; there is no co-load to declare.' };

  J2.mandates = [
    { org: 'ORG-SYN-ABATTOIR', role: 'CONSIGNOR', mandate: 'MND-SYN-0210', from: '2026-01-01', to: '2027-06-30' },
    { org: 'ORG-SYN-HAULIER-AU', role: 'CARRIER', mandate: 'MND-SYN-0221', from: '2026-01-01', to: '2027-01-01' },
    { org: 'ORG-SYN-OCEAN-03', role: 'CARRIER', mandate: 'MND-SYN-0233', from: '2026-02-01', to: '2027-01-31' },
    { org: 'ORG-SYN-TERMINAL-AE', role: 'TERMINAL', mandate: 'MND-SYN-0248', from: '2026-01-01', to: '2027-12-31' },
    { org: 'ORG-SYN-HAULIER-GULF', role: 'CARRIER', mandate: 'MND-SYN-0255', from: '2026-05-01', to: '2027-04-30' },
  ];
  J2.conveyance = { kind: 'DEDICATED_SEALED_UNIT', unit: 'CNT-SYN-771044', consolidated: false,
    note: 'Full container load under a single seal; no co-load to declare.' };

  // Journey 3 deliberately lacks a mandate for the second air carrier: the
  // handoff is signed, but nothing evidences that the signer was entitled.
  J3.mandates = [
    { org: 'ORG-SYN-PLANT-US', role: 'CONSIGNOR', mandate: 'MND-SYN-0301', from: '2026-01-01', to: '2027-06-30' },
    { org: 'ORG-SYN-HAULIER-US', role: 'CARRIER', mandate: 'MND-SYN-0312', from: '2026-01-01', to: '2027-01-01' },
    { org: 'ORG-SYN-AIR-01', role: 'CARRIER', mandate: 'MND-SYN-0324', from: '2026-03-01', to: '2027-02-28' },
    { org: 'ORG-SYN-HAULIER-MY', role: 'CARRIER', mandate: 'MND-SYN-0340', from: '2026-01-01', to: '2027-12-31' },
    { org: 'ORG-SYN-BLENDER-MY', role: 'CONSIGNEE', mandate: 'MND-SYN-0351', from: '2026-01-01', to: '2027-12-31' },
  ];
  J3.conveyance = { kind: 'CONSOLIDATED_UNIT', unit: 'ULD-SYN-PMC-4471', consolidated: true,
    note: 'Consolidated air pallet. Segregation cannot be inferred from the unit: it depends entirely on the co-load manifest and the separation declared in it.' };

  const JOURNEYS = [J1, J2, J3];

  /* ------------------------------------------------- derived, hashed state

     Digests are computed at load from the canonical form of each event body,
     so nothing here is a hard-coded hash that could drift from its content.
     Edit any field above and every digest, the chain and the root change.    */

  function build() {
    const C = VS.crypto;
    JOURNEYS.forEach((j) => {
      j.events.sort((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : a.id < b.id ? -1 : 1));
      let prev = null;
      j.events.forEach((e, i) => {
        e.seq = i;
        e.dataHash = C.digest(e.body);
        e.eventHash = C.chainLink(prev, e.body);
        e.prevHash = prev;
        prev = e.eventHash;
      });
      j.chainHead = prev;
      j.leaves = j.events.map((e) => C.canonicalize(e.body));
      j.merkleRoot = C.merkleRoot(j.leaves);
      j.batchId = 'BATCH-SYN-' + j.id.slice(-4);
      // Anchor state is SIMULATED, always. No external write occurs in a demo,
      // and labelling it ANCHORED would be exactly the false claim the whole
      // product exists to prevent.
      j.anchor = { state: 'SIMULATED', profile: 'VS-MERKLE-SHA256-1',
        note: 'No external commitment was made. In production this root would be submitted to the configured destinations and the receipt recorded here.' };
    });
    return JOURNEYS;
  }

  VS.journeys = {
    all: JOURNEYS,
    build: build,
    byId: (id) => JOURNEYS.filter((j) => j.id === id)[0],
  };
})(typeof window !== 'undefined' ? window : globalThis);