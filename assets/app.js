// Depot-Kompass - eigenstaendige Depot-App. Startet leer; alles kommt per Import
// oder Eingabe hinein und bleibt im privaten App-Speicher (depot.json).
//
// Quelle der Wahrheit sind die BUCHUNGEN. Bestand, Einstand, Gewinn und
// Gewichtung werden daraus gerechnet und nie gespeichert - so kann nichts
// auseinanderlaufen.
"use strict";

const APP = window.Android || null;          // im Browser zum Testen: null
const FARBEN = ["#7c5cf0", "#22a6b3", "#f0a33c", "#e0567a", "#3ecf85", "#5b8def", "#c86dd7", "#9aa83a",
                "#ef7d4f", "#2fb8a0", "#8e7cc3", "#d4a72c", "#4fb3d9", "#e86f9b", "#6fbf73", "#b48a5a"];
const STATUS = { "": "–", ok: "OK", pruefen: "prüfen", aendern: "ändern", neu: "neu" };
const TYPEN = { kauf: "Kauf", verkauf: "Verkauf", einbuchung: "Einbuchung (Startbestand)",
                ausbuchung: "Ausbuchung", dividende: "Dividende",
                einzahlung: "Einzahlung", auszahlung: "Auszahlung", karte: "Kartenzahlung",
                zinsen: "Zinsen", gebuehr: "Kontogebühr", bonus: "Bonus/Gutschrift",
                verlust: "Verlust (z. B. Challenge)" };
// Kontobewegungen: Geld, kein Wertpapier. betrag ist VORZEICHENRICHTIG
// (+ rein, − raus), damit der Kontostand eine einfache Summe ist.
const KONTO_TYPEN = new Set(["einzahlung", "auszahlung", "karte", "zinsen", "gebuehr", "bonus", "verlust"]);

// Mehrere Depots: eigene und beobachtete (Kinderdepot, Depot eines anderen).
// D ist immer das gerade offene Depot, S der ganze gespeicherte Stand.
let S = leererGesamtstand();
let D = S.depots[S.aktiv];
const ui = { seite: "uebersicht", aufteilung: "position", sortierung: "wert", verdeckt: false,
             detail: null, formular: null, vorschau: null };

/** Eindeutige Kennung - Zeit allein reicht nicht: mehrere Importe in derselben
 *  Millisekunde haben sich sonst gegenseitig ueberschrieben (Test 07.11.). */
let idZaehler = 0;
const neueId = (vorsatz) => vorsatz + Date.now().toString(36) + (idZaehler++).toString(36) + Math.random().toString(36).slice(2, 5);

function neuesDepot(name, rolle) {
  return { name, rolle, instrumente: {}, buchungen: [], geaendert: null };
}
function leererGesamtstand() {
  return { version: 2, aktiv: "d1", depots: { d1: neuesDepot("Mein Depot", "eigen") }, watchlist: [], notizen: [], einstellungen: {}, eigeneTermine: [], sachwerte: [] };
}
/** Sicherungen der ersten Fassung (ein Depot) werden zum Depot "Mein Depot". */
function alsGesamtstand(x) {
  if (x && x.depots) return Object.assign({ watchlist: [], notizen: [], einstellungen: {}, eigeneTermine: [], sachwerte: [] }, x);
  const s = leererGesamtstand();
  Object.assign(s.depots.d1, { instrumente: x.instrumente || {}, buchungen: x.buchungen || [], geaendert: x.geaendert || null });
  return s;
}
function oeffnen(id) {
  if (!S.depots[id]) id = Object.keys(S.depots)[0];
  S.aktiv = id; D = S.depots[id];
  document.getElementById("titel").textContent = D.name + (D.rolle === "beobachtet" ? " 👁" : "");
}

// ------------------------------------------------------------ Speicher
function laden() {
  try {
    const roh = APP ? APP.laden() : localStorage.getItem("dk-depot");
    if (roh === "\u0000GESPERRT") { ui.gesperrt = true; S = leererGesamtstand(); }
    else if (roh) { ui.gesperrt = false; S = alsGesamtstand(JSON.parse(roh)); }
  } catch (e) { meldung("Gespeicherter Stand nicht lesbar."); }
  oeffnen(S.aktiv);
  try { ui.verdeckt = localStorage.getItem("dk-verdeckt") === "1"; } catch {}
  designAnwenden();
  if (!ui.gesperrt && EIN().startseite) ui.seite = EIN().startseite;
}
/** Design auch vor dem Entsperren (PIN-Feld): darum zusaetzlich im Browser-Speicher - kein Geheimnis. */
function designAnwenden() {
  let d = EIN().design;
  try { if (d) localStorage.setItem("dk-design", d); else d = localStorage.getItem("dk-design") || ""; } catch {}
  if (d && d !== "system") document.documentElement.dataset.design = d; else delete document.documentElement.dataset.design;
}
function sichern() {
  if (ui.gesperrt) return;                 // gesperrt: nie den leeren Platzhalter speichern
  D.geaendert = new Date().toISOString();
  const json = JSON.stringify(S);
  // Im Browser (nur Test) ist localStorage auf ~5 MB begrenzt - dann bleibt der Stand nur im Speicher.
  const ok = APP ? APP.sichern(json) : (() => { try { localStorage.setItem("dk-depot", json); } catch { /* zu gross */ } return true; })();
  if (!ok) meldung("Speichern fehlgeschlagen!");
  if (typeof wachterSpaeter === "function") wachterSpaeter();
}
/** Kurse betreffen alle Depots - jedes bekommt einen neuen Zeitstempel. */
function sichernAlle() {
  const offen = D;
  for (const d of Object.values(S.depots)) { D = d; d.geaendert = new Date().toISOString(); }
  D = offen;
  sichern();
}

// ------------------------------------------------------------ Rechnen
const rund = (x, n = 2) => Math.round(x * 10 ** n) / 10 ** n;

/** Bestand je Instrument und Konto aus den Buchungen, nach Datum. */
function bestand() {
  const pos = {};
  const sortiert = [...D.buchungen].sort((a, b) => (a.datum || "").localeCompare(b.datum || "") || a.nr - b.nr);
  for (const b of sortiert) {
    if (KONTO_TYPEN.has(b.typ)) continue;
    const key = b.instrument + "|" + (b.konto || "");
    const p = pos[key] ??= { instrument: b.instrument, konto: b.konto || "", stueck: 0, einstand: 0,
                             realisiert: 0, dividenden: 0, kosten: 0 };
    const st = +b.stueck || 0, gebuehr = +b.gebuehr || 0, steuer = +b.steuer || 0;
    if (b.typ === "kauf") {
      p.stueck += st; p.einstand += st * (+b.kurs || 0) + gebuehr; p.kosten += gebuehr;
    } else if (b.typ === "einbuchung") {
      p.stueck += st; p.einstand += b.einstand != null ? +b.einstand : st * (+b.kurs || 0);
    } else if (b.typ === "verkauf" || b.typ === "ausbuchung") {
      // Mehr verkauft als im Bestand (Kauf fehlt in der Datei): nur den Bestand
      // abgehen lassen, Gewinn nur darauf - und sichtbar warnen.
      const menge = Math.min(st, Math.max(0, p.stueck));
      const anteil = p.stueck > 0 ? menge / p.stueck : 0;
      const abgang = p.einstand * anteil;
      if (b.typ === "verkauf") p.realisiert += menge * (+b.kurs || 0) - gebuehr - steuer - abgang;
      if (st - menge > 1e-9) (p.ueber ??= []).push({ datum: b.datum, stueck: st - menge });
      p.einstand -= abgang; p.stueck -= menge; p.kosten += gebuehr;
      if (Math.abs(p.stueck) < 1e-9) { p.stueck = 0; p.einstand = 0; }
    } else if (b.typ === "dividende") {
      p.dividenden += (+b.betrag || 0) - steuer;
    }
  }
  return pos;
}

/** Verrechnungskonto: nur fuer Konten, zu denen Kontobewegungen importiert
 *  wurden - sonst fehlen die Einzahlungen und der Stand waere Unsinn.
 *  Kauf/Verkauf/Dividende bewegen das Geld mit. */
function kontoStand() {
  const mitGeld = new Set(D.buchungen.filter((b) => KONTO_TYPEN.has(b.typ)).map((b) => b.konto || ""));
  const k = { stand: 0, ein: 0, aus: 0, karte: 0, zinsen: 0, gebuehren: 0, bonus: 0, verluste: 0, kaeufe: 0, verkaeufe: 0,
              dividenden: 0, konten: [...mitGeld], karteJeMonat: {}, karteJeHaendler: {} };
  if (!mitGeld.size) return null;
  for (const b of D.buchungen) {
    if (!mitGeld.has(b.konto || "")) continue;
    // kasse = Betrag, wie der Broker ihn gebucht hat (weicht wegen Rundung
    // um Bruchteile eines Cents von Stueck x Kurs ab).
    const d = kassenDelta(b);
    if (b.typ === "kauf") k.kaeufe -= d;
    else if (b.typ === "verkauf") k.verkaeufe += d;
    else if (b.typ === "dividende") k.dividenden += d;
    else if (KONTO_TYPEN.has(b.typ)) {
      const feld = { einzahlung: "ein", auszahlung: "aus", karte: "karte", zinsen: "zinsen", gebuehr: "gebuehren", bonus: "bonus", verlust: "verluste" }[b.typ];
      k[feld] += Math.abs(d);
      if (b.typ === "karte") {
        const m = (b.datum || "").slice(0, 7);
        k.karteJeMonat[m] = (k.karteJeMonat[m] || 0) - d;
        const h = b.notiz || "unbekannt";
        k.karteJeHaendler[h] = (k.karteJeHaendler[h] || 0) - d;
      }
    }
    k.stand += d;
  }
  return k;
}

function kontoKarte() {
  const k = kontoStand();
  if (!k) return "";
  const monate = Object.entries(k.karteJeMonat).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 6);
  const haendler = Object.entries(k.karteJeHaendler).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const mon = (m) => new Date(m + "-01T12:00").toLocaleDateString(LOC_DATUM(), { month: "short", year: "2-digit" });
  return `
    <h2>Konto <span>${esc(k.konten.join(", "))}</span></h2>
    <section class="karte gesamt">
      <div class="label">Kontostand (laut Buchungen)</div>
      <div class="zahl">${eur(k.stand)}</div>
      <div class="kennzahlen">
        <div><small>Eingezahlt</small><b class="plus-t">${eur(k.ein, true)}</b></div>
        <div><small>Ausgezahlt</small><b class="minus-t">${eur(k.aus, true)}</b></div>
        <div><small>Karte</small><b class="minus-t">${eur(k.karte, true)}</b></div>
        <div><small>Gekauft</small><b>${eur(k.kaeufe, true)}</b></div>
        <div><small>Verkauft</small><b>${eur(k.verkaeufe, true)}</b></div>
        <div><small>Zinsen + Div.</small><b class="plus-t">${eur(k.zinsen + k.dividenden, true)}</b></div>
      </div>
      ${k.gebuehren || k.bonus || k.verluste ? `<div class="klein">${k.verluste ? `<span class="minus-t">Verluste (z. B. Challenges) ${eur(k.verluste)}</span> · ` : ""}Kontogebühren ${eur(k.gebuehren)} · Gutschriften ${eur(k.bonus)}</div>` : ""}
    </section>
    ${monate.length ? `
    <h2>Karte</h2>
    <section class="karte">
      <table class="tabelle">${monate.map(([m, w]) => `<tr><td>${mon(m)}</td><td>${eur(w)}</td></tr>`).join("")}</table>
      <p class="klein" style="margin:14px 0 4px">Wo am meisten:</p>
      <table class="tabelle">${haendler.map(([h, w]) => `<tr><td>${esc(h)}</td><td>${eur(w)}</td></tr>`).join("")}</table>
    </section>` : ""}`;
}

// ------------------------------------------------------------ Charts
/** Kleiner Linien-Chart aus den gespeicherten Wochenkursen. */
function minichart(i, b = 64, h = 22, mitAchse = false) {
  const p = (i.verlauf?.punkte || []).map((x) => x[1]);
  if (p.length < 2) return mitAchse ? `<p class="klein">Noch kein Chart – unter Import „Kurse &amp; Daten aktualisieren“.</p>` : "";
  const min = Math.min(...p), max = Math.max(...p), sp = max - min || 1;
  const pts = p.map((y, k) => `${(k / (p.length - 1) * b).toFixed(1)},${(h - 2 - (y - min) / sp * (h - 4)).toFixed(1)}`).join(" ");
  const farbe = p.at(-1) >= p[0] ? "var(--plus)" : "var(--minus)";
  const svg = `<svg viewBox="0 0 ${b} ${h}" width="${mitAchse ? "100%" : b}" height="${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${pts}" fill="none" stroke="${farbe}" stroke-width="${mitAchse ? 1.2 : 1.5}" vector-effect="non-scaling-stroke"/></svg>`;
  if (!mitAchse) return svg;
  const w = i.waehrung || "";
  const veraenderung = (p.at(-1) / p[0] - 1) * 100;
  return `${svg}<div class="klein" style="display:flex;justify-content:space-between">
    <span>1 Jahr: <b class="${vz(veraenderung)}-t">${pct(veraenderung)}</b></span>
    <span>Tief ${fZahl.format(rund(min, 2))} · Hoch ${fZahl.format(rund(max, 2))} ${esc(w)}</span></div>`;
}

// ------------------------------------------------------------ Kalender
/** Bestand eines Wertpapiers (alle Konten des Depots) VOR einem Tag - fuer die
 *  Dividenden-Berechtigung: wer am Ex-Tag kauft, bekommt nichts mehr. */
function stueckVor(depot, iid, tag) {
  return depot.buchungen.filter((b) => b.instrument === iid && b.datum < tag).reduce((s, b) =>
    s + (b.typ === "kauf" || b.typ === "einbuchung" ? +b.stueck || 0 : b.typ === "verkauf" || b.typ === "ausbuchung" ? -(+b.stueck || 0) : 0), 0);
}

/** Alle Kalender-Ereignisse: erhaltene Dividenden (aus Buchungen, mit % auf den
 *  Einsatz), Ex-Tage mit Berechtigung, Zahltage, Earnings, Haltefristen, eigene. */
function kalenderEreignisse(depotIds) {
  const aus = [], h = heute(), viele = depotIds.length > 1;
  for (const id of depotIds) {
    const d = S.depots[id], dn = viele ? d.name : "";
    // 1. erhaltene Dividenden mit Einstand zum Zeitpunkt der Zahlung; Kaeufe/Verkaeufe je Tag, Wert und Richtung (Vorgabe 11.11.)
    const lauf = {}, handel = {};
    for (const b of [...d.buchungen].sort((x, y) => (x.datum || "").localeCompare(y.datum || "") || x.nr - y.nr)) {
      if (KONTO_TYPEN.has(b.typ)) continue;
      if ((b.typ === "kauf" || b.typ === "verkauf") && b.datum) {
        const k = handel[b.datum + "|" + b.instrument + "|" + b.typ] ??= { datum: b.datum, iid: b.instrument, typ: b.typ, n: 0, st: 0, geld: 0 };
        k.n++; k.st += +b.stueck || 0; k.geld += Math.abs(kassenDelta(b));
      }
      const p = lauf[b.instrument] ??= { st: 0, ein: 0 }, st = +b.stueck || 0;
      if (b.typ === "kauf") { p.st += st; p.ein += st * (+b.kurs || 0) + (+b.gebuehr || 0); }
      else if (b.typ === "einbuchung") { p.st += st; p.ein += b.einstand != null ? +b.einstand : st * (+b.kurs || 0); }
      else if (b.typ === "verkauf" || b.typ === "ausbuchung") {
        const m = Math.min(st, Math.max(0, p.st)); if (p.st > 0) p.ein -= p.ein * m / p.st; p.st -= m;
      } else if (b.typ === "dividende") {
        const netto = (+b.betrag || 0) - (+b.steuer || 0);
        aus.push({ datum: b.datum, art: "Dividende", titel: (d.instrumente[b.instrument] || {}).name || b.instrument, id: b.instrument, depot: dn,
                   eur: netto, info: `erhalten · brutto ${eur(+b.betrag || 0)}${p.ein > 0 ? ` · ${ant(netto / p.ein * 100)} auf deinen Einsatz` : ""}`, sicher: true });
      }
    }
    for (const k of Object.values(handel)) {
      const kauf = k.typ === "kauf", wort = kauf ? (k.n === 1 ? "Kauf" : "Käufe") : (k.n === 1 ? "Verkauf" : "Verkäufe");
      aus.push({ datum: k.datum, art: kauf ? "Kauf" : "Verkauf", titel: (d.instrumente[k.iid] || {}).name || k.iid, id: k.iid, depot: dn, eur: k.geld, klasse: "",
                 info: `${k.n > 1 ? k.n + " " + wort + " · " : ""}${stk(rund(k.st, 8))} Stück · Ø ${kursE(k.st ? k.geld / k.st : null)}${kauf ? " (inkl. Gebühr)" : " (nach Kosten)"}` });
    }
    // 2. Ex-Tage (vergangene aus dem Kursverlauf, kommende laut Yahoo) mit Berechtigung
    for (const [iid, i] of Object.entries(d.instrumente)) {
      const exTage = new Map((i.verlauf?.dividenden || []).map(([t, betrag]) => [t, betrag]));
      if (i.termine?.exDividende && !exTage.has(i.termine.exDividende)) exTage.set(i.termine.exDividende, null);
      const kaeufe = d.buchungen.filter((b) => b.instrument === iid && b.typ === "kauf").map((b) => b.datum).sort();
      for (const [t, betrag] of exTage) {
        const st = stueckVor(d, iid, t), spaeter = kaeufe.find((k) => k >= t && k <= String(+t.slice(0, 4)) + "-12-31");
        if (st <= 1e-9 && !spaeter && t < h) continue;               // nie gehalten - nicht relevant
        if (t >= h && stueckVor(d, iid, "9999") <= 1e-9) continue;    // kommend, aber nicht mehr im Bestand (verkauft) - weglassen
        let info;
        if (t >= h) info = st > 1e-9 || stueckVor(d, iid, "9999") > 1e-9
          ? `berechtigt, wenn du bis zum Vortag hältst (jetzt ${stk(stueckVor(d, iid, "9999"))} Stück) · Betrag steht noch nicht fest`
          : "nicht im Bestand";
        else if (st > 1e-9) {
          const gezahlt = d.buchungen.some((b) => b.instrument === iid && b.typ === "dividende" && b.datum >= t && b.datum <= new Date(Date.parse(t) + 60 * 864e5).toISOString().slice(0, 10));
          info = `berechtigt mit ${stk(st)} Stück${betrag ? ` · ${fZahl.format(rund(betrag, 4))} ${esc(i.waehrung || "")} je Stück` : ""} · ${gezahlt ? "✓ Zahlung gebucht" : "Zahlung nicht in deinen Buchungen"}`;
        } else info = `nicht berechtigt – gekauft am ${datum(spaeter)}, nach dem Ex-Tag`;
        aus.push({ datum: t, art: "Ex-Dividende", titel: i.name || iid, id: iid, depot: dn, info });
      }
      if (i.termine?.zahltag >= h && stueckVor(d, iid, "9999") > 1e-9)
        aus.push({ datum: i.termine.zahltag, art: "Dividende", titel: i.name || iid, id: iid, depot: dn, info: "Zahltag laut Yahoo · Höhe steht noch nicht fest" });
      if (stueckVor(d, iid, "9999") > 1e-9) {
        for (const e of i.termine?.earnings || []) if (e >= h) aus.push({ datum: e, art: "Earnings", titel: i.name || iid, id: iid, did: id, depot: dn, info: "Quartalszahlen · antippen für Details" });
        for (const e of i.termine?.earningsGewesen || []) {
          const q = earningsErgebnis(i, e);
          aus.push({ datum: e, art: "Earnings", titel: i.name || iid, id: iid, did: id, depot: dn,
                     info: q ? `Ergebnis je Aktie ${fZahl.format(q.eps)}${q.erwartet != null ? " (erwartet " + fZahl.format(q.erwartet) + ")" : ""}` : "Auswertung noch nicht geladen – antippen" });
        }
      }
    }
    // 3. Haltefristen (Krypto)
    const vorher = D;
    try {
      D = d;
      for (const x of haltefristen()) if (x.ende >= h)
        aus.push({ datum: x.ende, art: "Haltefrist endet", titel: (d.instrumente[x.instrument] || {}).name || x.instrument, id: x.instrument, depot: dn,
                   info: `${stk(rund(x.stueck, 8))} Stück, gekauft ${datum(x.kauf)} – danach steuerfrei` });
    } finally { D = vorher; }
  }
  aus.push(...steuerTermine());
  for (const x of S.eigeneTermine || []) if (depotIds.includes(x.depot))
    aus.push({ datum: x.datum, art: x.art, titel: x.titel, eigen: x.id, eur: x.betrag ?? undefined, info: esc(x.notiz || ""),
               depot: viele ? (S.depots[x.depot] || {}).name : "" });
  const weg = EIN().kalAus || {};
  return aus.filter((x) => x.datum && !weg[x.eigen ? "eigen" : x.art]).sort((a, b) => a.datum.localeCompare(b.datum));
}

/** 0.58: deutsche Steuertermine (Vorgabe 17.11.) - ohne Gewaehr, in den Einstellungen abschaltbar (Kalender → 🧾 Steuertermine).
 *  Feste Tage; faellt eine Frist aufs Wochenende, gilt der naechste Werktag (steht im Hinweis). Vorjahr bis naechstes Jahr. */
function steuerTermine() {
  const j = +heute().slice(0, 4), aus = [];
  for (const y of [j - 1, j, j + 1]) aus.push(
    { datum: `${y}-01-02`, art: "Steuertermin", titel: "Vorabpauschale für ETFs und Fonds", steuer: true,
      info: "Für thesaurierende ETFs zieht die Bank Anfang Januar ggf. Steuer ab – etwas Geld auf dem Verrechnungskonto lassen. Ohne Gewähr." },
    { datum: `${y}-07-31`, art: "Steuertermin", titel: "Abgabefrist Steuererklärung (Vorjahr)", steuer: true,
      info: "Gilt, wenn du abgeben musst; mit Steuerberater später. Fällt die Frist aufs Wochenende, gilt der nächste Werktag. Ohne Gewähr." },
    { datum: `${y}-12-01`, art: "Steuertermin", titel: "Freistellungsauftrag prüfen", steuer: true,
      info: "1.000 € je Person (2.000 € bei Zusammenveranlagung) – fürs neue Jahr sinnvoll auf deine Banken verteilen. Ohne Gewähr." },
    { datum: `${y}-12-15`, art: "Steuertermin", titel: "Verlustbescheinigung beantragen", steuer: true,
      info: "Bis 15.12. bei der Bank beantragen, wenn du Verluste mit Gewinnen bei einer anderen Bank verrechnen willst. Ohne Gewähr." });
  return aus;
}

/** Kommende Termine (fuer die KI und die Liste "Demnaechst"). */
function kalenderEintraege(depotIds) {
  const h = heute(), bis = new Date(Date.now() + (EIN().kalTage || 365) * 864e5).toISOString().slice(0, 10);
  return kalenderEreignisse(depotIds).filter((x) => x.datum >= h && x.datum <= bis && x.art !== "Kauf" && x.art !== "Verkauf");
}

function kalenderSeite() {
  const reiter = `<div class="reiter" style="margin:12px 0 0">
    <button data-kalart="termine" class="${ui.kalArt !== "gv" ? "aktiv" : ""}">Kalender</button>
    <button data-kalart="gv" class="${ui.kalArt === "gv" ? "aktiv" : ""}">Gewinn/Verlust je Tag</button></div>`;
  const wahl = sichtDepots().length > 1 ? `<span class="reiter" style="margin:0">
        <button data-kal="eins" class="${ui.kalenderAlle ? "" : "aktiv"}">${esc(D.name)}</button>
        <button data-kal="alle" class="${ui.kalenderAlle ? "aktiv" : ""}">${ui.person ? "Alle " + esc(ui.person) : "Alle Depots"}</button></span>` : "";
  if (ui.kalArt === "gv") return `${sichtLeiste()}${reiter}<h2>Gewinn/Verlust je Tag${wahl}</h2>${gvKalender()}`;
  return `${sichtLeiste()}${reiter}<h2>Kalender${wahl}</h2>${ui.earnings ? earningsKarte() : ""}${monatsKalender()}`;
}

/** Analysten (ab 0.46, Yahoo financialData/recommendationTrend/upgradeDowngradeHistory): Kursziele (Mittel, Median, Spanne),
 *  Verteilung Kaufen/Halten/Verkaufen und die letzten Einstufungen der Banken mit altem und neuem Kursziel. */
function analystenAus(r) {
  const roh = (x) => x?.raw ?? (typeof x === "number" ? x : null);
  const fd = r.financialData || {}, tr0 = (r.recommendationTrend?.trend || []).find((x) => x.period === "0m");
  const hist = (r.upgradeDowngradeHistory?.history || []).slice(0, 12).map((h) => ({
    datum: h.epochGradeDate ? new Date(h.epochGradeDate * 1000).toISOString().slice(0, 10) : null, haus: String(h.firm || "").slice(0, 40),
    von: h.fromGrade || "", zu: h.toGrade || "", aktion: h.action || "", ziel: roh(h.currentPriceTarget), zielVorher: roh(h.priorPriceTarget), zielAktion: h.priceTargetAction || "" }));
  const a = { mittel: roh(fd.targetMeanPrice), median: roh(fd.targetMedianPrice), hoch: roh(fd.targetHighPrice), tief: roh(fd.targetLowPrice),
    anzahl: roh(fd.numberOfAnalystOpinions), empfehlung: fd.recommendationKey || null, wert: roh(fd.recommendationMean),
    verteilung: tr0 ? { starkKaufen: tr0.strongBuy || 0, kaufen: tr0.buy || 0, halten: tr0.hold || 0, verkaufen: tr0.sell || 0, starkVerkaufen: tr0.strongSell || 0 } : null,
    historie: hist };
  return a.mittel == null && !a.verteilung && !hist.length ? null : a;
}
/** Einstufungen der Analystenhaeuser kommen von Yahoo auf Englisch - auf Deutsch anzeigen (keine Sprachmischung). */
const NOTEN_DE = { "strong buy": "Stark kaufen", "buy": "Kaufen", "speculative buy": "Spekulativ kaufen", "long-term buy": "Langfristig kaufen", "accumulate": "Aufstocken", "add": "Aufstocken",
  "outperform": "Besser als der Markt", "market outperform": "Besser als der Markt", "sector outperform": "Besser als die Branche", "overweight": "Übergewichten", "positive": "Positiv",
  "hold": "Halten", "neutral": "Neutral", "equal-weight": "Marktgewichten", "equal weight": "Marktgewichten", "market perform": "Wie der Markt", "sector perform": "Wie die Branche",
  "sector weight": "Branchengewicht", "peer perform": "Wie vergleichbare Werte", "in-line": "Im Rahmen", "perform": "Wie der Markt", "mixed": "Gemischt",
  "underperform": "Schlechter als der Markt", "sector underperform": "Schlechter als die Branche", "market underperform": "Schlechter als der Markt", "underweight": "Untergewichten",
  "reduce": "Reduzieren", "negative": "Negativ", "sell": "Verkaufen", "strong sell": "Stark verkaufen" };
const note = (g) => !g ? "" : sprache() === "de" ? (NOTEN_DE[String(g).trim().toLowerCase()] || g) : g;
const EMPFEHLUNG = { strong_buy: "Stark kaufen", buy: "Kaufen", hold: "Halten", underperform: "Untergewichten", sell: "Verkaufen", strong_sell: "Stark verkaufen", none: "–" };

/** Karte "Analysten" in der Detailansicht eines Werts. */
function analystenKarte(i) {
  const a = i.termine?.analysten;
  if (!a) return "";
  const w = i.waehrung && i.waehrung !== "EUR" ? " " + esc(i.waehrung) : " €";
  const z = (x) => x == null ? "–" : fZahl.format(rund(x, 2)) + w;
  const abstand = a.mittel != null && i.kurs ? (a.mittel / i.kurs - 1) * 100 : null;
  const v = a.verteilung, summe = v ? v.starkKaufen + v.kaufen + v.halten + v.verkaufen + v.starkVerkaufen : 0;
  const balken = v && summe ? `<div class="analysten-balken" aria-label="Verteilung">${[["starkKaufen", "plus"], ["kaufen", "plus"], ["halten", "leise"], ["verkaufen", "minus"], ["starkVerkaufen", "minus"]]
    .filter(([k]) => v[k]).map(([k, f], n) => `<span class="ab-${f}${k.startsWith("stark") ? " stark" : ""}" style="flex:${v[k]}">${v[k]}</span>`).join("")}</div>
    <p class="klein" style="margin:4px 0 0">Stark kaufen ${v.starkKaufen} · Kaufen ${v.kaufen} · Halten ${v.halten} · Verkaufen ${v.verkaufen + v.starkVerkaufen}</p>` : "";
  return `<h2>Analysten</h2><section class="karte">
    <div class="kennzahlen">
      <div><small>Kursziel Ø</small><b>${z(a.mittel)}</b></div>
      <div><small>Abstand zum Kurs</small><b class="${vz(abstand)}-t">${abstand != null ? pct(abstand) : "–"}</b></div>
      <div><small>Median</small><b>${z(a.median)}</b></div>
      <div><small>Spanne</small><b>${z(a.tief)} – ${z(a.hoch)}</b></div>
      <div><small>Analysten</small><b>${a.anzahl ?? "–"}</b></div>
      <div><small>Einschätzung</small><b>${esc(EMPFEHLUNG[a.empfehlung] || a.empfehlung || "–")}</b></div>
    </div>${balken}
    ${a.historie?.length ? `<p class="klein" style="margin:10px 0 4px"><b>Letzte Einstufungen</b></p><div class="liste">${a.historie.slice(0, 8).map((h) => `
      <div class="zeile" style="grid-template-columns:minmax(0,1fr) auto"><span style="min-width:0"><span class="titel" data-kein-tr>${esc(h.haus)}</span>
        <span class="unter" data-kein-tr>${esc(h.datum ? datum(h.datum) : "")} · ${esc(h.von && h.von !== h.zu ? note(h.von) + " → " + note(h.zu) : note(h.zu))}</span></span>
        <span class="rechts" data-kein-tr>${h.ziel != null ? (h.zielVorher != null && h.zielVorher !== h.ziel ? esc(fZahl.format(h.zielVorher)) + " → " : "") + esc(fZahl.format(h.ziel)) : ""}</span></div>`).join("")}</div>` : ""}
    <p class="klein" style="margin-bottom:0">Quelle Yahoo Finance · Stand ${esc(datum(i.termine.stand))} · keine Anlageberatung</p></section>`;
}

const KAL_SYMBOL = { Steuertermin: "🧾", Dividende: "💶", "Ex-Dividende": "✂️", Earnings: "📊", "Haltefrist endet": "⏳", Kauf: "🛒", Verkauf: "🏷️" };

/** Auswertung zu einem Earnings-Termin: das Quartal, das zuletzt VOR dem Termin endete (Yahoo earningsHistory). */
function earningsErgebnis(i, tag) {
  const q = (i.termine?.quartale || []).filter((x) => x.quartal && x.eps != null && x.quartal < tag && x.quartal > new Date(Date.parse(tag) - 130 * 864e5).toISOString().slice(0, 10))
    .sort((a, b) => b.quartal.localeCompare(a.quartal))[0];
  return q || null;
}
function earningsKarte() {
  const e = ui.earnings, d = S.depots[e?.did], i = d?.instrumente[e?.iid];
  if (!i) return "";
  const vorbei = e.datum <= heute(), q = vorbei ? earningsErgebnis(i, e.datum) : null;
  const fin = (i.termine?.finanzen || []).slice(-4), w = i.waehrung && i.waehrung !== "EUR" ? " " + esc(i.waehrung) : "";
  const gross = (x) => x == null ? "–" : Math.abs(x) >= 1e9 ? fZahl.format(rund(x / 1e9, 2)) + " Mrd." : Math.abs(x) >= 1e6 ? fZahl.format(rund(x / 1e6, 1)) + " Mio." : fZahl.format(x);
  return `<section class="karte">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><b>📊 ${esc(i.name || e.iid)}</b><button class="knopf klein" data-earnings-zu="1">schließen</button></div>
    <p class="klein" style="margin:4px 0 8px">Earnings ${datum(e.datum)}${i.termine?.stand ? " · Daten vom " + datum(i.termine.stand) : ""}</p>
    ${!vorbei ? `<p style="margin:0">Die Zahlen kommen am ${datum(e.datum)}. Danach hier „Aktualisieren“ tippen.</p>`
      : q ? `<div class="kennzahlen">
          <div><small>Ergebnis je Aktie</small><b>${fZahl.format(q.eps)}${w}</b></div>
          <div><small>Erwartet</small><b>${q.erwartet != null ? fZahl.format(q.erwartet) + w : "–"}</b></div>
          <div><small>Überraschung</small><b class="${vz(q.ueberraschung)}-t">${q.ueberraschung != null ? pct(q.ueberraschung * 100) : "–"}</b></div>
        </div><p class="klein" style="margin:6px 0 0">Quartal bis ${datum(q.quartal)} · Quelle Yahoo Finance</p>`
      : `<p style="margin:0">Noch keine Auswertung für diesen Termin geladen. Die Zahlen sind meist am Abend des Termins oder am nächsten Tag da.</p>`}
    ${fin.length ? `<table class="tabelle" style="margin-top:8px">${fin.map((f) => `<tr><td>${esc(f.quartal)}</td><td>Umsatz ${gross(f.umsatz)}${w}</td><td>Gewinn ${gross(f.gewinn)}${w}</td></tr>`).join("")}</table>` : ""}
    <button class="knopf haupt" data-earnings-neu="1" style="width:100%;margin-top:10px">🔄 Aktualisieren</button>
    <p class="klein" style="margin-bottom:0">Fragt nur diesen einen Wert bei Yahoo ab (Internet nötig).</p>
  </section>`;
}
async function earningsAktualisieren() {
  const e = ui.earnings, i = S.depots[e?.did]?.instrumente[e?.iid];
  if (!i) return;
  if (!APP) return meldung("Kurse gibt es nur in der App.");
  if (netzGesperrt()) return;
  if (!i.ticker) { meldung("Suche Ticker …"); i.ticker = await tickerSuchen(i) || ""; }
  if (!i.ticker) return meldung("Kein Yahoo-Ticker für diesen Wert – in der Position eintragen.");
  meldung("Hole Earnings …");
  const gleiche = Object.values(S.depots).flatMap((d) => Object.values(d.instrumente)).filter((x) => x.ticker === i.ticker);
  await zusatzdaten(i.ticker, gleiche);
  sichernAlle(); zeichnen();
  meldung(earningsErgebnis(i, e.datum) || e.datum > heute() ? "Earnings aktualisiert." : "Noch keine Auswertung bei Yahoo – später nochmal versuchen.");
}

function monatsKalender() {
  const alle = ui.kalenderAlle && sichtDepots().length > 1;
  const ev = kalenderEreignisse(alle ? sichtDepots() : [S.aktiv]);
  const m = ui.kalMonat || heute().slice(0, 7);
  const [j, mo] = m.split("-").map(Number);
  const erster = new Date(Date.UTC(j, mo - 1, 1)), anzahl = new Date(Date.UTC(j, mo, 0)).getUTCDate();
  const versatz = (erster.getUTCDay() + 6) % 7;
  const imMonat = ev.filter((x) => x.datum.startsWith(m));
  const jeTag = {};
  for (const x of imMonat) (jeTag[x.datum] ??= []).push(x);
  const erhalten = imMonat.filter((x) => x.sicher), summe = erhalten.reduce((a, x) => a + x.eur, 0);
  const jahrSumme = ev.filter((x) => x.sicher && x.datum.startsWith(String(j))).reduce((a, x) => a + x.eur, 0);
  const zellen = [];
  for (let k = 0; k < versatz; k++) zellen.push(`<div class="gvtag leer"></div>`);
  for (let t = 1; t <= anzahl; t++) {
    const iso = `${m}-${String(t).padStart(2, "0")}`, l = jeTag[iso] || [];
    const geld = l.some((x) => x.sicher);
    zellen.push(`<button class="gvtag kaltag ${geld ? "plus" : ""} ${iso === heute() ? "heute" : ""} ${ui.kalTag === iso ? "gewaehlt" : ""}" data-kaltag="${iso}"
      ${geld ? `style="background:${heatmapFarbe(8)}"` : ""}><small>${t}</small><span>${[...new Set(l.map((x) => x.eigen ? "📌" : KAL_SYMBOL[x.art] || "•"))].slice(0, 3).join("")}</span></button>`);
  }
  const mon = new Date(Date.UTC(j, mo - 1, 15)).toLocaleDateString(LOC_DATUM(), { month: "long", year: "numeric" });
  const nachbar = (d) => new Date(Date.UTC(j, mo - 1 + d, 1)).toISOString().slice(0, 7);
  const liste = ui.kalTag && ui.kalTag.startsWith(m) ? jeTag[ui.kalTag] || [] : imMonat;
  return `
    <section class="karte">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <button class="knopf klein" data-kalmonat="${nachbar(-1)}">‹</button><b>${mon}</b><button class="knopf klein" data-kalmonat="${nachbar(1)}">›</button></div>
      <div class="gvkopf">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((x) => `<small>${x}</small>`).join("")}</div>
      <div class="gvraster">${zellen.join("")}</div>
      <div class="kennzahlen">
        <div><small>Dividenden ${mon.split(" ")[0]}</small><b class="plus-t">${eur(summe)}</b><small>${erhalten.length} erhalten</small></div>
        <div><small>Dividenden ${j}</small><b class="plus-t">${eur(jahrSumme)}</b><small>netto, gebucht</small></div>
      </div>
    </section>
    <h2>${ui.kalTag && ui.kalTag.startsWith(m) ? datum(ui.kalTag) : mon}<span>${liste.length}</span></h2>
    <section class="karte liste">${liste.length ? liste.map((x) => `
      <button class="zeile" ${x.eigen ? `data-termin="${esc(x.eigen)}"` : x.art === "Earnings" ? `data-earnings="${esc(x.did + "|" + x.id + "|" + x.datum)}"` : x.steuer ? "disabled" : `data-position="${esc(x.id)}" ${alle ? "disabled" : ""}`}>
        <span class="mono">${x.eigen ? "📌" : KAL_SYMBOL[x.art] || "•"}</span>
        <span style="min-width:0"><span class="titel">${esc(x.titel)}</span>
          <span class="unter">${esc(x.art)}${x.depot ? " · " + esc(x.depot) : ""}${x.info ? "<br>" + (ui.verdeckt ? x.info.replace(/[\d.,]+\s?Stück/g, "••• Stück") : x.info) : ""}</span></span>
        <span class="rechts"><b>${kurzDatum(x.datum)}</b>${x.eur != null ? `<span class="${x.klasse ?? "plus-t"}">${eur(x.eur)}</span>` : ""}</span>
      </button>`).join("") : `<p class="klein" style="margin:8px">Nichts in diesem ${ui.kalTag ? "Tag" : "Monat"}.</p>`}</section>
    <button class="fab" data-termin="neu" aria-label="Eigenen Termin eintragen">+</button>`;
}

const TERMIN_ARTEN = ["Earnings", "Dividende", "Ex-Dividende", "Hauptversammlung", "Sparplan", "Kauf planen", "Verkauf planen", "Erinnerung"];

/** Eigener Termin von Hand - fuer alle, die keine Daten aus dem Internet holen wollen. */
function terminFormular() {
  const neu = ui.termin === "neu";
  const x = neu ? { datum: heute(), art: "Erinnerung", depot: S.aktiv } : (S.eigeneTermine || []).find((y) => y.id === ui.termin) || {};
  const namen = positionen().liste.map((p) => p.name).concat((S.watchlist || []).map((w) => w.name));
  return `
    <h2><button class="knopf klein" data-los="zurueck">‹ Zurück</button><span>${neu ? "Eigener Termin" : "Termin"}</span></h2>
    <form class="karte formular" id="termin-form">
      <div class="zwei">
        <label>Datum<input type="date" name="datum" value="${esc(x.datum)}" required></label>
        <label>Art<select name="art">${TERMIN_ARTEN.map((a) => `<option ${x.art === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      </div>
      <label>Wertpapier oder Titel<input name="titel" list="termin-namen" value="${esc(x.titel || "")}" required placeholder="z. B. Nintendo, Sparplan ETF"></label>
      <datalist id="termin-namen">${[...new Set(namen)].map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <div class="zwei">
        <label>Betrag € (optional)<input name="betrag" inputmode="decimal" value="${x.betrag != null ? String(x.betrag).replace(".", ",") : ""}"></label>
        <label>Depot<select name="depot">${Object.entries(S.depots).map(([id, d]) => `<option value="${esc(id)}" ${x.depot === id ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select></label>
      </div>
      <label>Notiz<input name="notiz" value="${esc(x.notiz || "")}"></label>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        ${!neu ? `<button class="knopf gefahr" type="button" data-termin-loeschen="${esc(x.id)}">Löschen</button>` : ""}</div>
    </form>`;
}

/** Quartalszahlen fuer die Detailseite. */
function quartalsTabelle(i) {
  const t = i.termine;
  if (!t || !(t.quartale?.length || t.finanzen?.length)) return "";
  const gross = (x) => x == null ? "–" : Math.abs(x) >= 1e9 ? fPct.format(x / 1e9) + " Mrd." : Math.abs(x) >= 1e6 ? fPct.format(x / 1e6) + " Mio." : fZahl.format(x);
  return `
    <h2>Quartalszahlen</h2>
    <section class="karte">
      ${t.quartale?.length ? `<table class="tabelle">
        <tr><td><b>Quartal</b></td><td><b>Gewinn/Aktie · erwartet</b></td><td><b>Überr.</b></td></tr>
        ${t.quartale.map((q) => `<tr><td>${esc(q.quartal)}</td><td>${q.eps ?? "–"} · ${q.erwartet != null ? rund(q.erwartet, 2) : "–"}</td>
          <td class="${vz(q.ueberraschung)}-t">${q.ueberraschung != null ? pct(q.ueberraschung * 100) : "–"}</td></tr>`).join("")}</table>` : ""}
      ${t.finanzen?.length ? `<table class="tabelle" style="margin-top:12px">
        <tr><td><b>Quartal</b></td><td><b>Umsatz · Gewinn</b></td><td></td></tr>
        ${t.finanzen.map((q) => `<tr><td>${esc(q.quartal)}</td><td>${gross(q.umsatz)} · ${gross(q.gewinn)}</td><td>${esc(i.waehrung || "")}</td></tr>`).join("")}</table>` : ""}
      <p class="klein">Nächste Earnings: ${t.earnings?.length ? t.earnings.map(datum).join(" / ") : "–"} · Ex-Dividende: ${datum(t.exDividende)}${
        t.divRendite != null ? ` · Div.-Rendite ${ant(t.divRendite * 100)}` : ""} · Stand ${datum(t.stand)}</p>
    </section>`;
}

// ------------------------------------------------------------ Gewinn/Verlust je Tag
/** Realisierter Gewinn/Verlust je Kalendertag (Verkaeufe, nach Durchschnitts-
 *  einstand wie bestand()), fuer den Daytrader-Kalender. Dividenden zaehlen
 *  nicht mit - es geht um Trades. Ergebnis: { "JJJJ-MM-TT": {gv, trades} }. */
function gvJeTag(depotIds) {
  const tage = {}, vorher = D;
  try {
    for (const id of depotIds) {
      D = S.depots[id];
      const pos = {};
      const sortiert = [...D.buchungen].sort((a, b) => (a.datum || "").localeCompare(b.datum || "") || a.nr - b.nr);
      for (const b of sortiert) {
        if (KONTO_TYPEN.has(b.typ)) continue;
        const p = pos[b.instrument + "|" + (b.konto || "")] ??= { stueck: 0, einstand: 0 };
        const st = +b.stueck || 0, geb = +b.gebuehr || 0, steu = +b.steuer || 0;
        if (b.typ === "kauf") { p.stueck += st; p.einstand += st * (+b.kurs || 0) + geb; }
        else if (b.typ === "einbuchung") { p.stueck += st; p.einstand += b.einstand != null ? +b.einstand : st * (+b.kurs || 0); }
        else if (b.typ === "verkauf" || b.typ === "ausbuchung") {
          const menge = Math.min(st, Math.max(0, p.stueck));
          const anteil = p.stueck > 0 ? menge / p.stueck : 0, abgang = p.einstand * anteil;
          if (b.typ === "verkauf" && b.datum) {
            const t = tage[b.datum] ??= { gv: 0, trades: 0 };
            t.gv += menge * (+b.kurs || 0) - geb - steu - abgang; t.trades++;
          }
          p.einstand -= abgang; p.stueck -= menge;
          if (Math.abs(p.stueck) < 1e-9) { p.stueck = 0; p.einstand = 0; }
        }
      }
    }
  } finally { D = vorher; }
  return tage;
}

function gvKalender() {
  const alle = ui.kalenderAlle && sichtDepots().length > 1;
  const tage = gvJeTag(alle ? sichtDepots() : [S.aktiv]);
  const monate = Object.keys(tage).map((d) => d.slice(0, 7)).sort();
  const m = ui.gvMonat || monate.at(-1) || heute().slice(0, 7);
  const [j, mo] = m.split("-").map(Number);
  const erster = new Date(Date.UTC(j, mo - 1, 1)), anzahl = new Date(Date.UTC(j, mo, 0)).getUTCDate();
  const versatz = (erster.getUTCDay() + 6) % 7;                    // Montag = 0
  const imMonat = Object.entries(tage).filter(([d]) => d.startsWith(m));
  const summe = imMonat.reduce((s, [, x]) => s + x.gv, 0);
  const plus = imMonat.filter(([, x]) => x.gv > 0), minus = imMonat.filter(([, x]) => x.gv < 0);
  const bester = imMonat.reduce((a, b) => (!a || b[1].gv > a[1].gv ? b : a), null);
  const schlechtester = imMonat.reduce((a, b) => (!a || b[1].gv < a[1].gv ? b : a), null);
  const kurz = (x) => ui.verdeckt ? "•••" : (x > 0 ? "+" : "") + (Math.abs(x) >= 1000 ? fZahl.format(Math.round(x)) : fPct.format(x));
  const zellen = [];
  for (let k = 0; k < versatz; k++) zellen.push(`<div class="gvtag leer"></div>`);
  for (let d = 1; d <= anzahl; d++) {
    const iso = `${m}-${String(d).padStart(2, "0")}`, x = tage[iso];
    zellen.push(`<div class="gvtag ${x ? (x.gv >= 0 ? "plus" : "minus") : ""} ${iso === heute() ? "heute" : ""}"
      style="${x ? `background:${heatmapFarbe(x.gv >= 0 ? Math.min(30, 3 + Math.abs(x.gv) / 10) : -Math.min(30, 3 + Math.abs(x.gv) / 10))}` : ""}">
      <small>${d}</small>${x ? `<b>${kurz(x.gv)}</b><span>${x.trades} T.</span>` : ""}</div>`);
  }
  const mon = new Date(Date.UTC(j, mo - 1, 15)).toLocaleDateString(LOC_DATUM(), { month: "long", year: "numeric" });
  const nachbar = (d) => { const x = new Date(Date.UTC(j, mo - 1 + d, 1)); return x.toISOString().slice(0, 7); };
  return `
    <section class="karte">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
        <button class="knopf klein" data-gvmonat="${nachbar(-1)}">‹</button><b>${mon}</b><button class="knopf klein" data-gvmonat="${nachbar(1)}">›</button></div>
      <div class="gvkopf">${["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((x) => `<small>${x}</small>`).join("")}</div>
      <div class="gvraster">${zellen.join("")}</div>
      <div class="kennzahlen">
        <div><small>Monat</small><b class="${vz(summe)}-t">${eurVz(summe)}</b></div>
        <div><small>Gewinntage</small><b class="plus-t">${plus.length}</b></div>
        <div><small>Verlusttage</small><b class="minus-t">${minus.length}</b></div>
        <div><small>Bester Tag</small><b class="plus-t">${bester ? kurzDatum(bester[0]) + " " + eurVz(bester[1].gv) : "–"}</b></div>
        <div><small>Schlechtester</small><b class="minus-t">${schlechtester && schlechtester[1].gv < 0 ? kurzDatum(schlechtester[0]) + " " + eurVz(schlechtester[1].gv) : "–"}</b></div>
        <div><small>Trefferquote</small><b>${imMonat.length ? ant(plus.length / imMonat.length * 100) : "–"}</b></div>
      </div>
      <p class="klein">Gewinn/Verlust aus Verkäufen, nach Gebühren und Steuern. „T.“ = Verkäufe.</p>
    </section>`;
}

// ------------------------------------------------------------ Steuer (Uebersicht, keine Beratung)
/** Je Jahr: Aktien-Topf, sonstige (ETF/ETC/Fonds …), Dividenden + Zinsen, Krypto nach FIFO
 *  (< 1 Jahr steuerpflichtig, danach frei), bereits einbehaltene Steuer. Durchschnittseinstand
 *  fuer Wertpapiere (wie die Broker), FIFO-Posten fuer Krypto (wie das Finanzamt). */
function steuerJahre(depotIds) {
  const j = {};
  const jahr = (d) => j[d.slice(0, 4)] ??= { aktienPlus: 0, aktienMinus: 0, sonstige: 0, ertraege: 0, kryptoPflichtig: 0, kryptoFrei: 0, steuer: 0 };
  for (const id of depotIds) {
    const d = S.depots[id], pos = {}, posten = {};
    for (const b of [...d.buchungen].sort((x, y) => (x.datum || "").localeCompare(y.datum || "") || x.nr - y.nr)) {
      if (!b.datum) continue;
      const i = d.instrumente[b.instrument] || {}, st = +b.stueck || 0, geb = +b.gebuehr || 0, steu = +b.steuer || 0;
      if (KONTO_TYPEN.has(b.typ)) { if (b.typ === "zinsen") { jahr(b.datum).ertraege += +b.betrag || 0; jahr(b.datum).steuer += steu; } continue; }
      if (b.typ === "dividende") { const y = jahr(b.datum); y.ertraege += +b.betrag || 0; y.steuer += steu; continue; }
      if (i.art === "Krypto") {
        const l = posten[b.instrument] ??= [];
        if (b.typ === "kauf") l.push({ tag: b.datum, st, kosten: st * (+b.kurs || 0) + geb });
        else if (b.typ === "einbuchung") l.push({ tag: b.datum, st, kosten: b.einstand != null ? +b.einstand : 0 });
        else if (b.typ === "verkauf" || b.typ === "ausbuchung") {
          let rest = st;
          while (rest > 1e-12 && l.length) {
            const p = l[0], n = Math.min(rest, p.st), kosten = p.kosten * n / p.st;
            if (b.typ === "verkauf") {
              const g = n * (+b.kurs || 0) - geb * n / st - kosten;
              if (b.datum >= fristEnde(p.tag)) jahr(b.datum).kryptoFrei += g; else jahr(b.datum).kryptoPflichtig += g;
            }
            p.kosten -= kosten; p.st -= n; rest -= n;
            if (p.st <= 1e-12) l.shift();
          }
          if (b.typ === "verkauf") jahr(b.datum).steuer += steu;
        }
        continue;
      }
      const p = pos[b.instrument] ??= { st: 0, ein: 0 };
      if (b.typ === "kauf") { p.st += st; p.ein += st * (+b.kurs || 0) + geb; }
      else if (b.typ === "einbuchung") { p.st += st; p.ein += b.einstand != null ? +b.einstand : st * (+b.kurs || 0); }
      else if (b.typ === "verkauf" || b.typ === "ausbuchung") {
        const m = Math.min(st, Math.max(0, p.st)), abg = p.st > 0 ? p.ein * m / p.st : 0;
        if (b.typ === "verkauf") {
          const g = m * (+b.kurs || 0) - geb - abg, y = jahr(b.datum);
          if ((i.art || "Aktie") === "Aktie") { if (g >= 0) y.aktienPlus += g; else y.aktienMinus += g; } else y.sonstige += g;
          y.steuer += steu;
        }
        p.ein -= abg; p.st -= m;
      }
    }
  }
  return j;
}

function steuerSeite() {
  const j = steuerJahre(eigeneDepots()), jahre = Object.keys(j).sort().reverse();
  const y = ui.steuerJahr && j[ui.steuerJahr] ? ui.steuerJahr : jahre[0];
  const x = j[y];
  const zeile = (t, w, hinweis = "") => `<tr><td>${t}${hinweis ? `<br><span class="klein">${hinweis}</span>` : ""}</td><td class="${vz(w)}-t">${eurVz(w)}</td></tr>`;
  const kap = x ? x.aktienPlus + x.aktienMinus + x.sonstige + x.ertraege : 0;
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Steuer-Übersicht</span></h2>
    ${jahre.length ? `<div class="reiter">${jahre.map((k) => `<button data-steuerjahr="${k}" class="${k === y ? "aktiv" : ""}">${k}</button>`).join("")}</div>
    <section class="karte">
      <table class="tabelle">
        ${zeile("Aktien – Gewinne", x.aktienPlus)}
        ${zeile("Aktien – Verluste", x.aktienMinus, "nur mit Aktiengewinnen verrechenbar")}
        ${zeile("ETF, ETC, Fonds …", x.sonstige, "ohne Teilfreistellung gerechnet")}
        ${zeile("Dividenden + Zinsen (brutto)", x.ertraege)}
        <tr><td><b>Kapitalerträge zusammen</b><br><span class="klein">Sparer-Pauschbetrag 1.000 € (Paare 2.000 €) per Freistellungsauftrag</span></td><td class="${vz(kap)}-t"><b>${eurVz(kap)}</b></td></tr>
        ${zeile("Krypto – unter 1 Jahr gehalten", x.kryptoPflichtig, x.kryptoPflichtig > 1000 ? "über der Freigrenze von 1.000 € → ganz steuerpflichtig" : "unter der Freigrenze von 1.000 € → steuerfrei")}
        ${zeile("Krypto – über 1 Jahr gehalten", x.kryptoFrei, "steuerfrei")}
        ${zeile("Bereits einbehaltene Steuer", -x.steuer)}
      </table>
      <p class="klein">Aus deinen Buchungen: Wertpapiere mit Durchschnittseinstand, Krypto nach FIFO (älteste zuerst). Staking-Erträge, Teilfreistellung und Verlusttöpfe der Banken sind nicht berücksichtigt. <b>Keine Steuerberatung.</b></p>
    </section>` : `<section class="karte"><p class="klein" style="margin:0">Noch keine Verkäufe, Dividenden oder Zinsen.</p></section>`}`;
}

// ------------------------------------------------------------ Haltefristen
/** Krypto: Gewinne sind nach einem Jahr Haltedauer steuerfrei (§ 23 EStG).
 *  Jeder Kauf ist ein eigener Posten; Verkaeufe gehen FIFO vom aeltesten ab
 *  (so verlangt es auch das Finanzamt). Ergebnis: offene Posten mit Fristende. */
/** § 23 EStG: steuerfrei, wenn mehr als ein Jahr gehalten - also ab dem Tag NACH dem Jahrestag. */
function fristEnde(kauf) {
  if (!kauf) return "";
  const d = new Date(Date.UTC(+kauf.slice(0, 4) + 1, +kauf.slice(5, 7) - 1, +kauf.slice(8, 10) + 1));
  return d.toISOString().slice(0, 10);
}

function haltefristen() {
  const posten = {};
  const sortiert = [...D.buchungen].sort((a, b) => (a.datum || "").localeCompare(b.datum || "") || a.nr - b.nr);
  for (const b of sortiert) {
    const i = D.instrumente[b.instrument];
    if (!i || i.art !== "Krypto" || KONTO_TYPEN.has(b.typ)) continue;
    const key = b.instrument + "|" + (b.konto || "");
    const l = posten[key] ??= [];
    if (b.typ === "kauf" || b.typ === "einbuchung") {
      const ende = b.haltefrist || fristEnde(b.datum);
      l.push({ instrument: b.instrument, konto: b.konto || "", kauf: b.datum, ende, stueck: +b.stueck || 0 });
    } else if (b.typ === "verkauf" || b.typ === "ausbuchung") {
      let rest = +b.stueck || 0;
      while (rest > 1e-12 && l.length) {
        const n = Math.min(rest, l[0].stueck);
        l[0].stueck -= n; rest -= n;
        if (l[0].stueck <= 1e-12) l.shift();
      }
    }
  }
  return Object.values(posten).flat().filter((x) => x.stueck > 1e-12 && x.ende);
}

function seitAkt(i) {
  if (!i.kursVorher || i.kurs == null) return "";
  const v = (i.kurs / i.kursVorher - 1) * 100;
  return ` · <span class="${vz(v)}-t">seit Aktualisierung ${pct(v)}</span>`;
}

function haltefristListe(iid) {
  const l = haltefristen().filter((x) => x.instrument === iid);
  if (!l.length) return "";
  const h = heute();
  return `<p class="klein" style="margin:12px 0 4px"><b>Haltefristen</b> (nach 1 Jahr steuerfrei)</p>
    <table class="tabelle">${l.map((x) => `<tr><td>${datum(x.kauf)}</td><td>${stk(x.stueck)} Stk.</td>
      <td class="${x.ende <= h ? "plus-t" : "warn-t"}">${x.ende <= h ? "frei seit " : "frei ab "}${datum(x.ende)}</td></tr>`).join("")}</table>`;
}

// ------------------------------------------------------------ Verlauf & Drawdown
/** Geldbewegung einer Buchung auf dem Verrechnungskonto (wie kontoStand). */
function kassenDelta(b) {
  const st = +b.stueck || 0, geb = +b.gebuehr || 0, steu = +b.steuer || 0, bt = +b.betrag || 0;
  if (b.typ === "kauf") return (b.kasse != null ? +b.kasse : -st * (+b.kurs || 0)) - geb;
  if (b.typ === "verkauf") return (b.kasse != null ? +b.kasse : st * (+b.kurs || 0)) - geb - steu;
  if (b.typ === "dividende") return bt - steu;
  if (KONTO_TYPEN.has(b.typ)) return bt - geb - steu;
  return 0;
}

/** Wertentwicklung je Depot aus den Wochenkursen (Yahoo 1 Jahr oder Kursliste).
 *  Zeitgewichtet: herausgerechnet wird nur, was von aussen kommt oder geht.
 *  - Konto MIT Kontobewegungen (TR, Kraken-Ledger): Wert = Wertpapiere + Cash,
 *    Fluss = Ein-/Auszahlung, Karte, Coin-Ein-/Auszahlung. Kaeufe/Verkaeufe
 *    bleiben drin - so zaehlt auch Daytrading-Gewinn, der abends wieder Cash ist.
 *  - Konto OHNE Kontobewegungen (Scalable, Smartbroker, OKX): Wert = Wertpapiere,
 *    Fluss = echter Kauf-/Verkaufsbetrag (Ausfuehrung, nicht Wochenkurs), Dividende = Abfluss.
 *  Wochenrendite nach Dietz: (Ende - Anfang - Fluss) / (Anfang + Fluss/2).
 *  Staking-Ertraege sind Gewinn, kein Zugang. Wertpapiere ohne Kursverlauf
 *  bleiben ganz draussen (auch ihr Geld). Waehrung: letzter Umrechnungskurs. */
function wertverlauf(depotIds) {
  const vorher = D;
  const teile = [];
  let echteKurse = false;
  const ts0 = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 1000;
  try {
    for (const id of depotIds) {
      D = S.depots[id];
      const mitGeld = new Set(D.buchungen.filter((b) => KONTO_TYPEN.has(b.typ)).map((b) => b.konto || ""));
      // Kurse je Wertpapier: echter Wochenverlauf (Yahoo/Kursliste) - sonst offline aus den
      // Ausfuehrungskursen der eigenen Buchungen (+ letzter bekannter Kurs). Vorgabe 07.11.:
      // Verlauf, geschlossene Positionen und Gewinne gehen ohne Live-Daten.
      const inst = {};
      for (const [iid, i] of Object.entries(D.instrumente)) {
        if ((i.verlauf?.punkte || []).length > 10) { inst[iid] = i; echteKurse = true; continue; }
        const punkte = D.buchungen.filter((b) => b.instrument === iid && b.datum && +b.kurs > 0 && ["kauf", "verkauf", "einbuchung", "ausbuchung"].includes(b.typ))
          .map((b) => [ts0(b.datum), +b.kurs]);
        if (i.kurs != null && i.kursDatum) punkte.push([ts0(i.kursDatum), +i.kurs]);
        punkte.sort((x, y) => x[0] - y[0]);
        if (punkte.length) inst[iid] = { verlauf: { punkte }, faktorEUR: 1, ausBuchungen: true };
      }
      const bepreist = new Set(Object.keys(inst));
      const buch = D.buchungen.filter((b) => b.datum && (bepreist.has(b.instrument) || (mitGeld.has(b.konto || "") && (KONTO_TYPEN.has(b.typ) || b.typ === "dividende"))));
      if (bepreist.size) teile.push({ depot: id, mitGeld, buch, inst, bepreist });
    }
  } finally { D = vorher; }
  if (!teile.length) return null;
  const alleI = teile.flatMap((t) => [...t.bepreist].map((iid) => t.inst[iid]));
  let raster;
  if (echteKurse) raster = alleI.filter((i) => !i.ausBuchungen).reduce((a, i) => i.verlauf.punkte.length > a.length ? i.verlauf.punkte : a, []).map((p) => p[0]);
  else {
    // ohne Kurse: jeden Montag ab der ersten Buchung bis nach heute
    const erste = Math.min(...teile.flatMap((t) => t.buch.map((b) => ts0(b.datum))));
    const montag = (t) => t - ((new Date(t * 1000).getUTCDay() + 6) % 7) * 86400;
    raster = [];
    for (let t = montag(erste), ende = montag(ts0(heute())) + 7 * 86400; t <= ende; t += 7 * 86400) raster.push(t);
  }
  const tag = (ts) => new Date(ts * 1000).toISOString().slice(0, 10);
  const preis = (i, ts) => {
    let pr = null;
    for (const [t, c] of i.verlauf.punkte) { if (t <= ts + 3 * 86400) pr = c; else break; }
    return pr == null ? null : pr * (i.faktorEUR || 1);
  };
  const plus = (b) => b.typ === "kauf" || b.typ === "einbuchung", minus = (b) => b.typ === "verkauf" || b.typ === "ausbuchung";
  /** Wert und Fluss eines Depots in der Woche k. */
  const woche = (t, k) => {
    const ts = raster[k], d = tag(ts), von = k ? tag(raster[k - 1]) : "";
    const stueck = {};
    let v = 0, f = 0, geld = 0;
    for (const b of t.buch) {
      const imGeld = t.mitGeld.has(b.konto || "");
      if (b.datum <= d) {
        if (t.bepreist.has(b.instrument)) stueck[b.instrument] = (stueck[b.instrument] || 0) + (plus(b) ? +b.stueck || 0 : minus(b) ? -(+b.stueck || 0) : 0);
        if (imGeld) geld += kassenDelta(b);
      }
      if (!k || b.datum <= von || b.datum > d) continue;
      if (imGeld) {
        if (["einzahlung", "auszahlung", "karte"].includes(b.typ)) f += kassenDelta(b);
        else if ((b.typ === "einbuchung" && !b.ertrag) || b.typ === "ausbuchung")
          f += (plus(b) ? 1 : -1) * (+b.stueck || 0) * (preis(t.inst[b.instrument], ts) ?? 0);
      } else if (["kauf", "verkauf", "dividende"].includes(b.typ)) {
        f -= kassenDelta(b);          // ohne Kontodatei: echtes Geld der Ausfuehrung (nicht Wochenkurs)
      } else if ((b.typ === "einbuchung" && !b.ertrag) || b.typ === "ausbuchung") {
        f += (plus(b) ? 1 : -1) * (+b.stueck || 0) * (preis(t.inst[b.instrument], ts) ?? 0);
      }
    }
    for (const [iid, st] of Object.entries(stueck)) v += Math.max(0, st) * (preis(t.inst[iid], ts) ?? 0);
    return { v: v + (t.mitGeld.size ? geld : 0), f };
  };
  const proDepot = teile.map((t) => ({ depot: t.depot, w: raster.map((_, k) => woche(t, k)) }));
  const reihe = (wochen) => {
    const wert = [], index = [], einsatz = [];
    let idx = 100;
    wochen.forEach(({ v, f }, k) => {
      // Eingesetzt = Startwert + alles, was seitdem dazukam/wegging (netto)
      einsatz.push(k ? einsatz[k - 1] + f : v);
      // Dietz: Geld, das in der Woche kommt/geht, zaehlt halb im Nenner
      const nenner = k ? wert[k - 1] + f / 2 : 0;
      if (k && wert[k - 1] > 0 && nenner > 0) idx *= 1 + (v - wert[k - 1] - f) / nenner;
      wert.push(v); index.push(idx);
    });
    let spitze = -Infinity, dd = 0;
    for (const x of index) { spitze = Math.max(spitze, x); dd = Math.max(dd, (spitze - x) / spitze); }
    const mitWert = wert.map((x, k) => [x, k]).filter(([x]) => x > 0);
    const hoch = mitWert.reduce((a, b) => (!a || b[0] > a[0] ? b : a), null), tief = mitWert.reduce((a, b) => (!a || b[0] < a[0] ? b : a), null);
    const iHoch = Math.max(...index), iTief = Math.min(...index);
    return { wert, index, einsatz, rendite: index.at(-1) / 100 - 1, drawdown: dd,
             hoch: hoch && { wert: hoch[0], datum: tag(raster[hoch[1]]) }, tief: tief && { wert: tief[0], datum: tag(raster[tief[1]]) },
             indexHoch: iHoch, indexTief: iTief, abstandHoch: index.at(-1) / iHoch - 1 };
  };
  const summe = raster.map((_, k) => proDepot.reduce((a, p) => ({ v: a.v + p.w[k].v, f: a.f + p.w[k].f }), { v: 0, f: 0 }));
  return { raster, ausBuchungen: !echteKurse, depots: depotIds.filter((id) => proDepot.some((p) => p.depot === id))
             .map((id) => ({ id, name: S.depots[id].name, ...reihe(proDepot.find((p) => p.depot === id).w) })),
           gesamt: reihe(summe) };
}

/** KGV des Depots: gewichtetes harmonisches Mittel der Aktien mit positivem KGV. */
function depotKgv(liste) {
  const mit = liste.filter((p) => p.inst.termine?.kgv > 0);
  const w = mit.reduce((s, p) => s + p.wert, 0);
  if (!w) return null;
  const aktienWert = liste.filter((p) => (p.inst.art || "Aktie") === "Aktie").reduce((s, p) => s + p.wert, 0);
  return { kgv: w / mit.reduce((s, p) => s + p.wert / p.inst.termine.kgv, 0), abdeckung: aktienWert ? w / aktienWert * 100 : 0, n: mit.length };
}

const ZEITRAEUME = { "1w": ["1W", 1], "1m": ["1M", 4], "3m": ["3M", 13], "6m": ["6M", 26], "1j": ["1J", 52], "3j": ["3J", 156], "5j": ["5J", 260], alle: ["Alles", 0] };

/** Oben in der Uebersicht: Wert in Euro und was du eingesetzt hast, Zeitraum waehlbar. */
/** Ohne Kursverlauf (offline, vor dem ersten "Kurse laden"): eingesetztes Geld
 *  aus den Buchungen, Woche fuer Woche - gleiche Regeln wie im Wertverlauf. */
function einsatzVerlauf(depotIds) {
  const fluss = [];
  for (const id of depotIds) {
    const d = S.depots[id], mitGeld = new Set(d.buchungen.filter((b) => KONTO_TYPEN.has(b.typ)).map((b) => b.konto || ""));
    for (const b of d.buchungen) {
      if (!b.datum) continue;
      let f = 0;
      if (mitGeld.has(b.konto || "")) { if (["einzahlung", "auszahlung", "karte"].includes(b.typ)) f = kassenDelta(b); }
      else if (["kauf", "verkauf", "dividende"].includes(b.typ)) f = -kassenDelta(b);
      else if (b.typ === "einbuchung" && !b.ertrag) f = b.einstand != null ? +b.einstand : 0;
      if (f) fluss.push([b.datum, f]);
    }
  }
  if (!fluss.length) return null;
  fluss.sort((a, b) => a[0].localeCompare(b[0]));
  const tage = [], einsatz = [];
  let k = 0, summe = 0;
  for (let t = new Date(fluss[0][0] + "T12:00Z"); ; t = new Date(+t + 7 * 864e5)) {
    const iso = t.toISOString().slice(0, 10), ende = iso >= heute();
    const bis = ende ? "9999" : iso;
    while (k < fluss.length && fluss[k][0] <= bis) summe += fluss[k++][1];
    tage.push(iso); einsatz.push(summe);
    if (ende) break;
  }
  return { tage, einsatz };
}

/** Depot nur als Stichtag-Bestand (z. B. bestand.csv, Depotbestand): keine Historie.
 *  Mit Kursverlauf zeigen wir, wie sich der HEUTIGE Bestand entwickelt hat. */
function bestandVerlauf(depotIds) {
  const teile = [];
  const vorher = D;
  try {
    for (const id of depotIds) {
      D = S.depots[id];
      for (const p of positionen().liste) if ((p.inst.verlauf?.punkte || []).length > 10) teile.push(p);
    }
  } finally { D = vorher; }
  if (!teile.length) return null;
  const raster = teile.reduce((a, p) => p.inst.verlauf.punkte.length > a.length ? p.inst.verlauf.punkte : a, []).map((x) => x[0]);
  const wert = raster.map((ts) => teile.reduce((a, p) => {
    let pr = null;
    for (const [t, c] of p.inst.verlauf.punkte) { if (t <= ts + 3 * 86400) pr = c; else break; }
    return a + (pr == null ? 0 : p.stueck * pr * (p.inst.faktorEUR || 1));
  }, 0));
  return { raster, wert, n: teile.length };
}

function stichtagChart(depotIds) {
  const b = bestandVerlauf(depotIds);
  if (!b || b.wert.filter((x) => x > 0).length < 3) return "";
  const ab = b.wert.findIndex((x) => x > 0), w = b.wert.slice(ab), B = 300, H = 90;
  const min = Math.min(...w), max = Math.max(...w), sp = max - min || 1;
  const pkt = w.map((x, k) => `${(k / (w.length - 1) * B).toFixed(1)},${(H - 4 - (x - min) / sp * (H - 8)).toFixed(1)}`).join(" ");
  const veraenderung = (w.at(-1) / w[0] - 1) * 100;
  return `
    <div class="wertchart">
      <svg viewBox="0 0 ${B} ${H}" width="100%" height="120" preserveAspectRatio="none" aria-label="Verlauf des heutigen Bestands">
        <polygon points="0,${H} ${pkt} ${B},${H}" fill="var(--akzent)" fill-opacity=".14"/>
        <polyline points="${pkt}" fill="none" stroke="var(--akzent)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="kennzahlen">
        <div><small>${datum(new Date(b.raster[ab] * 1000).toISOString())}</small><b>${eur(w[0], true)}</b></div>
        <div><small>heute</small><b>${eur(w.at(-1), true)}</b></div>
        <div><small>Veränderung</small><b class="${vz(veraenderung)}-t">${pct(veraenderung)}</b></div>
      </div>
      <p class="klein" style="margin:4px 0 0">So hätte sich dein <b>heutiger Bestand</b> entwickelt (${b.n} Werte mit Kursverlauf). Frühere Käufe und Verkäufe kennt die App nicht – dafür die Transaktionen des Brokers importieren.</p>
    </div>`;
}

/** Letzte Stufe: keine Historie, keine Kurse - Einstand -> Wert heute als einfache Linie. */
function einfachChart(depotIds) {
  const w = depotIds.map(depotWerte), jetzt = w.reduce((a, x) => a + x.gesamt, 0), ein = w.reduce((a, x) => a + x.einstand + x.cash, 0);
  if (!jetzt && !ein) return "";
  const B = 300, H = 90, min = Math.min(jetzt, ein), max = Math.max(jetzt, ein), sp = max - min || 1;
  const y = (x) => (H - 4 - (x - min) / sp * (H - 8)).toFixed(1), g = jetzt - ein;
  return `
    <div class="wertchart">
      <svg viewBox="0 0 ${B} ${H}" width="100%" height="120" preserveAspectRatio="none" aria-label="Einstand und Wert heute">
        <polygon points="0,${H} 0,${y(ein)} ${B},${y(jetzt)} ${B},${H}" fill="var(--akzent)" fill-opacity=".14"/>
        <polyline points="0,${y(ein)} ${B},${y(jetzt)}" fill="none" stroke="var(--akzent)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="kennzahlen">
        <div><small>Einstand + Cash</small><b>${eur(ein, true)}</b></div>
        <div><small>heute</small><b>${eur(jetzt, true)}</b></div>
        <div><small>Gewinn</small><b class="${vz(g)}-t">${eurVz0(g)}</b><small>${pct(ein ? g / ein * 100 : null)}</small></div>
      </div>
      <p class="klein" style="margin:4px 0 0">Noch keine Historie – nur Einstand und heutiger Wert. Den Verlauf bringen Transaktionen des Brokers oder ⚙️ → Import → „Kurse &amp; Daten aktualisieren“.</p>
    </div>`;
}

/** Vorgabe 08.11.: Der Chart muss IMMER kommen, sobald es Buchungen gibt. Rangfolge:
 *  1. echter Verlauf (mind. 3 Wochen), 2. Verlauf des heutigen Bestands (Kurse da),
 *  3. eingesetztes Geld laut Buchungen, 4. Einstand -> heute. */
function wertChart(v, depotIds) {
  const ids = depotIds || [];
  if (v) {
    const r = v.gesamt, erster = r.wert.findIndex((x, k) => x !== 0 || r.einsatz[k] !== 0);
    if (erster < 0 || r.wert.length - erster < 3) return stichtagChart(ids) || einsatzChart(ids) || einfachChart(ids);
    return verlaufWertChart(v, erster);
  }
  return stichtagChart(ids) || einsatzChart(ids) || einfachChart(ids);
}

function einsatzChart(depotIds) {
  {
    const e = einsatzVerlauf(depotIds || []);
    if (!e || e.einsatz.length < 3) return "";
    const B = 300, H = 90, max = Math.max(...e.einsatz, 1), min = Math.min(0, ...e.einsatz);
    const pkt = e.einsatz.map((x, k) => `${(k / (e.einsatz.length - 1) * B).toFixed(1)},${(H - 4 - (x - min) / (max - min || 1) * (H - 8)).toFixed(1)}`).join(" ");
    const jetzt = depotIds.reduce((a, id) => a + depotWerte(id).gesamt, 0), gewinn = jetzt - e.einsatz.at(-1);
    return `
    <div class="wertchart">
      <svg viewBox="0 0 ${B} ${H}" width="100%" height="110" preserveAspectRatio="none" aria-label="Eingesetztes Geld">
        <polygon points="0,${H} ${pkt} ${B},${H}" fill="var(--leise)" fill-opacity=".12"/>
        <polyline points="${pkt}" fill="none" stroke="var(--akzent)" stroke-width="2" vector-effect="non-scaling-stroke"/>
      </svg>
      <div class="kennzahlen">
        <div><small>Eingesetzt</small><b>${eur(e.einsatz.at(-1), true)}</b><small>seit ${datum(e.tage[0])}</small></div>
        <div><small>Wert heute</small><b>${eur(jetzt, true)}</b></div>
        <div><small>Gewinn</small><b class="${vz(gewinn)}-t">${eurVz0(gewinn)}</b><small>${pct(e.einsatz.at(-1) ? gewinn / e.einsatz.at(-1) * 100 : null)}</small></div>
      </div>
      <p class="klein" style="margin:4px 0 0">Eingesetztes Geld laut deinen Buchungen. Den Wertverlauf zeigt der Chart, sobald Kurse da sind: ⚙️ → Import → „Kurse &amp; Daten aktualisieren“ (Internet) oder eine Kursliste.</p>
    </div>`;
  }
}

function verlaufWertChart(v, ersterIndex) {
  const r = v.gesamt, n = r.wert.length, z = ui.wertZeitraum || "alle";
  // Zeitraum in Wochen (Wochenwerte: 1W = Anfang und Ende der letzten Woche)
  const erster = ersterIndex;
  const ab = z === "alle" ? erster : Math.max(erster, n - 1 - ZEITRAEUME[z][1]);
  const w = r.wert.slice(ab), B = 300, H = 90;
  if (w.length < 2) return "";
  const einzeln = ui.chartArt === "einzeln" && v.depots.length > 1;
  // Einzeln: jedes Depot als eigene Linie in %, Start des Zeitraums = 0 % (vergleichbar trotz verschiedener Groesse)
  const linien = einzeln ? v.depots.map((d, i) => ({ name: d.name, farbe: FARBEN[i % FARBEN.length],
    werte: d.index.slice(ab).map((x) => d.index[ab] ? (x / d.index[ab] - 1) * 100 : 0) })) : [];
  const alleWerte = einzeln ? linien.flatMap((l) => l.werte) : w;
  const min = Math.min(...alleWerte), max = Math.max(...alleWerte), sp = max - min || 1;
  const pkt = (l) => l.map((x, k) => `${(k / (l.length - 1) * B).toFixed(1)},${(H - 4 - (x - min) / sp * (H - 8)).toFixed(1)}`).join(" ");
  const e = r.einsatz.slice(ab);
  const gewinn = (w.at(-1) - w[0]) - (e.at(-1) - e[0]), rendite = (r.index.at(-1) / r.index[ab] - 1) * 100;
  const gesamtGewinn = r.wert.at(-1) - r.einsatz.at(-1);
  return `
    <div class="wertchart">
      ${v.depots.length > 1 ? `<div class="reiter" style="margin:0 0 6px">
        <button data-chartart="gesamt" class="${einzeln ? "" : "aktiv"}">Gesamt</button>
        <button data-chartart="einzeln" class="${einzeln ? "aktiv" : ""}">Depots einzeln</button></div>` : ""}
      <svg viewBox="0 0 ${B} ${H}" width="100%" height="120" preserveAspectRatio="none" aria-label="${einzeln ? "Depots einzeln in Prozent" : "Gesamtwert"}">
        ${einzeln ? (min < 0 && max > 0 ? `<line x1="0" x2="${B}" y1="${(H - 4 - (0 - min) / sp * (H - 8)).toFixed(1)}" y2="${(H - 4 - (0 - min) / sp * (H - 8)).toFixed(1)}" stroke="var(--linie)" vector-effect="non-scaling-stroke"/>` : "")
          + linien.map((l) => `<polyline points="${pkt(l.werte)}" fill="none" stroke="${l.farbe}" stroke-width="1.6" vector-effect="non-scaling-stroke"/>`).join("")
        : `<polygon points="0,${H} ${pkt(w)} ${B},${H}" fill="var(--akzent)" fill-opacity=".14"/>
        <polyline points="${pkt(w)}" fill="none" stroke="var(--akzent)" stroke-width="2" vector-effect="non-scaling-stroke"/>`}
      </svg>
      ${einzeln ? `<div class="legende">${linien.map((l) => `<span><i style="background:${l.farbe}"></i>${esc(l.name)} <b class="${vz(l.werte.at(-1))}-t">${pct(l.werte.at(-1))}</b></span>`).join("")}</div>` : ""}
      <div class="reiter zeitraum" style="margin:4px 0 0">${Object.entries(ZEITRAEUME).map(([k, [t]]) =>
        `<button data-wertzeitraum="${k}" class="${z === k ? "aktiv" : ""}">${t}</button>`).join("")}</div>
      <div class="kennzahlen">
        <div><small>Eingesetzt</small><b>${eur(r.einsatz.at(-1), true)}</b></div>
        <div><small>Gewinn gesamt</small><b class="${vz(gesamtGewinn)}-t">${eurVz0(gesamtGewinn)}</b><small>${pct(r.einsatz.at(-1) ? gesamtGewinn / r.einsatz.at(-1) * 100 : null)}</small></div>
        <div><small>Im Zeitraum</small><b class="${vz(gewinn)}-t">${eurVz0(gewinn)}</b><small>${pct(rendite)}</small></div>
      </div>
      <p class="klein" style="margin:4px 0 0">${einzeln ? "Jedes Depot in % seit Beginn des Zeitraums (Ein-/Auszahlungen herausgerechnet)." : "Gesamtwert aller Depots (ohne Sachwerte)."}${v.ausBuchungen ? " Offline aus deinen Kauf-/Verkaufskursen." : ""}</p>
    </div>`;
}

function verlaufChart(v, nurTabelle = false) {
  if (!v) return `<section class="karte"><p class="klein" style="margin:0">Noch kein Verlauf. Dafür einmal ⚙️ → Import → „Kurse &amp; Daten aktualisieren“.</p></section>`;
  const reihen = [...(v.depots.length > 1 ? v.depots : []), { name: "Gesamt", ...v.gesamt, gesamt: true }];
  const alle = reihen.flatMap((r) => r.index).filter(isFinite);
  const min = Math.min(...alle), max = Math.max(...alle), sp = max - min || 1, B = 300, H = 120;
  const y = (x) => (H - 6 - (x - min) / sp * (H - 12)).toFixed(1);
  const linie = (r, i) => `<polyline fill="none" stroke="${r.gesamt ? "var(--text)" : FARBEN[i % FARBEN.length]}" stroke-width="${r.gesamt ? 2 : 1.4}"
    ${r.gesamt ? "" : 'stroke-opacity=".85"'} vector-effect="non-scaling-stroke" points="${r.index.map((x, k) => `${(k / (r.index.length - 1) * B).toFixed(1)},${y(x)}`).join(" ")}"/>`;
  const null100 = 100 >= min && 100 <= max ? `<line x1="0" x2="${B}" y1="${y(100)}" y2="${y(100)}" stroke="var(--linie)" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/>` : "";
  const monat = (ts) => new Date(ts * 1000).toLocaleDateString(LOC_DATUM(), { month: "short", year: "2-digit" });
  const von = monat(v.raster[0]), jahre = (v.raster.at(-1) - v.raster[0]) / (365.25 * 86400);
  const zeitraum = jahre > 1.2 ? `${fZahl.format(Math.round(jahre * 10) / 10)} Jahre` : "1 Jahr";
  const g = v.gesamt;
  return `
    <section class="karte">
      ${nurTabelle ? "" : `<svg viewBox="0 0 ${B} ${H}" width="100%" height="160" preserveAspectRatio="none" aria-label="Wertentwicklung">${null100}${reihen.map(linie).join("")}</svg>
      <div class="klein" style="display:flex;justify-content:space-between"><span>${von}</span><span>heute · Start = 100</span></div>`}
      <table class="tabelle" style="margin-top:8px">
        <tr><td><b>Depot</b></td><td><b>${zeitraum}</b></td><td><b>max. Drawdown</b></td></tr>
        ${reihen.map((r, i) => `<tr><td><i style="display:inline-block;width:10px;height:3px;vertical-align:middle;margin-right:6px;background:${r.gesamt ? "var(--text)" : FARBEN[i % FARBEN.length]}"></i>${esc(r.name)}</td>
          <td class="${vz(r.rendite)}-t">${pct(r.rendite * 100)}</td><td class="minus-t">${r.drawdown ? "−" + ant(r.drawdown * 100) : "0,00 %"}</td></tr>`).join("")}
      </table>
      ${g.hoch ? `<div class="kennzahlen" style="margin-top:10px">
        <div><small>Hoch (Wert)</small><b>${eur(g.hoch.wert, true)}</b><small>${datum(g.hoch.datum)}</small></div>
        <div><small>Tief (Wert)</small><b>${eur(g.tief.wert, true)}</b><small>${datum(g.tief.datum)}</small></div>
        <div><small>Abstand zum Hoch</small><b class="${g.abstandHoch < -0.0001 ? "minus" : "plus"}-t">${pct(g.abstandHoch * 100)}</b><small>Index ${fPct.format(g.indexTief)}–${fPct.format(g.indexHoch)}</small></div>
      </div>` : ""}
      <p class="klein">Start = 100. Ein- und Auszahlungen sind herausgerechnet, nur die Entwicklung zählt.</p>
    </section>`;
}

// ------------------------------------------------------------ Heatmap
function heatmapFarbe(p) {
  if (p == null) return "var(--karte-2)";
  const a = Math.min(1, Math.abs(p) / 30) * 0.85 + 0.15;
  return p >= 0 ? `color-mix(in srgb, var(--plus) ${Math.round(a * 100)}%, var(--karte-2))`
                : `color-mix(in srgb, var(--minus) ${Math.round(a * 100)}%, var(--karte-2))`;
}

/** Heatmap als Raster (Vorgabe 07.11.: bei grossen Depots keine Mini-Kacheln):
 *  feste Kacheln, 4 je Zeile (schmal 3), nach Wert sortiert, Farbe = seit Kauf.
 *  Cash ist eine eigene graue Kachel; Anteile beziehen sich aufs Gesamtvermoegen. */
function heatmap(liste, summe) {
  if (!liste.length) return "";
  const c = cash(), gesamt = summe + (c && c.betrag > 0 ? c.betrag : 0);
  const kacheln = [...liste].sort((a, b) => b.wert - a.wert).map((p) => `
    <button class="kachel" data-position="${esc(p.id)}" style="background:${heatmapFarbe(p.ohneKurs ? null : p.gvPct)}">
      <b>${esc(p.name)}</b><span class="gross">${p.ohneKurs ? "kein Kurs" : pct(p.gvPct)}</span>
      <span>${ant(p.wert / gesamt * 100)}</span></button>`);
  if (c && c.betrag > 0) kacheln.push(`
    <div class="kachel kachel-cash"><b>Cash</b><span class="gross">${ant(c.betrag / gesamt * 100)}</span><span>${eur(c.betrag, true)}</span></div>`);
  const sortiert = [...liste].filter((p) => !p.ohneKurs).sort((a, b) => (b.gvPct ?? 0) - (a.gvPct ?? 0));
  return `
    <p class="klein" style="margin:0 2px 8px">Farbe = seit Kauf (grün plus, rot minus) · untere Zahl = Anteil am Gesamtvermögen${c ? " inkl. Cash" : ""}</p>
    <div class="heatraster">${kacheln.join("")}</div>
    ${sortiert.length > 1 ? `
    <h2>Seit Kauf</h2>
    <section class="karte">
      <table class="tabelle">${sortiert.map((p) => `<tr><td>${esc(p.name)}</td>
        <td class="${vz(p.gvPct)}-t">${pct(p.gvPct)}</td><td class="${vz(p.gv)}-t">${eurVz(p.gv)}</td></tr>`).join("")}</table>
    </section>` : ""}`;
}

// ------------------------------------------------------------ Streuung
/** Kennzahlen zur Klumpenbildung. Grenzen wie in den Depot-Regeln:
 *  Einzelwert 15 %, Branche 25 %, Krypto 20 %. */
function streuung(liste, summe) {
  if (!liste.length || !summe) return null;
  const w = liste.map((p) => p.wert / summe).sort((a, b) => b - a);
  const branche = gruppieren(liste, summe, "branche")[0];
  const art = Object.fromEntries(gruppieren(liste, summe, "art").map((x) => [x.name, x.anteil]));
  const groesste = liste.reduce((a, p) => p.wert > a.wert ? p : a);
  const k = {
    anzahl: liste.length, groesste: w[0] * 100, groessteName: groesste.name,
    top3: w.slice(0, 3).reduce((s, x) => s + x, 0) * 100,
    effektiv: 1 / w.reduce((s, x) => s + x * x, 0),
    branche, krypto: art.Krypto || 0, etf: (art.ETF || 0) + (art.ETC || 0) + (art.Fonds || 0),
  };
  k.warnungen = [
    k.groesste > 15 && `Größte Position ${groesste.name}: ${ant(k.groesste)} (über 15 %)`,
    branche && branche.name !== "ohne Zuordnung" && branche.anteil > 25 && `Branche ${branche.name}: ${ant(branche.anteil)} (über 25 %)`,
    k.krypto > 20 && `Krypto: ${ant(k.krypto)} (über 20 %)`,
    k.anzahl >= 3 && k.effektiv < k.anzahl / 2 && `Gestreut wie nur ${fPct.format(k.effektiv)} gleich große Positionen`,
  ].filter(Boolean);
  return k;
}

function streuungKarte(liste, summe) {
  const k = streuung(liste, summe);
  if (!k) return "";
  return `
    <h2>Streuung &amp; Klumpen</h2>
    <section class="karte">
      <div class="kennzahlen" style="margin-top:0">
        <div><small>Positionen</small><b>${k.anzahl}</b></div>
        <div><small>Effektiv gestreut</small><b>${fPct.format(k.effektiv)}</b></div>
        <div><small>Top 3</small><b>${ant(k.top3)}</b></div>
        <div><small>Größte</small><b>${ant(k.groesste)}</b></div>
        <div><small>ETF/Fonds</small><b>${ant(k.etf)}</b></div>
        <div><small>Krypto</small><b>${ant(k.krypto)}</b></div>
        ${(() => { const g = depotKgv(liste); return g ? `<div><small>KGV (Aktien)</small><b>${fPct.format(g.kgv)}</b></div>` : ""; })()}
      </div>
      ${k.warnungen.length ? `<ul class="klein" style="margin:12px 0 0;padding-left:18px">${k.warnungen.map((x) => `<li class="warn-t">${esc(x)}</li>`).join("")}</ul>`
        : `<p class="klein">Keine Klumpen über den Grenzen (Einzelwert 15 %, Branche 25 %, Krypto 20 %).</p>`}
      <p class="klein">„Effektiv gestreut“: so viele gleich große Positionen würden dasselbe Risiko streuen.</p>
    </section>`;
}

/** Erinnerung, wenn die letzte Sicherung fehlt oder aelter als 14 Tage ist. */
function sicherungsHinweis() {
  if (!APP || !D.buchungen.length) return "";
  const st = sicherheitStatus();
  if (st.letzte && Date.now() - st.letzte < 14 * 864e5) return "";
  return `<button class="knopf" data-ziel="sicherheit" style="width:100%;margin-top:10px;border-color:var(--warn)">⚠️ ${st.letzte ? "Letzte Sicherung ist über 14 Tage alt" : "Noch keine Sicherung"} – jetzt einrichten</button>`;
}

/** Wie alt sind die Kurse? Wichtig offline (Bahn, Funkloch): man sieht den
 *  gespeicherten Stand und weiss, von wann er ist. */
function standText() {
  const a = S.einstellungen?.letzterAbruf;
  if (!a) return "Kurse: noch nie aus dem Internet geladen – Werte aus den Importen.";
  const d = new Date(a), stunden = (Date.now() - d) / 36e5;
  const alt = stunden < 1 ? "vor weniger als 1 Stunde" : stunden < 48 ? `vor ${Math.round(stunden)} Std.` : `vor ${Math.round(stunden / 24)} Tagen`;
  return `Kurse vom ${d.toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })} (${alt}) · gespeichert, auch offline sichtbar`;
}

/** Positionen je Instrument (Konten zusammengefasst), mit Wert und Gewicht. */
function positionen() {
  const je = {};
  for (const p of Object.values(bestand())) {
    const z = je[p.instrument] ??= { id: p.instrument, stueck: 0, einstand: 0, realisiert: 0, dividenden: 0, konten: [] };
    z.stueck += p.stueck; z.einstand += p.einstand; z.realisiert += p.realisiert; z.dividenden += p.dividenden;
    if (p.stueck > 0) z.konten.push(p.konto);
  }
  // Offline ohne Kurs: letzter eigener Kauf-/Verkaufskurs (wie im Chart), sonst Einstand
  const letzter = {};
  for (const b of D.buchungen) if (+b.kurs > 0 && ["kauf", "verkauf"].includes(b.typ) && (!letzter[b.instrument] || b.datum >= letzter[b.instrument][0])) letzter[b.instrument] = [b.datum, +b.kurs];
  const liste = Object.values(je).filter((z) => z.stueck > 1e-9).map((z) => {
    const i = D.instrumente[z.id] || {};
    const lk = i.kurs == null ? letzter[z.id] : null;
    const wert = i.kurs != null ? z.stueck * i.kurs : lk ? z.stueck * lk[1] : z.einstand;
    return { ...z, inst: i, name: i.name || z.id, wert, ohneKurs: i.kurs == null && !lk, kursAusBuchung: lk ? lk[0] : null,
             gv: wert - z.einstand, gvPct: z.einstand ? (wert / z.einstand - 1) * 100 : null };
  });
  const summe = liste.reduce((s, p) => s + p.wert, 0);
  for (const p of liste) {
    p.gewicht = summe ? p.wert / summe * 100 : 0;
    p.ziel = p.inst.ziel != null && p.inst.ziel !== "" ? +p.inst.ziel : null;
    p.abweichung = p.ziel != null ? p.gewicht - p.ziel : null;
  }
  return { liste, summe };
}

/** Guthaben des offenen Depots: aus importierten Kontobewegungen, sonst von
 *  Hand eingetragen (Depot-Einstellungen), sonst keins. */
function cash() {
  const k = kontoStand();
  if (k) return { betrag: k.stand, quelle: "aus Kontobewegungen" };
  if (D.cash != null && D.cash !== "") return { betrag: +D.cash, quelle: "von Hand" };
  return null;
}

/** Vermoegen nach Anlageart inklusive Cash - Anteil am Gesamtvermoegen. */
function vermoegen(liste, summe) {
  const c = cash();
  const gesamt = summe + (c ? c.betrag : 0);
  const teile = gruppieren(liste, gesamt, "art");
  if (c && c.betrag > 0) teile.push({ name: "Cash", wert: c.betrag, anteil: gesamt ? c.betrag / gesamt * 100 : 0 });
  return { gesamt, cash: c, teile: teile.sort((a, b) => b.wert - a.wert) };
}

function gruppieren(liste, summe, feld) {
  const g = {};
  for (const p of liste) {
    const k = feld === "position" ? p.name : feld === "konto" ? (p.konten.join(", ") || "–")
            : (p.inst[feld] || "ohne Zuordnung");
    g[k] = (g[k] || 0) + p.wert;
  }
  return Object.entries(g).sort((a, b) => b[1] - a[1])
    .map(([name, wert]) => ({ name, wert, anteil: summe ? wert / summe * 100 : 0 }));
}

// ------------------------------------------------------------ Formatieren
// Anzeige je Sprache (ab 0.46): Deutsch 1.234,56 €, Englisch 1,234.56 € (Euro-Zeichen bleibt hinten, damit die
// Uebersetzungs-Vorlagen "# €" passen). NUR Anzeige - Eingabefelder und Dateien lesen weiter mit zahl()/zahlPunkt().
const LOC = () => (typeof sprache === "function" && sprache() === "en") ? "en-US" : "de-DE";
const fmtCache = {};
const fmt = (opt) => { const k = LOC() + JSON.stringify(opt); return fmtCache[k] ??= new Intl.NumberFormat(LOC(), opt); };
const EUR_DE = (opt) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", ...opt });
const fEur = { format: (x) => LOC() === "de-DE" ? (fmtCache.eur ??= EUR_DE({})).format(x) : fmt({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) + "\u00a0€" };
const fEur0 = { format: (x) => LOC() === "de-DE" ? (fmtCache.eur0 ??= EUR_DE({ maximumFractionDigits: 0 })).format(x) : fmt({ maximumFractionDigits: 0 }).format(x) + "\u00a0€" };
const fZahl = { format: (x) => fmt({ maximumFractionDigits: 6 }).format(x) };
const fPct = { format: (x) => fmt({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(x) };
/** Datum/Zeit in der Sprache der Oberflaeche (Englisch: 15/11/2026). */
const LOC_DATUM = () => LOC() === "en-US" ? "en-GB" : "de-DE";
const ZU = "••••• €";
const eur = (x, ganz) => ui.verdeckt ? ZU : x == null || isNaN(x) ? "–" : (ganz ? fEur0 : fEur).format(x);
const eurVz0 = (x) => ui.verdeckt ? ZU : x == null ? "–" : (x > 0 ? "+" : "") + fEur0.format(x);
const eurVz = (x) => ui.verdeckt ? ZU : x == null ? "–" : (x > 0 ? "+" : "") + fEur.format(x);
const stk = (x) => ui.verdeckt ? "•••" : x == null ? "–" : fZahl.format(x);
/** Verstecken (Auge): Betraege + Stueckzahlen immer; Kurse je Stueck und Prozente nach Einstellung. */
const verstecktAuch = (was) => ui.verdeckt && (EIN().verstecken || "betraege") !== "betraege" &&
  (was === "kurse" || EIN().verstecken === "alles");
const pct = (x) => verstecktAuch("prozente") ? "•• %" : x == null ? "–" : Math.abs(x) < 0.005 ? fPct.format(0) + " %" : (x > 0 ? "+" : "") + fPct.format(x) + " %";
const ant = (x) => verstecktAuch("prozente") ? "•• %" : x == null ? "–" : fPct.format(x) + " %";
/** Kurs je Stueck (Ø Kaufkurs, aktueller Kurs) - verraet keine Positionsgroesse. */
const kursE = (x) => verstecktAuch("kurse") ? ZU : x == null || isNaN(x) ? "–" : fEur.format(x);
const EIN = () => S.einstellungen || {};
const vz = (x) => x > 0 ? "plus" : x < 0 ? "minus" : "";
/** "11.05." - Tag und Monat immer zweistellig (vorher abgeschnitten: "11.5.2"). */
const kurzDatum = (iso) => iso ? iso.slice(8, 10) + "." + iso.slice(5, 7) + "." : "–";
const datum = (iso) => iso ? new Date(iso.slice(0, 10) + "T12:00").toLocaleDateString(LOC_DATUM(), { day: "2-digit", month: "2-digit", year: "numeric" }) : "–";
/** "1 Position", "2 Positionen" */
const anzahl = (n, eins, viele) => `${n} ${n === 1 ? eins : viele}`;
const heute = () => new Date().toISOString().slice(0, 10);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const kuerzel = (n) => String(n).replace(/[.,]/g, " ").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

function meldung(text) {
  // 0.59: Fehler-Meldungen ins Fehlerprotokoll (Zahlen maskiert - keine Betraege im Protokoll)
  if (typeof protokoll === "function" && /fehlgeschlagen|nicht |konnte|Fehler|ungültig|abgelehnt|ging nicht/i.test(String(text))) protokoll("Meldung", String(text).replace(/\d[\d.,]*/g, "#"));
  const m = document.getElementById("meldung");
  m.innerHTML = `<span>${esc(tr(text))}</span>`;
  clearTimeout(meldung.t);
  meldung.t = setTimeout(() => (m.innerHTML = ""), 3200);
}

/** Deutsche und englische Zahlen: "4.448,68", "1.076", "31,776", "5164.76". */
/** Fuer Dateien, die Zahlen mit Punkt schreiben (TR, Kraken): "0.0125" bleibt 0,0125.
 *  Hat Excel umgespeichert ("0,0125", "1.234,50"), gilt die deutsche Lesart. */
function zahlPunkt(s) {
  const t = String(s ?? "").trim();
  if (t === "") return null;
  if (t.includes(",")) return zahl(t);
  const n = parseFloat(t);
  return isNaN(n) ? null : n;
}

function zahl(s) {
  if (s == null) return null;
  s = String(s).trim().replace(/[€\s"]/g, "");
  if (!s) return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, "");
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ------------------------------------------------------------ Seiten
// Familie/Haushalt (Vorgabe 08.11.): jedes Depot gehoert einer Person; "Ich" = ohne Angabe.
const personVon = (d) => (d.person || "").trim() || "Ich";
const personen = () => [...new Set(Object.values(S.depots).map(personVon))];
/** Depots der gewaehlten Person (oder alle im Haushalt). */
const sichtDepots = () => Object.keys(S.depots).filter((id) => !ui.person || personVon(S.depots[id]) === ui.person);
/** Zaehlen zum Vermoegen: nicht "beobachtet", gefiltert nach Person. */
const eigeneDepots = () => sichtDepots().filter((id) => S.depots[id].rolle !== "beobachtet");
/** Gesamtansicht nur, wenn es mehr als ein Depot gibt (Vorgabe 07.11.: Uebersicht = alles zusammen). */
const gesamtAnsicht = () => ui.alle !== false && sichtDepots().length > 1;

/** Reiter oben in der Uebersicht: Alle · Depot 1 · Depot 2 ... */
function depotReiter() {
  const pers = personen();
  const personZeile = pers.length > 1 ? `<div class="reiter personreiter" style="margin:8px 0 0">
    <button data-person="" class="${!ui.person ? "aktiv" : ""}">👪 Haushalt</button>
    ${pers.map((n) => `<button data-person="${esc(n)}" class="${ui.person === n ? "aktiv" : ""}">${esc(n)}</button>`).join("")}</div>` : "";
  if (sichtDepots().length < 2) return personZeile;
  const alle = gesamtAnsicht();
  return `${personZeile}<div class="reiter depotreiter" style="margin:8px 0 4px">
    <button data-ansicht="alle" class="${alle ? "aktiv" : ""}">Alle${ui.person ? " " + esc(ui.person) : ""}</button>
    ${Object.entries(S.depots).filter(([id]) => sichtDepots().includes(id)).map(([id, d]) => `<button data-ansicht="${esc(id)}" class="${!alle && id === S.aktiv ? "aktiv" : ""}">${esc(d.name)}${d.rolle === "beobachtet" ? " 👁" : ""}</button>`).join("")}
  </div>`;
}

/** Alle eigenen Depots zusammengefuehrt: Positionen ueber die ISIN zusammengelegt. */
// ------------------------------------------------------------ Sicht-Leiste (11.11.): Depot/Person auf jeder Seite wechseln,
// mit ‹ › oder Wischen. Reihenfolge: Haushalt (alle) → je Person: alle Depots der Person → einzelne Depots.
function sichten() {
  const l = [], pers = personen(), alleIds = Object.keys(S.depots);
  const depotsVon = (p) => alleIds.filter((id) => !p || personVon(S.depots[id]) === p);
  const dazu = (p) => { const ids = depotsVon(p); if (ids.length > 1) l.push({ person: p, alle: true }); for (const id of ids) l.push({ person: p, id }); };
  if (pers.length > 1) { if (alleIds.length > 1) l.push({ person: null, alle: true }); for (const p of pers) dazu(p); }
  else dazu(null);
  return l;
}
function sichtIndex(l = sichten()) {
  const g = gesamtAnsicht(), p = ui.person || null;
  const i = l.findIndex((s) => (s.person || null) === p && (s.alle ? g : !g && s.id === S.aktiv));
  return i >= 0 ? i : Math.max(0, l.findIndex((s) => s.id === S.aktiv));
}
function sichtName(s) {
  if (!s) return "";
  const mehr = personen().length > 1;
  if (s.alle) return s.person ? "Alle von " + s.person : mehr ? "👪 Haushalt" : "Alle Depots";
  const d = S.depots[s.id];
  return (d ? d.name + (d.rolle === "beobachtet" ? " 👁" : "") : "") + (mehr && s.person ? " · " + s.person : "");
}
function sichtSetzen(s) {
  if (!s) return;
  ui.person = s.person || null;
  if (s.alle) { ui.alle = true; ui.kalenderAlle = true; }
  else { ui.alle = false; ui.kalenderAlle = false; oeffnen(s.id); }
  ui.depotEdit = null; ui.kiAntwort = null;
  sichern(); zeichnen();
}
function sichtLeiste() {
  const l = sichten();
  if (l.length < 2) return "";
  const i = sichtIndex(l);
  return `<div class="sichtleiste">
    <button data-sicht="-1" aria-label="Vorherige Ansicht">‹</button>
    <button data-sicht-wahl class="mitte"><b>${esc(sichtName(l[i]))}</b><small>${i + 1} / ${l.length} · wischen oder antippen</small></button>
    <button data-sicht="1" aria-label="Nächste Ansicht">›</button></div>
    ${ui.sichtWahl ? `<div class="reiter sichtwahl">${l.map((s, j) => `<button data-sicht-nr="${j}" class="${j === i ? "aktiv" : ""}">${esc(sichtName(s))}</button>`).join("")}</div>` : ""}`;
}
const SICHT_SEITEN = new Set(["uebersicht", "positionen", "kalender", "ki"]);
let wischStart = null;
document.addEventListener("touchstart", (e) => {
  const t0 = e.touches[0];
  wischStart = e.touches.length === 1 && SICHT_SEITEN.has(ui.seite) && !ui.detail && !ui.formular && !ui.vorschau &&
    !e.target.closest("input,select,textarea,.reiter,.wertchart,svg,.heatmap,[data-kein-wischen]") ? { x: t0.clientX, y: t0.clientY, t: Date.now() } : null;
}, { passive: true });
document.addEventListener("touchend", (e) => {
  if (!wischStart) return;
  const t1 = e.changedTouches[0], dx = t1.clientX - wischStart.x, dy = t1.clientY - wischStart.y, dt = Date.now() - wischStart.t;
  wischStart = null;
  if (Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6 || dt > 700) return;
  const l = sichten();
  if (l.length < 2) return;
  const i = (sichtIndex(l) + (dx < 0 ? 1 : -1) + l.length) % l.length;
  sichtSetzen(l[i]); meldung(sichtName(l[i]));
}, { passive: true });

function gesamtDaten() {
  const ids = eigeneDepots(), je = {}, proDepot = [], ueber = [], vorher = D;
  let cashSumme = 0, real = 0, div = 0;
  try {
    for (const id of ids) {
      D = S.depots[id];
      const { liste, summe } = positionen(), c = cash();
      const b = Object.values(bestand());
      real += b.reduce((a, x) => a + x.realisiert, 0); div += b.reduce((a, x) => a + x.dividenden, 0);
      for (const x of b.filter((y) => y.ueber)) ueber.push(`${(D.instrumente[x.instrument] || {}).name || x.instrument} (${D.name})`);
      cashSumme += c ? c.betrag : 0;
      proDepot.push({ id, name: D.name, wert: summe + (c ? c.betrag : 0), summe, einstand: liste.reduce((a, x) => a + x.einstand, 0) });
      for (const x of liste) {
        const z = je[x.id] ??= { ...x, wert: 0, einstand: 0, stueck: 0, konten: [] };
        z.wert += x.wert; z.einstand += x.einstand; z.stueck += x.stueck; z.konten.push(D.name);
      }
    }
  } finally { D = vorher; }
  const liste = Object.values(je), summe = liste.reduce((a, x) => a + x.wert, 0);
  for (const x of liste) { x.gewicht = summe ? x.wert / summe * 100 : 0; x.gv = x.wert - x.einstand; x.gvPct = x.einstand ? (x.wert / x.einstand - 1) * 100 : null; }
  const sach = !ui.person && typeof sachwerteSumme === "function" ? sachwerteSumme() : 0;   // Sachwerte = Haushalt
  return { ids, liste, summe, cash: cashSumme, sach, real, div, proDepot, ueber, einstand: liste.reduce((a, x) => a + x.einstand, 0),
           gesamt: summe + cashSumme + sach };
}

function gesamtUebersicht() {
  const g = gesamtDaten(), gv = g.summe - g.einstand;
  const teile = gruppieren(g.liste, g.gesamt, "art");
  if (g.cash > 0) teile.push({ name: "Cash", wert: g.cash, anteil: g.cash / g.gesamt * 100 });
  if (g.sach > 0) teile.push({ name: "Sachwerte", wert: g.sach, anteil: g.sach / g.gesamt * 100 });
  teile.sort((a, b) => b.wert - a.wert);
  const balken = (l, nenner) => l.map((t, i) => `
        <${t.id ? `button data-ansicht="${esc(t.id)}" class="balkenzeile"` : "div"} style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;margin:8px 0 2px;width:100%;background:none;border:0;padding:0;text-align:left">
          <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${FARBEN[i % FARBEN.length]};margin-right:8px"></i>${esc(t.name)}${t.id ? " ›" : ""}</span>
          <b>${eur(t.wert)}</b><span style="min-width:62px;text-align:right">${ant(nenner ? t.wert / nenner * 100 : 0)}</span></${t.id ? "button" : "div"}>
        <div class="balken"><i style="width:${nenner ? Math.max(0, t.wert) / nenner * 100 : 0}%;background:${FARBEN[i % FARBEN.length]}"></i></div>`).join("");
  const bald = kalenderEintraege(sichtDepots()).slice(0, 5), verlauf = wertverlauf(g.ids);
  const auswahl = { position: "Position", branche: "Branche", art: "Anlageart", konto: "Depot" };
  return `
    ${sichten().length < 2 ? depotReiter() : ""}
    <section class="karte gesamt">
      <div class="label">${ui.person ? esc(ui.person) + " · " : personen().length > 1 ? "Haushalt · " : ""}Gesamtvermögen · ${g.ids.length} Depots${g.sach ? " + Sachwerte" : ""}</div>
      <div class="zahl">${eur(g.gesamt)}</div>
      <span class="chip ${vz(gv)}">Wertpapiere ${eurVz(gv)} · ${pct(g.einstand ? (g.summe / g.einstand - 1) * 100 : null)}</span>
      ${wertChart(verlauf, g.ids)}
      <div class="kennzahlen">
        <div><small>Wertpapiere</small><b>${eur(g.summe, true)}</b></div>
        <div><small>Cash${g.gesamt ? " · " + ant(g.cash / g.gesamt * 100) : ""}</small><b>${eur(g.cash, true)}</b></div>
        <div><small>Sachwerte</small><b>${g.sach ? eur(g.sach, true) : "–"}</b></div>
        <div><small>Einstand</small><b>${eur(g.einstand, true)}</b></div>
        <div><small>Realisiert</small><b class="${vz(g.real)}-t">${eur(g.real, true)}</b></div>
        <div><small>Dividenden</small><b>${eur(g.div, true)}</b></div>
      </div>
      <div class="klein">${standText()}</div>
      ${sicherungsHinweis()}
      ${g.ueber.length ? `<div class="klein warn-t">⚠ ${esc(g.ueber.join(" · "))}: Verkauf über dem Bestand – fehlt ein Kauf in der Datei?</div>` : ""}
    </section>
    <h2>Depots</h2>
    <section class="karte">${balken(g.proDepot.map((d) => ({ id: d.id, name: d.name, wert: d.wert })).sort((a, b) => b.wert - a.wert), g.gesamt - g.sach)}
      <div class="knoepfe" style="flex-wrap:wrap">${Object.entries(S.depots).map(([id, d]) =>
        `<button class="knopf klein" data-depot-edit="${esc(id)}">✏️ ${esc(d.name)}${d.rolle === "beobachtet" ? " 👁" : ""}</button>`).join("")}</div>
      ${Object.values(S.depots).some((d) => d.rolle === "beobachtet") ? `<p class="klein" style="margin-bottom:0">👁 beobachtete Depots zählen nicht zum Vermögen.</p>` : ""}</section>
    <h2>Wo das Geld steckt</h2>
    <section class="karte">${balken(teile, g.gesamt)}</section>
    ${bald.length ? `<h2>Demnächst<button class="knopf klein" data-ziel="kalender" data-kal-alle="1">Kalender ›</button></h2>
    <section class="karte liste">${bald.map((x) => `<div class="zeile" style="grid-template-columns:auto minmax(0,1fr) auto">
      <span class="mono">${KAL_SYMBOL[x.art] || "📌"}</span><span style="min-width:0"><span class="titel">${esc(x.titel)}</span><span class="unter">${esc(x.art)}${x.depot ? " · " + esc(x.depot) : ""}</span></span>
      <span class="rechts"><b>${kurzDatum(x.datum)}</b></span></div>`).join("")}</section>` : ""}
    <h2>Kennzahlen je Depot</h2>
    ${verlaufChart(verlauf, true)}
    <h2>Gewichtung über alle Depots</h2>
    <section class="karte">
      <div class="reiter">${Object.entries(auswahl).map(([k, t]) => `<button data-aufteilung="${k}" class="${ui.aufteilung === k ? "aktiv" : ""}">${t}</button>`).join("")}</div>
      ${torte(gruppieren(g.liste, g.summe, ui.aufteilung))}
    </section>
    ${streuungKarte(g.liste, g.summe)}`;
}

/** Depot nachtraeglich bearbeiten (Vorgabe 07.11.): Name, eigenes/beobachtetes Depot
 *  (z. B. Depot eines anderen - zaehlt dann nicht zum eigenen Vermoegen), Cash, leeren, loeschen. */
function depotBearbeiten(id) {
  const d = S.depots[id];
  if (!d) return "";
  const vorher = D; D = d;
  const mitKonto = !!kontoStand();
  D = vorher;
  return `
    <form class="karte formular" id="depot-bearbeiten-form" data-id="${esc(id)}">
      <div style="display:flex;justify-content:space-between;align-items:center"><b>✏️ Depot bearbeiten</b><button class="knopf klein" type="button" data-depot-edit="">schließen</button></div>
      <label>Name<input name="name" value="${esc(d.name)}" required maxlength="40"></label>
      <label>Person (Familie/Haushalt)<input name="person" list="personen-liste" value="${esc(d.person || "")}" placeholder="leer = Ich, z. B. Partner, Kind"></label>
      <datalist id="personen-liste">${personen().filter((n) => n !== "Ich").map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
      <label>Zählt zum Vermögen?<select name="rolle">
        <option value="eigen" ${d.rolle !== "beobachtet" ? "selected" : ""}>mein Depot – zählt zum Vermögen</option>
        <option value="beobachtet" ${d.rolle === "beobachtet" ? "selected" : ""}>beobachtet (z. B. von jemand anderem) – zählt nicht mit</option></select></label>
      <label>Cash / Guthaben in €${mitKonto ? " – kommt aus den Kontobewegungen" : ""}
        <input name="cash" inputmode="decimal" value="${d.cash != null ? String(d.cash).replace(".", ",") : ""}" ${mitKonto ? "disabled" : ""}></label>
      <p class="klein" style="margin:0">${d.buchungen.length} Buchungen · ${Object.keys(d.instrumente).length} Wertpapiere</p>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        <button class="knopf" type="button" data-depot-teilen="${esc(id)}">🔐 Verschlüsselt teilen</button>
        <button class="knopf" type="button" data-depot-leeren="${esc(id)}">Leeren &amp; neu einlesen</button>
        ${Object.keys(S.depots).length > 1 ? `<button class="knopf gefahr" type="button" data-depot-weg="${esc(id)}">Löschen</button>` : ""}</div>
    </form>`;
}

/** Das + in der Uebersicht: alles Neue an einer Stelle. */
function plusMenue() {
  return `
    <section class="karte">
      <div style="display:flex;justify-content:space-between;align-items:center"><b>Hinzufügen</b><button class="knopf klein" data-plus="zu">schließen</button></div>
      <div class="liste" style="margin-top:8px">
        <button class="zeile" data-ziel="daten"><span class="mono">📄</span><span style="min-width:0"><span class="titel">CSV, PDF oder Screenshot importieren</span><span class="unter">Broker-Export – landet automatisch im passenden oder in einem neuen Depot</span></span><span class="rechts">›</span></button>
        <button class="zeile" data-plus="depot"><span class="mono">🗂️</span><span style="min-width:0"><span class="titel">Neues Depot anlegen</span><span class="unter">leer, z. B. Kinderdepot – danach Datei importieren</span></span><span class="rechts">›</span></button>
        <button class="zeile" data-neu="buchung"><span class="mono">✍️</span><span style="min-width:0"><span class="titel">Buchung von Hand</span><span class="unter">im Depot „${esc(D.name)}“</span></span><span class="rechts">›</span></button>
        <button class="zeile" data-sachwert="neu" data-ziel-seite="sachwerte"><span class="mono">📦</span><span style="min-width:0"><span class="titel">Sachwert eintragen</span><span class="unter">Kamera, Laptop, Auto, Gold …</span></span><span class="rechts">›</span></button>
      </div>
      ${ui.plus === "depot" ? `<form class="formular" id="depot-form" style="margin-top:10px">
        <label>Name<input name="name" placeholder="z. B. Kinderdepot, Bitvavo" required></label>
        <label>Person<input name="person" list="personen-liste2" value="${esc(ui.person && ui.person !== "Ich" ? ui.person : "")}" placeholder="leer = Ich, z. B. Partner"></label>
        <datalist id="personen-liste2">${personen().filter((n) => n !== "Ich").map((n) => `<option value="${esc(n)}">`).join("")}</datalist>
        <label>Zählt zum Vermögen?<select name="rolle"><option value="eigen">mein Depot – zählt zum Vermögen</option><option value="beobachtet">beobachtet (z. B. von jemand anderem) – zählt nicht mit</option></select></label>
        <button class="knopf haupt" type="submit">Anlegen und Datei wählen</button></form>` : ""}
    </section>`;
}

function uebersicht() {
  const plus = (ui.plus ? plusMenue() : "") + (ui.depotEdit ? depotBearbeiten(ui.depotEdit) : "") + (ui.depotTeilen ? depotTeilenKarte(ui.depotTeilen) : "");
  if (gesamtAnsicht()) return plus + sichtLeiste() + gesamtUebersicht();
  const { liste, summe } = positionen();
  if (!D.buchungen.length) return plus + (sichtLeiste() || depotReiter()) + `
    <section class="karte leer">
      <h1 style="margin:0;font-size:22px">Noch leer</h1>
      <p>Wähle die CSV- oder PDF-Exporte deiner Broker und Banken – gern <b>alle auf einmal</b>. Jeder Broker bekommt sein eigenes Depot, die Übersicht zeigt danach alles zusammen.</p>
      <div class="knoepfe"><label class="knopf haupt" style="text-align:center">📄 CSV / PDF / Screenshot wählen
          <input type="file" id="import-datei" accept=".csv,.json,.txt,.dksafe,application/octet-stream,.pdf,.png,.jpg,.jpeg,.webp,text/*,application/json,application/pdf,image/*" multiple hidden></label>
        <button class="knopf" data-plus="depot">🗂️ Leeres Depot anlegen</button>
        <button class="knopf" data-neu="buchung">✍️ Von Hand eintragen</button></div>
    </section>`;
  const einstand = liste.reduce((s, p) => s + p.einstand, 0);
  const gv = summe - einstand;
  const real = Object.values(bestand()).reduce((s, p) => s + p.realisiert, 0);
  const div = Object.values(bestand()).reduce((s, p) => s + p.dividenden, 0);
  const ohneKurs = liste.filter((p) => p.ohneKurs).length;
  const ueber = Object.values(bestand()).filter((p) => p.ueber);
  const offen = liste.filter((p) => ["pruefen", "aendern", "neu"].includes(p.inst.status) || (p.abweichung != null && Math.abs(p.abweichung) >= 1));
  const auswahl = { position: "Position", branche: "Branche", art: "Anlageart", konto: "Konto" };
  const v = vermoegen(liste, summe);
  return plus + (sichtLeiste() || depotReiter()) + `<div style="display:flex;justify-content:flex-end;margin:0 0 6px"><button class="knopf klein" data-depot-edit="${esc(S.aktiv)}">✏️ Depot bearbeiten</button></div>` + `
    <section class="karte gesamt">
      <div class="label">${v.cash ? "Gesamtvermögen (Depot + Cash)" : "Depotwert"}</div>
      <div class="zahl">${eur(v.gesamt)}</div>
      <span class="chip ${vz(gv)}">Depot ${eurVz(gv)} · ${pct(einstand ? (summe / einstand - 1) * 100 : null)}</span>
      ${wertChart(wertverlauf([S.aktiv]), [S.aktiv])}
      <div class="kennzahlen">
        <div><small>Depotwert</small><b>${eur(summe, true)}</b></div>
        <div><small>Cash${v.cash && v.gesamt ? " · " + ant(v.cash.betrag / v.gesamt * 100) : ""}</small><b>${v.cash ? eur(v.cash.betrag, true) : "–"}</b></div>
        <div><small>Einstand</small><b>${eur(einstand, true)}</b></div>
        <div><small>Realisiert</small><b class="${vz(real)}-t">${eur(real, true)}</b></div>
        <div><small>Dividenden</small><b>${eur(div, true)}</b></div>
        <div><small>Positionen</small><b>${liste.length}</b></div>
      </div>
      <div class="klein">${standText()}</div>
      ${sicherungsHinweis()}
      ${ueber.length ? `<div class="klein warn-t">⚠ ${ueber.map((p) => esc((D.instrumente[p.instrument] || {}).name || p.instrument) + " (" + p.ueber.map((u) => datum(u.datum)).join(", ") + ")").join(" · ")}: Verkauf über dem Bestand – fehlt ein Kauf in der Datei? Gewinn zählt nur auf den vorhandenen Bestand.</div>` : ""}
      <div class="klein">${v.cash ? `Cash ${esc(v.cash.quelle)}` : `Kein Cash hinterlegt – über ✏️ Depot bearbeiten eintragen oder Kontobewegungen importieren.`}${ohneKurs ? ` · <span class="warn-t">${ohneKurs} ohne Kurs (Wert = Einstand)</span>` : ""}</div>
    </section>
    <h2>Wo das Geld steckt</h2>
    <section class="karte">
      ${v.teile.map((t, i) => `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;margin:8px 0 2px">
          <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${FARBEN[i % FARBEN.length]};margin-right:8px"></i>${esc(t.name)}</span>
          <b>${eur(t.wert)}</b><span style="min-width:62px;text-align:right">${ant(t.anteil)}</span></div>
        <div class="balken"><i style="width:${t.anteil}%;background:${FARBEN[i % FARBEN.length]}"></i></div>`).join("")}
    </section>
    <h2>Wertentwicklung</h2>
    ${verlaufChart(wertverlauf([S.aktiv]))}
    <h2>Gewichtung im Depot</h2>
    <section class="karte">
      <div class="reiter">${Object.entries(auswahl).map(([k, t]) =>
        `<button data-aufteilung="${k}" class="${ui.aufteilung === k ? "aktiv" : ""}">${t}</button>`).join("")}</div>
      ${torte(gruppieren(liste, summe, ui.aufteilung))}
    </section>
    ${streuungKarte(liste, summe)}
    <h2>Offene Punkte <span>${offen.length}</span></h2>
    <section class="karte liste">${offen.length ? offen.map(zeile).join("") :
      `<p class="klein" style="margin:8px">Nichts offen. Status und Zielgewicht setzt du in der Position.</p>`}</section>
    ${kontoKarte()}`;
}

function torte(e) {
  const r = 70, u = 2 * Math.PI * r;
  let lauf = 0;
  const ringe = e.map((x, i) => {
    const l = x.anteil / 100 * u;
    const s = `<circle r="${r}" cx="100" cy="100" fill="none" stroke="${FARBEN[i % FARBEN.length]}" stroke-width="34"
      stroke-dasharray="${l} ${u - l}" stroke-dashoffset="${-lauf}" transform="rotate(-90 100 100)"/>`;
    lauf += l;
    return s;
  }).join("");
  return `<div class="torte"><svg viewBox="0 0 200 200" aria-hidden="true">${ringe}</svg>
    <ul class="legende">${e.map((x, i) => `<li><i style="background:${FARBEN[i % FARBEN.length]}"></i>
      <span>${esc(x.name)}</span><b>${ant(x.anteil)}</b></li>`).join("")}</ul></div>`;
}

/** Break-even nach Gebuehren (0.55, Wunsch 17.11.): Kaufgebuehren stecken im Einstand, die Verkaufsgebuehr kommt aus dem
 *  Gebuehren-Standard der Rechner (Einstellung nachkaufGebuehr, % je Order; leer = 0).
 *  noetig  = so viel % muss der Kurs steigen, bis die Position nach Verkauf wieder bei null ist (> 0 = im Minus)
 *  puffer  = so viel % darf der Kurs fallen, bis die Position bei null ist (> 0 = im Plus)
 *  kursBE  = Kurs je Stueck, bei dem die Position genau bei null ist. Rechnet nur, keine Empfehlung. */
function breakEven(p) {
  if (!p || p.ohneKurs || !(p.wert > 0) || !(p.einstand > 0)) return null;
  const f = Math.min(0.5, Math.max(0, (zahl(EIN().nachkaufGebuehr) || 0) / 100)), faktor = p.einstand / (p.wert * (1 - f));
  return { noetig: (faktor - 1) * 100, puffer: (1 - faktor) * 100, kursBE: p.stueck > 0 ? p.einstand / (p.stueck * (1 - f)) : null, gebuehr: f * 100 };
}
/** "Verlust → nötiger Anstieg": je tiefer im Minus, desto steiler wird der Weg zurück. */
const VERLUST_HINWEIS_AB = 35;   // 0.59: ab -35 % (Vorgabe 17.11.: "ab ungefaehr 35 %" - darunter eher Position aufloesen und neu eroeffnen, um den Verlust zu begrenzen)
const ANSTIEG_TABELLE = [10, 20, 30, 40, 50, 60, 75, 90];

function zeile(p) {
  const st = p.inst.status, be = breakEven(p);
  const zielStrich = p.ziel != null ? `<s style="left:${Math.min(100, p.ziel * 4)}%"></s>` : "";
  const abw = p.abweichung != null && Math.abs(p.abweichung) >= 1
    ? ` · <span class="warn-t">Ziel ${ant(p.ziel)} (${pct(p.abweichung)})</span>` : "";
  return `
    <button class="zeile" data-position="${esc(p.id)}">
      <span class="mono">${esc(kuerzel(p.name))}</span>
      <span style="min-width:0">
        <span class="titel">${esc(p.name)}${st && st !== "ok" ? `<span class="marke-status st-${st}">${STATUS[st]}</span>` : ""}</span>
        <span class="unter">${esc(p.inst.branche || p.inst.art || "")} · ${ant(p.gewicht)}${abw}${seitAkt(p.inst)}</span>
        <span class="balken"><i style="width:${Math.min(100, p.gewicht * 4)}%"></i>${zielStrich}</span>
      </span>
      <span class="rechts">${minichart(p.inst)}<b>${eur(p.wert)}</b>${p.ohneKurs
        ? `<span class="klein">seit Kauf: kein Kurs</span>`
        : `<span class="${vz(p.gvPct)}-t seit-kauf">${pct(p.gvPct)}</span> <span class="klein ${vz(p.gv)}-t">${eurVz(p.gv)}</span>${be
          ? `<span class="klein be-zeile">${be.noetig > 0.005 ? `Break-even ${pct(be.noetig)}` : `Puffer ${pct(-be.puffer)}`}</span>` : ""}`}</span>
    </button>`;
}

/** Positionen und Watchlist teilen sich einen Reiter in der Leiste. */
function posReiter() {
  return `<div class="reiter" style="margin:8px 0 0">
    <button data-ziel="positionen" class="${ui.seite === "positionen" ? "aktiv" : ""}">${gesamtAnsicht() ? "Alle Depots" : esc(D.name)}</button>
    <button data-ziel="watchlist" class="${ui.seite === "watchlist" ? "aktiv" : ""}">Watchlist</button></div>`;
}

function positionenSeite() {
  const { liste } = gesamtAnsicht() ? gesamtDaten() : positionen();
  const sorten = { wert: (a, b) => b.wert - a.wert, name: (a, b) => a.name.localeCompare(b.name, "de"),
                   gewinn: (a, b) => (b.gvPct ?? -1e9) - (a.gvPct ?? -1e9), abweichung: (a, b) => Math.abs(b.abweichung ?? 0) - Math.abs(a.abweichung ?? 0) };
  liste.sort(sorten[ui.sortierung]);
  const reiter = `${sichtLeiste()}${posReiter()}<div class="reiter" style="margin:8px 0 0">
      <button data-posansicht="liste" class="${ui.posAnsicht !== "heatmap" ? "aktiv" : ""}">Liste</button>
      <button data-posansicht="heatmap" class="${ui.posAnsicht === "heatmap" ? "aktiv" : ""}">Heatmap</button></div>`;
  if (ui.posAnsicht === "heatmap") return `${reiter}<h2>${liste.length} Positionen</h2>${heatmap(liste, liste.reduce((s, p) => s + p.wert, 0))}`;
  return `${reiter}
    <h2>${anzahl(liste.length, "Position", "Positionen")}
      <select id="sortierung" class="knopf klein">${[["wert", "Nach Wert"], ["gewinn", "Beste zuerst"], ["abweichung", "Abweichung vom Ziel"], ["name", "Name"]]
        .map(([k, t]) => `<option value="${k}" ${ui.sortierung === k ? "selected" : ""}>${t}</option>`).join("")}</select></h2>
    ${kursHinweis(liste.length)}
    <section class="karte liste">${liste.map(zeile).join("") || `<p class="klein" style="margin:8px">Noch keine Positionen.</p>`}</section>`;
}

/** Positionen: Hinweis, wenn Kurse fehlen oder aelter als 24 Std. sind (Vorgabe 15.11.2026:
 *  ohne Internet stimmen die Zahlen nicht - das muss man sofort sehen, mit Weg zu Internet + API-Schluesseln). */
function kursHinweis(anzahl) {
  const a = S.einstellungen?.letzterAbruf;
  if (!anzahl || (a && Date.now() - new Date(a) < 24 * 36e5)) return "";
  return `<section class="karte" style="border-color:var(--warn)">
      <p style="margin-top:0"><b>Aktuelle Kurse gibt es nur mit Internet.</b></p>
      <p class="klein">Ohne Internet rechnet die App mit dem letzten Kurs aus deinen Importen – Wert und Gewinn/Verlust stimmen dann nicht mit heute überein. Internet erlauben, dann unter ⚙️ → Import „Kurse &amp; Daten aktualisieren“. Für zusätzliche Datenquellen eigene, kostenlose API-Schlüssel eintragen.</p>
      <p class="klein">${esc(standText())}</p>
      <div class="knoepfe"><button class="knopf" data-ziel="datenschutz">🌐 Internet erlauben</button><button class="knopf" data-ziel="schluessel">🔑 API-Schlüssel</button></div>
    </section>`;
}

function detailSeite(id) {
  const i = D.instrumente[id] || { name: id };
  const p = positionen().liste.find((x) => x.id === id);
  const buch = D.buchungen.filter((b) => b.instrument === id).sort((a, b) => (b.datum || "").localeCompare(a.datum || ""));
  return `
    <h2><button class="knopf klein" data-los="zurueck">‹ Zurück</button></h2>
    <section class="karte gesamt">
      <div class="label">${esc(i.isin || i.ticker || "")}</div>
      <div style="font-size:22px;font-weight:700">${esc(i.name || id)}</div>
      ${p ? `<div class="kennzahlen">
        <div><small>Stück</small><b>${i.ohneStueck ? "unbekannt" : stk(p.stueck)}</b></div>
        <div><small>Wert</small><b>${eur(p.wert)}</b></div>
        <div><small>Gewicht</small><b>${ant(p.gewicht)}</b></div>
        <div><small>Einstand</small><b>${eur(p.einstand)}</b></div>
        <div><small>G/V</small><b class="${vz(p.gv)}-t">${eurVz(p.gv)}</b></div>
        <div><small>G/V %</small><b class="${vz(p.gvPct)}-t">${pct(p.gvPct)}</b></div>
        ${(() => { const be = breakEven(p); return be ? `<div><small>${be.noetig > 0.005 ? "Bis Break-even" : "Puffer bis Break-even"}</small><b class="${be.noetig > 0.005 ? "minus" : "plus"}-t">${be.noetig > 0.005 ? pct(be.noetig) : pct(-be.puffer)}</b><small>nach Gebühren</small></div>` : ""; })()}
        <div><small>Ø Kaufkurs</small><b>${i.ohneStueck || !p.stueck ? "–" : kursE(p.einstand / p.stueck)}</b></div>
        <div><small>Kurs jetzt</small><b>${i.kurs != null ? kursE(i.kurs) : "–"}</b></div>
        <div><small>Seit Aktualisierung</small><b class="${vz(i.kursVorher ? i.kurs / i.kursVorher - 1 : null)}-t">${i.kursVorher ? pct((i.kurs / i.kursVorher - 1) * 100) : "–"}</b></div>
        ${i.termine?.kgv ? `<div><small>KGV</small><b>${fPct.format(i.termine.kgv)}</b></div>
        <div><small>KGV erwartet</small><b>${i.termine.kgvErwartet ? fPct.format(i.termine.kgvErwartet) : "–"}</b></div>` : ""}
      </div>${haltefristListe(id)}${breakEvenKarte(p, i)}` : `<p class="klein">Aktuell nicht im Bestand.</p>`}
      <div style="margin-top:14px">${minichart(i, 300, 90, true)}</div>
    </section>
    ${quartalsTabelle(i)}
    ${analystenKarte(i)}
    <h2>Angaben</h2>
    <form class="karte formular" id="instrument-form" data-id="${esc(id)}">
      <label>Name<input name="name" value="${esc(i.name || "")}"></label>
      <div class="zwei">
        <label>Ticker (Yahoo)<input name="ticker" value="${esc(i.ticker || "")}" placeholder="z. B. NOVO-B.CO"></label>
        <label>ISIN<input name="isin" value="${esc(i.isin || "")}"></label>
      </div>
      <div class="zwei">
        <label>Branche<input name="branche" value="${esc(i.branche || "")}" list="branchen"></label>
        <label>Anlageart<select name="art">${["Aktie", "ETF", "ETC", "Fonds", "Zertifikat", "Optionsschein", "Anleihe", "Krypto", "Sonstiges"]
          .concat(i.art && !["Aktie", "ETF", "ETC", "Fonds", "Zertifikat", "Optionsschein", "Anleihe", "Krypto", "Sonstiges"].includes(i.art) ? [i.art] : [])
          .map((a) => `<option ${i.art === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      </div>
      <div class="zwei">
        <label>WKN<input name="wkn" value="${esc(i.wkn || "")}" autocapitalize="characters"></label>
        <label>Richtung<select name="richtung">${[["", "–"], ["long", "Long"], ["short", "Short"]]
          .map(([w, t]) => `<option value="${w}" ${(i.richtung || "") === w ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      </div>
      <div class="zwei">
        <label>Aktueller Kurs in €<input name="kurs" inputmode="decimal" value="${i.kurs != null ? String(i.kurs).replace(".", ",") : ""}"></label>
        <label>Zielgewicht in %<input name="ziel" inputmode="decimal" value="${i.ziel != null ? String(i.ziel).replace(".", ",") : ""}"></label>
      </div>
      <div class="zwei">
        <label>Status<select name="status">${Object.entries(STATUS).map(([k, t]) =>
          `<option value="${k}" ${(i.status || "") === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Kurs vom<input value="${i.kursDatum ? datum(i.kursDatum) : "–"}" disabled></label>
      </div>
      <label>Notiz / was zu ändern ist<textarea name="notiz">${esc(i.notiz || "")}</textarea></label>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        <button class="knopf" type="button" data-neu="buchung" data-instrument="${esc(id)}">+ Buchung</button>
        <button class="knopf" type="button" data-notiz-neu="${esc(id)}">+ Notiz</button>
        ${p && p.stueck > 0 && !i.ohneStueck ? `<button class="knopf" type="button" data-nachkauf-aus="${esc(id)}">📉 In Tranchen kaufen</button>
        <button class="knopf" type="button" data-gewinn-aus="${esc(id)}">💰 Gewinnmitnahme</button>
        <button class="knopf" type="button" data-posgr-aus="${esc(id)}">⚖️ Positionsgröße</button>` : ""}</div>
    </form>
    ${notizenZu(id)}
    ${newsZu(i.name || id)}
    <datalist id="branchen">${[...new Set(Object.values(D.instrumente).map((x) => x.branche).filter(Boolean))].sort()
      .map((b) => `<option value="${esc(b)}">`).join("")}</datalist>
    <h2>Buchungen</h2>
    <section class="karte">${buchungsTabelle(buch)}</section>`;
}

/** Rechenbeispiel in der Position: was es braucht, um wieder bei null zu sein – und was ein Rücksetzer bedeutet. */
function breakEvenKarte(p, i) {
  const be = breakEven(p);
  if (!be) return "";
  const k = i.kurs, minus = be.noetig > 0.005, gv = (x) => (x > 0 ? "+" : "") + fPct.format(x) + " %";
  const rueck = 20, wertNach = p.wert * (1 - rueck / 100), gvNach = (wertNach / p.einstand - 1) * 100;
  const zeilen = ANSTIEG_TABELLE.map((v) => `<tr class="${minus && Math.abs(p.gvPct) >= v - 5 && Math.abs(p.gvPct) < v + 5 ? "be-hier" : ""}"><td>−${v} %</td><td>${gv(100 / (1 - v / 100) - 100)}</td></tr>`).join("");
  return `<div class="be-karte">
    <p style="margin:0"><b>🧮 ${minus ? "Was es braucht, um wieder bei null zu sein" : "Was ein Rücksetzer für dich bedeutet"}</b></p>
    ${minus
      ? `<p class="klein" style="margin:4px 0 0">Du liegst bei <b class="minus-t">${pct(p.gvPct)}</b>. Damit die Position nach Gebühren wieder bei null ist, muss der Kurs um <b>${pct(be.noetig)}</b> steigen${be.kursBE && k ? ` – von ${kursE(k)} auf ${kursE(be.kursBE)}` : ""}.</p>`
      : `<p class="klein" style="margin:4px 0 0">Du liegst bei <b class="plus-t">${pct(p.gvPct)}</b>. Fällt der Kurs um ${rueck} %, liegst du noch bei <b class="${vz(gvNach)}-t">${pct(gvNach)}</b> (${eurVz(wertNach - p.einstand)}). Bis zum Break-even darf er um <b>${pct(be.puffer).replace("+", "")}</b> fallen${be.kursBE ? ` – bis ${kursE(be.kursBE)}` : ""}.</p>`}
    ${minus && p.gvPct <= -VERLUST_HINWEIS_AB ? `<p class="klein" style="margin:6px 0 0">💡 Ab etwa −${VERLUST_HINWEIS_AB} % braucht es schon ${pct(100 / (1 - VERLUST_HINWEIS_AB / 100) - 100)} Anstieg, um wieder bei null zu sein – du brauchst gerade ${pct(be.noetig)}. Manche lösen eine Position ab hier auf und eröffnen bei Bedarf eine neue, um den Verlust zu begrenzen. Realisierte Verluste lassen sich steuerlich mit Gewinnen verrechnen (Aktienverluste nur mit Aktiengewinnen). Ohne Gewähr, keine Anlageberatung.</p>` : ""}
    <details class="legende" style="margin-top:6px"><summary>ℹ️ Verlust und nötiger Anstieg</summary>
      <table class="tabelle nk-tabelle"><tr><th>Verlust</th><th>nötiger Anstieg</th></tr>${zeilen}</table>
      <p class="klein">Je tiefer eine Position im Minus ist, desto größer muss der Anstieg sein, um wieder bei null zu sein. Ob Halten, Nachkaufen oder Verkaufen sinnvoll ist, entscheidest du – das ist nur Rechnung, keine Anlageberatung.</p>
    </details>
    <p class="klein" style="margin:4px 0 0">${be.gebuehr > 0 ? `Mit ${fPct.format(be.gebuehr)} % Verkaufsgebühr (Standard aus den Rechnern) und den Kaufgebühren im Einstand.` : "Kaufgebühren sind im Einstand enthalten. Eine Verkaufsgebühr lässt sich in den Rechnern als Standard hinterlegen."}</p>
  </div>`;
}

function buchungsTabelle(liste) {
  if (!liste.length) return `<p class="klein">Keine Buchungen.</p>`;
  return `<table class="tabelle">${liste.map((b) => `
    <tr><td>${datum(b.datum)}<br><span class="klein">${esc(TYPEN[b.typ] || b.typ)}${b.konto ? " · " + esc(b.konto) : ""}</span></td>
      <td>${esc(KONTO_TYPEN.has(b.typ) ? b.notiz || TYPEN[b.typ] : (D.instrumente[b.instrument] || {}).name || b.instrument)}${b.beleg ? " 📎" : ""}
        <br><span class="klein">${KONTO_TYPEN.has(b.typ) ? eurVz(b.betrag) : b.typ === "dividende" ? eur(b.betrag) : `${stk(b.stueck)} × ${kursE(b.kurs)}`}</span></td>
      <td><button class="knopf klein" data-bearbeiten="${b.nr}">✎</button></td></tr>`).join("")}</table>`;
}

/** Buchungen in ein anderes Depot verschieben (falsches Depot beim Import oder von Hand).
 *  Wertpapier-Angaben (Name, Ticker, Kurs …) gehen mit; im alten Depot verschwindet ein Wertpapier, wenn keine Buchung mehr darauf zeigt. */
function buchungenVerschieben(von, nach, auswahl) {
  const q = S.depots[von], z = S.depots[nach];
  if (!q || !z || von === nach || !auswahl.length) return 0;
  const weg = new Set(auswahl);
  let nr = z.buchungen.reduce((m, b) => Math.max(m, b.nr || 0), 0);
  for (const b of auswahl) {
    if (b.instrument && !z.instrumente[b.instrument] && q.instrumente[b.instrument]) z.instrumente[b.instrument] = { ...q.instrumente[b.instrument] };
    z.buchungen.push({ ...b, nr: ++nr });
  }
  q.buchungen = q.buchungen.filter((b) => !weg.has(b));
  for (const id of Object.keys(q.instrumente)) if (!q.buchungen.some((b) => b.instrument === id) && auswahl.some((b) => b.instrument === id)) delete q.instrumente[id];
  const ids = new Set(auswahl.map((b) => b.importId).filter(Boolean));
  for (const i of (q.importe || []).filter((x) => ids.has(x.id))) if (!(z.importe ??= []).some((x) => x.id === i.id)) z.importe.push(i);
  q.importe = (q.importe || []).filter((x) => q.buchungen.some((b) => b.importId === x.id));
  return auswahl.length;
}
function buchungenLoeschen(auswahl) {
  const weg = new Set(auswahl);
  D.buchungen = D.buchungen.filter((b) => !weg.has(b));
  for (const id of Object.keys(D.instrumente)) if (!D.buchungen.some((b) => b.instrument === id) && auswahl.some((b) => b.instrument === id)) delete D.instrumente[id];
  D.importe = (D.importe || []).filter((x) => D.buchungen.some((b) => b.importId === x.id));
}
/** Importe dieses Depots: mit Kennung (ab 0.41) einzeln, aeltere nach Format zusammengefasst. */
function importGruppen() {
  const g = new Map();
  for (const b of D.buchungen) {
    const key = b.importId || (b.quelle ? "alt:" + b.quelle : "hand");
    const x = g.get(key) || { key, n: 0, von: b.datum, bis: b.datum, info: null };
    x.n++; if (b.datum && (!x.von || b.datum < x.von)) x.von = b.datum; if (b.datum && (!x.bis || b.datum > x.bis)) x.bis = b.datum;
    if (!x.info) x.info = b.importId ? (D.importe || []).find((i) => i.id === b.importId) || { format: b.quelle } : { format: b.quelle || "von Hand", alt: !b.importId };
    g.set(key, x);
  }
  return [...g.values()].sort((a, b) => (b.info.zeit || "").localeCompare(a.info.zeit || ""));
}
const gruppeBuchungen = (key) => D.buchungen.filter((b) => (b.importId || (b.quelle ? "alt:" + b.quelle : "hand")) === key);
function depotWahl(id, ohne) {
  return `<select id="${id}">${Object.entries(S.depots).filter(([k]) => k !== ohne).map(([k, d]) => `<option value="${esc(k)}">${esc(d.name)}</option>`).join("")}</select>`;
}
function buchungenSeite() {
  const liste = [...D.buchungen].sort((a, b) => (b.datum || "").localeCompare(a.datum || "") || b.nr - a.nr);
  const gruppen = importGruppen(), andere = Object.keys(S.depots).length > 1;
  return `<h2>Importe <span class="klein">${esc(D.name)}</span></h2>
    <section class="karte liste">${gruppen.length ? gruppen.map((x) => `
      <div class="zeile" style="grid-template-columns:minmax(0,1fr) auto">
        <span style="min-width:0"><span class="titel">${esc(x.info.format || "Import")}${x.info.datei ? " · " + esc(x.info.datei) : ""}</span>
          <span class="unter">${anzahl(x.n, "Buchung", "Buchungen")} · ${datum(x.von)} – ${datum(x.bis)}${x.info.zeit ? " · importiert " + datum(x.info.zeit) : ""}</span></span>
        <button class="knopf klein" data-import-wahl="${esc(x.key)}">${ui.importWahl === x.key ? "schließen" : "…"}</button>
      </div>
      ${ui.importWahl === x.key ? `<div class="formular" style="padding:0 12px 12px">
        ${andere ? `<label>In anderes Depot verschieben${depotWahl("import-ziel", S.aktiv)}</label>
        <button class="knopf" data-import-verschieben="${esc(x.key)}">↪️ ${anzahl(x.n, "Buchung", "Buchungen")} verschieben</button>` : ""}
        ${(() => { const o = (S.originale || []).find((y) => y.importId === x.key); return o ? `<p class="klein" style="margin:0">📄 Original: ${esc(o.name)} (${esc(o.typ)})</p>
        <button class="knopf" data-import-neu="${esc(x.key)}">🔁 Aus dem Original neu einlesen</button>` : ""; })()}
        <button class="knopf gefahr" data-import-loeschen="${esc(x.key)}">🗑️ Import zurücknehmen (${anzahl(x.n, "Buchung", "Buchungen")} löschen)</button>
      </div>` : ""}`).join("") : `<p class="klein" style="margin:8px">Noch nichts importiert.</p>`}</section>
    ${(() => { const lose = (S.originale || []).filter((o) => o.depot === S.aktiv && !D.buchungen.some((b) => b.importId && b.importId === o.importId));
      return lose.length ? `<h2>Dokumente ohne Buchungen</h2><section class="karte liste">${lose.map((o) => `
      <div class="zeile" style="grid-template-columns:minmax(0,1fr) auto auto">
        <span style="min-width:0"><span class="titel">📄 ${esc(o.name)}</span><span class="unter">${esc(o.typ)} · ${datum(o.zeit)}</span></span>
        <button class="knopf klein" data-original-neu="${esc(o.id)}">🔁</button><button class="knopf klein" data-original-weg="${esc(o.id)}">🗑️</button>
      </div>`).join("")}</section>` : ""; })()}
    <h2>${liste.length} Buchungen</h2><section class="karte">${buchungsTabelle(liste)}</section>`;
}

function buchungsFormular() {
  const f = ui.formular;
  const b = f.nr != null ? D.buchungen.find((x) => x.nr === f.nr) : { typ: "kauf", datum: heute(), instrument: f.instrument || "" };
  const konten = [...new Set(D.buchungen.map((x) => x.konto).filter(Boolean))];
  const namen = Object.entries(D.instrumente).sort((a, c) => (a[1].name || a[0]).localeCompare(c[1].name || c[0], "de"));
  const z = (x) => x != null ? String(x).replace(".", ",") : "";
  return `
    <h2><button class="knopf klein" data-los="zurueck">‹ Abbrechen</button><span>${f.nr != null ? "Buchung ändern" : "Neue Buchung"}</span></h2>
    <form class="karte formular" id="buchung-form">
      <div class="zwei">
        <label>Art<select name="typ">${Object.entries(TYPEN).map(([k, t]) => `<option value="${k}" ${b.typ === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
        <label>Datum<input type="date" name="datum" value="${esc(b.datum || heute())}" required></label>
      </div>
      <label>Wertpapier (vorhandenes wählen oder neuen Namen tippen)
        <input name="instrument" list="instrumente" value="${esc((D.instrumente[b.instrument] || {}).name || b.instrument || "")}" required></label>
      <datalist id="instrumente">${namen.map(([id, i]) => `<option value="${esc(i.name || id)}">`).join("")}</datalist>
      ${f.nr == null ? `<div class="zwei">
        <label>ISIN oder WKN (für Kurse, z. B. Zertifikate)<input name="kennung" placeholder="z. B. DE000BE0F1P5" autocapitalize="characters"></label>
        <label>Art des Werts<select name="wertart">${["Aktie", "ETF", "ETC", "Zertifikat", "Optionsschein", "Anleihe", "Fonds", "Krypto"].map((a) => `<option>${a}</option>`).join("")}</select></label>
      </div>` : ""}
      <label>Konto / Depot<input name="konto" list="konten" value="${esc(b.konto || konten[0] || "")}" placeholder="z. B. Scalable"></label>
      <datalist id="konten">${konten.map((k) => `<option value="${esc(k)}">`).join("")}</datalist>
      <div class="zwei">
        <label>Stück<input name="stueck" inputmode="decimal" value="${z(b.stueck)}"></label>
        <label>Kurs je Stück in €<input name="kurs" inputmode="decimal" value="${z(b.kurs)}"></label>
      </div>
      <div class="zwei">
        <label>Gebühren €<input name="gebuehr" inputmode="decimal" value="${z(b.gebuehr)}"></label>
        <label>Steuern €<input name="steuer" inputmode="decimal" value="${z(b.steuer)}"></label>
      </div>
      <div class="zwei">
        <label>Betrag € (Dividende, Ein-/Auszahlung, Karte: − = raus)<input name="betrag" inputmode="decimal" value="${z(b.betrag)}"></label>
        <label>Einstand gesamt € (nur Einbuchung)<input name="einstand" inputmode="decimal" value="${z(b.einstand)}"></label>
      </div>
      <label>Notiz<input name="notiz" value="${esc(b.notiz || "")}"></label>
      <label>Beleg / Screenshot<input type="file" name="beleg" accept="image/*"></label>
      ${b.beleg ? `<img class="beleg" src="${b.beleg}" alt="Beleg">` : ""}
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        ${f.nr != null ? `<button class="knopf gefahr" type="button" data-loeschen="${b.nr}">Löschen</button>` : ""}</div>
      ${f.nr != null && Object.keys(S.depots).length > 1 ? `<label>In anderes Depot verschieben${depotWahl("buchung-ziel", S.aktiv)}</label>
        <button class="knopf" type="button" data-buchung-verschieben="${b.nr}">↪️ Buchung verschieben</button>` : ""}
    </form>`;
}

function datenSeite() {
  if (ui.zuordnung) return zuordnungSeite();
  if (ui.vorschau) return vorschauSeite();
  return `
    <h2>Importieren</h2>
    <section class="karte">
      <p style="margin-top:0">CSV- und PDF-Dateien und Screenshots werden automatisch erkannt:</p>
      <ul class="klein" style="margin:0 0 12px;padding-left:18px">
        <li>Trade Republic – Transaktionsexport (Transaktionsexport.csv)</li>
        <li>Kraken / Kraken Pro – Ledger oder Trades</li>
        <li>Bitvavo – Transaktionsverlauf</li>
        <li>OKX – Handelsverlauf (Spot gegen Euro)</li>
        <li>Scalable Capital – Transaktionen (Broker-Transactions.csv)</li>
        <li>Smartbroker+ – Depotbestand und Transaktionen</li>
        <li>Kraken-App – Aktivitäten (CSV)</li>
        <li><b>PDF:</b> Kraken (Kontoauszug, Ledger, Balance Report, Kaufbeleg), Kontoauszüge von Revolut, Smartbroker+, Scalable, Trade Republic, Sparkasse und anderen Banken</li>
        <li>Depot-Bestand (bestand.csv) und Kursliste (Wochenkurse)</li>
        <li>Sicherung dieser App (.dksafe, ältere .json)</li>
        <li><b>Jede andere CSV</b> – auch Kontoauszüge: Spalten einmal zuordnen, die App merkt es sich</li>
        <li><b>Screenshot</b> einer ausgeführten Order (Kauf/Verkauf) – Trade Republic, Scalable Capital, Smartbroker+, Revolut, Kraken, Bitvavo, OKX und andere – Texterkennung direkt auf dem Handy, ohne Internet. Der wöchentliche Export ersetzt diese Buchungen später automatisch.</li>
        <li><b>Wertpapier-Abrechnung</b> (PDF je Kauf/Verkauf) von Scalable Capital, Smartbroker+, Trade Republic, Revolut und Baader Bank – mit Gegenprobe gegen den Endbetrag.</li>
        <li><b>Andere PDF</b> mit einer Tabelle: Spalten einmal zuordnen. PDFs werden nur auf dem Gerät gelesen. Scans/Fotos gehen nicht.</li>
      </ul>
      <label class="knopf haupt" style="display:block;text-align:center">📄 CSV, PDF oder Screenshot wählen
        <input type="file" id="import-datei" accept=".csv,.json,.txt,.dksafe,application/octet-stream,.pdf,.png,.jpg,.jpeg,.webp,text/*,application/json,application/pdf,image/*" multiple hidden></label>
      <p class="klein" style="margin-bottom:0">Mehrere Dateien auf einmal gehen auch – jede kommt nacheinander in die Vorschau.</p>
    </section>
    <h2>Aus dem Internet laden</h2>
    <section class="karte">
      <p style="margin-top:0" class="klein">Die App arbeitet offline. Dieser Knopf holt von Yahoo für alle Wertpapiere – in allen Depots – den letzten Kurs (in Euro), den Jahres-Chart, Dividenden, Earnings-Termine und Quartalszahlen. Fehlende Ticker sucht er über die ISIN. Ca. 20–40 KB je Titel.</p>
      <button class="knopf haupt" data-los="kurse" style="width:100%">Kurse &amp; Daten aktualisieren</button>
      <p class="klein" style="margin-bottom:0">Derselbe Knopf sitzt oben rechts neben ⚙️ (🔄) – von jeder Seite aus erreichbar.</p>
    </section>
    <h2>Sichern</h2>
    <section class="karte">
      <div class="knoepfe" style="margin-top:0">
        <button class="knopf" data-ziel="sicherheit">🔒 Verschlüsselte Sicherung</button>
        <button class="knopf haupt" data-los="zip-export">🗜️ Alles exportieren – verschlüsselte ZIP mit allen Originalen</button>
        <button class="knopf" data-los="export-csv">🔒 Bestand „${esc(D.name)}“ als CSV (verschlüsselt)</button>
      </div>
      <p class="klein">Jede Datei landet automatisch im passenden Depot – in der Vorschau kannst du das ändern. Offenes Depot: <b>${esc(D.name)}</b> · ${anzahl(D.buchungen.length, "Buchung", "Buchungen")}${D.geaendert ? ", zuletzt " + new Date(D.geaendert).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" }) : ""}.</p>
      <button class="knopf gefahr" data-los="alles-loeschen" style="width:100%;margin-top:6px">Depot „${esc(D.name)}“ leeren</button>
    </section>`;
}

/** Werte aller Depots: dieselbe Rechnung, nur kurz auf das jeweilige Depot umgeschaltet. */
function depotWerte(id) {
  const vorher = D;
  D = S.depots[id];
  try {
    const { liste, summe } = positionen();
    const einstand = liste.reduce((s, p) => s + p.einstand, 0);
    const c = cash();
    return { summe, einstand, n: liste.length, cash: c ? c.betrag : 0, gesamt: summe + (c ? c.betrag : 0) };
  } finally { D = vorher; }
}

function depotsSeite() {
  const ids = Object.keys(S.depots);
  const zeilen = ids.map((id) => {
    const d = S.depots[id], w = depotWerte(id), gv = w.summe - w.einstand;
    return `
      <button class="zeile" data-depot="${esc(id)}">
        <span class="mono">${d.rolle === "beobachtet" ? "👁" : esc(kuerzel(d.name))}</span>
        <span style="min-width:0"><span class="titel">${esc(d.name)}${id === S.aktiv ? '<span class="marke-status st-ok">offen</span>' : ""}</span>
          <span class="unter">${d.rolle === "beobachtet" ? "beobachtet" : "zählt zum Vermögen"} · ${anzahl(w.n, "Position", "Positionen")}${w.cash ? " · Cash " + eur(w.cash, true) : ""}</span></span>
        <span class="rechts"><b>${eur(w.gesamt)}</b><span class="${vz(gv)}-t">${pct(w.einstand ? (w.summe / w.einstand - 1) * 100 : null)}</span></span>
      </button>`;
  }).join("");
  const eigeneIds = ids.filter((id) => S.depots[id].rolle !== "beobachtet");
  const eigene = eigeneIds.map(depotWerte);
  const gesamt = eigene.reduce((s, w) => s + w.gesamt, 0);
  // Gesamtpaket: Anlagearten (inkl. Cash) ueber alle eigenen Depots
  const jeArt = {}, vorher = D;
  try {
    for (const id of eigeneIds) {
      D = S.depots[id];
      const { liste, summe } = positionen();
      for (const t of vermoegen(liste, summe).teile) jeArt[t.name] = (jeArt[t.name] || 0) + t.wert;
    }
  } finally { D = vorher; }
  const sach = sachwerteSumme();
  if (sach) jeArt["Sachwerte"] = sach;
  const depotsZusammen = gesamt;
  const arten = Object.entries(jeArt).sort((a, b) => b[1] - a[1]);
  const balken = (liste, nenner = gesamt) => liste.map(([name, wert], i) => `
        <div style="display:grid;grid-template-columns:minmax(0,1fr) auto auto;gap:10px;align-items:center;margin:8px 0 2px">
          <span><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${FARBEN[i % FARBEN.length]};margin-right:8px"></i>${esc(name)}</span>
          <b>${eur(wert)}</b><span style="min-width:62px;text-align:right">${ant(nenner ? wert / nenner * 100 : 0)}</span></div>
        <div class="balken"><i style="width:${nenner ? wert / nenner * 100 : 0}%;background:${FARBEN[i % FARBEN.length]}"></i></div>`).join("");
  const gesamtAlles = depotsZusammen + sach;
  return `
    <h2>Depots <span>${ids.length}</span></h2>
    <section class="karte gesamt">
      <div class="label">${sach ? "Gesamtvermögen (Depots + Cash + Sachwerte)" : "Eigene Depots zusammen (inkl. Cash)"}</div>
      <div class="zahl">${eur(gesamtAlles)}</div>
      ${sach ? `<div class="klein">Depots + Cash ${eur(depotsZusammen)} · <button class="knopf klein" data-ziel="sachwerte">Sachwerte ${eur(sach)}</button></div>` : ""}
      ${eigeneIds.length > 1 ? `<p class="klein" style="margin:10px 0 0">Nach Depot:</p>${balken(eigeneIds.map((id, k) => [S.depots[id].name, eigene[k].gesamt]))}` : ""}
      ${arten.length ? `<p class="klein" style="margin:14px 0 0">Nach Anlageart:</p>${balken(arten, gesamtAlles)}` : ""}
    </section>
    ${(() => {
      const mitCash = eigeneIds.map((id, k) => [S.depots[id].name, eigene[k].cash]).filter(([, c]) => c);
      const summe = mitCash.reduce((s, [, c]) => s + c, 0);
      return mitCash.length ? `<h2>Cash über alle Depots</h2>
        <section class="karte gesamt"><div class="label">Cash gesamt · Cashquote ${ant(gesamt ? summe / gesamt * 100 : 0)}</div>
          <div class="zahl">${eur(summe)}</div>
          <table class="tabelle">${mitCash.map(([n, c]) => `<tr><td>${esc(n)}</td><td>${eur(c)}</td><td>${ant(summe ? c / summe * 100 : 0)}</td></tr>`).join("")}</table>
</section>` : "";
    })()}
    <h2>Alle eigenen Depots übereinander</h2>
    ${verlaufChart(wertverlauf(eigeneIds))}
    <p class="klein">👁 = beobachtetes Depot, zählt nicht zum eigenen Vermögen.</p>
    <section class="karte liste" style="margin-top:10px">${zeilen}</section>
    <h2>Neues Depot</h2>
    <form class="karte formular" id="depot-form">
      <label>Name<input name="name" placeholder="z. B. Kinderdepot, Depot Oma" required></label>
      <label>Person<input name="person" placeholder="leer = Ich, z. B. Partner"></label>
      <label>Zählt zum Vermögen?<select name="rolle"><option value="eigen">mein Depot – zählt zum Vermögen</option><option value="beobachtet">beobachtet (z. B. von jemand anderem) – zählt nicht mit</option></select></label>
      <button class="knopf haupt" type="submit">Anlegen</button>
    </form>
    <section class="karte">
      <label class="knopf" style="display:block;text-align:center;cursor:pointer">📥 Geteiltes Depot einlesen (.dksafe)<input type="file" id="import-datei" accept=".dksafe,.zip,application/octet-stream,application/zip,application/json,.json,.csv,.pdf,image/*,text/*" hidden></label>
      <p class="klein" style="margin-bottom:0">Ein Depot, das dir jemand verschlüsselt geschickt hat – wird hinzugefügt, nichts anderes ändert sich. Eigenes Depot weitergeben: ✏️ Depot bearbeiten → 🔐 Verschlüsselt teilen.</p>
    </section>
    <h2>Offenes Depot: ${esc(D.name)}</h2>
    <form class="karte formular" id="depot-aendern">
      <div class="zwei"><label>Name<input name="name" value="${esc(D.name)}" required></label>
        <label>Art<select name="rolle"><option value="eigen" ${D.rolle !== "beobachtet" ? "selected" : ""}>eigenes</option>
          <option value="beobachtet" ${D.rolle === "beobachtet" ? "selected" : ""}>beobachtet</option></select></label></div>
      <label>Cash / Guthaben in € (nur nötig ohne importierte Kontobewegungen)
        <input name="cash" inputmode="decimal" value="${D.cash != null ? String(D.cash).replace(".", ",") : ""}"
          ${kontoStand() ? `disabled placeholder="kommt aus den Kontobewegungen"` : ""}></label>
      <div class="knoepfe"><button class="knopf" type="submit">Speichern</button>
        ${ids.length > 1 ? `<button class="knopf gefahr" type="button" data-los="depot-loeschen">Depot löschen</button>` : ""}</div>
    </form>`;
}

function vorschauSeite() {
  const v = ui.vorschau;
  const neu = v.buchungen.filter((b) => !b.ueberspringen).length;
  return `
    <h2><button class="knopf klein" data-los="vorschau-weg">${ui.importSchlange ? "Überspringen" : "‹ Abbrechen"}</button><span>${esc(v.format)}</span></h2>
    ${ui.importSchlange ? `<p class="klein" style="margin:0 2px 8px">Datei ${ui.importSchlange.nr} von ${ui.importSchlange.von}: ${esc(v.datei || "")}</p>` : ""}
    <section class="karte formular">
      <label>In welches Depot?<select id="vorschau-ziel">
        ${Object.entries(S.depots).map(([id, d]) => `<option value="${esc(id)}" ${v.ziel === id ? "selected" : ""}>${esc(d.name)}${d.buchungen.length ? "" : " (leer)"}</option>`).join("")}
        <option value="neu" ${v.ziel === "neu" ? "selected" : ""}>➕ Neues Depot „${esc(v.konto)}“</option></select></label>
      <label>Konto für diese Datei<input id="vorschau-konto" value="${esc(v.konto)}"></label>
      <p class="klein" style="margin:4px 0 0">Anderer Name = eigenes Depot (z. B. zweites Konto beim selben Broker).</p>
      ${v.buchungen.some((b) => b.kontobewegung) ? `
      ${v.rueck || v.zurueck === false ? `<p class="klein" style="margin:0">${v.buchungen.filter((b) => b.zurueck).length || "Ältere"} Käufe/Verkäufe liegen vor dem Bestand zum Stichtag:</p>
      <div class="reiter" style="margin:0">
        <button data-zurueck="an" class="${v.zurueck !== false ? "aktiv" : ""}">Bestand zurückrechnen (Verlauf)</button>
        <button data-zurueck="aus" class="${v.zurueck === false ? "aktiv" : ""}">ältere überspringen</button></div>` : ""}
      ${v.buchungen.some((b) => b.transfer) ? `<p class="klein" style="margin:0">Transfers an andere Konten (${v.buchungen.filter((b) => b.transfer).length}):</p>
      <div class="reiter" style="margin:0">
        <button data-transfer="verlust" class="${v.transferAls !== "auszahlung" ? "aktiv" : ""}">als Verlust (z. B. Challenge)</button>
        <button data-transfer="auszahlung" class="${v.transferAls === "auszahlung" ? "aktiv" : ""}">als Aus-/Einzahlung</button></div>` : ""}
      <div class="reiter" style="margin:0">
        <button data-umfang="broker" class="${v.mitKonto ? "" : "aktiv"}">Nur Broker</button>
        <button data-umfang="alles" class="${v.mitKonto ? "aktiv" : ""}">Alles inkl. Konto &amp; Karte</button>
      </div>
      <p class="klein" style="margin:0">${v.buchungen.filter((b) => b.kontobewegung).length} Kontobewegungen in der Datei
        (Ein-/Auszahlungen, Karte, Zinsen). „Alles“ zeigt zusätzlich Kontostand und Kartenausgaben.</p>` : ""}
      ${v.hinweis ? `<p class="klein" style="margin:0"><b>${esc(v.hinweis)}</b></p>` : ""}
      <p class="klein" style="margin:0">${neu} von ${v.buchungen.length} Buchungen werden übernommen.
        Durchgestrichen: schon vorhanden, storniert, vor dem Startbestand oder Kontobewegung bei „Nur Broker“.</p>
      <div class="knoepfe"><button class="knopf haupt" data-los="vorschau-ok">${neu} übernehmen</button></div>
    </section>
    <section class="karte"><table class="tabelle">${v.buchungen.map((b) => `
      <tr class="${b.ueberspringen ? "ueberspringen" : ""}"><td>${datum(b.datum)}<br><span class="klein">${esc(TYPEN[b.typ])}${b.grund ? " · " + esc(b.grund) : ""}</span></td>
      <td>${esc(b.kontobewegung ? b.notiz || b.name : b.name)}<br><span class="klein">${b.kontobewegung ? eurVz(b.betrag) : b.typ === "dividende" ? eur(b.betrag) : stk(b.stueck) + " × " + kursE(b.kurs)}</span></td></tr>`).join("")}</table></section>`;
}

// ------------------------------------------------------------ Import
function csvZeilen(text, trenner) {
  const zeilen = [];
  let feld = "", zeile = [], inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { feld += '"'; i++; }
      else if (c === '"') inQ = false;
      else feld += c;
    } else if (c === '"') inQ = true;
    else if (c === trenner) { zeile.push(feld); feld = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      zeile.push(feld); feld = "";
      if (zeile.some((x) => x !== "")) zeilen.push(zeile);
      zeile = [];
    } else feld += c;
  }
  zeile.push(feld);
  if (zeile.some((x) => x !== "")) zeilen.push(zeile);
  const kopf = (zeilen.shift() || []).map((k) => k.trim().replace(/^﻿/, ""));
  return { kopf, daten: zeilen.map((z) => Object.fromEntries(kopf.map((k, j) => [k, (z[j] ?? "").trim()]))) };
}

function erkennen(text, dateiname) {
  if (/^\s*\{/.test(text)) return { format: "Sicherung", sicherung: JSON.parse(text) };
  const erste = text.split(/\r?\n/, 1)[0];
  const trenner = (erste.match(/;/g) || []).length > (erste.match(/,/g) || []).length ? ";" : ",";
  const { kopf, daten } = csvZeilen(text, trenner);
  const hat = (...k) => k.every((x) => kopf.includes(x));
  const B = [];
  let format, konto = "";

  if (hat("datetime", "category", "type", "symbol", "shares", "price", "transaction_id")) {
    // Trade Republic, Transaktionsexport (App/Web, seit 2025). Zahlen mit
    // Punkt, Verkaeufe mit negativen Stueck. Nur Wertpapier-Buchungen:
    // Karte, Zinsen, Ueberweisungen und "Stockperk" (Gutschrift, der
    // eigentliche Kauf steht als eigene BUY-Zeile) sind Kontobewegungen.
    format = "Trade Republic – Transaktionsexport"; konto = "Trade Republic";
    const p = zahlPunkt;
    for (const z of daten) {
      const typ = z.category === "TRADING" ? { BUY: "kauf", SAVINGS_PLAN: "kauf", SELL: "verkauf" }[z.type]
                : z.type === "DIVIDEND" ? "dividende" : null;
      if (!typ && z.category === "CASH") {
        // Kontobewegung. Gegenkonto (Name/IBAN) wird bewusst NICHT gespeichert,
        // bei Kartenzahlungen nur der Haendler.
        const betrag = p(z.amount) || 0;
        const kt = { TRANSFER_INBOUND: "einzahlung", TRANSFER_INSTANT_INBOUND: "einzahlung",
                     TRANSFER_OUTBOUND: "auszahlung", TRANSFER_INSTANT_OUTBOUND: "auszahlung",
                     CARD_TRANSACTION: "karte", INTEREST_PAYMENT: "zinsen", STOCKPERK: "bonus",
                     CARD_ORDERING_FEE: "gebuehr" }[z.type] || (betrag >= 0 ? "einzahlung" : "auszahlung");
        B.push({ typ: kt, kontobewegung: true, datum: z.date, name: TYPEN[kt], betrag,
                 gebuehr: Math.abs(p(z.fee) || 0), steuer: Math.abs(p(z.tax) || 0),
                 notiz: kt === "karte" ? (z.name || "").trim() : kt === "bonus" ? (z.name || "") : "",
                 ref: "tr:" + z.transaction_id });
        continue;
      }
      if (!typ || !z.symbol) continue;
      B.push({ typ, datum: z.date, name: z.name, isin: z.symbol, stueck: Math.abs(p(z.shares) || 0), kurs: p(z.price),
               betrag: typ === "dividende" ? Math.abs(p(z.amount) || 0) : null,
               gebuehr: Math.abs(p(z.fee) || 0), steuer: Math.abs(p(z.tax) || 0),
               art: { STOCK: "Aktie", FUND: "ETF", CRYPTO: "Krypto", BOND: "Anleihe" }[z.asset_class] || "Aktie",
               kasse: typ === "dividende" ? null : p(z.amount),      // wie gebucht, nicht Stueck x Kurs
               ref: "tr:" + z.transaction_id });
    }
  } else if (hat("refid", "time", "type", "asset", "amount", "fee")) {
    // Kraken "Ledger" (Verlauf → Export → Ledgers). Ein Kauf sind zwei Zeilen
    // mit gleicher refid: Euro raus, Coin rein (type trade, oder spend/receive
    // bei Kaeufen in der App). Staking-Ertraege kommen als Einbuchung ohne Einstand.
    format = "Kraken – Ledger"; konto = "Kraken";
    const p = (s) => zahlPunkt(s) ?? 0;
    const jeRef = {};
    for (const z of daten) (jeRef[z.refid] ??= []).push(z);
    for (const [ref, zeilen] of Object.entries(jeRef)) {
      const eurZ = zeilen.find((z) => istEuro(z.asset));
      const coin = zeilen.filter((z) => !istEuro(z.asset));
      const tag = (zeilen[0].time || "").slice(0, 10);
      const handel = zeilen.some((z) => ["trade", "spend", "receive"].includes(z.type));
      if (handel && eurZ && coin.length === 1) {
        const c = coin[0], menge = p(c.amount), euro = p(eurZ.amount);
        const stueck = Math.abs(menge) - (menge > 0 ? p(c.fee) : 0);
        const name = krakenName(c.asset);
        B.push({ typ: menge > 0 ? "kauf" : "verkauf", datum: tag, name: name.name, isin: name.code, art: "Krypto",
                 stueck: Math.abs(menge) > 0 ? (menge > 0 ? stueck : Math.abs(menge)) : 0,
                 kurs: Math.abs(menge) ? Math.abs(euro) / Math.abs(menge) : null,
                 gebuehr: p(eurZ.fee), kasse: euro, ref: "kr:" + ref });
      } else if (handel) {
        // Coin gegen Coin: ohne Euro-Wert nicht bewertbar - sichtbar ueberspringen
        for (const c of coin) B.push({ typ: p(c.amount) > 0 ? "kauf" : "verkauf", datum: tag, name: krakenName(c.asset).name,
          isin: krakenName(c.asset).code, art: "Krypto", stueck: Math.abs(p(c.amount)), kurs: null, ref: "kr:" + ref + c.asset,
          ueberspringen: true, grund: "Tausch Coin gegen Coin – bitte von Hand" });
      } else {
        for (const z of zeilen) {
          const menge = p(z.amount), fee = p(z.fee);
          if (istEuro(z.asset)) {
            if (z.type === "transfer" && menge) {
              B.push({ typ: menge < 0 ? "verlust" : "bonus", transfer: true, kontobewegung: true, datum: tag, betrag: menge, gebuehr: fee,
                       notiz: "Transfer " + (menge < 0 ? "an anderes Konto" : "von anderem Konto"), ref: "kr:" + z.txid });
              continue;
            }
            const kt = z.type === "deposit" ? "einzahlung" : z.type === "withdrawal" ? "auszahlung" : menge >= 0 ? "einzahlung" : "gebuehr";
            B.push({ typ: kt, kontobewegung: true, datum: tag, name: TYPEN[kt], betrag: menge, gebuehr: fee, notiz: z.type, ref: "kr:" + z.txid });
          } else if (["staking", "earn", "reward", "deposit", "transfer", "dividend", "airdrop"].includes(z.type) && menge > 0) {
            const name = krakenName(z.asset);
            // Umbuchungen zwischen Spot und Staking (".S"/"earn"-Wallet) sind kein Zugang
            if ((z.type === "transfer" || z.type === "earn") && /(migration|allocation|deallocation|spottostaking|stakingfromspot|spotfromstaking|stakingtospot)/i.test(z.subtype || "")) continue;
            B.push({ typ: "einbuchung", datum: tag, name: name.name, isin: name.code, art: "Krypto", stueck: menge - fee, einstand: 0, kurs: null,
                     notiz: "Kraken " + z.type + (z.subtype ? " " + z.subtype : ""), ref: "kr:" + z.txid, ertrag: true });
          } else if (z.type === "withdrawal" && menge < 0) {
            const name = krakenName(z.asset);
            B.push({ typ: "ausbuchung", datum: tag, name: name.name, isin: name.code, art: "Krypto", stueck: Math.abs(menge) + fee, kurs: null,
                     notiz: "Kraken Auszahlung", ref: "kr:" + z.txid });
          }
        }
      }
    }
  } else if (hat("Date (UTC)", "Type", "Asset", "Amount", "Value (EUR)", "Reference")) {
    // Kraken-App "Activities" (Konto → Verlauf → Exportieren). Geld (EUR) und Coins in einer
    // Liste. "Transfer" an ein anderes Konto (z. B. Challenge): in der Vorschau waehlbar,
    // ob Verlust oder Auszahlung (Vorgabe 08.11.: Challenges = Verlust).
    format = "Kraken – Aktivitäten (App)"; konto = "Kraken";
    // Gleiche Referenz mit einer Euro- und einer Coin-/Dollar-Zeile = Tausch (z. B. "Instant Spend/Receive"
    // im PDF-Kontoauszug): der Euro-Betrag der Gegenzeile ist das, was wirklich vom Konto ging.
    const eurJeRef = {}, coinJeRef = {};
    for (const z of daten) {
      if (!z.Reference) continue;
      if (istEuro(z.Asset)) eurJeRef[z.Reference] = (eurJeRef[z.Reference] || 0) + (zahlPunkt(z.Amount) || 0);
      else coinJeRef[z.Reference] = (coinJeRef[z.Reference] || 0) + 1;
    }
    for (const z of daten) {
      const typ = (z.Type || "").toLowerCase(), unter = (z.Subtype || "").toLowerCase(), menge = zahlPunkt(z.Amount) || 0;
      const tag = (z["Date (UTC)"] || "").slice(0, 10), ref = "kra:" + z.Reference, gegen = z["Counter party"] || "";
      const wertEur = zahlPunkt(z["Value (EUR)"]), feeEur = Math.abs(zahlPunkt(z["Fee (EUR)"]) || 0);
      const challenge = /challenge/i.test(z.Type + " " + z.Subtype);
      // Challenge gekauft (Vorgabe 08.11.): immer Verlust - in Euro direkt, in USD/Coin als Verkauf zu 0
      if (challenge && istEuro(z.Asset)) {
        B.push({ typ: "verlust", kontobewegung: true, datum: tag, name: TYPEN.verlust, betrag: -Math.abs(menge), gebuehr: feeEur, notiz: "Challenge gekauft", ref });
        continue;
      }
      if (challenge && menge < 0) {
        const c = krakenName(z.Asset);
        B.push({ typ: "verkauf", datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: c.code === "USD" ? "Fremdwährung" : "Krypto",
                 stueck: Math.abs(menge), kurs: 0, kasse: 0, gebuehr: feeEur, notiz: `Challenge gekauft – Verlust ${wertEur != null ? fEur.format(Math.abs(wertEur)) : ""}`, ref });
        continue;
      }
      if (istEuro(z.Asset)) {
        if (typ === "transfer") B.push({ typ: menge < 0 ? "verlust" : "bonus", transfer: true, kontobewegung: true, datum: tag, betrag: menge,
                                         gebuehr: feeEur, notiz: "Transfer " + (menge < 0 ? "an " + (gegen || "anderes Konto") : "von " + (gegen || "anderem Konto")), ref });
        else if (/deposit|einzahl/.test(unter + typ) || (typ.includes("payment") && menge > 0))
          B.push({ typ: "einzahlung", kontobewegung: true, datum: tag, name: TYPEN.einzahlung, betrag: menge, gebuehr: feeEur, ref });
        else if (/withdraw|auszahl/.test(unter + typ) || (typ.includes("payment") && menge < 0))
          B.push({ typ: "auszahlung", kontobewegung: true, datum: tag, name: TYPEN.auszahlung, betrag: menge, gebuehr: feeEur, notiz: gegen, ref });
        // Euro-Seite eines Kaufs/Verkaufs: steckt schon im Coin-Eintrag (Wert in EUR)
        continue;
      }
      const c = krakenName(z.Asset), kurs = zahlPunkt(z["Price (EUR)"]);
      const waehrung = ["USD", "GBP", "CHF", "CAD", "AUD", "JPY"].includes(c.code);
      const handel = /buy|sell|trade|swap|convert/.test(typ);
      const paar = !handel && coinJeRef[z.Reference] === 1 && eurJeRef[z.Reference] ? eurJeRef[z.Reference] : null;
      if (paar != null && menge) {
        // Kurs = gezahlte Euro je erhaltenem Stueck (Gebuehr und Spanne stecken darin)
        B.push({ typ: menge > 0 ? "kauf" : "verkauf", datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: waehrung ? "Fremdwährung" : "Krypto",
                 stueck: Math.abs(menge), kurs: Math.abs(paar) / Math.abs(menge), gebuehr: 0, kasse: paar, notiz: "Kraken " + (z.Type + " " + (z.Subtype || "")).trim(), ref });
      } else if (typ === "transfer" && waehrung && menge < 0) {
        // Dollar an ein anderes Konto (z. B. Challenge): wie der Euro-Transfer per Schalter Verlust oder Auszahlung
        B.push({ typ: "verkauf", transfer: true, datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: "Fremdwährung", stueck: Math.abs(menge),
                 kurs: 0, kasse: 0, gebuehr: feeEur, notiz: "Transfer an " + (gegen || "anderes Konto"), ref });
      } else if (handel) {
        const kauf = menge > 0;
        B.push({ typ: kauf ? "kauf" : "verkauf", datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: waehrung ? "Fremdwährung" : "Krypto", stueck: Math.abs(menge), kurs,
                 gebuehr: feeEur, kasse: wertEur != null ? (kauf ? -Math.abs(wertEur) : Math.abs(wertEur)) : null, ref });
      } else if (/reward|staking|earn|interest|airdrop|bonus/.test(typ + unter) && menge > 0) {
        B.push({ typ: "einbuchung", datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: "Krypto", stueck: menge, einstand: 0, kurs: null,
                 notiz: "Kraken " + z.Type, ref, ertrag: true });
      } else if (menge > 0) {
        B.push({ typ: "einbuchung", datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: "Krypto", stueck: menge, kurs, notiz: "Kraken " + z.Type, ref });
      } else if (menge < 0) {
        B.push({ typ: "ausbuchung", datum: tag, name: z["Asset Name"] || c.name, isin: c.code, art: "Krypto", stueck: Math.abs(menge), kurs: null, notiz: "Kraken " + z.Type, ref });
      }
    }
  } else if (hat("pair", "type", "price", "cost", "fee", "vol")) {
    // Kraken "Trades" (nur Handel, ohne Ein-/Auszahlungen und Staking).
    format = "Kraken – Trades"; konto = "Kraken";
    for (const z of daten) {
      const paar = z.pair.replace("/", "");
      const basis = paar.replace(/(ZEUR|EUR)$/, "");
      if (basis === paar) continue;                                  // nur Paare gegen Euro
      const name = krakenName(basis);
      B.push({ typ: z.type === "sell" ? "verkauf" : "kauf", datum: (z.time || "").slice(0, 10), name: name.name, isin: name.code,
               art: "Krypto", stueck: zahlPunkt(z.vol), kurs: zahlPunkt(z.price), gebuehr: zahlPunkt(z.fee) || 0,
               kasse: (z.type === "sell" ? 1 : -1) * zahlPunkt(z.cost), ref: "kr:" + z.txid });
    }
  } else if (hat("Type", "Currency", "Amount", "Quote Price", "Received / Paid Amount", "Transaction ID")) {
    // Bitvavo - Transaktionsverlauf (Web → Transaktionen → Export). Zahlen mit Punkt,
    // Verkauf mit negativer Menge. "Received / Paid Amount" = Euro-Seite des Handels,
    // Gebuehr extra (in Euro oder im Coin). Staking = Ertrag ohne Einstand.
    format = "Bitvavo – Transaktionen"; konto = "Bitvavo";
    for (const z of daten) {
      const typ = z.Type.toLowerCase(), menge = zahlPunkt(z.Amount) || 0, c = krakenName(z.Currency);
      const euroGeb = istEuro(z["Fee currency"]) ? Math.abs(zahlPunkt(z["Fee amount"]) || 0) : 0;
      const coinGeb = !istEuro(z["Fee currency"]) && z["Fee currency"] ? Math.abs(zahlPunkt(z["Fee amount"]) || 0) : 0;
      const ref = "bv:" + z["Transaction ID"], tag = z.Date, fertig = !z.Status || /completed|distributed/i.test(z.Status);
      if (istEuro(z.Currency)) {
        if (typ === "deposit" || typ === "withdrawal")
          B.push({ typ: typ === "deposit" ? "einzahlung" : "auszahlung", kontobewegung: true, datum: tag, name: TYPEN[typ === "deposit" ? "einzahlung" : "auszahlung"],
                   betrag: typ === "deposit" ? Math.abs(menge) : -Math.abs(menge), gebuehr: euroGeb, ref, storno: !fertig, grund: fertig ? "" : "Status " + z.Status });
        continue;
      }
      if (typ === "buy" || typ === "sell") {
        const euro = zahlPunkt(z["Received / Paid Amount"]) || 0, st = Math.abs(menge);
        if (!istEuro(z["Received / Paid Currency"])) {
          B.push({ typ: typ === "buy" ? "kauf" : "verkauf", datum: tag, name: c.name, isin: c.code, art: "Krypto", stueck: st, kurs: null, ref,
                   storno: true, grund: "nicht gegen Euro – bitte von Hand" }); continue;
        }
        B.push({ typ: typ === "buy" ? "kauf" : "verkauf", datum: tag, name: c.name, isin: c.code, art: "Krypto",
                 stueck: typ === "buy" ? st - coinGeb : st, kurs: st ? Math.abs(euro) / st : null, gebuehr: euroGeb, kasse: euro, ref,
                 storno: !fertig, grund: fertig ? "" : "Status " + z.Status });
      } else if (["staking", "rebate", "affiliate", "reward"].includes(typ) && menge > 0) {
        B.push({ typ: "einbuchung", datum: tag, name: c.name, isin: c.code, art: "Krypto", stueck: menge, einstand: 0, kurs: null,
                 notiz: "Bitvavo " + typ, ref, ertrag: true });
      } else if (typ === "deposit" && menge > 0) {
        B.push({ typ: "einbuchung", datum: tag, name: c.name, isin: c.code, art: "Krypto", stueck: menge, kurs: null, notiz: "Bitvavo Einzahlung (Einstand prüfen)", ref });
      } else if (typ === "withdrawal") {
        B.push({ typ: "ausbuchung", datum: tag, name: c.name, isin: c.code, art: "Krypto", stueck: Math.abs(menge) + coinGeb, kurs: null, notiz: "Bitvavo Auszahlung", ref });
      }
    }
  } else if (hat("Order ID", "Time", "Symbol", "Action", "Amount", "Filled Price", "Fee Unit")) {
    // OKX - Handelsverlauf (Assets → Order center → Trading history → Download).
    // Nur Spot gegen Euro; Derivate und USDT-Paare werden sichtbar uebersprungen.
    format = "OKX – Handelsverlauf"; konto = "OKX";
    for (const z of daten) {
      const [basis, quote] = (z.Symbol || "").toUpperCase().split(/[-/]/), c = krakenName(basis);
      const act = (z.Action || "").toLowerCase(), menge = Math.abs(zahlPunkt(z.Amount) || 0), kurs = zahlPunkt(z["Filled Price"]);
      const fee = Math.abs(zahlPunkt(z.Fee) || 0), feeEinheit = (z["Fee Unit"] || "").toUpperCase();
      const tag = (z.Time || "").slice(0, 10), ref = "okx:" + z["Order ID"] + ":" + z.Time + ":" + z.Amount;
      if (!["buy", "sell"].includes(act)) continue;
      const spot = !z["Trade Type"] || /spot/i.test(z["Trade Type"]);
      const grund = !spot ? "Derivat – noch nicht unterstützt" : quote !== "EUR" ? `Paar gegen ${quote || "?"} – nur Euro-Paare` : "";
      B.push({ typ: act === "buy" ? "kauf" : "verkauf", datum: tag, name: c.name, isin: c.code, art: "Krypto",
               stueck: act === "buy" && feeEinheit === basis ? menge - fee : menge, kurs,
               gebuehr: feeEinheit === "EUR" ? fee : feeEinheit === basis && act === "sell" ? fee * (kurs || 0) : 0,
               ref, storno: !!grund, grund });
    }
  } else if (hat("date", "type", "isin", "shares", "price", "amount")) {
    format = "Scalable Capital – Transaktionen"; konto = "Scalable";
    for (const z of daten) {
      if (z.assetType !== "Security") continue;
      const typ = { Buy: "kauf", "Savings plan": "kauf", Sell: "verkauf", Distribution: "dividende" }[z.type];
      if (!typ) continue;
      const storno = z.status && z.status !== "Executed";
      B.push({ typ, datum: z.date, name: z.description, isin: z.isin, art: artRaten(z.description), stueck: Math.abs(zahl(z.shares) || 0),
               kurs: zahl(z.price), betrag: typ === "dividende" ? Math.abs(zahl(z.amount) || 0) : null,
               gebuehr: Math.abs(zahl(z.fee) || 0), steuer: Math.abs(zahl(z.tax) || 0),
               ref: "sc:" + z.date + z.time + z.isin + z.type + z.shares,
               ueberspringen: storno, grund: storno ? "Status " + z.status : "" });
    }
  } else if (hat("TRANSAKTIONSTYP", "ISIN", "STÜCKE")) {
    format = "Smartbroker+ – Transaktionen"; konto = "Smartbroker";
    for (const z of daten) {
      const typ = { BUY: "kauf", SELL: "verkauf", DIVIDEND: "dividende" }[z.TRANSAKTIONSTYP];
      if (!typ) continue;
      const storno = z["STATUS DER TRANSAKTION"] && z["STATUS DER TRANSAKTION"] !== "CONFIRMED";
      B.push({ typ, datum: (z.HANDELSDATUM || z.VALUTADATUM || "").slice(0, 10), name: z["NAME 1"] || z["KÜRZEL"],
               isin: z.ISIN, art: artRaten(z["NAME 1"]), stueck: Math.abs(zahl(z["STÜCKE"]) || 0), kurs: zahl(z["AUSFÜHRUNGSKURS"]),
               betrag: typ === "dividende" ? zahl(z["GESAMTBETRAG IN KONTOWÄHRUNG"]) : null,
               gebuehr: Math.abs(zahl(z["GEBÜHREN IN KONTOWÄHRUNG"]) || 0), steuer: Math.abs(zahl(z["STEUERN IN KONTOWÄHRUNG"]) || 0),
               ref: "sb:" + z.DEPOTNUMMER + z["AUSFÜHRUNGSZEITPUNKT"] + z.ISIN + z.TRANSAKTIONSTYP + z["STÜCKE"],
               ueberspringen: storno, grund: storno ? "storniert" : "" });
    }
  } else if (hat("ISIN", "STÜCKE", "EINSTANDSWERT", "MARKTWERT")) {
    format = "Smartbroker+ – Depotbestand"; konto = "Smartbroker";
    for (const z of daten) {
      const st = zahl(z["STÜCKE"]);
      B.push({ typ: "einbuchung", datum: (z.DATUM || "").slice(0, 10), name: z["NAME 1"], isin: z.ISIN, stueck: st,
               einstand: zahl(z.EINSTANDSWERT), kurs: zahl(z["MARKTKURS PRO STÜCK"]),
               art: { Aktien: "Aktie", Fonds: "ETF" }[z.ASSETKLASSE] || z.ASSETKLASSE,
               ref: "sbb:" + z.DEPOTNUMMER + z.DATUM + z.ISIN, kursAusDatei: true });
    }
  } else if (hat("datum", "kennung", "kurs_eur")) {
    // Kursliste (Wochenkurse in Euro) - Kurse ohne Internet einspielen, z. B.
    // fuer den Testlauf oder wer Yahoo ganz meiden will. Keine Buchungen.
    const jeKennung = {};
    for (const z of daten) {
      const k = z.kennung.trim().toUpperCase(), c = zahl(z.kurs_eur), d = z.datum.trim();
      if (!k || c == null || !/^\d{4}-\d\d-\d\d$/.test(d)) continue;
      (jeKennung[k] ??= []).push([Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 1000, c]);
    }
    return { format: "Kursliste", kursliste: jeKennung };
  } else if (hat("Konto", "Instrument", "Stueck", "Wert_EUR", "Einstand_EUR")) {
    format = "Depot-Bestand (bestand.csv)";
    for (const z of daten) {
      // bestand.csv schreibt Zahlen mit Punkt ("11.354" = 11,354 Stueck Krypto),
      // also NICHT die deutsche Lesart von zahl() - die macht daraus 11354.
      const st = z.Stueck.trim() ? parseFloat(z.Stueck) : null, wert = parseFloat(z.Wert_EUR);
      const isin = (z.Notiz.match(/ISIN ([A-Z]{2}[A-Z0-9]{10})/) || [])[1] || "";
      // Ohne Stueckzahl (z. B. Sparplan nur mit Betrag): 1 "Stueck" zum Wert,
      // damit die Position mitzaehlt; angezeigt wird die Stueckzahl als "–".
      B.push({ typ: "einbuchung", datum: heute(), name: z.Instrument, isin, ticker: z.Ticker, art: z.Art, konto: z.Konto,
               stueck: st ?? 1, ohneStueck: st == null, einstand: parseFloat(z.Einstand_EUR), kurs: st ? wert / st : wert,
               haltefrist: (z.Haltefrist_Ende || "").trim().replace(/^(\d\d)\.(\d\d)\.(\d{4})$/, "$3-$2-$1"),
               notiz: z.Notiz, ref: "bc:" + z.Konto + z.Instrument, kursAusDatei: true });
    }
  } else {
    // Unbekanntes Format: Spalten zuordnen (jeder Broker, auch Kontoauszuege). Gemerkte Zuordnung direkt anwenden.
    if (kopf.length < 2 || !daten.length) throw new Error("Format nicht erkannt. Spalten: " + kopf.slice(0, 6).join(", "));
    const roh = { kopf, daten, dateiname };
    const gemerkt = (S.einstellungen?.zuordnungen || {})[kopfSignatur(kopf)];
    if (gemerkt) return zuordnungAnwenden(roh, gemerkt);
    return { format: "Unbekannt", zuordnen: { ...roh, z: zuordnungRaten(kopf, daten) } };
  }

  if (!B.length) throw new Error(`${format}: keine Buchungen in der Datei gefunden (nur Kopfzeile oder falscher Zeitraum?).`);
  for (const b of B) if (b.ueberspringen) b.storno = true;
  const v = { format, konto: konto || B.find((b) => b.konto)?.konto || dateiname.replace(/\.[^.]+$/, "").slice(0, 30), buchungen: B, mitKonto: true };
  vorschauPruefen(v);
  return v;
}

// ------------------------------------------------------------ Originale (ab 0.44): jede importierte Datei wird im App-Speicher aufgehoben
function bytesZuB64(b) {
  let s = "";
  for (let i = 0; i < b.length; i += 32768) s += String.fromCharCode.apply(null, b.subarray(i, i + 32768));
  return btoa(s);
}
const b64ZuBytes = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
const dateiTyp = (name) => /\.pdf$/i.test(name) ? "PDF" : /\.(png|jpe?g|webp)$/i.test(name) ? "Screenshot" : /\.csv$/i.test(name) ? "CSV" : "Datei";
/** Nach dem Uebernehmen: Original ablegen (oder ein vorhandenes dem neuen Import zuordnen). */
function originalMerken(o, importId, depotId) {
  if (!o || !APP?.originalAblegen) return;
  if (o.vorhanden) {                                   // "neu einlesen": dasselbe Original, kein zweites Exemplar
    const x = (S.originale || []).find((y) => y.id === o.vorhanden);
    if (x) { x.importId = importId; x.depot = depotId; return; }
  }
  const id = APP.originalAblegen(bytesZuB64(o.roh));
  if (!id) return;
  (S.originale ??= []).push({ id, name: o.name, typ: dateiTyp(o.name), groesse: o.roh.length, zeit: new Date().toISOString(), depot: depotId, importId });
}
function originaleLoeschen(importIds) {
  const weg = (S.originale || []).filter((x) => importIds.has(x.importId));
  for (const x of weg) APP?.originalLoeschen?.(x.id);
  S.originale = (S.originale || []).filter((x) => !weg.includes(x));
  return weg.length;
}
/** Dateiname im ZIP: originale/<Depot>/<Datum>_<Name> (doppelte Namen bekommen eine Nummer). */
function zipIndex() {
  const belegt = new Set();
  return (S.originale || []).map((x) => {
    const sauber = (s) => String(s || "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "_").trim().slice(0, 80) || "Datei";
    const depot = sauber(S.depots[x.depot]?.name || "ohne Depot");
    let pfad = `originale/${depot}/${String(x.zeit || "").slice(0, 10)}_${sauber(x.name)}`, k = 2;
    while (belegt.has(pfad)) pfad = pfad.replace(/(\.[^./]+)?$/, (e) => ` (${k++})` + (e || ""));
    belegt.add(pfad);
    return { ...x, pfad, depotName: S.depots[x.depot]?.name || "" };
  });
}
function zipExportieren() {
  if (!APP?.zipExport) return meldung("Export gibt es nur in der App.");
  const index = zipIndex(), tag = heute();
  const liesmich = `Depot-Kompass – Export vom ${datum(tag)}\r\n\r\n` +
    `depot-kompass.json = alle Daten der App (Depots, Buchungen, Watchlist, Notizen, Einstellungen)\r\n` +
    `originale.json  = Verzeichnis der Original-Dateien\r\n` +
    `originale/      = alle importierten Dateien im Original, sortiert nach Depot (${index.length} Dateien)\r\n\r\n` +
    `Wiederherstellen: in der App unter Import diese ZIP wählen und das Sicherungs-Passwort eingeben.\r\n` +
    `Am PC öffnen: 7-Zip, WinZip oder Keka mit demselben Passwort (AES-256).\r\n`;
  const r = APP.zipExport(JSON.stringify(index), `Depot-Kompass-Export-${tag}.zip`, liesmich);
  if (r === "kein Passwort") { meldung("Erst ein Sicherungs-Passwort festlegen (⚙️ → Sicherheit & Sicherung)."); return zeige("sicherheit"); }
  if (r === "gesperrt") return meldung("App ist gesperrt – bitte erst entsperren.");
  if (!r.startsWith("ok")) return meldung("Export fehlgeschlagen: " + r);
  meldung(`ZIP mit ${anzahl(index.length, "Original", "Originalen")} erstellt – jetzt den Speicherort wählen.` + (r.startsWith("ok:") ? ` (${r.slice(3)} fehlten)` : ""));
}

// ------------------------------------------------------------ PDF-Import (ab 0.31, liest pdflesen.js)
const istZahlText = (s) => /^[-+]?\d[\d.,]*$/.test(String(s).trim());
const csvFeld = (x) => '"' + String(x ?? "").replace(/"/g, '""') + '"';
const ISIN_RE = /\b([A-Z]{2}[A-Z0-9]{9}\d)\b/;
const MONATE = { jan: 1, januar: 1, january: 1, feb: 2, februar: 2, february: 2, mar: 3, "mär": 3, "märz": 3, maerz: 3, march: 3, apr: 4, april: 4, mai: 5, may: 5,
                 jun: 6, juni: 6, june: 6, jul: 7, juli: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oct: 10, oktober: 10, october: 10,
                 nov: 11, november: 11, dez: 12, dec: 12, dezember: 12, december: 12 };
const isoTag = (j, m, t) => `${j}-${String(m).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
const vortagVon = (iso) => new Date(Date.parse(iso + "T12:00Z") - 864e5).toISOString().slice(0, 10);

/** Datum am Anfang eines Textes, auch mit Monatsnamen: "02.03.2026", "2026-03-02", "01 Juli 2026", "26 Sept. 2026", "Oct 01, 2026". */
function datumText(s) {
  const t = String(s || "").trim();
  let m;
  if ((m = t.match(/^(\d{4})-(\d\d)-(\d\d)/))) return isoTag(m[1], +m[2], +m[3]);
  if ((m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4}|\d{2})(?!\d)/))) return isoTag(m[3].length === 2 ? "20" + m[3] : m[3], +m[2], +m[1]);
  if ((m = t.match(/^(\d{1,2})\.?\s+([A-Za-zäÄ]{3,})\.?\s+(\d{4})/)) && MONATE[m[2].toLowerCase()]) return isoTag(m[3], MONATE[m[2].toLowerCase()], +m[1]);
  if ((m = t.match(/^([A-Za-z]{3,})\.?\s+(\d{1,2}),?\s+(\d{4})/)) && MONATE[m[1].toLowerCase()]) return isoTag(m[3], MONATE[m[1].toLowerCase()], +m[2]);
  return null;
}

/** Geldbetrag aus einer PDF-Zelle: "40,00€", "+20,68 EUR", "-1.200,50", "12,50-", "1,234.56", "250,00 S". */
function geldLesen(s) {
  let t = String(s ?? "").replace(/EUR|€|\s/g, "").replace(/^\+/, "");
  if (!t) return null;
  let minus = false;
  if (/[-S]$/.test(t)) { minus = true; t = t.slice(0, -1); } else if (/H$/.test(t)) t = t.slice(0, -1);
  if (!/^-?\d[\d.,]*$/.test(t)) return null;
  const n = /\.\d{1,2}$/.test(t) && t.includes(",") ? parseFloat(t.replace(/,/g, "")) : zahl(t);
  return n == null ? null : minus ? -Math.abs(n) : n;
}
const erstesGeld = (s) => { for (const w of String(s ?? "").split(/\s+(?=[-+]?\d)/)) { const g = geldLesen(w); if (g != null) return g; } return geldLesen(s); };

/** Zellen einer Zeile den Spalten einer Kopfzeile zuordnen (nach Lage: linker Rand, rechter Rand oder Mitte). */
function spaltenLeser(spalten) {
  const von = (c) => {
    let b = 0, d = Infinity;
    spalten.forEach((k, i) => { const x = Math.min(Math.abs(c.x - k.x), Math.abs(c.x2 - k.x2), Math.abs((c.x + c.x2) / 2 - (k.x + k.x2) / 2)); if (x < d) { d = x; b = i; } });
    return b;
  };
  return (z) => { const o = {}; if (z) for (const c of z.zellen) { const k = spalten[von(c)].s; o[k] = (o[k] ? o[k] + " " : "") + c.s; } return o; };
}

/** PDF -> Vorschau. Bekannte Formate direkt, sonst die Tabelle der PDF in "Spalten zuordnen". */
function erkennenPdf(pdf, dateiname) {
  for (const f of [abrechnungPdf, krakenAuszug, krakenLedgerPdf, krakenBestandPdf, krakenBeleg, bankAuszug]) {
    const v = f(pdf, dateiname);
    if (v) { vorschauPruefen(v); return v; }
  }
  if (/Kein Bestand vorhanden/i.test(pdf.text)) throw new Error("Depotaufstellung: kein Bestand vorhanden – nichts zu übernehmen.");
  const tab = pdfTabelle(pdf);
  if (!tab || !tab.daten.length) throw new Error("PDF gelesen, aber keine Tabelle mit Datum und Betrag gefunden. Dieses PDF-Format kennt die App noch nicht.");
  const roh = { kopf: tab.kopf, daten: tab.daten, dateiname };
  const gemerkt = (S.einstellungen?.zuordnungen || {})[kopfSignatur(tab.kopf)];
  if (gemerkt) return zuordnungAnwenden(roh, gemerkt);
  return { format: "PDF – Tabelle", zuordnen: { ...roh, z: zuordnungRaten(tab.kopf, tab.daten) } };
}

/** Kraken "Account Statement" / "Monthly Statement" (Kontoauszug als PDF - mehr gibt Kraken in der App nicht her).
 *  - "Portfolio": Bestand zu Beginn -> Anfangsbestand am Tag vor dem Zeitraum (Einstand = Wert an dem Tag).
 *  - "Activity": dieselben Spalten wie der CSV-Export der App -> gleiche Regeln (Transfers, Ertraege, Tausch).
 *  Die Gebuehr zieht Kraken vom erhaltenen Coin ab (steht nur gerundet in Euro da). Damit die Stueckzahl
 *  am Ende genau dem "Close Qty" des Auszugs entspricht, wird sie daran ausgerichtet. */
function krakenAuszug(pdf, dateiname) {
  const alle = pdf.seiten.flat();
  const kopfA = alle.find((z) => z.zellen.some((c) => c.s === "Date (UTC)") && z.zellen.some((c) => c.s === "Reference"));
  const t1 = alle.map((z) => z.text.match(/^Account Statement:\s*([A-Za-z]{3})\w* (\d{1,2}), (\d{4})\s*-/)).find(Boolean);
  const t2 = alle.map((z) => z.text.match(/^Monthly Statement:\s*([A-Za-z]{3})\w* (\d{4})/)).find(Boolean);
  if ((!t1 && !t2) || (!kopfA && !alle.some((z) => z.zellen.some((c) => c.s === "Open Qty")))) return null;
  const beginn = t1 ? isoTag(t1[3], MONATE[t1[1].toLowerCase()] || 1, +t1[2]) : isoTag(t2[2], MONATE[t2[1].toLowerCase()] || 1, 1);
  const vortag = vortagVon(beginn);
  const p = (s) => zahlPunkt(String(s).replace(/,/g, "")) ?? 0;        // Kraken schreibt 1,234.56

  // Portfolio: je Asset Anfangs- und Endbestand (Spot + Earn zusammen)
  const bestandP = {};
  let bereich = "", aktie = false;
  for (const z of alle) {
    if (z.zellen.some((c) => c.s === "Open Qty")) { bereich = "portfolio"; continue; }
    if (z.zellen.some((c) => c.s === "Date (UTC)")) { bereich = "aktiv"; continue; }
    if (/^Stock Portfolio$/.test(z.text)) aktie = true;
    if (bereich !== "portfolio" || z.zellen.length < 9) continue;
    const c = z.zellen.map((x) => x.s), w = c.slice(-7);
    if (!w.every(istZahlText) || istZahlText(c[0])) continue;
    const e = bestandP[c[0]] ??= { auf: 0, aufWert: 0, zu: 0, aktie };
    e.auf += p(w[0]); e.aufWert += p(w[2]); e.zu += p(w[3]);
  }

  // Activity: Ankerzeile = die mit Betrag und Referenz; Datum/Uhrzeit und Art stehen in den Zeilen darueber/darunter
  const zeilen = [];
  if (kopfA) {
    const sp = Object.fromEntries(kopfA.zellen.map((c) => [c.s, c]));
    const bei = (z, name, rechts) => !z || !sp[name] ? undefined
      : z.zellen.find((c) => Math.abs((rechts ? c.x2 : c.x) - (rechts ? sp[name].x2 : sp[name].x)) < 4)?.s;
    const liste = alle.slice(alle.indexOf(kopfA) + 1).filter((z) => !z.zellen.some((c) => c.s === "Date (UTC)") &&
      !/^(Account Statement:|Monthly Statement:|All portfolio balances|Page \d+\/\d+$|\d+\/\d+$)/.test(z.text));
    const anker = (z) => !!(z && bei(z, "Reference") && istZahlText(bei(z, "Amount", true) ?? "") && bei(z, "Asset"));
    for (let i = 0; i < liste.length; i++) {
      const z = liste[i];
      if (/^Disclaimer/.test(z.text)) break;
      if (!anker(z)) continue;
      const vor = anker(liste[i - 1]) ? null : liste[i - 1], nach = anker(liste[i + 1]) ? null : liste[i + 1];
      const tag = (bei(vor, "Date (UTC)") || "").match(/^\d{4}-\d\d-\d\d$/)?.[0];
      if (!tag) throw new Error("Kraken-Kontoauszug: Datum einer Zeile nicht lesbar (" + z.text.slice(0, 40) + ").");
      const uhr = (bei(nach, "Date (UTC)") || "").match(/^\d\d:\d\d:\d\d$/)?.[0] || "00:00:00";
      zeilen.push({ datum: tag + " " + uhr, typ: bei(vor, "Type") || bei(z, "Type") || "", unter: bei(nach, "Type") || "",
                    asset: bei(z, "Asset"), menge: p(bei(z, "Amount", true)), kurs: p(bei(z, "Price (EUR)", true) ?? 0),
                    geb: Math.abs(p(bei(z, "Fee (EUR)", true) ?? 0)), wert: p(bei(z, "Value (EUR)", true) ?? 0),
                    gegen: [bei(vor, "Counter party"), bei(z, "Counter party"), bei(nach, "Counter party")].filter(Boolean).join(" "), ref: bei(z, "Reference") });
    }
  }
  if (!zeilen.length && !Object.values(bestandP).some((e) => e.auf > 0 || e.zu > 0))
    throw new Error("Kraken-Kontoauszug: im Zeitraum kein Bestand und keine Buchungen – nichts zu übernehmen.");

  // Gebuehr in Stueck: geschaetzt aus Euro-Gebuehr / Kurs, dann am Endbestand des Auszugs ausgerichtet
  const jeAsset = {};
  for (const z of zeilen) if (!istEuro(z.asset)) (jeAsset[z.asset] ??= []).push(z);
  for (const [asset, l] of Object.entries(jeAsset)) {
    const brutto = l.reduce((a, z) => a + z.menge, 0), gesch = l.reduce((a, z) => a + (z.kurs > 0 ? z.geb / z.kurs : 0), 0);
    const pf = bestandP[asset] || { auf: 0, zu: 0 };
    const echt = brutto - (pf.zu - pf.auf);                                 // was laut Portfolio wirklich abging
    const faktor = gesch > 0 && echt > 0 && echt / gesch > 0.5 && echt / gesch < 1.5 ? echt / gesch : 1;
    for (const z of l) z.netto = z.menge - (z.kurs > 0 ? z.geb / z.kurs : 0) * faktor;
  }

  const start = [];
  for (const [asset, e] of Object.entries(bestandP)) {
    if (!(e.auf > 0)) continue;
    if (istEuro(asset)) {
      start.push({ typ: "einzahlung", kontobewegung: true, datum: vortag, name: TYPEN.einzahlung, betrag: e.auf, notiz: "Anfangsbestand laut Kontoauszug",
                   ref: "krpdf:start:EUR", startbestand: true });
    } else {
      const c = krakenName(asset);
      start.push({ typ: "einbuchung", datum: vortag, name: c.name, isin: c.code, art: e.aktie ? "Aktie" : ["USD", "GBP", "CHF"].includes(c.code) ? "Fremdwährung" : "Krypto",
                   stueck: e.auf, kurs: e.aufWert / e.auf, einstand: e.aufWert, notiz: "Anfangsbestand laut Kontoauszug (Einstand = Wert am " + datum(vortag) + ")",
                   ref: "krpdf:start:" + c.code, startbestand: true });
    }
  }
  let v = { format: "", konto: "Kraken", buchungen: [], mitKonto: true };
  if (zeilen.length) {
    const csv = ['"Date (UTC)","Type","Subtype","Asset","Asset Name","Wallet","Amount","Price (EUR)","Fee","Fee (EUR)","Value (EUR)","Counter party","Reference"']
      .concat(zeilen.map((z) => [z.datum, z.typ, z.unter, z.asset, "", "", istEuro(z.asset) ? z.menge : +(z.netto ?? z.menge).toFixed(10), z.kurs, 0,
                                 istEuro(z.asset) ? z.geb : 0, z.wert, z.gegen, z.ref].map(csvFeld).join(","))).join("\n");
    v = erkennen(csv, dateiname);
  }
  v.format = "Kraken – Kontoauszug (PDF)";
  v.buchungen = [...start, ...v.buchungen];
  for (const b of v.buchungen) { b.auszug = true; b.weich = true; }
  v.ziel = undefined;
  return v;
}

/** Kraken "Ledgers" als PDF (Kraken Pro → Dokumente). Aufbau wie der Ledger-CSV, aber ohne refid und
 *  auf 4 Stellen gerundet: Kauf = "Instant Spend" (Euro) + "Instant Receive" (Coin) zur selben Sekunde. */
function krakenLedgerPdf(pdf, dateiname) {
  const alle = pdf.seiten.flat();
  const kopf = alle.find((z) => z.zellen.some((c) => c.s === "Unique ID") && z.zellen.some((c) => c.s === "Time (UTC)"));
  if (!kopf) return null;
  if (!kopf.zellen.some((c) => c.s === "Resulting Balance")) {
    if (alle.some((z) => /no activity/i.test(z.text))) throw new Error("Kraken-PDF: keine Buchungen im Zeitraum – nichts zu übernehmen.");
    return null;                                                   // z. B. Trades-PDF mit Zeilen -> Tabellen-Weg
  }
  const lese = spaltenLeser(kopf.zellen);
  const liste = alle.slice(alle.indexOf(kopf) + 1).filter((z) => z.text !== kopf.text && !/^(Page \d+ of \d+|Statement Period)/.test(z.text)).map((z) => lese(z));
  const anker = (o) => !!o && /^[A-Z0-9]{4,}-[A-Z0-9]{4,}-[A-Z0-9]{4,}$/.test(o["Unique ID"] || "");
  const csv = ['"txid","refid","time","type","subtype","aclass","asset","wallet","amount","fee","balance"'];
  for (let i = 0; i < liste.length; i++) {
    const o = liste[i];
    if (!anker(o)) continue;
    const vor = anker(liste[i - 1]) ? {} : liste[i - 1] || {}, nach = anker(liste[i + 1]) ? {} : liste[i + 1] || {};
    const zeit = [vor["Time (UTC)"], o["Time (UTC)"], nach["Time (UTC)"]].filter(Boolean).join(" ");
    const tag = zeit.match(/\d{4}-\d\d-\d\d/)?.[0], uhr = zeit.match(/\d\d:\d\d:\d\d/)?.[0] || "00:00:00";
    if (!tag) throw new Error("Kraken-Ledger: Datum einer Zeile nicht lesbar (" + o["Unique ID"] + ").");
    const worte = [vor.Type, o.Type, nach.Type].filter(Boolean).join(" ").toLowerCase().split(/\s+/);
    let typ = worte[0] || "", unter = worte.slice(1).join(" ");
    if (typ === "instant" && unter) { typ = unter; unter = ""; }             // Instant Spend / Receive
    const paar = ["spend", "receive", "trade"].includes(typ);
    csv.push([o["Unique ID"], paar ? "zeit:" + tag + uhr : o["Unique ID"], tag + " " + uhr, typ, unter, "currency", o.Asset || "", o.Wallet || "",
              String(o.Amount || "0").replace(/,/g, ""), String(o.Fee || "0").replace(/,/g, ""), String(o["Resulting Balance"] || "").replace(/,/g, "")].map(csvFeld).join(","));
  }
  if (csv.length < 2) throw new Error("Kraken-Ledger: keine Buchungen im Zeitraum – nichts zu übernehmen.");
  const v = erkennen(csv.join("\n"), dateiname);
  for (const b of v.buchungen) if (b.stueck) b.stueck = +(+b.stueck).toFixed(10);
  v.format = "Kraken – Ledger (PDF)";
  v.hinweis = "Das Ledger-PDF rundet Stückzahlen auf 4 Stellen. Genauer ist der Kontoauszug („Account Statement“).";
  for (const b of v.buchungen) { b.auszug = true; b.weich = true; }
  v.ziel = undefined;
  return v;
}

/** Kraken "Balance Report": Bestand zu einem Stichtag (Preise meist in Dollar - umgerechnet ueber die Euro-Zeile). */
function krakenBestandPdf(pdf) {
  const alle = pdf.seiten.flat();
  const titel = alle.map((z) => z.text.match(/^Balance Report\s*\S?\s*Statement Date:\s*(.+)$/)).find(Boolean);
  if (!titel) return null;
  const tag = datumText(titel[1]) || heute();
  const p = (s) => zahlPunkt(String(s).replace(/,/g, "")) ?? 0;
  const waehrung = (alle.map((z) => z.text.match(/Price \(([A-Z]{3})\)/)).find(Boolean) || [])[1] || "USD";
  const reihen = [];
  let aktie = false;
  for (const z of alle) {
    if (/^Stocks? Portfolio$/.test(z.text)) aktie = true;
    const c = z.zellen.map((x) => x.s);
    if (c.length === 6 && c.slice(-3).every(istZahlText) && !istZahlText(c[1])) reihen.push({ name: c[0], code: c[1], st: p(c[3]), kurs: p(c[4]), wert: p(c[5]), aktie });
  }
  const eurKurs = waehrung === "EUR" ? 1 : reihen.find((r) => istEuro(r.code))?.kurs || null;      // 1 Euro in Dollar
  const B = [];
  for (const r of reihen) {
    if (!(r.st > 0)) continue;
    if (istEuro(r.code)) { B.push({ typ: "einzahlung", kontobewegung: true, datum: tag, name: TYPEN.einzahlung, betrag: r.st, notiz: "Kontostand laut Balance Report", ref: "krpdf:start:EUR", startbestand: true }); continue; }
    const c = krakenName(r.code), wertEur = eurKurs ? r.wert / eurKurs : null;
    B.push({ typ: "einbuchung", datum: tag, name: KRYPTO_NAMEN[c.code] || r.name || c.name, isin: c.code, art: r.aktie ? "Aktie" : ["USD", "GBP", "CHF"].includes(c.code) ? "Fremdwährung" : "Krypto",
             stueck: r.st, kurs: wertEur != null ? wertEur / r.st : null, einstand: wertEur ?? 0, kursAusDatei: wertEur != null,
             notiz: "Bestand laut Balance Report" + (wertEur != null ? " (Einstand = Wert am " + datum(tag) + ")" : " (ohne Euro-Wert)"), ref: "krpdf:start:" + c.code, startbestand: true });
  }
  if (!B.length) throw new Error("Kraken-Balance-Report: kein Bestand in der Datei.");
  for (const b of B) { b.auszug = true; b.weich = true; }
  return { format: "Kraken – Bestand (PDF)", konto: "Kraken", buchungen: B, mitKonto: true,
           hinweis: "Bestand zum " + datum(tag) + ". Wird nur für Werte übernommen, die noch nicht im Depot sind." };
}

/** Kraken-Kaufbeleg (E-Mail "Du hast ADA gekauft", als PDF gedruckt): ein Kauf je Datei. */
// ------------------------------------------------------------ Wertpapier-Abrechnungen als PDF (ab 0.49)
// Eine Abrechnung = eine Buchung. Erkannt: Scalable Capital (ab 2024), Baader Bank (aeltere Scalable-/Smartbroker-Abrechnungen),
// Smartbroker+ / DAB BNP Paribas, Trade Republic, Revolut. Alles offline aus dem PDF-Text, mit Gegenprobe gegen den Endbetrag.
function abrSumme(t, re) { let s = 0; for (const m of t.matchAll(re)) s += Math.abs(zahl(m[m.length - 1]) || 0); return s; }
function abrBuchung(f) {
  const verkauf = f.typ === "verkauf", passend = wertZuName(f.name);
  const name = passend?.inst?.name || f.name, art = passend?.inst?.art || artRaten(f.name);
  const brutto = f.stueck * f.kurs, soll = verkauf ? brutto - f.gebuehr - f.steuer : brutto + f.gebuehr;
  const endbetrag = f.endbetrag != null ? Math.abs(f.endbetrag) : null;
  const stimmt = endbetrag != null && Math.abs(soll - endbetrag) <= 0.02 + 0.001 * endbetrag;
  const b = { typ: f.typ, datum: f.datum, name, isin: f.isin || (passend ? passend.id : ""), art, stueck: f.stueck, kurs: f.kurs,
              gebuehr: f.gebuehr, steuer: verkauf ? f.steuer : 0, kasse: endbetrag != null ? (verkauf ? endbetrag : -endbetrag) : (verkauf ? soll : -soll),
              notiz: f.broker + "-Abrechnung (PDF)" + (f.sparplan ? " · Sparplan" : ""), ref: "abr:" + f.datum + "|" + (f.isin || nameNorm(f.name)) + "|" + f.stueck + "|" + f.typ,
              weich: true, auszug: true };
  const f2 = (n) => fEur.format(n);
  const konto = { "Scalable Capital": "Scalable", "Smartbroker+": "Smartbroker" }[f.broker] || f.broker;     // wie die CSV-Importe -> gleiches Depot
  return { format: f.broker + " – Abrechnung (PDF)", konto, buchungen: [b], mitKonto: true,
           hinweis: (stimmt ? `Gegenprobe: ${fZahl.format(f.stueck)} × ${f2(f.kurs)} ${verkauf ? "−" : "+"} Kosten = ${f2(endbetrag)} – stimmt.`
                            : `Achtung: ${fZahl.format(f.stueck)} × ${f2(f.kurs)} ergibt nicht den Endbetrag ${endbetrag != null ? f2(endbetrag) : "?"} – bitte prüfen.`) };
}
function abrechnungPdf(pdf) {
  const t = pdf.text.replace(/ /g, " ");
  const tag = (s) => s ? datumText(s) : null;
  // Scalable Capital (eigene Bank, ab 2024): "Kauf <Name> 3,00 Stk. 6,168 EUR 18,50 EUR" + ISIN, "Ordergebühren", "Total"
  if (/Scalable Capital/i.test(t) && /Wertpapierabrechnung/i.test(t)) {
    const m = t.match(/\b(Kauf|Verkauf)\s+(.+?)\s+([\d.,]+)\s+Stk\.\s+([\d.,]+)\s+EUR\s+([\d.,]+)\s+EUR/);
    if (m) {
      const nach = t.slice(t.indexOf(m[0]) + m[0].length), isin = (nach.match(ISIN_RE) || [])[1] || "";
      return abrBuchung({ broker: "Scalable Capital", typ: m[1] === "Kauf" ? "kauf" : "verkauf", name: m[2].trim(), isin, stueck: zahl(m[3]), kurs: zahl(m[4]),
        gebuehr: abrSumme(t, /(?<!Berücksichtigte )(?:Ordergebühren|Fremdkostenzuschlag|Handelsplatzgebühr)\s+([+-]?[\d.,]+)\s+EUR/g),
        steuer: abrSumme(t, /(?:Kapitalertrags?steuer|Solidaritätszuschlag|Kirchensteuer)\s+([+-]?[\d.,]+)\s+EUR/g),
        endbetrag: zahl((t.match(/\b(?:Total|Belastung|Gutschrift)\s+(-?[\d.,]+)\s+EUR/) || [])[1]), datum: tag((t.match(/Ausführung\s+(\d{2}\.\d{2}\.\d{4})/) || t.match(/Datum\s+(\d{2}\.\d{2}\.\d{4})/) || [])[1]),
        sparplan: /Sparplanausführung/i.test(t) });
    }
  }
  // Baader Bank (aeltere Scalable-/Smartbroker-Abrechnungen): "Wertpapierabrechnung: Kauf", "STK 2 <Name> EUR 104,37"
  if (/Baader Bank/i.test(t) && /Wertpapierabrechnung:\s*(Kauf|Verkauf)/i.test(t)) {
    const art = t.match(/Wertpapierabrechnung:\s*(Kauf|Verkauf)/i)[1].toLowerCase(), m = t.match(/STK\s+([\d.,]+)\s+(.+?)\s+EUR\s+([\d.,]+)/);
    if (m) {
      const end = t.match(/Zu (?:Lasten|Gunsten) Konto[^\n]*?EUR\s+([\d.,]+)/);
      return abrBuchung({ broker: /Scalable Capital/i.test(t) ? "Scalable Capital" : "Baader Bank", typ: art, name: m[2].trim(), isin: (t.match(/ISIN:\s*([A-Z]{2}[A-Z0-9]{9}\d)/) || [])[1] || "",
        stueck: zahl(m[1]), kurs: zahl(m[3]),
        gebuehr: abrSumme(t, /(?:Provision|Börsengebühr|Handelsplatzgebühr|Transaktionsentgelt|Fremde Spesen)\s+EUR\s+([\d.,]+)/g),
        steuer: abrSumme(t, /(?:Kapitalertragsteuer|Solidaritätszuschlag|Kirchensteuer)\s+EUR\s+([\d.,]+)/g),
        endbetrag: end ? zahl(end[1]) : null, datum: tag((t.match(/Handelsdatum[\s\S]{0,40}?(\d{2}\.\d{2}\.\d{4})/) || t.match(/Auftragsdatum:\s*(\d{2}\.\d{2}\.\d{4})/) || [])[1]) });
    }
  }
  // Smartbroker+ / DAB BNP Paribas: "Wir haben für Sie gekauft", Name + ISIN, "STK 0,9192 EUR 163,1900", "Betrag zu Ihren Lasten"
  if (/Wir haben für Sie (gekauft|verkauft)/i.test(t)) {
    const art = /verkauft/i.test(t.match(/Wir haben für Sie (gekauft|verkauft)/i)[1]) ? "verkauf" : "kauf";
    const kopf = t.match(/Gattungsbezeichnung\s+ISIN\s*\n\s*(.+?)\s+([A-Z]{2}[A-Z0-9]{9}\d)\s*$/m), st = t.match(/STK\s+([\d.,]+)\s+EUR\s+([\d.,]+)/);
    if (kopf && st) {
      const end = t.match(/Betrag zu Ihren (?:Lasten|Gunsten)[^\n]*\n[^\n]*?EUR\s+([\d.,]+)/);
      return abrBuchung({ broker: "Smartbroker+", typ: art, name: kopf[1].trim(), isin: kopf[2], stueck: zahl(st[1]), kurs: zahl(st[2]),
        gebuehr: abrSumme(t, /(?:Provision|Börsenentgelt|Handelsplatzentgelt|Transaktionsentgelt|Fremde Spesen|Maklercourtage|Fremdkosten)\s+EUR\s+([\d.,]+)-?/g),
        steuer: abrSumme(t, /(?<!einbehaltene |einbehaltener )(?:Kapitalertragsteuer|Solidaritätszuschlag|Kirchensteuer)\s+EUR\s+([\d.,]+)-?/g),       // nicht die Jahres-Summenzeilen
        endbetrag: end ? zahl(end[1]) : null, datum: tag((t.match(/Handelstag\s+(\d{2}\.\d{2}\.\d{4})/) || [])[1]) });
    }
  }
  // Trade Republic: "WERTPAPIERABRECHNUNG", "Market-Order Kauf am 13.05.2019", "<Name> 1 Stk. 24,045 EUR 24,05 EUR", ISIN, "GESAMT"
  if (/TRADE REPUBLIC/i.test(t) && /WERTPAPIERABRECHNUNG/.test(t)) {
    const kopf = t.match(/\b(Kauf|Verkauf)\s+am\s+(\d{2}\.\d{2}\.\d{4})/), m = t.match(/^(.+?)\s+([\d.,]+)\s+Stk\.\s+([\d.,]+)\s+EUR\s+([\d.,]+)\s+EUR/m);
    if (kopf && m) {
      const nach = t.slice(t.indexOf(m[0]) + m[0].length), isin = (nach.match(ISIN_RE) || [])[1] || "";
      const gesamt = [...t.matchAll(/GESAMT\s+(-?[\d.,]+)\s+EUR/g)].map((x) => zahl(x[1]));
      return abrBuchung({ broker: "Trade Republic", typ: kopf[1] === "Kauf" ? "kauf" : "verkauf", name: m[1].trim(), isin, stueck: zahl(m[2]), kurs: zahl(m[3]),
        gebuehr: abrSumme(t, /(?:Fremdkostenzuschlag|Ordergebühr|Gebühr)\s+(-?[\d.,]+)\s+EUR/g),
        steuer: abrSumme(t, /(?:Kapitalertrags?steuer|Solidaritätszuschlag|Kirchensteuer)\s+(-?[\d.,]+)\s+EUR/g),
        endbetrag: gesamt.length ? gesamt[gesamt.length - 1] : null, datum: tag(kopf[2]), sparplan: /Sparplan/i.test(t) });
    }
  }
  // Revolut: "Trade Confirmation", "<Symbol> <Name> <ISIN> Buy 2.61848651 €38.19 €100 06 Jan 2025"
  if (/Trade Confirmation/i.test(t) && /Revolut/i.test(t)) {
    const m = t.match(/\s(.+?)\s+([A-Z]{2}[A-Z0-9]{9}\d)\s+(Buy|Sell)\s+([\d.,]+)\s+[€$£]([\d.,]+)\s+[€$£]([\d.,]+)/);
    if (m) {
      const en = (s) => zahlPunkt(String(s).replace(/,/g, ""));
      const name = m[1].replace(/^\S+\s+/, "").trim();            // Symbol vorne weg
      const d = t.match(/Confirmation date\s+(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/), MON = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };
      return abrBuchung({ broker: "Revolut", typ: m[3] === "Buy" ? "kauf" : "verkauf", name, isin: m[2], stueck: en(m[4]), kurs: en(m[5]),
        gebuehr: en((t.match(/Total Fee charged\s+[€$£]([\d.,]+)/) || [])[1] || 0) || 0, steuer: 0, endbetrag: en(m[6]),
        datum: d ? isoTag(+d[3], MON[d[2].toLowerCase()], +d[1]) : null });
    }
  }
  return null;
}

function krakenBeleg(pdf) {
  const t = pdf.text;
  const kopf = t.match(/Du hast (\S+) gekauft/), menge = t.match(/insgesamt\s+([\d.,]+)\s+(\S+)\s+hinzugefügt/);
  if (!kopf || !menge || !/Transaktions-ID/.test(t)) return null;
  const bezahlt = t.match(/€\s?([\d.,]+)\s+mit\s+[^\n]*bezahlt/), id = t.match(/Transaktions-ID:\s*(\S+)/), tag = t.match(/Datum:\s*(\d{1,2}\.\d{1,2}\.\d{4})/);
  const geb = t.match(/Gebühren:\s*€\s?([\d.,]+)/);
  const st = zahl(menge[1]), euro = bezahlt ? zahl(bezahlt[1]) : null;
  if (!st || !euro || !tag) throw new Error("Kraken-Kaufbeleg: Stückzahl, Betrag oder Datum nicht lesbar.");
  const c = krakenName(menge[2]);
  const b = { typ: "kauf", datum: datumText(tag[1]), name: c.name, isin: c.code, art: "Krypto", stueck: st, kurs: euro / st, gebuehr: 0, kasse: -euro,
              notiz: "Kraken-Kaufbeleg" + (geb ? " · inkl. Gebühr " + fEur.format(zahl(geb[1])) : ""), ref: "krb:" + (id ? id[1] : tag[1] + c.code + st), weich: true, auszug: true };
  return { format: "Kraken – Kaufbeleg (PDF)", konto: "Kraken", buchungen: [b], mitKonto: true };
}

/** Tabelle einer PDF: Kopfzeile mit Datum-Spalte suchen (auch zweizeilige Koepfe wie "Belastung / in EUR"), Zellen ueber ihre
 *  Lage den Spalten zuordnen. Buchung = Zeile, die links mit einem Datum beginnt; Folgezeilen ohne Datum gehoeren dazu.
 *  Saldo-/Summenzeilen ("Kontostand am ...", "Gesamt") beenden die Buchung und werden nicht angehaengt. */
const PDF_KOPFWORTE = ["belastung", "gutschrift", "erläuterung", "buchung", "saldo", "guthaben", "kategorie", "zahlungseingang", "zahlungsausgang", "wertstellung", "beschreibung"];
const PDF_STOPP = /^(Kontostand|Saldo|Gesamt|Summe|Total|Übertrag|Anfangssaldo|Endsaldo|Alter |Neuer |Zwischensumme|Seite \d|Page \d)/i;
const PDF_DATUM = /^(\d{1,2}\.\d{1,2}\.(\d{2,4})?|\d{4}-\d\d-\d\d|\d{1,2}\/\d{1,2}\/\d{2,4}|\d{1,2}\.? (Jan|Feb|Mär|Mar|Apr|Mai|May|Jun|Jul|Aug|Sep|Okt|Oct|Nov|Dez|Dec)[a-zä]*\.?( \d{4})?$)/;
function pdfTabelle(pdf) {
  const worte = Object.values(ZWORTE).flat().concat(PDF_KOPFWORTE);
  let beste = null;
  for (const seite of pdf.seiten) seite.forEach((z, i) => {
    if (z.zellen.length < 3 || PDF_DATUM.test(z.zellen[0].s)) return;
    const treffer = z.zellen.filter((c) => c.s.length < 40 && worte.some((w) => c.s.toLowerCase().includes(w))).length;
    const hatDatum = z.zellen.some((c) => c.s.length < 25 && /datum|buchung|date|tag\b/i.test(c.s));
    if (treffer >= 2 && hatDatum && (!beste || treffer > beste.treffer)) beste = { z, treffer, seite, i };
  });
  if (!beste) return null;
  // Kopf kann ueber 2-3 Zeilen gehen: kurze Nachbarzeilen ohne Zahlen gehoeren dazu
  const gruppe = [beste.z];
  for (const n of [beste.seite[beste.i - 1], beste.seite[beste.i + 1]])
    if (n && Math.abs(n.y - beste.z.y) <= 1.7 * beste.z.g && n.zellen.every((c) => c.s.length <= 22 && !/\d{2,}/.test(c.s))) gruppe.push(n);
  const sp = [];
  for (const c of gruppe.flatMap((z) => z.zellen.map((c) => ({ ...c, y: z.y }))).sort((a, b) => a.x - b.x)) {
    const k = sp.find((k) => c.x < k.x2 + 2 && c.x2 > k.x - 2);
    if (k) { k.teile.push(c); k.x = Math.min(k.x, c.x); k.x2 = Math.max(k.x2, c.x2); } else sp.push({ x: c.x, x2: c.x2, teile: [c] });
  }
  const kopf = [];
  for (const k of sp) {
    const name = k.teile.sort((a, b) => b.y - a.y || a.x - b.x).map((c) => c.s).join(" ");
    let n = name, i = 2;
    while (kopf.includes(n)) n = name + " " + i++;
    kopf.push(n); k.s = n;
  }
  const lese = spaltenLeser(sp), kopfTexte = new Set(gruppe.map((z) => z.text));
  const kDatumSp = kopf.find((k) => /datum|buchung|date|tag\b/i.test(k) && !/wert|valuta/i.test(k)) || kopf[0];
  const daten = [];
  let offen = null, folge = 0, drin = false;
  for (const seite of pdf.seiten) {
    let letzteY = null;
    for (const z of seite) {
      if (z === beste.z) { drin = true; offen = null; continue; }
      if (!drin || kopfTexte.has(z.text) || PDF_STOPP.test(z.text)) { offen = null; continue; }
      const neu = z.zellen.length >= 2 && PDF_DATUM.test(z.zellen[0].s) && z.zellen[0].x < sp[Math.min(1, sp.length - 1)].x2;
      if (neu) { offen = Object.fromEntries(kopf.map((k) => [k, ""])); daten.push(offen); folge = 0; }
      else if (!offen || ++folge > 6 || letzteY == null || Math.abs(letzteY - z.y) > 2.6 * z.g) { offen = null; continue; }
      // Die Datumszelle gehoert immer in die Datumsspalte - auch wenn sie breit ist ("02.03.2026 Verfügung Geldautomat")
      if (neu) offen[kDatumSp] = z.zellen[0].s;
      for (const [k, t] of Object.entries(lese(neu ? { zellen: z.zellen.slice(1) } : z))) offen[k] = (offen[k] ? offen[k] + " " : "") + t;
      letzteY = z.y;
    }
    offen = null;
  }
  return { kopf, daten };
}

/** Trade Republic "Kontoauszug": In der UMSATZÜBERSICHT steht das Datum ueber drei Zeilen (Tag / Monat / Jahr),
 *  die Beschreibung davor und danach. Ergebnis wie pdfTabelle: { kopf, daten } mit Datum als "25 März 2025". */
function trTabelle(pdf) {
  const alle = pdf.seiten.flat();
  const kopfZ = alle.find((z) => z.zellen.some((c) => c.s === "DATUM") && z.zellen.some((c) => c.s === "BESCHREIBUNG") && z.zellen.some((c) => c.s === "SALDO"));
  if (!kopfZ) return null;
  // "ZAHLUNGSEINGANG ZAHLUNGSAUSGANG" stehen so dicht, dass sie als eine Zelle ankommen: in der Mitte teilen
  const sp = kopfZ.zellen.flatMap((c) => /^ZAHLUNGSEINGANG ZAHLUNGSAUSGANG$/.test(c.s)
    ? [{ s: "ZAHLUNGSEINGANG", x: c.x, x2: (c.x + c.x2) / 2 }, { s: "ZAHLUNGSAUSGANG", x: (c.x + c.x2) / 2, x2: c.x2 }] : [c]);
  if (!sp.some((c) => c.s === "ZAHLUNGSEINGANG")) return null;
  const kopf = sp.map((c) => c.s), lese = spaltenLeser(sp), grenze = (sp.find((c) => c.s === "TYP") || sp[1]).x - 1;
  const imDatum = (c) => c.x < grenze;
  const daten = [];
  let offen = null, warte = [], letzteY = null;
  const dazu = (o, z) => { for (const [k, t] of Object.entries(lese({ zellen: z.zellen.filter((c) => !imDatum(c)) }))) o[k] = (o[k] ? o[k] + " " : "") + t; letzteY = z.y; };
  for (const z of alle.slice(alle.indexOf(kopfZ) + 1)) {
    if (z.text === kopfZ.text) continue;
    if (/^(BARMITTELÜBERSICHT|HINWEISE ZUM|BESTÄTIGUNG DER|Trade Republic Bank GmbH|TRADE REPUBLIC BANK|Erstellt am|Brunnenstraße|10119 Berlin)/.test(z.text)) { offen = null; warte = []; letzteY = null; continue; }
    const d = z.zellen.filter(imDatum).map((c) => c.s).join(" ");
    if (/^\d{1,2}(\.? [A-Za-zä]{3,}\.?( \d{4})?)?$/.test(d)) {                  // Tag (evtl. mit Monat/Jahr): neue Buchung
      offen = Object.fromEntries(kopf.map((k) => [k, ""])); offen.DATUM = d; daten.push(offen);
      for (const w of warte) dazu(offen, w);
      warte = [];
      dazu(offen, z);
    } else if (offen && !/\d{4}$/.test(offen.DATUM)) {                            // Monat, Jahr und Beschreibung dazwischen
      if (d) { offen.DATUM += " " + d; letzteY = z.y; }
      dazu(offen, z);
    } else if (!d && offen && !warte.length && letzteY != null && Math.abs(letzteY - z.y) <= 1.6 * z.g) dazu(offen, z);   // Rest der Beschreibung unter dem Jahr
    else if (!d) warte.push(z);                                                   // Beschreibung VOR dem Tag der naechsten Buchung
  }
  return { kopf, daten };
}

/** Kontoauszug einer Bank oder eines Brokers (Verrechnungskonto) als PDF: Revolut, Smartbroker+ (Baader), Scalable,
 *  Trade Republic, Sparkasse ... und jede andere Bank mit Datum- und Betragsspalte. Ergibt Kontobewegungen;
 *  Zeilen mit ISIN und Stueckzahl werden Kauf/Verkauf, Ausschuettungen mit ISIN Dividende.
 *  Anfangssaldo -> Anfangsbestand (einmal je Depot), Endsaldo -> Gegenprobe in der Vorschau. */
const PDF_ANBIETER = [[/Trade Republic/i, "Trade Republic"], [/Revolut/i, "Revolut"], [/Smartbroker/i, "Smartbroker+"], [/Scalable Capital/i, "Scalable Capital"],
  [/Sparkasse/i, "Sparkasse"], [/comdirect/i, "comdirect"], [/ING-DiBa|ING Deutschland/i, "ING"], [/Deutsche Kreditbank|\bDKB\b/i, "DKB"], [/Consorsbank/i, "Consorsbank"],
  [/\bN26\b/, "N26"], [/flatex/i, "flatex"], [/Commerzbank/i, "Commerzbank"], [/Postbank/i, "Postbank"], [/Volksbank|Raiffeisenbank/i, "Volksbank"], [/Deutsche Bank/i, "Deutsche Bank"]];
function bankAuszug(pdf, dateiname) {
  const alle = pdf.seiten.flat(), kopfteil = alle.slice(0, 60).map((z) => z.text).join("\n") + "\n" + alle.slice(-25).map((z) => z.text).join("\n");
  const anbieter = (PDF_ANBIETER.find(([re]) => re.test(kopfteil)) || [])[1] || "";
  const konto = anbieter || dateiname.replace(/\.[^.]+$/, "").slice(0, 30);

  // Salden: "Kontostand am 01.06.2026 ... 452,79", "Eröffnungskontostand 0,00€", Trade Republic: Kopfzeile ANFANGSSALDO ... ENDSALDO
  const salden = [];
  alle.forEach((z, n) => {
    if (z.zellen.some((c) => /^ANFANGSSALDO$/i.test(c.s)) && z.zellen.some((c) => /^ENDSALDO$/i.test(c.s)) && alle[n + 1]) {
      const o = spaltenLeser(z.zellen)(alle[n + 1]), a = geldLesen(o[z.zellen.find((c) => /^ANFANGSSALDO$/i.test(c.s)).s]), e = geldLesen(o[z.zellen.find((c) => /^ENDSALDO$/i.test(c.s)).s]);
      if (a != null) salden.push({ art: "start", betrag: a });
      if (e != null) salden.push({ art: "ende", betrag: e });
      return;
    }
    z.zellen.forEach((c, i) => {
      const m = c.s.match(/^(Kontostand|Anfangssaldo|Endsaldo|Eröffnungskontostand|Schlussguthaben|Alter (?:Saldo|Kontostand)|Neuer (?:Saldo|Kontostand))\b(.*)$/i);
      if (!m || /kann|berücksichtigt|durchschnitt|maximal/i.test(c.s)) return;
      let betrag = (m[2].match(/(-?[\d.]+,\d\d)\s*(?:EUR|€)?\s*[-SH]?$/) || [])[0];
      betrag = betrag != null ? geldLesen(betrag) : z.zellen.slice(i + 1).map((x) => geldLesen(x.s)).find((x) => x != null);
      if (betrag == null) return;
      const w = m[1].toLowerCase();
      salden.push({ art: /^(anfang|eröffnung|alter)/.test(w) ? "start" : /^(end|schluss|neuer)/.test(w) ? "ende" : "?", betrag, tag: datumText((m[2].match(/\d{1,2}\.\d{1,2}\.\d{4}/) || [])[0]) });
    });
  });
  const offen = salden.filter((s) => s.art === "?");
  const start = salden.find((s) => s.art === "start") || (offen.length > 1 ? offen[0] : null);
  const ende = [...salden].reverse().find((s) => s.art === "ende") || offen.at(-1) || null;

  const tab = trTabelle(pdf) || pdfTabelle(pdf);
  const B = [];
  let klar = false;
  if (tab) {
    const finde = (re, nicht) => tab.kopf.filter((k) => re.test(k) && !(nicht && nicht.test(k)));
    const kDatum = finde(/datum|buchung|date|tag\b/i, /wert|valuta/i)[0];
    const kSoll = finde(/belastung|ausgang|\bsoll\b/i)[0], kHaben = finde(/gutschrift|eingang|\bhaben\b/i)[0];
    const kBetrag = finde(/betrag|geld ein|amount|umsatz/i, /belastung|gutschrift/i)[0], kSaldo = finde(/guthaben|saldo|kontostand|balance/i, /anfang|end/i)[0];
    const kText = finde(/beschreibung|erläuterung|verwendungszweck|text|details|vorgang|typ|type|description|kategorie|empfänger|auftraggeber/i, /datum|betrag/i);
    klar = !!kDatum && !!(kBetrag || kSoll || kHaben);
    const gesehen = {};
    if (klar) for (const d of tab.daten) {
      const tag = datumText(d[kDatum]);
      if (!tag) continue;
      const betrag = kBetrag ? erstesGeld(d[kBetrag]) : (d[kSoll] || d[kHaben] ? (erstesGeld(d[kHaben]) || 0) - Math.abs(erstesGeld(d[kSoll]) || 0) : null);
      if (betrag == null) continue;
      const rest = String(d[kDatum]).replace(PDF_DATUM, "").replace(/^\s*\d{4}\b/, "").trim();
      const text = [rest, ...kText.map((k) => d[k])].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
      const saldo = kSaldo ? erstesGeld(d[kSaldo]) : null;
      const schluessel = tag + "|" + betrag.toFixed(2) + "|" + text.slice(0, 60) + "|" + (saldo ?? "");
      gesehen[schluessel] = (gesehen[schluessel] || 0) + 1;
      const ref = "pdf:" + konto + "|" + schluessel + "|" + gesehen[schluessel];
      const isin = (text.match(ISIN_RE) || [])[1];
      const stM = text.match(/(\d[\d.,]*)\s*(?:Stk\.?|Stück|St\.)(?=\s|$)/i), stE = text.match(/quantity:\s*([\d.]+)/i);
      const st = stM ? zahl(stM[1]) : stE ? parseFloat(stE[1]) : null;
      const name = isin ? (text.match(/[A-Z]{2}[A-Z0-9]{9}\d\s+(.+?),?\s*quantity/i) || text.match(/(?:Stk\.?|Stück)\s+(.+?)\s*\(?[A-Z]{2}[A-Z0-9]{9}\d/i) || text.match(/^.*?\n?([^()]+?)\s*\([A-Z]{2}[A-Z0-9]{9}\d\)/) || text.match(/[A-Z]{2}[A-Z0-9]{9}\d\s+([^,]+)/) || [])[1] : "";
      const sauber = (name || "").replace(/^(Kapitalmaßnahme|Ausschüttungen?|Dividende|Kauf|Verkauf|eines Finanzinstruments|\s)+/gi, "").trim() || isin;
      if (isin && st > 0 && /kauf|buy|sell|sparplan|savings/i.test(text)) {
        const verkauf = /verkauf|sell/i.test(text);
        B.push({ typ: verkauf ? "verkauf" : "kauf", datum: tag, name: sauber, isin, art: artRaten(sauber), stueck: st, kurs: Math.abs(betrag) / st, gebuehr: 0, kasse: betrag, notiz: text.slice(0, 80), ref, weich: true });
      } else if (isin && betrag > 0 && /ausschüttung|dividende|ertrag|dividend|kupon/i.test(text)) {
        B.push({ typ: "dividende", datum: tag, name: sauber, isin, art: artRaten(sauber), stueck: 0, kurs: null, betrag, notiz: text.slice(0, 80), ref, weich: true });
      } else {
        const typ = betrag < 0 ? (/gebühr|entgelt|\bfee\b|steuer|solidarit/i.test(text) ? "gebuehr" : /händler|karte|debitk|\bcard\b/i.test(text) ? "karte" : "auszahlung")
                               : (/zins|interest/i.test(text) ? "zinsen" : /bonus|prämie|cashback|saveback/i.test(text) ? "bonus" : "einzahlung");
        B.push({ typ, kontobewegung: true, datum: tag, name: TYPEN[typ], betrag, gebuehr: 0, notiz: text.slice(0, 80), ref });
      }
    }
  }
  if (tab && tab.daten.length && !klar) return null;                           // Tabelle da, Spalten unklar -> "Spalten zuordnen"
  if (!B.length && !ende && !start) return null;
  const v = { format: (anbieter || "Bank") + " – Kontoauszug (PDF)", konto, buchungen: B, mitKonto: true };
  const f2 = (x) => fEur.format(x);
  if (!B.length) {
    const stand = (ende || start).betrag;
    if (Math.abs(stand) < 0.005) throw new Error(`${anbieter || "Kontoauszug"}: keine Umsätze im Zeitraum und Kontostand 0,00 € – nichts zu übernehmen.`);
    const tagS = (ende || start).tag || heute();
    B.push({ typ: stand > 0 ? "einzahlung" : "auszahlung", kontobewegung: true, datum: tagS, name: TYPEN[stand > 0 ? "einzahlung" : "auszahlung"], betrag: stand,
             notiz: "Kontostand laut Kontoauszug", ref: "pdfsaldo:" + konto + "|" + tagS, saldo: stand });
    v.hinweis = `Keine Umsätze im Auszug – übernommen wird der Kontostand von ${f2(stand)}. Steht im Depot schon ein anderer Stand, wird nur der Unterschied gebucht.`;
  } else {
    const erster = B.map((b) => b.datum).sort()[0], summe = B.reduce((a, b) => a + (b.kontobewegung || b.typ === "dividende" ? b.betrag : b.kasse || 0), 0);
    if (start && Math.abs(start.betrag) >= 0.005)
      B.unshift({ typ: start.betrag > 0 ? "einzahlung" : "auszahlung", kontobewegung: true, datum: start.tag && start.tag <= erster ? vortagVon(start.tag) : vortagVon(erster),
                  name: TYPEN[start.betrag > 0 ? "einzahlung" : "auszahlung"], betrag: start.betrag, notiz: "Anfangsbestand laut Kontoauszug", ref: "pdfstart:" + konto, startbestand: true });
    if (ende) {
      const soll = (start ? start.betrag : 0) + summe;
      v.hinweis = Math.abs(soll - ende.betrag) < 0.006 ? `Gegenprobe: Kontostand laut Auszug ${f2(ende.betrag)} – stimmt mit den Buchungen überein.`
        : `Achtung: Die Buchungen ergeben ${f2(soll)}, im Auszug steht ${f2(ende.betrag)} – bitte prüfen (${start ? "" : "kein Anfangssaldo gefunden, "}evtl. fehlt eine Zeile).`;
    }
  }
  for (const b of B) b.auszug = true;
  return v;
}

// ------------------------------------------------------------ Screenshot-Import (ab 0.42, liest texterkennung.js)
const nameNorm = (s) => String(s || "").toLowerCase().replace(/&/g, " ").replace(/\b(inc|corp|ag|se|plc|ltd|nv|sa|co|dl|the|cl|a|b)\b/g, " ").replace(/[^a-z0-9äöüß]+/g, "");
/** Passt der Name aus dem Screenshot ("NVIDIA", "Siemens Energy") zu einem gespeicherten Wert ("NVIDIA CORP. DL-,001")? */
function namePasst(kurz, lang) {
  const a = nameNorm(kurz), b = nameNorm(lang);
  return !!a && !!b && (a === b || b.startsWith(a) || a.startsWith(b));
}
/** Vorhandenen Wert zu einem Namen suchen (alle Depots, Trade Republic zuerst) -> Kennung (meist ISIN) oder "". */
function wertZuName(name) {
  const ids = Object.entries(S.depots).sort(([, x], [, y]) => (/trade republic/i.test(y.name) ? 1 : 0) - (/trade republic/i.test(x.name) ? 1 : 0));
  for (const [, d] of ids) for (const [id, i] of Object.entries(d.instrumente)) if (namePasst(name, i.name)) return { id, inst: i };
  return null;
}
/** Aufnahme-Zeit eines Screenshots: Dateiname "Screenshot_20261113-201113…" oder Dateidatum. */
function screenshotZeit(x) {
  const m = String(x.name || "").match(/(20\d\d)[-_.]?(\d\d)[-_.]?(\d\d)[-_ ]?(\d\d)?[-_.:]?(\d\d)?/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 12), +(m[5] || 0));
  return new Date(x.zeit || Date.now());
}
const isoLokal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** ISIN aus Texterkennung: "O" statt "0" korrigieren. Bevorzugt die Variante mit gueltiger Pruefziffer (Luhn),
 *  sonst werden O in den ersten Stellen nach dem Laendercode (meist Ziffern) zu 0. */
function isinPruefziffer(isin) {
  const ziffern = isin.slice(0, 11).split("").map((c) => /\d/.test(c) ? c : String(c.charCodeAt(0) - 55)).join("");
  let s = 0;
  for (let i = 0; i < ziffern.length; i++) { let d = +ziffern[ziffern.length - 1 - i]; if (i % 2 === 0) { d *= 2; if (d > 9) d -= 9; } s += d; }
  return (10 - (s % 10)) % 10 === +isin[11];
}
function isinAusText(t) {
  const m = String(t).match(/\b([A-Z]{2}[A-Z0-9]{9}[0-9O])\b/);
  if (!m) return "";
  const roh = m[1], kandidaten = [roh, roh.slice(0, 2) + roh.slice(2).replace(/O/g, "0"), roh.slice(0, 2) + roh.slice(2, 5).replace(/O/g, "0") + roh.slice(5, 11) + roh[11].replace("O", "0")];
  return kandidaten.find((k) => /\d$/.test(k) && isinPruefziffer(k)) || kandidaten[2];
}

/** Datum aus einem Screenshot: "Heute", "Gestern", "12.11.2026", "12. Nov. 2026" - sonst Aufnahmezeit des Bildes. */
function screenshotDatum(t, x) {
  const basis = screenshotZeit(x);
  if (/\bHeute\b|\bToday\b/i.test(t)) return isoLokal(basis);
  if (/\bGestern\b|\bYesterday\b/i.test(t)) return isoLokal(new Date(basis.getTime() - 864e5));
  const m2 = t.match(/\b(\d{1,2}\.\d{1,2}\.\d{2,4})\b/), m = t.match(/\b(\d{1,2})\.?\s?([A-Za-zä]{3,})\.?\s*(\d{4})?/);
  if (m2) return datumText(m2[1]);
  if (m && MONATE[m[2].toLowerCase()]) return isoTag(m[3] || basis.getFullYear(), MONATE[m[2].toLowerCase()], +m[1]);
  return isoLokal(basis);
}

/** Screenshot einer ausgefuehrten Order bei anderen Brokern (ab 0.49): Scalable Capital, Smartbroker+, Revolut, Kraken, Bitvavo, OKX ...
 *  Kein festes Layout - gesucht werden die ueblichen Feldnamen (Stück/Anzahl, Ausführungskurs/Kurs, Gesamt/Summe/Kurswert, Gebühr ...),
 *  dazu Kauf/Verkauf, ISIN, Name und Datum. Stück x Kurs wird gegen den Gesamtbetrag geprueft. */
function screenshotAllgemein(t, x) {
  // Englisches Format mit Tausender-Komma ("60,000.00") erkennen, sonst deutsch lesen
  const zahlAus = (s) => { if (s == null) return null; const z = String(s).replace(/[^\d.,-]/g, "").replace(/[.,]$/, "");
    return /,\d{3}(\.\d+)?$/.test(z) && z.includes(".") || /^\d{1,3}(,\d{3})+\.\d+$/.test(z) ? parseFloat(z.replace(/,/g, "")) : zahl(z); };
  // zwischen Feldname und Zahl bis zu 3 Stoerzeichen (Texterkennung liest "€" auf dunklem Grund z. B. als "<")
  const wert = (labels) => { const m = t.match(new RegExp("(?:^|[\\s|])(?:" + labels + ")\\s*:?\\s*[^\\d\\n]{0,3}?(\\d[\\d.,]*)", "im")); return m ? zahlAus(m[1]) : null; };
  const broker = /scalable/i.test(t) ? "Scalable" : /smartbroker/i.test(t) ? "Smartbroker" : /revolut/i.test(t) ? "Revolut"
    : /kraken/i.test(t) ? "Kraken" : /bitvavo/i.test(t) ? "Bitvavo" : /\bokx\b/i.test(t) ? "OKX" : /trade republic/i.test(t) ? "Trade Republic" : "";
  const istVerkauf = /\b(verkauf|verkauft|verkaufen|verkaufsorder|sell|sold)\b/i.test(t), istKauf = /\b(kauf|gekauft|kaufen|kauforder|buy|bought|sparplan)\b/i.test(t);
  let stueck = wert("Stückzahl|Stück|Anzahl|Menge|Nominale?|Anteile|Quantity|Shares|Amount");
  if (stueck == null) { const m = t.match(/(\d[\d.,]*)\s*(?:Stk\.?|Stück|Anteile|x\s)/i); if (m) stueck = zahlAus(m[1]); }
  let kurs = wert("Ausführungskurs|Ausführungspreis|Durchschnittskurs|Durchschnittspreis|Kaufkurs|Verkaufskurs|Kurs|Preis|Price|Avg\\.? price");
  const gesamt = wert("Gesamtbetrag|Endbetrag|Gesamtsumme|Gesamt|Summe|Ordervolumen|Kurswert|Betrag|Total|Belastung|Gutschrift");
  const geb = wert("Ordergebühren|Ordergebühr|Gebühren|Gebühr|Provision|Fremdkosten|Fremdkostenzuschlag|Fees?|Kosten") || 0;
  const steuer = Math.abs(wert("Steuern|Steuer|Kapitalertragsteuer|Taxes|Tax") || 0);
  const verkauf = istVerkauf && (!istKauf || t.search(/\b(verkauf|verkauft|sell|sold)\b/i) < t.search(/\b(kauf|gekauft|buy|bought)\b/i));
  if (kurs == null && stueck && gesamt) kurs = (verkauf ? gesamt + geb + steuer : gesamt - geb) / stueck;
  if (stueck == null && kurs && gesamt) stueck = (verkauf ? gesamt + geb + steuer : gesamt - geb) / kurs;
  if (!(istKauf || istVerkauf) || !stueck || !kurs)
    throw new Error("Im Bild keine ausgeführte Order erkannt. Bitte den Screenshot der Order-Details nehmen – mit Kauf oder Verkauf, Stückzahl, Kurs und Betrag.");
  const isin = isinAusText(t);
  const label = t.match(/(?:^|\n)\s*(?:Wertpapier|Name|Asset|Titel|Instrument|Coin|Aktie|ETF|Produkt)\s*:?\s+([^\n]*[A-Za-zÄÖÜäöü]{3,}[^\n]*)/i);
  const UI = /(ausgeführt|abgeschlossen|erledigt|aktivität|transaktion|umsatz|bought|sold|quantity|fees?|date|status|order|details|übersicht|gebühr|kurs|stück|anzahl|menge|summe|gesamt|betrag|datum|uhr|handelsplatz|börse|limit|market|heute|gestern|kauf|verkauf|buy|sell|preis|price|total|fee|steuer|isin|wkn|depot|konto|€|\bEUR\b)/i;
  const kandidat = t.split("\n").map((z) => z.trim()).find((z) => /[A-Za-zÄÖÜäöü]{3,}/.test(z) && !UI.test(z) && !/^\d{1,2}:\d{2}/.test(z) && z.length <= 60);
  const passendIsin = isin ? Object.values(S.depots).map((d) => d.instrumente[isin]).find(Boolean) : null;
  const roh = (label ? label[1] : kandidat || "").replace(/\s{2,}.*$/, "").trim() || (passendIsin?.name || "");
  const passend = passendIsin ? { id: isin, inst: passendIsin } : roh ? wertZuName(roh) : null;
  if (!roh && !passend) throw new Error("Im Bild keinen Wertpapier-Namen gefunden. Bitte die Order-Details mit Namen oder ISIN fotografieren.");
  const name = passend?.inst?.name || roh;
  const tag = screenshotDatum(t, x);
  const zert = /\b(turbo|knock|ko|call|put|long|short|faktor|optionsschein|mini|zertifikat|bonus|discount)\b/i.test(name);
  const krypto = Object.values(KRYPTO_NAMEN).some((n) => nameNorm(n) === nameNorm(name)) || ["Kraken", "Bitvavo", "OKX"].includes(broker);
  const art = passend?.inst?.art || (zert ? "Zertifikat" : krypto ? "Krypto" : artRaten(name));
  const richtung = passend?.inst?.richtung || richtungAusName(name);
  const brutto = stueck * kurs, soll = verkauf ? brutto - geb - steuer : brutto + geb;
  // Manche Apps zeigen als "Gesamt" den Kurswert ohne Gebuehr - dann zaehlt das auch als stimmig
  const stimmt = gesamt != null && (Math.abs(soll - gesamt) <= 0.02 + 0.001 * gesamt || Math.abs(brutto - gesamt) <= 0.02 + 0.001 * gesamt);
  const kasse = gesamt != null && Math.abs(soll - gesamt) <= 0.02 + 0.001 * gesamt ? gesamt : soll;
  const b = { typ: verkauf ? "verkauf" : "kauf", datum: tag, name, isin: isin || (passend ? passend.id : ""), art, stueck, kurs, gebuehr: geb, steuer: verkauf ? steuer : 0,
              kasse: verkauf ? kasse : -kasse, notiz: "Screenshot " + (x.name || ""), ref: "scr:" + tag + "|" + nameNorm(name) + "|" + stueck, weich: true, screenshot: true,
              ...(richtung ? { richtung } : {}) };
  const f2 = (n) => fEur.format(n);
  return { format: (broker || "Broker") + " – Screenshot", konto: broker, buchungen: [b], mitKonto: true,
           hinweis: (stimmt ? `Gegenprobe: ${fZahl.format(stueck)} × ${f2(kurs)} ${verkauf ? "−" : "+"} Kosten = ${f2(kasse)} – stimmt.`
                            : `Achtung: ${fZahl.format(stueck)} × ${f2(kurs)} ergibt nicht den Betrag ${gesamt != null ? f2(gesamt) : "?"} – bitte Zahlen prüfen (Texterkennung).`)
                    + (istKauf && istVerkauf ? " Kauf/Verkauf bitte prüfen – im Bild steht beides." : "")
                    + (passend ? ` Zugeordnet: ${passend.inst.name}.` : ` „${name}“ ist neu${isin ? "" : " – ohne ISIN, Kurs kommt über „Kurse & Daten aktualisieren“ per Name"}.`)
                    + (broker ? "" : " Broker nicht erkannt – bitte unten das Depot wählen.") };
}

/** Trade-Republic-Screenshot einer ausgefuehrten Order ("Du hast 501,00 € investiert" / "… erhalten"). */
function screenshotErkennen(text, x) {
  const t = String(text || "").replace(/[‘’]/g, "'"), z = (re) => (t.match(re) || [])[1];
  const g = (s) => s == null ? null : zahl(String(s).replace(/[^\d.,-]/g, ""));
  const kopf = t.match(/Du hast\s+([\d.,]+)\s*€\s*(erhalten|investiert|gekauft|verkauft)/i);
  const label = z(/^\s*(Verkaufen|Verkauf|Kaufen|Kauf|Sparplan)\b/mi);
  const tr = t.match(/([\d.,]+)\s*[x×X]\s*([\d.,]+)\s*€/);
  const asset = (z(/^\s*Asset\s+(.+?)\s*$/mi) || "").trim();
  if (!tr || !asset || (!kopf && !label)) return screenshotAllgemein(t, x);       // kein Trade-Republic-Bild -> allgemeiner Erkenner (ab 0.49)
  const verkauf = kopf ? /erhalten|verkauft/i.test(kopf[2]) : /^verk/i.test(label);
  const stueck = g(tr[1]), kurs = g(tr[2]), geb = g(z(/Geb[üu]hr\s*>?\s*([\d.,]+)\s*€/i)) || 0, steuer = Math.abs(g(z(/Steuer\s*>?\s*(-?[\d.,]+)\s*€/i)) || 0);
  const summe = g(z(/Summe\s*>?\s*([\d.,]+)\s*€/i)) ?? (kopf ? g(kopf[1]) : null);
  // Datum: "Heute · 20:10", "Gestern · 09:12", "12. Nov. · …", "12.11.2026"
  const basis = screenshotZeit(x);
  let tag = null;
  if (/\bHeute\b/i.test(t)) tag = isoLokal(basis);
  else if (/\bGestern\b/i.test(t)) tag = isoLokal(new Date(basis.getTime() - 864e5));
  else {
    const m = t.match(/\b(\d{1,2})\.\s?([A-Za-zä]{3,})\.?\s*(\d{4})?/), m2 = t.match(/\b(\d{1,2}\.\d{1,2}\.\d{4})\b/);
    if (m2) tag = datumText(m2[1]);
    else if (m && MONATE[m[2].toLowerCase()]) tag = isoTag(m[3] || basis.getFullYear(), MONATE[m[2].toLowerCase()], +m[1]);
    else tag = isoLokal(basis);
  }
  const passend = wertZuName(asset);
  const zert = /\b(turbo|knock|ko|call|put|long|short|faktor|optionsschein|mini|zertifikat|bonus|discount)\b/i.test(asset);
  const krypto = Object.values(KRYPTO_NAMEN).some((n) => nameNorm(n) === nameNorm(asset));
  const art = passend?.inst?.art || (zert ? "Zertifikat" : krypto ? "Krypto" : artRaten(asset));
  const richtung = passend?.inst?.richtung || richtungAusName(asset);
  const brutto = stueck * kurs, soll = verkauf ? brutto - geb - steuer : brutto + geb;
  const stimmt = summe != null && Math.abs(soll - summe) <= 0.02 + 0.0005 * summe;
  const b = { typ: verkauf ? "verkauf" : "kauf", datum: tag, name: passend?.inst?.name || asset, isin: passend ? passend.id : "", art,
              stueck, kurs, gebuehr: geb, steuer: verkauf ? steuer : 0, kasse: summe != null ? (verkauf ? summe : -summe) : (verkauf ? soll : -soll),
              notiz: "Screenshot " + (x.name || ""), ref: "scr:" + tag + "|" + nameNorm(asset) + "|" + stueck, weich: true, screenshot: true,
              ...(richtung ? { richtung } : {}) };
  const f2 = (n) => fEur.format(n);
  return { format: "Trade Republic – Screenshot", konto: "Trade Republic", buchungen: [b], mitKonto: true,
           hinweis: (stimmt ? `Gegenprobe: ${fZahl.format(stueck)} × ${f2(kurs)} ${verkauf ? "−" : "+"} Kosten = ${f2(summe)} – stimmt.`
                            : `Achtung: ${fZahl.format(stueck)} × ${f2(kurs)} ergibt nicht die Summe ${summe != null ? f2(summe) : "?"} – bitte Zahlen prüfen (Texterkennung).`)
                    + (passend ? ` Zugeordnet: ${passend.inst.name}.` : ` „${asset}“ ist neu – ohne ISIN, Kurs kommt über „Kurse & Daten aktualisieren“ per Name.`)
                    + (/\bHeute\b|\bGestern\b/i.test(t) ? ` Datum aus dem Screenshot: ${datum(tag)}.` : "")
                    + (richtung ? ` Richtung: ${richtung === "short" ? "Short" : "Long"}.` : "") };
}

// ------------------------------------------------------------ Universeller Import (Spalten zuordnen)
const ZFELDER = { datum: "Datum", typ: "Art der Buchung", name: "Name / Wertpapier", isin: "ISIN / Kürzel", stueck: "Stück",
                  kurs: "Kurs", betrag: "Betrag", gebuehr: "Gebühr", steuer: "Steuer", zweck: "Verwendungszweck / Text" };
const ZWORTE = { datum: ["buchungstag", "datum", "date", "handelstag", "valuta", "zeit", "time", "buchung"],
                 typ: ["typ", "type", "transaktion", "vorgang", "buchungsart", "action", "art"],
                 name: ["wertpapier", "bezeichnung", "name", "instrument", "description", "titel", "produkt", "asset"],
                 isin: ["isin", "wkn", "symbol", "ticker"],
                 stueck: ["stück", "stueck", "anzahl", "shares", "quantity", "menge", "units", "nominal"],
                 kurs: ["kurs", "price", "preis"],
                 betrag: ["betrag", "amount", "umsatz", "wert", "value", "total", "summe"],
                 gebuehr: ["gebühr", "gebuehr", "fee", "provision", "entgelt", "kosten"],
                 steuer: ["steuer", "tax", "kest"],
                 zweck: ["verwendungszweck", "zweck", "auftraggeber", "empfänger", "empfaenger", "beschreibung", "text", "referenz", "reference", "erläuterung"] };
const ZTYPEN = { auto: "automatisch (Vorzeichen)", kauf: "Kauf", verkauf: "Verkauf", dividende: "Dividende", einzahlung: "Einzahlung",
                 auszahlung: "Auszahlung", karte: "Kartenzahlung", zinsen: "Zinsen", gebuehr: "Gebühr", bonus: "Gutschrift",
                 verlust: "Verlust", ignorieren: "nicht übernehmen" };
const kopfSignatur = (kopf) => kopf.map((k) => k.toLowerCase()).join("|");

function typRaten(wert) {
  const w = String(wert).toLowerCase();
  if (/verkauf|sell|sale/.test(w)) return "verkauf";
  if (/kauf|buy|purchase|sparplan|savings/.test(w)) return "kauf";
  if (/div|ausschütt|ausschuett|distribution/.test(w)) return "dividende";
  if (/zins|interest/.test(w)) return "zinsen";
  if (/karte|card/.test(w)) return "karte";
  if (/auszahl|withdraw|abhebung|lastschrift|überweisung aus/.test(w)) return "auszahlung";
  if (/einzahl|deposit|gutschrift|eingang/.test(w)) return "einzahlung";
  if (/gebühr|gebuehr|fee|entgelt/.test(w)) return "gebuehr";
  return "auto";
}

function zuordnungRaten(kopf, daten) {
  const klein = kopf.map((k) => k.toLowerCase()), spalten = {}, belegt = new Set();
  for (const [feld, worte] of Object.entries(ZWORTE)) {
    spalten[feld] = -1;
    for (const w of worte) {
      const i = klein.findIndex((k, j) => !belegt.has(j) && k.includes(w));
      if (i >= 0) { spalten[feld] = i; belegt.add(i); break; }
    }
  }
  const z = { spalten, typen: {}, konto: "", merken: true };
  typenAuffrischen(z, kopf, daten);
  return z;
}

function typenAuffrischen(z, kopf, daten) {
  const i = z.spalten.typ;
  if (i < 0) { z.typen = {}; return; }
  const werte = [...new Set(daten.map((d) => d[kopf[i]]).filter(Boolean))].slice(0, 40);
  const neu = {};
  for (const w of werte) neu[w] = z.typen[w] || typRaten(w);
  z.typen = neu;
}

/** Datum in vielen Schreibweisen: 2026-03-02, 02.03.2026, 2.3.26, 02/03/2026 (EU). */
function datumLesen(s) {
  const t = String(s || "").trim();
  let m;
  if ((m = t.match(/^(\d{4})-(\d\d)-(\d\d)/))) return `${m[1]}-${m[2]}-${m[3]}`;
  if ((m = t.match(/^(\d{1,2})[./](\d{1,2})[./](\d{2,4})/))) {
    const j = m[3].length === 2 ? "20" + m[3] : m[3];
    return `${j}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  }
  if ((m = datumText(t))) return m;
  const d = Date.parse(t);
  return isNaN(d) ? null : new Date(d).toISOString().slice(0, 10);
}

function zuordnungAnwenden(roh, z) {
  const { kopf, daten, dateiname } = roh, sp = z.spalten;
  const wert = (zeile, feld) => sp[feld] >= 0 ? zeile[kopf[sp[feld]]] ?? "" : "";
  const nurKonto = sp.stueck < 0 && sp.isin < 0;            // Kontoauszug: nur Geld
  const B = [];
  daten.forEach((zeile, n) => {
    const tag = datumLesen(wert(zeile, "datum"));
    const ref = "map:" + kopf.map((k) => zeile[k]).join("|").slice(0, 300);
    let ziel = sp.typ >= 0 ? z.typen[wert(zeile, "typ")] || "auto" : "auto";
    if (ziel === "ignorieren") return;
    const betrag = zahlPunkt(wert(zeile, "betrag")), stueck = zahlPunkt(wert(zeile, "stueck")), kurs = zahlPunkt(wert(zeile, "kurs"));
    const geb = Math.abs(zahlPunkt(wert(zeile, "gebuehr")) || 0), steu = Math.abs(zahlPunkt(wert(zeile, "steuer")) || 0);
    const zweck = wert(zeile, "zweck"), name = (wert(zeile, "name") || zweck || "").trim(), isin = wert(zeile, "isin").trim().toUpperCase();
    if (!tag) return B.push({ typ: "einzahlung", kontobewegung: true, datum: "", betrag: 0, ref, storno: true, grund: "Datum unlesbar (Zeile " + (n + 2) + ")" });
    const kontoTyp = KONTO_TYPEN.has(ziel) || (ziel === "auto" && nurKonto);
    if (kontoTyp) {
      if (betrag == null) return;
      let t = ziel === "auto" ? (betrag >= 0 ? "einzahlung" : "auszahlung") : ziel;
      const b = ["auszahlung", "karte", "gebuehr", "verlust"].includes(t) ? -Math.abs(betrag) : ["einzahlung", "zinsen", "bonus"].includes(t) ? Math.abs(betrag) : betrag;
      B.push({ typ: t, kontobewegung: true, datum: tag, name: TYPEN[t], betrag: b, gebuehr: geb, steuer: steu, notiz: zweck.slice(0, 80), ref });
      return;
    }
    if (!isin && !name) return;
    if (ziel === "dividende") {
      B.push({ typ: "dividende", datum: tag, name, isin, stueck: Math.abs(stueck || 0), kurs: null, betrag: Math.abs(betrag || 0), steuer: steu, art: artRaten(name), ref });
      return;
    }
    if (ziel === "auto") ziel = (stueck != null && stueck < 0) || (stueck != null && betrag != null && betrag > 0) ? "verkauf" : "kauf";
    if (!["kauf", "verkauf"].includes(ziel)) return;
    const st = Math.abs(stueck || 0);
    if (!st) return B.push({ typ: ziel, datum: tag, name, isin, stueck: 0, kurs: null, ref, storno: true, grund: "keine Stückzahl" });
    const k = kurs != null ? Math.abs(kurs) : betrag != null ? Math.abs(betrag) / st : null;
    B.push({ typ: ziel, datum: tag, name: name || isin, isin, stueck: st, kurs: k, gebuehr: geb, steuer: steu, art: artRaten(name),
             kasse: betrag != null ? (ziel === "kauf" ? -Math.abs(betrag) : Math.abs(betrag)) : null, ref });
  });
  if (!B.length) throw new Error("Mit dieser Zuordnung entstehen keine Buchungen – bitte Datum und Betrag bzw. Stück prüfen.");
  for (const b of B) if (b.ueberspringen) b.storno = true;
  const v = { format: nurKonto ? "Kontoauszug (eigene Zuordnung)" : "Eigene Zuordnung", konto: z.konto || dateiname.replace(/\\.[^.]+$/, "").slice(0, 30),
              buchungen: B, mitKonto: true };
  vorschauPruefen(v);
  return v;
}

function zuordnungSeite() {
  const r = ui.zuordnung, z = r.z, bsp = r.daten[0] || {};
  const wahl = (feld) => `<select data-zfeld="${feld}"><option value="-1">–</option>${r.kopf.map((k, i) =>
    `<option value="${i}" ${z.spalten[feld] === i ? "selected" : ""}>${esc(k)}${bsp[k] ? " (z. B. " + esc(String(bsp[k]).slice(0, 18)) + ")" : ""}</option>`).join("")}</select>`;
  const nurKonto = z.spalten.stueck < 0 && z.spalten.isin < 0;
  return `
    <h2><button class="knopf klein" data-los="zuordnung-weg">${ui.importSchlange ? "Überspringen" : "‹ Abbrechen"}</button><span>Spalten zuordnen</span></h2>
    ${ui.importSchlange ? `<p class="klein" style="margin:0 2px 8px">Datei ${ui.importSchlange.nr} von ${ui.importSchlange.von}: ${esc(r.dateiname)}</p>` : ""}
    <section class="karte formular">
      <p style="margin-top:0">Dieses Format kennt die App noch nicht. Ordne einmal die Spalten zu – die App merkt sich das für diesen Broker.</p>
      ${Object.entries(ZFELDER).map(([f, t]) => `<label>${t}${wahl(f)}</label>`).join("")}
      <p class="klein" style="margin:0">${nurKonto ? "Ohne Stück und ISIN wird die Datei als <b>Kontoauszug</b> gelesen: + = Einzahlung, − = Auszahlung." : "Wertpapier-Buchungen: Kauf/Verkauf über die Art oder das Vorzeichen."}</p>
      ${Object.keys(z.typen).length ? `<b>Was bedeuten die Arten in der Datei?</b>${Object.entries(z.typen).map(([w, ziel]) =>
        `<label>${esc(w)}<select data-ztyp="${esc(w)}">${Object.entries(ZTYPEN).map(([k, t]) => `<option value="${k}" ${ziel === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>`).join("")}` : ""}
      <label>Konto / Depot-Name<input id="zuordnung-konto" value="${esc(z.konto || r.dateiname.replace(/\\.[^.]+$/, "").slice(0, 30))}"></label>
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" id="zuordnung-merken" ${z.merken ? "checked" : ""} style="width:22px;height:22px"> Zuordnung für diesen Broker merken</label>
      <button class="knopf haupt" data-los="zuordnung-ok">Weiter zur Vorschau</button>
    </section>`;
}

/** Ziel-Depot fuer eine Datei: leeres offenes Depot, sonst das Depot, das
 *  dieses Konto schon fuehrt, sonst ein neues - so landet z. B. ein
 *  Kraken-Export nicht im Trade-Republic-Depot. */
function zielVorschlag(v) {
  if (!D.buchungen.length) return S.aktiv;
  const mitKonto = Object.entries(S.depots).find(([, d]) => d.buchungen.some((b) => b.konto === v.konto));
  return mitKonto ? mitKonto[0] : "neu";
}

/** Was aus der Vorschau NICHT uebernommen wird. Laeuft erneut, wenn das Konto
 *  geaendert wird, weil der Startbestand je Konto gilt.
 *  - storniert / nicht ausgefuehrt
 *  - schon importiert (gleiche Herkunft)
 *  - Kauf/Verkauf am oder vor dem Startbestand desselben Kontos oder Wertpapiers:
 *    der steckt schon im Startbestand, sonst zaehlt er doppelt (Test 07.11.2026:
 *    DB-Bestand + Scalable-Historie ergab 11.000 EUR zu viel). */
function vorschauPruefen(v) {
  if (v.ziel === undefined) v.ziel = zielVorschlag(v);
  const ziel = v.ziel === "neu" ? neuesDepot("", "") : S.depots[v.ziel] || D;
  const refs = new Set(ziel.buchungen.map((b) => b.ref).filter(Boolean));
  const imDatei = new Set();
  const startKonto = {};
  const startInst = {};
  // Startbestand = Einbuchung aus einer Bestandsdatei (nicht Staking o. Ae.)
  for (const x of ziel.buchungen.filter((x) => x.typ === "einbuchung" && !x.ertrag)) {
    if (!startKonto[x.konto] || x.datum > startKonto[x.konto]) startKonto[x.konto] = x.datum;
    if (!startInst[x.instrument] || x.datum > startInst[x.instrument]) startInst[x.instrument] = x.datum;
  }
  // Zurueckrechnen (ab Werk an): aeltere Kaeufe/Verkaeufe NICHT verwerfen, sondern den
  // Startbestand auf die Zeit davor zurueckrechnen -> echte Historie (Vorgabe 08.11.: Bestand + aeltere Transaktionen).
  const zurueck = v.zurueck !== false;
  v.rueck = 0;
  // PDF-Kontoauszug (Kraken): Anfangsbestand nur einmal; aeltere Auszuege danach nicht noch einmal obendrauf
  const auszugStart = ziel.buchungen.filter((x) => /^(krpdf:start:|pdfstart:)/.test(String(x.ref || ""))).map((x) => x.datum).sort().pop();
  // Dieselbe Buchung aus einem ANDEREN Export (z. B. Kaufbeleg + Kontoauszug + Ledger): gleicher Tag, gleiches Wertpapier, gleiche Menge
  const andere = ziel.buchungen.filter((x) => x.quelle !== v.format).map((x) => ({ x, frei: true }));
  const doppelt = (b) => {
    const iid = b.kontobewegung ? "" : instrumentId(b.isin, b.name, false);
    const t = andere.find((a) => a.frei && a.x.datum === b.datum && (a.x.instrument || "") === iid &&
      (b.kontobewegung ? KONTO_TYPEN.has(a.x.typ) && Math.abs((+a.x.betrag || 0) - (+b.betrag || 0)) < 0.006
                       : !KONTO_TYPEN.has(a.x.typ) && ["kauf", "einbuchung"].includes(a.x.typ) === ["kauf", "einbuchung"].includes(b.typ)
                         && Math.abs((+a.x.stueck || 0) - (+b.stueck || 0)) <= Math.max(6e-5, 2e-4 * Math.abs(+b.stueck || 0))));
    if (t) t.frei = false;
    return !!t;
  };
  for (const b of v.buchungen) {
    if (b.transfer && !b.kontobewegung) {
      // Dollar-Transfer: Verlust = Verkauf zu 0 (realisierter Verlust), sonst Ausbuchung
      b.typ = v.transferAls === "auszahlung" ? "ausbuchung" : "verkauf";
    } else if (b.transfer) {
      b.typ = v.transferAls === "auszahlung" ? (b.betrag < 0 ? "auszahlung" : "einzahlung") : (b.betrag < 0 ? "verlust" : "bonus");
      b.name = TYPEN[b.typ];
    }
    b.ueberspringen = !!b.storno; b.grund = b.storno ? b.grund || "storniert" : "";
    if (b.storno) continue;
    if (b.kontobewegung && !v.mitKonto) { b.ueberspringen = true; b.grund = "nur Broker"; continue; }
    if (refs.has(b.ref) || imDatei.has(b.ref)) { b.ueberspringen = true; b.grund = "schon importiert"; continue; }
    imDatei.add(b.ref);
    b.zurueck = false;
    if (b.saldo != null) {
      // Auszug nennt nur den Kontostand: auf diesen Stand bringen (Unterschied zum Stand im Depot an dem Tag)
      const bisher = ziel.buchungen.filter((x) => (x.datum || "") <= b.datum).reduce((a, x) => a + kassenDelta(x), 0);
      const diff = Math.round((b.saldo - bisher) * 100) / 100;
      if (Math.abs(diff) < 0.005) { b.ueberspringen = true; b.grund = "Kontostand stimmt schon"; continue; }
      b.betrag = diff; b.typ = diff > 0 ? "einzahlung" : "auszahlung"; b.name = TYPEN[b.typ];
      b.notiz = ziel.buchungen.length ? "Abgleich mit Kontostand laut Kontoauszug (" + fEur.format(b.saldo) + ")" : "Kontostand laut Kontoauszug";
      continue;
    }
    if (b.startbestand) {
      const da = b.kontobewegung ? ziel.buchungen.some((x) => !x.instrument) : ziel.buchungen.some((x) => x.instrument === instrumentId(b.isin, b.name, false));
      if (da) { b.ueberspringen = true; b.grund = "Bestand schon im Depot"; }
      continue;
    }
    if (b.auszug && auszugStart && b.datum <= auszugStart) { b.ueberspringen = true; b.grund = "vor Anfangsbestand " + datum(auszugStart); continue; }
    if (b.weich && doppelt(b)) { b.ueberspringen = true; b.grund = "vermutlich schon da (anderer Export, gleicher Tag, gleiche Menge)"; continue; }
    if (b.typ === "einbuchung" || b.kontobewegung) continue;
    const sInst = startInst[instrumentId(b.isin, b.name, false)];
    if (zurueck && ["kauf", "verkauf"].includes(b.typ)) {
      if (sInst && b.datum <= sInst) { b.zurueck = true; v.rueck++; }
      continue;
    }
    const start = [startKonto[b.konto || v.konto], sInst].filter(Boolean).sort().pop();
    if (start && b.datum <= start) { b.ueberspringen = true; b.grund = "vor Startbestand " + datum(start); }
  }
}

// Kraken-Kuerzel: alte Namen mit X/Z-Vorsatz, Staking-Varianten mit .S/.F/.B/.M.
const KRAKEN_ALT = { XXBT: "BTC", XBT: "BTC", XETH: "ETH", XXDG: "DOGE", XDG: "DOGE", XXRP: "XRP", XXLM: "XLM",
                     XLTC: "LTC", XETC: "ETC", XXMR: "XMR", XZEC: "ZEC", XREP: "REP", XMLN: "MLN" };
const KRYPTO_NAMEN = { BTC: "Bitcoin", ETH: "Ethereum", ADA: "Cardano", XRP: "XRP", DOGE: "Dogecoin", XLM: "Stellar",
                       TRX: "TRON", HBAR: "Hedera", NEAR: "NEAR Protocol", ONDO: "Ondo", SOL: "Solana", DOT: "Polkadot",
                       LTC: "Litecoin", LINK: "Chainlink", AVAX: "Avalanche", MATIC: "Polygon", POL: "Polygon", ATOM: "Cosmos" };
function krakenName(asset) {
  let c = String(asset || "").toUpperCase().replace(/\.(S|F|B|M|P|HOLD)$/, "").replace(/\d+\.S$/, "");
  c = KRAKEN_ALT[c] || c;
  return { code: c, name: KRYPTO_NAMEN[c] || c };
}
const istEuro = (a) => ["ZEUR", "EUR", "EUR.HOLD", "EUR.M"].includes(String(a).toUpperCase());

/** Anlageart aus dem Namen, wenn die Datei keine liefert (Scalable, Smartbroker-Transaktionen). */
function artRaten(name) {
  const n = String(name || "");
  if (/\b(ETC|ETP|Physical|Xetra-Gold|EUWAX Gold|Gold|Silber|Silver)\b/i.test(n)) return "ETC";
  if (/\b(ETF|UCITS|iShares|Vanguard|Xtrackers|Amundi|Lyxor|SPDR|Invesco|MSCI|FTSE|S&P 500|STOXX)\b/i.test(n)) return "ETF";
  return "Aktie";
}

/** Wertpapiere werden ueber die ISIN zusammengefuehrt, sonst ueber den Namen. */
function instrumentId(isin, name, anlegen = true, extra = {}) {
  const id = isin || "N:" + String(name).trim().toLowerCase();
  if (anlegen && !D.instrumente[id]) D.instrumente[id] = { name: String(name).trim(), isin: isin || "", ...extra };
  return id;
}

/** Kursliste in alle Depots: Kurs, Verlauf. Gibt [getroffen, unbekannt] zurueck. */
function kurslisteUebernehmen(liste) {
  let n = 0;
  const treffer = new Set();
  for (const d of Object.values(S.depots))
    for (const [id, i] of Object.entries(d.instrumente)) {
      const p = liste[id.toUpperCase()] || (i.ticker && liste[i.ticker.toUpperCase()]);
      if (!p || !p.length) continue;
      const punkte = [...p].sort((a, b) => a[0] - b[0]);
      if (i.kurs != null && i.kursDatum !== new Date(punkte.at(-1)[0] * 1000).toISOString().slice(0, 10)) i.kursVorher = i.kurs;
      Object.assign(i, { verlauf: { punkte, quelle: "Kursliste" }, kurs: punkte.at(-1)[1], faktorEUR: 1, waehrung: "EUR",
                         kursDatum: new Date(punkte.at(-1)[0] * 1000).toISOString().slice(0, 10) });
      treffer.add(id.toUpperCase()); n++;
    }
  return [n, Object.keys(liste).filter((k) => !treffer.has(k))];
}

function vorschauUebernehmen() {
  const v = ui.vorschau;
  const konto = document.getElementById("vorschau-konto").value.trim();
  v.konto = konto;
  vorschauPruefen(v);                       // Konto kann sich geaendert haben
  if (v.ziel === "neu") {
    const id = neueId("d");
    S.depots[id] = neuesDepot(konto || v.format, "eigen");
    v.ziel = id;
  }
  oeffnen(v.ziel);
  if (!D.buchungen.length && D.name === "Mein Depot" && konto) { D.name = konto; oeffnen(v.ziel); }
  let nr = D.buchungen.reduce((m, b) => Math.max(m, b.nr || 0), 0);
  let n = 0;
  // Jeder Import bekommt eine Kennung: so laesst er sich spaeter als Ganzes zuruecknehmen oder verschieben (Vorgabe 13.11.)
  const imp = neueId("i");
  // Kommt der vollstaendige Export (z. B. einmal pro Woche), ersetzt er Buchungen aus Screenshots: gleicher Tag, gleiche Richtung,
  // gleiche Stueckzahl und passender Wert (per ISIN oder Name - der Screenshot kennt keine ISIN).
  let ersetzt = 0;
  if (!/Screenshot/.test(v.format)) {
    const neu = v.buchungen.filter((b) => !b.ueberspringen && (b.typ === "kauf" || b.typ === "verkauf"));
    const weg = D.buchungen.filter((a) => a.screenshot && neu.some((b) => b.datum === a.datum && b.typ === a.typ && Math.abs((+b.stueck || 0) - (+a.stueck || 0)) <= 1e-4 * Math.max(1, +a.stueck || 0)
      && (instrumentId(b.isin, b.name, false) === a.instrument || namePasst((D.instrumente[a.instrument] || {}).name || a.instrument, b.name))));
    if (weg.length) { buchungenLoeschen(weg); ersetzt = weg.length; }
  }
  (D.importe ??= []).push({ id: imp, datei: v.datei || "", format: v.format, zeit: new Date().toISOString() });
  const schonBefuellt = D.buchungen.length > 0;     // "neu" erst nach dem ersten Import
  for (const b of v.buchungen.filter((x) => !x.ueberspringen)) {
    if (b.kontobewegung) {
      D.buchungen.push({ nr: ++nr, typ: b.typ, datum: b.datum, instrument: "", konto: konto, betrag: b.betrag,
                         gebuehr: b.gebuehr || 0, steuer: b.steuer || 0, notiz: b.notiz || "", ref: b.ref, quelle: v.format, importId: imp });
      n++;
      continue;
    }
    const neu = !D.instrumente[b.isin || "N:" + String(b.name).trim().toLowerCase()];
    const id = instrumentId(b.isin, b.name, true, { art: b.art || "Aktie", ticker: b.ticker || "", ...(b.richtung ? { richtung: b.richtung } : {}) });
    const inst = D.instrumente[id];
    if (b.ticker && !inst.ticker) inst.ticker = b.ticker;
    if (b.ohneStueck) inst.ohneStueck = true;
    // Ungerundet: Stueck x Kurs muss den Wert aus der Datei exakt treffen.
    if (b.kursAusDatei && b.kurs != null) { inst.kurs = b.kurs; inst.kursDatum = b.datum; }
    if (neu && b.typ === "kauf" && schonBefuellt) inst.status = "neu";
    D.buchungen.push({ nr: ++nr, typ: b.typ, datum: b.datum, instrument: id, konto: b.konto || konto,
                       stueck: b.stueck, kurs: b.kurs, gebuehr: b.gebuehr || 0, steuer: b.steuer || 0,
                       betrag: b.betrag, einstand: b.einstand, kasse: b.kasse ?? null, haltefrist: b.haltefrist || "",
                       notiz: b.notiz || "", ref: b.ref, quelle: v.format, importId: imp, ...(b.ertrag ? { ertrag: true } : {}), ...(b.screenshot ? { screenshot: true } : {}) });
    n++;
  }
  // Startbestand zurueckrechnen: Stichtag - Kaeufe + Verkaeufe davor, auf den Tag vor der ersten Buchung
  const rueckInst = new Set(v.buchungen.filter((b) => b.zurueck && !b.ueberspringen).map((b) => instrumentId(b.isin, b.name, false)));
  for (const iid of rueckInst) {
    const e = D.buchungen.filter((b) => b.instrument === iid && b.typ === "einbuchung" && !b.ertrag).sort((a, b) => b.datum.localeCompare(a.datum))[0];
    if (!e) continue;
    const davor = D.buchungen.filter((b) => b.instrument === iid && ["kauf", "verkauf"].includes(b.typ) && b.datum <= e.datum);
    const netto = davor.reduce((a, b) => a + (b.typ === "kauf" ? 1 : -1) * (+b.stueck || 0), 0);
    const anfang = (+e.stueck || 0) - netto, erster = davor.map((b) => b.datum).sort()[0];
    if (anfang <= 1e-9) { D.buchungen = D.buchungen.filter((b) => b !== e); continue; }
    const einstand = (e.einstand != null ? +e.einstand : (+e.stueck || 0) * (+e.kurs || 0)) * anfang / (+e.stueck || 1);
    Object.assign(e, { stueck: anfang, einstand, kurs: einstand / anfang, konto: davor[0].konto || e.konto, datum: new Date(Date.parse(erster + "T12:00Z") - 864e5).toISOString().slice(0, 10),
                       notiz: ((e.notiz || "") + " · zurückgerechnet").trim() });
  }
  ui.vorschau = null;
  originalMerken(v.original, imp, S.aktiv);
  sichern();
  meldung(`${n} Buchungen übernommen${rueckInst.size ? `, Startbestand von ${rueckInst.size} Wertpapieren zurückgerechnet` : ""}${ersetzt ? `, ${anzahl(ersetzt, "Screenshot-Buchung", "Screenshot-Buchungen")} durch den Export ersetzt` : ""}.`);
  if (ui.importSchlange) return naechsteDatei();
  zeige("uebersicht");
}

// ------------------------------------------------------------ Kurse
const kursWarten = {};
window.kursAntwort = (id, b64) => {
  const f = kursWarten[id];
  delete kursWarten[id];
  if (!f) return;
  // JSON wird geparst; Text (z. B. RSS-XML) kommt als Zeichenkette; leer = keine Verbindung.
  let text = "";
  try { text = new TextDecoder().decode(Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))); } catch { /* leer */ }
  if (!text) return f(null);
  try { f(JSON.parse(text)); } catch { f(text); }
};
function kursHolen(ticker, art = "kurs") {
  return new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok;
    APP[art](ticker, id);
    setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
}

/** Ticker zu einer ISIN finden. Euro-Boersen zuerst (Xetra, Frankfurt,
 *  Stuttgart, Paris, Amsterdam, Mailand) - dann passt der Kurs ohne Umrechnung
 *  zum Einstand aus der Abrechnung. Krypto: "<Kuerzel>-EUR". */
const EURO_BOERSEN = [".DE", ".F", ".SG", ".PA", ".AS", ".MI", ".VI", ".BR"];
async function tickerSuchen(i) {
  if (i.art === "Krypto" && /^[A-Z0-9]{2,10}$/.test(i.isin || "")) return await kryptoTicker(i.isin);
  if (!i.isin) return null;
  return (await tickerFuerKennung(i.isin))?.ticker || null;
}

// ------------------------------------------------------------ Bessere Suche (0.55, Suchtest 17.11.2026 mit 53 echten Werten)
// Yahoo per ISIN liefert bei ETFs oft London/Mailand in USD/GBp, per WKN fast nichts (und Fehltreffer an der
// Taiwan-Boerse ".TWO"). Onvista kennt alle Testwerte per ISIN und WKN und liefert das deutsche Kuerzel ->
// "<Kuerzel>.DE" (Xetra) bzw. ".F" (Frankfurt) in Euro: 45/53. Rest (vor allem ETCs) findet Yahoo per ISIN in
// Stuttgart (".SG", Euro) - zusammen 53/53. Krypto ohne Euro-Paar bei Yahoo (NEAR, HYPE, SUI): Krypto-Suche,
// dann "-EUR" bevorzugt, sonst "-USD" (die App rechnet in Euro um).
const kursMeta = async (t) => { const j = await kursHolen(t, "kurs"); return j?.chart?.result?.[0]?.meta || null; };
const kursInEuro = async (t) => { const m = await kursMeta(t); return !!(m && m.regularMarketPrice > 0 && m.currency === "EUR"); };
const istWkn = (s) => /^[A-Z0-9]{6}$/.test(String(s || "")) && /\d/.test(String(s));
async function onvistaTreffer(begriff) {
  if (!APP?.onvistaSuche || !begriff || String(begriff).length > 80) return [];
  const j = await kursHolen(String(begriff).trim(), "onvistaSuche");
  return (j?.list || []).filter((e) => e && (e.isin || e.symbol));
}
/** Euro-Notierung aus einer Yahoo-Suche (nie ".TWO" o. Ae.). */
async function euroTicker(q) {
  const j = await kursHolen(q, "suche");
  const s = (j?.quotes || []).map((x) => x.symbol).filter(Boolean);
  for (const b of EURO_BOERSEN) { const t = s.find((x) => x.endsWith(b)); if (t) return { ticker: t, alle: s }; }
  return { ticker: null, alle: s };
}
/** ISIN oder WKN -> { ticker, name, isin, wkn, art } (Euro-Boerse bevorzugt) oder null. */
async function tickerFuerKennung(kennung) {
  const k = String(kennung || "").trim().toUpperCase();
  if (!k) return null;
  const e = (await onvistaTreffer(k))[0] || null;
  const sym = e?.symbol && /^[A-Z0-9]{1,8}$/.test(e.symbol) ? e.symbol : null;
  const info = { name: e?.name || "", isin: e?.isin || (istIsin(k) ? k : ""), wkn: e?.wkn || (istWkn(k) ? k : ""), art: e?.entityType || "" };
  for (const t of sym ? [sym + ".DE", sym + ".F"] : []) if (await kursInEuro(t)) return { ...info, ticker: t };
  if (info.isin) { const r = await euroTicker(info.isin); if (r.ticker) return { ...info, ticker: r.ticker };
    if (sym) { const r2 = await euroTicker(sym); if (r2.ticker) return { ...info, ticker: r2.ticker }; }
    if (r.alle[0] && !/\.TWO$/.test(r.alle[0])) return { ...info, ticker: r.alle[0] }; }
  return null;
}
/** Krypto: "<Kuerzel>-EUR", wenn Yahoo dafuer einen Kurs hat, sonst ueber die Krypto-Suche (z. B. HYPE32196-USD). */
async function kryptoTicker(code) {
  const c = String(code || "").toUpperCase(), std = `${c}-EUR`;
  const m = await kursMeta(std);
  if (m?.regularMarketPrice > 0) return std;
  const j = await kursHolen(c, "suche");
  const q = (j?.quotes || []).filter((x) => x.quoteType === "CRYPTOCURRENCY" && x.symbol && x.symbol.toUpperCase().startsWith(c)).map((x) => x.symbol);
  return q.find((s) => s.endsWith("-EUR")) || q.find((s) => s.endsWith("-USD")) || std;
}
// ------------------------------------------------------------ Zertifikate (ab 0.42): Kurse ueber Onvista per ISIN/WKN
const ZERT_ARTEN = new Set(["Zertifikat", "Optionsschein", "Anleihe"]);
/** Richtung eines Hebelprodukts aus dem Namen: Short/Put/Bear/"TurboP" -> short, Long/Call/Bull/"TurboC" -> long, sonst null. */
function richtungAusName(name) {
  const n = String(name || "");
  if (/\b(short|put|bear|puts)\b|turbo ?p\b|turbop|mini ?short|faktor ?-|\bshrt\b/i.test(n)) return "short";
  if (/\b(long|call|bull|calls)\b|turbo ?c\b|turboc|mini ?long|faktor ?\+?\d/i.test(n)) return "long";
  return null;
}
const istIsin = (s) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(String(s || ""));
function onvistaAbruf(art, isin) {
  return new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok;
    APP.onvistaKurs(art, isin, id);
    setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
}
/** Kurs eines Zertifikats: einmal suchen (Art + ISIN merken), dann Kurs holen. Ergebnis { kurs, waehrung, datum, boerse } oder null. */
async function zertifikatKurs(i) {
  if (!APP?.onvistaSuche) return null;
  if (!i.onvistaArt || !istIsin(i.isin)) {
    const begriff = istIsin(i.isin) ? i.isin : i.wkn || i.isin || i.name;
    const s = await kursHolen(begriff, "onvistaSuche");
    const x = (s?.list || []).find((y) => istIsin(y.isin) && (!istIsin(i.isin) || y.isin === i.isin));
    if (!x) return null;
    i.onvistaArt = x.entityType; if (!istIsin(i.isin)) i.isin = x.isin; if (!i.wkn && x.wkn) i.wkn = x.wkn;
    if (!i.richtung) i.richtung = richtungAusName(x.name) || undefined;
  }
  const q = (await onvistaAbruf(i.onvistaArt, i.isin))?.quote;
  if (!q || q.last == null) return null;
  return { kurs: +q.last, waehrung: q.isoCurrency || "EUR", datum: String(q.datetimeLast || "").slice(0, 10) || heute(), boerse: q.market?.name || "" };
}

async function kurseAktualisieren() {
  if (ui.gesperrt) return;
  if (!APP) return meldung("Kurse gibt es nur in der App.");
  if (netzGesperrt()) return;
  // Erst pruefen, ob Yahoo ueberhaupt erreichbar ist - sonst klingt "ohne Kurs"
  // nach einem Datenfehler, obwohl nur das Netz fehlt.
  meldung("Prüfe Verbindung …");
  const eurUsd = await kursHolen("EURUSD=X");
  if (!eurUsd?.chart) return meldung("Keine Verbindung zu Yahoo – bitte WLAN oder mobile Daten prüfen.");
  // Euro-Dollar-Kurs merken (0.53): Vorgabe fuer die Dollar-Umrechnung in den Rechnern
  { const k = eurUsd.chart.result?.[0]?.meta?.regularMarketPrice; if (k > 0) (S.einstellungen ||= {}).eurUsd = { kurs: k, datum: heute() }; }
  // Fehlende Ticker einmalig ueber die ISIN suchen (z. B. nach TR-Import).
  const ohne = Object.values(S.depots).flatMap((d) => Object.values(d.instrumente)).filter((i) => !i.ticker && i.isin && !ZERT_ARTEN.has(i.art));
  if (ohne.length) meldung(`Suche ${ohne.length} Ticker …`);
  for (const i of ohne) { const t = await tickerSuchen(i); if (t) i.ticker = t; }
  for (const w of (S.watchlist || []).filter((w) => !w.ticker && !w.kursHand)) { const t = await watchTicker(w); if (t) w.ticker = t; }
  // Krypto mit "-EUR"-Ticker, den es bei Yahoo nicht gibt (NEAR, HYPE, SUI …): einmal pruefen und ggf. ersetzen (0.55)
  for (const i of Object.values(S.depots).flatMap((d) => Object.values(d.instrumente)).filter((i) => i.art === "Krypto" && /-EUR$/.test(i.ticker || "") && !i.kryptoGeprueft)) {
    const t = await kryptoTicker(i.ticker.replace(/-EUR$/, "")); i.kryptoGeprueft = true; if (t) i.ticker = t; }
  // Jeder Ticker nur einmal, auch wenn er in mehreren Depots oder der Watchlist steht.
  const jeTicker = {};
  for (const d of Object.values(S.depots))
    for (const i of Object.values(d.instrumente)) if (i.ticker) (jeTicker[i.ticker] ??= []).push(i);
  for (const w of S.watchlist || []) if (w.ticker && !w.kursHand) (jeTicker[w.ticker] ??= []).push(w);
  const ticker = Object.keys(jeTicker);
  // Zertifikate, Optionsscheine, Anleihen (und Werte ohne Yahoo-Ticker, aber mit ISIN/WKN): ueber Onvista
  const jeZert = {};
  for (const d of Object.values(S.depots)) for (const i of Object.values(d.instrumente))
    if ((ZERT_ARTEN.has(i.art) || (!i.ticker && (istIsin(i.isin) || i.wkn))) && i.art !== "Krypto") (jeZert[i.isin || i.wkn || i.name] ??= []).push(i);
  let zertOk = 0;
  const zertFehl = [];
  for (const [k, liste] of Object.entries(jeZert)) {
    meldung(`Hole Zertifikat-Kurse ${zertOk + 1}/${Object.keys(jeZert).length} …`);
    const r = await zertifikatKurs(liste[0]);
    if (!r || r.waehrung !== "EUR") { zertFehl.push(liste[0].name || k); continue; }
    for (const x of liste) {
      if (x !== liste[0]) { x.isin = liste[0].isin; x.onvistaArt = liste[0].onvistaArt; x.wkn = x.wkn || liste[0].wkn; }
      if (x.kurs != null) { x.kursVorher = x.kurs; x.kursVorherDatum = x.kursDatum || null; }
      x.kurs = r.kurs; x.kursDatum = r.datum; x.waehrung = "EUR"; x.kursQuelle = "Onvista" + (r.boerse ? " · " + r.boerse : "");
    }
    zertOk++;
  }
  if (!ticker.length) {
    if (zertOk) (S.einstellungen ??= {}).letzterAbruf = new Date().toISOString();
    sichernAlle(); zeichnen();
    return meldung(zertOk ? `${zertOk} Zertifikat-Kurse aktualisiert${zertFehl.length ? ", ohne Kurs: " + zertFehl.slice(0, 3).join(", ") : ""}.` : "Kein Wertpapier hat einen Ticker oder eine ISIN/WKN.");
  }
  meldung(`Hole ${ticker.length} Kurse …`);
  const fx = { EUR: 1 };
  let ok = 0, fehl = [];
  for (const t of ticker) {
    const i = { name: jeTicker[t][0].name, ticker: t };
    const j = await kursHolen(t);
    const meta = j?.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) {
      fehl.push(i.name);
      // Ohne Internet liefe sonst jeder Titel 20 s ins Leere.
      if (!ok && fehl.length >= 2 && j == null) { meldung("Keine Verbindung – bitte WLAN oder mobile Daten prüfen."); return; }
      continue;
    }
    let preis = meta.regularMarketPrice, w = meta.currency || "EUR";
    if (["GBp", "GBX", "ZAc", "ILA"].includes(w)) { preis /= 100; w = { GBp: "GBP", GBX: "GBP", ZAc: "ZAR", ILA: "ILS" }[w]; }
    if (fx[w] == null) {
      const f = await kursHolen(`EUR${w}=X`);
      fx[w] = f?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null;
    }
    if (!fx[w]) { fehl.push(i.name + " (" + w + ")"); continue; }
    const tag = new Date((meta.regularMarketTime || Date.now() / 1000) * 1000).toISOString().slice(0, 10);
    // faktor: Euro je Einheit der Boersenwaehrung (inkl. Pence/Cent-Teiler) -
    // damit rechnet der Kalender Dividenden aus dem Verlauf in Euro um.
    const faktor = (preis / fx[w]) / meta.regularMarketPrice;
    for (const x of jeTicker[t]) {
      if (x.kurs != null) { x.kursVorher = x.kurs; x.kursVorherDatum = x.kursDatum || null; }   // fuer "seit letzter Aktualisierung"
      x.kurs = rund(preis / fx[w], 4); x.kursDatum = tag; x.faktorEUR = faktor; x.waehrung = meta.currency;
      if (x.kursStart == null && x.aufgenommen) x.kursStart = x.kurs;          // Watchlist: Kurs bei Aufnahme
    }
    ok++;
    meldung(`Lade Chart und Termine ${ok}/${ticker.length} …`);
    await zusatzdaten(t, jeTicker[t]);
  }
  if (ok) (S.einstellungen ??= {}).letzterAbruf = new Date().toISOString();
  sichernAlle();
  zeichnen();
  fehl.push(...zertFehl);
  meldung(`${ok + zertOk} Werte aktualisiert${zertOk ? ` (davon ${zertOk} Zertifikate über Onvista)` : ""}${fehl.length ? ", ohne Kurs: " + fehl.slice(0, 3).join(", ") + (fehl.length > 3 ? " …" : "") : ""}.`);
}

/** Wochenkurse 1 Jahr (Mini-Chart), Dividenden der letzten 12 Monate, und
 *  bei Aktien die Termine und Quartalszahlen. Alles wird gespeichert und ist
 *  danach offline sichtbar. */
async function zusatzdaten(ticker, instrumente) {
  const v = (await kursHolen(ticker, "verlauf"))?.chart?.result?.[0];
  const verlauf = v ? {
    punkte: (v.timestamp || []).map((t, k) => [t, v.indicators?.quote?.[0]?.close?.[k]]).filter((p) => p[1] != null),
    dividenden: Object.values(v.events?.dividends || {}).map((d) => [new Date(d.date * 1000).toISOString().slice(0, 10), d.amount])
      .sort((a, b) => a[0].localeCompare(b[0])),
    stand: heute(),
  } : null;
  let termine = null;
  if (instrumente.some((i) => (i.art || "Aktie") === "Aktie")) {
    const r = (await kursHolen(ticker, "termine"))?.quoteSummary?.result?.[0];
    if (r) {
      const roh = (x) => x?.raw ?? null;
      const tag = (x) => x?.raw ? new Date(x.raw * 1000).toISOString().slice(0, 10) : null;
      termine = {
        earnings: (r.calendarEvents?.earnings?.earningsDate || []).map(tag).filter(Boolean),
        exDividende: tag(r.calendarEvents?.exDividendDate),
        zahltag: tag(r.calendarEvents?.dividendDate),
        quartale: (r.earningsHistory?.history || []).map((h) => ({
          quartal: h.quarter?.fmt, eps: roh(h.epsActual), erwartet: roh(h.epsEstimate), ueberraschung: roh(h.surprisePercent) })),
        finanzen: (r.earnings?.financialsChart?.quarterly || []).map((q) => ({
          quartal: q.date, umsatz: roh(q.revenue), gewinn: roh(q.earnings) })),
        divRendite: roh(r.summaryDetail?.dividendYield), kgv: roh(r.summaryDetail?.trailingPE),
        kgvErwartet: roh(r.summaryDetail?.forwardPE), stand: heute(),
        analysten: analystenAus(r),
      };
    }
  }
  for (const i of instrumente) {
    if (verlauf) i.verlauf = verlauf;
    if (termine) {
      // Vergangene Earnings-Termine aufheben (Yahoo nennt nur den naechsten) - damit sie im Kalender bleiben und man die Auswertung sieht
      const alt = [...(i.termine?.earnings || []), ...(i.termine?.earningsGewesen || [])].filter((d) => d < heute());
      termine.earningsGewesen = [...new Set([...alt, ...termine.earnings.filter((d) => d < heute())])].sort().slice(-12);
      i.termine = termine;
    }
  }
}

// ------------------------------------------------------------ Export
function exportieren(name, mime, text) {
  if (APP) return APP.exportieren(name, mime, text);
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: mime }));
  a.download = name;
  a.click();
}
window.gespeichert = (ok) => meldung(ok ? "Datei gespeichert." : "Nicht gespeichert.");

function bestandCsv() {
  const kopf = "Konto,Instrument,Art,Ticker,Stueck,Wert_EUR,Einstand_EUR,Haltefrist_Ende,Notiz";
  const q = (s) => /[",\n]/.test(s) ? '"' + String(s).replace(/"/g, '""') + '"' : String(s ?? "");
  const zeilen = Object.values(bestand()).filter((p) => p.stueck > 1e-9).map((p) => {
    const i = D.instrumente[p.instrument] || {};
    const wert = i.kurs != null ? p.stueck * i.kurs : p.einstand;
    return [p.konto, i.name, i.art || "", i.ticker || "", i.ohneStueck ? "" : p.stueck, wert.toFixed(2), p.einstand.toFixed(2), "",
            i.isin ? "ISIN " + i.isin : ""].map(q).join(",");
  });
  return [kopf, ...zeilen].join("\n") + "\n";
}

/** Screenshot verkleinern, damit depot.json nicht ueberquillt. */
function bildLesen(datei) {
  return new Promise((ok, fehler) => {
    const r = new FileReader();
    r.onload = () => {
      const img = new Image();
      img.onload = () => {
        const f = Math.min(1, 1100 / Math.max(img.width, img.height));
        const c = document.createElement("canvas");
        c.width = Math.round(img.width * f); c.height = Math.round(img.height * f);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        ok(c.toDataURL("image/jpeg", 0.72));
      };
      img.onerror = fehler;
      img.src = r.result;
    };
    r.onerror = fehler;
    r.readAsDataURL(datei);
  });
}

// ------------------------------------------------------------ Steuerung
/** Auf jeder Seite mit Zahlen: kein Rat, keine Garantie (Vorgabe 07.11.2026). */
function fusszeileDazu(html) {
  return html + `<p class="fuss-hinweis">Keine Anlageberatung · keine Garantie. Kurse, Termine und Schätzungen können falsch oder veraltet sein – sicher sind nur deine eigenen Buchungen.</p>`;
}

function zeige(seite) {
  ui.plus = null; ui.depotEdit = null;
  ui.seite = seite; ui.detail = null; ui.formular = null; ui.notiz = null; ui.watch = null; ui.treffer = null; ui.watchEntwurf = null; ui.termin = null;
  zeichnen(); scrollTo(0, 0);
}
function zeichnen() {
  const inhalt = document.getElementById("inhalt");
  if (ui.gesperrt) {
    document.getElementById("leiste").hidden = true;
    inhalt.innerHTML = pinSeite();
    uebersetzeDom(document.body);
    if (!ui.pinBereit) { ui.pinBereit = true; APP?.sperrBildschirmBereit?.(); }
    return;
  }
  // Erster Start: erst Hinweis und Anleitung, dann die App.
  if (ui.einfuehrung == null && (S.einstellungen?.einfuehrung || 0) < EINFUEHRUNG_STAND) ui.einfuehrung = 1;
  document.getElementById("leiste").hidden = !!ui.einfuehrung;
  if (ui.einfuehrung) { inhalt.innerHTML = einfuehrungSeite(); uebersetzeDom(document.body); return; }
  inhalt.innerHTML = fusszeileDazu(ui.formular ? buchungsFormular()
    : ui.wiederherstellen ? entsperrSeite()
    : ui.depotEmpfang ? depotEmpfangSeite()
    : ui.termin ? terminFormular()
    : ui.notiz ? notizFormular()
    : ui.watch ? watchFormular()
    : ui.detail ? detailSeite(ui.detail)
    : { uebersicht, positionen: positionenSeite, buchungen: buchungenSeite, daten: datenSeite, depots: depotsSeite,
        kalender: kalenderSeite, watchlist: watchlistSeite, mehr: mehrSeite, notizen: notizenSeite, ki: kiSeite,
        schluessel: schluesselSeite, datenschutz: datenschutzSeite, news: newsSeite, sicherheit: sicherheitSeite,
        sachwerte: sachwerteSeite, einstellungen: einstellungenSeite, steuer: steuerSeite, feedback: feedbackSeite, hinweise: hinweiseSeite, unterstuetzen: unterstuetzenSeite, fehlerprotokoll: fehlerprotokollSeite }[ui.seite]());
  if (!ui.formular && !ui.detail && !ui.notiz && !ui.watch && !ui.termin && !ui.vorschau && ui.seite === "uebersicht")
    inhalt.insertAdjacentHTML("beforeend", `<button class="fab" data-plus="auf" aria-label="Hinzufügen: Datei, Depot, Buchung, Sachwert">+</button>`);
  else if (!ui.formular && !ui.detail && !ui.notiz && !ui.watch && !ui.termin && !ui.vorschau && ["positionen", "buchungen"].includes(ui.seite) && D.buchungen.length)
    inhalt.insertAdjacentHTML("beforeend", `<button class="fab" data-neu="buchung" aria-label="Neue Buchung">+</button>`);
  document.getElementById("titel").textContent = ui.seite === "uebersicht" && !ui.detail && gesamtAnsicht() ? (ui.person ? ui.person + " – alle Depots" : personen().length > 1 ? "Haushalt" : "Alle Depots")
    : D.name + (D.rolle === "beobachtet" ? " 👁" : "");
  const gruppe = ui.seite === "watchlist" ? "positionen" : ["uebersicht", "positionen", "kalender", "news", "notizen", "ki"].includes(ui.seite) ? ui.seite : "mehr";
  document.querySelectorAll("#leiste button").forEach((b) => b.classList.toggle("aktiv", b.dataset.ziel === gruppe));
  const auge = document.getElementById("auge");
  auge.setAttribute("aria-pressed", String(ui.verdeckt));
  uebersetzeDom(document.body);
}
window.zurueck = () => {
  if (ui.einfuehrung === 3) { ui.einfuehrung = 2; zeichnen(); return true; }
  if (ui.einfuehrung === 2) { ui.einfuehrung = 1; zeichnen(); return true; }
  if (ui.einfuehrung === 1) return false;
  if (ui.plus || ui.depotEdit) { ui.plus = null; ui.depotEdit = null; zeichnen(); return true; }
  if (ui.sachwert) { ui.sachwert = null; zeichnen(); return true; }
  if (ui.notiz) { ui.notiz = null; zeichnen(); return true; }
  if (ui.termin) { ui.termin = null; zeichnen(); return true; }
  if (ui.zuordnung) { ui.zuordnung = null; zeichnen(); return true; }
  if (ui.formular || ui.detail || ui.vorschau || ui.watch) { ui.formular = null; ui.detail = null; ui.vorschau = null; ui.watch = null; ui.treffer = null; ui.watchEntwurf = null; zeichnen(); return true; }
  if (ui.wiederherstellen) { ui.wiederherstellen = null; zeichnen(); return true; }
  if (["buchungen", "daten", "schluessel", "datenschutz", "depots", "sicherheit", "sachwerte", "einstellungen", "steuer", "feedback"].includes(ui.seite)) { zeige("mehr"); return true; }
  if (ui.seite !== "uebersicht") { zeige("uebersicht"); return true; }
  return false;
};

document.addEventListener("click", async (e) => {
  const t = (s) => e.target.closest(s);
  let x;
  if ((x = t("[data-ziel]"))) return zeige(x.dataset.ziel);
  if (t(".marke")) return zeige("depots");
  if ((x = t("[data-depot]"))) { ui.alle = false; oeffnen(x.dataset.depot); sichern(); meldung(D.name + " geöffnet."); return zeige("uebersicht"); }
  if ((x = t("[data-aufteilung]"))) { ui.aufteilung = x.dataset.aufteilung; return zeichnen(); }
  if ((x = t("[data-posansicht]"))) { ui.posAnsicht = x.dataset.posansicht; return zeichnen(); }
  if ((x = t("[data-termin]"))) { ui.termin = x.dataset.termin; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-termin-loeschen]"))) {
    if (!confirm("Termin löschen?")) return;
    S.eigeneTermine = S.eigeneTermine.filter((y) => y.id !== x.dataset.terminLoeschen); ui.termin = null; sichern(); return zeichnen();
  }
  if ((x = t("[data-kalart]"))) { ui.kalArt = x.dataset.kalart; return zeichnen(); }
  if ((x = t("[data-gvmonat]"))) { ui.gvMonat = x.dataset.gvmonat; return zeichnen(); }
  if ((x = t("[data-kalmonat]"))) { ui.kalMonat = x.dataset.kalmonat; ui.kalTag = null; return zeichnen(); }
  if ((x = t("[data-kaltag]"))) { ui.kalTag = ui.kalTag === x.dataset.kaltag ? null : x.dataset.kaltag; return zeichnen(); }
  if ((x = t("[data-kal]"))) { ui.kalenderAlle = x.dataset.kal === "alle"; return zeichnen(); }
  if ((x = t("[data-zurueck]")) && ui.vorschau) { ui.vorschau.zurueck = x.dataset.zurueck === "an"; vorschauPruefen(ui.vorschau); return zeichnen(); }
  if ((x = t("[data-transfer]")) && ui.vorschau) { ui.vorschau.transferAls = x.dataset.transfer; vorschauPruefen(ui.vorschau); return zeichnen(); }
  if ((x = t("[data-umfang]")) && ui.vorschau) {
    ui.vorschau.mitKonto = x.dataset.umfang === "alles"; vorschauPruefen(ui.vorschau); return zeichnen();
  }
  if ((x = t("[data-position]"))) {
    if (!D.instrumente[x.dataset.position]) {
      const id = Object.keys(S.depots).find((k) => S.depots[k].instrumente[x.dataset.position]);
      if (id) oeffnen(id);
    }
    ui.detail = x.dataset.position; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-depot-edit]"))) { ui.depotEdit = x.dataset.depotEdit || null; ui.plus = null; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-depot-leeren]"))) {
    const d = S.depots[x.dataset.depotLeeren];
    if (!d || !confirm(`Alle Buchungen und Wertpapiere von „${d.name}“ löschen und neu einlesen? Name und Einstellungen bleiben. Vorher am besten eine Sicherung machen.`)) return;
    Object.assign(d, { instrumente: {}, buchungen: [] }); oeffnen(x.dataset.depotLeeren); ui.alle = false; ui.depotEdit = null; sichern();
    meldung(`„${d.name}“ ist leer – jetzt die neue Datei wählen.`); return zeige("daten");
  }
  if ((x = t("[data-depot-weg]"))) {
    const d = S.depots[x.dataset.depotWeg];
    if (!d || !confirm(`Depot „${d.name}“ mit allen ${d.buchungen.length} Buchungen löschen? Das lässt sich nur mit einer Sicherung rückgängig machen.`)) return;
    delete S.depots[x.dataset.depotWeg]; ui.depotEdit = null; oeffnen(Object.keys(S.depots)[0]); sichern(); meldung("Depot gelöscht."); return zeige("uebersicht");
  }
  if ((x = t("[data-steuerjahr]"))) { ui.steuerJahr = x.dataset.steuerjahr; return zeichnen(); }
  if ((x = t("[data-chartart]"))) { ui.chartArt = x.dataset.chartart; return zeichnen(); }
  if ((x = t("[data-wertzeitraum]"))) { ui.wertZeitraum = x.dataset.wertzeitraum; return zeichnen(); }
  if ((x = t("[data-plus]"))) {
    const w = x.dataset.plus;
    ui.plus = w === "zu" ? null : w === "auf" ? (ui.plus ? null : "menue") : w;
    zeichnen(); return scrollTo(0, 0);
  }
  if ((x = t("[data-sicht]"))) { const l = sichten(); return sichtSetzen(l[(sichtIndex(l) + +x.dataset.sicht + l.length) % l.length]); }
  if ((x = t("[data-sicht-wahl]"))) { ui.sichtWahl = !ui.sichtWahl; return zeichnen(); }
  if ((x = t("[data-sicht-nr]"))) { ui.sichtWahl = false; return sichtSetzen(sichten()[+x.dataset.sichtNr]); }
  if ((x = t("[data-person]"))) {
    ui.person = x.dataset.person || null; ui.alle = true;
    const erstes = sichtDepots()[0];
    if (erstes && !sichtDepots().includes(S.aktiv)) oeffnen(erstes);
    return zeige("uebersicht");
  }
  if ((x = t("[data-ansicht]"))) {
    if (x.dataset.ansicht === "alle") ui.alle = true; else { ui.alle = false; oeffnen(x.dataset.ansicht); sichern(); }
    ui.plus = null; return zeige("uebersicht");
  }
  if ((x = t("[data-neu]"))) { ui.plus = null; ui.formular = { instrument: x.dataset.instrument || "" }; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-bearbeiten]"))) { ui.formular = { nr: +x.dataset.bearbeiten }; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-earnings]"))) { const [did, iid, datum] = x.dataset.earnings.split("|"); ui.earnings = { did, iid, datum }; zeichnen(); return scrollTo(0, 0); }
  if (t("[data-earnings-zu]")) { ui.earnings = null; return zeichnen(); }
  if (t("[data-earnings-neu]")) return earningsAktualisieren();
  if ((x = t("[data-import-wahl]"))) { ui.importWahl = ui.importWahl === x.dataset.importWahl ? null : x.dataset.importWahl; return zeichnen(); }
  if ((x = t("[data-import-verschieben]"))) {
    const l = gruppeBuchungen(x.dataset.importVerschieben), nach = document.getElementById("import-ziel")?.value, ziel = S.depots[nach];
    if (!ziel || !confirm(`${anzahl(l.length, "Buchung", "Buchungen")} nach „${ziel.name}“ verschieben?`)) return;
    const n = buchungenVerschieben(S.aktiv, nach, l);
    for (const o of S.originale || []) if (l.some((b) => b.importId && b.importId === o.importId)) o.depot = nach;
    ui.importWahl = null; sichernAlle(); meldung(`${anzahl(n, "Buchung", "Buchungen")} nach „${ziel.name}“ verschoben.`); return zeichnen();
  }
  if ((x = t("[data-import-neu]"))) {
    // Neu einlesen: Buchungen dieses Imports entfernen, Original erneut durch Erkennung + Vorschau (z. B. nach Verbesserungen oder ins andere Depot)
    const o = (S.originale || []).find((y) => y.importId === x.dataset.importNeu), b64 = o && APP?.originalLesen ? APP.originalLesen(o.id) : "";
    if (!b64) return meldung("Original nicht gefunden.");
    if (!confirm(`„${o.name}“ neu einlesen? Die ${anzahl(gruppeBuchungen(x.dataset.importNeu).length, "Buchung", "Buchungen")} dieses Imports werden ersetzt.`)) return;
    buchungenLoeschen(gruppeBuchungen(x.dataset.importNeu)); ui.importWahl = null; sichern();
    const f = new File([b64ZuBytes(b64)], o.name, { type: o.typ === "PDF" ? "application/pdf" : o.typ === "Screenshot" ? "image/png" : "text/plain" });
    f.vorhandenesOriginal = o.id;
    return dateienEinlesen([f]);
  }
  if ((x = t("[data-original-neu]"))) {
    const o = (S.originale || []).find((y) => y.id === x.dataset.originalNeu), b64 = o && APP?.originalLesen ? APP.originalLesen(o.id) : "";
    if (!b64) return meldung("Original nicht gefunden.");
    const f = new File([b64ZuBytes(b64)], o.name, { type: o.typ === "PDF" ? "application/pdf" : o.typ === "Screenshot" ? "image/png" : "text/plain" });
    f.vorhandenesOriginal = o.id;
    return dateienEinlesen([f]);
  }
  if ((x = t("[data-original-weg]"))) {
    const o = (S.originale || []).find((y) => y.id === x.dataset.originalWeg);
    if (!o || !confirm(`Dokument „${o.name}“ aus der App löschen?`)) return;
    APP?.originalLoeschen?.(o.id); S.originale = S.originale.filter((y) => y !== o); sichern(); meldung("Dokument gelöscht."); return zeichnen();
  }
  if ((x = t("[data-import-loeschen]"))) {
    const l = gruppeBuchungen(x.dataset.importLoeschen);
    if (!confirm(`Diesen Import zurücknehmen? ${anzahl(l.length, "Buchung", "Buchungen")} werden aus „${D.name}“ gelöscht.`)) return;
    const o = originaleLoeschen(new Set(l.map((b) => b.importId).filter(Boolean)));
    buchungenLoeschen(l); ui.importWahl = null; sichern(); meldung(`${anzahl(l.length, "Buchung", "Buchungen")} gelöscht${o ? ", Original entfernt" : ""}.`); return zeichnen();
  }
  if ((x = t("[data-buchung-verschieben]"))) {
    const b = D.buchungen.find((y) => y.nr === +x.dataset.buchungVerschieben), nach = document.getElementById("buchung-ziel")?.value, ziel = S.depots[nach];
    if (!b || !ziel || !confirm(`Diese Buchung nach „${ziel.name}“ verschieben?`)) return;
    buchungenVerschieben(S.aktiv, nach, [b]); ui.formular = null; sichernAlle(); meldung(`Buchung nach „${ziel.name}“ verschoben.`); return zeichnen();
  }
  if ((x = t("[data-loeschen]"))) {
    if (!confirm("Diese Buchung löschen?")) return;
    D.buchungen = D.buchungen.filter((b) => b.nr !== +x.dataset.loeschen);
    sichern(); ui.formular = null; meldung("Buchung gelöscht."); return zeichnen();
  }
  if (!(x = t("[data-los]"))) return;
  switch (x.dataset.los) {
    case "zurueck": return window.zurueck();
    case "import": return zeige("daten");
    case "zip-export": return zipExportieren();
    case "kurse": return kurseAktualisieren();
    case "vorschau-ok": return vorschauUebernehmen();
    case "zuordnung-weg": ui.zuordnung = null; if (ui.importSchlange) return naechsteDatei(); return zeichnen();
    case "zuordnung-ok": {
      const r = ui.zuordnung;
      r.z.konto = document.getElementById("zuordnung-konto").value.trim();
      r.z.merken = document.getElementById("zuordnung-merken").checked;
      try {
        const v = zuordnungAnwenden(r, r.z);
        if (r.z.merken) ((S.einstellungen ??= {}).zuordnungen ??= {})[kopfSignatur(r.kopf)] = JSON.parse(JSON.stringify(r.z));
        v.datei = r.dateiname; v.original = r.original; ui.zuordnung = null; ui.vorschau = v; sichern(); zeichnen(); return scrollTo(0, 0);
      } catch (err) { return meldung(err.message); }
    }
    case "vorschau-weg": ui.vorschau = null; if (ui.importSchlange) return naechsteDatei(); return zeichnen();
    // Unverschluesselter Gesamt-Export (.json) ist seit 0.16 entfernt - nur noch .dksafe.
    case "export-csv": {
      // Jeder Export ist verschluesselt - mit dem eigenen Sicherungs-Passwort (.dksafe).
      const name = `bestand-${D.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}-${heute()}.csv`;
      if (!APP) return exportieren(name, "text/csv", bestandCsv());               // nur Browser-Test
      if (!APP.exportVerschluesselt(name + ".dksafe", bestandCsv())) {
        meldung("Erst ein eigenes Sicherungs-Passwort festlegen (⚙️ → Sicherheit & Sicherung)."); return zeige("sicherheit");
      }
      return;
    }
    case "alles-loeschen":
      if (!confirm(`Wirklich ALLE Buchungen und Wertpapiere von „${D.name}“ löschen? Vorher eine Sicherung machen!`)) return;
      Object.assign(D, { instrumente: {}, buchungen: [] }); sichern(); meldung("Depot geleert."); return zeige("uebersicht");
    case "depot-loeschen":
      if (!confirm(`Depot „${D.name}“ mit allen Buchungen löschen?`)) return;
      delete S.depots[S.aktiv]; oeffnen(Object.keys(S.depots)[0]); sichern(); meldung("Depot gelöscht."); return zeige("depots");
  }
});

document.addEventListener("change", async (e) => {
  if (e.target.id === "sortierung") { ui.sortierung = e.target.value; return zeichnen(); }
  if (e.target.dataset?.zfeld && ui.zuordnung) {
    const z = ui.zuordnung.z;
    z.konto = document.getElementById("zuordnung-konto")?.value.trim() || z.konto;
    z.spalten[e.target.dataset.zfeld] = +e.target.value;
    if (e.target.dataset.zfeld === "typ") typenAuffrischen(z, ui.zuordnung.kopf, ui.zuordnung.daten);
    return zeichnen();
  }
  if (e.target.dataset?.ztyp != null && ui.zuordnung) { ui.zuordnung.z.typen[e.target.dataset.ztyp] = e.target.value; return; }
  if (e.target.id === "vorschau-ziel" && ui.vorschau) {
    ui.vorschau.ziel = e.target.value; ui.vorschau.zielGewaehlt = true; vorschauPruefen(ui.vorschau); return zeichnen();
  }
  if (e.target.id === "vorschau-konto" && ui.vorschau) {
    // z. B. zweites Kraken-Unterkonto: anderer Kontoname -> eigenes Depot
    ui.vorschau.konto = e.target.value.trim();
    if (!ui.vorschau.zielGewaehlt) ui.vorschau.ziel = undefined;
    vorschauPruefen(ui.vorschau); return zeichnen();
  }
  if (e.target.id === "import-datei" && e.target.files.length) await dateienEinlesen(e.target.files);
});

/** Eine oder mehrere Dateien: nacheinander in die Vorschau. Kurslisten zuletzt,
 *  damit die Wertpapiere schon da sind. Fehler einer Datei halten den Rest nicht auf. */
async function dateienEinlesen(dateien) {
  const l = [];
  for (const d of dateien) {
    let roh = null;
    try { roh = new Uint8Array(await d.arrayBuffer()); } catch { /* unten als "nicht lesbar" */ }
    const nach = (x) => { if (roh && !x.fehler) x.original = { name: d.name, roh, vorhanden: d.vorhandenesOriginal || null }; l.push(x); };
    try {
      // Eigener ZIP-Export (verschluesselt) -> Wiederherstellen
      if (roh && roh[0] === 0x50 && roh[1] === 0x4b && roh[2] === 3 && roh[3] === 4) { l.push({ name: d.name, text: "", zip: bytesZuB64(roh) }); continue; }
      // Bild (Screenshot einer Order): Texterkennung offline auf dem Geraet
      if (/^image\//.test(d.type || "") || /\.(png|jpe?g|webp)$/i.test(d.name || "")) {
        meldung("Lese Screenshot … (beim ersten Mal ca. 10 Sekunden)");
        await new Promise((r) => setTimeout(r, 30));
        try { nach({ name: d.name, text: "", ocr: await bildText(d), zeit: d.lastModified }); }
        catch (e) { l.push({ name: d.name, text: "", fehler: e.message || "Bild nicht lesbar" }); }
        continue;
      }
      // PDF (Kontoauszug, Abrechnung): Text offline aus der Datei ziehen - nichts verlaesst das Geraet
      if (typeof d.slice === "function" && typeof d.arrayBuffer === "function" && (await d.slice(0, 1024).text()).includes("%PDF-")) {
        if (d.size > 40e6) throw new Error("PDF zu groß (über 40 MB)");
        try { nach({ name: d.name, text: "", pdf: await pdfLesen(roh || new Uint8Array(await d.arrayBuffer())) }); }
        catch (e) { l.push({ name: d.name, text: "", fehler: e.message || "PDF nicht lesbar" }); }
        continue;
      }
      nach({ name: d.name, text: roh ? new TextDecoder().decode(roh) : await d.text() });
    } catch (e) { l.push({ name: d.name, text: "", fehler: e.message || "nicht lesbar" }); }
  }
  l.sort((a, b) => a.name.localeCompare(b.name, "de", { numeric: true }));
  const kl = (x) => /^\s*datum[;,]kennung/i.test(x.text);
  l.sort((a, b) => kl(a) - kl(b));
  ui.importSchlange = { liste: l, nr: 0, von: l.length, fehler: [] };
  naechsteDatei();
}

function naechsteDatei() {
  const q = ui.importSchlange;
  const x = q && q.liste.shift();
  if (!x) {
    if (q) { ui.importSchlange = null; ui.importFehler = q.fehler; meldung(q.fehler.length ? `Fertig – nicht übernommen: ${q.fehler.join(" · ")}` : "Alle Dateien übernommen."); zeige("uebersicht"); }
    return;
  }
  q.nr++;
  try {
    if (x.fehler) throw new Error(x.fehler);
    if (x.zip) { ui.importSchlange = null; ui.wiederherstellen = { zip: x.zip, name: x.name }; return zeichnen(); }
    if (/"kdf"\s*:\s*"PBKDF2-SHA256"[\s\S]*"salz"/.test(x.text.slice(0, 200))) {
      ui.importSchlange = null;
      ui.wiederherstellen = { text: x.text, erstellt: (x.text.match(/"erstellt":"([^"]+)"/) || [])[1] }; return zeichnen();
    }
    const v = x.ocr != null ? (() => { const s = screenshotErkennen(x.ocr, x); vorschauPruefen(s); return s; })()
            : x.pdf ? erkennenPdf(x.pdf, x.name) : erkennen(x.text, x.name);
    if (v.kursliste) {
      const [n, fremd] = kurslisteUebernehmen(v.kursliste);
      sichernAlle();
      meldung(`Kursliste: ${n} Wertpapiere aktualisiert${fremd.length ? `, ${fremd.length} unbekannt (erst Depot importieren)` : ""}.`);
      return naechsteDatei();
    }
    if (v.sicherung) {
      const neu = alsGesamtstand(v.sicherung);
      const n = Object.values(neu.depots).reduce((s, d) => s + (d.buchungen || []).length, 0);
      if (!confirm(`Sicherung mit ${Object.keys(neu.depots).length} Depots und ${n} Buchungen laden? Alle Depots in der App werden ersetzt.`)) return naechsteDatei();
      S = neu; oeffnen(S.aktiv); sichern(); meldung("Sicherung geladen."); return naechsteDatei();
    }
    v.datei = x.name; v.original = x.original;
    if (v.zuordnen) { ui.seite = "daten"; ui.zuordnung = v.zuordnen; ui.zuordnung.original = x.original; zeichnen(); return scrollTo(0, 0); }
    ui.seite = "daten"; ui.vorschau = v; zeichnen(); scrollTo(0, 0);
  } catch (err) {
    q.fehler.push(`${x.name}: ${err.message || "nicht lesbar"}`);
    if (q.von === 1) { ui.importSchlange = null; return meldung(err.message || "Datei nicht lesbar."); }
    naechsteDatei();
  }
}

document.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  if (e.target.id === "termin-form") {
    const neu = ui.termin === "neu";
    const x = neu ? { id: neueId("t") } : S.eigeneTermine.find((y) => y.id === ui.termin);
    Object.assign(x, { datum: f.get("datum"), art: f.get("art"), titel: String(f.get("titel")).trim(), betrag: zahl(f.get("betrag")),
                       depot: f.get("depot"), notiz: String(f.get("notiz") || "").trim() });
    if (neu) (S.eigeneTermine ??= []).push(x);
    ui.termin = null; sichern(); meldung("Termin gespeichert."); return zeichnen();
  }
  if (e.target.id === "depot-bearbeiten-form") {
    const d = S.depots[e.target.dataset.id];
    d.name = String(f.get("name")).trim() || d.name; d.rolle = f.get("rolle");
    d.person = String(f.get("person") || "").trim().slice(0, 30);
    if (f.has("cash")) d.cash = zahl(f.get("cash"));
    ui.depotEdit = null; oeffnen(S.aktiv); sichern(); meldung("Gespeichert."); return zeichnen();
  }
  if (e.target.id === "depot-form") {
    const id = neueId("d");
    S.depots[id] = neuesDepot(String(f.get("name")).trim(), f.get("rolle"));
    if (f.get("person")) S.depots[id].person = String(f.get("person")).trim().slice(0, 30);
    oeffnen(id); sichern(); meldung(D.name + " angelegt – jetzt Daten importieren."); return zeige("daten");
  }
  if (e.target.id === "depot-aendern") {
    D.name = String(f.get("name")).trim() || D.name; D.rolle = f.get("rolle");
    if (f.has("cash")) D.cash = zahl(f.get("cash"));
    oeffnen(S.aktiv); sichern(); meldung("Gespeichert."); return zeichnen();
  }
  if (e.target.id === "instrument-form") {
    const i = D.instrumente[e.target.dataset.id] ??= {};
    for (const k of ["name", "ticker", "isin", "branche", "art", "status", "notiz"]) i[k] = String(f.get(k) || "").trim();
    if (f.has("wkn")) i.wkn = String(f.get("wkn") || "").trim().toUpperCase() || undefined;
    if (f.has("richtung")) i.richtung = f.get("richtung") || undefined;
    if (f.has("isin")) i.isin = i.isin.toUpperCase();
    const kurs = zahl(f.get("kurs"));
    if (kurs !== i.kurs) { i.kurs = kurs; i.kursDatum = kurs != null ? heute() : null; }
    i.ziel = zahl(f.get("ziel"));
    sichern(); meldung("Gespeichert."); return zeichnen();
  }
  if (e.target.id === "buchung-form") {
    const name = String(f.get("instrument")).trim();
    const kennung = String(f.get("kennung") || "").trim().toUpperCase().replace(/\s+/g, "");
    const vorhanden = Object.entries(D.instrumente).find(([id, i]) => (i.name || id).toLowerCase() === name.toLowerCase() || (kennung && (i.isin === kennung || i.wkn === kennung)));
    // Neuer Wert: mit ISIN wird sie die Kennung; WKN wird gemerkt - beides sorgt dafuer, dass "Kurse & Daten aktualisieren" ihn findet
    const id = vorhanden ? vorhanden[0] : instrumentId(istIsin(kennung) ? kennung : "", name, true,
      { art: String(f.get("wertart") || "Aktie"), status: "neu", ...(/^[A-Z0-9]{6}$/.test(kennung) ? { wkn: kennung } : {}),
        ...(richtungAusName(name) ? { richtung: richtungAusName(name) } : {}) });
    const b = ui.formular.nr != null ? D.buchungen.find((x) => x.nr === ui.formular.nr)
            : (D.buchungen.push({ nr: D.buchungen.reduce((m, x) => Math.max(m, x.nr || 0), 0) + 1, quelle: "von Hand" }), D.buchungen.at(-1));
    Object.assign(b, { typ: f.get("typ"), datum: f.get("datum"), instrument: id, konto: String(f.get("konto") || "").trim(),
      stueck: zahl(f.get("stueck")), kurs: zahl(f.get("kurs")), gebuehr: zahl(f.get("gebuehr")) || 0, steuer: zahl(f.get("steuer")) || 0,
      betrag: zahl(f.get("betrag")), einstand: zahl(f.get("einstand")), notiz: String(f.get("notiz") || "").trim() });
    const bild = f.get("beleg");
    if (bild && bild.size) { try { b.beleg = await bildLesen(bild); } catch { meldung("Bild nicht lesbar."); } }
    sichern(); ui.formular = null; meldung("Buchung gespeichert.");
    ui.detail = id; return zeichnen();
  }
});

document.getElementById("auge").addEventListener("click", () => {
  ui.verdeckt = !ui.verdeckt;
  try { localStorage.setItem("dk-verdeckt", ui.verdeckt ? "1" : "0"); } catch {}
  zeichnen();
});

laden();
zeichnen();
if (typeof geteiltVerarbeiten === "function") geteiltVerarbeiten();
