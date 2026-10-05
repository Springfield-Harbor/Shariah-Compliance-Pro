/* ===========================================================================
   VSENSE Halal Logistics - minimal PDF 1.7 writer
   ---------------------------------------------------------------------------
   Produces a real, standards-conformant PDF in the browser with no library,
   no network and no build step, so an audit packet downloads as a PDF even
   from file:// on an air-gapped machine.

   Why hand-rolled rather than a PDF library: the packet's whole claim is that
   what you download is a deterministic render of the canonical JSON. A PDF
   generator that injects a creation timestamp, a producer string or a random
   document ID breaks byte-reproducibility, and then the PDF's own digest
   cannot be published inside the packet. Here every byte is controlled: the
   document ID is derived from the packet digest and the dates come from the
   packet, so rendering the same packet twice yields identical bytes.

   Scope, honestly stated: base-14 fonts only (no embedding, so no Arabic or
   CJK), WinAnsi text, no images, no transparency. That is sufficient for an
   evidence document and keeps the writer small enough to audit.

   The canonical JSON is also attached inside the PDF as an embedded file, so
   a recipient who receives only the PDF still holds the machine-readable
   packet and can re-verify every digest in it.

   Classic script. Hangs off window.VS.pdf.
   =========================================================================== */
(function (global) {
  'use strict';

  const VS = (global.VS = global.VS || {});

  /* --------------------------------------------------------- font metrics

     Widths per 1000 units for the base-14 fonts actually used, indexed by
     byte value 32..126. Needed for word wrapping and right alignment; without
     real metrics every table column drifts.                                  */

  const W_HELV = [
    278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
    1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
    333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
  ];
  const W_HELVB = [
    278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
    556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
    975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
    667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
    333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
    611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
  ];

  const FONTS = {
    helv: { res: 'F1', base: 'Helvetica', widths: W_HELV, fixed: 0 },
    helvB: { res: 'F2', base: 'Helvetica-Bold', widths: W_HELVB, fixed: 0 },
    cour: { res: 'F3', base: 'Courier', widths: null, fixed: 600 },
    courB: { res: 'F4', base: 'Courier-Bold', widths: null, fixed: 600 },
  };

  /* ------------------------------------------------------- text encoding

     Transliterate to WinAnsi. Characters outside it are mapped to a sensible
     ASCII equivalent rather than dropped, because silently losing a minus
     sign or an arrow from a compliance document is worse than a clumsy
     substitution.                                                            */

  const TRANSLIT = {
    '—': '-', '–': '-', '…': '...', '‘': "'", '’': "'",
    '“': '"', '”': '"', '·': '-', '•': '-', '→': '->',
    '←': '<-', '≤': '<=', '≥': '>=', '×': 'x', '✓': 'OK',
    '✔': 'OK', '✗': 'X', '✘': 'X', ' ': ' ', '′': "'",
    '°': ' deg', '∆': 'delta', 'μ': 'u', '€': 'EUR',
  };

  function winAnsi(str) {
    let out = '';
    const s = String(str == null ? '' : str);
    for (let i = 0; i < s.length; i += 1) {
      const ch = s[i];
      const code = s.charCodeAt(i);
      if (code >= 32 && code <= 126) { out += ch; continue; }
      if (TRANSLIT[ch] !== undefined) { out += TRANSLIT[ch]; continue; }
      if (code >= 160 && code <= 255) { out += ch; continue; } // latin-1 maps 1:1
      out += '?';
    }
    return out;
  }

  const escapePdf = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

  function textWidth(str, font, size) {
    const f = FONTS[font] || FONTS.helv;
    if (f.fixed) return (str.length * f.fixed * size) / 1000;
    let w = 0;
    for (let i = 0; i < str.length; i += 1) {
      const c = str.charCodeAt(i);
      w += c >= 32 && c <= 126 ? f.widths[c - 32] : 556;
    }
    return (w * size) / 1000;
  }

  function wrap(str, font, size, maxWidth) {
    const words = winAnsi(str).split(/\s+/).filter(Boolean);
    if (!words.length) return [''];
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? line + ' ' + word : word;
      if (textWidth(trial, font, size) <= maxWidth || !line) {
        line = trial;
      } else {
        lines.push(line);
        line = word;
      }
      // A single token longer than the column (a 64-char digest) is hard-split.
      while (textWidth(line, font, size) > maxWidth && line.length > 1) {
        let cut = line.length;
        while (cut > 1 && textWidth(line.slice(0, cut), font, size) > maxWidth) cut -= 1;
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  /* ------------------------------------------------------------- document */

  const PAGE = { w: 595.28, h: 841.89 };       // A4 portrait, points
  const MARGIN = { top: 56, bottom: 58, left: 48, right: 48 };
  const CONTENT_W = PAGE.w - MARGIN.left - MARGIN.right;

  const PALETTE = {
    ink: [0.08, 0.11, 0.10],
    muted: [0.42, 0.47, 0.45],
    hair: [0.80, 0.83, 0.81],
    accent: [0.05, 0.42, 0.31],
    verified: [0.09, 0.45, 0.28],
    failed: [0.68, 0.17, 0.11],
    missing: [0.42, 0.44, 0.43],
    simulated: [0.38, 0.30, 0.62],
    review: [0.62, 0.42, 0.06],
    band: [0.957, 0.969, 0.961],
  };

  const STATE_COLOR = {
    VERIFIED: PALETTE.verified, FAILED: PALETTE.failed, MISSING: PALETTE.missing,
    SIMULATED: PALETTE.simulated, REQUIRES_REVIEW: PALETTE.review,
    NOT_APPLICABLE: PALETTE.muted, INSUFFICIENT_COVERAGE: PALETTE.review,
  };

  function Writer(meta) {
    this.meta = meta || {};
    this.pages = [];
    this.cur = null;
    this.y = 0;
    this.newPage();
  }

  Writer.prototype.newPage = function () {
    this.cur = { ops: [] };
    this.pages.push(this.cur);
    this.y = PAGE.h - MARGIN.top;
    this.header();
    return this;
  };

  Writer.prototype.need = function (h) {
    if (this.y - h < MARGIN.bottom) this.newPage();
    return this;
  };

  Writer.prototype.op = function (s) { this.cur.ops.push(s); return this; };

  Writer.prototype.rgb = function (c) { return c[0].toFixed(3) + ' ' + c[1].toFixed(3) + ' ' + c[2].toFixed(3); };

  Writer.prototype.text = function (str, x, y, font, size, color) {
    const f = FONTS[font] || FONTS.helv;
    this.op('BT ' + this.rgb(color || PALETTE.ink) + ' rg /' + f.res + ' ' + size + ' Tf 1 0 0 1 ' +
      x.toFixed(2) + ' ' + y.toFixed(2) + ' Tm (' + escapePdf(winAnsi(str)) + ') Tj ET');
    return this;
  };

  Writer.prototype.rect = function (x, y, w, h, color) {
    this.op(this.rgb(color) + ' rg ' + x.toFixed(2) + ' ' + y.toFixed(2) + ' ' +
      w.toFixed(2) + ' ' + h.toFixed(2) + ' re f');
    return this;
  };

  Writer.prototype.line = function (x1, y1, x2, y2, color, width) {
    this.op(this.rgb(color || PALETTE.hair) + ' RG ' + (width || 0.5) + ' w ' +
      x1.toFixed(2) + ' ' + y1.toFixed(2) + ' m ' + x2.toFixed(2) + ' ' + y2.toFixed(2) + ' l S');
    return this;
  };

  Writer.prototype.header = function () {
    const m = this.meta;
    this.text(m.product || 'VSENSE Halal Logistics', MARGIN.left, PAGE.h - 34, 'helvB', 8, PALETTE.accent);
    const right = m.packetId || '';
    this.text(right, PAGE.w - MARGIN.right - textWidth(winAnsi(right), 'cour', 8), PAGE.h - 34, 'cour', 8, PALETTE.muted);
    this.line(MARGIN.left, PAGE.h - 42, PAGE.w - MARGIN.right, PAGE.h - 42, PALETTE.hair, 0.6);
    return this;
  };

  /* ---------------------------------------------------------- block types */

  Writer.prototype.title = function (str, sub) {
    this.need(70);
    const lines = wrap(str, 'helvB', 20, CONTENT_W);
    for (const l of lines) { this.y -= 23; this.text(l, MARGIN.left, this.y, 'helvB', 20); }
    if (sub) {
      const subLines = wrap(sub, 'helv', 10, CONTENT_W);
      this.y -= 4;
      for (const l of subLines) { this.y -= 13; this.text(l, MARGIN.left, this.y, 'helv', 10, PALETTE.muted); }
    }
    this.y -= 10;
    return this;
  };

  Writer.prototype.heading = function (str) {
    this.need(40);
    this.y -= 22;
    this.text(String(str).toUpperCase(), MARGIN.left, this.y, 'helvB', 10, PALETTE.accent);
    this.y -= 6;
    this.line(MARGIN.left, this.y, PAGE.w - MARGIN.right, this.y, PALETTE.accent, 0.9);
    this.y -= 6;
    return this;
  };

  Writer.prototype.subheading = function (str) {
    this.need(26);
    this.y -= 16;
    this.text(str, MARGIN.left, this.y, 'helvB', 9.5);
    this.y -= 3;
    return this;
  };

  Writer.prototype.para = function (str, opts) {
    const o = opts || {};
    const size = o.size || 9;
    const color = o.color || (o.muted ? PALETTE.muted : PALETTE.ink);
    const font = o.mono ? 'cour' : 'helv';
    const lines = wrap(str, font, size, CONTENT_W);
    for (const l of lines) {
      this.need(size + 4);
      this.y -= size + 3.5;
      this.text(l, MARGIN.left, this.y, font, size, color);
    }
    this.y -= 4;
    return this;
  };

  Writer.prototype.note = function (str) {
    const lines = wrap(str, 'helv', 8.5, CONTENT_W - 18);
    const h = lines.length * 12 + 12;
    this.need(h);
    this.y -= h;
    this.rect(MARGIN.left, this.y, CONTENT_W, h, PALETTE.band);
    this.rect(MARGIN.left, this.y, 2.5, h, PALETTE.accent);
    let ty = this.y + h - 13;
    for (const l of lines) { this.text(l, MARGIN.left + 12, ty, 'helv', 8.5, PALETTE.ink); ty -= 12; }
    this.y -= 6;
    return this;
  };

  /** Two-column key/value block. */
  Writer.prototype.kv = function (rows, opts) {
    const o = opts || {};
    const keyW = o.keyWidth || 150;
    const valW = CONTENT_W - keyW - 10;
    for (const row of rows) {
      const kLines = wrap(row[0], 'helv', 8.5, keyW);
      const vMono = o.mono || row[2] === 'mono';
      const vLines = wrap(String(row[1] == null ? '' : row[1]), vMono ? 'cour' : 'helv', 8.5, valW);
      const h = Math.max(kLines.length, vLines.length) * 11.5 + 2;
      this.need(h);
      let ty = this.y - 10;
      for (const l of kLines) { this.text(l, MARGIN.left, ty, 'helv', 8.5, PALETTE.muted); ty -= 11.5; }
      ty = this.y - 10;
      const color = STATE_COLOR[row[1]] || PALETTE.ink;
      for (const l of vLines) {
        this.text(l, MARGIN.left + keyW + 10, ty, vMono ? 'cour' : 'helv', 8.5, color);
        ty -= 11.5;
      }
      this.y -= h;
    }
    this.y -= 4;
    return this;
  };

  /**
   * Table with explicit column widths (fractions of the content width).
   * cols: [{ label, width, mono, align }]
   */
  Writer.prototype.table = function (cols, rows) {
    const widths = cols.map((c) => c.width * CONTENT_W);
    const drawHead = () => {
      this.need(24);
      this.y -= 15;
      this.rect(MARGIN.left, this.y - 3, CONTENT_W, 15, PALETTE.band);
      let x = MARGIN.left + 4;
      cols.forEach((c, i) => {
        this.text(String(c.label).toUpperCase(), x, this.y + 1, 'helvB', 7, PALETTE.muted);
        x += widths[i];
      });
      this.y -= 5;
    };
    drawHead();

    for (const row of rows) {
      const cellLines = cols.map((c, i) =>
        wrap(String(row[i] == null ? '' : row[i]), c.mono ? 'cour' : 'helv', 7.8, widths[i] - 8));
      const h = Math.max.apply(null, cellLines.map((l) => l.length)) * 10.5 + 6;
      if (this.y - h < MARGIN.bottom) { this.newPage(); drawHead(); }
      this.need(h);
      let x = MARGIN.left + 4;
      cols.forEach((c, i) => {
        let ty = this.y - 9;
        const color = STATE_COLOR[String(row[i]).trim()] || (c.muted ? PALETTE.muted : PALETTE.ink);
        const bold = STATE_COLOR[String(row[i]).trim()] ? 'helvB' : (c.mono ? 'cour' : 'helv');
        for (const l of cellLines[i]) {
          this.text(l, x, ty, c.mono ? 'cour' : bold, 7.8, color);
          ty -= 10.5;
        }
        x += widths[i];
      });
      this.y -= h;
      this.line(MARGIN.left, this.y + 1, PAGE.w - MARGIN.right, this.y + 1, PALETTE.hair, 0.4);
    }
    this.y -= 6;
    return this;
  };

  /** Monospace digest block with a label; wraps a 64-char hash cleanly. */
  Writer.prototype.hashBlock = function (label, value, caption) {
    const lines = wrap(String(value), 'cour', 9, CONTENT_W - 20);
    const h = lines.length * 12 + (caption ? 26 : 14) + 14;
    this.need(h);
    this.y -= h;
    this.rect(MARGIN.left, this.y, CONTENT_W, h, PALETTE.band);
    let ty = this.y + h - 13;
    this.text(String(label).toUpperCase(), MARGIN.left + 10, ty, 'helvB', 7, PALETTE.muted);
    ty -= 13;
    for (const l of lines) { this.text(l, MARGIN.left + 10, ty, 'cour', 9, PALETTE.ink); ty -= 12; }
    if (caption) { this.text(caption, MARGIN.left + 10, ty - 1, 'helv', 7.5, PALETTE.muted); }
    this.y -= 6;
    return this;
  };

  Writer.prototype.spacer = function (h) { this.y -= (h || 8); return this; };
  Writer.prototype.pageBreak = function () { this.newPage(); return this; };

  /* ------------------------------------------------------------ assembly */

  Writer.prototype.finish = function (opts) {
    const o = opts || {};
    const total = this.pages.length;

    // Footers last, so the page count is known.
    this.pages.forEach((p, i) => {
      const save = this.cur;
      this.cur = p;
      this.line(MARGIN.left, MARGIN.bottom - 10, PAGE.w - MARGIN.right, MARGIN.bottom - 10, PALETTE.hair, 0.6);
      const label = this.meta.footer || '';
      this.text(label, MARGIN.left, MARGIN.bottom - 22, 'helv', 7, PALETTE.muted);
      const pg = 'Page ' + (i + 1) + ' of ' + total;
      this.text(pg, PAGE.w - MARGIN.right - textWidth(pg, 'helv', 7), MARGIN.bottom - 22, 'helv', 7, PALETTE.muted);
      this.cur = save;
    });

    return serialize(this.pages, this.meta, o.attachment);
  };

  /**
   * Serialize to PDF bytes. Deterministic: no clock is read, and the document
   * ID is derived from the caller-supplied digest, so identical input yields
   * identical output bytes.
   */
  function serialize(pages, meta, attachment) {
    const objects = [];   // 1-indexed; objects[i] is object i+1
    const put = (body) => { objects.push(body); return objects.length; };

    const catalogId = put(null);     // reserved, filled last
    const pagesId = put(null);
    const fontIds = {};
    Object.keys(FONTS).forEach((k) => {
      fontIds[k] = put('<< /Type /Font /Subtype /Type1 /BaseFont /' + FONTS[k].base +
        ' /Encoding /WinAnsiEncoding >>');
    });

    const pageIds = [];
    pages.forEach((p) => {
      const stream = p.ops.join('\n');
      const contentId = put('<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream');
      const fontRes = Object.keys(FONTS)
        .map((k) => '/' + FONTS[k].res + ' ' + fontIds[k] + ' 0 R').join(' ');
      pageIds.push(put('<< /Type /Page /Parent ' + pagesId + ' 0 R /MediaBox [0 0 ' +
        PAGE.w.toFixed(2) + ' ' + PAGE.h.toFixed(2) + '] /Resources << /Font << ' + fontRes +
        ' >> /ProcSet [/PDF /Text] >> /Contents ' + contentId + ' 0 R >>'));
    });

    objects[pagesId - 1] = '<< /Type /Pages /Kids [' +
      pageIds.map((id) => id + ' 0 R').join(' ') + '] /Count ' + pageIds.length + ' >>';

    // Document info. Dates come from the packet, never from the clock.
    const asOf = meta.pdfDate || 'D:19700101000000Z';
    const infoId = put('<< /Title (' + escapePdf(winAnsi(meta.title || 'Audit packet')) +
      ') /Author (' + escapePdf(winAnsi(meta.author || 'VSENSE Halal Logistics')) +
      ') /Subject (' + escapePdf(winAnsi(meta.subject || '')) +
      ') /Creator (VSENSE Halal Logistics audit packet renderer) ' +
      '/Producer (VSENSE deterministic PDF writer) /CreationDate (' + asOf + ') /ModDate (' + asOf + ') >>');

    // Optional embedded canonical JSON, so the PDF carries the machine-readable packet.
    let namesEntry = '';
    if (attachment && attachment.bytes) {
      const bin = attachment.bytes;
      let binStr = '';
      for (let i = 0; i < bin.length; i += 1) binStr += String.fromCharCode(bin[i]);
      const efId = put('<< /Type /EmbeddedFile /Subtype /application#2Fjson /Length ' + bin.length +
        ' /Params << /Size ' + bin.length + ' >> >>\nstream\n' + binStr + '\nendstream');
      const fsId = put('<< /Type /Filespec /F (' + escapePdf(attachment.name) + ') /UF (' +
        escapePdf(attachment.name) + ') /Desc (' + escapePdf(winAnsi(attachment.desc || '')) +
        ') /EF << /F ' + efId + ' 0 R >> >>');
      namesEntry = ' /Names << /EmbeddedFiles << /Names [(' + escapePdf(attachment.name) + ') ' +
        fsId + ' 0 R] >> >>';
    }

    objects[catalogId - 1] = '<< /Type /Catalog /Pages ' + pagesId + ' 0 R' + namesEntry +
      ' /PageLayout /SinglePage >>';

    // ---- byte assembly with an accurate cross-reference table
    let out = '%PDF-1.7\n%\xE2\xE3\xCF\xD3\n';
    const offsets = new Array(objects.length + 1).fill(0);
    for (let i = 0; i < objects.length; i += 1) {
      offsets[i + 1] = out.length;
      out += (i + 1) + ' 0 obj\n' + objects[i] + '\nendobj\n';
    }
    const xrefStart = out.length;
    out += 'xref\n0 ' + (objects.length + 1) + '\n';
    out += '0000000000 65535 f \n';
    for (let i = 1; i <= objects.length; i += 1) {
      out += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
    }
    const docId = (meta.docId || '0').replace(/[^0-9a-fA-F]/g, '').padEnd(32, '0').slice(0, 32).toUpperCase();
    out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root ' + catalogId + ' 0 R /Info ' +
      infoId + ' 0 R /ID [<' + docId + '> <' + docId + '>] >>\n' +
      'startxref\n' + xrefStart + '\n%%EOF\n';

    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i += 1) bytes[i] = out.charCodeAt(i) & 0xff;
    return bytes;
  }

  VS.pdf = {
    Writer: Writer,
    create: (meta) => new Writer(meta),
    PALETTE: PALETTE,
    textWidth: textWidth,
    wrap: wrap,
    PAGE: PAGE,
    MARGIN: MARGIN,
    CONTENT_W: CONTENT_W,
  };
})(typeof window !== 'undefined' ? window : globalThis);