"use strict";
/* Sprache (ab 0.38, Vorgabe 11.11.2026: Englisch als zweite Hauptsprache, weitere sollen folgen).
 *
 * Die Oberflaeche wird wie bisher deutsch gebaut und beim Anzeigen uebersetzt: jeder sichtbare
 * Text, Platzhalter, aria-label/title, Meldungen und Rueckfragen (confirm/alert/prompt).
 * Neue Sprache = neuer Eintrag in SPRACHEN + Woerterbuch UEB[code] (+ optional Muster).
 *
 * Woerterbuch: ganzer Text (getrimmt) -> Uebersetzung. Texte mit Zahlen werden als Vorlage
 * gesucht: jede Zahl wird zu "#" ("4 Positionen" -> "# Positionen" -> "# positions"), die
 * Zahlen kommen in gleicher Reihenfolge wieder hinein. Eigene Namen (Depots, Wertpapiere,
 * Notizen) stehen nicht im Woerterbuch und bleiben, wie sie sind. */

const SPRACHEN = { de: "Deutsch", en: "English" };
const UEB = { en: {} };          // wird von sprache_en.js gefuellt
const UEB_MUSTER = { en: [] };   // [RegExp, Ersatz] fuer Texte mit Namen darin

const ZAHL_RE = /[-+−]?\d[\d.,]*/g;
// Schon uebersetzte Texte (zweiter Durchlauf) nicht als "fehlend" melden
const ENGLISCH_WERTE = { has: (s) => Object.values(UEB).some((d) => Object.values(d).includes(s) || Object.values(d).includes(s.replace(ZAHL_RE, "#"))) };

function sprache() {
  try { const l = S?.einstellungen?.sprache; return SPRACHEN[l] ? l : "de"; } catch { return "de"; }
}

/** Einen Text uebersetzen (oder unveraendert lassen). */
function tr(s) {
  if (s == null) return s;
  const text = String(s), l = sprache();
  const m = text.match(/^(\s*)([\s\S]*?)(\s*)$/), kern = m[2];
  if (!kern) return text;
  if (window.__textSammler) window.__textSammler.add(kern);
  if (l === "de") return text;
  const r = trKern(kern, l);
  return r == null ? text : m[1] + r + m[3];
}

function trKern(kern, l) {
  const d = UEB[l] || {};
  if (d[kern] != null) return d[kern];
  // Vorlage mit Zahlen
  const zahlen = kern.match(ZAHL_RE);
  if (zahlen) {
    const vorlage = kern.replace(ZAHL_RE, "#");
    if (d[vorlage] != null) { let i = 0; return d[vorlage].replace(/#/g, () => zahlen[i++] ?? "#"); }
  }
  for (const [re, ers] of UEB_MUSTER[l] || []) { re.lastIndex = 0; if (re.test(kern)) { re.lastIndex = 0; return kern.replace(re, ers); } }
  // Zeilen einzeln (Meldungen mit \n)
  if (kern.includes("\n")) {
    const teile = kern.split("\n").map((z) => trKern(z.trim(), l) ?? z);
    return teile.join("\n");
  }
  if (window.__fehlend && !ENGLISCH_WERTE.has(kern)) window.__fehlend.add(kern);
  return null;
}

const TR_ATTR = ["placeholder", "title", "aria-label", "alt"];
const TR_AUSLASSEN = new Set(["SCRIPT", "STYLE", "TEXTAREA", "CODE"]);

/** Alles Sichtbare unter root uebersetzen (nach jedem Zeichnen).
 *  Der deutsche Originaltext jedes Knotens wird gemerkt: so geht auch das Zurueckschalten auf Deutsch,
 *  und Teile, die nie neu gezeichnet werden (Kopf, untere Leiste), werden richtig umgestellt. */
const TR_ORIG = new WeakMap();            // Textknoten -> [deutsch, zuletzt gesetzt]
const TR_ORIG_ATTR = new WeakMap();       // Element -> { attr: [deutsch, zuletzt gesetzt] }
let trJeAktiv = false;
function trOriginal(alt, aktuell) {
  // vom Programm geaendert (weder Original noch unsere letzte Uebersetzung) -> neuer deutscher Text
  return alt && (aktuell === alt[0] || aktuell === alt[1]) ? alt[0] : aktuell;
}
function uebersetzeDom(root = document.body) {
  if (!root) return;
  const l = sprache();
  if (l === "de" && !trJeAktiv && !window.__textSammler) return;
  if (l !== "de") trJeAktiv = true;
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = w.currentNode; n; n = w.nextNode()) {
    if (n.nodeType === 1) {
      for (const a of TR_ATTR) if (n.hasAttribute?.(a)) {
        const m = TR_ORIG_ATTR.get(n) || {}, v = n.getAttribute(a), de = trOriginal(m[a], v), u = tr(de);
        m[a] = [de, u]; TR_ORIG_ATTR.set(n, m);
        if (u !== v) n.setAttribute(a, u);
      }
      continue;
    }
    const p = n.parentElement;
    if (!p || TR_AUSLASSEN.has(p.tagName) || p.closest("[data-kein-tr],pre")) continue;
    const v = n.nodeValue, de = trOriginal(TR_ORIG.get(n), v), u = tr(de);
    TR_ORIG.set(n, [de, u]);
    if (u !== v) n.nodeValue = u;
  }
  document.documentElement.lang = l;
}

// Dialoge ebenfalls uebersetzen
for (const f of ["confirm", "alert", "prompt"]) {
  const orig = window[f].bind(window);
  window[f] = (text, ...rest) => orig(tr(text), ...rest);
}
