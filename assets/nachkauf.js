"use strict";
/* Nachkauf- und Einstandspreis-Rechner (0.50, Vorgabe 16.11.2026).
 *
 * A  Budget -> neuer Einstand          B  Ziel-Einstand -> noetiges Budget
 * C  Exit-Szenarien (Kurslevels)       D  "Einstand rausnehmen" beim Trigger-Kurs
 *
 * nachkaufRechnen(eingabe) ist eine reine Funktion: liest nur die Eingabe, schreibt nichts
 * (weder S noch D) - der Rechner arbeitet ausschliesslich auf Kopien ("Was-waere-wenn").
 * Gerechnet wird dezimal mit BigInt (20 Nachkommastellen), nicht mit Kommazahlen; gerundet
 * wird erst am Ende: Geld 2 Stellen, Stueck Krypto 8 / Aktien 4.
 *
 * Gebuehren (Prozent je Order): beim Kauf geht die Gebuehr vom Budget ab (weniger Stueck,
 * Budget = brutto), beim Verkauf vom Erloes. Break-even = Gesamtinvestition / (Bestand x (1 - Gebuehr)),
 * ohne Gebuehr also genau der neue Einstandskurs. */

// ------------------------------------------------------------ Dezimal (BigInt, feste 20 Stellen)
const DZ_STELLEN = 20, DZ_S = 10n ** 20n;
const dzAbs = (a) => a < 0n ? -a : a;
/** Text ("98.972,23", "0,005062", "5164.76") oder Zahl -> BigInt * 10^20, sonst null. */
function dz(x) {
  if (x == null) return null;
  if (typeof x === "bigint") return x;
  let s;
  if (typeof x === "number") { if (!isFinite(x)) return null; s = x.toFixed(12); }
  else {
    s = String(x).trim().replace(/[€\s" ]/g, "").replace("−", "-");
    if (!s) return null;
    if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  }
  const m = s.match(/^([-+]?)(\d*)(?:\.(\d*))?$/);
  if (!m || (!m[2] && !m[3])) return null;
  const nach = (m[3] || "").slice(0, DZ_STELLEN).padEnd(DZ_STELLEN, "0");
  const v = BigInt(m[2] || "0") * DZ_S + BigInt(nach);
  return m[1] === "-" ? -v : v;
}
/** a / b mit kaufmaennischer Rundung in der letzten Stelle */
function dzTeil(z, n) {
  const q = z / n, r = z % n;
  return 2n * dzAbs(r) >= dzAbs(n) ? q + ((z < 0n) !== (n < 0n) ? -1n : 1n) : q;
}
const dzMal = (a, b) => dzTeil(a * b, DZ_S);
const dzDurch = (a, b) => dzTeil(a * DZ_S, b);
const DZ_1 = DZ_S, DZ_100 = 100n * DZ_S;
/** gerundet auf n Stellen -> Number (nur fuer Anzeige/Vergleich, Rechnung bleibt dezimal) */
function dzZahl(a, n = 2) {
  if (a == null) return null;
  const r = dzTeil(a, 10n ** BigInt(DZ_STELLEN - n)), neg = r < 0n, t = String(neg ? -r : r).padStart(n + 1, "0");
  return Number((neg ? "-" : "") + (n ? t.slice(0, -n) + "." + t.slice(-n) : t));
}

// ------------------------------------------------------------ Waehrung der Rechner (0.53): Euro oder Dollar
// Die Rechnung selbst ist waehrungsneutral (alle Eingaben in EINER Waehrung). Bei Dollar wird nur das Zeichen
// getauscht; mit dem Kurs "1 € = x $" kommt zu den Hauptwerten zusaetzlich der Euro-Betrag ("≈ … €").
let NK_W = "eur";
const nkZahl = (x, n = 2) => fmt({ minimumFractionDigits: n, maximumFractionDigits: n }).format(x);
const geld = (x) => NK_W !== "usd" ? eur(x) : ui.verdeckt ? "••••• $" : x == null || isNaN(x) ? "–" : nkZahl(x) + "\u00a0$";
const geldVz = (x) => NK_W !== "usd" ? eurVz(x) : ui.verdeckt ? "••••• $" : x == null ? "–" : (x > 0 ? "+" : "") + nkZahl(x) + "\u00a0$";
const kursW = (x) => NK_W !== "usd" ? kursE(x) : verstecktAuch("kurse") ? "••••• $" : x == null || isNaN(x) ? "–" : nkZahl(x) + "\u00a0$";
const geld0 = (x) => NK_W !== "usd" ? fEur0.format(x) : nkZahl(x, 0) + "\u00a0$";
const nkW = (r) => r.waehrung === "usd" ? "$" : "€";
/** "≈ 925,93 €" - nur bei Dollar und wenn ein Euro-Dollar-Kurs da ist (Feld oder zuletzt geladener Kurs). */
function inEuro(r, ...werte) {
  if (r.waehrung !== "usd") return "";
  const k = zahl(r.usdKurs) || EIN().eurUsd?.kurs;
  if (!(k > 0)) return `<p class="klein">Für die Umrechnung in Euro den Kurs „1 € = … $“ eintragen oder oben 🔄 antippen.</p>`;
  return `<p class="klein nk-euro">Umgerechnet (1 € = ${fZahl.format(rund(k, 4))} $): ${werte.filter((w) => w[1] != null).map(([n, v]) => `${n} ≈ ${eur(v / k)}`).join(" · ")}</p>`;
}
/** Wahl € / $ + Kursfeld */
function waehrungWahl(attrWahl, attrFeld, r) {
  const k = EIN().eurUsd;
  return `<div class="reiter">${["eur", "usd"].map((w) => `<button type="button" ${attrWahl}="waehrung" data-wert="${w}" class="${(r.waehrung || "eur") === w ? "aktiv" : ""}">${w === "eur" ? "Euro €" : "Dollar $"}</button>`).join("")}</div>
    ${r.waehrung === "usd" ? `<label>Kurs: 1 € = … $ (für die Umrechnung)<input ${attrFeld}="usdKurs" inputmode="decimal" value="${esc(r.usdKurs ?? "")}" placeholder="${k ? fZahl.format(rund(k.kurs, 4)) + " (vom " + datum(k.datum) + ")" : "z. B. 1,08"}"></label>` : ""}`;
}

// ------------------------------------------------------------ Rechnung
const NACHKAUF_ZEHNFACH = 10n;          // Budget > 10x Positionswert -> Sunk-Cost-Warnung

function nachkaufRechnen(r) {
  r = r || {};
  const fehler = [], warnungen = [], st = r.art === "aktie" ? 4 : 8;
  const b = dz(r.bestand), e = dz(r.einstand), k = dz(r.kurs);
  if (!(b > 0n)) fehler.push("Bestand muss größer als 0 sein.");
  if (!(e > 0n)) fehler.push("Einstandskurs muss größer als 0 sein.");
  if (!(k > 0n)) fehler.push("Aktueller Kurs muss größer als 0 sein.");
  const gb = r.gebuehrAn ? dz(r.gebuehr) ?? 0n : 0n;
  if (gb < 0n || gb >= DZ_100) fehler.push("Gebühr muss zwischen 0 und 100 % liegen.");
  if (fehler.length) return { fehler, warnungen, st };
  const f = dzDurch(gb, DZ_100), rest = DZ_1 - f;            // Anteil, der nach der Gebuehr bleibt
  const G = (x) => dzZahl(x, 2), P = (x) => dzZahl(x, 2), Z = (x) => dzZahl(x, st);

  const inv = dzMal(b, e), wertAlt = dzMal(b, k);
  const alt = { bestand: Z(b), investiert: G(inv), wert: G(wertAlt), gv: G(wertAlt - inv), gvPct: P(dzDurch(dzMal(wertAlt - inv, DZ_100), inv)) };
  const zuGross = (budget) => budget > NACHKAUF_ZEHNFACH * wertAlt;

  // A: festes Budget
  let A = null;
  const budget = dz(r.budget);
  if (budget != null) {
    if (!(budget > 0n)) A = { fehler: "Budget muss größer als 0 sein." };
    else {
      const stueck = dzDurch(dzMal(budget, rest), k), nb = b + stueck, ninv = inv + budget, ne = dzDurch(ninv, nb);
      A = { budget: G(budget), gebuehr: G(dzMal(budget, f)), netto: G(dzMal(budget, rest)), stueck: Z(stueck), bestand: Z(nb),
            investiert: G(ninv), einstand: G(ne), wert: G(dzMal(nb, k)), aenderungPct: P(dzDurch(dzMal(ne - e, DZ_100), e)),
            _b: nb, _inv: ninv, _e: ne };
      if (zuGross(budget)) warnungen.push("Tranche überproportional groß – Sunk-Cost-Risiko (Budget mehr als 10× der aktuellen Position).");
    }
  }

  // B: Ziel-Einstand. Mit Gebuehr kostet ein Stueck effektiv k / (1 - f).
  let B = null;
  const ziel = dz(r.ziel);
  if (ziel != null) {
    const kEff = dzDurch(k, rest);
    if (!(ziel > 0n)) B = { fehler: "Ziel-Einstand muss größer als 0 sein." };
    else if (e <= k) B = { fehler: "Der Kurs liegt über deinem Einstand – eine weitere Tranche hebt den Einstand, senken geht nicht." };
    else if (ziel >= e) B = { fehler: "Das Ziel liegt nicht unter deinem Einstand – keine weitere Tranche nötig." };
    else if (ziel <= kEff) B = { fehler: f > 0n ? "Unmöglich: Der Ziel-Einstand muss über dem aktuellen Kurs inkl. Gebühr liegen." : "Unmöglich: Der Ziel-Einstand muss über dem aktuellen Kurs liegen." };
    else {
      const stueck = dzDurch(dzMal(b, e - ziel), ziel - kEff), brutto = dzMal(stueck, kEff), netto = dzMal(stueck, k), nb = b + stueck, ninv = inv + brutto;
      B = { stueck: Z(stueck), budget: G(brutto), netto: G(netto), gebuehr: G(brutto - netto), bestand: Z(nb), investiert: G(ninv),
            einstand: G(dzDurch(ninv, nb)), _b: nb, _inv: ninv, _e: dzDurch(ninv, nb) };
      if (zuGross(brutto)) warnungen.push("Tranche überproportional groß – Sunk-Cost-Risiko (Budget mehr als 10× der aktuellen Position).");
    }
  }

  // Grundlage fuer C und D: gewaehlter Modus, sonst der andere, sonst die Position wie sie ist
  const ok = (x) => x && !x.fehler;
  const grundlage = r.grundlage === "B" ? (ok(B) ? "B" : ok(A) ? "A" : "") : ok(A) ? "A" : ok(B) ? "B" : "";
  const g = grundlage === "A" ? A : grundlage === "B" ? B : null;
  const nb = g ? g._b : b, ninv = g ? g._inv : inv, ne = g ? g._e : e;
  const be = dzDurch(ninv, dzMal(nb, rest));
  const nach = { grundlage, bestand: Z(nb), investiert: G(ninv), einstand: G(ne), wert: G(dzMal(nb, k)), breakEven: G(be) };

  // C: Exit-Szenarien
  const zeile = (kurs) => { const erl = dzMal(dzMal(nb, kurs), rest), gv = erl - ninv;
    return { kurs: G(kurs), erloes: G(erl), gv: G(gv), pct: P(dzDurch(dzMal(gv, DZ_100), ninv)) }; };
  let stufen = String(r.stufen || "").split(/[;\s]+/).map(dz).filter((x) => x > 0n);
  if (!stufen.length) {
    const sp = dz(r.spanne) > 0n ? dz(r.spanne) : 20n * DZ_S;
    for (let i = -4; i <= 4; i++) stufen.push(dzMal(be, DZ_1 + dzDurch(dzMal(sp, BigInt(i) * DZ_S), 4n * DZ_100)));
  }
  const aus = dz(r.ausstieg);
  stufen.push(be); if (aus > 0n) stufen.push(aus);
  stufen = [...new Set(stufen.filter((x) => x > 0n).map((x) => dzTeil(x, 10n ** 18n) * 10n ** 18n))].sort((x, y) => x < y ? -1 : x > y ? 1 : 0).slice(0, 40);
  const beR = dzTeil(be, 10n ** 18n) * 10n ** 18n, ausR = aus > 0n ? dzTeil(aus, 10n ** 18n) * 10n ** 18n : null;
  const C = stufen.map((x) => ({ ...zeile(x), breakEven: x === beR, ausstieg: x === ausR }));
  const ausstieg = aus > 0n ? zeile(aus) : null;

  // D: Einstand rausnehmen beim Trigger-Kurs
  let D = null;
  const tr = dz(r.trigger);
  if (tr != null) {
    if (!(tr > 0n)) D = { fehler: "Trigger-Kurs muss größer als 0 sein." };
    else {
      const erl = dzMal(dzMal(nb, tr), rest);
      if (erl <= ninv || tr <= beR) D = { fehler: "Beim Trigger-Kurs bringt die ganze Position höchstens die Investition zurück – kein Runner. Er entsteht nur aus Kursgewinn über dem Break-even.", kurs: G(tr), anteil: P(dzDurch(dzMal(ninv, DZ_100), erl)) };
      else {
        const anteil = dzDurch(ninv, erl), verkauf = dzMal(nb, anteil), runner = nb - verkauf;
        D = { kurs: G(tr), anteil: P(dzMal(anteil, DZ_100)), verkaufStueck: Z(verkauf), runner: Z(runner), runnerWert: G(dzMal(runner, tr)), zurueck: G(ninv) };
      }
    }
  }
  const sauber = (x) => { if (!x) return x; const { _b, _inv, _e, ...rest2 } = x; return rest2; };
  return { fehler, warnungen: [...new Set(warnungen)], st, gebuehrPct: dzZahl(gb, 4), alt, A: sauber(A), B: sauber(B), nach, C, ausstieg, D };
}

// ------------------------------------------------------------ Oberflaeche (Notizen-Seite, wie der Hebel-Rechner)
function nachkaufErgebnis(r = ui.nachkauf || {}) {
  NK_W = r.waehrung === "usd" ? "usd" : "eur";
  const x = nachkaufRechnen(r);
  if (x.fehler.length) return `<p class="klein" style="margin:8px 0 0">${x.fehler.map(esc).join("<br>")}</p>`;
  const s = (v) => ui.verdeckt ? "•••" : v == null ? "–" : fmt({ maximumFractionDigits: x.st }).format(v);
  const farbe = (v) => v > 0 ? "plus-t" : v < 0 ? "minus-t" : "leise-t";
  const n = x.nach, budgetHaupt = x.nach.grundlage === "B" ? x.B?.budget : x.A?.budget ?? x.B?.budget;
  const fehlerZeile = (m) => m?.fehler ? `<p class="warn-t klein">${esc(m.fehler)}</p>` : "";
  const brutto = (m) => x.gebuehrPct > 0 ? `<div><small>davon Gebühr</small><b>${geld(m.gebuehr)}</b><small>netto ${geld(m.netto)}</small></div>` : "";
  return `
    <div class="kennzahlen nachkauf-haupt">
      <div><small>Neuer Einstandskurs</small><b>${kursW(n.einstand)}</b><small>${n.grundlage ? "nach Tranche " + n.grundlage : "ohne weitere Tranche"}</small></div>
      <div><small>Benötigtes Budget</small><b>${budgetHaupt != null ? geld(budgetHaupt) : "–"}</b></div>
      <div class="be"><small>Break-even-Kurs</small><b>${kursW(n.breakEven)}</b>${x.gebuehrPct > 0 ? "<small>inkl. Verkaufsgebühr</small>" : ""}</div>
    </div>
    ${inEuro(r, ["Budget", budgetHaupt], ["Investiert", n.investiert], ["Marktwert", n.wert])}
    ${x.warnungen.map((w) => `<p class="warn-t klein"><b>⚠ ${esc(w)}</b></p>`).join("")}
    ${x.A ? `<h3 class="nk-titel">A · Tranche mit festem Budget</h3>${fehlerZeile(x.A)}${x.A.fehler ? "" : `<div class="kennzahlen">
      <div><small>Gekaufte Stück</small><b>${s(x.A.stueck)}</b></div>
      <div><small>Neuer Bestand</small><b>${s(x.A.bestand)}</b></div>
      <div><small>Neuer Einstand</small><b>${kursW(x.A.einstand)}</b><small class="${farbe(-x.A.aenderungPct)}">${pct(x.A.aenderungPct)}</small></div>
      <div><small>Wert jetzt</small><b>${geld(x.A.wert)}</b></div>${brutto(x.A)}</div>`}` : ""}
    ${x.B ? `<h3 class="nk-titel">B · Ziel-Einstand erreichen</h3>${fehlerZeile(x.B)}${x.B.fehler ? "" : `<div class="kennzahlen">
      <div><small>Benötigte Stück</small><b>${s(x.B.stueck)}</b></div>
      <div><small>Benötigtes Budget</small><b>${geld(x.B.budget)}</b></div>
      <div><small>Neuer Bestand</small><b>${s(x.B.bestand)}</b></div>${brutto(x.B)}</div>`}` : ""}
    ${nachkaufChart(x)}
    <h3 class="nk-titel">C · Exit-Szenarien</h3>
    <table class="tabelle nk-tabelle"><tr><th>Kurs</th><th>Erlös</th><th>G/V</th><th>%</th></tr>
      ${x.C.map((z) => `<tr class="${z.breakEven ? "nk-be" : ""}${z.ausstieg ? " nk-aus" : ""}"><td>${kursW(z.kurs)}${z.breakEven ? "<br><small>Break-even</small>" : z.ausstieg ? "<br><small>Ziel-Ausstieg</small>" : ""}</td>
        <td>${geld(z.erloes)}</td><td class="${z.breakEven ? "leise-t" : farbe(z.gv)}">${z.breakEven ? geld(0) : geldVz(z.gv)}</td><td class="${z.breakEven ? "leise-t" : farbe(z.gv)}">${z.breakEven ? pct(0) : pct(z.pct)}</td></tr>`).join("")}
    </table>
    ${x.D ? `<h3 class="nk-titel">D · Einstand rausnehmen</h3>${x.D.fehler ? `<p class="warn-t klein">${esc(x.D.fehler)}</p>` : `<div class="kennzahlen">
      <div><small>Verkaufen beim Trigger</small><b>${pct(x.D.anteil).replace("+", "")}</b><small>${s(x.D.verkaufStueck)} Stück</small></div>
      <div><small>Zurück (Gesamtinvestition)</small><b>${geld(x.D.zurueck)}</b></div>
      <div><small>Runner</small><b>${s(x.D.runner)} Stück</b><small>${geld(x.D.runnerWert)} beim Trigger</small></div></div>`}
      <p class="klein">Der Runner entsteht nur aus Kursgewinn über dem Break-even – bei genau Break-even bleibt nichts übrig.</p>` : ""}`;
}

/** Balken "Investiert vs. Marktwert" + Exit-Kurve (Kurslevel -> G/V). Bei verdeckten Betraegen weg. */
function nachkaufChart(x) {
  if (ui.verdeckt || x.C.length < 2) return "";
  const n = x.nach, B = 300, H = 120, maxW = Math.max(n.investiert, n.wert) || 1;
  const balken = (y, w, farbe, t) => `<rect x="70" y="${y}" width="${(w / maxW * 220).toFixed(1)}" height="14" rx="3" fill="${farbe}"/><text x="0" y="${y + 11}" font-size="10" fill="var(--leise)">${t}</text>`;
  const kurse = x.C.map((z) => z.kurs), gv = x.C.map((z) => z.gv), lo = Math.min(...kurse), hi = Math.max(...kurse), glo = Math.min(0, ...gv), ghi = Math.max(0, ...gv);
  const px = (v) => (v - lo) / (hi - lo || 1) * (B - 10) + 5, py = (v) => 100 - (v - glo) / (ghi - glo || 1) * 80;
  return `<svg viewBox="0 0 ${B} 44" width="100%" class="nkchart" aria-label="Investiert gegen Marktwert">
      ${balken(4, n.investiert, "var(--leise)", "Investiert")}${balken(24, n.wert, n.wert >= n.investiert ? "var(--plus)" : "var(--minus)", "Marktwert")}</svg>
    <svg viewBox="0 0 ${B} ${H}" width="100%" class="nkchart" aria-label="Exit-Kurve: Kurs gegen Gewinn und Verlust">
      <line x1="0" x2="${B}" y1="${py(0).toFixed(1)}" y2="${py(0).toFixed(1)}" stroke="var(--leise)" stroke-dasharray="3 3"/>
      <polyline points="${x.C.map((z) => `${px(z.kurs).toFixed(1)},${py(z.gv).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--akzent)" stroke-width="1.8"/>
      ${x.C.map((z) => `<circle cx="${px(z.kurs).toFixed(1)}" cy="${py(z.gv).toFixed(1)}" r="${z.breakEven ? 3.5 : 2.2}" fill="${z.breakEven ? "var(--leise)" : z.gv >= 0 ? "var(--plus)" : "var(--minus)"}"/>`).join("")}
      <text x="5" y="${H - 4}" font-size="9.5" fill="var(--leise)">${geld0(lo)}</text><text x="${B - 5}" y="${H - 4}" font-size="9.5" fill="var(--leise)" text-anchor="end">${geld0(hi)}</text>
    </svg>`;
}

function nachkaufRechner() {
  if (!ui.nachkaufOffen) return `<section class="karte"><button class="knopf" data-nachkauf-auf="1" style="width:100%">📉 In Tranchen kaufen – für einen entspannten Durchschnittspreis</button></section>`;
  const r = ui.nachkauf ||= { art: "krypto", gebuehr: EIN().nachkaufGebuehr ?? "" }, W = nkW(r);
  const geheim = ui.verdeckt ? ' style="-webkit-text-security:disc"' : "";
  const f = (n, t, ph, g) => `<label>${t}<input data-nachkauf="${n}" inputmode="decimal" value="${esc(r[n] ?? "")}" placeholder="${ph}"${g ? geheim : ""}></label>`;
  const reiter = (feld, wert, text, std) => `<button type="button" data-nachkauf-wahl="${feld}" data-wert="${wert}" class="${(r[feld] || std) === wert ? "aktiv" : ""}">${text}</button>`;
  return `
    <section class="karte formular" id="nachkauf">
      <div class="nk-kopf"><b>📉 In Tranchen kaufen</b>
        <button class="knopf klein" data-nachkauf-auf="0">schließen</button></div>
      <p class="klein nk-hinweis">Was-wäre-wenn: Hier wird nur gerechnet – deine gespeicherte Position bleibt unverändert.</p>
      ${legende(["<b>Ø Einstandskurs</b> = dein Durchschnittspreis je Stück.", "<b>Break-even</b> = ab diesem Kurs ist die Position im Plus.", "<b>A</b> = du hast ein festes Budget · <b>B</b> = du willst einen bestimmten Einstand erreichen.",
        "<b>C</b> = was bleibt bei welchem Verkaufskurs übrig.", "<b>D</b> = so viel verkaufen, dass dein ganzes eingesetztes Geld zurück ist. Der Rest („Runner“) läuft ohne eigenes Geld weiter.",
        "Jede weitere Tranche senkt den Einstand, erhöht aber den Einsatz – der Verlust wird größer, wenn der Kurs weiter fällt."])}
      ${rechnerPosWahl("nachkauf", r)}
      <div class="reiter">${reiter("art", "krypto", "Krypto (8 Stellen)", "krypto")}${reiter("art", "aktie", "Aktie (4 Stellen)", "krypto")}</div>
      ${waehrungWahl("data-nachkauf-wahl", "data-nachkauf", r)}
      <div class="zwei">${f("bestand", "Bestand (Stück)", "z. B. 0,005062", 1)}${f("einstand", `Ø Einstandskurs ${W}`, "z. B. 98.972,23")}</div>
      <div class="zwei">${f("kurs", `Kurs jetzt ${W}`, "z. B. 59.000")}<label>Stand vom<input type="date" data-nachkauf="kursDatum" value="${esc(r.kursDatum || "")}"></label></div>
      <div class="reiter">${reiter("grundlage", "A", "A · Festes Budget", "A")}${reiter("grundlage", "B", "B · Ziel-Einstand", "A")}</div>
      <div class="zwei">${f("budget", `Budget der Tranche ${W} (A)`, "z. B. 500", 1)}${f("ziel", `Ziel-Einstandskurs ${W} (B)`, "z. B. 80.000")}</div>
      <div class="zwei">${f("ausstieg", `Ziel-Ausstiegskurs ${W} (C)`, "optional")}${f("trigger", `Trigger-Kurs ${W} (D)`, "Einstand rausnehmen")}</div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-nachkauf-gebuehr ${r.gebuehrAn ? "checked" : ""} style="width:22px;height:22px">Gebühren berücksichtigen</label>
      ${r.gebuehrAn ? f("gebuehr", "Gebühr % je Order (wird als Standard gemerkt)", "z. B. 0,25") : ""}
      <label><span>Spanne der Exit-Tabelle: ±<b id="nk-spanne">${esc(r.spanne || "20")}</b> % um Break-even</span><input type="range" min="5" max="50" step="5" data-nachkauf="spanne" value="${esc(r.spanne || "20")}" style="width:100%"></label>
      ${f("stufen", "Eigene Kurslevels (optional, mit ; trennen)", "z. B. 70.000; 85.000; 100.000")}
      <div id="nachkauf-ergebnis">${nachkaufErgebnis()}</div>
      <label>Name des Plans (optional)<input data-nachkauf="titel" value="${esc(r.titel || "")}" placeholder="z. B. Zweite Tranche bei Rücksetzer"></label>
      <button class="knopf haupt" type="button" data-plan-notiz="nachkauf">Als Notiz speichern (mit Chart)</button>
      <p class="klein">Keine Anlageberatung. Rechner dient ausschließlich der Information.</p>
    </section>`;
}

/** Aus einer Position: Werte KOPIEREN und den Rechner oeffnen - die Position selbst bleibt, wie sie ist. */
function nachkaufAusPosition(id) {
  const i = D.instrumente[id] || {}, p = positionen().liste.find((y) => y.id === id);
  if (!p || !p.stueck) return meldung("Diese Position hat keinen Bestand.");
  const t = (v, n) => v == null || isNaN(v) ? "" : fmt({ maximumFractionDigits: n, useGrouping: false }).format(v);
  ui.nachkauf = { name: i.name || id, posId: id, waehrung: "eur", art: i.art === "Krypto" ? "krypto" : "aktie", bestand: t(p.stueck, 8), einstand: t(p.einstand / p.stueck, 2),
                  kurs: t(i.kurs, 4), kursDatum: (i.kursDatum || "").slice(0, 10), gebuehrAn: false, gebuehr: EIN().nachkaufGebuehr ?? "" };
  ui.nachkaufOffen = true; zeige("notizen");
  document.getElementById("nachkauf")?.scrollIntoView?.();
}

document.addEventListener("input", (ev) => {
  const n = ev.target.dataset?.nachkauf;
  if (!n) return;
  (ui.nachkauf ||= {})[n] = ev.target.value;
  if (n === "gebuehr") { (S.einstellungen ||= {}).nachkaufGebuehr = ev.target.value; sichern(); }    // nur die Einstellung, nie die Position
  if (n === "spanne") { const w = document.getElementById("nk-spanne"); if (w) w.textContent = ev.target.value; }
  const e = document.getElementById("nachkauf-ergebnis");
  if (e) { e.innerHTML = nachkaufErgebnis(); uebersetzeDom(e); }        // nur Ergebnis neu, Eingabe behaelt den Fokus
});
document.addEventListener("change", (ev) => {
  if (ev.target.dataset?.nachkaufGebuehr == null) return;
  (ui.nachkauf ||= {}).gebuehrAn = ev.target.checked;
  if (ev.target.checked && !ui.nachkauf.gebuehr) ui.nachkauf.gebuehr = EIN().nachkaufGebuehr ?? "";
  zeichnen();
});
document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  let x;
  if ((x = t("[data-nachkauf-auf]"))) { ui.nachkaufOffen = x.dataset.nachkaufAuf === "1"; return zeichnen(); }
  if ((x = t("[data-nachkauf-wahl]"))) { (ui.nachkauf ||= {})[x.dataset.nachkaufWahl] = x.dataset.wert; return zeichnen(); }
  if ((x = t("[data-nachkauf-aus]"))) return nachkaufAusPosition(x.dataset.nachkaufAus);
});

// ============================================================ Positionsgroessen-Rechner (0.50)
// Festes Risiko statt fester Positionsgroesse: Einstieg + Stop + maximaler Verlust -> Stueck.
// Enger Stop = groessere Position, weiter Stop = kleinere - der Verlust am Stop bleibt gleich.
// Gebuehr (Prozent je Order) zaehlt bei Einstieg UND Ausstieg am Stop zum Verlust.
const POSGR_ABSTAENDE = ["1", "2", "3", "5", "8", "10", "15", "20"];

function positionRechnen(r) {
  r = r || {};
  const fehler = [], warnungen = [], st = r.art === "aktie" ? 4 : 8, long = r.richtung !== "short";
  const E = dz(r.einstieg), S = dz(r.stop), kap = dz(r.kapital), gb = r.gebuehrAn ? dz(r.gebuehr) ?? 0n : 0n;
  let V = dz(r.maxverlust);
  if (r.risikoArt === "pct") { const p = dz(r.risikoPct); V = kap > 0n && p > 0n ? dzDurch(dzMal(kap, p), DZ_100) : null;
    if (V == null) fehler.push("Kapital und Risiko in % eintragen."); }
  else if (!(V > 0n)) fehler.push("Maximalen Verlust eintragen.");
  if (!(E > 0n)) fehler.push("Einstieg muss größer als 0 sein.");
  if (!(S > 0n)) fehler.push("Stop muss größer als 0 sein.");
  if (gb < 0n || gb >= DZ_100) fehler.push("Gebühr muss zwischen 0 und 100 % liegen.");
  if (!fehler.length && (long ? S >= E : S <= E)) fehler.push(long ? "Long: Der Stop muss unter dem Einstieg liegen." : "Short: Der Stop muss über dem Einstieg liegen.");
  if (fehler.length) return { fehler, warnungen, st, long };
  const f = dzDurch(gb, DZ_100), G = (x) => dzZahl(x, 2), Zs = (x) => dzZahl(x, st);
  const jeStueck = (stop) => dzAbs(E - stop) + dzMal(E + stop, f);          // Verlust je Stueck am Stop inkl. Gebuehren
  const stueck = dzDurch(V, jeStueck(S)), groesse = dzMal(stueck, E);
  const x = { fehler, warnungen, st, long, einstieg: G(E), stop: G(S), maxVerlust: G(V), stueck: Zs(stueck), groesse: G(groesse),
              stopAbstand: dzZahl(dzDurch(dzMal(S - E, DZ_100), E), 2), gebuehren: G(dzMal(dzMal(stueck, E + S), f)), gebuehrPct: dzZahl(gb, 4) };
  const Z = dz(r.ziel);
  if (Z > 0n) {
    if (long ? Z <= E : Z >= E) warnungen.push(long ? "Long: Das Ziel liegt nicht über dem Einstieg." : "Short: Das Ziel liegt nicht unter dem Einstieg.");
    else { const g = dzMal(stueck, dzAbs(Z - E)) - dzMal(dzMal(stueck, E + Z), f);
      Object.assign(x, { ziel: G(Z), gewinn: G(g), crv: dzZahl(dzDurch(g, V), 2), zielAbstand: dzZahl(dzDurch(dzMal(Z - E, DZ_100), E), 2) }); }
  }
  if (kap > 0n) {
    x.kapital = G(kap); x.anteil = dzZahl(dzDurch(dzMal(groesse, DZ_100), kap), 2); x.risikoPct = dzZahl(dzDurch(dzMal(V, DZ_100), kap), 2);
    if (groesse > kap) warnungen.push("Die Position wäre größer als dein Kapital – nur mit Hebel möglich oder Stop weiter setzen.");
  }
  // Gleiches Risiko, anderer Stop-Abstand
  x.tabelle = POSGR_ABSTAENDE.map((p) => { const stop = dzMal(E, DZ_1 + dzDurch(dz(p), DZ_100) * (long ? -1n : 1n)), n = dzDurch(V, jeStueck(stop));
    return { abstand: +p, stop: G(stop), stueck: Zs(n), groesse: G(dzMal(n, E)) }; });
  return x;
}

/** Schwankung aus Wochenkursen [[datum, kurs], ...]: uebliche Wochenbewegung (Mittel der Betraege) und groesster Ruecksetzer in %. */
function schwankung(punkte) {
  const k = (punkte || []).slice(-27).map((p) => +p[1]).filter((v) => v > 0);
  if (k.length < 6) return null;
  let summe = 0, hoch = k[0], dd = 0;
  for (let i = 1; i < k.length; i++) { summe += Math.abs(k[i] / k[i - 1] - 1); hoch = Math.max(hoch, k[i]); dd = Math.max(dd, 1 - k[i] / hoch); }
  return { woche: summe / (k.length - 1) * 100, ruecksetzer: dd * 100, wochen: k.length - 1 };
}

// ============================================================ Gewinnmitnahme-Rechner (0.50, Betrag in Euro ab 0.51)
// Nur einen Teil der Position verkaufen, in bis zu 4 Stufen. Je Stufe ein Kurs und (0.51, Vorgabe 16.11.)
// ein BETRAG in Euro, der herauskommen soll ("ich nehme 500 Euro raus") - oder wie in 0.50 ein Anteil in %
// der urspruenglichen Position (modus "pct"). Betrag = was nach Gebuehr auf dem Konto landet.
// Je Stufe: Erloes, Gewinn (gegen den Durchschnittseinstand), Rest - und bis wohin der Rest fallen
// darf, damit die ganze Position am Ende trotzdem bei +-0 landet ("Rest abgesichert bis").
function gewinnmitnahmeRechnen(r) {
  r = r || {};
  const fehler = [], warnungen = [], st = r.art === "aktie" ? 4 : 8;
  const b = dz(r.bestand), e = dz(r.einstand), gb = r.gebuehrAn ? dz(r.gebuehr) ?? 0n : 0n;
  if (!(b > 0n)) fehler.push("Bestand muss größer als 0 sein.");
  if (!(e > 0n)) fehler.push("Einstandskurs muss größer als 0 sein.");
  if (gb < 0n || gb >= DZ_100) fehler.push("Gebühr muss zwischen 0 und 100 % liegen.");
  const betrag = r.modus !== "pct", feld = betrag ? "b" : "a";
  const roh = [1, 2, 3, 4].map((n) => ({ kurs: dz(r["k" + n]), wert: dz(r[feld + n]) })).filter((s) => s.kurs != null || s.wert != null);
  if (!fehler.length && !roh.length) fehler.push(betrag ? "Mindestens eine Stufe eintragen: Verkaufskurs und Betrag in €." : "Mindestens eine Stufe eintragen: Kurs und Anteil in %.");
  if (roh.some((s) => !(s.kurs > 0n) || !(s.wert > 0n))) fehler.push(betrag ? "Jede Stufe braucht einen Verkaufskurs und einen Betrag größer als 0." : "Jede Stufe braucht einen Kurs und einen Anteil größer als 0.");
  if (fehler.length) return { fehler, warnungen, st, betrag };
  const f = dzDurch(gb, DZ_100), rest1 = DZ_1 - f, G = (x) => dzZahl(x, 2), Zs = (x) => dzZahl(x, st), inv = dzMal(b, e);
  // Stueck je Stufe: Betrag / (Kurs x (1 - Gebuehr))  bzw.  Bestand x Anteil
  for (const s of roh) s.stueck = betrag ? dzDurch(s.wert, dzMal(s.kurs, rest1)) : dzDurch(dzMal(b, s.wert), DZ_100);
  if (roh.reduce((a, s) => a + s.stueck, 0n) > b) {
    fehler.push(betrag ? "So viel gibt die Position nicht her – die Beträge sind zusammen größer als ihr Wert bei diesen Kursen." : "Die Anteile ergeben zusammen mehr als 100 %.");
    return { fehler, warnungen, st, betrag };
  }
  let kum = 0n, gewinnSumme = 0n, rest = b, frei = null;
  const stufen = roh.map((s, i) => {
    const stueck = s.stueck, erl = dzMal(dzMal(stueck, s.kurs), rest1), gew = erl - dzMal(stueck, e);
    s.anteil = dzDurch(dzMal(stueck, DZ_100), b);
    // ganze Stuecke (Aktien lassen sich oft nicht in Bruchteilen verkaufen): aufgerundet, hoechstens der Rest
    let ganz = null;
    if (st === 4 && stueck % DZ_S !== 0n) { let n = (stueck / DZ_S + 1n) * DZ_S; if (n > rest) n = rest - rest % DZ_S;
      if (n > 0n) ganz = { stueck: dzZahl(n, 0), erloes: G(dzMal(dzMal(n, s.kurs), rest1)) }; }
    kum += erl; gewinnSumme += gew; rest -= stueck;
    const offen = inv - kum <= 10n ** 10n ? 0n : inv - kum;      // was vom Einsatz noch nicht zurueck ist (unter 1e-10 € = Rundungsrest der Division)
    if (offen <= 0n && frei == null) frei = i + 1;
    if (s.kurs <= dzDurch(e, rest1)) warnungen.push("Mindestens eine Stufe liegt nicht über dem Break-even – dort wird Verlust realisiert.");
    return { nr: i + 1, kurs: G(s.kurs), anteil: dzZahl(s.anteil, 2), stueck: Zs(stueck), erloes: G(erl), gewinn: G(gew), gewinnPct: dzZahl(dzDurch(dzMal(gew, DZ_100), dzMal(stueck, e)), 2),
             rest: Zs(rest), restWert: G(dzMal(rest, s.kurs)), ganz, zurueck: G(kum), offen: G(offen > 0n ? offen : 0n), frei: offen <= 0n,
             restBis: rest > 0n && offen > 0n ? G(dzDurch(offen, dzMal(rest, rest1))) : null };
  });
  const letzter = roh.at(-1).kurs;
  return { fehler, warnungen: [...new Set(warnungen)], st, betrag, gebuehrPct: dzZahl(gb, 4), investiert: G(inv), stufen, erloes: G(kum), gewinn: G(gewinnSumme),
           rest: Zs(rest), restAnteil: dzZahl(dzDurch(dzMal(rest, DZ_100), b), 2), restWert: G(dzMal(rest, letzter)), frei, breakEven: G(dzDurch(e, rest1)) };
}

// ------------------------------------------------------------ Oberflaeche beider Rechner
/** Kleine aufklappbare Erklaerung ("Kurz erklaert") - Zeilen duerfen <b> enthalten, kein Nutzertext. */
const legende = (zeilen, titel = "ℹ️ Kurz erklärt") => `<details class="legende"><summary>${titel}</summary><ul>${zeilen.map((z) => `<li>${z}</li>`).join("")}</ul></details>`;
const rechnerFeld = (attr, r, geheim) => (n, t, ph, g) => `<label>${t}<input ${attr}="${n}" inputmode="decimal" value="${esc(r[n] ?? "")}" placeholder="${ph}"${g ? geheim : ""}></label>`;
const rechnerWahl = (attr, r) => (feld, wert, text, std) => `<button type="button" ${attr}="${feld}" data-wert="${wert}" class="${(r[feld] || std) === wert ? "aktiv" : ""}">${text}</button>`;
const rechnerGeheim = () => ui.verdeckt ? ' style="-webkit-text-security:disc"' : "";
const rechnerStk = (st) => (v) => ui.verdeckt ? "•••" : v == null ? "–" : fmt({ maximumFractionDigits: st }).format(v);

/** 0.65 (Vorgabe 19.11.): Positionsgroesse automatisch als Anteil am GESAMTportfolio (alle eigenen Depots inkl. Cash),
 *  unabhaengig vom Feld "Kapital". Nur Euro-Rechnungen; ohne Depotwert -> null. */
const POSGR_KLUMPEN = 20;
function anteilGesamtportfolio(groesse, r) {
  if (!(groesse > 0) || (r && r.waehrung === "usd") || typeof eigeneDepots !== "function" || typeof depotWerte !== "function") return null;
  const summe = eigeneDepots().map(depotWerte).reduce((a, d) => a + (d.gesamt || 0), 0);
  return summe > 0 ? groesse / summe * 100 : null;
}

function posgrErgebnis(r = ui.posgr || {}) {
  NK_W = r.waehrung === "usd" ? "usd" : "eur";
  const x = positionRechnen(r);
  if (x.fehler.length) return `<p class="klein" style="margin:8px 0 0">${x.fehler.map(esc).join("<br>")}</p>`;
  const s = rechnerStk(x.st), basis = typeof hebelBasisListe === "function" ? hebelBasisListe().find((b) => b.key === r.basis) : null, sw = basis ? schwankung(basis.punkte) : null;
  const ab = Math.abs(x.stopAbstand), gp = anteilGesamtportfolio(x.groesse, r);
  return `
    ${markenChart([["Ziel", x.ziel, "var(--plus)"], ["Einstieg", x.einstieg, "var(--text)"], ["Stop", x.stop, "var(--minus)", 1]], x.einstieg,
                  [[x.einstieg, x.stop, "var(--minus)"], x.ziel ? [x.einstieg, x.ziel, "var(--plus)"] : null], basis ? basis.punkte.slice(-26).map((p) => p[1]) : [], "Positions-Chart mit Marken")}
    <div class="kennzahlen nachkauf-haupt">
      <div><small>Positionsgröße</small><b>${geld(x.groesse)}</b><small>${s(x.stueck)} Stück</small></div>
      <div><small>Verlust am Stop</small><b class="minus-t">${geldVz(-x.maxVerlust)}</b><small>Stop ${pct(x.stopAbstand)} entfernt</small></div>
      <div><small>Chance : Risiko</small><b>${x.crv != null ? fPct.format(x.crv) + " : 1" : "–"}</b>${x.gewinn != null ? `<small class="plus-t">${geldVz(x.gewinn)} am Ziel</small>` : ""}</div>
      ${x.anteil != null ? `<div><small>Anteil am Kapital</small><b>${ant(x.anteil)}</b><small>Risiko ${ant(x.risikoPct)}</small></div>` : ""}
      ${gp != null ? `<div><small>Anteil am Gesamtportfolio</small><b class="${gp >= POSGR_KLUMPEN ? "warn-t" : ""}">${ant(gp)}</b><small>alle Depots zusammen</small></div>` : ""}
      ${x.gebuehrPct > 0 ? `<div><small>Gebühren (rein + raus)</small><b>${geld(x.gebuehren)}</b><small>im Verlust enthalten</small></div>` : ""}
    </div>
    ${inEuro(r, ["Position", x.groesse], ["Verlust am Stop", x.maxVerlust], ["Gewinn am Ziel", x.gewinn])}
    ${x.warnungen.map((w) => `<p class="warn-t klein"><b>⚠ ${esc(w)}</b></p>`).join("")}
    ${gp != null && gp >= POSGR_KLUMPEN ? `<p class="warn-t klein"><b>⚠ Mehr als ${fZahl.format(POSGR_KLUMPEN)} % deines Gesamtportfolios in einem Wert – Klumpenrisiko. Nur Rechnung, keine Anlageberatung.</b></p>` : ""}
    ${sw ? `<p class="klein nk-hinweis">${esc(basis.name)}: übliche Wochenbewegung ±${fPct.format(sw.woche)} %, größter Rücksetzer −${fPct.format(sw.ruecksetzer)} % (${sw.wochen} Wochen).
      ${ab < sw.woche ? "<b>Dein Stop liegt innerhalb einer normalen Wochenbewegung – er kann leicht ausgelöst werden.</b>" : "Dein Stop liegt außerhalb einer normalen Wochenbewegung."}</p>` : ""}
    <h3 class="nk-titel">Gleiches Risiko, anderer Stop-Abstand</h3>
    <table class="tabelle nk-tabelle"><tr><th>Abstand</th><th>Stop</th><th>Stück</th><th>Position</th></tr>
      ${x.tabelle.map((z) => `<tr><td>${fZahl.format(z.abstand)} %</td><td>${kursW(z.stop)}</td><td>${s(z.stueck)}</td><td>${geld(z.groesse)}</td></tr>`).join("")}
    </table>
    <p class="klein">Enger Stop = größere Position, weiter Stop = kleinere – der Verlust am Stop bleibt gleich. Ohne Slippage und Kurslücken; der echte Verlust kann größer sein.</p>`;
}

function posgrRechner() {
  if (!ui.posgrOffen) return `<section class="karte"><button class="knopf" data-posgr-auf="1" style="width:100%">⚖️ Positionsgrößen-Rechner (fester Verlust am Stop)</button></section>`;
  const r = ui.posgr ||= { art: "krypto", richtung: "long", gebuehr: EIN().nachkaufGebuehr ?? "" };
  const W = nkW(r), f = rechnerFeld("data-posgr", r, rechnerGeheim()), w = rechnerWahl("data-posgr-wahl", r), basen = typeof hebelBasisListe === "function" ? hebelBasisListe() : [];
  const pctModus = r.risikoArt === "pct";
  return `
    <section class="karte formular" id="posgr">
      <div class="nk-kopf"><b>⚖️ Positionsgrößen-Rechner</b>
        <button class="knopf klein" data-posgr-auf="0">schließen</button></div>
      <p class="klein nk-hinweis">Du legst fest, wie viel du höchstens verlieren willst – der Rechner sagt, wie groß die Position sein darf.</p>
      ${legende(["<b>Einstieg</b> = Kurs, zu dem du kaufst · <b>Stop-Loss</b> = Kurs, bei dem du aussteigst.", "<b>Max. Verlust</b> = was du bei diesem Trade höchstens verlieren willst.",
        "Ergebnis: so viele Stück darfst du kaufen, damit am Stop genau dieser Verlust entsteht.", "<b>Chance : Risiko</b> 2 : 1 heißt: am Ziel gewinnst du doppelt so viel, wie du am Stop verlierst.",
        "Im Chart: grün = Ziel und Gewinnzone, rot = Stop und Verlustzone, die Linie = Kursverlauf (wenn gewählt)."])}
      ${rechnerPosWahl("posgr", r)}
      <div class="reiter">${w("richtung", "long", "Long", "long")}${w("richtung", "short", "Short", "long")}${w("art", "krypto", "Krypto (8 Stellen)", "krypto")}${w("art", "aktie", "Aktie (4 Stellen)", "krypto")}</div>
      ${waehrungWahl("data-posgr-wahl", "data-posgr", r)}
      <div class="zwei">${f("einstieg", `Einstieg ${W}`, "z. B. 59.000")}${f("stop", `Stop-Loss ${W}`, "z. B. 56.050")}</div>
      <div class="reiter">${w("risikoArt", "eur", `Verlust in ${W}`, "eur")}${w("risikoArt", "pct", "Verlust in % vom Kapital", "eur")}</div>
      <div class="zwei">${pctModus ? f("risikoPct", "Risiko % vom Kapital", "z. B. 1") : f("maxverlust", `Max. Verlust ${W}`, "z. B. 50", 1)}${f("kapital", pctModus ? `Kapital ${W}` : `Kapital ${W} (optional)`, "z. B. 5.000", 1)}</div>
      <button class="knopf klein" type="button" data-posgr-depot="1">Depotwert als Kapital übernehmen</button>
      <div class="zwei">${f("ziel", `Ziel ${W} (optional)`, "z. B. 65.000")}${basen.length ? `<label>Schwankung prüfen (optional)<select data-posgr-basis><option value="">– ohne –</option>${basen.map((b) =>
        `<option value="${esc(b.key)}" ${r.basis === b.key ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>` : ""}</div>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-posgr-gebuehr ${r.gebuehrAn ? "checked" : ""} style="width:22px;height:22px">Gebühren berücksichtigen</label>
      ${r.gebuehrAn ? f("gebuehr", "Gebühr % je Order (wird als Standard gemerkt)", "z. B. 0,25") : ""}
      <div id="posgr-ergebnis">${posgrErgebnis()}</div>
      <label>Name des Plans (optional)<input data-posgr="titel" value="${esc(r.titel || "")}" placeholder="z. B. Zweite Tranche bei Rücksetzer"></label>
      <button class="knopf haupt" type="button" data-plan-notiz="posgr">Als Notiz speichern (mit Chart)</button>
      <p class="klein">Keine Anlageberatung. Rechner dient ausschließlich der Information.</p>
    </section>`;
}

function gewinnErgebnis(r = ui.gewinn || {}) {
  NK_W = r.waehrung === "usd" ? "usd" : "eur";
  const x = gewinnmitnahmeRechnen(r);
  if (x.fehler.length) return `<p class="klein" style="margin:8px 0 0">${x.fehler.map(esc).join("<br>")}</p>`;
  const s = rechnerStk(x.st), farbe = (v) => v > 0 ? "plus-t" : v < 0 ? "minus-t" : "leise-t";
  const e0 = dzZahl(dz(r.einstand), 2), bis = x.stufen.at(-1).restBis;
  return `
    ${markenChart([...x.stufen.map((z) => ["Stufe " + z.nr, z.kurs, z.gewinn >= 0 ? "var(--plus)" : "var(--minus)"]), ["Einstand", e0, "var(--text)"], bis ? ["Rest sicher bis", bis, "var(--warn)", 1] : null],
                  e0, [[e0, Math.max(...x.stufen.map((z) => z.kurs)), "var(--plus)"]], [], "Gewinnmitnahme-Chart mit Stufen")}
    <div class="kennzahlen nachkauf-haupt">
      <div><small>Du nimmst raus</small><b>${geld(x.erloes)}</b><small class="${farbe(x.gewinn)}">davon Gewinn ${geldVz(x.gewinn)}</small></div>
      <div><small>Rest läuft weiter</small><b>${s(x.rest)} Stück</b><small>${geld(x.restWert)} · ${ant(x.restAnteil)} der Position</small></div>
      <div class="be"><small>Einstand zurück</small><b>${x.frei ? "ab Stufe " + x.frei : "noch nicht"}</b><small>von ${geld(x.investiert)}</small></div>
    </div>
    ${inEuro(r, ["Du nimmst raus", x.erloes], ["davon Gewinn", x.gewinn], ["Rest", x.restWert])}
    ${x.warnungen.map((w) => `<p class="warn-t klein"><b>⚠ ${esc(w)}</b></p>`).join("")}
    ${x.stufen.map((z) => `<h3 class="nk-titel">Stufe ${z.nr} · ${kursW(z.kurs)}</h3><div class="kennzahlen">
      <div><small>Verkaufen</small><b>${s(z.stueck)} Stück</b><small>${ant(z.anteil)} der Position${z.ganz ? `<br>ganze Stücke: ${s(z.ganz.stueck)} → ${geld(z.ganz.erloes)}` : ""}</small></div>
      <div><small>Erlös</small><b>${geld(z.erloes)}</b><small class="${farbe(z.gewinn)}">${geldVz(z.gewinn)} (${pct(z.gewinnPct)})</small></div>
      <div><small>Rest danach</small><b>${s(z.rest)} Stück</b><small>Wert ${geld(z.restWert)}<br>${z.frei ? "Einstand ist zurück – der Rest ist reiner Gewinn" : z.restBis != null ? "Rest abgesichert bis " + kursW(z.restBis) : "alles verkauft"}</small></div></div>`).join("")}
    <p class="klein">„Rest abgesichert bis“: Fällt der Rest bis zu diesem Kurs und du verkaufst dort, landet die ganze Position insgesamt bei plus/minus null. Gewinn gegen den Durchschnittseinstand gerechnet, ohne Steuern.</p>`;
}

function gewinnRechner() {
  if (!ui.gewinnOffen) return `<section class="karte"><button class="knopf" data-gewinn-auf="1" style="width:100%">💰 Gewinnmitnahme-Rechner (Teil verkaufen, Rest laufen lassen)</button></section>`;
  const r = ui.gewinn ||= { art: "krypto", gebuehr: EIN().nachkaufGebuehr ?? "" };
  const W = nkW(r), f = rechnerFeld("data-gewinn", r, rechnerGeheim()), w = rechnerWahl("data-gewinn-wahl", r);
  return `
    <section class="karte formular" id="gewinn">
      <div class="nk-kopf"><b>💰 Gewinnmitnahme-Rechner</b>
        <button class="knopf klein" data-gewinn-auf="0">schließen</button></div>
      <p class="klein nk-hinweis">Was-wäre-wenn: Hier wird nur gerechnet – deine gespeicherte Position bleibt unverändert.</p>
      ${legende(["<b>Betrag</b> = was nach dem Verkauf auf deinem Konto ankommen soll.", "<b>Einstand zurück</b> = dein eingesetztes Geld ist wieder draußen – der Rest ist reiner Gewinn.",
        "<b>Rest abgesichert bis</b> = fällt der Rest bis dahin, landet die ganze Position bei plus/minus null.", "<b>Ganze Stücke</b> = falls dein Broker keine Bruchteile verkauft.",
        "Im Chart: weiß = dein Einstand, grün = Verkaufsstufen, gestrichelt = bis dahin ist der Rest sicher."])}
      ${rechnerPosWahl("gewinn", r)}
      <div class="reiter">${w("art", "krypto", "Krypto (8 Stellen)", "krypto")}${w("art", "aktie", "Aktie (4 Stellen)", "krypto")}</div>
      ${waehrungWahl("data-gewinn-wahl", "data-gewinn", r)}
      <div class="zwei">${f("bestand", "Bestand (Stück)", "z. B. 10", 1)}${f("einstand", `Ø Einstandskurs ${W}`, "z. B. 100")}</div>
      <div class="reiter">${w("modus", "betrag", `Betrag in ${W} rausnehmen`, "betrag")}${w("modus", "pct", "Anteil in %", "betrag")}</div>
      ${[1, 2, 3, 4].map((n) => `<div class="zwei">${f("k" + n, `Stufe ${n}: Verkaufskurs ${W}`, n === 1 ? "z. B. 1.022" : "optional")}${r.modus === "pct"
        ? f("a" + n, `Stufe ${n}: Anteil %`, n === 1 ? "z. B. 30" : "optional") : f("b" + n, `Stufe ${n}: Betrag ${W}`, n === 1 ? "z. B. 500" : "optional", 1)}</div>`).join("")}
      ${r.modus === "pct" ? "" : `<button class="knopf klein" type="button" data-gewinn-einstand="1">Einstand als Betrag übernehmen (Stufe 1)</button>`}
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-gewinn-gebuehr ${r.gebuehrAn ? "checked" : ""} style="width:22px;height:22px">Gebühren berücksichtigen</label>
      ${r.gebuehrAn ? f("gebuehr", "Gebühr % je Order (wird als Standard gemerkt)", "z. B. 0,25") : ""}
      <div id="gewinn-ergebnis">${gewinnErgebnis()}</div>
      <label>Name des Plans (optional)<input data-gewinn="titel" value="${esc(r.titel || "")}" placeholder="z. B. Zweite Tranche bei Rücksetzer"></label>
      <button class="knopf haupt" type="button" data-plan-notiz="gewinn">Als Notiz speichern (mit Chart)</button>
      <p class="klein">Keine Anlageberatung. Rechner dient ausschließlich der Information.</p>
    </section>`;
}

/** Position KOPIEREN und im Gewinnmitnahme-Rechner oeffnen (erste Stufe = aktueller Kurs). */
function gewinnAusPosition(id) {
  const i = D.instrumente[id] || {}, p = positionen().liste.find((y) => y.id === id);
  if (!p || !p.stueck) return meldung("Diese Position hat keinen Bestand.");
  const t = (v, n) => v == null || isNaN(v) ? "" : fmt({ maximumFractionDigits: n, useGrouping: false }).format(v);
  ui.gewinn = { name: i.name || id, posId: id, waehrung: "eur", art: i.art === "Krypto" ? "krypto" : "aktie", bestand: t(p.stueck, 8), einstand: t(p.einstand / p.stueck, 2),
                k1: t(i.kurs, 4), a1: "", b1: "", modus: ui.gewinn?.modus || "betrag", gebuehrAn: false, gebuehr: EIN().nachkaufGebuehr ?? "" };
  ui.gewinnOffen = true; zeige("notizen");
  document.getElementById("gewinn")?.scrollIntoView?.();
}

/** Auswahl "Aus deinen Positionen uebernehmen": fuellt den Rechner mit einer KOPIE der Werte. */
function rechnerPosWahl(ziel, r) {
  const l = positionen().liste.filter((p) => p.stueck > 0 && !(D.instrumente[p.id] || {}).ohneStueck);
  const hinweis = r.name ? `<p class="klein">Werte aus „${esc(r.name)}“ übernommen (Kopie).</p>` : "";
  if (!l.length) return hinweis;
  return `<label>Aus deinen Positionen übernehmen (Kopie)<select data-rechner-pos="${ziel}"><option value="">– selbst eintragen –</option>${l.map((p) =>
    `<option value="${esc(p.id)}" ${r.posId === p.id ? "selected" : ""}>${esc((D.instrumente[p.id] || {}).name || p.id)}</option>`).join("")}</select></label>${hinweis}`;
}

/** Positionsgroesse: aktueller Kurs als Einstieg, Kursverlauf des Werts fuer den Schwankungs-Hinweis. Stop/Ziel traegt man selbst ein. */
function posgrAusPosition(id) {
  const i = D.instrumente[id] || {}, key = "d:" + S.aktiv + ":" + id;
  const t = (v, n) => v == null || isNaN(v) ? "" : fmt({ maximumFractionDigits: n, useGrouping: false }).format(v);
  ui.posgr = { ...(ui.posgr || {}), name: i.name || id, posId: id, waehrung: "eur", art: i.art === "Krypto" ? "krypto" : "aktie", richtung: i.richtung === "short" ? "short" : "long",
               einstieg: t(i.kurs, 4), stop: "", ziel: "", basis: typeof hebelBasisListe === "function" && hebelBasisListe().some((b) => b.key === key) ? key : "",
               gebuehr: ui.posgr?.gebuehr ?? EIN().nachkaufGebuehr ?? "" };
  ui.posgrOffen = true; zeige("notizen");
  document.getElementById("posgr")?.scrollIntoView?.();
}
const RECHNER_AUS_POSITION = { nachkauf: (id) => nachkaufAusPosition(id), gewinn: (id) => gewinnAusPosition(id), posgr: (id) => posgrAusPosition(id) };
document.addEventListener("change", (ev) => {
  const ziel = ev.target.dataset?.rechnerPos;
  if (!ziel) return;
  if (ev.target.value) return RECHNER_AUS_POSITION[ziel](ev.target.value);
  if (ui[ziel]) { delete ui[ziel].posId; delete ui[ziel].name; } zeichnen();
});
document.addEventListener("click", (ev) => { const x = ev.target.closest("[data-posgr-aus]"); if (x) posgrAusPosition(x.dataset.posgrAus); });

for (const [kurz, ergebnis] of [["posgr", posgrErgebnis], ["gewinn", gewinnErgebnis]]) {
  const gross = kurz[0].toUpperCase() + kurz.slice(1);
  document.addEventListener("input", (ev) => {
    const n = ev.target.dataset?.[kurz];
    if (!n) return;
    (ui[kurz] ||= {})[n] = ev.target.value;
    if (n === "gebuehr") { (S.einstellungen ||= {}).nachkaufGebuehr = ev.target.value; sichern(); }
    const e = document.getElementById(kurz + "-ergebnis");
    if (e) { e.innerHTML = ergebnis(); uebersetzeDom(e); }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target.dataset?.[kurz + "Gebuehr"] != null) { (ui[kurz] ||= {}).gebuehrAn = ev.target.checked; return zeichnen(); }
    if (ev.target.dataset?.[kurz + "Basis"] != null) { (ui[kurz] ||= {}).basis = ev.target.value; return zeichnen(); }
  });
  document.addEventListener("click", (ev) => {
    const t = (s) => ev.target.closest(s);
    let x;
    if ((x = t(`[data-${kurz}-auf]`))) { ui[kurz + "Offen"] = x.dataset[kurz + "Auf"] === "1"; return zeichnen(); }
    if ((x = t(`[data-${kurz}-wahl]`))) { (ui[kurz] ||= {})[x.dataset[kurz + "Wahl"]] = x.dataset.wert; return zeichnen(); }
    if (kurz === "gewinn" && (x = t("[data-gewinn-aus]"))) return gewinnAusPosition(x.dataset.gewinnAus);
    if (kurz === "gewinn" && t("[data-gewinn-einstand]")) {     // eingezahltes Geld (Bestand x Einstand) als Betrag der ersten Stufe
      const g = ui.gewinn ||= {}, bb = dz(g.bestand), ee = dz(g.einstand);
      if (!(bb > 0n) || !(ee > 0n)) return meldung("Erst Bestand und Einstandskurs eintragen.");
      g.b1 = fmt({ minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(dzZahl(dzMal(bb, ee), 2)); return zeichnen();
    }
    if (kurz === "posgr" && t("[data-posgr-depot]")) {       // nur lesen: Summe der sichtbaren Depots als Kapital-Vorschlag
      const summe = sichtDepots().map(depotWerte).reduce((a, d) => a + (d.gesamt || 0), 0);
      (ui.posgr ||= {}).kapital = fmt({ maximumFractionDigits: 2, useGrouping: false }).format(summe); return zeichnen();
    }
  });
}

// ============================================================ Rechner-Plan als Notiz (0.52)
// "Als Notiz speichern": die Eingaben des Rechners wandern als Kopie in die Notiz (n.plan = { typ, daten }).
// In der Notiz wird daraus wieder Chart + Ergebnis gerechnet; "Im Rechner oeffnen" laedt die Eingaben zurueck.
// Der Notiz-TEXT nennt nur Kurse und Prozente - Betraege und Stueckzahlen stehen im Ergebnis-Block, den "Betraege aus" verbirgt.
const PLAN_RECHNER = {
  posgr: { name: "Positionsgröße", symbol: "⚖️", rechnen: (d) => positionRechnen(d), ergebnis: (d) => posgrErgebnis(d) },
  nachkauf: { name: "In Tranchen kaufen", titel: "In Tranchen kaufen", symbol: "📉", rechnen: (d) => nachkaufRechnen(d), ergebnis: (d) => nachkaufErgebnis(d) },
  gewinn: { name: "Gewinnmitnahme", symbol: "💰", rechnen: (d) => gewinnmitnahmeRechnen(d), ergebnis: (d) => gewinnErgebnis(d) },
};

/** Linien-Chart mit Marken [Name, Kurs, Farbe, gestrichelt], Zonen [von, bis, Farbe] und optional Kursverlauf. Zeigt nur Kurse, keine Betraege. */
function markenChart(marken, bezug, zonen = [], kurse = [], titel = "Chart mit Marken") {
  marken = marken.filter((m) => m && m[1] > 0);
  if (marken.length < 2 || verstecktAuch("kurse")) return "";
  const alle = [...marken.map((m) => m[1]), ...kurse], lo = Math.min(...alle), hi = Math.max(...alle), pad = (hi - lo) * 0.1 || hi * 0.05;
  const B = 300, H = 150, L = 150, y = (v) => (H - 8 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (H - 16));
  const z = (v) => fZahl.format(rund(v, v >= 1000 ? 0 : v >= 100 ? 1 : v >= 1 ? 2 : 4));
  const lab = marken.map((m) => ({ m, yy: y(m[1]) })).sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < lab.length; k++) if (lab[k].yy - lab[k - 1].yy < 12) lab[k].yy = lab[k - 1].yy + 12;
  const abst = (v) => { const p = (v / bezug - 1) * 100; return bezug > 0 && Math.abs(p) >= 0.05 ? " (" + (p > 0 ? "+" : "") + fPct.format(rund(p, 1)).replace(/[.,]?0+$/, "") + " %)" : ""; };
  return `<svg viewBox="0 0 ${B} ${H}" width="100%" aria-label="${titel}" class="hebelchart planchart">
    ${zonen.filter((q) => q && q[0] > 0 && q[1] > 0).map(([a, b, f]) => `<rect x="0" width="${L}" y="${Math.min(y(a), y(b)).toFixed(1)}" height="${Math.abs(y(a) - y(b)).toFixed(1)}" fill="${f}" fill-opacity=".13"/>`).join("")}
    ${kurse.length > 1 ? `<polyline points="${kurse.map((k, i) => `${(i / (kurse.length - 1) * L).toFixed(1)},${y(k).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--akzent)" stroke-width="1.6"/>` : ""}
    ${marken.map(([, v, f, strich]) => `<line x1="0" x2="${L}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${f}" stroke-width="1.4" ${strich ? 'stroke-dasharray="4 3"' : ""}/>`).join("")}
    ${lab.map(({ m: [t, v, f], yy }) => `<text x="${L + 5}" y="${(yy + 3.5).toFixed(1)}" font-size="9.5" fill="${f}">${t} ${z(v)}${abst(v)}</text>`).join("")}
  </svg>`;
}

/** Chart + Zahlen eines gespeicherten Plans (fuer die Notiz). */
function planAnzeige(plan) {
  const p = plan && PLAN_RECHNER[plan.typ];
  if (!p) return "";
  try { return `<div class="plan-block"><p class="klein" style="margin:0 0 4px">${p.symbol} ${p.titel || p.name + "-Rechner"}</p>${p.ergebnis(plan.daten || {})}</div>`; } catch { return ""; }
}

/** Kurzer Notiztext: nur Kurse und Prozente. */
function planText(typ, d, x) {
  const k = (v) => v == null ? "–" : fZahl.format(rund(v, v >= 100 ? 2 : 4)), pz = (v) => (v > 0 ? "+" : "") + fPct.format(v) + " %";
  if (typ === "posgr") return `${x.long ? "Long" : "Short"} · Einstieg ${k(x.einstieg)} · Stop ${k(x.stop)} (${pz(x.stopAbstand)})${x.ziel ? ` · Ziel ${k(x.ziel)} (${pz(x.zielAbstand)})` : ""}` +
    `${x.crv != null ? "\nChance : Risiko " + fPct.format(x.crv) + " : 1" : ""}${x.risikoPct != null ? "\nRisiko " + fPct.format(x.risikoPct) + " % vom Kapital" : ""}`;
  if (typ === "nachkauf") return `Einstand ${k(dzZahl(dz(d.einstand), 2))} → ${k(x.nach.einstand)} · Kurs ${k(dzZahl(dz(d.kurs), 2))}\nBreak-even ${k(x.nach.breakEven)}` +
    `${x.D && !x.D.fehler ? "\nEinstand rausnehmen bei " + k(x.D.kurs) + ": " + fPct.format(x.D.anteil) + " % verkaufen" : ""}`;
  return `Einstand ${k(dzZahl(dz(d.einstand), 2))}\n` + x.stufen.map((s) => `Stufe ${s.nr}: bei ${k(s.kurs)} ${fPct.format(s.anteil)} % verkaufen (${pz(s.gewinnPct)})${s.frei ? " – Einstand zurück" : s.restBis != null ? " – Rest sicher bis " + k(s.restBis) : ""}`).join("\n");
}

document.addEventListener("click", (ev) => {
  let x;
  if ((x = ev.target.closest("[data-plan-notiz]"))) {
    const typ = x.dataset.planNotiz, p = PLAN_RECHNER[typ], d = { ...(ui[typ] || {}) }, r = p.rechnen(d);
    if (r.fehler.length) return meldung("Erst den Rechner ausfüllen – so lässt sich nichts speichern.");
    ui.notiz = { bezug: d.posId && D.instrumente[d.posId] ? d.posId : "", plan: { typ, daten: d }, titel: d.titel || `${p.name}${d.name ? " " + d.name : ""}`, text: planText(typ, d, r) + "\n(Rechnung ohne Gewähr)" };
    zeichnen(); return scrollTo(0, 0);
  }
  if ((x = ev.target.closest("[data-plan-laden]"))) {
    const n = (S.notizen || []).find((y) => y.id === x.dataset.planLaden);
    if (!n?.plan || !PLAN_RECHNER[n.plan.typ]) return;
    ui[n.plan.typ] = { ...n.plan.daten }; ui[n.plan.typ + "Offen"] = true; ui.notiz = null; zeige("notizen");
    document.getElementById(n.plan.typ === "nachkauf" ? "nachkauf" : n.plan.typ)?.scrollIntoView?.();
  }
});
