/* ===========================================================================
   VSENSE Halal Logistics - verification core
   ---------------------------------------------------------------------------
   Everything a third party needs in order to check this demo's claims without
   trusting the demo. Four primitives, in dependency order:

     1. SHA-256              pure JavaScript, no network, no library
     2. VS-JCS-1             deterministic JSON serialization
     3. VS-MERKLE-SHA256-1   RFC 6962 Merkle tree + inclusion proofs
     4. VS-CHAIN-1           hash-linked custody chain

   Written as a classic script, not an ES module, so the demo opens from
   file:// by double-click. Everything hangs off window.VS.crypto.

   DELIBERATE DESIGN NOTE. The SHA-256 below is a from-scratch implementation
   rather than a call to crypto.subtle. That is not distrust of the platform:
   it is that crypto.subtle.digest is asynchronous, which would force every
   hash in the UI to be a promise, and it is unavailable in some non-secure
   contexts. The pure implementation is synchronous and always present. When
   crypto.subtle IS available, selfTest() runs both and asserts they agree, so
   the implementation is cross-checked against the platform on every load.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  /* ------------------------------------------------------------------ bytes */

  const HEX = '0123456789abcdef';

  function bytesToHex(bytes) {
    let out = '';
    for (let i = 0; i < bytes.length; i += 1) {
      out += HEX[bytes[i] >>> 4] + HEX[bytes[i] & 15];
    }
    return out;
  }

  function hexToBytes(hex) {
    if (typeof hex !== 'string' || hex.length % 2 !== 0 || /[^0-9a-fA-F]/.test(hex)) {
      throw new TypeError('hexToBytes: expected an even-length hexadecimal string');
    }
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i += 1) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }

  function utf8(str) {
    // TextEncoder is universally available in the target browsers; the manual
    // path exists only so the file degrades rather than throws.
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
    const out = [];
    for (let i = 0; i < str.length; i += 1) {
      let c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63));
      else if (c >= 0xd800 && c <= 0xdbff) {
        const c2 = str.charCodeAt(++i);
        c = 0x10000 + ((c - 0xd800) << 10) + (c2 - 0xdc00);
        out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
      } else out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    }
    return new Uint8Array(out);
  }

  function concat() {
    let total = 0;
    for (let i = 0; i < arguments.length; i += 1) total += arguments[i].length;
    const out = new Uint8Array(total);
    let off = 0;
    for (let i = 0; i < arguments.length; i += 1) {
      out.set(arguments[i], off);
      off += arguments[i].length;
    }
    return out;
  }

  /* ----------------------------------------------------------- 1. SHA-256 */

  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  function sha256Bytes(input) {
    const msg = typeof input === 'string' ? utf8(input) : input;
    const len = msg.length;
    const bitLenHi = Math.floor(len / 0x20000000);
    const bitLenLo = (len << 3) >>> 0;

    // message + 0x80 + zero padding + 8-byte big-endian bit length
    const withPad = ((len + 9 + 63) >>> 6) << 6;
    const buf = new Uint8Array(withPad);
    buf.set(msg);
    buf[len] = 0x80;
    const dv = new DataView(buf.buffer);
    dv.setUint32(withPad - 8, bitLenHi, false);
    dv.setUint32(withPad - 4, bitLenLo, false);

    const H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    const w = new Uint32Array(64);

    for (let off = 0; off < withPad; off += 64) {
      for (let i = 0; i < 16; i += 1) w[i] = dv.getUint32(off + i * 4, false);
      for (let i = 16; i < 64; i += 1) {
        const a = w[i - 15];
        const b = w[i - 2];
        const s0 = ((a >>> 7) | (a << 25)) ^ ((a >>> 18) | (a << 14)) ^ (a >>> 3);
        const s1 = ((b >>> 17) | (b << 15)) ^ ((b >>> 19) | (b << 13)) ^ (b >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];
      for (let i = 0; i < 64; i += 1) {
        const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
        const ch = (e & f) ^ (~e & g);
        const t1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
        const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e;
        e = (d + t1) >>> 0;
        d = c; c = b; b = a;
        a = (t1 + t2) >>> 0;
      }
      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    const out = new Uint8Array(32);
    const odv = new DataView(out.buffer);
    for (let i = 0; i < 8; i += 1) odv.setUint32(i * 4, H[i], false);
    return out;
  }

  const sha256 = (input) => bytesToHex(sha256Bytes(input));

  /* -------------------------------------------------- 2. VS-JCS-1 canonical

     Deterministic JSON serialization, following RFC 8785 (JCS) for the subset
     of JSON this product emits:

       - object keys sorted ascending by UTF-16 code unit (Array#sort default)
       - no insignificant whitespace anywhere
       - numbers serialized by the ECMAScript Number-to-String algorithm,
         which is what JSON.stringify already does
       - non-finite numbers rejected rather than coerced to null
       - undefined and functions rejected rather than silently dropped
       - strings escaped by JSON.stringify, which is already JCS-conformant

     The rejections matter more than the sorting. JSON.stringify turns NaN into
     null and drops undefined object members without complaint; either would
     mean two different in-memory states hash to the same digest, which is the
     one thing a canonicalizer exists to prevent.                            */

  function canonicalize(value) {
    if (value === null) return 'null';
    const t = typeof value;
    if (t === 'boolean') return value ? 'true' : 'false';
    if (t === 'string') return JSON.stringify(value);
    if (t === 'number') {
      if (!isFinite(value)) throw new TypeError('VS-JCS-1: non-finite number is not representable');
      return JSON.stringify(value);
    }
    if (t === 'undefined') throw new TypeError('VS-JCS-1: undefined is not representable');
    if (t === 'function' || t === 'symbol' || t === 'bigint') {
      throw new TypeError('VS-JCS-1: ' + t + ' is not representable');
    }
    if (Array.isArray(value)) {
      const parts = [];
      for (let i = 0; i < value.length; i += 1) parts.push(canonicalize(value[i]));
      return '[' + parts.join(',') + ']';
    }
    if (t === 'object') {
      const keys = Object.keys(value).sort();
      const parts = [];
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (typeof value[k] === 'undefined') {
          throw new TypeError('VS-JCS-1: undefined member "' + k + '" is not representable');
        }
        parts.push(JSON.stringify(k) + ':' + canonicalize(value[k]));
      }
      return '{' + parts.join(',') + '}';
    }
    throw new TypeError('VS-JCS-1: unsupported value');
  }

  /** Canonical digest of a JSON value. This is the "data hash" throughout. */
  const digest = (value) => sha256(canonicalize(value));

  /* ------------------------------------- 3. VS-MERKLE-SHA256-1 (RFC 6962)

     Merkle Tree Hash, exactly as specified in RFC 6962 section 2.1:

       MTH({})        = SHA-256()
       MTH({d0})      = SHA-256(0x00 || d0)
       MTH(D[n]), n>1 = SHA-256(0x01 || MTH(D[0:k]) || MTH(D[k:n]))
                        where k is the largest power of two strictly < n

     Two properties earn this construction its place over the more common
     "duplicate the last node on an odd level" rule:

       - Domain separation. Leaves are prefixed 0x00 and interior nodes 0x01,
         so no leaf digest can ever be mistaken for an interior digest. Without
         it an attacker can present an interior node as a leaf.
       - Unambiguous shape. The split-at-largest-power-of-two rule gives every
         leaf count exactly one tree. The duplication rule does not: a tree of
         n leaves and a crafted tree of n+1 leaves can share a root, which is
         the CVE-2012-2459 family of forgeries. The v6 demo used duplication.  */

  const LEAF_PREFIX = Uint8Array.of(0x00);
  const NODE_PREFIX = Uint8Array.of(0x01);

  const leafHash = (data) => sha256Bytes(concat(LEAF_PREFIX, typeof data === 'string' ? utf8(data) : data));
  const nodeHash = (l, r) => sha256Bytes(concat(NODE_PREFIX, l, r));

  /** Largest power of two strictly less than n (n > 1). */
  function splitPoint(n) {
    let k = 1;
    while (k * 2 < n) k *= 2;
    return k;
  }

  /** @param {string[]} leaves canonical strings, one per evidence record */
  function merkleRoot(leaves) {
    if (leaves.length === 0) return sha256('');
    return bytesToHex(mth(leaves, 0, leaves.length));
  }

  function mth(leaves, start, end) {
    const n = end - start;
    if (n === 1) return leafHash(leaves[start]);
    const k = splitPoint(n);
    return nodeHash(mth(leaves, start, start + k), mth(leaves, start + k, end));
  }

  /**
   * RFC 6962 audit path for leaf `index`. Each step records the sibling digest
   * and which side it sits on, so a verifier can recompute the root without
   * holding the tree.
   */
  function merkleProof(leaves, index) {
    if (!Number.isInteger(index) || index < 0 || index >= leaves.length) {
      throw new RangeError('merkleProof: leaf index outside the tree');
    }
    const path = [];
    (function walk(start, end, i) {
      const n = end - start;
      if (n === 1) return;
      const k = splitPoint(n);
      if (i < k) {
        path.push({ side: 'right', hash: bytesToHex(mth(leaves, start + k, end)) });
        walk(start, start + k, i);
      } else {
        path.push({ side: 'left', hash: bytesToHex(mth(leaves, start, start + k)) });
        walk(start + k, end, i - k);
      }
    })(0, leaves.length, index);
    path.reverse(); // leaf-upward, which is the order a verifier consumes
    return path;
  }

  /**
   * Recompute a root from one leaf and its audit path.
   * Returns { ok, computedRoot }. An `ok:true` result proves INCLUSION of this
   * leaf in a tree with this root. It proves nothing about completeness: a
   * valid path says the record is in the batch, never that the batch holds
   * every record it should.
   */
  function verifyMerkleProof(leafData, path, expectedRoot) {
    let acc = leafHash(leafData);
    for (let i = 0; i < path.length; i += 1) {
      const sib = hexToBytes(path[i].hash);
      acc = path[i].side === 'left' ? nodeHash(sib, acc) : nodeHash(acc, sib);
    }
    const computedRoot = bytesToHex(acc);
    return { ok: computedRoot === String(expectedRoot || '').toLowerCase(), computedRoot };
  }

  /* ------------------------------------------------ 4. VS-CHAIN-1 custody

     Each custody event binds its predecessor:

       event_hash[i] = SHA-256( 0x02 || event_hash[i-1] || JCS(event_body[i]) )

     with event_hash[-1] = 32 zero bytes for the genesis event, and a third
     domain tag so a chain link can never collide with a Merkle leaf or node.

     Altering or removing any event changes every event hash after it, so a
     verifier that holds only the final hash detects edits anywhere in the
     chain. The chain orders events; the Merkle batch publishes them. Neither
     alone is enough: the chain proves sequence, the anchor proves the sequence
     existed before a point in time.                                          */

  const CHAIN_PREFIX = Uint8Array.of(0x02);
  const GENESIS = new Uint8Array(32); // 32 zero bytes

  function chainLink(prevHashHex, eventBody) {
    const prev = prevHashHex ? hexToBytes(prevHashHex) : GENESIS;
    return bytesToHex(sha256Bytes(concat(CHAIN_PREFIX, prev, utf8(canonicalize(eventBody)))));
  }

  /** Recompute a whole chain; returns the per-event hashes and the first break. */
  function verifyChain(events) {
    const hashes = [];
    let prev = null;
    let brokenAt = -1;
    for (let i = 0; i < events.length; i += 1) {
      const computed = chainLink(prev, events[i].body);
      hashes.push(computed);
      if (events[i].eventHash && events[i].eventHash !== computed && brokenAt === -1) brokenAt = i;
      prev = computed;
    }
    return { ok: brokenAt === -1, brokenAt, hashes, head: prev };
  }

  /* --------------------------------------------------------- short display */

  /** 8 leading + 6 trailing hex, the form used in every chip and table cell. */
  const shortHash = (h) => (typeof h === 'string' && h.length > 20 ? h.slice(0, 8) + '…' + h.slice(-6) : String(h || ''));

  /* ---------------------------------------------------------- self-test

     Runs on load. Known-answer tests for SHA-256, a cross-check against
     crypto.subtle where available, canonicalization order and rejection
     behaviour, RFC 6962 known vectors, and the negative Merkle and chain
     cases. The UI surfaces the result: a demo that asks you to trust its
     hashes should be willing to show its own test run.                      */

  const KNOWN = {
    empty: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    abc: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    // RFC 6962 section 2.1.3 reference vectors
    leafEmpty: '6e340b9cffb37a989ca544e6bb780a2c78901d3fb33738768511a30617afa01d', // SHA-256(0x00)
  };

  function selfTest() {
    const results = [];
    const check = (name, pass, detail) => results.push({ name, pass: !!pass, detail: detail || '' });

    check('SHA-256 of empty input', sha256('') === KNOWN.empty, KNOWN.empty);
    check('SHA-256 of "abc"', sha256('abc') === KNOWN.abc, KNOWN.abc);

    // 1,000,000 bytes would be slow on load; 1,000 'a's exercises multi-block.
    const long = new Array(1001).join('a');
    check('SHA-256 multi-block (1000 x "a")', sha256(long).length === 64 && /^[0-9a-f]{64}$/.test(sha256(long)));

    check('RFC 6962 empty-leaf hash', bytesToHex(leafHash('')) === KNOWN.leafEmpty, KNOWN.leafEmpty);

    // Canonicalization: key order must not change the digest.
    const a = { beta: 1, alpha: { z: true, a: [3, 2, 1] } };
    const b = { alpha: { a: [3, 2, 1], z: true }, beta: 1 };
    check('VS-JCS-1 key order is irrelevant to the digest', digest(a) === digest(b), digest(a));
    check('VS-JCS-1 array order IS significant', digest([1, 2]) !== digest([2, 1]));

    let rejected = 0;
    [NaN, Infinity].forEach((v) => { try { canonicalize({ v: v }); } catch (e) { rejected += 1; } });
    try { canonicalize({ v: undefined }); } catch (e) { rejected += 1; }
    check('VS-JCS-1 rejects NaN, Infinity and undefined', rejected === 3, rejected + '/3 rejected');

    // Merkle: inclusion holds for every leaf of an odd-sized tree.
    const leaves = ['e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'];
    const root = merkleRoot(leaves);
    let allIncluded = true;
    for (let i = 0; i < leaves.length; i += 1) {
      if (!verifyMerkleProof(leaves[i], merkleProof(leaves, i), root).ok) allIncluded = false;
    }
    check('Merkle inclusion holds for all 7 leaves (odd tree)', allIncluded, root.slice(0, 16) + '…');

    // Merkle: a tampered leaf must fail against the original root.
    check('Merkle rejects an altered leaf',
      !verifyMerkleProof('e3-TAMPERED', merkleProof(leaves, 3), root).ok);

    // Merkle: a truncated path must fail.
    check('Merkle rejects a truncated audit path',
      !verifyMerkleProof(leaves[3], merkleProof(leaves, 3).slice(1), root).ok);

    // Merkle: domain separation means a 1-leaf root is not the bare digest.
    check('Merkle leaves are domain-separated from raw digests',
      merkleRoot(['x']) !== sha256('x'));

    // Chain: a mutated middle event breaks every link after it.
    const evs = [];
    let prev = null;
    for (let i = 0; i < 5; i += 1) {
      const body = { seq: i, note: 'event ' + i };
      const h = chainLink(prev, body);
      evs.push({ body: body, eventHash: h });
      prev = h;
    }
    check('Custody chain verifies intact', verifyChain(evs).ok);
    const tampered = evs.map((e, i) => (i === 2 ? { body: { seq: 2, note: 'edited' }, eventHash: e.eventHash } : e));
    const vr = verifyChain(tampered);
    check('Custody chain detects a mutated event', !vr.ok && vr.brokenAt === 2, 'break at index ' + vr.brokenAt);

    const failed = results.filter((r) => !r.pass);
    return { ok: failed.length === 0, total: results.length, failed: failed.length, results };
  }

  /**
   * Cross-check the pure implementation against the platform's own SHA-256.
   * Asynchronous and best-effort: absence of crypto.subtle is reported, not
   * treated as a failure, because the demo must still work from file://.
   */
  function crossCheckSubtle() {
    const subtle = (global.crypto && global.crypto.subtle) || null;
    if (!subtle || typeof subtle.digest !== 'function') {
      return Promise.resolve({ available: false, ok: null, note: 'crypto.subtle unavailable in this context' });
    }
    const samples = ['', 'abc', 'VSENSE Halal Logistics', JSON.stringify({ a: 1, b: [2, 3] })];
    return Promise.all(samples.map((s) => subtle.digest('SHA-256', utf8(s))))
      .then((buffers) => {
        for (let i = 0; i < samples.length; i += 1) {
          if (bytesToHex(new Uint8Array(buffers[i])) !== sha256(samples[i])) {
            return { available: true, ok: false, note: 'divergence on sample ' + i };
          }
        }
        return { available: true, ok: true, note: samples.length + ' samples agree with crypto.subtle' };
      })
      .catch((e) => ({ available: true, ok: null, note: 'cross-check error: ' + e.message }));
  }

  VS.crypto = {
    bytesToHex: bytesToHex,
    hexToBytes: hexToBytes,
    utf8: utf8,
    sha256: sha256,
    sha256Bytes: sha256Bytes,
    canonicalize: canonicalize,
    digest: digest,
    leafHash: leafHash,
    merkleRoot: merkleRoot,
    merkleProof: merkleProof,
    verifyMerkleProof: verifyMerkleProof,
    chainLink: chainLink,
    verifyChain: verifyChain,
    shortHash: shortHash,
    selfTest: selfTest,
    crossCheckSubtle: crossCheckSubtle,
    PROFILES: {
      canonical: 'VS-JCS-1',
      merkle: 'VS-MERKLE-SHA256-1 (RFC 6962)',
      chain: 'VS-CHAIN-1',
      hash: 'SHA-256 (FIPS 180-4)',
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);