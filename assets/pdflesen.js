"use strict";
/* PDF-Text offline lesen (ab 0.31) - ohne fremde Bibliothek, ohne Netz.
 *
 *   const pdf = await pdfLesen(bytes)      bytes = Uint8Array der Datei
 *   pdf.seiten = [ [ zeile, zeile ... ], ... ]   Zeilen von oben nach unten
 *   zeile = { y, g, zellen: [{ x, x2, s }], text }
 *
 * "Zellen" sind Textstuecke einer Zeile, die durch eine deutliche Luecke getrennt
 * sind (Tabellenspalten). x/x2 = linker/rechter Rand - damit lassen sich Spalten
 * auch dann zuordnen, wenn eine Zelle leer ist.
 *
 * Kann: PDF 1.0-2.0 mit Text (FlateDecode, ASCII85, ASCIIHex, Objekt-Stroeme),
 * eingebettete Schriften mit ToUnicode, einfache Schriften (WinAnsi/MacRoman/
 * Differences), Formulare (XObject). Kann nicht: Scans/Fotos (kein Text in der
 * Datei), passwortgeschuetzte PDFs - beides wird klar gemeldet. */

const pdfLesen = (() => {
  const LEER = /[\x00\t\n\f\r ]/;
  const ENDE = /[\x00\t\n\f\r ()<>\[\]{}\/%]/;
  const istStrom = (v) => v && typeof v === "object" && v.dict && v.a !== undefined;

  // ---------------------------------------------------------- Objekte lesen
  class Leser {
    constructor(s, p = 0) { this.s = s; this.p = p; }
    luecke() {
      const s = this.s;
      for (;;) {
        while (this.p < s.length && LEER.test(s[this.p])) this.p++;
        if (s[this.p] !== "%") return;
        while (this.p < s.length && s[this.p] !== "\n" && s[this.p] !== "\r") this.p++;
      }
    }
    /** Naechster Wert: Zahl, "/Name", {str}, [Liste], {Verzeichnis}, {ref}, {op} oder undefined am Ende. */
    wert(tiefe = 0) {
      this.luecke();
      const s = this.s;
      if (this.p >= s.length) return undefined;
      if (tiefe > 60) throw new Error("zu tief verschachtelt");
      const c = s[this.p];
      if (c === "/") {
        let e = this.p + 1;
        while (e < s.length && !ENDE.test(s[e])) e++;
        const n = s.slice(this.p, e).replace(/#([0-9a-fA-F]{2})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
        this.p = e;
        return n;
      }
      if (c === "<" && s[this.p + 1] === "<") {
        this.p += 2;
        const d = {};
        for (;;) {
          this.luecke();
          if (this.p >= s.length) break;
          if (s[this.p] === ">" && s[this.p + 1] === ">") { this.p += 2; break; }
          const k = this.wert(tiefe + 1);
          if (typeof k !== "string" || k[0] !== "/") { if (k === undefined) break; continue; }
          const v = this.wert(tiefe + 1);
          if (v && v.op === ">>") break;
          d[k.slice(1)] = v;
        }
        return d;
      }
      if (c === "<") {
        const e = s.indexOf(">", this.p);
        let h = s.slice(this.p + 1, e < 0 ? s.length : e).replace(/[^0-9a-fA-F]/g, "");
        if (h.length % 2) h += "0";
        this.p = e < 0 ? s.length : e + 1;
        let t = "";
        for (let i = 0; i < h.length; i += 2) t += String.fromCharCode(parseInt(h.substr(i, 2), 16));
        return { str: t };
      }
      if (c === "(") {
        let t = "", offen = 1, i = this.p + 1;
        for (; i < s.length; i++) {
          const z = s[i];
          if (z === "\\") {
            const n = s[++i];
            if (n >= "0" && n <= "7") {
              let o = n;
              while (o.length < 3 && s[i + 1] >= "0" && s[i + 1] <= "7") o += s[++i];
              t += String.fromCharCode(parseInt(o, 8) & 255);
            } else if (n === "\r") { if (s[i + 1] === "\n") i++; }
            else if (n === "\n") { /* Zeilenfortsetzung */ }
            else t += { n: "\n", r: "\r", t: "\t", b: "\b", f: "\f" }[n] ?? n ?? "";
          } else if (z === "(") { offen++; t += z; }
          else if (z === ")") { if (--offen === 0) break; t += z; }
          else t += z;
        }
        this.p = i + 1;
        return { str: t };
      }
      if (c === "[") {
        this.p++;
        const l = [];
        for (;;) {
          this.luecke();
          if (this.p >= s.length) break;
          if (s[this.p] === "]") { this.p++; break; }
          const v = this.wert(tiefe + 1);
          if (v === undefined) break;
          l.push(v);
        }
        return l;
      }
      if (c === "]" || c === ")" || c === "{" || c === "}") { this.p++; return { op: c }; }
      if (c === ">") { this.p += s[this.p + 1] === ">" ? 2 : 1; return { op: ">>" }; }
      const zm = /[+-]?(?:\d+\.?\d*|\.\d+)/y;
      zm.lastIndex = this.p;
      const z = zm.exec(s);
      if (z && (zm.lastIndex >= s.length || ENDE.test(s[zm.lastIndex]))) {
        this.p = zm.lastIndex;
        if (/^\d+$/.test(z[0])) {                     // "12 0 R" = Verweis
          const rm = /[\x00\t\n\f\r ]+(\d+)[\x00\t\n\f\r ]+R(?![^\x00\t\n\f\r ()<>\[\]{}\/%])/y;
          rm.lastIndex = this.p;
          if (rm.exec(s)) { this.p = rm.lastIndex; return { ref: +z[0] }; }
        }
        return parseFloat(z[0]);
      }
      let e = this.p;
      while (e < s.length && !ENDE.test(s[e])) e++;
      if (e === this.p) e++;
      const w = s.slice(this.p, e);
      this.p = e;
      return w === "true" ? true : w === "false" ? false : w === "null" ? null : { op: w };
    }
  }

  const alsText = (b) => {
    let t = "";
    for (let i = 0; i < b.length; i += 32768) t += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
    return t;
  };
  const alsBytes = (t) => { const b = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) b[i] = t.charCodeAt(i) & 255; return b; };

  // ---------------------------------------------------------- Stroeme entpacken
  // 0.63 (Sicherheit): Gesamtbudget je PDF gegen "Zip-Bomben" aus vielen kleinen Stroemen
  let budget = 0;
  async function entpacken(b, art) {
    const ds = new DecompressionStream(art), w = ds.writable.getWriter();
    w.write(b).catch(() => {}); w.close().catch(() => {});
    const r = ds.readable.getReader(), teile = [];
    let n = 0;
    try {
      for (;;) {
        const { done, value } = await r.read();
        if (done) break;
        teile.push(value); n += value.length; budget += value.length;
        if (n > 60e6 || budget > 200e6) throw new Error("PDF-Inhalt zu groß");
      }
    } catch (e) { if (!n || budget > 200e6) throw e; }   // Rest hinter dem Ende: behalten, was da ist (Budget-Ueberlauf aber abbrechen)
    const aus = new Uint8Array(n);
    let p = 0;
    for (const t of teile) { aus.set(t, p); p += t.length; }
    return aus;
  }
  async function flate(b) {
    try { return await entpacken(b, "deflate"); } catch { return await entpacken(b, "deflate-raw"); }
  }
  function ascii85(b) {
    const t = alsText(b).replace(/\s/g, "").replace(/^<~/, "").replace(/~>.*$/s, ""), aus = [];
    for (let i = 0; i < t.length;) {
      if (t[i] === "z") { aus.push(0, 0, 0, 0); i++; continue; }
      const g = t.slice(i, i + 5); i += 5;
      let n = 0;
      for (let j = 0; j < 5; j++) n = n * 85 + ((j < g.length ? g.charCodeAt(j) : 117) - 33);
      const vier = [n >>> 24 & 255, n >>> 16 & 255, n >>> 8 & 255, n & 255];
      aus.push(...vier.slice(0, g.length - 1));
    }
    return Uint8Array.from(aus);
  }
  function asciiHex(b) {
    let h = alsText(b).replace(/>.*$/s, "").replace(/[^0-9a-fA-F]/g, "");
    if (h.length % 2) h += "0";
    const aus = new Uint8Array(h.length / 2);
    for (let i = 0; i < aus.length; i++) aus[i] = parseInt(h.substr(i * 2, 2), 16);
    return aus;
  }
  /** PNG-Vorhersage (Predictor >= 10), kommt bei Objekt-Stroemen vor. */
  function vorhersage(b, parms) {
    const pr = parms?.Predictor || 1;
    if (pr < 10) return b;
    const spalten = parms.Columns || 1, bpp = Math.max(1, Math.ceil((parms.Colors || 1) * (parms.BitsPerComponent || 8) / 8));
    const breite = Math.ceil(spalten * (parms.Colors || 1) * (parms.BitsPerComponent || 8) / 8), zeilen = Math.floor(b.length / (breite + 1));
    const aus = new Uint8Array(zeilen * breite);
    for (let z = 0; z < zeilen; z++) {
      const art = b[z * (breite + 1)], ein = z * (breite + 1) + 1, o = z * breite;
      for (let i = 0; i < breite; i++) {
        const links = i >= bpp ? aus[o + i - bpp] : 0, oben = z ? aus[o - breite + i] : 0, lo = z && i >= bpp ? aus[o - breite + i - bpp] : 0;
        let v = b[ein + i];
        if (art === 1) v += links;
        else if (art === 2) v += oben;
        else if (art === 3) v += (links + oben) >> 1;
        else if (art === 4) { const p = links + oben - lo, a = Math.abs(p - links), bb = Math.abs(p - oben), c = Math.abs(p - lo); v += a <= bb && a <= c ? links : bb <= c ? oben : lo; }
        aus[o + i] = v & 255;
      }
    }
    return aus;
  }

  // ---------------------------------------------------------- Schriften
  const WIN = "€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008dŽ\u008f\u0090‘’“”•–—˜™š›œ\u009džŸ";
  const MAC = "ÄÅÇÉÑÖÜáàâäãåçéèêëíìîïñóòôöõúùûü†°¢£§•¶ß®©™´¨≠ÆØ∞±≤≥¥µ∂∑∏π∫ªºΩæø¿¡¬√ƒ≈∆«»… ÀÃÕŒœ–—“”‘’÷◊ÿŸ⁄€‹›ﬁﬂ‡·‚„‰ÂÊÁËÈÍÎÏÌÓÔÒÚÛÙıˆ˜¯˘˙˚¸˝˛ˇ";
  const GLYPHEN = { space: " ", nbspace: " ", exclam: "!", quotedbl: '"', numbersign: "#", dollar: "$", percent: "%", ampersand: "&",
    quotesingle: "'", parenleft: "(", parenright: ")", asterisk: "*", plus: "+", comma: ",", hyphen: "-", minus: "-", period: ".", slash: "/",
    zero: "0", one: "1", two: "2", three: "3", four: "4", five: "5", six: "6", seven: "7", eight: "8", nine: "9",
    colon: ":", semicolon: ";", less: "<", equal: "=", greater: ">", question: "?", at: "@", bracketleft: "[", backslash: "\\",
    bracketright: "]", asciicircum: "^", underscore: "_", grave: "`", braceleft: "{", bar: "|", braceright: "}", asciitilde: "~",
    Euro: "€", sterling: "£", yen: "¥", cent: "¢", section: "§", copyright: "©", registered: "®", trademark: "™", degree: "°",
    plusminus: "±", mu: "µ", multiply: "×", divide: "÷", onehalf: "½", onequarter: "¼", threequarters: "¾", bullet: "•",
    endash: "–", emdash: "—", quoteleft: "‘", quoteright: "’", quotedblleft: "“", quotedblright: "”", quotedblbase: "„",
    quotesinglbase: "‚", ellipsis: "…", guillemotleft: "«", guillemotright: "»", guilsinglleft: "‹", guilsinglright: "›",
    germandbls: "ß", fi: "fi", fl: "fl", ff: "ff", ffi: "ffi", ffl: "ffl", AE: "Æ", ae: "æ", Oslash: "Ø", oslash: "ø", OE: "Œ", oe: "œ",
    dotlessi: "ı", exclamdown: "¡", questiondown: "¿", periodcentered: "·", paragraph: "¶", dagger: "†", daggerdbl: "‡",
    perthousand: "‰", fraction: "⁄", florin: "ƒ", currency: "¤", brokenbar: "¦", logicalnot: "¬", ordfeminine: "ª", ordmasculine: "º",
    onesuperior: "¹", twosuperior: "²", threesuperior: "³", Eth: "Ð", eth: "ð", Thorn: "Þ", thorn: "þ", Lslash: "Ł", lslash: "ł",
    acute: "´", dieresis: "¨", circumflex: "ˆ", tilde: "˜", cedilla: "¸", macron: "¯" };
  const AKZENTE = { dieresis: "̈", acute: "́", grave: "̀", circumflex: "̂", tilde: "̃", cedilla: "̧",
                    ring: "̊", caron: "̌", macron: "̄", breve: "̆", ogonek: "̨", dotaccent: "̇" };
  function glyphe(name) {
    const n = name.replace(/^\//, "").split(".")[0];
    if (GLYPHEN[n] !== undefined) return GLYPHEN[n];
    if (n.length === 1) return n;
    let m;
    if ((m = n.match(/^uni([0-9A-Fa-f]{4})+$/))) return n.slice(3).match(/.{4}/g).map((h) => String.fromCharCode(parseInt(h, 16))).join("");
    if ((m = n.match(/^u([0-9A-Fa-f]{4,6})$/))) return String.fromCodePoint(parseInt(m[1], 16));
    if ((m = n.match(/^([A-Za-z])([a-z]+)$/)) && AKZENTE[m[2]]) return (m[1] + AKZENTE[m[2]]).normalize("NFC");
    return "";
  }
  // Helvetica, Zeichen 32-126: fuer Standardschriften ohne Breitenangabe (reportlab, FPDF ...)
  const HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556,
    278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611,
    722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
    556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];

  function hexText(h) {
    h = h.replace(/\s/g, "");
    if (h.length <= 2) return String.fromCharCode(parseInt(h || "0", 16));
    let t = "";
    for (let i = 0; i + 3 < h.length; i += 4) t += String.fromCharCode(parseInt(h.substr(i, 4), 16));
    return t;
  }
  function toUnicode(t) {
    const map = new Map();
    let laenge = 0;
    const cs = t.match(/begincodespacerange\s*<([0-9a-fA-F\s]+)>/);
    if (cs) laenge = cs[1].replace(/\s/g, "").length / 2;
    for (const block of t.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
      for (const m of block[1].matchAll(/<([0-9a-fA-F\s]+)>\s*<([0-9a-fA-F\s]*)>/g)) map.set(parseInt(m[1].replace(/\s/g, ""), 16), hexText(m[2]));
    for (const block of t.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
      for (const m of block[1].matchAll(/<([0-9a-fA-F\s]+)>\s*<([0-9a-fA-F\s]+)>\s*(?:<([0-9a-fA-F\s]*)>|\[([^\]]*)\])/g)) {
        const von = parseInt(m[1].replace(/\s/g, ""), 16), bis = Math.min(parseInt(m[2].replace(/\s/g, ""), 16), von + 65535);
        if (m[3] !== undefined) {
          const start = hexText(m[3]);
          for (let c = von; c <= bis; c++)
            map.set(c, start.slice(0, -1) + String.fromCharCode(start.charCodeAt(start.length - 1) + c - von));
        } else {
          const ziele = [...m[4].matchAll(/<([0-9a-fA-F\s]*)>/g)].map((x) => hexText(x[1]));
          for (let c = von; c <= bis && c - von < ziele.length; c++) map.set(c, ziele[c - von]);
        }
      }
    return { map, laenge };
  }

  // ---------------------------------------------------------- Matrizen
  const mal = (a, b) => [a[0] * b[0] + a[1] * b[2], a[0] * b[1] + a[1] * b[3], a[2] * b[0] + a[3] * b[2], a[2] * b[1] + a[3] * b[3],
                         a[4] * b[0] + a[5] * b[2] + b[4], a[4] * b[1] + a[5] * b[3] + b[5]];
  const EINS = [1, 0, 0, 1, 0, 0];

  // ---------------------------------------------------------- Hauptteil
  return async function pdfLesen(bytes) {
    budget = 0;
    const s = alsText(bytes);
    const kopf = s.indexOf("%PDF-");
    if (kopf < 0 || kopf > 1024) throw new Error("Das ist keine PDF-Datei.");
    const obj = {};
    const re = /(\d+)[\x00\t\n\f\r ]+(\d+)[\x00\t\n\f\r ]+obj(?![A-Za-z])/g;
    let m;
    while ((m = re.exec(s))) {
      const L = new Leser(s, re.lastIndex);
      let v;
      try { v = L.wert(); } catch { continue; }
      L.luecke();
      if (s.startsWith("stream", L.p) && v && typeof v === "object" && !Array.isArray(v)) {
        let a = L.p + 6;
        if (s[a] === "\r") a++;
        if (s[a] === "\n") a++;
        let e = -1;
        if (typeof v.Length === "number" && /^[\x00\t\n\f\r ]*endstream/.test(s.substr(a + v.Length, 24))) e = a + v.Length;
        if (e < 0) {
          e = s.indexOf("endstream", a);
          if (e < 0) e = s.length;
          else { if (s[e - 1] === "\n") e--; if (s[e - 1] === "\r") e--; }
        }
        v = { dict: v, a, e };
        re.lastIndex = e;
      } else re.lastIndex = Math.max(L.p, re.lastIndex);
      obj[m[1]] = v;
    }
    const hole = (v) => { for (let i = 0; v && v.ref !== undefined && i < 20; i++) v = obj[v.ref]; return v; };
    const dictVon = (v) => { v = hole(v); return istStrom(v) ? v.dict : v && typeof v === "object" && !Array.isArray(v) ? v : null; };

    const stromCache = new Map();
    async function strom(v) {
      v = hole(v);
      if (!istStrom(v)) return new Uint8Array(0);
      if (stromCache.has(v)) return stromCache.get(v);
      let b = bytes.subarray(v.a, v.e);
      let filter = hole(v.dict.Filter), parms = hole(v.dict.DecodeParms);
      filter = filter == null ? [] : Array.isArray(filter) ? filter.map(hole) : [filter];
      parms = Array.isArray(parms) ? parms.map(hole) : [parms];
      for (let i = 0; i < filter.length; i++) {
        const f = filter[i];
        if (f === "/FlateDecode" || f === "/Fl") b = vorhersage(await flate(b), parms[i]);
        else if (f === "/ASCII85Decode" || f === "/A85") b = ascii85(b);
        else if (f === "/ASCIIHexDecode" || f === "/AHx") b = asciiHex(b);
        else throw new Error("Kompression " + String(f).slice(1) + " wird nicht unterstützt");
      }
      stromCache.set(v, b);
      return b;
    }

    // Verschluesselt? Steht im trailer oder im XRef-Strom.
    let wurzel = null, verschluesselt = false;
    for (const t of s.matchAll(/trailer[\x00\t\n\f\r ]*(?=<<)/g)) {
      try { const d = new Leser(s, t.index + t[0].length).wert(); if (d.Encrypt) verschluesselt = true; if (d.Root) wurzel = d.Root; } catch { /* kaputter Trailer */ }
    }
    for (const v of Object.values(obj)) if (istStrom(v) && v.dict.Type === "/XRef") { if (v.dict.Encrypt) verschluesselt = true; if (v.dict.Root && !wurzel) wurzel = v.dict.Root; }
    if (verschluesselt) throw new Error("Diese PDF ist passwortgeschützt – bitte ohne Passwort speichern (z. B. „Drucken → als PDF speichern“) und noch einmal wählen.");

    // Objekt-Stroeme (PDF ab 1.5): viele Objekte gepackt in einem Strom
    for (const v of Object.values(obj)) {
      if (!istStrom(v) || v.dict.Type !== "/ObjStm") continue;
      try {
        const t = alsText(await strom(v)), n = hole(v.dict.N) || 0, erst = hole(v.dict.First) || 0;
        const zahlen = t.slice(0, erst).trim().split(/\s+/).map(Number);
        for (let i = 0; i < n; i++) {
          const nr = zahlen[2 * i], ab = zahlen[2 * i + 1];
          if (!Number.isFinite(nr) || !Number.isFinite(ab) || obj[nr] !== undefined) continue;
          try { obj[nr] = new Leser(t, erst + ab).wert(); } catch { /* einzelnes Objekt kaputt */ }
        }
      } catch { /* Strom nicht lesbar */ }
    }

    // Seiten in Reihenfolge
    const seiten = [];
    const baum = (v, geerbt, tiefe) => {
      const d = dictVon(v);
      if (!d || tiefe > 40 || seiten.length > 3000) return;
      const erbe = { Resources: d.Resources ?? geerbt.Resources, Rotate: d.Rotate ?? geerbt.Rotate };
      const kinder = hole(d.Kids);
      if (Array.isArray(kinder) && d.Type !== "/Page") { for (const k of kinder) baum(k, erbe, tiefe + 1); return; }
      if (d.Contents !== undefined) seiten.push({ d, ...erbe });
    };
    const kat = dictVon(wurzel) || Object.values(obj).map(dictVon).find((d) => d && d.Type === "/Catalog");
    if (kat) baum(kat.Pages, {}, 0);
    if (!seiten.length) {
      for (const v of Object.values(obj)) { const d = dictVon(v); if (d && d.Type === "/Page" && d.Contents !== undefined) seiten.push({ d, Resources: d.Resources, Rotate: d.Rotate }); }
    }
    if (!seiten.length) throw new Error("In dieser PDF wurden keine Seiten gefunden (Datei beschädigt?).");

    const schriften = new Map();
    async function schrift(v) {
      const d = dictVon(v);
      if (!d) return null;
      if (schriften.has(d)) return schriften.get(d);
      const f = { zwei: d.Subtype === "/Type0", uni: null, enc: null, breite: () => 0.5 };
      schriften.set(d, f);
      if (d.ToUnicode !== undefined && istStrom(hole(d.ToUnicode))) {
        try {
          const u = toUnicode(alsText(await strom(d.ToUnicode)));
          if (u.map.size) f.uni = u.map;
          if (f.zwei && u.laenge === 1) f.zwei = false;
        } catch { /* ohne ToUnicode weiter */ }
      }
      if (d.Subtype === "/Type0") {
        const k = dictVon((hole(d.DescendantFonts) || [])[0]) || {};
        const dw = (hole(k.DW) ?? 1000) / 1000, w = new Map(), l = hole(k.W) || [];
        for (let i = 0; i < l.length;) {
          const a = hole(l[i]), b = hole(l[i + 1]);
          if (Array.isArray(b)) { b.forEach((x, j) => w.set(a + j, hole(x) / 1000)); i += 2; }
          else { const x = hole(l[i + 2]) / 1000; for (let c = a; c <= b && c - a < 70000; c++) w.set(c, x); i += 3; }
        }
        f.breite = (c) => w.get(c) ?? dw;
      } else {
        const basis = String(d.BaseFont || ""), erst = hole(d.FirstChar) || 0, liste = hole(d.Widths);
        const skala = d.Subtype === "/Type3" ? Math.abs((hole(d.FontMatrix) || [0.001])[0]) : 0.001;
        const fest = /Courier/i.test(basis);
        const standard = (c) => fest ? 0.6 : (HELV[c - 32] ?? 556) / 1000;
        f.breite = Array.isArray(liste)
          ? (c) => { const x = hole(liste[c - erst]); return typeof x === "number" && x > 0 ? x * skala : c - erst >= 0 && c - erst < liste.length ? 0 : standard(c); }
          : standard;
        // Zeichentabelle: WinAnsi als Grundlage (deckt ASCII + Umlaute), MacRoman auf Wunsch, dann Differences
        const enc = Array.from({ length: 256 }, (_, c) => c >= 128 && c < 160 ? WIN[c - 128] : String.fromCharCode(c));
        let e = hole(d.Encoding);
        const name = typeof e === "string" ? e : dictVon(e)?.BaseEncoding;
        if (name === "/MacRomanEncoding") for (let c = 128; c < 256; c++) enc[c] = MAC[c - 128] ?? enc[c];
        e = dictVon(e);
        if (e && Array.isArray(hole(e.Differences))) {
          let c = 0;
          for (let x of hole(e.Differences)) {
            x = hole(x);
            if (typeof x === "number") c = x;
            else if (typeof x === "string") { const g = glyphe(x); if (g || !f.uni) enc[c] = g; c++; }
          }
        }
        f.enc = enc;
      }
      return f;
    }

    /** Einen Inhaltsstrom abspielen und die Textstuecke mit Position sammeln. */
    async function abspielen(text, res, ctm0, stuecke, tiefe) {
      const L = new Leser(text);
      const rd = dictVon(res) || {}, fontDict = dictVon(rd.Font) || {}, xobj = dictVon(rd.XObject) || {};
      const stapel = [], arg = [];
      let ctm = ctm0, tm = EINS, tlm = EINS, f = null, gr = 0, tc = 0, tw = 0, th = 1, tl = 0, hoch = 0;
      const zeigen = (str) => {
        if (!f || !str) return;
        let t = "", w = 0;
        const schritt = f.zwei ? 2 : 1;
        for (let i = 0; i + schritt <= str.length; i += schritt) {
          const c = f.zwei ? str.charCodeAt(i) * 256 + str.charCodeAt(i + 1) : str.charCodeAt(i);
          const z = f.uni?.get(c) ?? (f.enc ? f.enc[c] : "");
          t += z ?? "";
          w += (f.breite(c) * gr + tc + (!f.zwei && c === 32 ? tw : 0)) * th;
        }
        const a = mal([gr * th, 0, 0, gr, 0, hoch], mal(tm, ctm));
        tm = mal([1, 0, 0, 1, w, 0], tm);
        const b = mal(tm, ctm);
        const g = Math.hypot(a[2], a[3]) || Math.abs(gr);
        // Nicht druckbares (Steuerzeichen, Ersatzzeichen) raus; gedrehter Text (Wasserzeichen) bleibt draussen
        t = t.replace(/[\u0000-\u001f�­]/g, "").replace(/ /g, " ");
        if (t && Math.abs(a[1]) <= Math.abs(a[0]) * 0.2 + 1e-9) stuecke.push({ x: a[4], y: a[5], x2: b[4], s: t, g });
      };
      const zeile = (x, y) => { tlm = mal([1, 0, 0, 1, x, y], tlm); tm = tlm; };
      for (let n = 0; n < 3e6; n++) {
        let v;
        try { v = L.wert(); } catch { break; }
        if (v === undefined) break;
        if (!v || v.op === undefined) { if (arg.length < 64) arg.push(v); continue; }
        const o = v.op, z = (i) => typeof arg[i] === "number" ? arg[i] : 0;
        if (o === "q") stapel.push([ctm, f, gr, tc, tw, th, tl, hoch]);
        else if (o === "Q") { if (stapel.length) [ctm, f, gr, tc, tw, th, tl, hoch] = stapel.pop(); }
        else if (o === "cm") ctm = mal(arg.slice(0, 6).map((x) => +x || 0), ctm);
        else if (o === "BT") tm = tlm = EINS;
        else if (o === "Tf") { f = await schrift(fontDict[String(arg[0]).slice(1)]); gr = z(1); }
        else if (o === "Td") zeile(z(0), z(1));
        else if (o === "TD") { tl = -z(1); zeile(z(0), z(1)); }
        else if (o === "Tm") tm = tlm = arg.slice(0, 6).map((x) => +x || 0);
        else if (o === "T*") zeile(0, -tl);
        else if (o === "Tc") tc = z(0);
        else if (o === "Tw") tw = z(0);
        else if (o === "Tz") th = z(0) / 100;
        else if (o === "TL") tl = z(0);
        else if (o === "Ts") hoch = z(0);
        else if (o === "Tj") zeigen(arg[0]?.str);
        else if (o === "'") { zeile(0, -tl); zeigen(arg[0]?.str); }
        else if (o === '"') { tw = z(0); tc = z(1); zeile(0, -tl); zeigen(arg[2]?.str); }
        else if (o === "TJ") {
          for (const x of Array.isArray(arg[0]) ? arg[0] : []) {
            if (typeof x === "number") tm = mal([1, 0, 0, 1, -x / 1000 * gr * th, 0], tm);
            else zeigen(x?.str);
          }
        } else if (o === "Do" && tiefe < 8) {
          const x = hole(xobj[String(arg[0]).slice(1)]);
          if (istStrom(x) && x.dict.Subtype === "/Form") {
            try {
              const mx = (hole(x.dict.Matrix) || EINS).map((y) => +hole(y) || 0);
              await abspielen(alsText(await strom(x)), x.dict.Resources ?? res, mal(mx, ctm), stuecke, tiefe + 1);
            } catch { /* Formular nicht lesbar */ }
          }
        } else if (o === "BI") {                        // eingebettetes Bild ueberspringen
          const id = text.indexOf("ID", L.p), ei = /[\x00\t\n\f\r ]EI(?=[\x00\t\n\f\r ]|$)/g;
          ei.lastIndex = id < 0 ? L.p : id + 2;
          L.p = ei.exec(text) ? ei.lastIndex : text.length;
        }
        arg.length = 0;
      }
    }

    /** Textstuecke einer Seite zu Zeilen und Zellen ordnen. */
    function ordnen(stuecke) {
      stuecke.sort((a, b) => b.y - a.y || a.x - b.x);
      const zeilen = [];
      for (const st of stuecke) {
        const z = zeilen[zeilen.length - 1];
        if (z && Math.abs(z.y - st.y) <= 0.3 * Math.max(z.g, st.g)) z.st.push(st);
        else zeilen.push({ y: st.y, g: st.g, st: [st] });
      }
      return zeilen.map((z) => {
        z.st.sort((a, b) => a.x - b.x);
        const zellen = [];
        let c = null, ende = 0;
        for (const st of z.st) {
          const lueke = c ? st.x - ende : 0, g = Math.max(st.g, 1e-6);
          if (!c || lueke > 0.9 * g || lueke < -2 * g) { c = { x: st.x, x2: st.x2, s: st.s }; zellen.push(c); }
          else { c.s += (lueke > 0.17 * g && !/\s$/.test(c.s) && !/^\s/.test(st.s) ? " " : "") + st.s; c.x2 = Math.max(c.x2, st.x2); }
          ende = Math.max(st.x2, st.x);
        }
        for (const c of zellen) c.s = c.s.replace(/\s+/g, " ").trim();
        const voll = zellen.filter((c) => c.s);
        return { y: z.y, g: z.g, zellen: voll, text: voll.map((c) => c.s).join(" ") };
      }).filter((z) => z.zellen.length);
    }

    const aus = [];
    let zeichen = 0;
    for (const p of seiten) {
      const stuecke = [];
      try {
        let inhalt = hole(p.d.Contents);
        inhalt = Array.isArray(inhalt) ? inhalt : [p.d.Contents];
        let text = "";
        for (const c of inhalt) { try { text += alsText(await strom(c)) + "\n"; } catch { /* Teilstrom kaputt */ } }
        const dreh = ((hole(p.Rotate) || 0) % 360 + 360) % 360;
        const start = dreh === 90 ? [0, -1, 1, 0, 0, 0] : dreh === 180 ? [-1, 0, 0, -1, 0, 0] : dreh === 270 ? [0, 1, -1, 0, 0, 0] : EINS;
        await abspielen(text, p.Resources, start, stuecke, 0);
      } catch { /* Seite nicht lesbar: leer weiter */ }
      const zeilen = ordnen(stuecke);
      zeichen += zeilen.reduce((n, z) => n + z.text.length, 0);
      aus.push(zeilen);
    }
    if (zeichen < 20) throw new Error("Diese PDF enthält keinen lesbaren Text – vermutlich ein Scan oder Foto. Bitte die Original-PDF vom Anbieter nehmen (nicht abfotografiert).");
    return { seiten: aus, text: aus.map((z) => z.map((x) => x.text).join("\n")).join("\n\n") };
  };
})();
