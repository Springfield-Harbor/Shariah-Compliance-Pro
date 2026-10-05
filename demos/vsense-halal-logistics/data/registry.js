/* ===========================================================================
   VSENSE Halal Logistics - reference registry
   ---------------------------------------------------------------------------
   Jurisdictions, authorities, frameworks, controls, personas and the state
   vocabularies the whole demo shares.

   Three disciplines are enforced by the shape of this data, not by UI code:

   1. SEPARATION. Certification, accreditation, recognition, registration,
      portal submission, authority decision, customs release and commercial
      release are distinct objects with their own state enums. Nothing here
      lets one of them be inferred from another.

   2. NO AGGREGATE SCORE. Controls carry states, never weights. There is
      nothing in this file that could be averaged into a "compliance %".

   3. SYNTHETIC IDENTITY. Every organization, vessel, facility and person is
      obviously invented. The v3 evidence model named a real ocean carrier in
      its sample payload; that is a fixture-hygiene defect this file does not
      repeat.

   Classic script. Hangs off window.VS.registry.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  /* --------------------------------------------------------- vocabularies */

  // Evidence and control states. Deliberately NOT ordinal: there is no
  // arithmetic that turns these into a score, which is the point.
  const EVIDENCE_STATE = {
    VERIFIED: { label: 'Verified', tone: 'verified', glyph: 'check', desc: 'The named local check succeeded against the bytes held.' },
    FAILED: { label: 'Failed', tone: 'failed', glyph: 'cross', desc: 'The evidence contradicts or fails the control.' },
    MISSING: { label: 'Missing', tone: 'missing', glyph: 'dash', desc: 'Required evidence is absent.' },
    SIMULATED: { label: 'Simulated', tone: 'simulated', glyph: 'flask', desc: 'Demo-only receipt, proof or external event. Never an authority outcome.' },
    REQUIRES_REVIEW: { label: 'Requires review', tone: 'review', glyph: 'eye', desc: 'A qualified human judgement is still required.' },
    INSUFFICIENT_COVERAGE: { label: 'Insufficient coverage', tone: 'review', glyph: 'gap', desc: 'Values may be in range, but coverage, calibration, clock or device identity is unresolved.' },
    NOT_APPLICABLE: { label: 'Not applicable', tone: 'muted', glyph: 'dot', desc: 'Excluded by a recorded applicability predicate.' },
  };

  // Laboratory result states. Nine mutually exclusive values, per Council A
  // member M5. Collapsing BELOW_LOQ into NOT_DETECTED, or INVALID into
  // DETECTED, destroys evidence -- so the vocabulary refuses to allow it.
  const LAB_RESULT_STATE = {
    DETECTED: 'Analyte detected at or above the limit of detection.',
    NOT_DETECTED: 'Analyte not detected at the stated limit of detection.',
    BELOW_LOQ: 'Detected but below the limit of quantification; not a zero.',
    INCONCLUSIVE: 'Run did not resolve; neither presence nor absence is supported.',
    INVALID: 'Analytical run failed its own QC; no result may be read from it.',
    SAMPLE_COMPROMISED: 'Pre-analytical failure: identity, seal, temperature or hold time breached.',
    NOT_TESTED: 'Analyte within scope of the plan but not analysed.',
    NO_SAMPLE: 'No sample was drawn for this lot or matrix.',
    WITHDRAWN: 'Previously issued result withdrawn by the issuing facility.',
  };

  // Telemetry coverage, per Council A member M3. "All samples in range" is
  // not evidence of compliance if the samples are inadmissible or sparse.
  const COVERAGE_STATE = {
    PASS: 'Admissible devices, continuous coverage, values within the declared profile.',
    FAIL: 'An admissible series shows values outside the declared profile.',
    INSUFFICIENT_COVERAGE: 'Coverage, calibration, clock discipline or device identity is unresolved.',
    REQUIRES_REVIEW: 'Gaps exist with compensating evidence that a human must weigh.',
  };

  /* ------------------------------------------------- the separation lattice

     Eleven distinct objects. Each has its own state enum, and each carries an
     explicit statement of what may NOT be concluded from it. The audit packet
     renders these as separate rows and never merges them -- the single most
     common way an evidence product misleads is by letting "certificate valid"
     read as "authority accepted".                                            */

  const SEPARATION_LATTICE = [
    { id: 'ACCREDITATION', label: 'Accreditation', holder: 'Certification body or laboratory',
      states: ['ACTIVE', 'SUSPENDED', 'WITHDRAWN', 'LAPSED', 'UNRESOLVED'],
      notImplied: 'Does not mean any particular certificate, report or consignment is valid.' },
    { id: 'CERTIFICATION', label: 'Certification', holder: 'Producer, facility or product',
      states: ['ACTIVE', 'SUSPENDED', 'EXPIRED', 'WITHDRAWN', 'UNRESOLVED'],
      notImplied: 'Does not mean a destination authority recognises it, nor that this lot conforms.' },
    { id: 'REGISTRATION', label: 'Registration', holder: 'Establishment or product in a destination register',
      states: ['REGISTERED', 'PENDING', 'REJECTED', 'LAPSED', 'UNRESOLVED'],
      notImplied: 'Does not mean the consignment is cleared or the claim is accepted.' },
    { id: 'APPOINTMENT', label: 'Appointment', holder: 'Inspector, slaughterer or witness',
      states: ['APPOINTED', 'SUSPENDED', 'REVOKED', 'EXPIRED', 'UNRESOLVED'],
      notImplied: 'A job title is not a mandate. Appointment must be evidenced for the date of the act.' },
    { id: 'RECOGNITION', label: 'Recognition', holder: 'Foreign body recognised by a destination authority',
      states: ['RECOGNISED', 'CONDITIONAL', 'NOT_RECOGNISED', 'WITHDRAWN', 'UNRESOLVED'],
      notImplied: 'Withdrawal can occur on a date wholly independent of certificate expiry.' },
    { id: 'MRA', label: 'Mutual recognition arrangement', holder: 'Two or more authorities',
      states: ['IN_FORCE', 'SCOPE_LIMITED', 'SUSPENDED', 'NONE', 'UNRESOLVED'],
      notImplied: 'Scope is product- and activity-limited. An MRA rarely covers everything.' },
    { id: 'FOREIGN_CERT_REGISTRATION', label: 'Foreign certificate registration', holder: 'Certificate lodged in a destination system',
      states: ['REGISTERED', 'PENDING', 'REJECTED', 'NOT_LODGED', 'UNRESOLVED'],
      notImplied: 'Lodgement is not examination, and examination is not acceptance.' },
    { id: 'PORTAL_SUBMISSION', label: 'Portal submission', holder: 'The submitting party',
      states: ['NOT_SUBMITTED', 'SUBMITTED', 'ACKNOWLEDGED', 'REJECTED_ON_FORM', 'UNRESOLVED'],
      notImplied: 'An acknowledgement is a receipt for bytes, never a decision on merits.' },
    { id: 'AUTHORITY_DECISION', label: 'Authority decision', holder: 'The competent authority alone',
      states: ['NONE', 'GRANTED', 'GRANTED_WITH_CONDITIONS', 'REFUSED', 'UNDER_QUERY'],
      notImplied: 'No local field, score or proof may infer this. Only an authenticated authority event sets it.' },
    { id: 'CUSTOMS_RELEASE', label: 'Customs release', holder: 'Border authority',
      states: ['NOT_RELEASED', 'HELD', 'RELEASED', 'DETAINED', 'REFUSED_ENTRY'],
      notImplied: 'Independent of halal conformity. Either can succeed while the other fails.' },
    { id: 'COMMERCIAL_RELEASE', label: 'Commercial release', holder: 'The goods owner',
      states: ['HOLD', 'RELEASED_FOR_SALE', 'QUARANTINED', 'REJECTED', 'RECALLED'],
      notImplied: 'An internal business decision. Never evidence of regulatory acceptance.' },
  ];

  /* -------------------------------------------------------- jurisdictions

     `region` groups them for the regulatory briefing. `role` is assigned per
     route at selection time, not here: the same jurisdiction is an origin on
     one journey and a destination on another.                                */

  const JURISDICTIONS = [
    { id: 'ID', name: 'Indonesia', region: 'Southeast Asia', flag: 'ID',
      authorities: ['ID-BPJPH', 'ID-LPH-FATWA', 'ID-BPOM', 'ID-BORDER', 'ID-KEMKES'],
      frameworks: ['ID-LAW-33-2014', 'ID-PP-42-2024', 'ID-HAS-23000'],
      residency: 'Destination-side expectation of in-country lodgement for halal records; evidence anchoring must not export identifiers.',
      note: 'Halal is mandatory-scope and staged by product category. Law 33/2014 as amended (incl. Law 6/2023); PP 42/2024 replaced PP 39/2021. The "Law 39/2014" citation widespread in older material is a mis-citation.' },
    { id: 'MY', name: 'Malaysia', region: 'Southeast Asia', flag: 'MY',
      authorities: ['MY-JAKIM', 'MY-JAIN-MAIN', 'MY-DVS', 'MY-MAQIS', 'MY-FOOD-BORDER'],
      frameworks: ['MS-1500-2019', 'MS-2400-1-2019', 'MS-2400-2-2019', 'MS-2400-3-2019'],
      residency: 'Recognition of a foreign body is a separate object from certificate validity and can be withdrawn independently.',
      note: 'MS 2400 is the logistics series: transportation, warehousing and retailing are distinct parts.' },
    { id: 'TH', name: 'Thailand', region: 'Southeast Asia', flag: 'TH',
      authorities: ['TH-CICOT', 'TH-DLD', 'TH-FDA', 'TH-BORDER'],
      frameworks: ['TH-CICOT-HLAB'], residency: 'No specific constraint recorded in the source register.',
      note: 'Laboratory science capability is a distinguishing feature of the national scheme.' },
    { id: 'SG', name: 'Singapore', region: 'Southeast Asia', flag: 'SG',
      authorities: ['SG-MUIS', 'SG-SFA', 'SG-HSA', 'SG-CUSTOMS'],
      frameworks: ['SG-MUIS-SCHEME'], residency: 'Common transshipment node; transit role rarely triggers destination halal conformity by itself.',
      note: 'Frequently a transit or transshipment jurisdiction rather than a destination.' },
    { id: 'SA', name: 'Saudi Arabia', region: 'Gulf / GCC', flag: 'SA',
      authorities: ['SA-HALAL', 'SA-SFDA-FOOD', 'SA-SFDA-DRUG', 'SA-SFDA-COSMETIC', 'SA-SFDA-DEVICE', 'SA-SASO', 'SA-BORDER'],
      frameworks: ['GSO-2055-1', 'GSO-2469'], residency: 'Conformity and import clearance flow through separate national systems.',
      note: 'Slaughter requirements are the most frequently divergent control in this jurisdiction.' },
    { id: 'AE', name: 'United Arab Emirates', region: 'Gulf / GCC', flag: 'AE',
      authorities: ['AE-MOIAT', 'AE-EDE', 'AE-LOCAL-FOOD', 'AE-LOCAL-COSMETIC', 'AE-BORDER'],
      frameworks: ['UAE-S-2055-1', 'GSO-2055-1'], residency: 'Federal and emirate-level requirements can both apply to one consignment.',
      note: 'A national halal mark scheme sits over the GSO standards layer. UAE.S 993 is a different instrument from UAE.S 2055-1.' },
    { id: 'US', name: 'United States', region: 'North America', flag: 'US',
      authorities: ['US-FSIS', 'US-FDA', 'US-CBP', 'US-AHF', 'US-IFANCA', 'US-ISWA'],
      frameworks: ['US-PRIVATE-ASSURANCE'], residency: 'Halal assurance is private/contractual; export certification is a separate government act.',
      note: 'No federal halal standard. Halal conformity is scheme-based; government role is food safety and export certification.' },
    { id: 'CA', name: 'Canada', region: 'North America', flag: 'CA',
      authorities: ['CA-CFIA', 'CA-CBSA', 'CA-HEALTH', 'CA-HMA'],
      frameworks: ['CA-PRIVATE-ASSURANCE'], residency: 'Labelling rules govern the halal claim; conformity itself is scheme-based.',
      note: 'Halal claims are regulated as claims, which is a different mechanism from certifying conformity.' },
    { id: 'EU', name: 'European Union', region: 'Europe', flag: 'EU',
      authorities: ['EU-FOOD', 'EU-BORDER', 'EU-MEDICINE', 'EU-COSMETIC', 'EU-DEVICE-CA', 'EU-NOTIFIED-BODY', 'EU-HALAL-CONTROL'],
      frameworks: ['EU-FOOD-LAW', 'EU-PRIVATE-ASSURANCE'],
      residency: 'Personal data in evidence is subject to transfer rules; this constrains what may be anchored or disclosed.',
      note: 'Union law plus a member-state layer. Halal conformity is private; official controls are a separate track.' },
    { id: 'AU', name: 'Australia', region: 'Oceania', flag: 'AU',
      authorities: ['AU-DAFF', 'AU-AIO', 'AU-FOOD-BORDER', 'AU-TGA', 'AU-AICIS'],
      frameworks: ['AU-EXPORT-PROGRAM'], residency: 'Government-supervised export program for halal red meat is a distinguishing feature.',
      note: 'Approved islamic organisation arrangements sit alongside the government export program.' },
    { id: 'OIC', name: 'OIC / SMIIC layer', region: 'Cross-cutting', flag: 'OIC',
      authorities: ['OIC-SMIIC', 'GLOBAL-ACCREDITATION', 'GLOBAL-LAB'],
      frameworks: ['OIC-SMIIC-1', 'OIC-SMIIC-17-1', 'OIC-SMIIC-17-2', 'ISO-IEC-17025', 'ISO-IEC-17065'],
      residency: 'Applies only where a national authority has adopted it or a contract incorporates it.',
      note: 'Not self-executing. Adoption or a contractual basis is required before any SMIIC clause binds.' },
  ];

  /* ------------------------------------------------------------ authorities

     `kind` drives the separation discipline: a HALAL_AUTHORITY outcome can
     never populate a BORDER_CONTROL state, and vice versa.                   */

  const AUTHORITIES = {
    'ID-BPJPH': { name: 'National halal administering body (ID)', kind: 'HALAL_AUTHORITY', jurisdiction: 'ID', scope: 'Halal certification administration, foreign certificate registration, recognition.' },
    'ID-LPH-FATWA': { name: 'Halal inspection body and fatwa commission (ID)', kind: 'HALAL_AUTHORITY', jurisdiction: 'ID', scope: 'Inspection, audit and religious determination. Determination is not a product test.' },
    'ID-BPOM': { name: 'Food and drug control agency (ID)', kind: 'PRODUCT_SAFETY', jurisdiction: 'ID', scope: 'Product safety and market authorization. Separate from halal conformity.' },
    'ID-BORDER': { name: 'Border and quarantine control (ID)', kind: 'BORDER_CONTROL', jurisdiction: 'ID', scope: 'Import control, documentary and physical checks, release.' },
    'ID-KEMKES': { name: 'Health ministry (ID)', kind: 'PRODUCT_SAFETY', jurisdiction: 'ID', scope: 'Health product oversight.' },
    'MY-JAKIM': { name: 'Federal halal authority (MY)', kind: 'HALAL_AUTHORITY', jurisdiction: 'MY', scope: 'Halal certification and recognition of foreign certification bodies.' },
    'MY-JAIN-MAIN': { name: 'State religious authority (MY)', kind: 'HALAL_AUTHORITY', jurisdiction: 'MY', scope: 'State-level halal certification and enforcement.' },
    'MY-DVS': { name: 'Veterinary services (MY)', kind: 'PRODUCT_SAFETY', jurisdiction: 'MY', scope: 'Animal health and abattoir approval for import.' },
    'MY-MAQIS': { name: 'Quarantine and inspection service (MY)', kind: 'BORDER_CONTROL', jurisdiction: 'MY', scope: 'Border quarantine and inspection.' },
    'MY-FOOD-BORDER': { name: 'Food safety border control (MY)', kind: 'BORDER_CONTROL', jurisdiction: 'MY', scope: 'Imported food inspection and sampling.' },
    'TH-CICOT': { name: 'Central islamic committee (TH)', kind: 'HALAL_AUTHORITY', jurisdiction: 'TH', scope: 'Halal certification and the national halal mark.' },
    'TH-DLD': { name: 'Livestock development department (TH)', kind: 'PRODUCT_SAFETY', jurisdiction: 'TH', scope: 'Livestock and abattoir oversight.' },
    'TH-FDA': { name: 'Food and drug administration (TH)', kind: 'PRODUCT_SAFETY', jurisdiction: 'TH', scope: 'Food and drug market authorization.' },
    'TH-BORDER': { name: 'Border control (TH)', kind: 'BORDER_CONTROL', jurisdiction: 'TH', scope: 'Import clearance.' },
    'SG-MUIS': { name: 'Islamic religious council (SG)', kind: 'HALAL_AUTHORITY', jurisdiction: 'SG', scope: 'Halal certification scheme.' },
    'SG-SFA': { name: 'Food agency (SG)', kind: 'PRODUCT_SAFETY', jurisdiction: 'SG', scope: 'Food safety and import licensing.' },
    'SG-HSA': { name: 'Health sciences authority (SG)', kind: 'PRODUCT_SAFETY', jurisdiction: 'SG', scope: 'Health products.' },
    'SG-CUSTOMS': { name: 'Customs (SG)', kind: 'BORDER_CONTROL', jurisdiction: 'SG', scope: 'Customs clearance and transshipment.' },
    'SA-HALAL': { name: 'National halal centre (SA)', kind: 'HALAL_AUTHORITY', jurisdiction: 'SA', scope: 'Halal conformity and recognition of foreign bodies.' },
    'SA-SFDA-FOOD': { name: 'Food and drug authority, food (SA)', kind: 'PRODUCT_SAFETY', jurisdiction: 'SA', scope: 'Imported food control and market authorization.' },
    'SA-SFDA-DRUG': { name: 'Food and drug authority, drugs (SA)', kind: 'PRODUCT_SAFETY', jurisdiction: 'SA', scope: 'Pharmaceutical authorization.' },
    'SA-SFDA-COSMETIC': { name: 'Food and drug authority, cosmetics (SA)', kind: 'PRODUCT_SAFETY', jurisdiction: 'SA', scope: 'Cosmetic notification and control.' },
    'SA-SFDA-DEVICE': { name: 'Food and drug authority, devices (SA)', kind: 'PRODUCT_SAFETY', jurisdiction: 'SA', scope: 'Medical device authorization.' },
    'SA-SASO': { name: 'Standards organization (SA)', kind: 'STANDARDS_BODY', jurisdiction: 'SA', scope: 'Standards and conformity assessment programs.' },
    'SA-BORDER': { name: 'Border control (SA)', kind: 'BORDER_CONTROL', jurisdiction: 'SA', scope: 'Import clearance and port of entry control.' },
    'AE-MOIAT': { name: 'Industry and advanced technology ministry (AE)', kind: 'HALAL_AUTHORITY', jurisdiction: 'AE', scope: 'National halal mark scheme and conformity bodies.' },
    'AE-EDE': { name: 'Accreditation and conformity department (AE)', kind: 'ACCREDITATION_BODY', jurisdiction: 'AE', scope: 'Accreditation of certification bodies and laboratories.' },
    'AE-LOCAL-FOOD': { name: 'Emirate-level food control (AE)', kind: 'PRODUCT_SAFETY', jurisdiction: 'AE', scope: 'Local food import control.' },
    'AE-LOCAL-COSMETIC': { name: 'Emirate-level cosmetic control (AE)', kind: 'PRODUCT_SAFETY', jurisdiction: 'AE', scope: 'Local cosmetic registration.' },
    'AE-BORDER': { name: 'Border control (AE)', kind: 'BORDER_CONTROL', jurisdiction: 'AE', scope: 'Import clearance.' },
    'US-FSIS': { name: 'Food safety inspection service (US)', kind: 'PRODUCT_SAFETY', jurisdiction: 'US', scope: 'Meat and poultry inspection and export certification.' },
    'US-FDA': { name: 'Food and drug administration (US)', kind: 'PRODUCT_SAFETY', jurisdiction: 'US', scope: 'Food, drug, cosmetic and device oversight.' },
    'US-CBP': { name: 'Customs and border protection (US)', kind: 'BORDER_CONTROL', jurisdiction: 'US', scope: 'Import and export border control.' },
    'US-AHF': { name: 'Private halal certification body A (US)', kind: 'CERTIFICATION_BODY', jurisdiction: 'US', scope: 'Private halal certification within its accredited scope.' },
    'US-IFANCA': { name: 'Private halal certification body B (US)', kind: 'CERTIFICATION_BODY', jurisdiction: 'US', scope: 'Private halal certification within its accredited scope.' },
    'US-ISWA': { name: 'Private halal certification body C (US)', kind: 'CERTIFICATION_BODY', jurisdiction: 'US', scope: 'Private halal certification within its accredited scope.' },
    'CA-CFIA': { name: 'Food inspection agency (CA)', kind: 'PRODUCT_SAFETY', jurisdiction: 'CA', scope: 'Food safety, labelling and export certification.' },
    'CA-CBSA': { name: 'Border services agency (CA)', kind: 'BORDER_CONTROL', jurisdiction: 'CA', scope: 'Border clearance.' },
    'CA-HEALTH': { name: 'Health department (CA)', kind: 'PRODUCT_SAFETY', jurisdiction: 'CA', scope: 'Health products.' },
    'CA-HMA': { name: 'Private halal certification body (CA)', kind: 'CERTIFICATION_BODY', jurisdiction: 'CA', scope: 'Private halal certification within its accredited scope.' },
    'EU-FOOD': { name: 'Union food safety framework (EU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'EU', scope: 'Food law, traceability and official controls.' },
    'EU-BORDER': { name: 'Border control post (EU)', kind: 'BORDER_CONTROL', jurisdiction: 'EU', scope: 'Official controls at entry for products of animal origin.' },
    'EU-MEDICINE': { name: 'Medicines authority (EU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'EU', scope: 'Medicinal product authorization.' },
    'EU-COSMETIC': { name: 'Cosmetic competent authority (EU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'EU', scope: 'Cosmetic notification and safety assessment.' },
    'EU-DEVICE-CA': { name: 'Device competent authority (EU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'EU', scope: 'Medical device oversight.' },
    'EU-NOTIFIED-BODY': { name: 'Notified body (EU)', kind: 'CERTIFICATION_BODY', jurisdiction: 'EU', scope: 'Conformity assessment within a designated scope.' },
    'EU-HALAL-CONTROL': { name: 'Private halal certification body (EU)', kind: 'CERTIFICATION_BODY', jurisdiction: 'EU', scope: 'Private halal certification within its accredited scope.' },
    'AU-DAFF': { name: 'Agriculture and export department (AU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'AU', scope: 'Export control and the supervised halal program.' },
    'AU-AIO': { name: 'Approved islamic organisation (AU)', kind: 'CERTIFICATION_BODY', jurisdiction: 'AU', scope: 'Halal supervision and certification under the export program.' },
    'AU-FOOD-BORDER': { name: 'Imported food control (AU)', kind: 'BORDER_CONTROL', jurisdiction: 'AU', scope: 'Imported food inspection.' },
    'AU-TGA': { name: 'Therapeutic goods administration (AU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'AU', scope: 'Therapeutic goods.' },
    'AU-AICIS': { name: 'Industrial chemicals scheme (AU)', kind: 'PRODUCT_SAFETY', jurisdiction: 'AU', scope: 'Industrial chemical introduction.' },
    'OIC-SMIIC': { name: 'OIC standards and metrology institute', kind: 'STANDARDS_BODY', jurisdiction: 'OIC', scope: 'Harmonised halal standards. Binding only where adopted or contracted.' },
    'GLOBAL-ACCREDITATION': { name: 'Accreditation body (cross-jurisdiction)', kind: 'ACCREDITATION_BODY', jurisdiction: 'OIC', scope: 'Accreditation of certification bodies and laboratories to international standards.' },
    'GLOBAL-LAB': { name: 'Accredited testing laboratory (cross-jurisdiction)', kind: 'LABORATORY', jurisdiction: 'OIC', scope: 'Testing within a specific accredited scope of facility, method, matrix and analyte.' },
  };

  /* ------------------------------------------------------------ frameworks

     `status` is the verification flag carried through to every export.
     Nothing here asserts a clause number that the source register did not
     support; where an edition or clause is unconfirmed it says so.           */

  const FRAMEWORKS = {
    'ID-LAW-33-2014': { name: 'Halal product assurance law (ID)', jurisdiction: 'ID', family: 'Statute',
      covers: 'Mandatory halal scope, certification duty, staged product categories.',
      status: 'VERIFIED_IN_SOURCE_REGISTER',
      note: 'Law 33/2014 as amended, including Law 6/2023. The frequently seen "Law 39/2014" is a mis-citation.' },
    'ID-PP-42-2024': { name: 'Implementing regulation (ID)', jurisdiction: 'ID', family: 'Regulation',
      covers: 'Implementation of halal product assurance; replaced the 2021 instrument.',
      status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'PP 42/2024 replaced PP 39/2021. Effective-date boundaries matter for historic packets.' },
    'ID-HAS-23000': { name: 'Halal assurance system criteria (ID)', jurisdiction: 'ID', family: 'Scheme criteria',
      covers: 'Management-system criteria for halal assurance at a facility.',
      status: 'DRAFT_REQUIRES_SCOPE_AND_CLAUSE_REVIEW', note: 'Edition and current applicability require confirmation against the controlled source.' },
    'MS-1500-2019': { name: 'Halal food - general requirements (MY)', jurisdiction: 'MY', family: 'National standard',
      covers: 'Production, preparation, handling and storage of halal food.',
      status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Clause-level references UNVERIFIED pending controlled copy.' },
    'MS-2400-1-2019': { name: 'Halalan-toyyiban supply chain - transportation (MY)', jurisdiction: 'MY', family: 'National standard',
      covers: 'Transportation of goods and/or cargo chain services.',
      status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'The logistics-specific part most relevant to custody and conveyance.' },
    'MS-2400-2-2019': { name: 'Halalan-toyyiban supply chain - warehousing (MY)', jurisdiction: 'MY', family: 'National standard',
      covers: 'Warehousing and related activities.', status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Segregation and storage controls.' },
    'MS-2400-3-2019': { name: 'Halalan-toyyiban supply chain - retailing (MY)', jurisdiction: 'MY', family: 'National standard',
      covers: 'Retailing and related activities.', status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Applies at market placement, not in transit.' },
    'GSO-2055-1': { name: 'Halal food - general requirements (GCC)', jurisdiction: 'SA', family: 'Regional standard',
      covers: 'General halal food requirements across the Gulf standards layer.',
      status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Adopted nationally; the national adoption instrument governs.' },
    'GSO-2469': { name: 'Halal certification body requirements (GCC)', jurisdiction: 'SA', family: 'Regional standard',
      covers: 'Requirements on bodies providing halal certification.', status: 'DRAFT_REQUIRES_SCOPE_AND_CLAUSE_REVIEW', note: 'Edition requires confirmation.' },
    'UAE-S-2055-1': { name: 'Halal products - general requirements (AE)', jurisdiction: 'AE', family: 'National standard',
      covers: 'National halal requirements feeding the national mark scheme.',
      status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'UAE.S 993 is a separate instrument on animal slaughter and must not be conflated.' },
    'TH-CICOT-HLAB': { name: 'National halal scheme and laboratory protocol (TH)', jurisdiction: 'TH', family: 'Scheme criteria',
      covers: 'Certification scheme with an associated laboratory science protocol.', status: 'DRAFT_REQUIRES_SCOPE_AND_CLAUSE_REVIEW', note: 'Scheme documents require controlled sourcing.' },
    'SG-MUIS-SCHEME': { name: 'Halal certification scheme (SG)', jurisdiction: 'SG', family: 'Scheme criteria',
      covers: 'National halal certification conditions.', status: 'DRAFT_REQUIRES_SCOPE_AND_CLAUSE_REVIEW', note: 'Transit role rarely triggers destination conformity by itself.' },
    'OIC-SMIIC-1': { name: 'General requirements for halal food', jurisdiction: 'OIC', family: 'International standard',
      covers: 'Harmonised halal food requirements.', status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Binding only on adoption or by contract.' },
    'OIC-SMIIC-17-1': { name: 'Halal supply chain - part 1', jurisdiction: 'OIC', family: 'International standard',
      covers: 'Supply chain requirements, transport segment.', status: 'DRAFT_REQUIRES_SCOPE_AND_CLAUSE_REVIEW', note: 'Adoption status varies by jurisdiction.' },
    'OIC-SMIIC-17-2': { name: 'Halal supply chain - part 2', jurisdiction: 'OIC', family: 'International standard',
      covers: 'Supply chain requirements, warehousing segment.', status: 'DRAFT_REQUIRES_SCOPE_AND_CLAUSE_REVIEW', note: 'Adoption status varies by jurisdiction.' },
    'ISO-IEC-17025': { name: 'Competence of testing and calibration laboratories', jurisdiction: 'OIC', family: 'International standard',
      covers: 'Laboratory competence. Accreditation is always to a specific SCOPE.',
      status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Scope match is facility, method, matrix, analyte and date. "Accredited" alone is not a property.' },
    'ISO-IEC-17065': { name: 'Requirements for product certification bodies', jurisdiction: 'OIC', family: 'International standard',
      covers: 'Competence of bodies certifying products, processes and services.', status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Underpins certification-body accreditation.' },
    'US-PRIVATE-ASSURANCE': { name: 'Private halal assurance scheme (US)', jurisdiction: 'US', family: 'Private scheme',
      covers: 'Contractual halal conformity where no government standard exists.', status: 'UNVERIFIED', note: 'Scheme terms are contractual and vary by body.' },
    'CA-PRIVATE-ASSURANCE': { name: 'Private halal assurance scheme (CA)', jurisdiction: 'CA', family: 'Private scheme',
      covers: 'Contractual halal conformity; the halal claim itself is regulated as a claim.', status: 'UNVERIFIED', note: 'Claim regulation differs from conformity certification.' },
    'EU-FOOD-LAW': { name: 'Union food law and official controls', jurisdiction: 'EU', family: 'Regulation',
      covers: 'Traceability, food law obligations and official controls at entry.', status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Entirely separate from halal conformity, which is private in this jurisdiction.' },
    'EU-PRIVATE-ASSURANCE': { name: 'Private halal assurance scheme (EU)', jurisdiction: 'EU', family: 'Private scheme',
      covers: 'Contractual halal conformity.', status: 'UNVERIFIED', note: 'Member-state and body-specific.' },
    'AU-EXPORT-PROGRAM': { name: 'Government-supervised halal export program (AU)', jurisdiction: 'AU', family: 'Government program',
      covers: 'Supervised halal certification for red meat export.', status: 'VERIFIED_IN_SOURCE_REGISTER', note: 'Government supervision of a religious certification arrangement is distinctive.' },
  };

  /* -------------------------------------------------------------- controls

     Each control names the evidence it requires and the frameworks that pull
     it in. Selecting two frameworks that both require a control does NOT
     double-count it: the control appears once, with both frameworks listed as
     requiring parties. That is the "one evidence core, many annexes" shape.  */

  const CONTROLS = [
    { id: 'CTL-SEG-01', group: 'Segregation', title: 'Dedicated or physically partitioned halal handling maintained for the whole custody interval',
      requires: ['SEGREGATION_DECLARATION', 'CONVEYANCE_CONFIG', 'HANDOFF_CHAIN'],
      frameworks: ['MS-2400-1-2019', 'MS-2400-2-2019', 'OIC-SMIIC-17-1', 'GSO-2055-1', 'UAE-S-2055-1', 'ID-HAS-23000'] },
    { id: 'CTL-SEG-02', group: 'Segregation', title: 'No non-halal co-loading in the same sealed unit across any leg',
      requires: ['MANIFEST', 'SEAL_CHAIN'], frameworks: ['MS-2400-1-2019', 'OIC-SMIIC-17-1', 'GSO-2055-1'] },
    { id: 'CTL-RIT-01', group: 'Ritual integrity', title: 'Samak/sertu ritual cleansing performed, witnessed and sequence-complete where a najis mughallazah contact is recorded',
      requires: ['SERTU_EVENT', 'WITNESS_MANDATE'], frameworks: ['MS-1500-2019', 'MS-2400-1-2019', 'ID-HAS-23000'] },
    { id: 'CTL-RIT-02', group: 'Ritual integrity', title: 'Slaughter act evidenced with a current appointment for the named slaughterer at the date of the act',
      requires: ['SLAUGHTER_RECORD', 'APPOINTMENT_EVIDENCE'], frameworks: ['MS-1500-2019', 'GSO-2055-1', 'UAE-S-2055-1', 'OIC-SMIIC-1'] },
    { id: 'CTL-CC-01', group: 'Cold chain', title: 'Temperature held within the declared profile across every leg, on admissible devices',
      requires: ['TELEMETRY_SERIES', 'DEVICE_CALIBRATION'], frameworks: ['MS-2400-1-2019', 'OIC-SMIIC-17-1', 'EU-FOOD-LAW'] },
    { id: 'CTL-CC-02', group: 'Cold chain', title: 'Telemetry coverage continuous: no sampling gap exceeding the declared maximum, edges covered',
      requires: ['TELEMETRY_SERIES', 'COVERAGE_ASSESSMENT'], frameworks: ['MS-2400-1-2019', 'OIC-SMIIC-17-1'] },
    { id: 'CTL-CUS-01', group: 'Custody', title: 'Every custody handoff two-step acknowledged by mandated transferor and transferee',
      requires: ['HANDOFF_CHAIN', 'ACTOR_MANDATE'], frameworks: ['MS-2400-1-2019', 'MS-2400-2-2019', 'OIC-SMIIC-17-1', 'OIC-SMIIC-17-2'] },
    { id: 'CTL-CUS-02', group: 'Custody', title: 'Seal continuity unbroken, or every open reconciled to an authorized custody event',
      requires: ['SEAL_CHAIN', 'HANDOFF_CHAIN'],
      frameworks: ['MS-2400-1-2019', 'GSO-2055-1', 'UAE-S-2055-1', 'OIC-SMIIC-17-1', 'ID-HAS-23000'] },
    { id: 'CTL-LAB-01', group: 'Laboratory', title: 'Species-identity screening result issued within the laboratory’s accredited scope for method, matrix, analyte and date',
      requires: ['LAB_REPORT', 'LAB_SCOPE_SNAPSHOT'], frameworks: ['ISO-IEC-17025', 'ID-HAS-23000', 'TH-CICOT-HLAB', 'GSO-2055-1'] },
    { id: 'CTL-LAB-02', group: 'Laboratory', title: 'Sampling plan retained and sufficient to support any lot-level inference claimed',
      requires: ['SAMPLING_PLAN', 'LAB_REPORT'], frameworks: ['ISO-IEC-17025', 'OIC-SMIIC-1'] },
    { id: 'CTL-CER-01', group: 'Certification', title: 'Halal certificate active and in scope for the product category and facility on the event date',
      requires: ['HALAL_CERTIFICATE'], frameworks: ['MS-1500-2019', 'GSO-2055-1', 'UAE-S-2055-1', 'OIC-SMIIC-1', 'ID-LAW-33-2014'] },
    { id: 'CTL-CER-02', group: 'Certification', title: 'Issuing body recognised by the destination authority on the event date, evidenced separately from certificate validity',
      requires: ['RECOGNITION_SNAPSHOT'],
      frameworks: ['ID-LAW-33-2014', 'ID-PP-42-2024', 'MS-1500-2019', 'GSO-2055-1', 'UAE-S-2055-1', 'OIC-SMIIC-1'] },
    { id: 'CTL-DOC-01', group: 'Documentation', title: 'Consignment documentary set complete and internally consistent for the destination',
      requires: ['DOC_SET'], frameworks: ['EU-FOOD-LAW', 'ID-PP-42-2024', 'AU-EXPORT-PROGRAM', 'US-PRIVATE-ASSURANCE'] },
    { id: 'CTL-DOC-02', group: 'Documentation', title: 'Lot identity reconciles across certificate, manifest, laboratory report and custody chain',
      requires: ['DOC_SET', 'HANDOFF_CHAIN', 'LAB_REPORT'], frameworks: ['OIC-SMIIC-1', 'MS-1500-2019', 'EU-FOOD-LAW'] },
    { id: 'CTL-INT-01', group: 'Evidence integrity', title: 'Every evidence record digest recomputes and the custody hash chain verifies end to end',
      requires: ['EVIDENCE_DIGESTS'], frameworks: ['ISO-IEC-17025', 'OIC-SMIIC-17-1'] },
    { id: 'CTL-INT-02', group: 'Evidence integrity', title: 'Merkle inclusion verifies for every record claimed in the batch, with the completeness boundary stated',
      requires: ['MERKLE_BATCH'], frameworks: ['ISO-IEC-17025', 'OIC-SMIIC-17-1'] },
  ];

  /* -------------------------------------------------------------- personas

     Each lens changes what is visible, what is actionable, and what the
     person is permitted to assert. `cannot` is rendered in the UI: a product
     that only shows capability teaches users they have authority they lack.  */

  const PERSONAS = [
    { id: 'PER-45', name: 'Specialty halal food importer', short: 'Importer', org: 'Importer of record (synthetic)',
      mandate: 'Commercial party and packet owner. May prepare and disclose; may set commercial disposition only.',
      focus: 'journey', annexes: ['ID-BPJPH', 'ID-BORDER', 'MY-JAKIM'],
      can: ['Prepare an audit packet', 'Select destinations and frameworks', 'Set commercial disposition', 'Disclose to a named recipient'],
      cannot: ['Assert an authority decision', 'Declare the consignment certified', 'Release goods through customs'] },
    { id: 'PER-06', name: 'Halal inspection body lead field auditor', short: 'HCB auditor', org: 'Halal inspection body (synthetic)',
      mandate: 'Scoped field audit under a recorded appointment. May record findings within scope.',
      focus: 'controls', annexes: ['ID-LPH-FATWA', 'MY-JAKIM', 'OIC-SMIIC'],
      can: ['Record an audit finding', 'Mark a control REQUIRES_REVIEW', 'Request evidence', 'Raise a non-conformity'],
      cannot: ['Issue a halal certificate', 'Make a religious determination outside the fatwa function', 'Override a laboratory result'] },
    { id: 'PER-15', name: 'Laboratory chain-of-custody officer', short: 'Lab custody', org: 'Accredited testing laboratory (synthetic)',
      mandate: 'Preserve sample identity and custody. May issue within the facility’s accredited scope only.',
      focus: 'laboratory', annexes: ['GLOBAL-LAB'],
      can: ['Record sample custody', 'Attach a signed report', 'Withdraw or amend a prior result', 'Declare a sample compromised'],
      cannot: ['Conclude anything about a lot beyond the sampling plan', 'Assert scope the accreditation does not cover', 'Clear a consignment'] },
    { id: 'PER-31', name: 'Ocean freight reefer fleet director', short: 'Carrier', org: 'Ocean carrier (synthetic)',
      mandate: 'Custodian during carriage. May evidence conveyance, device and seal state.',
      focus: 'telemetry', annexes: ['MY-JAKIM', 'OIC-SMIIC'],
      can: ['Evidence conveyance configuration', 'Declare a device or calibration state', 'Record a seal event', 'Acknowledge a handoff'],
      cannot: ['Assert halal conformity', 'Close a non-conformity raised by another party', 'Alter a recorded telemetry sample'] },
    { id: 'PER-37', name: 'Cold storage warehouse superintendent', short: 'Warehouse', org: 'Bonded cold store (synthetic)',
      mandate: 'Custodian during storage. May evidence segregation and storage telemetry.',
      focus: 'custody', annexes: ['MY-JAKIM', 'ID-BPJPH'],
      can: ['Evidence segregation zoning', 'Record storage telemetry', 'Accept or dispute a handoff', 'Record a sertu event'],
      cannot: ['Assert certificate validity', 'Release for sale', 'Resolve a laboratory finding'] },
    { id: 'PER-44', name: 'Customs clearance broker', short: 'Broker', org: 'Licensed customs broker (synthetic)',
      mandate: 'Agent for lodgement. May identify documentary gaps before submission.',
      focus: 'readiness', annexes: ['ID-BORDER', 'SG-CUSTOMS', 'MY-FOOD-BORDER'],
      can: ['Run a pre-arrival completeness check', 'Assemble a destination annex', 'Record a portal submission receipt'],
      cannot: ['Assert customs release', 'Assert an authority decision', 'Certify halal conformity'] },
    { id: 'PER-21', name: 'Corporate halal officer', short: 'Halal officer', org: 'Manufacturer or brand (synthetic)',
      mandate: 'Internal halal assurance owner. May review supplier and batch evidence and set internal disposition.',
      focus: 'controls', annexes: ['ID-BPJPH', 'MY-JAKIM', 'SA-HALAL'],
      can: ['Review supplier evidence', 'Raise an internal non-conformity', 'Set internal batch disposition', 'Approve a disclosure profile'],
      cannot: ['Substitute internal review for external certification', 'Assert recognition status', 'Clear goods'] },
    { id: 'PER-49', name: 'Third-party supply chain auditor', short: 'Third-party auditor', org: 'Independent assurance firm (synthetic)',
      mandate: 'Independent reviewer. Receives a disclosed packet and reproduces its verification.',
      focus: 'integrity', annexes: ['GLOBAL-ACCREDITATION'],
      can: ['Reproduce every digest offline', 'Verify Merkle inclusion', 'Verify the custody chain', 'Record a reproduction result'],
      cannot: ['Write evidence into the journey', 'Change a control state', 'Issue any certificate'] },
  ];

  /* ---------------------------------------------------------------- export */

  VS.registry = {
    EVIDENCE_STATE: EVIDENCE_STATE,
    LAB_RESULT_STATE: LAB_RESULT_STATE,
    COVERAGE_STATE: COVERAGE_STATE,
    SEPARATION_LATTICE: SEPARATION_LATTICE,
    JURISDICTIONS: JURISDICTIONS,
    AUTHORITIES: AUTHORITIES,
    FRAMEWORKS: FRAMEWORKS,
    CONTROLS: CONTROLS,
    PERSONAS: PERSONAS,

    jurisdiction: (id) => JURISDICTIONS.filter((j) => j.id === id)[0],
    regions: () => {
      const seen = [];
      JURISDICTIONS.forEach((j) => { if (seen.indexOf(j.region) === -1) seen.push(j.region); });
      return seen;
    },
    /** Controls pulled in by a set of selected framework ids, de-duplicated. */
    controlsForFrameworks: function (frameworkIds) {
      const set = {};
      CONTROLS.forEach((c) => {
        const hit = c.frameworks.filter((f) => frameworkIds.indexOf(f) !== -1);
        if (hit.length) set[c.id] = Object.assign({}, c, { requiredBy: hit });
      });
      return Object.keys(set).map((k) => set[k]);
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);