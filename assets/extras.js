// Depot-Kompass - Watchlist, Notiz-Datenbank, API-Schluessel, KI.
// Wird VOR app.js geladen; alle Funktionen hier laufen erst auf Abruf und
// nutzen dann S, D, ui und die Helfer aus app.js.
"use strict";

// ------------------------------------------------------------ Watchlist
// Liegt depotuebergreifend in S.watchlist: beobachten, ohne zu besitzen.
const WATCH_ARTEN = ["Aktie", "ETF", "Zertifikat", "Knock-out", "Mini-Future", "Optionsschein", "Perp", "Anleihe", "Krypto", "Rohstoff", "Index", "Sonstiges"];

function watchlistSeite() {
  const nAlarme = alarme().length;
  const reiter = `<div class="reiter" style="margin:8px 0 0">
      <button data-watch-reiter="werte" class="${ui.watchReiter !== "alarme" ? "aktiv" : ""}">Werte</button>
      <button data-watch-reiter="alarme" class="${ui.watchReiter === "alarme" ? "aktiv" : ""}">🔔 Alarme${nAlarme ? ` (${nAlarme})` : ""}</button></div>`;
  if (ui.watchReiter === "alarme") return `${posReiter()}${reiter}${alarmSeite()}`;
  const liste = [...(S.watchlist || [])].sort((a, b) => (a.name || "").localeCompare(b.name || "", "de"));
  const signale = liste.filter((w) => watchSignal(w)).length;
  return `${posReiter()}${reiter}
    <h2>Watchlist <span>${liste.length}${signale ? ` · <span class="warn-t">${signale} mit Alarm</span>` : ""}</span></h2>
    <section class="karte liste">${liste.map(watchZeile).join("") ||
      `<p class="klein" style="margin:8px">Noch leer. Unten rechts auf + tippen und Aktien, ETFs, Zertifikate (WKN/ISIN) oder Krypto eintragen.</p>`}</section>
    <p class="klein">Zertifikate ohne Kurs: Kurs von Hand eintragen.</p>
    ${watchImportKarte()}
    <button class="fab" data-watch="neu" aria-label="Zur Watchlist hinzufügen">+</button>`;
}

function watchSignal(w) {
  if (w.kurs == null) return "";
  const l = alarmeErreicht("w:" + w.id);
  return l.length ? "🔔 " + l.map((a) => a.name).join(", ") : "";
}

function watchZeile(w) {
  const seit = w.kurs != null && w.kursStart ? (w.kurs / w.kursStart - 1) * 100 : null;
  const sig = watchSignal(w);
  return `
    <button class="zeile" data-watch="${esc(w.id)}">
      <span class="mono">${w.art === "Krypto" ? "₿" : esc(kuerzel(w.name))}</span>
      <span style="min-width:0">
        <span class="titel">${esc(w.name)}${sig ? `<span class="marke-status st-pruefen" data-kein-tr>${esc(sig)}</span>` : ""}</span>
        <span class="unter">${esc(w.art)} · ${esc(w.kennung || w.ticker || "")}${w.ticker && w.ticker !== w.kennung ? " → " + esc(w.ticker) : ""}${
          !w.ticker && !w.kursHand ? ' · <span class="warn-t">Ticker wählen</span>' : ""}</span>
      </span>
      <span class="rechts">${minichart(w)}<b>${w.kurs != null ? kursE(w.kurs) : "kein Kurs"}</b>
        <span class="${vz(seit)}-t">${seit != null ? pct(seit) + " seit Aufnahme" : ""}</span></span>
    </button>`;
}

function watchFormular() {
  const neu = ui.watch === "neu";
  const w = neu ? (ui.watchEntwurf || { art: "Aktie" }) : (S.watchlist || []).find((x) => x.id === ui.watch) || {};
  const z = (x) => x != null ? String(x).replace(".", ",") : "";
  return `
    <h2><button class="knopf klein" data-los="zurueck">‹ Zurück</button><span>${neu ? "Zur Watchlist" : esc(w.name)}</span></h2>
    ${!neu ? `<section class="karte">${minichart(w, 300, 90, true)}</section>` : ""}
    ${!neu && w.termine ? quartalsTabelle(w) : ""}
    <form class="karte formular" id="watch-form" style="margin-top:10px">
      <label>Name<input name="name" value="${esc(w.name || "")}" placeholder="z. B. Siemens, Bitcoin, Turbo auf DAX" required></label>
      <div class="zwei">
        <label>WKN, ISIN oder Ticker<input name="kennung" value="${esc(w.kennung || "")}" placeholder="z. B. 723610, DE0007236101, SIE.DE, BTC" autocapitalize="characters"></label>
        <label>Art<select name="art">${WATCH_ARTEN.map((a) => `<option ${w.art === a ? "selected" : ""}>${a}</option>`).join("")}</select></label>
      </div>
      <p class="klein" style="margin:0">🔔 Alarme (Marken, Zonen, Bewegung in %) für diesen Wert stellst du unten unter „Alarme“ oder in der Watchlist im Reiter „🔔 Alarme“ ein.</p>
      <div class="zwei">
        <label>Kurs € (leer = automatisch)<input name="kurs" inputmode="decimal" value="${w.kursHand ? z(w.kurs) : ""}" placeholder="${w.kurs != null && !w.kursHand ? fZahl.format(w.kurs) : ""}"></label>
        <label>Ticker<input name="ticker" id="watch-ticker" value="${esc(w.ticker || "")}" placeholder="über „Ticker suchen“ wählen"></label>
      </div>
      <button class="knopf" type="button" data-los="ticker-suchen">🔎 Ticker suchen (Name, ISIN oder WKN)</button>
      ${ui.treffer ? (ui.treffer.length ? `<div class="liste" style="padding:0">${ui.treffer.map((q) => `
        <button class="zeile" type="button" data-ticker-wahl="${esc(q.symbol)}" style="grid-template-columns:minmax(0,1fr) auto">
          <span style="min-width:0"><span class="titel">${esc(q.name)}</span><span class="unter">${esc(q.symbol)} · ${esc(q.boerse)}${q.art ? " · " + esc(q.art) : ""}</span></span>
          <span class="rechts">wählen</span></button>`).join("")}</div>`
        : `<p class="klein warn-t" style="margin:0">Nichts gefunden. Eine WKN kennt Yahoo meist nicht – lieber den Namen oder die ISIN eingeben.</p>`) : ""}
      <label>Warum beobachte ich das?<textarea name="notiz">${esc(w.notiz || "")}</textarea></label>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        ${!neu ? `<button class="knopf" type="button" data-derivate-zu="w:${esc(w.id)}">🎯 Hebelprodukte</button>`  : ""}
        ${!neu ? `<button class="knopf" type="button" data-notiz-neu="w:${esc(w.id)}">+ Notiz</button>
        <button class="knopf gefahr" type="button" data-watch-loeschen="${esc(w.id)}">Entfernen</button>` : ""}</div>
    </form>
    ${!neu ? alarmeZu("w:" + w.id) + notizenZu("w:" + w.id) : ""}`;
}

const ONVISTA_ART = { STOCK: "Aktie", FUND: "ETF / Fonds", DERIVATIVE: "ETC / Zertifikat", BOND: "Anleihe", INDEX: "Index", CURRENCY: "Devise", PRECIOUS_METAL: "Edelmetall" };
/** WKN/ISIN/Ticker in einen Yahoo-Ticker uebersetzen (beim Aktualisieren). */
async function watchTicker(w) {
  const k = String(w.kennung || "").trim().toUpperCase();
  if (!k) return null;                                   // ohne Kennung: Ticker im Formular waehlen
  if (w.art === "Krypto") return /-/.test(k) ? k : await kryptoTicker(krakenName(k).code);
  // ISIN und WKN (0.55): ueber Onvista zum deutschen Kuerzel (Xetra/Frankfurt in Euro), sonst Yahoo per ISIN.
  // NICHT ueber den Namen raten - "Siemens" ergab im Test Siemens Energy (ENR.DE) statt Siemens AG.
  if (istIsin(k) || istWkn(k)) return (await tickerFuerKennung(k))?.ticker || null;
  return k;                                                                                         // schon ein Ticker
}
async function sucheErster(begriff) {
  if (!begriff) return null;
  const j = await kursHolen(begriff, "suche");
  const q = (j?.quotes || []).map((x) => x.symbol).filter(Boolean);
  for (const b of EURO_BOERSEN) { const t = q.find((s) => s.endsWith(b)); if (t) return t; }
  return q[0] || null;
}

/** Treffer zur Auswahl: Name, Boerse, Art - der Mensch entscheidet, nicht die App. */
async function tickerTreffer() {
  if (!APP) return meldung("Suche gibt es nur in der App.");
  const f = document.getElementById("watch-form");
  const begriff = (f.kennung.value || f.name.value || "").trim();
  if (!begriff) return meldung("Erst Name, ISIN oder WKN eintragen.");
  meldung("Suche …");
  // 0.55: erst Onvista (findet ISIN, WKN und deutsche Namen; liefert das Xetra-Kuerzel), dann Yahoo.
  // Eine WKN geht nie direkt an Yahoo (Fehltreffer an der Taiwan-Boerse) - Yahoo bekommt dann den Namen von Onvista.
  const K = begriff.toUpperCase(), kennung = istIsin(K) || istWkn(K);
  const ov = (await onvistaTreffer(kennung ? K : begriff)).slice(0, 3), vorne = [];
  for (const e of ov.filter((e) => e.symbol && /^[A-Z0-9]{1,8}$/.test(e.symbol))) {
    for (const t of [e.symbol + ".DE", e.symbol + ".F"]) if (await kursInEuro(t)) {
      vorne.push({ symbol: t, name: e.name || t, boerse: t.endsWith(".DE") ? "Xetra · Euro" : "Frankfurt · Euro", art: ONVISTA_ART[e.entityType] || "" }); break; }
  }
  const frage = istWkn(K) ? (ov[0]?.name || "") : kennung ? K : begriff;
  const j = frage ? await kursHolen(frage, "suche") : { quotes: [] };
  if (!j && !vorne.length) return meldung("Keine Verbindung zu Yahoo.");
  // Eingaben behalten: erst ins Objekt schreiben, dann neu zeichnen
  const w = ui.watch === "neu" ? (ui.watchEntwurf ??= {}) : S.watchlist.find((x) => x.id === ui.watch);
  for (const k of ["name", "kennung", "art", "notiz"]) w[k] = f[k].value;
  const yahoo = (j?.quotes || []).filter((q) => q.symbol && !/\.TWO$/.test(q.symbol)).map((q) => ({
    symbol: q.symbol, name: q.longname || q.shortname || q.symbol, boerse: q.exchDisp || q.exchange || "", art: q.typeDisp || "" }));
  ui.treffer = [...vorne, ...yahoo].filter((x, n, l) => l.findIndex((y) => y.symbol === x.symbol) === n).slice(0, 8);
  zeichnen();
}

// ------------------------------------------------------------ Notizen
// Kleine lokale Datenbank: S.notizen, gehoert zur Sicherung.
function notizenSeite() {
  // 0.69 (Vorgabe 21.11.): Rechner als Reiter oben, darunter immer die gespeicherten Notizen
  const offen = ["posgr", "nachkauf", "gewinn"].filter((k) => ui[k + "Offen"]);
  const R = ["posgr", "nachkauf", "gewinn", "derivate"].includes(ui.notizReiter) ? ui.notizReiter
    : ui.notizReiter == null && offen.length === 1 && !ui.rechnerOffen ? offen[0] : "notizen";      // Sprung aus einer Position: passender Reiter
  const knopf = (k, t) => `<button data-notiz-reiter="${k}" class="${R === k ? "aktiv" : ""}">${t}</button>`;
  const reiter = `<div class="reiter">${knopf("notizen", "📝 Notizen")}${knopf("posgr", "⚖️ Positionsgröße")}${knopf("nachkauf", "📉 Tranchen")}${knopf("gewinn", "💰 Gewinnmitnahme")}${knopf("derivate", "🎯 Derivate")}</div>`;
  let oben = "";
  // ohne gewaehlten Reiter (z. B. Sprung aus einer Position): offene Rechner wie bisher anzeigen
  if (R === "notizen") oben = (ui.posgrOffen ? posgrRechner() : "") + (ui.nachkaufOffen ? nachkaufRechner() : "") + (ui.gewinnOffen ? gewinnRechner() : "") + (ui.rechnerOffen ? derivateInfo() + hebelRechner() : "");
  if (R === "derivate") { ui.rechnerOffen = true; oben = derivateInfo() + hebelRechner(); }
  if (R === "posgr") { ui.posgrOffen = true; oben = posgrRechner(); }
  if (R === "nachkauf") { ui.nachkaufOffen = true; oben = nachkaufRechner(); }
  if (R === "gewinn") { ui.gewinnOffen = true; oben = gewinnRechner(); }
  const such = (ui.notizSuche || "").toLowerCase();
  const liste = [...(S.notizen || [])]
    .filter((n) => !such || (n.titel + " " + n.text + " " + (n.bezugName || "")).toLowerCase().includes(such))
    .sort((a, b) => b.datum.localeCompare(a.datum));
  return `
    <h2>Notizen &amp; Rechner <span>${(S.notizen || []).length}</span></h2>
    ${reiter}
    ${oben}
    <h2>Gespeicherte Notizen</h2>
    <section class="karte formular"><input id="notiz-suche" type="search" placeholder="Suchen …" value="${esc(ui.notizSuche || "")}">
      ${legende(["<b>+</b> unten rechts legt eine neue Notiz an.", "<b>🧮</b> vor dem Titel = Notiz mit gespeichertem Rechner-Plan (Chart und Zahlen) – antippen und „Im Rechner öffnen“.",
        "Notizen aus einer Position oder der Watchlist stehen auch dort.", "Die Rechner oben: ⚖️ Positionsgröße · 📉 In Tranchen kaufen · 💰 Gewinnmitnahme · 🎯 Derivate (Knock-out, Mini-Future, Perp). Jeder Plan lässt sich als Notiz speichern – und als Bild teilen.",
        "Kurs-Alarme stellst du in der Watchlist ein: Wert antippen → Kaufmarke und Verkaufsmarke."], "ℹ️ Legende")}</section>
    <section class="karte liste" style="margin-top:10px">${liste.map(notizZeile).join("") ||
      `<p class="klein" style="margin:8px">${such ? "Nichts gefunden." : "Noch keine Notizen. Mit + anlegen – oder in einer Position bzw. Watchlist-Zeile."}</p>`}</section>
    <button class="fab" data-notiz-neu="" aria-label="Neue Notiz">+</button>`;
}

function notizZeile(n) {
  return `
    <button class="zeile" data-notiz="${esc(n.id)}" style="grid-template-columns:1fr auto">
      <span style="min-width:0"><span class="titel">${n.rechner || n.plan ? "🧮 " : ""}${esc(n.titel || "(ohne Titel)")}</span>
        <span class="unter">${n.bezugName ? esc(n.bezugName) + " · " : ""}${esc((n.text || "").slice(0, 80))}</span></span>
      <span class="rechts klein">${datum(n.datum)}</span>
    </button>`;
}

function notizenZu(bezug) {
  const l = (S.notizen || []).filter((n) => n.bezug === bezug).sort((a, b) => b.datum.localeCompare(a.datum));
  if (!l.length) return "";
  return `<h2>Notizen</h2><section class="karte liste">${l.map(notizZeile).join("")}</section>`;
}

function notizFormular() {
  const n = ui.notiz.id ? (S.notizen || []).find((x) => x.id === ui.notiz.id) : { bezug: ui.notiz.bezug || "", titel: ui.notiz.titel || "", text: ui.notiz.text || "", rechner: ui.notiz.rechner, plan: ui.notiz.plan };
  const xr = n.rechner && hebelRechnen(n.rechner);
  return `
    <h2><button class="knopf klein" data-los="zurueck">‹ Zurück</button><span>${ui.notiz.id ? "Notiz" : "Neue Notiz"}</span></h2>
    <form class="karte formular" id="notiz-form">
      ${n.bezug ? `<p class="klein" style="margin:0">Zu: <b>${esc(bezugName(n.bezug))}</b></p>` : ""}
      <label>Titel<input name="titel" value="${esc(n.titel || "")}" placeholder="z. B. Einstieg geplant, Earnings abwarten"></label>
      ${xr ? `<div>${hebelChart(n.rechner)}${hebelZahlen(xr)}${n.rechner.bedingung ? `<p><b>Einstiegsbedingung:</b> ${esc(n.rechner.bedingung)}</p>` : ""}
        <button class="knopf" type="button" data-hebel-bild="${esc(n.id || "neu")}" style="width:100%">📷 Als Bild teilen (Chart, Zahlen, Notiz)</button>
        ${n.id ? `<button class="knopf" type="button" data-rechner-laden="${esc(n.id)}" style="width:100%">🧮 Im Rechner öffnen und ändern</button>` : ""}</div>` : ""}
      ${n.plan ? `<div>${planAnzeige(n.plan)}${n.id ? `<button class="knopf" type="button" data-plan-laden="${esc(n.id)}" style="width:100%">🧮 Im Rechner öffnen und ändern</button>` : ""}</div>` : ""}
      <label>Text<textarea name="text" style="min-height:180px">${esc(n.text || "")}</textarea></label>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        ${ui.notiz.id ? `<button class="knopf gefahr" type="button" data-notiz-loeschen="${esc(n.id)}">Löschen</button>` : ""}</div>
      ${n.datum ? `<p class="klein">Angelegt ${new Date(n.datum).toLocaleString(LOC_DATUM())}</p>` : ""}
    </form>`;
}

function bezugName(bezug) {
  if (!bezug) return "";
  if (bezug.startsWith("w:")) return ((S.watchlist || []).find((w) => "w:" + w.id === bezug) || {}).name || "Watchlist";
  if (bezug.startsWith("ki:")) return "KI-Zusammenfassung";
  return (D.instrumente[bezug] || {}).name || bezug;
}

// ------------------------------------------------------------ API-Schluessel
const DIENSTE = [
  { id: "openrouter", name: "OpenRouter (KI)", link: "https://openrouter.ai/keys", nutzt: "KI-Chat – Gratis-Modelle mit „:free“, andere über Guthaben" },
  { id: "anthropic", name: "Anthropic (Claude)", link: "https://console.anthropic.com/settings/keys", bezahlt: true, nutzt: "KI-Chat mit Claude – kostenpflichtig nach Verbrauch (kein Abo nötig, ein Claude-Abo lässt sich nicht verbinden)" },
  { id: "openai", name: "OpenAI (ChatGPT)", link: "https://platform.openai.com/api-keys", bezahlt: true, nutzt: "KI-Chat mit GPT-Modellen – kostenpflichtig nach Verbrauch" },
  { id: "google", name: "Google (Gemini)", link: "https://aistudio.google.com/apikey", nutzt: "KI-Chat mit Gemini – mit kostenlosem Kontingent" },
  { id: "finnhub", name: "Finnhub", link: "https://finnhub.io/register", nutzt: "noch nicht genutzt – kann schon hinterlegt werden (geplant: Nachrichten, Earnings)" },
  { id: "alphavantage", name: "Alpha Vantage", link: "https://www.alphavantage.co/support/#api-key", nutzt: "noch nicht genutzt – kann schon hinterlegt werden (geplant: Kurse, Fundamentaldaten)" },
  { id: "twelvedata", name: "Twelve Data", link: "https://twelvedata.com/register", nutzt: "noch nicht genutzt – kann schon hinterlegt werden (geplant: Kurse, Devisen)" },
  { id: "fmp", name: "Financial Modeling Prep", link: "https://site.financialmodelingprep.com/register", nutzt: "noch nicht genutzt – kann schon hinterlegt werden (geplant: Bilanzen, Kennzahlen)" },
];
// Schluessel-Ampel (0.52, Vorgabe 16.11.: zwei Schluessel vertauscht, keine Meldung). Zwei Stufen:
// 1. Format sofort beim Speichern (ohne Internet): erkennt Schluessel eines ANDEREN Dienstes am Anfang.
// 2. Online-Pruefung: ein kleiner Lese-Abruf beim Dienst (Java setzt den Schluessel ein, er erreicht nie die Oberflaeche).
//    Alpha Vantage nimmt jeden Schluessel an und laesst sich deshalb nicht online pruefen.
const SCHLUESSEL_ANFANG = { openrouter: /^sk-or-/, anthropic: /^sk-ant-/, google: /^AIza/, openai: /^sk-(?!or-|ant-)/ };
const SCHLUESSEL_FORM = { twelvedata: /^[a-f0-9]{32}$/i, alphavantage: /^[A-Z0-9]{12,20}$/, finnhub: /^[a-z0-9]{20,60}$/, fmp: /^[A-Za-z0-9]{20,40}$/ };
const dienstName = (id) => (DIENSTE.find((d) => d.id === id) || {}).name || id;

/** Format pruefen: { s: "falsch" | "unklar", t } - "unklar" = Format passt, aber noch nicht vom Dienst bestaetigt. */
function schluesselFormat(id, wert) {
  const w = String(wert || "").trim();
  const fremd = Object.keys(SCHLUESSEL_ANFANG).find((a) => a !== id && SCHLUESSEL_ANFANG[a].test(w));
  if (fremd) return { s: "falsch", t: `Das sieht nach einem Schlüssel für ${dienstName(fremd)} aus – bitte prüfen, ob er in der richtigen Zeile steht.` };
  if (SCHLUESSEL_ANFANG[id] && !SCHLUESSEL_ANFANG[id].test(w)) return { s: "falsch", t: `Ein Schlüssel für ${dienstName(id)} sieht anders aus – bitte prüfen, ob er vollständig und in der richtigen Zeile ist.` };
  if (/\s/.test(w) || w.length < 12) return { s: "falsch", t: "Der Schlüssel ist zu kurz oder enthält Leerzeichen." };
  if (SCHLUESSEL_FORM[id] && !SCHLUESSEL_FORM[id].test(w)) return { s: "unklar", t: "Ungewöhnliches Format – bitte online prüfen." };
  return { s: "unklar", t: "Format passt – noch nicht online geprüft." };
}

/** Antwort der Online-Pruefung bewerten. j = { status, text } oder { error } oder null. */
function schluesselBewerten(id, j) {
  if (!j) return { s: "unklar", t: "Keine Antwort vom Dienst – später noch einmal prüfen." };
  const text = String(j.text || j.error?.message || "");
  if (/ausgeschaltet/i.test(text)) return { s: "unklar", t: "Internet ist in der App ausgeschaltet – online nicht geprüft." };
  if (/kein schluessel/i.test(text)) return { s: "unklar", t: "Kein Schlüssel hinterlegt." };
  if (id === "alphavantage" || /nicht pruefbar/i.test(text)) return { s: "unklar", t: "Alpha Vantage lässt sich nicht online prüfen (der Dienst nimmt jeden Schlüssel an)." };
  if (j.error) return { s: "unklar", t: "Keine Verbindung zum Dienst – später noch einmal prüfen." };
  if (j.status === 401 || j.status === 403 || (j.status === 400 && /key not valid|invalid.*key/i.test(text))) return { s: "falsch", t: "Ungültig – der Dienst lehnt diesen Schlüssel ab." };
  if (j.status >= 200 && j.status < 300) return { s: "ok", t: "Gültig – vom Dienst bestätigt." };
  if (j.status === 402 || j.status === 429) return { s: "ok", t: "Schlüssel wird erkannt – aber Kontingent oder Guthaben ist aufgebraucht." };
  return { s: "unklar", t: `Der Dienst antwortet mit Fehler ${j.status} – später noch einmal prüfen.` };
}

const schluesselStatus = (id) => (EIN().schluesselStatus || {})[id] || null;
function schluesselStatusSetzen(id, st) {
  const e = S.einstellungen ||= {}; e.schluesselStatus ||= {};
  if (st) e.schluesselStatus[id] = { ...st, z: new Date().toISOString() }; else delete e.schluesselStatus[id];
  sichern();
}

/** Online pruefen und Ampel setzen. Ohne App-Bruecke oder ohne Internet bleibt das Format-Ergebnis stehen. */
async function schluesselPruefen(id) {
  if (!schluesselEnde(id)) return;
  if (!APP || !APP.schluesselPruefen) { if (!schluesselStatus(id)) schluesselStatusSetzen(id, { s: "unklar", t: "Online-Prüfung gibt es nur in der App." }); return zeichnen(); }
  (ui.schluesselLaeuft ||= {})[id] = true; zeichnen();
  const nr = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
  const j = await new Promise((ok) => { kursWarten[nr] = ok; APP.schluesselPruefen(id, nr); setTimeout(() => window.kursAntwort(nr, ""), 25000); });
  const neu = schluesselBewerten(id, j), alt = schluesselStatus(id);
  // ein klares Format-Rot bleibt stehen, wenn online nichts herauskam
  schluesselStatusSetzen(id, neu.s === "unklar" && alt?.s === "falsch" ? alt : neu);
  delete ui.schluesselLaeuft[id]; zeichnen();
}

function schluesselAmpel(id) {
  if (!schluesselEnde(id)) return "";
  if ((ui.schluesselLaeuft || {})[id]) return `<p class="ampel unklar"><span>⏳</span> wird geprüft …</p>`;
  const st = schluesselStatus(id) || { s: "unklar", t: "Noch nicht geprüft." };
  return `<p class="ampel ${st.s}"><span>${st.s === "ok" ? "🟢" : st.s === "falsch" ? "🔴" : "🟡"}</span> ${esc(st.t)}</p>`;
}

const schluesselEnde = (id) => APP ? APP.schluesselEnde(id) : (localStorage.getItem("test-schluessel-" + id) || "").slice(-4);

function schluesselSeite() {
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>API-Schlüssel</span></h2>
    <p class="klein">Eigene Schlüssel gehören zum Internet-Teil: Sie bleiben verschlüsselt auf dem Handy und gehen nur an den jeweiligen Dienst. Du kannst sie jederzeit hinterlegen.${EIN().ki ? "" : " Die KI ist gerade aus – KI-Schlüssel werden erst genutzt, wenn du sie unter Einstellungen → Zusatzmodule einschaltest."}</p>
    <section class="karte">
      <p style="margin-top:0"><b>Ohne Schlüssel aktiv</b></p>
      <p class="klein" style="margin:0">Diese Quellen brauchen keinen Schlüssel – sie laufen nur auf Knopfdruck und nur, wenn Internet erlaubt ist:</p>
      <ul class="klein">
        <li><b>Yahoo Finance</b> – Kurse, Kursverlauf, Termine, Earnings, Analysten</li>
        <li><b>Onvista</b> – Kurse für Zertifikate, Optionsscheine, Anleihen (Onvista vergibt keine eigenen Schlüssel)</li>
        <li><b>Google News</b> – Schlagzeilen (RSS)</li>
      </ul>
    </section>
    <h2>Eigene Schlüssel</h2>
    ${DIENSTE.map((d) => {
      const ende = schluesselEnde(d.id);
      return `
      <form class="karte formular" data-schluessel-form="${d.id}" style="margin-top:10px">
        <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
          <b>${esc(d.name)}</b><span class="status ${ende ? "aktiv" : ""}">${ende ? "gespeichert …" + esc(ende) : "fehlt"}</span></div>
        <p class="klein" style="margin:0">${esc(d.nutzt)}</p>
        ${schluesselAmpel(d.id)}
        <input name="wert" type="password" autocomplete="off" placeholder="${ende ? "neuen Schlüssel eingeben zum Ersetzen" : "Schlüssel einfügen"}">
        <div class="knoepfe" style="margin-top:0"><button class="knopf haupt" type="submit">Speichern</button>
          <a class="knopf" href="${d.link}" style="text-align:center;text-decoration:none;color:inherit">${d.bezahlt ? "Schlüssel holen ↗" : "Gratis-Schlüssel holen ↗"}</a>
          ${ende ? `<button class="knopf" type="button" data-schluessel-pruefen="${d.id}">Prüfen</button><button class="knopf gefahr" type="button" data-schluessel-weg="${d.id}">Entfernen</button>` : ""}</div>
      </form>`; }).join("")}`;
}

function schluesselSpeichern(id, wert) {
  const ok = APP ? APP.schluesselSetzen(id, wert) : (wert ? localStorage.setItem("test-schluessel-" + id, wert) : localStorage.removeItem("test-schluessel-" + id), true);
  if (ok) {
    const f = wert ? schluesselFormat(id, wert) : null;
    schluesselStatusSetzen(id, f);
    meldung(!wert ? "Schlüssel entfernt." : f.s === "falsch" ? "Gespeichert – aber der Schlüssel sieht falsch aus." : "Schlüssel gespeichert.");
    if (wert) { zeichnen(); return schluesselPruefen(id); }
  } else meldung("Speichern fehlgeschlagen.");
  zeichnen();
}

// ------------------------------------------------------------ KI
// 07.11.: anfangs nur Watchlist. 11.11. : Fragen zum EIGENEN Portfolio gewuenscht -
// gesendet werden aber nur Prozente (Anteil, seit Kauf, Art/Branche, Cash-Anteil) und offline
// gespeicherte Schlagzeilen. Nie Euro-Betraege, Stueckzahlen, Kontonamen oder Personen.
// Bezug ist immer die gerade gewaehlte Sicht (Haushalt / Person / Depot) - wie oben in der Sicht-Leiste.
const KI_RICHTUNGEN = {
  check: { gruppe: "Portfolio", name: "Check mein Portfolio", beispiel: "Klumpen, Streuung, starke Gewinner und Verlierer",
    auftrag: "Prüfe Gewichtung und Streuung meines Portfolios. Nenne Klumpen (einzelne Werte über 10 %, Branchen oder Anlagearten über 30 %). " +
    "Für Positionen deutlich im Plus oder Minus: zeige die Möglichkeiten (halten, Teilgewinn mitnehmen, nachkaufen, schließen und später neu einsteigen) jeweils mit Für und Wider – und woran ich selbst entscheiden kann." },
  earnings: { gruppe: "Einzelwert", name: "Earnings auswerten", beispiel: "z. B. „Die Nvidia-Earnings sind draußen – werte sie vollständig aus.“",
    auftrag: "Die neuesten Quartalszahlen sind draußen. Werte sie vollständig aus: Ergebnis je Aktie gegenüber der Erwartung (Überraschung), Entwicklung von Umsatz und Gewinn über die Quartale, " +
    "Trend und Bewertung (KGV), was das für meine Position bedeutet (Long/Short, Einstiegskurs), die wichtigsten Chancen und Risiken bis zum nächsten Termin und deine klare, begründete Gesamteinschätzung." },
  einzelwert: { gruppe: "Einzelwert", name: "Chancen & Risiken eines Werts", beispiel: "Stärken, Schwächen, Bewertung und drei Szenarien",
    auftrag: "Analysiere diesen Wert wie ein Research-Analyst: Geschäftsmodell und Stellung im Markt, Bewertung (KGV), Entwicklung der letzten Quartale, Chancen und Risiken, " +
    "drei Szenarien (positiv, neutral, negativ) und was das für meine Position bedeutet. Gib eine klare, begründete Einschätzung." },
  analysten: { gruppe: "Einzelwert", name: "Analysten & Kursziele", beispiel: "Was sagen die Analystenhäuser – Kursziele im Mittel und letzte Einstufungen",
    auftrag: "Fasse die Einschätzungen der Analysten zu diesem Wert zusammen: durchschnittliches Kursziel und Spanne im Vergleich zum letzten Kurs, Verteilung der Empfehlungen, " +
    "welche Häuser zuletzt hoch- oder herabgestuft haben und mit welchen Kurszielen, ob sich ein Trend erkennen lässt, und was das für meine Position bedeutet. Ordne kritisch ein, wie verlässlich solche Kursziele sind." },
  news: { gruppe: "Einzelwert", name: "Schlagzeilen einordnen", beispiel: "Was bedeuten die aktuellen Meldungen für meinen Wert?",
    auftrag: "Ordne die aktuellen Schlagzeilen zu diesem Wert ein: Was ist passiert, wie wichtig ist es für das Unternehmen, und was bedeutet es für meine Position? Trenne Fakten von Spekulation." },
  minus: { gruppe: "Portfolio", name: "Positionen im Minus: nachkaufen oder schließen?", beispiel: "Verbilligen, halten oder neu einsteigen – mit Für und Wider",
    auftrag: "Diese Positionen liegen deutlich im Minus. Ordne für jede ein: Was spricht für Nachkaufen (verbilligen), was für Schließen und einen späteren " +
    "Neueinstieg, was für Halten? Welche Fragen sollte ich vorher klären (Grund für den Kauf noch gültig? Anteil am Portfolio nach einem Nachkauf?)." },
  plus: { gruppe: "Portfolio", name: "Übergewicht & Gewinne mitnehmen?", beispiel: "Teilgewinne, laufen lassen, unter 10 % Anteil kommen",
    auftrag: "Diese Positionen sind stark im Plus oder haben einen hohen Anteil. Zeige für jede: Gewinne ganz/teilweise mitnehmen oder laufen lassen – " +
    "mit Für und Wider. Wie viel Prozentpunkte müsste ich abbauen, um unter 10 % Anteil zu kommen? Rechne nur mit den gegebenen Prozenten." },
  aufloesen: { gruppe: "Portfolio", name: "Wert auflösen – wie umgewichten?", beispiel: "Erlös so verteilen, dass die Gewichtung passt",
    auftrag: "Ich möchte die genannte Position komplett auflösen. Wie kann ich den Erlös auf die übrigen Werte oder Anlagearten verteilen, " +
    "damit meine Gewichtung nach Anlageart und Branche möglichst ähnlich bleibt? Rechne mit den Prozenten unten und nenne konkrete Prozentpunkte je Wert." },
  watchlist: { gruppe: "Watchlist", name: "Watchlist-Check", beispiel: "Was spricht für und gegen einen genaueren Blick?",
    auftrag: "Gehe diese Werte durch: was spricht allgemein dafür und dagegen, sie genauer anzusehen? Welche Fragen sollte ich selbst klären?" },
  frei: { gruppe: "Portfolio", name: "Eigene Frage zum Portfolio", beispiel: "Frei formulieren – die Positionen gehen mit", auftrag: "" },
};
/** Schnelle Fragen (Reiter Beispiele): fuellen "Eigene Frage" vor. */
const KI_SCHNELL = [
  "Bin ich zu stark in einer Branche oder Anlageart investiert?",
  "Wie hoch sollte mein Krypto-Anteil höchstens sein – was spricht dafür und dagegen?",
  "Wie könnte ich mein Portfolio gegen einen Kursrutsch absichern?",
  "Erkläre mir einfach: Was sagt das KGV aus und wann ist es hoch?",
];
/** Master-Prompt (ab 0.46, Vorgabe 15.11.2026): persoenlicher Analyst, der klar Stellung bezieht statt auszuweichen -
 *  Analyse und Einordnung, keine Vermoegensverwaltung; die Entscheidung bleibt beim Nutzer. */
const KI_SYSTEM = "Du bist mein persönlicher Aktien- und Krypto-Analyst – fachlich wie ein Research-Analyst einer Bank, aber verständlich für Privatanleger. " +
  "Deine Aufgabe ist Analyse und Einordnung: Werte die mitgeschickten Zahlen gründlich aus, rechne nach, vergleiche mit Erwartungen und Vorquartalen und erkläre, was sie bedeuten. " +
  "Weiche Fragen nicht aus und bleib nicht bei allgemeinen Warnhinweisen: Wenn ich nach einer Einschätzung frage, gib eine klare, begründete Einschätzung mit Szenarien " +
  "(positiv, neutral, negativ), Chancen und Risiken und sag, woran ich sie selbst überprüfen kann. Bleib bei Fakten: Nutze die mitgeschickten Daten und dein allgemeines Wissen, " +
  "nenne bei Wissen aus deinem Training den ungefähren Stand und erfinde keine Kurse, Zahlen oder Nachrichten. Ich schicke nur Prozentwerte und Einstiegskurse, keine Depotbeträge. " +
  "Antworte auf Deutsch, klar gegliedert mit Überschriften und Spiegelstrichen, so ausführlich wie nötig. Bei Rückfragen beziehst du dich auf das bisherige Gespräch. " +
  "Die Entscheidung treffe ich selbst; schließe mit dem Satz: „Keine Anlageberatung – die Entscheidung liegt bei dir.“";

/** Prozentzahl mit deutschem Komma fuer den KI-Text (z. B. "15,5"). */
const kz = (x) => x == null ? "–" : String(rund(x, 1)).replace(".", ",");
const kzVz = (x) => x == null ? "–" : (x > 0 ? "+" : "") + kz(x);

/** Positionen der aktuellen Sicht (wie Uebersicht/Positionen) inkl. Cash-Anteil. */
function kiSicht() {
  if (gesamtAnsicht()) { const g = gesamtDaten(); return { liste: g.liste, summe: g.summe, cash: g.cash, name: ui.person ? "Alle Depots von " + ui.person : "Alle Depots" }; }
  const { liste, summe } = positionen(), c = cash();
  return { liste, summe, cash: c ? c.betrag : 0, name: "ein Depot" };
}

/** Was an die KI geht (Vorgabe 11.11.): Name, Art, Einstiegskurs je Stueck und Richtung (Long/Short) - sonst nichts.
 *  Anteile und "% seit Einstieg" nur, wenn der Schalter "Anteile mitsenden" an ist. Nie Betraege, Stueckzahlen, Konten, Personen. */
const kurz = (x) => x == null || !isFinite(x) ? "–" : fZahl.format(rund(x, x >= 100 ? 2 : x >= 1 ? 4 : 8));
function kiDaten(richtung, extra = {}) {
  const z = [];
  if (richtung === "watchlist") {
    z.push("Watchlist (mit gesetzten Alarmen; Abstand = wie weit der Kurs noch laufen muss):");
    for (const w of S.watchlist || []) {
      const al = alarme().filter((a) => a.bezug === "w:" + w.id && a.an !== false).map((a) => {
        const st = alarmStand(a, w.kurs);
        return `${a.name} ${a.art === "unter" ? "unter " + kurz(a.wert) : a.art === "ueber" ? "über " + kurz(a.wert) : a.art === "zone" ? "Zone " + kurz(a.von) + "–" + kurz(a.bis) : kz(a.prozent) + " %"}`
          + (st.erreicht ? " (erreicht)" : st.abstand != null ? ` (noch ${kz(st.abstand)} %)` : "");
      });
      z.push(`- ${w.name} (${w.art})${al.length ? ": " + al.join("; ") : ""}`);
    }
    return z.join("\n");
  }
  const s = kiSicht(), mitP = !!EIN().kiProzente, gesamt = s.summe + Math.max(0, s.cash || 0);
  if (!s.liste.length) return "Keine Positionen.";
  const anteil = (w) => gesamt ? w / gesamt * 100 : 0;
  const ek = (p) => p.stueck > 0 ? p.einstand / p.stueck : null;
  const ri = (p) => p.inst.richtung === "short" ? "Short" : "Long";
  const zeile = (p) => `- ${p.name} (${p.inst.art || "Aktie"}${p.inst.branche ? ", " + p.inst.branche : ""}): ${ri(p)}, Einstiegskurs ${kurz(ek(p))}` +
    (mitP ? `, Anteil ${kz(anteil(p.wert))} %, seit Einstieg ${kzVz(p.gvPct)} %` + (p.ziel != null ? `, Ziel-Anteil ${kz(p.ziel)} %` : "") : "");
  let auswahl = [...s.liste].sort((a, b) => b.wert - a.wert);
  if (richtung === "minus") auswahl = auswahl.filter((p) => p.gvPct != null && p.gvPct <= -10);
  if (richtung === "plus") auswahl = auswahl.filter((p) => (p.gvPct != null && p.gvPct >= 20) || anteil(p.wert) >= 10);
  if ((richtung === "minus" || richtung === "plus") && !auswahl.length) return richtung === "minus" ? "Keine Position liegt 10 % oder mehr im Minus." : "Keine Position ist 20 % im Plus oder hat 10 % Anteil.";
  z.push(`Portfolio (${s.name}), ${s.liste.length} Positionen. Einstiegskurse in Euro je Stück.` + (mitP ? ` Cash-Anteil ${kz(anteil(Math.max(0, s.cash || 0)))} %.` : ""));
  if (richtung === "aufloesen") {
    const weg = s.liste.find((p) => p.id === extra.wert) || [...s.liste].sort((a, b) => b.wert - a.wert)[0];
    z.push(`Auflösen: ${weg.name} (${weg.inst.art || "Aktie"}), ${ri(weg)}, Einstiegskurs ${kurz(ek(weg))}` + (mitP ? `, Anteil ${kz(anteil(weg.wert))} %, seit Einstieg ${kzVz(weg.gvPct)} %.` : "."));
    if (mitP) {
      z.push("", "Anteile jetzt → ohne diese Position (Erlös noch nicht verteilt, als Cash gerechnet):");
      for (const p of auswahl.filter((p) => p !== weg).slice(0, 40)) z.push(`- ${p.name} (${p.inst.art || "Aktie"}${p.inst.branche ? ", " + p.inst.branche : ""}): ${kz(anteil(p.wert))} % → ${kz(p.wert / gesamt * 100)} %`);
      const nachArt = (ohne) => { const m = {}; for (const p of s.liste) if (!ohne || p !== weg) m[p.inst.art || "Aktie"] = (m[p.inst.art || "Aktie"] || 0) + p.wert; return m; };
      const vor = nachArt(false), nach = nachArt(true);
      z.push("", "Anlagearten vorher → ohne die Position, bezogen auf das Gesamtvermögen:");
      for (const k of Object.keys(vor)) z.push(`- ${k}: ${kz(anteil(vor[k]))} % → ${kz(anteil(nach[k] || 0))} %`);
      z.push(`- Cash: ${kz(anteil(Math.max(0, s.cash || 0)))} % → ${kz(anteil(Math.max(0, s.cash || 0) + weg.wert))} %`);
    } else {
      z.push("", "Übrige Positionen:");
      for (const p of auswahl.filter((p) => p !== weg).slice(0, 40)) z.push(zeile(p));
    }
  } else {
    z.push("");
    for (const p of auswahl.slice(0, 40)) z.push(zeile(p));
    if (auswahl.length > 40) z.push(`- … und ${auswahl.length - 40} kleinere Positionen`);
  }
  if (mitP && (richtung === "check" || richtung === "frei")) {
    const gruppe = (feld, titel) => { const m = {}; for (const p of s.liste) { const k = p.inst[feld] || (feld === "art" ? "Aktie" : "ohne Branche"); m[k] = (m[k] || 0) + p.wert; }
      z.push("", titel + ":"); for (const [k, w] of Object.entries(m).sort((a, b) => b[1] - a[1])) z.push(`- ${k}: ${kz(anteil(w))} %`); };
    gruppe("art", "Nach Anlageart"); gruppe("branche", "Nach Branche");
  }
  // Long/Short-Ideen aus dem Hebel-Rechner (Notizen): Name, Richtung, Einstieg
  if (richtung === "check" || richtung === "frei") {
    const ideen = (S.notizen || []).filter((x) => x.rechner).map((x) => ({ titel: x.rechner.titel || x.titel, r: typeof hebelRechnen === "function" ? hebelRechnen(x.rechner) : null })).filter((x) => x.r);
    if (ideen.length) { z.push("", "Hebel-Ideen (aus meinen Notizen):"); for (const x of ideen.slice(0, 15)) z.push(`- ${x.titel}: ${x.r.long ? "Long" : "Short"}, Einstieg ${kurz(x.r.E)}`); }
  }
  // "Recherche": offline gespeicherte Schlagzeilen (News-Seite) zu den betroffenen Werten
  const namen = new Set((richtung === "aufloesen" ? s.liste.filter((p) => p.id === extra.wert) : auswahl.slice(0, 10)).map((p) => p.name));
  const news = (S.news?.eintraege || []).filter((n) => namen.has(n.bezug)).slice(0, 12);
  if (news.length) { z.push("", "Aktuelle Schlagzeilen (aus der News-Seite):"); for (const n of news) z.push(`- ${n.bezug}: ${n.titel} (${n.quelle}, ${datum(new Date(n.zeit).toISOString())})`); }
  return z.join("\n");
}

/** Einzelwert-Fragen (ab 0.46): Earnings, Chancen/Risiken, Schlagzeilen - immer zu einer gewaehlten Position. */
const KI_EINZEL = new Set(["earnings", "analysten", "einzelwert", "news"]);

/** Daten zu EINEM Wert: Position (wie oben, ohne Betraege), oeffentliche Kennzahlen und Quartalszahlen von Yahoo, Schlagzeilen. */
function kiEinzelDaten(id) {
  const s = kiSicht(), p = s.liste.find((x) => x.id === id) || [...s.liste].sort((a, b) => b.wert - a.wert)[0];
  if (!p) return "Keine Positionen.";
  const i = p.inst, t = i.termine || {}, mitP = !!EIN().kiProzente, gesamt = s.summe + Math.max(0, s.cash || 0);
  const w = i.waehrung || "EUR", z = [];
  const gross = (x) => x == null ? "–" : Math.abs(x) >= 1e9 ? kz(x / 1e9) + " Mrd." : Math.abs(x) >= 1e6 ? kz(x / 1e6) + " Mio." : kurz(x);
  z.push(`Wert: ${p.name} (${i.art || "Aktie"}${i.branche ? ", " + i.branche : ""}${i.isin ? ", ISIN " + i.isin : ""}${i.ticker ? ", Ticker " + i.ticker : ""})`);
  z.push(`Meine Position: ${i.richtung === "short" ? "Short" : "Long"}, Einstiegskurs ${kurz(p.stueck > 0 ? p.einstand / p.stueck : null)} EUR je Stück` +
    (mitP && gesamt ? `, Anteil am Portfolio ${kz(p.wert / gesamt * 100)} %, seit Einstieg ${kzVz(p.gvPct)} %` : ""));
  if (i.kurs != null) z.push(`Letzter Kurs: ${kurz(i.kurs)} ${w}` + (S.einstellungen?.letzterAbruf ? ` (Stand ${datum(S.einstellungen.letzterAbruf.slice(0, 10))})` : ""));
  if (t.kgv || t.kgvErwartet || t.divRendite) z.push(`KGV ${t.kgv ? kz(t.kgv) : "–"}, KGV erwartet ${t.kgvErwartet ? kz(t.kgvErwartet) : "–"}, Dividendenrendite ${t.divRendite != null ? kz(t.divRendite * 100) + " %" : "–"}`);
  const q = (t.quartale || []).filter((x) => x.eps != null);
  if (q.length) {
    z.push("", "Ergebnis je Aktie (EPS) der letzten Quartale – tatsächlich / erwartet / Überraschung:");
    for (const x of q) z.push(`- Quartal bis ${x.quartal}: ${kurz(x.eps)} / ${x.erwartet != null ? kurz(x.erwartet) : "–"} ${w} / ${x.ueberraschung != null ? kzVz(x.ueberraschung * 100) + " %" : "–"}`);
  }
  const f = t.finanzen || [];
  if (f.length) { z.push("", `Umsatz und Gewinn je Quartal (${w}):`); for (const x of f) z.push(`- ${x.quartal}: Umsatz ${gross(x.umsatz)}, Gewinn ${gross(x.gewinn)}`); }
  const gewesen = (t.earningsGewesen || []).slice(-2), kommt = (t.earnings || []).filter((d) => d >= heute());
  if (gewesen.length || kommt.length) z.push("", `Earnings-Termine: zuletzt ${gewesen.map(datum).join(", ") || "–"}; nächster ${kommt.map(datum)[0] || "–"}`);
  const an = t.analysten;
  if (an) {
    z.push("", `Analysten (${an.anzahl ?? "?"}): Kursziel Durchschnitt ${kurz(an.mittel)} ${w}, Median ${kurz(an.median)}, Spanne ${kurz(an.tief)} bis ${kurz(an.hoch)}` +
      (an.mittel != null && i.kurs ? `, Abstand zum letzten Kurs ${kzVz((an.mittel / i.kurs - 1) * 100)} %` : "") + (an.empfehlung ? `, Konsens ${an.empfehlung}` : ""));
    const v = an.verteilung;
    if (v) z.push(`Verteilung: stark kaufen ${v.starkKaufen}, kaufen ${v.kaufen}, halten ${v.halten}, verkaufen ${v.verkaufen}, stark verkaufen ${v.starkVerkaufen}`);
    if (an.historie?.length) { z.push("Letzte Einstufungen der Analystenhäuser:");
      for (const h of an.historie.slice(0, 10)) z.push(`- ${h.datum || "–"} ${h.haus}: ${h.von && h.von !== h.zu ? h.von + " → " : ""}${h.zu}` +
        (h.ziel != null ? `, Kursziel ${h.zielVorher != null && h.zielVorher !== h.ziel ? kurz(h.zielVorher) + " → " : ""}${kurz(h.ziel)} ${w}` : "")); }
  }
  if (!q.length && !f.length) z.push("", "Hinweis: Für diesen Wert sind keine Quartalszahlen geladen (vorher ⚙️ → Import → „Kurse & Daten aktualisieren“).");
  const news = (S.news?.eintraege || []).filter((n) => n.bezug === p.name).slice(0, 12);
  if (news.length) { z.push("", "Aktuelle Schlagzeilen (aus der News-Seite):"); for (const n of news) z.push(`- ${n.titel} (${n.quelle}, ${datum(new Date(n.zeit).toISOString())})`); }
  return z.join("\n");
}

function kiText() {
  const r = ui.kiRichtung || "check", x = KI_RICHTUNGEN[r] || KI_RICHTUNGEN.check, en = sprache() === "en";
  const auftrag = r === "frei" ? (ui.kiFrage || "").trim() : en ? KI_AUFTRAG_EN[r] || x.auftrag : x.auftrag;
  const daten = KI_EINZEL.has(r) ? kiEinzelDaten(ui.kiWert) : kiDaten(r, { wert: ui.kiWert });
  return auftrag + "\n\n" + (en ? kiEn(daten) : daten);
}

// Englisch (ab 0.46): Auftrag und Daten-Beschriftungen auf Englisch, damit Vorschau und Anfrage zur Sprache passen.
const KI_AUFTRAG_EN = {
  check: "Check the weighting and diversification of my portfolio. Name concentrations (single securities above 10 %, sectors or asset types above 30 %). " +
    "For positions clearly in profit or loss: show the options (hold, take partial profit, buy more, close and re-enter later), each with pros and cons – and how I can decide myself.",
  earnings: "The latest quarterly results are out. Analyse them fully: earnings per share versus the estimate (surprise), revenue and profit over the quarters, " +
    "trend and valuation (P/E), what this means for my position (long/short, entry price), the main opportunities and risks until the next report and your clear, reasoned overall assessment.",
  einzelwert: "Analyse this security like a research analyst: business model and market position, valuation (P/E), development over the last quarters, opportunities and risks, " +
    "three scenarios (positive, neutral, negative) and what this means for my position. Give a clear, reasoned assessment.",
  analysten: "Summarise the analysts' views on this security: average price target and range compared with the last price, distribution of recommendations, " +
    "which firms recently upgraded or downgraded and with which price targets, whether there is a trend, and what this means for my position. Assess critically how reliable such price targets are.",
  news: "Put the latest headlines about this security in context: what happened, how important is it for the company, and what does it mean for my position? Separate facts from speculation.",
  minus: "These positions are clearly in the red. For each: what speaks for buying more (averaging down), what for closing and re-entering later, what for holding? " +
    "Which questions should I clarify first (is the reason for buying still valid? weight in the portfolio after buying more?)",
  plus: "These positions are well in profit or have a high weight. For each: take profits fully/partly or let them run – with pros and cons. " +
    "How many percentage points would I have to reduce to get below 10 % weight? Only use the given percentages.",
  aufloesen: "I want to sell the position named completely. How can I spread the proceeds across the remaining securities or asset types so that my weighting by asset type and sector " +
    "stays as similar as possible? Use the percentages below and give concrete percentage points per security.",
  watchlist: "Go through these securities: what generally speaks for and against looking at them more closely? Which questions should I clarify myself?",
};
const KI_EN_WOERTER = [
  ["Watchlist (Abstand Kurs zu Kaufmarke / Verkaufsmarke):", "Watchlist (distance of price to buy mark / sell mark):"], [": zur Kaufmarke ", ": to buy mark "], [", zur Verkaufsmarke ", ", to sell mark "],
  ["Keine Positionen.", "No positions."], ["Keine Position liegt 10 % oder mehr im Minus.", "No position is 10 % or more in the red."],
  ["Keine Position ist 20 % im Plus oder hat 10 % Anteil.", "No position is 20 % in profit or has a 10 % weight."],
  [" Positionen. Einstiegskurse in Euro je Stück.", " positions. Entry prices in euro per share."], [" Cash-Anteil ", " Cash share "],
  ["Portfolio (Alle Depots von ", "Portfolio (all portfolios of "], ["Portfolio (Alle Depots)", "Portfolio (all portfolios)"], ["Portfolio (ein Depot)", "Portfolio (one portfolio)"],
  [", Einstiegskurs ", ", entry price "], [", Anteil am Portfolio ", ", weight in portfolio "], [", Anteil ", ", weight "], [", seit Einstieg ", ", since entry "], [", Ziel-Anteil ", ", target weight "],
  ["Auflösen: ", "Sell: "], ["Anteile jetzt → ohne diese Position (Erlös noch nicht verteilt, als Cash gerechnet):", "Weights now → without this position (proceeds not yet spread, counted as cash):"],
  ["Anlagearten vorher → ohne die Position, bezogen auf das Gesamtvermögen:", "Asset types before → without the position, relative to net worth:"], ["Übrige Positionen:", "Remaining positions:"],
  [" kleinere Positionen", " smaller positions"], ["- … und ", "- … and "], ["Nach Anlageart:", "By asset type:"], ["Nach Branche:", "By sector:"],
  ["Hebel-Ideen (aus meinen Notizen):", "Leverage ideas (from my notes):"], [", Einstieg ", ", entry "], ["Aktuelle Schlagzeilen (aus der News-Seite):", "Latest headlines (from the news page):"],
  ["Wert: ", "Security: "], ["Meine Position: ", "My position: "], [" EUR je Stück", " EUR per share"], ["Letzter Kurs: ", "Last price: "], [" (Stand ", " (as of "],
  ["KGV erwartet ", "forward P/E "], ["KGV ", "P/E "], ["Dividendenrendite ", "dividend yield "],
  ["Ergebnis je Aktie (EPS) der letzten Quartale – tatsächlich / erwartet / Überraschung:", "Earnings per share (EPS) of the last quarters – actual / estimate / surprise:"],
  ["- Quartal bis ", "- Quarter ending "], ["Umsatz und Gewinn je Quartal (", "Revenue and profit per quarter ("], [": Umsatz ", ": revenue "], [", Gewinn ", ", profit "],
  ["Earnings-Termine: zuletzt ", "Earnings dates: last "], ["; nächster ", "; next "],
  ["Analysten (", "Analysts ("], ["): Kursziel Durchschnitt ", "): average price target "], [", Median ", ", median "], [", Spanne ", ", range "], [" bis ", " to "],
  [", Abstand zum letzten Kurs ", ", distance to last price "], [", Konsens ", ", consensus "], ["Verteilung: stark kaufen ", "Distribution: strong buy "], [", kaufen ", ", buy "],
  [", halten ", ", hold "], [", verkaufen ", ", sell "], [", stark verkaufen ", ", strong sell "], ["Letzte Einstufungen der Analystenhäuser:", "Latest ratings by analyst firms:"], [", Kursziel ", ", price target "],
  ["Hinweis: Für diesen Wert sind keine Quartalszahlen geladen (vorher ⚙️ → Import → „Kurse & Daten aktualisieren“).", "Note: no quarterly figures loaded for this security (first ⚙️ → Import → “Update prices & data”)."],
  [" Mrd.", " bn"], [" Mio.", " m"], ["(Aktie", "(Stock"], ["(Krypto", "(Crypto"], ["(Zertifikat", "(Certificate"], ["(Optionsschein", "(Warrant"], ["(Anleihe", "(Bond"], ["(Fonds", "(Fund"],
  ["- Aktie:", "- Stock:"], ["- Krypto:", "- Crypto:"], ["- Zertifikat:", "- Certificate:"], ["- ohne Branche:", "- no sector:"],
];
function kiEn(text) { let t = text; for (const [a, b] of KI_EN_WOERTER) t = t.split(a).join(b); return t + "\n\n(Numbers use German format: decimal comma.)"; }

// ------------------------------------------------------------ KI-Anbieter (ab 0.46)
// Eigene Schluessel: OpenRouter (auch Gratis-Modelle), Anthropic (Claude), OpenAI (ChatGPT), Google (Gemini).
// Ein Claude-/ChatGPT-Abo laesst sich nicht anbinden - nur API-Schluessel (Abrechnung beim Anbieter).
const KI_ANBIETER = {
  openrouter: { name: "OpenRouter" },
  anthropic: { name: "Anthropic (Claude)" },
  openai: { name: "OpenAI (ChatGPT)" },
  google: { name: "Google (Gemini)" },
};
function kiEinst() {
  const e = (S.einstellungen ??= {});
  e.kiModelleJe ??= {}; e.kiModellJe ??= {};
  if (e.kiModelle && !e.kiModelleJe.openrouter) e.kiModelleJe.openrouter = e.kiModelle;      // Stand bis 0.45 uebernehmen
  if (e.kiModell && !e.kiModellJe.openrouter) e.kiModellJe.openrouter = e.kiModell;
  if (!KI_ANBIETER[e.kiAnbieter]) e.kiAnbieter = Object.keys(KI_ANBIETER).find((a) => schluesselEnde(a)) || "openrouter";
  return e;
}
const kiAnbieter = () => kiEinst().kiAnbieter;
const kiModelle = (a = kiAnbieter()) => kiEinst().kiModelleJe[a] || [];
const kiModell = (a = kiAnbieter()) => kiEinst().kiModellJe[a] || kiModelle(a)[0] || "";

function kiAufruf(anbieter, modell, koerper) {
  const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
  return new Promise((ok) => { kursWarten[id] = ok; APP.kiAnfrage(anbieter, modell, koerper, id); setTimeout(() => window.kursAntwort(id, ""), 190000); });
}

/** Klare Saetze statt Fehlercodes. j = Antwort aus Java ({status, roh} oder {error}). */
function kiFehler(j, anbieter = kiAnbieter()) {
  if (!j) return "Keine Antwort – bitte Internetverbindung prüfen und nochmal senden.";
  const roh = j.roh?.error?.message || j.error?.message || j.roh?.message || "";
  const code = j.status || j.error?.code || j.roh?.error?.code;
  if (/kein schluessel/i.test(roh)) return "Für diesen Anbieter ist noch kein Schlüssel eingetragen (⚙️ → API-Schlüssel).";
  if (/ausgeschaltet/i.test(roh)) return "Internet ist in der App ausgeschaltet (⚙️ → Datenschutz).";
  if (code === 401 || code === 403 || /user not found|authentication|invalid.*key|api key not valid/i.test(roh))
    return "Der Schlüssel fehlt oder ist ungültig. Bitte unter ⚙️ → API-Schlüssel neu eintragen.";
  if (code === 402 || /credit|balance|billing|quota/i.test(roh)) return "Beim Anbieter fehlt Guthaben oder das Kontingent ist aufgebraucht. Bitte dort prüfen oder ein Gratis-Modell wählen.";
  if (code === 429) return "Zu viele Anfragen oder Kontingent aufgebraucht. Bitte kurz warten oder ein anderes Modell wählen.";
  if (code === 404 || /no endpoints|not found|does not exist/i.test(roh)) return "Dieses Modell gibt es nicht (mehr). Bitte „Modelle laden“ und ein anderes wählen.";
  return "Die KI hat nicht geantwortet" + (roh ? ` (${roh})` : "") + ". Bitte später nochmal versuchen.";
}

/** Modell-Liste je Anbieter laden und nach Brauchbarkeit filtern (nur Text-Chat-Modelle). */
async function kiModelleLaden() {
  if (!APP) return meldung("Nur in der App.");
  if (netzGesperrt()) return;
  const a = kiAnbieter();
  meldung("Lade Modell-Liste …");
  const j = await kiAufruf(a, "", "");
  let ids = [];
  if (a === "google") ids = (j?.models || []).filter((m) => (m.supportedGenerationMethods || []).includes("generateContent")).map((m) => String(m.name).replace(/^models\//, "")).filter((m) => /gemini/.test(m));
  else ids = (j?.data || []).map((m) => m.id).filter(Boolean);
  if (a === "openai") ids = ids.filter((m) => /^(gpt|o\d|chatgpt)/.test(m) && !/audio|realtime|tts|transcribe|image|search|embedding|instruct/.test(m));
  if (!ids.length) return meldung(kiFehler(j, a));
  ids = [...new Set(ids)].sort((x, y) => (a === "openrouter" ? (y.endsWith(":free") - x.endsWith(":free")) : 0) || x.localeCompare(y));
  const e = kiEinst(); e.kiModelleJe[a] = ids;
  if (!ids.includes(e.kiModellJe[a])) e.kiModellJe[a] = ids[0];
  sichern(); zeichnen();
  meldung(`${ids.length} Modelle gefunden.`);
}

/** Systemvorgabe (Master-Prompt). Analysieren, einordnen, klar Stellung beziehen - die Entscheidung bleibt beim Nutzer. */
function kiSystem() {
  return sprache() === "en" ? KI_SYSTEM_EN : KI_SYSTEM;
}
const KI_SYSTEM_EN = "You are my personal stock and crypto analyst – as knowledgeable as a bank research analyst, but easy to understand for private investors. " +
  "Your job is analysis and interpretation: evaluate the data sent thoroughly, recalculate, compare with estimates and previous quarters and explain what it means. " +
  "Do not dodge questions and do not stop at generic warnings: when I ask for an assessment, give a clear, reasoned assessment with scenarios (positive, neutral, negative), " +
  "opportunities and risks, and say how I can check it myself. Stick to facts: use the data sent and your general knowledge, state the approximate date of knowledge from your training " +
  "and never invent prices, figures or news. I only send percentages and entry prices, no portfolio amounts. Answer in English, clearly structured with headings and bullet points, " +
  "as detailed as needed. For follow-up questions refer to the conversation so far. The decision is mine; end with the sentence: “Not investment advice – the decision is yours.”";

/** Anfrage-Koerper je Anbieter aus dem Gespraech bauen. */
function kiKoerper(anbieter, modell, nachrichten) {
  const msgs = nachrichten.map((n) => ({ role: n.rolle === "ki" ? "assistant" : "user", content: n.text }));
  if (anbieter === "anthropic") return { model: modell, max_tokens: 4096, system: kiSystem(), messages: msgs };
  if (anbieter === "google") return { systemInstruction: { parts: [{ text: kiSystem() }] },
    contents: msgs.map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })) };
  return { model: modell, messages: [{ role: "system", content: kiSystem() }, ...msgs] };
}
function kiAntwortText(anbieter, j) {
  if (!j || j.status || j.error) return null;
  if (anbieter === "anthropic") return (j.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n").trim() || null;
  if (anbieter === "google") return (j.candidates?.[0]?.content?.parts || []).map((p) => p.text || "").join("").trim() || null;
  return j.choices?.[0]?.message?.content?.trim() || null;
}

/** Gespraeche liegen nur auf dem Handy (S.kiChats, verschluesselt wie alles andere), hoechstens 30. */
const kiChats = () => (S.kiChats ??= []);
const kiChat = () => kiChats().find((c) => c.id === ui.kiChatId) || null;

async function kiFrageSenden(chat) {
  if (!EIN().ki) return meldung("Die KI ist ausgeschaltet (⚙️ → Einstellungen → Zusatzmodule).");
  if (!APP) return meldung("Nur in der App.");
  if (netzGesperrt()) return;
  ui.kiWartet = true; zeichnen(); meldung("KI denkt nach …");
  const j = await kiAufruf(chat.anbieter, chat.modell, JSON.stringify(kiKoerper(chat.anbieter, chat.modell, chat.nachrichten)));
  const text = kiAntwortText(chat.anbieter, j);
  chat.nachrichten.push(text ? { rolle: "ki", text, zeit: new Date().toISOString() } : { rolle: "fehler", text: kiFehler(j, chat.anbieter), zeit: new Date().toISOString() });
  ui.kiWartet = false; sichern(); zeichnen();
}

/** Erste Frage: neues Gespraech mit den Daten (genau der Text aus der Vorschau). */
async function kiSenden() {
  const a = kiAnbieter(), m = kiModell(a), r = ui.kiRichtung || "check";
  if (!schluesselEnde(a)) return meldung("Bitte erst einen Schlüssel eintragen (⚙️ → API-Schlüssel).");
  if (!m) return meldung("Bitte erst „Modelle laden“ und ein Modell wählen.");
  if (r === "frei" && (ui.kiFrage || "").trim().length < 4) return meldung("Bitte erst eine Frage eintippen.");
  const x = KI_RICHTUNGEN[r] || KI_RICHTUNGEN.check;
  const wert = KI_EINZEL.has(r) || r === "aufloesen" ? (kiSicht().liste.find((p) => p.id === ui.kiWert)?.name || "") : "";
  const chat = { id: neueId("k"), titel: (r === "frei" ? (ui.kiFrage || "").trim().slice(0, 60) : tr(x.name)) + (wert ? " · " + wert : ""),
    anbieter: a, modell: m, erstellt: new Date().toISOString(), nachrichten: [{ rolle: "nutzer", text: kiText(), zeit: new Date().toISOString(), daten: true }] };
  kiChats().unshift(chat); S.kiChats = kiChats().slice(0, 30);
  ui.kiChatId = chat.id; ui.kiReiter = "chat";
  await kiFrageSenden(chat);
}

/** Rueckfrage im laufenden Gespraech (geht mit dem bisherigen Verlauf an denselben Anbieter). */
async function kiRueckfrage() {
  const chat = kiChat(), t = (document.getElementById("ki-rueck")?.value || ui.kiRueck || "").trim();
  if (!chat) return;
  if (t.length < 2) return meldung("Bitte erst eine Rückfrage eintippen.");
  chat.nachrichten = chat.nachrichten.filter((n) => n.rolle !== "fehler");
  chat.nachrichten.push({ rolle: "nutzer", text: t, zeit: new Date().toISOString() });
  ui.kiRueck = "";
  await kiFrageSenden(chat);
}

/** Antworten lesbar machen: nur **fett** und Ueberschriften (#), alles andere bleibt Text. */
function kiMd(text) {
  return esc(text).split("\n").map((z) => /^#{1,4}\s/.test(z) ? `<b>${z.replace(/^#{1,4}\s/, "")}</b>` : z.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")).join("\n");
}

function kiAnbieterKarte() {
  const a = kiAnbieter(), modelle = kiModelle(a), m = kiModell(a), ende = schluesselEnde(a);
  return `<section class="karte formular">
      <label>Anbieter<select id="ki-anbieter">${Object.entries(KI_ANBIETER).map(([k, x]) =>
        `<option value="${k}" ${k === a ? "selected" : ""}>${esc(x.name)}${schluesselEnde(k) ? " ✓" : ""}</option>`).join("")}</select></label>
      ${ende ? "" : `<button class="knopf haupt" data-ziel="schluessel" type="button">🔑 Schlüssel eintragen</button>`}
      <label>Modell<select id="ki-modell">${modelle.length ? modelle.map((x) => `<option ${x === m ? "selected" : ""}>${esc(x)}</option>`).join("")
        : `<option value="">– erst Liste laden –</option>`}</select></label>
      <button class="knopf" data-los="ki-modelle" type="button">Modelle laden</button>
      <p class="klein" style="margin:0">${a === "openrouter" ? "Modelle mit „:free“ sind kostenlos. Andere kosten Guthaben bei OpenRouter." : "Abrechnung nach Verbrauch über deinen eigenen Schlüssel beim Anbieter."}</p>
    </section>`;
}

function kiReiter() {
  const r = ui.kiReiter || "chat";
  return `<div class="reiter" style="margin:0 0 8px">
      <button data-ki-reiter="chat" class="${r === "chat" ? "aktiv" : ""}">💬 Chat</button>
      <button data-ki-reiter="beispiele" class="${r === "beispiele" ? "aktiv" : ""}">💡 Beispiele</button>
      <button data-ki-reiter="verlauf" class="${r === "verlauf" ? "aktiv" : ""}">🗂️ Verlauf</button></div>`;
}

function kiBeispieleSeite() {
  const gruppen = {};
  for (const [k, x] of Object.entries(KI_RICHTUNGEN)) (gruppen[x.gruppe] ??= []).push([k, x]);
  return Object.entries(gruppen).map(([g, liste]) => `<h2>${esc(g)}</h2><section class="karte liste">${liste.map(([k, x]) =>
    `<button class="zeile" data-ki-beispiel="${k}" style="grid-template-columns:minmax(0,1fr) auto">
       <span style="min-width:0"><span class="titel">${esc(x.name)}</span><span class="unter">${esc(x.beispiel)}</span></span><span class="rechts">›</span></button>`).join("")}</section>`).join("") +
    `<h2>Schnelle Fragen</h2><section class="karte liste">${KI_SCHNELL.map((f, n) =>
    `<button class="zeile" data-ki-schnell="${n}" style="grid-template-columns:minmax(0,1fr) auto"><span class="titel">${esc(f)}</span><span class="rechts">›</span></button>`).join("")}</section>`;
}

function kiVerlaufSeite() {
  const liste = kiChats();
  return `<section class="karte liste">${liste.map((c) => `
      <div class="zeile" style="grid-template-columns:minmax(0,1fr) auto auto;gap:6px">
        <button class="knopf klein" data-ki-chat="${esc(c.id)}" style="text-align:left;min-width:0" data-kein-tr><span class="titel">${esc(c.titel)}</span></button>
        <span class="klein" data-kein-tr>${esc(datum(c.erstellt.slice(0, 10)))}</span>
        <button class="knopf klein gefahr" data-ki-chat-weg="${esc(c.id)}" aria-label="Löschen">🗑️</button></div>`).join("")
      || `<p class="klein" style="margin:8px">Noch keine Gespräche.</p>`}</section>
    <p class="klein">Gespräche liegen nur auf diesem Handy (verschlüsselt, in der Sicherung enthalten). Es werden höchstens 30 aufgehoben.</p>`;
}

function kiChatSeite() {
  const chat = kiChat();
  if (chat) return `
    <section class="karte">
      <div style="display:flex;justify-content:space-between;gap:8px;align-items:center">
        <b data-kein-tr style="min-width:0;overflow-wrap:anywhere">${esc(chat.titel)}</b>
        <button class="knopf klein" data-los="ki-neu">＋ Neu</button></div>
      <p class="klein" style="margin:4px 0 0" data-kein-tr>${esc(KI_ANBIETER[chat.anbieter]?.name || chat.anbieter)} · ${esc(chat.modell)}</p></section>
    ${chat.nachrichten.map((n) => n.rolle === "nutzer" ? (n.daten
      ? `<section class="karte ki-du"><details><summary class="klein">Deine Frage mit den gesendeten Daten anzeigen</summary><pre style="white-space:pre-wrap;font:13px/1.45 system-ui;margin:6px 0 0">${esc(n.text)}</pre></details></section>`
      : `<section class="karte ki-du"><div style="white-space:pre-wrap" data-kein-tr>${esc(n.text)}</div></section>`)
      : n.rolle === "ki" ? `<section class="karte ki-antwort"><div style="white-space:pre-wrap" data-kein-tr>${kiMd(n.text)}</div></section>`
      : `<section class="karte" style="border-color:var(--warn)"><p style="margin:0">${esc(n.text)}</p></section>`).join("")}
    ${ui.kiWartet ? `<p class="klein">KI denkt nach …</p>` : ""}
    <section class="karte formular">
      <label>Rückfrage<textarea id="ki-rueck" rows="3" placeholder="z. B. Erkläre den letzten Punkt genauer.">${esc(ui.kiRueck || "")}</textarea></label>
      <div class="knoepfe"><button class="knopf haupt" data-los="ki-rueck" ${ui.kiWartet ? "disabled" : ""}>Senden</button>
        ${chat.nachrichten.some((n) => n.rolle === "ki") ? `<button class="knopf" data-los="ki-notiz">Als Notiz speichern</button>` : ""}</div>
      <p class="klein" style="margin:0">Rückfragen gehen mit dem bisherigen Gespräch an denselben Anbieter – keine weiteren Depotdaten.</p></section>`;
  const r = ui.kiRichtung || "check", s = kiSicht(), text = kiText(), a = kiAnbieter();
  const bereit = schluesselEnde(a) && kiModell(a) && (r !== "frei" || (ui.kiFrage || "").trim().length > 3);
  return `
    ${r !== "watchlist" ? sichtLeiste() : ""}
    <section class="karte formular">
      <label>Frage<select id="ki-richtung">${Object.entries(KI_RICHTUNGEN).map(([k, x]) => `<option value="${k}" ${r === k ? "selected" : ""}>${x.name}</option>`).join("")}</select></label>
      ${r === "aufloesen" || KI_EINZEL.has(r) ? `<label>Welcher Wert?<select id="ki-wert">${[...s.liste].sort((x, y) => y.wert - x.wert).map((p) =>
        `<option value="${esc(p.id)}" ${ui.kiWert === p.id ? "selected" : ""}>${esc(p.name)}</option>`).join("") || `<option value="">– keine Positionen –</option>`}</select></label>` : ""}
      ${r === "frei" ? `<label>Deine Frage<textarea id="ki-frage" rows="3" placeholder="z. B. Bin ich zu stark in Tech? Was wäre ein ausgewogener Anteil Krypto?">${esc(ui.kiFrage || "")}</textarea></label>` : ""}
    </section>
    <h2>Das wird gesendet <span class="klein" data-kein-tr>→ ${esc(KI_ANBIETER[a].name)}</span></h2>
    <section class="karte"><pre style="white-space:pre-wrap;font:13px/1.45 system-ui;margin:0">${esc(text)}</pre>
      <label style="display:flex;gap:10px;align-items:center;margin:8px 0"><input type="checkbox" id="ki-prozente" ${EIN().kiProzente ? "checked" : ""} style="width:22px;height:22px">
        <span class="klein">Anteile und „% seit Einstieg“ mitsenden (für Fragen zur Gewichtung nötig)</span></label>
      <p class="klein">Gesendet: Name, Art, Einstiegskurs je Stück, Long/Short${EIN().kiProzente ? ", Anteile in %" : ""}; bei Einzelwerten zusätzlich öffentliche Kennzahlen und Quartalszahlen. Nie Euro-Beträge des Depots, Stückzahlen, Konten oder Personen.</p>
      <button class="knopf haupt" data-los="ki-senden" style="width:100%" ${bereit && !ui.kiWartet ? "" : "disabled"}>Senden</button></section>`;
}

function kiSeite() {
  if (!EIN().ki) return `
    <h2>✨ KI-Fragen</h2>
    <section class="karte"><p style="margin-top:0">Stell Fragen zu deinem Portfolio und zu einzelnen Werten – im Chat mit Rückfragen. Beispiele: „Check mein Portfolio“, „Earnings auswerten“, „Positionen im Minus: nachkaufen oder schließen?“.</p>
      <p class="klein">Du nutzt deinen eigenen Schlüssel: OpenRouter (auch Gratis-Modelle), Anthropic (Claude), OpenAI (ChatGPT) oder Google (Gemini).</p>
      <p class="klein">Gesendet werden nur Name, Art, Einstiegskurs und Long/Short – keine Euro-Beträge, keine Stückzahlen, keine Konten. Du siehst vor dem Senden genau, was rausgeht. Die KI ist gerade aus, es wird nichts gesendet.</p>
      <button class="knopf haupt" data-los="ki-an" style="width:100%">KI einschalten</button>
      <button class="knopf" data-ziel="schluessel" style="width:100%;margin-top:8px">🔑 API-Schlüssel</button></section>`;
  const reiter = ui.kiReiter || "chat";
  return `
    <h2>✨ KI-Fragen</h2>
    ${kiReiter()}
    ${reiter === "beispiele" ? kiBeispieleSeite() : reiter === "verlauf" ? kiVerlaufSeite() : kiAnbieterKarte() + kiChatSeite()}
    <p class="klein">Antworten stammen von einer KI und sind keine Anlageberatung. Die KI kennt nur die mitgeschickten Daten und ihr allgemeines Wissen.</p>`;
}

// ------------------------------------------------------------ News
// Nachrichten zu den eigenen Werten: Yahoo (englisch) + Google News (deutsch).
// Nur auf Knopfdruck; die letzten Meldungen bleiben offline gespeichert (S.news).
// Gesucht wird ueber den NAMEN - Yahoo kennt deutsche Ticker wie RHM.DE fuer
// News nicht (Test 07.11.2026). ETFs/Fonds werden ausgelassen: dort kommt nur Rauschen.

function newsBegriff(name) {
  return String(name).replace(/\(.*?\)/g, " ").replace(/\b(AG|SE|Inc\.?|Ltd\.?|Corp\.?|plc|N\.V\.|S\.A\.|Co\.?|Holding|Group|Aktiengesellschaft)\b/gi, " ")
    .replace(/[,.]+/g, " ").replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
}

function newsZiele() {
  const ziele = new Map();
  const { liste } = positionen();
  for (const p of [...liste].sort((a, b) => b.wert - a.wert))
    if (["Aktie", "Krypto"].includes(p.inst.art || "Aktie")) ziele.set(newsBegriff(p.name), { name: p.name, ticker: p.inst.ticker || "" });
  for (const w of S.watchlist || [])
    if (["Aktie", "Krypto"].includes(w.art)) ziele.set(newsBegriff(w.name), { name: w.name, ticker: w.ticker || "" });
  return [...ziele.entries()].slice(0, 20);
}

/** Passt die Meldung wirklich zum Wert? Nur wenn Name oder Ticker in der
 *  Ueberschrift steht - Yahoo markiert Apple sonst auch bei "Booking vs.
 *  DoorDash" (Test 07.11.2026). */
function newsPasst(titel, begriff, ticker) {
  const wort = begriff.split(" ").find((w) => w.length >= 4) || begriff;
  const basis = (ticker || "").split(/[.-]/)[0];
  const ganz = (w) => new RegExp("(^|[^\\p{L}])" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "([^\\p{L}]|$)", "iu").test(titel);
  return ganz(wort) || (basis.length >= 2 && new RegExp("\\b" + basis + "\\b").test(titel));
}

/** RSS- oder Atom-Text -> [{titel, link, zeit}] */
function rssEintraege(text) {
  if (typeof text !== "string" || !/<(rss|feed|rdf)/i.test(text)) return [];
  const xml = new DOMParser().parseFromString(text, "text/xml");
  return [...xml.querySelectorAll("item, entry")].slice(0, 40).map((it) => {
    const l = it.querySelector("link");
    return { titel: (it.querySelector("title")?.textContent || "").trim(),
             link: (l?.getAttribute("href") || l?.textContent || "").trim(),
             zeit: Date.parse(it.querySelector("pubDate, published, updated, date")?.textContent || "") || 0 };
  }).filter((x) => x.titel);
}

/** Eigene Quelle auswerten: alles, oder nur Meldungen zu den eigenen Werten. */
function eigeneQuelleAuswerten(q, text, ziele) {
  const aus = [];
  for (const x of rssEintraege(text)) {
    if (q.alle) { aus.push({ ...x, quelle: q.name, bezug: q.name, sprache: "de", eigen: true }); continue; }
    const z = ziele.find(([begriff, w]) => newsPasst(x.titel, begriff, w.ticker));
    if (z) aus.push({ ...x, quelle: q.name, bezug: z[1].name, sprache: "de", eigen: true });
  }
  return aus;
}

async function newsLaden() {
  if (!APP) return meldung("News gibt es nur in der App.");
  if (netzGesperrt()) return;
  const ziele = newsZiele(), e = S.einstellungen || {}, quellen = (e.newsQuellen || []).filter((q) => q.an !== false);
  if (!ziele.length && !quellen.some((q) => q.alle)) return meldung("Keine Aktien oder Kryptowerte im Depot oder auf der Watchlist."); 
  const holen = (art, begriff) => new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok; APP[art](begriff, id); setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
  const neu = [];
  for (const q of quellen) {
    meldung(`Lade ${q.name} …`);
    neu.push(...eigeneQuelleAuswerten(q, await holen("rss", q.url), ziele));
  }
  let k = 0, keineVerbindung = 0;
  const mitYahoo = e.newsYahoo !== false, mitGoogle = e.newsGoogle !== false;
  for (const [begriff, z] of mitYahoo || mitGoogle ? ziele : []) {
    meldung(`Lade News ${++k}/${ziele.length} …`);
    const y = mitYahoo ? await holen("yahooNews", begriff) : {};
    if (y == null) keineVerbindung++;
    for (const n of y?.news || [])
      if (n.title && newsPasst(n.title, begriff, z.ticker))
        neu.push({ titel: n.title, quelle: n.publisher || "Yahoo", zeit: (n.providerPublishTime || 0) * 1000, link: n.link, bezug: z.name, sprache: "en" });
    const g = mitGoogle ? await holen("googleNews", begriff) : "";
    if (g == null) keineVerbindung++;
    if (typeof g === "string" && g.includes("<rss")) {
      const xml = new DOMParser().parseFromString(g, "text/xml");
      for (const it of [...xml.querySelectorAll("item")].slice(0, 8)) {
        const quelle = it.querySelector("source")?.textContent || "Google News";
        const titel = (it.querySelector("title")?.textContent || "").replace(new RegExp(" - " + quelle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"), "");
        neu.push({ titel, quelle, zeit: Date.parse(it.querySelector("pubDate")?.textContent || "") || 0,
                   link: it.querySelector("link")?.textContent || "", bezug: z.name, sprache: "de" });
      }
    }
    if (k === 1 && keineVerbindung === (mitYahoo ? 1 : 0) + (mitGoogle ? 1 : 0)) return meldung("Keine Verbindung – News konnten nicht geladen werden.");
  }
  // 0.85 (Loop 4.4): abonnierte Werte extra nach Ad-hoc-Meldungen durchsuchen - Treffer nur mit passender Ueberschrift
  const abo = adhocAbo();
  for (const [begriff, z] of mitGoogle ? ziele.filter(([, w]) => abo.has(w.name)) : []) {
    meldung("Lade Ad-hoc-Meldungen …");
    const g = await holen("rss", "https://news.google.com/rss/search?hl=de&gl=DE&ceid=DE:de&q=" + encodeURIComponent(`"${begriff}" (ad-hoc OR "ad hoc" OR Insiderinformation)`));
    for (const x of rssEintraege(g)) if (ADHOC_RE.test(x.titel)) neu.push({ ...x, quelle: "Google News", bezug: z.name, sprache: "de", adhoc: true });
  }
  // Doppelte Titel raus, neueste zuerst, hoechstens 200 behalten
  const gesehen = new Set(), alle = [];
  for (const n of [...neu, ...(S.news?.eintraege || [])].sort((a, b) => b.zeit - a.zeit)) {
    const key = n.titel.toLowerCase().replace(/\W+/g, "").slice(0, 80);
    if (!n.link || gesehen.has(key)) continue;
    gesehen.add(key); if (ADHOC_RE.test(n.titel)) n.adhoc = true; alle.push(n);
  }
  S.news = { stand: new Date().toISOString(), eintraege: alle.slice(0, 200) };
  sichern(); zeichnen();
  meldung(`${neu.length} Meldungen geladen.`);
}

function newsListe(eintraege) {
  return eintraege.map((n) => `
    <a class="zeile news" href="${esc(/^https?:\/\//i.test(n.link) ? n.link : "#")}" style="grid-template-columns:minmax(0,1fr);text-decoration:none;color:inherit">
      <span style="min-width:0"><span class="titel">${esc(n.titel)}</span>
        <span class="unter">${n.adhoc ? "⚡ " : ""}${esc(n.bezug)} · ${esc(n.quelle)} · ${n.zeit ? new Date(n.zeit).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" }) : ""}${n.sprache === "en" ? " · EN" : ""}</span></span>
    </a>`).join("");
}

// 0.84 (Verbesserungs-Loop 4.2): News nach Portfolio - eigene Depots / beobachtete Depots + Watchlist
function newsGruppen() {
  const eigen = new Set(), beob = new Set(), vorher = D;
  try {
    for (const d of Object.values(S.depots || {})) {
      D = d;
      const ziel = d.rolle === "beobachtet" ? beob : eigen;
      for (const p of positionen().liste) ziel.add(p.name);
    }
  } catch { /* ohne Depots */ } finally { D = vorher; }
  for (const w of S.watchlist || []) beob.add(w.name);
  return { eigen, beob };
}

function newsSeite() {
  const alle = S.news?.eintraege || [];
  const filter = ui.newsFilter || "";
  const bezuege = [...new Set(alle.map((n) => n.bezug))];
  const gr = newsGruppen();
  const passt = (n) => !filter || (filter === "#eigen#" ? gr.eigen.has(n.bezug) : filter === "#beob#" ? gr.beob.has(n.bezug) : filter === "#adhoc#" ? !!n.adhoc : n.bezug === filter);
  const liste = alle.filter(passt).slice(0, 80);
  let stimmung = "";
  try { stimmung = typeof stimmungKarte === "function" ? stimmungKarte(wertverlauf(eigeneDepots()), gesamtDaten().liste) : ""; } catch { stimmung = ""; }   // 0.84: aus der Übersicht hierher
  return `
    <h2>News</h2>
    <section class="karte">
      <button class="knopf haupt" data-los="news-laden" style="width:100%">News laden</button>
      <p class="klein" style="margin-bottom:0">${S.news?.stand ? `Stand ${new Date(S.news.stand).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })} · offline gespeichert` : "Noch nichts geladen."}
        Für deine Aktien und Kryptowerte (Depot + Watchlist) aus Google News, Yahoo und deinen eigenen Quellen (unten). Antippen öffnet den Artikel im Browser.</p>
    </section>
    ${alle.length ? `<div class="reiter" style="margin:12px 0 0"><button data-newsfilter="" class="${!filter ? "aktiv" : ""}">Alle</button>${alle.some((n) => gr.eigen.has(n.bezug)) ? `<button data-newsfilter="#eigen#" class="${filter === "#eigen#" ? "aktiv" : ""}">💼 Mein Portfolio</button>` : ""}${alle.some((n) => gr.beob.has(n.bezug)) ? `<button data-newsfilter="#beob#" class="${filter === "#beob#" ? "aktiv" : ""}">👁 Beobachtet</button>` : ""}${alle.some((n) => n.adhoc) ? `<button data-newsfilter="#adhoc#" class="${filter === "#adhoc#" ? "aktiv" : ""}">⚡ Ad-hoc</button>` : ""}</div>` : ""}
    ${bezuege.length > 1 ? `<div class="reiter" style="margin:6px 0 0">${bezuege.map((b) =>
      `<button data-newsfilter="${esc(b)}" class="${filter === b ? "aktiv" : ""}">${esc(b)}</button>`).join("")}</div>` : ""}
    <section class="karte liste" style="margin-top:10px">${newsListe(liste) || `<p class="klein" style="margin:8px">Keine Meldungen.</p>`}</section>
    ${stimmung}
    ${newsHinweisKarte()}
    ${newsQuellenKarte()}
`;
}

// 0.85 (Verbesserungs-Loop 4.3/4.4): Benachrichtigung fuer Schlagzeilen direkt hier an/aus, Ad-hoc-Meldungen je Wert abonnieren
function newsHinweisKarte() {
  const h = hinweise(), abo = adhocAbo(), ziele = newsZiele(), app = !!(APP && APP.wachterSetzen);
  const zeile = (inhalt, input) => `<label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer"><span style="min-width:0">${inhalt}</span>${input}</label>`;
  return `
    ${app ? `<section class="karte liste" style="margin-top:10px">
      ${zeile(`<span class="titel">🔔 Benachrichtigung bei neuen Schlagzeilen</span><span class="unter">ab Werk aus · Sammel-Meldung statt Spam</span>`,
        `<input type="checkbox" id="hinweis-news" ${h.news ? "checked" : ""} style="width:26px;height:26px">`)}
      ${!h.an ? `<p class="klein warn-t" style="margin:8px">Benachrichtigungen sind insgesamt aus.</p><button class="knopf" data-ziel="hinweise" style="width:100%">🔔 Benachrichtigungen einrichten</button>` : ""}
    </section>` : ""}
    <details class="karte" style="margin-top:10px" ${abo.size ? "open" : ""}><summary><b>⚡ Ad-hoc-Meldungen abonnieren</b></summary>
      <p class="klein">Pflichtmitteilungen der Firmen (Ad-hoc, Insiderinformation). Abonnierte Werte durchsucht „News laden“ extra danach – mit Benachrichtigungen meldet sich das Handy auch im Hintergrund. Gezählt werden nur Überschriften, die nach Ad-hoc aussehen.</p>
      ${ziele.length ? `<div class="liste">${ziele.map(([, z]) => zeile(`<span class="titel">${esc(z.name)}</span>`,
        `<input type="checkbox" data-adhoc="${esc(z.name)}" ${abo.has(z.name) ? "checked" : ""} style="width:26px;height:26px">`)).join("")}</div>`
        : `<p class="klein">Keine Aktien oder Kryptowerte im Depot oder auf der Watchlist.</p>`}
    </details>`;
}
document.addEventListener("change", (ev) => {
  const n = ev.target.dataset?.adhoc;
  if (n == null) return;
  const e = S.einstellungen ||= {}, s = new Set(e.adhocAbo || []);
  if (ev.target.checked) s.add(n); else s.delete(n);
  e.adhocAbo = [...s]; sichern(); wachterSpaeter();
  meldung(ev.target.checked ? "Ad-hoc-Meldungen abonniert." : "Ad-hoc-Abo beendet.");
});

/** Fuer die Detailseite einer Position: die letzten Meldungen aus dem Speicher. */
function newsZu(name) {
  const l = (S.news?.eintraege || []).filter((n) => n.bezug === name).slice(0, 5);
  return l.length ? `<h2>News</h2><section class="karte liste">${newsListe(l)}</section>` : "";
}

// ------------------------------------------------------------ Sicherheit & Sicherung
// Nur lokal (Vorgabe 07.11.2026): verschluesselte Datei in einem Ordner auf dem
// Handy. Passwort liegt verschluesselt im Android-Keystore, damit die App beim
// Verlassen automatisch sichern kann. Zum Wiederherstellen braucht man es selbst.

function sicherheitStatus() {
  if (!APP || !APP.sicherheitStatus) return { sperre: false, schutz: false, geraetGesichert: false, passwort: false, ordner: null, letzte: 0, datei: "" };
  try { return JSON.parse(APP.sicherheitStatus()); } catch { return {}; }
}

/** Schalter "Internet ganz aus" (Mehr → Datenschutz). Java sperrt zusaetzlich selbst. */
function netzGesperrt() {
  if (!sicherheitStatus().netzAus) return false;
  meldung("Internet ist in der App ausgeschaltet – ⚙️ → Datenschutz.");
  return true;
}

function sicherheitSeite() {
  const st = sicherheitStatus();
  const alt = st.letzte ? (Date.now() - st.letzte) / 864e5 : null;
  const schalter = (id, an, titel, text, gesperrt) => `
    <label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
      <span style="min-width:0"><span class="titel">${titel}</span><span class="unter">${text}</span></span>
      <input type="checkbox" data-schalter="${id}" ${an ? "checked" : ""} ${gesperrt ? "disabled" : ""} style="width:26px;height:26px"></label>`;
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Sicherheit &amp; Sicherung</span></h2>
    ${betrugHinweis()}
    <h2>App-Sperre mit 6-stelliger PIN</h2>
    <section class="karte">
      <p style="margin-top:0">${st.pin ? "🔒 <b>An.</b> Deine Daten sind mit der PIN verschlüsselt." : "Aus. Mit PIN werden alle Daten in der App verschlüsselt."}</p>
      <p class="klein warn-t"><b>Wichtig: PIN weg = Daten weg.</b> Es gibt keine Hintertür. Darum unten die Sicherung einrichten – die hat ihr eigenes Passwort und rettet dich.</p>
      <form class="formular" id="pin-form">
        <label>${st.pin ? "Neue PIN" : "PIN festlegen"} (6 Ziffern)<input name="p1" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="off"></label>
        <label>PIN wiederholen<input name="p2" type="password" inputmode="numeric" pattern="\\d{6}" maxlength="6" autocomplete="off"></label>
        <button class="knopf haupt" type="submit">${st.pin ? "PIN ändern" : "Sperre einschalten"}</button>
      </form>
      ${st.pin ? `
      <div class="liste" style="padding:0;margin-top:10px">
      </div>
      <form class="formular" id="pin-aus-form" style="margin-top:10px">
        <label>Sperre ausschalten – aktuelle PIN<input name="pin" type="password" inputmode="numeric" maxlength="6" autocomplete="off"></label>
        <button class="knopf gefahr" type="submit">Sperre aus (Daten wieder unverschlüsselt)</button>
      </form>` : ""}
    </section>
    <h2>Bildschirm</h2>
    <section class="karte liste">
      ${schalter("schutz", st.schutz, "Bildschirmschutz", "App-Übersicht und Screenshots zeigen nur Schwarz. Zum Screenshot-Schicken kurz ausschalten.")}
    </section>
    <h2>Automatische Sicherung (nur auf dem Handy)</h2>
    <section class="karte">
      <p style="margin-top:0" class="${alt == null || alt > 14 ? "warn-t" : ""}">${st.letzte ? `Letzte Sicherung: ${new Date(st.letzte).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })}<br><span class="klein">${esc(st.datei)}</span>` : "Noch keine Sicherung."}</p>
      <form class="formular" id="pw-form">
        <label>${st.passwort ? "Sicherungs-Passwort ändern" : "1. Sicherungs-Passwort festlegen"}<input name="pw1" type="password" autocomplete="new-password" minlength="14" placeholder="mindestens 14 Zeichen, eigenes Passwort"></label>
        <label>Passwort wiederholen<input name="pw2" type="password" autocomplete="new-password"></label>
        <button class="knopf" type="submit">${st.passwort ? "Passwort ändern" : "Passwort speichern"}</button>
      </form>
      <p class="klein"><b>Gut aufbewahren</b> (z. B. in einem Passwort-Manager): Ohne Passwort lässt sich keine Sicherung wiederherstellen.</p>
      <div class="knoepfe">
        <button class="knopf" data-los="ordner-waehlen">${st.ordner ? "Ordner: " + esc(st.ordner) : "2. Ordner wählen"}</button>
        <button class="knopf haupt" data-los="jetzt-sichern" ${st.passwort && st.ordner ? "" : "disabled"}>Jetzt sichern</button>
      </div>
      <p class="klein">Danach sichert die App automatisch beim Verlassen, wenn sich etwas geändert hat, und behält die letzten 10 Dateien. Tipp: einen Ordner wie „Dokumente/Depot-Kompass-Sicherung“ anlegen. Gegen Verlust des Handys die Datei ab und zu per Kabel auf PC oder USB-Stick kopieren. Die automatische Sicherung enthält alle Daten, aber nicht die Original-Dokumente – die stecken im ZIP-Export (⚙️ → Import → „Alles exportieren“).</p>
    </section>
    <h2>Wiederherstellen</h2>
    <section class="karte">
      <label class="knopf haupt" style="display:block;text-align:center;cursor:pointer">📂 Sicherung oder geteiltes Depot einlesen<input type="file" id="import-datei" accept=".dksafe,.zip,application/octet-stream,application/zip,application/json,.json,.csv,.pdf,image/*,text/*" hidden></label>
      <p class="klein" style="margin-bottom:0">Wähle die <b>.dksafe</b>-Datei (oder die verschlüsselte ZIP). Die App fragt nach dem Passwort. Eine Vollsicherung ersetzt alle Depots, ein geteiltes Depot wird nur hinzugefügt. Tipp: Dateien lassen sich auch aus jeder App mit „Teilen → Depot-Kompass“ schicken.</p>
    </section>`;
}

/** Passwort-Abfrage fuer .dksafe-Dateien (eigene Seite statt prompt(), Eingabe verdeckt). */
function entsperrSeite() {
  return `
    <h2><button class="knopf klein" data-los="wiederherstellen-weg">‹ Abbrechen</button><span>Sicherung öffnen</span></h2>
    <form class="karte formular" id="wiederherstellen-form">
      <p style="margin:0">${ui.wiederherstellen.zip ? `Verschlüsselte ZIP „${esc(ui.wiederherstellen.name || "")}“ – Daten und Original-Dokumente.` : `Verschlüsselte Sicherung vom ${esc(ui.wiederherstellen.erstellt || "?")}.`}</p>
      <label>Passwort<input name="pw" type="password" autocomplete="current-password" required></label>
      <button class="knopf haupt" type="submit">Entschlüsseln und laden</button>
      <p class="klein">Geteiltes Depot: wird hinzugefügt, nichts anderes wird verändert.</p>
      <p class="klein warn-t">Vollsicherung: ersetzt alle Depots in der App. Verschlüsselte CSV: kommt wie ein normaler Import in die Vorschau.</p>
    </form>`;
}

// ------------------------------------------------------------ PIN-Feld
function pinSeite() {
  const st = sicherheitStatus();
  const punkte = Array.from({ length: 6 }, (_, k) => `<i class="${k < (ui.pin || "").length ? "voll" : ""}"></i>`).join("");
  const taste = (x) => `<button class="pintaste" data-pin="${x}">${x === "weg" ? "⌫" : x}</button>`;
  return `
    <section class="pinfeld">
      <img src="${location.pathname.includes("/tests/") ? "../assets/" : ""}logo.svg" alt="" style="display:block;width:88px;height:88px;margin:0 auto">
      <h1>Depot-Kompass</h1>
      <p class="klein">${esc(ui.pinMeldung || "App-PIN eingeben")}</p>
      <div class="pinpunkte">${punkte}</div>
      <div class="pintasten">${["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "weg"]
        .map((x) => x ? taste(x) : "<span></span>").join("")}</div>
      <button class="abmelden" data-los="pin-vergessen">PIN vergessen?</button>
    </section>`;
}

window.entsperrt = () => { ui.gesperrt = false; ui.pin = ""; ui.pinMeldung = ""; ui.pinBereit = false; laden(); zeichnen(); geteiltVerarbeiten(); };

function pinTaste(x) {
  ui.pin = x === "weg" ? (ui.pin || "").slice(0, -1) : ((ui.pin || "") + x).slice(0, 6);
  if (ui.pin.length === 6) {
    const r = APP ? APP.pinPruefen(ui.pin) : "ok";
    ui.pin = "";
    if (r === "ok") return;                                   // Java meldet window.entsperrt()
    ui.pinMeldung = r.startsWith("warten:") ? `Zu viele Fehlversuche – bitte ${r.slice(7)} Sekunden warten.`
      : `Falsche PIN – noch ${r.slice(7)} Versuche bis zur Wartezeit.`;
  }
  zeichnen();
}

window.ordnerGewaehlt = (ok) => { meldung(ok ? "Ordner gespeichert." : "Kein Ordner gewählt."); zeichnen(); };

// ------------------------------------------------------------ Einfuehrung
// Beim ersten Start: 1. Hinweis (keine Anlageberatung), 2. Kurzanleitung.
// Spaeter unter Mehr → „Hinweis & Anleitung“ wieder aufrufbar.
const EINFUEHRUNG_STAND = 2;            // erhoehen, wenn sich der Text wesentlich aendert

function einfuehrungSeite() {
  if (ui.einfuehrung === 3) return einfuehrungPin();
  if (ui.einfuehrung === 1) return `
    <section class="karte" style="margin-top:12px">
      <h1 style="margin:0 0 10px;font-size:22px">Willkommen</h1>
      <p>Depot-Kompass bringt deine Depots, dein Cash und deine Sachwerte an einen Ort – auf deinem Handy, ohne Konto, ohne Werbung, ohne Tracking.</p>
      <p><b>Keine Anlageberatung.</b> Die App rechnet nur mit deinen Daten. Kurse und Termine aus dem Internet können verspätet oder falsch sein. Deine Entscheidungen triffst du selbst.</p>
      <button class="knopf haupt" data-einf="2" style="width:100%">Weiter</button>
    </section>`;
  return `
    <section class="karte" style="margin-top:12px">
      <h1 style="margin:0 0 10px;font-size:22px">Wie möchtest du starten?</h1>
      <div class="karte" style="margin:0 0 10px;background:var(--karte-2)">
        <b>📴 Ganz offline</b>
        <p class="klein" style="margin:6px 0 0">Alles läuft mit deinen importierten Dateien: Depots, Gewinn/Verlust, Dividenden, Kalender, Sachwerte, Notizen. Nichts verlässt das Handy.</p>
      </div>
      <div class="karte" style="margin:0;background:var(--karte-2)">
        <b>🌐 Mit Internet</b>
        <p class="klein" style="margin:6px 0 0">Zusätzlich holt die App auf Knopfdruck aktuelle Kurse, Charts, Dividenden- und Earnings-Termine und News für deine Werte. Dabei wird nur abgefragt, <b>welche</b> Werte – keine Stückzahlen, keine Beträge, keine Kontodaten. Eigene API-Schlüssel (optional) gehören auch zu diesem Teil.</p>
      </div>
      <p class="klein">Du kannst das jederzeit unter ⚙️ → Datenschutz umstellen.</p>
      <div class="knoepfe"><button class="knopf" data-einf="${pinFehlt() ? 3 : "fertig"}" data-netz-start="aus">📴 Offline starten</button>
        <button class="knopf haupt" data-einf="${pinFehlt() ? 3 : "fertig"}" data-netz-start="an">🌐 Mit Internet starten</button></div>
    </section>`;
}

/** Erster Start: App-PIN gleich festlegen (Vorgabe 07.11.: ohne PIN fehlte die Abfrage beim Oeffnen). */
const pinFehlt = () => !!(APP && APP.sicherheitStatus) && !sicherheitStatus().pin;

function einfuehrungPin() {
  return `
    <section class="karte" style="margin-top:12px">
      <h1 style="margin:0 0 10px;font-size:22px">🔒 Deine App-PIN</h1>
      <p>Mit einer 6-stelligen PIN werden alle Daten in der App verschlüsselt. Beim Öffnen fragt die App danach. Entsperren per Fingerabdruck gibt es bewusst nicht – private Finanzdaten nur mit PIN.</p>
      <p class="klein warn-t"><b>Wichtig:</b> PIN vergessen = Daten weg. Es gibt keine Hintertür. Eine verschlüsselte Sicherung mit eigenem Passwort schützt davor.</p>
      <form class="formular" id="pin-form">
        <label>PIN (6 Ziffern)<input name="p1" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label>
        <label>PIN wiederholen<input name="p2" type="password" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" autocomplete="new-password" required></label>
        <button class="knopf haupt" type="submit" style="width:100%">PIN festlegen</button>
      </form>
      <button class="knopf" data-einf="fertig" style="width:100%;margin-top:10px">Ohne PIN weiter (nicht empfohlen)</button>
    </section>`;
}

// ------------------------------------------------------------ Mehr
function mehrSeite() {
  const k = (ziel, symbol, titel, text) => `
    <button class="zeile" data-ziel="${ziel}"><span class="mono">${symbol}</span>
      <span style="min-width:0"><span class="titel">${titel}</span><span class="unter">${text}</span></span><span class="rechts">›</span></button>`;
  return `
    <h2>Mehr</h2>
    <section class="karte liste">
      ${k("buchungen", "📄", "Buchungen", `${D.buchungen.length} im Depot ${esc(D.name)}`)}
      ${k("steuer", "🧾", "Steuer-Übersicht", "Gewinne je Jahr, Aktien-Topf, Krypto-Haltefrist, Freibeträge")}
      ${k("sachwerte", "📦", "Sachwerte", `${anzahl((S.sachwerte || []).length, "Eintrag", "Einträge")} · Kamera, Laptop, Auto, Gold …`)}
      ${k("daten", "⬆️", "Import, Kurse &amp; Sichern", "Dateien einlesen, Daten aus dem Internet, Sicherung")}
      ${EIN().ki ? k("ki", "✨", "KI-Fragen zum Portfolio", "Chat mit Rückfragen, Earnings, Beispiele · nur Name, Einstieg, Long/Short an deinen KI-Anbieter") : ""}
      ${k("einstellungen", "⚙️", "Einstellungen", "Sprache, Design hell/dunkel, Verstecken, Kalender, Startseite")}
      ${k("hinweise", "🔔", "Benachrichtigungen", EIN().hinweise?.an ? "an · Kurse, Earnings, Schlagzeilen" : "aus · nur mit Internet")}
      ${k("fehlerprotokoll", "🐞", "Fehlerprotokoll", "technische Fehler sammeln, auswerten und teilen – ohne Beträge")}
      ${k("sicherheit", "🔒", "Sicherheit &amp; Sicherung", "App-Sperre, Bildschirmschutz, verschlüsselte Sicherung")}
      ${k("schluessel", "🔑", "API-Schlüssel", EIN().ki ? "KI (OpenRouter, Claude, ChatGPT, Gemini) und weitere Dienste – eigene Schlüssel eintragen" : "eigene Schlüssel für Dienste eintragen")}
      ${k("datenschutz", "🛡️", "Datenschutz", "was die App wann sendet")}
      <button class="zeile" data-einf="1"><span class="mono">ℹ️</span>
        <span style="min-width:0"><span class="titel">Hinweis &amp; Anleitung</span><span class="unter">keine Anlageberatung · so funktioniert die App</span></span><span class="rechts">›</span></button>
      ${k("depots", "🗂️", "Depots verwalten", "alle Depots als Liste, Cash je Depot, anlegen")}
      ${k("feedback", "🐞", "Fehler melden (Alpha)", "Discord-Ticket – was du schicken sollst und was nicht")}
      ${k("unterstuetzen", "💜", "Credits & Unterstützen", "Wer und was dahintersteckt – und wie du das Projekt unterstützen kannst")}
    </section>
    <h2>Über die App</h2>
    <section class="karte">
      <img src="${location.pathname.includes("/tests/") ? "../assets/" : ""}logo.svg" alt="" class="ueber-logo">
      <p style="margin-top:0;text-align:center"><b>Depot-Kompass</b> · Version ${esc(appVersion())} · Alpha</p>
      <p class="klein" style="text-align:center">Diese App ist in der <b>Alpha-Phase</b>. Fällt dir ein Fehler auf oder hast du eine Idee? Öffne auf unserem Discord ein Ticket:<br>
        <a href="${DISCORD}" style="overflow-wrap:anywhere">discord.gg/wFvFpeKpm</a></p>
      <p class="klein" style="text-align:center">⚠️ Wir schreiben dich nie von uns aus privat an und fragen nie nach Geld oder Zugangsdaten.</p>
      <p class="klein">Idee, Tests &amp; Gestaltung: <b>Depot-Kompass-Team</b><br>
        Ohne Werbung, ohne Tracking, ohne Konto. Keine Anlageberatung.</p>
      <button class="knopf" data-ziel="unterstuetzen" style="width:100%">💜 Credits &amp; Unterstützen</button>
      <button class="knopf" data-los="update-suchen" style="width:100%;margin-top:8px">🔄 Nach Update suchen</button>
      <div id="update-ergebnis">${updateErgebnis()}</div>
    </section>
    <h2>Wenn es schwer wird</h2>
    ${hilfeKasten()}`;
}

/** Hilfe-Kasten (ab 0.66, Wunsch Team 20.11.): TelefonSeelsorge – immer auf „Mehr“, bei extremer Angst auch in der Marktstimmung.
 *  Nummern laut telefonseelsorge.de (geprüft 20.11.2026). Links als tel:, damit man direkt anrufen kann. */
function hilfeKasten() {
  return `<section class="karte" style="border-left:4px solid #39d98a">
      <p style="margin-top:0">Verluste können richtig wehtun – finanziell und im Kopf. Du bist nicht allein. Reden hilft.</p>
      <p><b>TelefonSeelsorge</b> (Deutschland) – kostenlos, anonym, Tag und Nacht:<br>
        <a href="tel:08001110111">0800 111 0 111</a> · <a href="tel:08001110222">0800 111 0 222</a> · <a href="tel:116123">116 123</a><br>
        <span class="klein">Chat &amp; Mail: <a href="https://www.telefonseelsorge.de">telefonseelsorge.de</a></span></p>
      <p class="klein">Akute Gefahr: Notruf <a href="tel:112">112</a>. In anderen Ländern: <a href="https://findahelpline.com">findahelpline.com</a></p>
      <p class="klein" style="margin-bottom:0">Und für den Markt: keine Entscheidung in Panik, Hebel raus, Pausen sind erlaubt.</p>
    </section>`;
}

/** Spenden (ab 0.45, Adressen 14.11.2026, Pruefsummen kontrolliert). Leere Eintraege erscheinen nicht. */
const SPENDEN = [
  { id: "hype", name: "Hyperliquid", wert: "0x8Df090f2176bF76270dE12Bbe9E5B811Cf5b18B4" },
  { id: "btc", name: "Bitcoin (BTC)", wert: "bc1qxkw0k556x9qdr5hqjf7lfkdktjx0masdvs98cp" },
  { id: "xmr", name: "Monero (XMR)", wert: "47WpTbRSA4UAA3Rx2iZcBqMfP8bMwKhF6BYio31umvJQ2zMNNn7GCJQSAYySHvkAcDKvSJ8DDMcSdeKWrA8ULQ1BA1E2aqc" },
  { id: "eth", name: "Ethereum (ETH · MetaMask)", wert: "0x51234446Cb2DF9860D2C65B96F240d3bdFAe696F" },
  { id: "sol", name: "Solana (SOL)", wert: "BCjbXmmMD976EjQkn4tMwP71W6EDMu5z7exGWLVGZF8Q" },
  { id: "trx", name: "Tron (TRX)", wert: "TJ3oMWqVES94LgR1MZs3eLCGAS5i2jpE4o" },
  { id: "xlm", name: "Stellar (XLM)", wert: "GD5PG25W25JIQU4VR4WXZURUGU2VIYSYBIBAJX7VUWCRGW76RPRLYG4P" },
];
function spendenZeilen() {
  const da = SPENDEN.filter((s) => s.wert);
  if (!da.length) return `<button class="knopf" style="width:100%" disabled>☕ Spenden-Möglichkeiten folgen zum Release</button>`;
  // Lesbar (Vorgabe 15.11.): Name + Kopier-Knopf oben, Adresse darunter in voller Breite, Festbreitenschrift, in Vierergruppen.
  // Kopiert wird immer die Original-Adresse ohne Leerzeichen.
  const gruppen = (a) => esc(a).replace(/(.{4})(?=.)/g, "$1 ");
  return da.map((s) => `
      <div class="spende">
        <div class="spende-kopf"><b>${esc(s.name)}</b><button class="knopf klein" data-kopieren="${esc(s.wert)}">📋 Kopieren</button></div>
        <code class="spende-adresse" data-kein-tr>${gruppen(s.wert)}</code>
      </div>`).join("");
}
document.addEventListener("click", (ev) => {
  const x = ev.target.closest("[data-kopieren]");
  if (!x) return;
  const text = x.dataset.kopieren;
  try {
    if (APP && APP.kopieren) APP.kopieren(text);
    else navigator.clipboard.writeText(text);
    meldung("In die Zwischenablage kopiert.");
  } catch (e) { meldung("Kopieren ging nicht – bitte von Hand markieren."); }
});

function datenschutzSeite() {
  const aus = sicherheitStatus().netzAus;
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Datenschutz</span></h2>
    <section class="karte">
      <p style="margin-top:0"><b>📴 Offline</b> – deine Daten bleiben auf diesem Handy. Kein Konto, keine Werbung, kein Tracking, kein Google-Backup. Die App braucht keine Kontakte, keinen Standort und keine Kamera.</p>
    </section>
    <h2>🌐 Internet</h2>
    <section class="karte liste">
      <label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
        <span style="min-width:0"><span class="titel">Internet-Abrufe erlauben</span><span class="unter">${aus ? "Aus – die App geht nie ins Netz." : "An – nur wenn du einen Knopf drückst."}</span></span>
        <input type="checkbox" data-schalter="netz" ${aus ? "" : "checked"} style="width:26px;height:26px"></label>
    </section>
    <section class="karte">
      <p style="margin-top:0">Wenn an, fragt die App auf Knopfdruck ab, <b>welche</b> Werte du hast – nie Stückzahlen, Beträge oder Kontodaten:</p>
      <ul class="klein" style="padding-left:18px;margin:0">
        <li><b>Kurse &amp; Daten aktualisieren:</b> Yahoo Finance (Kurse, Charts, Dividenden, Earnings).</li>
        <li><b>Zertifikate, Optionsscheine, Anleihen:</b> Onvista (Kurs per ISIN/WKN), ebenfalls nur beim Aktualisieren.</li>
        <li><b>News laden:</b> Google News, Yahoo und deine eigenen Quellen.</li>
        <li><b>Nach Update suchen:</b> fragt bei GitHub nur die Nummer der neuesten Version ab – nur wenn du den Knopf drückst.</li>
        <li><b>Links</b> (Artikel, Schlüssel holen) öffnen im Browser.</li>
        <li><b>API-Schlüssel</b> (⚙️ → API-Schlüssel) gehen nur an den jeweiligen Dienst.</li>
        <li><b>Fehler melden:</b> nur über ein Ticket auf unserem Discord – was du dort schreibst, entscheidest du selbst.</li>
        ${EIN().ki ? `<li><b>KI (Zusatzmodul, an):</b> der angezeigte Text an den gewählten Anbieter (OpenRouter, Anthropic, OpenAI oder Google), mit deinem Schlüssel – Namen, Einstiegskurse, Long/Short, Schlagzeilen, bei Einzelwerten öffentliche Quartalszahlen (Anteile nur auf Wunsch), nie Depotbeträge oder Stückzahlen. Rückfragen senden das bisherige Gespräch mit.</li>` : ""}
        ${hinweise().an ? `<li><b>Benachrichtigungen (an):</b> alle paar Stunden im Hintergrund öffentliche Kurse (Yahoo) zu deinen Tickern und Schlagzeilen (Google News) zu den Namen deiner Werte – nie Beträge, Stückzahlen oder Konten.</li>` : ""}
      </ul>
      <p class="klein" style="margin-bottom:0">Die Dienste sehen dabei deine IP-Adresse.</p>
    </section>
    <h2>🔒 Schutz</h2>
    <section class="karte">
      <ul class="klein" style="padding-left:18px;margin:0">
        <li>Nur verschlüsselte Verbindungen (HTTPS).</li>
        <li>Mit App-PIN sind alle Daten verschlüsselt und an dieses Handy gebunden.</li>
        <li>Sicherungen und Exporte nur verschlüsselt, mit deinem eigenen Passwort.</li>
      </ul>
    </section>`;
}

// ------------------------------------------------------------ Ereignisse
document.addEventListener("click", (e) => {
  const t = (s) => e.target.closest(s);
  let x;
  if ((x = t("[data-pin]"))) return pinTaste(x.dataset.pin);
  if ((x = t('[data-los="pin-vergessen"]'))) {
    if (!confirm("PIN vergessen? Dann werden ALLE Daten in der App gelöscht – Depots, Watchlist, Notizen, Schlüssel. Das lässt sich nicht rückgängig machen.")) return;
    if (!confirm("Wirklich alles löschen? Wiederherstellen geht danach nur mit einer .dksafe-Sicherung und deren Passwort.")) return;
    APP?.allesLoeschen?.(); return;
  }
  if ((x = t("[data-einf]"))) {
    if (x.dataset.einf === "fertig") {
      if (x.dataset.netzStart && APP && APP.netzSetzen) APP.netzSetzen(x.dataset.netzStart === "aus");
      (S.einstellungen ??= {}).einfuehrung = EINFUEHRUNG_STAND; ui.einfuehrung = null; sichern();
      zeige(D.buchungen.length ? "uebersicht" : "daten");
      return geteiltVerarbeiten();
    }
    if (x.dataset.netzStart && APP && APP.netzSetzen) APP.netzSetzen(x.dataset.netzStart === "aus");
    ui.einfuehrung = +x.dataset.einf; zeichnen(); return scrollTo(0, 0);
  }
  if ((x = t("[data-newsfilter]"))) { ui.newsFilter = x.dataset.newsfilter; return zeichnen(); }
  if ((x = t("[data-watch]"))) { ui.watch = x.dataset.watch; ui.treffer = null; ui.watchEntwurf = null; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-watch-loeschen]"))) {
    if (!confirm("Von der Watchlist entfernen?")) return;
    S.watchlist = S.watchlist.filter((w) => w.id !== x.dataset.watchLoeschen); S.alarme = alarme().filter((a) => a.bezug !== "w:" + x.dataset.watchLoeschen); ui.watch = null; sichern(); return zeichnen();
  }
  if ((x = t("[data-notiz-neu]"))) { ui.notiz = { bezug: x.dataset.notizNeu }; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-notiz]"))) { ui.notiz = { id: x.dataset.notiz }; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-notiz-loeschen]"))) {
    if (!confirm("Notiz löschen?")) return;
    S.notizen = S.notizen.filter((n) => n.id !== x.dataset.notizLoeschen); ui.notiz = null; sichern(); return zeichnen();
  }
  if ((x = t("[data-schluessel-pruefen]"))) return schluesselPruefen(x.dataset.schluesselPruefen);
  if ((x = t("[data-schluessel-weg]"))) { if (confirm("Schlüssel entfernen?")) schluesselSpeichern(x.dataset.schluesselWeg, ""); return; }
  if ((x = t("[data-ticker-wahl]"))) {
    document.getElementById("watch-ticker").value = x.dataset.tickerWahl;
    ui.treffer = null;
    const f = document.getElementById("watch-form"); f.requestSubmit(); return;
  }
  if ((x = t("[data-los]"))) {
    if (x.dataset.los === "ticker-suchen") return tickerTreffer();
    if (x.dataset.los === "news-laden") return newsLaden();
    if (x.dataset.los === "stimmung-laden") return stimmungLaden();
    if (x.dataset.los === "update-suchen") return updateSuchen();
    if (x.dataset.los === "krypto-markt") return kryptoMarktLaden(x.dataset.id);
    if (x.dataset.los === "neu-gelesen") { (S.einstellungen ||= {}).neuGesehen = appVersion(); sichern(); return zeichnen(); }
    if (x.dataset.los === "ordner-waehlen") return APP ? APP.ordnerWaehlen() : meldung("Nur in der App.");
    if (x.dataset.los === "jetzt-sichern") {
      const r = APP ? APP.jetztSichern() : "Nur in der App.";
      meldung(r.startsWith("ok:") ? "Gesichert: " + r.slice(3) : "Sicherung fehlgeschlagen: " + r); return zeichnen();
    }
    if (x.dataset.los === "wiederherstellen-weg") { ui.wiederherstellen = null; return zeichnen(); }
    if (x.dataset.los === "ki-modelle") return kiModelleLaden();
    if (x.dataset.los === "ki-senden") return kiSenden();
    if (x.dataset.los === "ki-an") { (S.einstellungen ??= {}).ki = true; sichern(); meldung("KI eingeschaltet – es wird erst beim Senden etwas übertragen."); return zeichnen(); }
    if (x.dataset.los === "ki-rueck") return kiRueckfrage();
    if (x.dataset.los === "ki-neu") { ui.kiChatId = null; ui.kiRueck = ""; return zeichnen(); }
    if (x.dataset.los === "ki-notiz") {
      const chat = kiChat(); if (!chat) return;
      const text = chat.nachrichten.filter((n) => n.rolle !== "fehler").map((n) => n.rolle === "ki" ? n.text : "Frage: " + (n.daten ? chat.titel : n.text)).join("\n\n");
      (S.notizen ??= []).push({ id: neueId("n"), datum: new Date().toISOString(), bezug: "ki:" + S.aktiv,
        bezugName: "KI · " + (KI_ANBIETER[chat.anbieter]?.name || chat.anbieter), titel: chat.titel + " " + datum(heute()), text });
      sichern(); meldung("Als Notiz gespeichert.");
    }
  }
});

document.addEventListener("change", (e) => {
  const sch = e.target.dataset?.schalter;
  if (sch && APP) {
    if (sch === "schutz") APP.schutzSetzen(e.target.checked);
    if (sch === "netz") { APP.netzSetzen(!e.target.checked); wachterAbgleich(); }
    meldung(e.target.checked ? "Eingeschaltet." : "Ausgeschaltet.");
    return zeichnen();
  }
  if (e.target.id === "ki-richtung") { ui.kiRichtung = e.target.value; ui.kiAntwort = null;
    if (KI_EINZEL.has(ui.kiRichtung) && !kiSicht().liste.some((p) => p.id === ui.kiWert))
      ui.kiWert = ([...kiSicht().liste].sort((a, b) => b.wert - a.wert).find((p) => (p.inst.art || "Aktie") === "Aktie") || {}).id;
    return zeichnen(); }
  if (e.target.id === "ki-wert") { ui.kiWert = e.target.value; ui.kiAntwort = null; return zeichnen(); }
  if (e.target.id === "ki-frage") { ui.kiFrage = e.target.value; return zeichnen(); }
  if (e.target.id === "ki-prozente") { (S.einstellungen ??= {}).kiProzente = e.target.checked; ui.kiAntwort = null; sichern(); return zeichnen(); }
  if (e.target.id === "ki-modell") { kiEinst().kiModellJe[kiAnbieter()] = e.target.value; sichern(); return zeichnen(); }
  if (e.target.id === "ki-anbieter") { kiEinst().kiAnbieter = e.target.value; sichern(); return zeichnen(); }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "notiz-suche") {
    ui.notizSuche = e.target.value;
    const pos = e.target.selectionStart;
    zeichnen();
    const f = document.getElementById("notiz-suche"); f.focus(); f.setSelectionRange(pos, pos);
  }
});

document.addEventListener("submit", (e) => {
  const f = new FormData(e.target);
  if (e.target.id === "watch-form") {
    e.preventDefault();
    const neu = ui.watch === "neu";
    const w = neu ? { id: neueId("w"), aufgenommen: heute() } : S.watchlist.find((x) => x.id === ui.watch);
    const kennung = String(f.get("kennung") || "").trim().toUpperCase();
    if (!neu && kennung !== (w.kennung || "")) { w.ticker = ""; w.verlauf = null; w.termine = null; w.kursStart = null; }
    Object.assign(w, { name: String(f.get("name")).trim(), kennung, art: f.get("art"), notiz: String(f.get("notiz") || "").trim() });
    const tk = String(f.get("ticker") || "").trim();
    if (tk) w.ticker = tk;
    const kurs = zahl(f.get("kurs"));
    if (kurs != null) { w.kurs = kurs; w.kursHand = true; w.kursStart ??= kurs; } else if (w.kursHand) { w.kursHand = false; }
    if (neu) { (S.watchlist ??= []).push(w); ui.watchEntwurf = null; }
    ui.treffer = null;
    ui.watch = neu ? null : w.id;
    sichern(); meldung(neu ? "Zur Watchlist hinzugefügt – Kurs kommt mit „Kurse & Daten aktualisieren“." : "Gespeichert.");
    return zeichnen();
  }
  if (e.target.id === "pin-form") {
    e.preventDefault();
    const a = String(f.get("p1") || ""), b = String(f.get("p2") || "");
    if (!/^\d{6}$/.test(a)) return meldung("Die PIN muss genau 6 Ziffern haben.");
    if (a !== b) return meldung("Die PINs sind nicht gleich.");
    const ok = APP ? APP.pinSetzen(a) : false;
    meldung(ok ? "PIN gespeichert – Daten sind jetzt verschlüsselt." : "PIN konnte nicht gespeichert werden.");
    if (ok && ui.einfuehrung) {          // aus der Einfuehrung: fertig, weiter zur Sicherung
      (S.einstellungen ??= {}).einfuehrung = EINFUEHRUNG_STAND; ui.einfuehrung = null; sichern();
      meldung("PIN gespeichert. Hier kannst du noch die Sicherung einrichten."); return zeige("sicherheit");
    }
    if (ok) sichern();
    return zeichnen();
  }
  if (e.target.id === "pin-aus-form") {
    e.preventDefault();
    if (!confirm("App-Sperre ausschalten? Die Daten liegen dann wieder unverschlüsselt in der App.")) return;
    const ok = APP ? APP.sperreAufheben(String(f.get("pin") || "")) : false;
    meldung(ok ? "Sperre aus." : "Falsche PIN."); return zeichnen();
  }
  if (e.target.id === "pw-form") {
    e.preventDefault();
    const a = String(f.get("pw1") || ""), b = String(f.get("pw2") || "");
    if (a.length < 14) return meldung("Mindestens 14 Zeichen.");
    if (!passwortStark(a)) return meldung("Zu einfach – bitte Buchstaben und Zahlen mischen, keine Wiederholungen.");
    if (a !== b) return meldung("Die Passwörter sind nicht gleich.");
    const ok = APP ? APP.schluesselSetzen("sicherung", a) : false;
    meldung(ok ? "Passwort gespeichert." : "Nur in der App möglich."); return zeichnen();
  }
  if (e.target.id === "wiederherstellen-form") {
    e.preventDefault();
    if (ui.wiederherstellen.zip) {
      if (!APP?.zipLesen) return meldung("Nur in der App möglich.");
      if (!confirm("Export laden? Alle Depots in der App werden durch den Inhalt der ZIP ersetzt.")) return;
      let r = {};
      try { r = JSON.parse(APP.zipLesen(ui.wiederherstellen.zip, String(f.get("pw") || ""))); } catch { r = { fehler: "nicht lesbar" }; }
      if (r.fehler) return meldung(r.fehler === "passwort" ? "Falsches Passwort." : r.fehler === "beschaedigt" ? "Die ZIP ist beschädigt oder verändert." : "ZIP nicht lesbar: " + r.fehler);
      ui.wiederherstellen = null;
      S = alsGesamtstand(JSON.parse(r.daten)); oeffnen(S.aktiv); sichern();
      meldung(`Export geladen – ${anzahl(r.originale || 0, "Original", "Originale")} wiederhergestellt.`); return zeige("uebersicht");
    }
    const json = APP ? APP.entschluesseln(ui.wiederherstellen.text, String(f.get("pw") || "")) : "";
    if (!json) return meldung("Falsches Passwort oder beschädigte Datei.");
    ui.wiederherstellen = null;
    if (!/^\s*\{/.test(json)) {             // verschluesselter CSV-Export -> normaler Import mit Vorschau
      try { ui.seite = "daten"; ui.vorschau = erkennen(json, "export.csv"); } catch (err) { meldung(err.message); }
      return zeichnen();
    }
    let inhalt = null; try { inhalt = JSON.parse(json); } catch { /* unten */ }
    if (inhalt && inhalt.depotKompassDepot && inhalt.depot) {          // ein einzelnes geteiltes Depot -> hinzufuegen statt ersetzen
      ui.depotEmpfang = { depot: inhalt.depot, erstellt: inhalt.erstellt || "" }; return zeichnen();
    }
    if (!confirm("Vollsicherung laden? Alle Depots in der App werden ersetzt.")) return;
    S = alsGesamtstand(JSON.parse(json)); oeffnen(S.aktiv); sichern(); meldung("Sicherung wiederhergestellt."); return zeige("uebersicht");
  }
  if (e.target.id === "notiz-form") {
    e.preventDefault();
    const n = ui.notiz.id ? S.notizen.find((x) => x.id === ui.notiz.id)
      : ((S.notizen ??= []).push({ id: neueId("n"), datum: new Date().toISOString(), bezug: ui.notiz.bezug || "" }), S.notizen.at(-1));
    n.titel = String(f.get("titel") || "").trim(); n.text = String(f.get("text") || "").trim();
    if (ui.notiz.rechner) n.rechner = ui.notiz.rechner;          // Hebel-Rechnung mit speichern (Chart in der Notiz)
    if (ui.notiz.plan) n.plan = ui.notiz.plan;                   // Rechner-Plan (Positionsgroesse, Nachkauf, Gewinnmitnahme) mit speichern
    n.bezugName = bezugName(n.bezug); n.geaendert = new Date().toISOString();
    ui.notiz = null; sichern(); meldung("Notiz gespeichert."); return zeichnen();
  }
  if (e.target.dataset.schluesselForm) {
    e.preventDefault();
    const wert = String(f.get("wert") || "").trim();
    if (wert) schluesselSpeichern(e.target.dataset.schluesselForm, wert);
  }
});

// ------------------------------------------------------------ Sachwerte (0.16)
// Vermoegen ausserhalb der Depots: Kamera, Laptop, Auto, Gold im Tresor ...
// Wert = von Hand geschaetzt, sonst Kaufpreis mit jaehrlichem Wertverlust.
// Zaehlt im Gesamtvermoegen (Depots-Seite), nie im Depot-Chart.
const SACH_ARTEN = { Technik: 25, Fahrzeug: 15, "Möbel & Haushalt": 10, "Edelmetall (physisch)": 0, "Uhren & Schmuck": 0,
                     Sammlung: 0, Immobilie: 0, "Forderung / Darlehen": 0, Sonstiges: 0 };

function sachwertWert(x) {
  if (x.wert != null) return x.wert;
  const jahre = x.kaufdatum ? Math.max(0, (Date.now() - new Date(x.kaufdatum + "T12:00")) / (365.25 * 864e5)) : 0;
  return Math.max(0, (x.kaufpreis || 0) * Math.pow(1 - (x.verlust || 0) / 100, jahre));
}

function sachwerteSumme() { return (S.sachwerte || []).reduce((s, x) => s + sachwertWert(x), 0); }

function sachwerteSeite() {
  const l = S.sachwerte || [], summe = sachwerteSumme();
  const x = ui.sachwert === "neu" ? { art: "Technik", verlust: SACH_ARTEN.Technik } : l.find((y) => y.id === ui.sachwert);
  const jeArt = {};
  for (const y of l) jeArt[y.art] = (jeArt[y.art] || 0) + sachwertWert(y);
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Sachwerte</span></h2>
    <section class="karte gesamt">
      <div class="label">Sachwerte zusammen (geschätzt)</div>
      <div class="zahl">${eur(summe)}</div>
      ${Object.entries(jeArt).sort((a, b) => b[1] - a[1]).map(([a, w]) => `<div class="klein">${esc(a)}: ${eur(w)} · ${ant(summe ? w / summe * 100 : 0)}</div>`).join("")}
      <p class="klein">Geschätzte Werte – zählen im Gesamtvermögen mit.</p>
    </section>
    ${x ? `
    <form class="karte formular" id="sachwert-form">
      <label>Was<input name="name" value="${esc(x.name || "")}" required placeholder="z. B. Kamera, Laptop, Auto"></label>
      <div class="zwei"><label>Art<select name="art" id="sachwert-art">${Object.keys(SACH_ARTEN).map((a) => `<option ${x.art === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
        <label>Gekauft am<input name="kaufdatum" type="date" value="${esc(x.kaufdatum || "")}"></label></div>
      <div class="zwei"><label>Kaufpreis €<input name="kaufpreis" inputmode="decimal" value="${x.kaufpreis != null ? String(x.kaufpreis).replace(".", ",") : ""}"></label>
        <label>Wertverlust % pro Jahr<input name="verlust" id="sachwert-verlust" inputmode="decimal" value="${x.verlust != null ? String(x.verlust).replace(".", ",") : ""}"></label></div>
      <label>Heutiger Wert € (leer = aus Kaufpreis und Wertverlust)<input name="wert" inputmode="decimal" value="${x.wert != null ? String(x.wert).replace(".", ",") : ""}"></label>
      <label>Notiz<input name="notiz" value="${esc(x.notiz || "")}" placeholder="z. B. Seriennummer, Rechnung im Ordner …"></label>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        <button class="knopf" type="button" data-sachwert-weg="1">Abbrechen</button>
        ${ui.sachwert !== "neu" ? `<button class="knopf gefahr" type="button" data-sachwert-loeschen="${esc(x.id)}">Löschen</button>` : ""}</div>
    </form>` : ""}
    <section class="karte liste">
      ${l.length ? [...l].sort((a, b) => sachwertWert(b) - sachwertWert(a)).map((y) => `
        <button class="zeile" data-sachwert="${esc(y.id)}">
          <span class="mono">${{ Technik: "💻", Fahrzeug: "🚗", "Edelmetall (physisch)": "🪙", "Uhren & Schmuck": "⌚", Immobilie: "🏠", Sammlung: "🗃️" }[y.art] || "📦"}</span>
          <span style="min-width:0"><span class="titel">${esc(y.name)}</span>
            <span class="unter">${esc(y.art)}${y.kaufdatum ? " · seit " + datum(y.kaufdatum) : ""}${y.wert == null && y.verlust ? ` · −${fPct.format(y.verlust)} %/Jahr` : y.wert != null ? " · Wert von Hand" : ""}</span></span>
          <span class="rechts"><b>${eur(sachwertWert(y))}</b>${y.kaufpreis ? `<span class="klein">Kauf ${eur(y.kaufpreis, true)}</span>` : ""}</span>
        </button>`).join("") : `<p class="klein" style="margin:8px">Noch nichts eingetragen. Unten rechts auf <b>+</b>.</p>`}
    </section>
    <button class="fab" data-sachwert="neu" aria-label="Sachwert eintragen">+</button>`;
}

document.addEventListener("click", (e) => {
  const t = (s) => e.target.closest(s);
  let x;
  if ((x = t("[data-sachwert]"))) {
    ui.sachwert = x.dataset.sachwert; ui.plus = null;
    if (x.dataset.zielSeite) ui.seite = x.dataset.zielSeite;
    zeichnen(); return scrollTo(0, 0);
  }
  if (t("[data-kal-alle]")) ui.kalenderAlle = true;          // "Kalender ›" aus der Gesamtuebersicht
  if (t("[data-sachwert-weg]")) { ui.sachwert = null; return zeichnen(); }
  if ((x = t("[data-sachwert-loeschen]"))) {
    if (!confirm("Diesen Sachwert löschen?")) return;
    S.sachwerte = (S.sachwerte || []).filter((y) => y.id !== x.dataset.sachwertLoeschen); ui.sachwert = null; sichern(); return zeichnen();
  }
});
document.addEventListener("change", (e) => {
  // Art gewaehlt -> ueblichen Wertverlust vorschlagen (bleibt aenderbar)
  if (e.target.id === "sachwert-art") document.getElementById("sachwert-verlust").value = String(SACH_ARTEN[e.target.value] ?? 0);
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "sachwert-form") return;
  e.preventDefault();
  const f = new FormData(e.target);
  const neu = ui.sachwert === "neu";
  const x = neu ? { id: neueId("s") } : (S.sachwerte || []).find((y) => y.id === ui.sachwert);
  Object.assign(x, { name: String(f.get("name") || "").trim(), art: f.get("art"), kaufdatum: f.get("kaufdatum") || "",
                     kaufpreis: zahl(f.get("kaufpreis")), verlust: zahl(f.get("verlust")), wert: zahl(f.get("wert")),
                     notiz: String(f.get("notiz") || "").trim() });
  if (neu) (S.sachwerte ??= []).push(x);
  ui.sachwert = null; sichern(); meldung("Gespeichert."); zeichnen();
});

// ------------------------------------------------------------ Einstellungen (0.17)
// Jeder stellt die App fuer sich ein. Gespeichert in S.einstellungen (mit PIN verschluesselt);
// nur das Design zusaetzlich im Browser-Speicher, damit schon das PIN-Feld passt.
const KAL_ARTEN = { Dividende: "💶 Dividenden (erhalten, Zahltag)", "Ex-Dividende": "✂️ Ex-Tage mit Berechtigung", Earnings: "📊 Earnings (Quartalszahlen)",
                    "Haltefrist endet": "⏳ Haltefrist Krypto", Kauf: "🛒 Käufe", Verkauf: "🏷️ Verkäufe", Steuertermin: "🧾 Steuertermine (ohne Gewähr)", eigen: "📌 eigene Termine" };

function einstellungenSeite() {
  const e = S.einstellungen ||= {};
  const wahl = (name, aktuell, optionen) => `<div class="reiter" style="flex-wrap:wrap">${Object.entries(optionen).map(([w, t]) =>
    `<button type="button" data-einst="${name}" data-wert="${w}" class="${String(aktuell) === w ? "aktiv" : ""}">${t}</button>`).join("")}</div>`;
  const sperre = APP && APP.sicherheitStatus ? sicherheitStatus().sperreNach : null;
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Einstellungen</span></h2>
    <h2>🌐 Sprache / Language</h2>
    <section class="karte">${wahl("sprache", sprache(), SPRACHEN)}
      <p class="klein">Weitere Sprachen folgen. Zahlen und Daten bleiben vorerst im deutschen Format.</p></section>
    <h2>Design</h2>
    <section class="karte">${wahl("design", e.design || "system", { system: "wie Handy", hell: "☀️ hell", dunkel: "🌙 dunkel", schwarz: "⚫ schwarz (OLED)" })}
</section>
    <h2>Verstecken (Auge oben rechts)</h2>
    <section class="karte">${wahl("verstecken", e.verstecken || "betraege", { betraege: "nur Beträge", kurse: "+ Kurse", alles: "alles" })}
      <ul class="klein" style="padding-left:18px;margin:10px 0 0">
        <li><b>nur Beträge:</b> Positionsgrößen und dein ganzes Kapital werden ausgeblendet – du siehst alles nur in Prozent, dazu Kaufkurs und Kurs.</li>
        <li><b>+ Kurse:</b> nur noch Prozent.</li>
        <li><b>alles:</b> auch die Prozente.</li></ul></section>
    <h2>Kalender</h2>
    <section class="karte liste">
      ${Object.entries(KAL_ARTEN).map(([k, t]) => `<label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
        <span class="titel">${t}</span><input type="checkbox" data-kalart-ein="${esc(k)}" ${(e.kalAus || {})[k] ? "" : "checked"} style="width:24px;height:24px"></label>`).join("")}
    </section>
    <section class="karte">${wahl("kalTage", e.kalTage || 365, { 30: "30 Tage", 90: "3 Monate", 180: "6 Monate", 365: "12 Monate" })}
      <p class="klein">So weit schaut der Kalender voraus.</p></section>
    <h2>Depot-Anzeige</h2>
    <section class="karte">${wahl("anzeigeWaehrung", e.anzeigeWaehrung || "EUR", { EUR: "€ Euro", USD: "$ Dollar" })}
      <p class="klein">Zeigt Werte, Gewinne und Kurse im Depot in US-Dollar – umgerechnet mit dem Kurs EUR/USD vom letzten Aktualisieren. Gerechnet, gespeichert und eingegeben wird weiter in Euro. Die Rechner haben ihre eigene Währung (unten).</p>
      ${e.anzeigeWaehrung === "USD" ? (e.eurUsd?.kurs > 0 ? `<p class="klein">1 € = <b>${fZahl.format(rund(e.eurUsd.kurs, 4))}</b> $ · Stand <b>${esc(datum(e.eurUsd.datum))}</b></p>` : `<p class="klein warn-t">Noch kein Kurs EUR/USD – einmal „Kurse &amp; Daten aktualisieren“ tippen. Bis dahin bleibt die Anzeige in Euro.</p>`) : ""}</section>
    <h2>Währung der Rechner</h2>
    <section class="karte">${wahl("rechnerWaehrung", e.rechnerWaehrung || "EUR", { EUR: "€ Euro", USD: "$ Dollar", CAD: "CA$ Kanada", CHF: "CHF", GBP: "£ Pfund", USDT: "USDT" })}
      <p class="klein">Damit starten die Rechner (Hebel, Positionsgröße, Tranchen, Gewinnmitnahme). Im Rechner selbst kannst du sie jederzeit umstellen. Positionsgröße, Tranchen und Gewinnmitnahme kennen Euro und Dollar – andere Währungen rechnen dort wie Dollar ohne Umrechnung in Euro. Dein Depot bleibt in Euro.</p></section>
    <h2>Hebel-Rechner</h2>
    <section class="karte">${wahl("maxHebel", e.maxHebel || 10, { 5: "bis 5×", 10: "bis 10×", 20: "bis 20×", 50: "bis 50×" })}
      <p class="klein">So weit geht der Schieberegler. Höherer Hebel = Knock-out rückt sehr nah an den Einstieg.</p></section>
    <h2>Zusatzmodule</h2>
    <section class="karte liste">
      <label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
        <span style="min-width:0"><span class="titel">✨ KI-Zusammenfassung</span><span class="unter">Aus (Standard) = KI ist komplett ausgeblendet und nichts wird gesendet. An = unten in der Leiste erscheint „KI“: KI-Chat zu Portfolio, Einzelwerten und Watchlist über deinen Anbieter (eigener Schlüssel) – nur Name, Einstiegskurs, Long/Short (Anteile nur auf Wunsch), nie Depotbeträge, Stückzahlen oder Konten, nur auf Knopfdruck.</span></span>
        <input type="checkbox" data-modul="ki" ${e.ki ? "checked" : ""} style="width:24px;height:24px"></label>
    </section>
    <h2>Start</h2>
    <section class="karte">${wahl("startseite", e.startseite || "uebersicht", { uebersicht: "Übersicht", positionen: "Positionen", kalender: "Kalender", news: "News" })}
      <p class="klein">Welche Seite beim Öffnen kommt.</p></section>
    ${sperre != null ? `<h2>App-Sperre</h2>
    <section class="karte">${wahl("sperreNach", String(sperre), { 0: "sofort", 60: "nach 1 Min.", 300: "nach 5 Min.", 900: "nach 15 Min." })}
      <p class="klein">Wann nach dem Verlassen wieder die PIN kommt.</p></section>` : ""}`;
}

document.addEventListener("click", (ev) => {
  const x = ev.target.closest("[data-einst]");
  if (!x) return;
  const e = S.einstellungen ||= {}, k = x.dataset.einst, w = x.dataset.wert;
  if (k === "sperreNach") { if (APP && APP.sperreNachSetzen) APP.sperreNachSetzen(+w); return zeichnen(); }
  e[k] = k === "kalTage" || k === "maxHebel" ? +w : w;
  if (k === "design") designAnwenden();
  sichern(); zeichnen();
});
document.addEventListener("change", (ev) => {
  const m = ev.target.dataset?.modul;
  if (m) { (S.einstellungen ||= {})[m] = ev.target.checked; sichern(); return zeichnen(); }
  const k = ev.target.dataset?.kalartEin;
  if (k == null) return;
  const e = S.einstellungen ||= {};
  (e.kalAus ||= {})[k] = !ev.target.checked;
  sichern();
});

// ------------------------------------------------------------ Hebel-Rechner (0.28: mit Chart, 0.69: neu aufgebaut)
// Marken (Einstieg, Knock-out, Stop-Loss, Take-Profit) als Linien, Hebel per Schieberegler, Risiko mit/ohne Stop-Loss.
// 0.57: Vorgaben je Broker. Kraken Futures EU-Privatkunde: Anfangsmarge 10 % (max. 10x), wirksame Schwelle ca. 2,5 %,
//   Taker 0,05 %. Hyperliquid: Wartungsmarge 2,5 %, Taker 0,045 %.
// 0.69 (Testlogbuch 0.68, Vorgabe 21.11.2026):
//  - Zertifikat/Mini-Future als echtes Produkt: Wert je Zertifikat = (Kurs - Basispreis) x Bezugsverhaeltnis (Short umgekehrt),
//    Hebel = Einstieg / Abstand zum BASISPREIS. Mini-Future: Schwelle (Knock-out) liegt vor dem Basispreis, danach Restwert.
//  - Einsatz = was die Zertifikate kosten -> Stueckzahl (ganze Stueck). Kosten: Ordergebuehr in Euro je Order,
//    Spread (Brief - Geld), Finanzierung % p. a. ueber die Haltedauer (verschiebt Basispreis und Schwelle).
//  - "Stop" heisst Stop-Loss (= Position schliessen, Rest mitnehmen). Max.-Verlust in Euro -> Stop-Loss-Kurs (numerisch).
//  - Ergebnisse immer in Euro und Prozent. Ohne Einsatz rechnet der Rechner auf 100 Euro (nur Prozent sichtbar).
// 0.73 (Wunsch 22.11.): Knock-out-Zertifikat zuerst (meistgenutzt), Produkte ohne feste Laufzeit vor denen mit Laufzeit,
// dazu Faktor-Zertifikat, Optionsschein, Option und Future. Alte Notizen ohne "broker" bleiben Kraken-Perp (wie bisher).
const HEBEL_BROKER = [
  { key: "zertifikat", name: "Knock-out-Zertifikat / Turbo (Trade Republic, Scalable, Smartbroker …)", wartung: 0, gebuehr: 0, produkt: true },
  { key: "minifuture", name: "Mini-Future (open end)", wartung: 0, gebuehr: 0, produkt: true },
  { key: "faktor", name: "Faktor-Zertifikat (open end, fester Tageshebel)", wartung: 0, gebuehr: 0 },
  { key: "kraken", name: "Perp – Kraken Futures (open end, EU höchstens 10×)", wartung: 2.5, gebuehr: 0.05, max: 10 },
  { key: "hyperliquid", name: "Perp – Hyperliquid (open end)", wartung: 2.5, gebuehr: 0.045 },
  // 0.77: weitere Boersen. Werte = Vorgaben fuer die kleinste Stufe (Stand 23.11.2026), im Rechner aenderbar – beim Broker pruefen.
  { key: "binance", name: "Perp – Binance Futures (USDⓈ-M, open end)", wartung: 0.4, gebuehr: 0.05, anpassbar: true },
  { key: "bitunix", name: "Perp – Bitunix Futures (open end)", wartung: 0.5, gebuehr: 0.06, anpassbar: true },
  // 0.85 (Loop 3.2): Spot direkt beim Broker (Aktie, ETF, Krypto) - Gebuehr als Vorgabe 0 %, im Rechner aenderbar
  { key: "spot_broker", name: "Spot – direkt beim Broker (Aktie, ETF, Krypto · Trade Republic, Scalable …)", wartung: 0, gebuehr: 0, spot: true },
  { key: "kraken_spot", name: "Spot – Kraken (ohne Hebel, z. B. BTC/EUR, BTC/CAD)", wartung: 0, gebuehr: 0.4, spot: true },
  { key: "bitvavo", name: "Spot – Bitvavo (ohne Hebel)", wartung: 0, gebuehr: 0.25, spot: true },
  { key: "binance_spot", name: "Spot – Binance (ohne Hebel)", wartung: 0, gebuehr: 0.1, spot: true },
  { key: "bitunix_spot", name: "Spot – Bitunix (ohne Hebel)", wartung: 0, gebuehr: 0.1, spot: true },
  { key: "discount", name: "Discount-Zertifikat (mit Laufzeit, Abschlag + Cap)", option: true, discount: true },
  { key: "optionsschein", name: "Optionsschein (mit Laufzeit)", option: true },
  { key: "option", name: "Option (Börse, mit Laufzeit, Kontrakt)", option: true },
  { key: "future", name: "Future (mit Laufzeit, z. B. Eurex/CME)", wartung: null, gebuehr: null, eigeneWerte: true },
  { key: "eigen", name: "Eigene Werte", wartung: null, gebuehr: null, eigeneWerte: true },
];
const hebelBroker = (r) => HEBEL_BROKER.find((b) => b.key === (r && r.broker)) || HEBEL_BROKER.find((b) => b.key === "kraken");
const HEBEL_WARTUNG = 2.5, HEBEL_GEBUEHR = 0.05;
const HEBEL_WAEHRUNGEN = ["EUR", "USD", "CAD", "CHF", "GBP", "USDT", "USDC"];
let HW = "EUR";
const hwStandard = () => HEBEL_WAEHRUNGEN.includes(EIN().rechnerWaehrung) ? EIN().rechnerWaehrung : "EUR";
const hwSetzen = (r) => { HW = HEBEL_WAEHRUNGEN.includes(r && r.waehrung) ? r.waehrung : hwStandard(); return HW; };
const hwSym = () => ({ EUR: "€", USD: "$", CAD: "CA$", CHF: "CHF", GBP: "£" })[HW] || HW;
const hFmt = (v, st = 2) => HW === "EUR" ? (st ? fEur : fEur0).format(v) : fmt({ minimumFractionDigits: st, maximumFractionDigits: st }).format(v) + "\u00a0" + hwSym();
const hFmt0 = (v) => hFmt(v, 0);
const hGeld = (v, ganz) => HW === "EUR" ? eurFix(v, ganz) : ui.verdeckt ? "•••••\u00a0" + hwSym() : v == null || isNaN(v) ? "–" : hFmt(v, ganz ? 0 : 2);
const hGeldVz = (v) => HW === "EUR" ? eurVzFix(v) : ui.verdeckt ? "•••••\u00a0" + hwSym() : v == null ? "–" : (v > 0 ? "+" : "") + hFmt(v);
const hStk = (v, t = "") => ui.verdeckt ? "•••" : fZahl.format(rund(v, 4)) + t;   // 0.77: Stueckzahl bei „Betraege aus“ verbergen   // Vorgaben in % fuer "Eigene Werte" mit leeren Feldern

// ------------------------------------------------------------ 0.73: Optionsschein / Option (Kauf von Call oder Put)
// Gerechnet wird der Wert AM VERFALL (innerer Wert). Vor dem Verfall kommt Zeitwert dazu (Volatilitaet, Restlaufzeit) -
// den kennt nur der Emittent bzw. die Boerse; das steht ehrlich im Hinweis. Verkauf von Optionen (Stillhalter) rechnen wir nicht.
//   Optionsschein: Preis je Schein, Wert am Verfall = innerer Wert x Bezugsverhaeltnis.
//   Option:        Praemie je Aktie, Kontrakt = Kontraktgroesse (meist 100) Aktien.
function optionRechnen(r) {
  const br = hebelBroker(r), E = zahl(r.einstieg), B = zahl(r.basispreis), P = zahl(r.preis), Z = zahl(r.ziel);
  if (!(E > 0) || !(B > 0) || !(P > 0)) return null;
  const disc = !!br.discount, call = disc || r.richtung !== "short", vz = call ? 1 : -1, istOption = br.key === "option";
  const mul = istOption ? (zahl(r.kontrakt) > 0 ? zahl(r.kontrakt) : 100) : (zahl(r.bv) > 0 ? zahl(r.bv) : 1);
  const U = istOption ? P * mul : P;                                     // Preis je Stueck (Schein bzw. Kontrakt)
  const einsatz = zahl(r.einsatz) > 0 ? zahl(r.einsatz) : null, geb = Math.max(0, zahl(r.ordergebuehr) || 0);
  let n = einsatz ? Math.floor(einsatz / U + 1e-9) : 100 / U, stueckZuWenig = false;
  if (einsatz && n < 1) { n = einsatz / U; stueckZuWenig = true; }
  const investiert = n * U, gebW = einsatz ? geb : 0;
  const innerer = (x) => Math.max(0, vz * (x - B));
  // Discount: am Verfall Basiswert bis hoechstens Cap (B), mal Bezugsverhaeltnis
  const wertJe = (x) => disc ? Math.max(0, Math.min(x, B)) : innerer(x);
  const ergebnis = (x) => { const w = n * wertJe(x) * mul; return w - investiert - gebW - (w > 0 ? gebW : 0); };
  const inPct = (e) => e / (investiert + gebW) * 100;
  const be = disc ? (U + 2 * gebW / Math.max(n, 1e-9)) / mul                // Discount: Break-even = Preis / Bezugsverhaeltnis
    : B + vz * (U + 2 * gebW / Math.max(n, 1e-9)) / mul;                   // Break-even am Verfall (mit Gebuehren)
  const verfall = String(r.verfall || "").slice(0, 10), tage = /^\d{4}-\d{2}-\d{2}$/.test(verfall) ? Math.round((new Date(verfall) - new Date(heute())) / 864e5) : null;
  const gEur = Z > 0 ? ergebnis(Z) : null, maxVerlust = investiert + gebW;
  return {
    option: true, discount: disc, rabatt: disc ? (1 - U / (E * mul)) * 100 : null, maxErtragEur: disc && einsatz ? ergebnis(B) : null,
    maxErtrag: disc ? inPct(ergebnis(B)) : null, puffer: disc ? (be / E - 1) * 100 : null,
    broker: br.key, istOption, call, long: call, E, B, P, U, mul, Z, n, stueckZuWenig, investiert, einsatz, geb: gebW, be, tage, verfall,
    H: E * mul / U, innen: innerer(E) * mul, imGeld: innerer(E) > 0, beAbstand: (be / E - 1) * 100, bpAbstand: (B / E - 1) * 100,
    zielAbstand: Z > 0 ? (Z / E - 1) * 100 : null, gewinnEur: einsatz && gEur != null ? gEur : null, gewinn: gEur != null ? inPct(gEur) : null,
    maxVerlust: einsatz ? maxVerlust : null, crv: gEur > 0 ? gEur / maxVerlust : null, ohneStop: true, S: null, ko: B,
    ergebnisBei: ergebnis, inPct, r,
  };
}

function hebelRechnen(r) {
  r = r || {};
  hwSetzen(r);
  if (hebelBroker(r).option) return optionRechnen(r);
  const E = zahl(r.einstieg), Sein = zahl(r.stop), Z = zahl(r.ziel), einsatz = zahl(r.einsatz) > 0 ? zahl(r.einsatz) : null, maxV = zahl(r.maxverlust) > 0 ? zahl(r.maxverlust) : null;
  const br = hebelBroker(r), prod = !!br.produkt, eigen = !!br.eigeneWerte, spot = !!br.spot, anp = !!(br.anpassbar || br.spot);
  const long = spot || r.richtung !== "short", vz = long ? 1 : -1;     // Spot: nur kaufen
  if (!(E > 0)) return null;
  const vor = (x) => (long ? x < E : x > E);                 // Basispreis/Schwelle muessen auf der Verlustseite liegen
  // 0.84 (Verbesserungs-Loop 1.2): Hebel 1 heisst Knock-out bei 0 - KO-Linie und KO-Produkte verschwanden. Mindesthebel 1,01.
  const hebelEingabe = zahl(r.hebel) > 0 && zahl(r.hebel) < 1.01 ? 1.01 : zahl(r.hebel);
  let H = spot ? 1 : hebelEingabe, ko, B = null, koAusProdukt = false, m = 0, f = 0, d;
  if (prod) {
    const koFix = zahl(r.koFix), bpIn = zahl(r.basispreis);
    if ((koFix > 0 && !vor(koFix)) || (bpIn > 0 && !vor(bpIn))) return null;
    let K = koFix > 0 ? koFix : null;
    B = bpIn > 0 ? bpIn : null;
    koAusProdukt = !!(K || B);
    if (!B && K) {
      if (br.key === "minifuture" && H >= 1) { const bh = E * (1 - vz / H); B = long ? Math.min(bh, K) : Math.max(bh, K); }
      else B = K;                                              // Turbo: Knock-out = Basispreis
    }
    if (!B) { if (!(H >= 1)) return null; B = E * (1 - vz / H); }
    if (!K || (long ? K < B : K > B)) K = B;                   // Schwelle nie hinter dem Basispreis
    if (br.key === "zertifikat") K = B;
    H = E / Math.abs(E - B);
    ko = K; d = Math.abs(1 - ko / E);
  } else {
    if (!(H >= 1)) return null;
    // Liquidation, wenn Einsatz - Verlust - Gebuehr Eroeffnen - Gebuehr Schliessen = Wartungsmarge (bezogen auf das Volumen):
    //   long: d = (1/H - 2f - m) / (1 - f - m)   short: d = (1/H - 2f - m) / (1 + f + m)
    const leer = (w) => w == null || String(w).trim() === "";
    const wert = (feld, vorgabe, eigenVorgabe) => eigen ? (leer(r[feld]) ? eigenVorgabe : zahl(r[feld]) || 0) : anp && !leer(r[feld]) ? zahl(r[feld]) || 0 : vorgabe;
    m = spot ? 0 : Math.min(50, Math.max(0, wert("wartung", br.wartung, HEBEL_WARTUNG))) / 100;
    f = Math.min(5, Math.max(0, wert("gebuehr", br.gebuehr, HEBEL_GEBUEHR))) / 100;
    if (spot) { d = 1; ko = 0; }                                  // Spot: kein Knock-out, schlimmstenfalls faellt der Kurs auf 0
    else {
      d = Math.max(0, (1 / H - 2 * f - m) / (long ? 1 - f - m : 1 + f + m));
      ko = long ? E * (1 - d) : E * (1 + d);
    }
  }
  // --- Produkt-Kosten (nur Zertifikat/Mini-Future)
  let bv = prod ? zahl(r.bv) : null, preis = prod ? zahl(r.preis) : null, spread = prod ? Math.max(0, zahl(r.spread) || 0) : 0;
  const geb = prod ? Math.max(0, zahl(r.ordergebuehr) || 0) : 0, fin = prod ? zahl(r.finanzierung) || 0 : 0, tage = prod ? Math.max(0, zahl(r.tage) || 0) : 0;
  let aufgeld = 0, bvAbgeleitet = false;
  const abst0 = prod ? Math.abs(E - B) : 0;
  if (prod) {
    if (!(bv > 0) && preis > 0) { bv = (preis - spread / 2) / abst0; bvAbgeleitet = true; }
    else if (bv > 0 && preis > 0) aufgeld = preis - spread / 2 - abst0 * bv;
  }
  const bvBekannt = prod && bv > 0;
  const spreadIgnoriert = prod && !bvBekannt && spread > 0;
  if (prod && !bvBekannt) { bv = 1; spread = 0; }
  const fakt = prod ? fin / 100 * tage / 365 : 0;
  const Bt = prod ? B * (1 + vz * fakt) : null, Kt = prod ? ko * (1 + vz * fakt) : ko;
  const hinterKo = (x) => (long ? x <= Kt : x >= Kt);
  // Kauf: Brief je Zertifikat; Stueck = ganze Zertifikate fuer den Einsatz
  const kauf = prod ? abst0 * bv + aufgeld + spread / 2 : null;
  let n = null, investiert, stueckZuWenig = false, gebIgnoriert = false;
  if (prod) {
    if (bvBekannt && einsatz) { n = Math.floor(einsatz / kauf + 1e-9); if (n < 1) { n = einsatz / kauf; stueckZuWenig = true; } }
    else n = (einsatz || 100) / kauf;
    investiert = n * kauf;
    if (!einsatz && geb > 0) gebIgnoriert = true;
  } else investiert = einsatz || 100;
  const gebW = gebIgnoriert ? 0 : geb;
  // Perp: Produkt in % vom Einsatz bei Basiswert x, nach Gebuehren; am/hinter dem KO ist alles weg
  const wirkung = (x) => hinterKo(x) ? -100 : Math.max(-100, H * (vz * (x / E - 1) - f - f * x / E) * 100);
  // Ergebnis in Euro (auf den Einsatz bzw. 100 Euro) beim Ausstieg zum Basiswert x
  const ergebnis = (x) => {
    if (!prod) return investiert * wirkung(x) / 100;
    if (hinterKo(x)) return n * Math.max(0, vz * (Kt - Bt) * bv) - investiert - gebW;   // Knock-out: Restwert, kein Verkauf
    return n * Math.max(0, vz * (x - Bt) * bv + aufgeld - spread / 2) - investiert - 2 * gebW;
  };
  const inPct = (e) => e / investiert * 100;
  const eurSichtbar = !!einsatz;
  // --- Stop-Loss aus dem Max.-Verlust (Bisektion zwischen Einstieg und Knock-out; Ergebnis faellt monoton)
  let stopAusMax = null, maxZuKlein = false, maxUeberKo = false;
  const stopFuer = (mv) => {
    if (!(mv > 0) || !einsatz) return { s: null };
    const eps = Math.abs(E - Kt) * 1e-9;
    if (ergebnis(E) <= -mv) return { s: null, zuKlein: true };
    if (ergebnis(Kt + vz * eps) >= -mv) return { s: null, ueberKo: true };
    let a = E, b = Kt + vz * eps;
    for (let i = 0; i < 200; i++) { const mid = (a + b) / 2; if (ergebnis(mid) > -mv) a = mid; else b = mid; }
    return { s: (a + b) / 2 };
  };
  if (maxV && einsatz) { const s = stopFuer(maxV); stopAusMax = s.s; maxZuKlein = !!s.zuKlein; maxUeberKo = !!s.ueberKo; }
  const ohneStop = !!r.ohneStop;
  const stopAuto = !ohneStop && !(Sein > 0) && stopAusMax != null;
  const S = ohneStop ? null : Sein > 0 ? Sein : stopAuto ? stopAusMax : null;
  const vEur = S > 0 ? ergebnis(S) : null, gEur = Z > 0 ? ergebnis(Z) : null;
  const v = vEur != null ? inPct(vEur) : null, g = gEur != null ? inPct(gEur) : null;
  const koEur = ergebnis(Kt);
  const risikoEur0 = S > 0 ? -vEur : -koEur;                     // ohne Stop-Loss: Verlust bis zum Knock-out
  const risikoPct = Math.max(0, inPct(risikoEur0));
  // Passt der eingetragene Stop-Loss zum Max.-Verlust?
  let passt = null;
  if (Sein > 0 && !ohneStop && maxV && einsatz && vEur != null) passt = -vEur > maxV * 1.005 ? "zuweit" : -vEur < maxV * 0.8 ? "enger" : "ok";
  // Vergleich mehrerer Risikobetraege (z. B. 50 / 75 / 100 Euro)
  const vergleich = maxV && einsatz ? [1, 1.5, 2].map((k) => {
    const mv = rund(maxV * k, 2), s = stopFuer(mv).s;
    const gw = s != null && gEur != null ? gEur : null;
    return { max: mv, stop: s, abstand: s != null ? (s / E - 1) * 100 : null, crv: s != null && gw > 0 ? gw / mv : null };
  }) : [];
  const stueckFuerMax = (st) => (bvBekannt && kauf > 0 && st > 0 ? Math.floor(st / kauf + 1e-9) : null);
  const einsatzFuerMax = maxV && risikoPct > 0 ? maxV / (risikoPct / 100) : null;
  const ret = {
    spot, anpassbar: anp, waehrung: HW, koAusProdukt, hebelZuHoch: br.max && H > br.max ? br.max : null, E, H, hebelEingabe, S, Z, long, ko, koSpaeter: Kt, B, Bt, broker: br.key, produkt: prod,
    wartung: m * 100, gebuehr: f * 100, koOhne: (long ? -100 : 100) / H, koSofort: !prod && d <= 0,
    koAbstand: (ko / E - 1) * 100, bpAbstand: prod ? (B / E - 1) * 100 : null, stopAbstand: S > 0 ? (S / E - 1) * 100 : null, zielAbstand: Z > 0 ? (Z / E - 1) * 100 : null,
    verlust: v, gewinn: g, crv: gEur > 0 && risikoEur0 > 0 ? gEur / risikoEur0 : null,
    ohneStop: ohneStop || !(S > 0), stopAuto, stopAusMax, maxV, maxZuKlein, maxUeberKo, passt, vergleich,
    risikoPct, risikoEur: eurSichtbar ? risikoEur0 : null, koEur: eurSichtbar ? koEur : null, koPct: inPct(koEur),
    verlustEur: eurSichtbar && vEur != null ? vEur : null, gewinnEur: eurSichtbar && gEur != null ? gEur : null,
    einsatz, einsatzFuerMax, stueckFuerMax: einsatzFuerMax ? stueckFuerMax(einsatzFuerMax) : null,
    stueck: bvBekannt && einsatz ? n : null, stueckZuWenig, kauf: bvBekannt ? kauf : null, investiert: eurSichtbar ? investiert : null,
    bv: bvBekannt ? bv : null, bvAbgeleitet, aufgeld, spread, spreadIgnoriert, geb, gebIgnoriert, fin, tage,
    kostenEur: prod && eurSichtbar ? (bvBekannt ? n * spread : 0) + 2 * geb : null,
    stopHinterKo: S > 0 && hinterKo(S),
  };
  ret.ergebnisBei = ergebnis; ret.inPct = inPct; ret.r = r;
  return ret;
}

/** Kursverlauf des gewaehlten Basiswerts (Depot oder Watchlist), in seiner Waehrung. */
function hebelBasisListe() {
  const l = [];
  for (const [did, d] of Object.entries(S.depots))
    for (const [iid, i] of Object.entries(d.instrumente)) if ((i.verlauf?.punkte || []).length > 5 && !l.some((x) => x.name === i.name)) l.push({ key: "d:" + did + ":" + iid, name: i.name || iid, punkte: i.verlauf.punkte, ticker: i.ticker || "" });
  for (const w of S.watchlist || []) if ((w.verlauf?.punkte || []).length > 5) l.push({ key: "w:" + w.id, name: w.name, punkte: w.verlauf.punkte, ticker: w.ticker || "" });
  return l;
}
const hebelBasis = (r) => hebelBasisListe().find((b) => b.key === r.basis) || (r.basis === "frei" && r.basisFrei?.punkte?.length > 1 ? r.basisFrei : null);

// ------------------------------------------------------------ 0.70: Zeitraum im Hebel-Chart (Wunsch: laengerer Zeitstrahl fuer Support-Zonen)
// Bis 1 Jahr Tageskurse, 5 Jahre Wochenkurse. Abruf nur auf Knopfdruck, danach im Speicher (bis die App neu startet).
// Ohne Verbindung/Ticker: die gespeicherten Wochenkurse (1 Jahr) - der Text unter dem Chart sagt ehrlich, was zu sehen ist.
const HEBEL_ZEITRAEUME = { "1w": ["1W", 2], "1m": ["1M", 5], "3m": ["3M", 14], "6m": ["6M", 26], "1j": ["1J", 53], "5j": ["5J", 9999] };
const hebelZeitraum = (r) => HEBEL_ZEITRAEUME[r?.zeitraum] ? r.zeitraum : "6m";
const hebelTag = (d) => typeof d === "number" ? new Date(d * 1000).toISOString().slice(0, 10) : String(d || "").slice(0, 10);
const hebelTagKurz = (d) => { const t = hebelTag(d); return t.length === 10 ? `${t.slice(8, 10)}.${t.slice(5, 7)}.${t.slice(2, 4)}` : ""; };
function hebelKurse(r, basis) {
  const z = hebelZeitraum(r), tk = basis?.ticker || basis?.symbol || "";
  const geladen = tk && ui.hebelVerlauf?.[tk + "|" + z];
  if (geladen?.length > 1) return { punkte: geladen, z, art: z === "5j" ? "Wochenkurse" : "Tageskurse" };
  return { punkte: basis ? basis.punkte.slice(-HEBEL_ZEITRAEUME[z][1]) : [], z, art: "Wochenkurse, gespeichert" };
}
function zeitraumHolen(ticker, z) {
  if (!APP || !APP.chartZeitraum) return Promise.resolve(null);
  return new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok;
    APP.chartZeitraum(ticker, z, id);
    setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
}
async function hebelZeitraumLaden(r) {
  const basis = hebelBasis(r), tk = basis?.ticker || basis?.symbol || "", z = hebelZeitraum(r);
  ui.hebelVerlauf ||= {};
  if (!tk || ui.hebelVerlauf[tk + "|" + z]) return;
  meldung("Lade Kurse …");
  const v = (await zeitraumHolen(tk, z))?.chart?.result?.[0];
  const q0 = v?.indicators?.quote?.[0] || {}, ts = v?.timestamp || [], c = q0.close || [];
  // 0.77: [Datum, Schluss, Eroeffnung, Hoch, Tief, Volumen] - fuer Kerzen und Volumen (1W mit Uhrzeit)
  const p = ts.map((x, n) => [new Date(x * 1000).toISOString().slice(0, z === "1w" ? 16 : 10), c[n], q0.open?.[n] ?? null, q0.high?.[n] ?? null, q0.low?.[n] ?? null, q0.volume?.[n] ?? null]).filter((q) => q[1] != null);
  if (p.length > 1) ui.hebelVerlauf[tk + "|" + z] = p;
  else meldung("Keine Kurse für diesen Zeitraum – es bleiben die gespeicherten Wochenkurse.");
  zeichnen();
}
function hebelZeitraumKnoepfe(r, ziel = "rechner") {
  if (!hebelBasis(r)) return "";
  const z = hebelZeitraum(r);
  return `<div class="reiter zeitraum" style="margin:6px 0 2px">${Object.entries(HEBEL_ZEITRAEUME).map(([k, [t]]) =>
    `<button type="button" data-hebel-zeitraum="${k}" data-zeitraum-ziel="${ziel}" class="${z === k ? "aktiv" : ""}">${t}</button>`).join("")}</div>`;
}
/** Text unter dem Chart: Name, Datum von–bis, Art der Kurse, Hoch/Tief (gleicher Wortlaut wie im Hebel-Chart, Englisch per Muster). */
function zeitraumText(basis, zk) {
  const k = zk.punkte.map((p) => p[1]);
  if (!basis || k.length < 2) return "";
  const hs = zk.punkte.map((p) => p[3] > 0 ? p[3] : p[1]), ts = zk.punkte.map((p) => p[4] > 0 ? p[4] : p[1]);
  const hi = Math.max(...hs), lo = Math.min(...ts), wann = (l, v) => hebelTagKurz(zk.punkte[l.indexOf(v)][0]);
  return `<p class="klein" style="margin:2px 0 0">Linie: ${esc(basis.name)}, ${hebelTagKurz(zk.punkte[0][0])} – ${hebelTagKurz(zk.punkte.at(-1)[0])} (${zk.art}, ${k.length} Kurse) · Hoch ${hebelKurzV(hi)} am ${wann(hs, hi)} · Tief ${hebelKurzV(lo)} am ${wann(ts, lo)}.</p>`;
}

/** Aktueller Kurs: aus der Suche (r.kursJetzt), sonst letzter Punkt des gewaehlten Verlaufs. */
function hebelJetzt(r, basis) {
  if (zahl(r.kursJetzt) > 0) return zahl(r.kursJetzt);
  const b = basis || hebelBasisListe().find((x) => x.key === r.basis) || (r.basis === "frei" ? r.basisFrei : null);
  const p = b?.punkte?.at(-1)?.[1];
  return p > 0 ? p : null;
}
const hebelKurz = (v) => fZahl.format(rund(v, v >= 1000 ? 0 : v >= 100 ? 1 : v >= 1 ? 2 : 4));
// 0.77: bei „Beträge aus“ Stufe „+ Kurse“ auch die Kurse im Hebel-Chart verbergen (Prozente bleiben)
const hebelKurzV = (v) => typeof verstecktAuch === "function" && verstecktAuch("kurse") ? "•••" : hebelKurz(v);
const hebelPctKurz = (p) => (p > 0 ? "+" : "") + fPct.format(rund(p, 1)).replace(/[.,]?0+$/, "") + " %";

/** Der Chart: Kursverlauf (wenn vorhanden) + Marken mit Verlust-/Gewinnzone. Zweite Zeile je Marke: Produkt in % und Euro. */
function hebelChart(r, skala) {
  let x = hebelRechnen(r || {});
  const basis = hebelBasis(r || {});
  const zk = hebelKurse(r || {}, basis), P = zk.punkte, kurse = P.map((p) => p[1]);
  // 0.84 (Verbesserungs-Loop 1.1): ohne Einstieg/Hebel trotzdem den Kurs-Chart zeigen - nur mit der Jetzt-Linie
  if (!x) {
    const j0 = hebelJetzt(r || {}, basis);
    if (kurse.length < 2 && !(j0 > 0)) return "";
    x = { nurKurs: true, spot: true, ohneStop: true, E: j0 > 0 ? j0 : kurse.at(-1) };
    skala = null;
  }
  // 0.77: Kerzen, wenn Eroeffnung/Hoch/Tief geladen sind (bis 130 Kerzen, sonst zu duenn -> Linie); Volumen unten
  const ohlc = P.length > 1 && P.every((p) => p[2] > 0 && p[3] > 0 && p[4] > 0), kerzen = ohlc && P.length <= 130;
  const hochs = ohlc ? P.map((p) => p[3]) : kurse, tiefs = ohlc ? P.map((p) => p[4]) : kurse;
  const hoch = kurse.length > 1 ? Math.max(...hochs) : null, tief = kurse.length > 1 ? Math.min(...tiefs) : null;
  // 0.69: aktueller Kurs (aus der Suche bzw. letzter Punkt des Verlaufs) - zeigt, wie weit es noch bis zum Einstieg ist
  const jetzt = hebelJetzt(r, basis);
  const marken = (x.nurKurs ? [["Jetzt", jetzt > 0 ? jetzt : x.E, "var(--akzent)"]] : (x.discount
    ? [["Take-Profit", x.Z, "var(--plus)"], ["Cap", x.B, "var(--akzent)"], ["Einstieg", x.E, "var(--text)"], ["Break-even", x.be, "var(--warn)"]]
    : x.option
    ? [["Take-Profit", x.Z, "var(--plus)"], ["Einstieg", x.E, "var(--text)"], ["Break-even", x.be, "var(--warn)"], ["Basispreis", x.B, "var(--minus)"]]
    : [["Take-Profit", x.Z, "var(--plus)"], ["Einstieg", x.E, "var(--text)"], ["Stop-Loss", x.ohneStop ? null : x.S, "var(--warn)"], ["Knock-out", x.ko, "var(--minus)"]])
    .concat([["Jetzt", jetzt && Math.abs(jetzt / x.E - 1) > 0.0005 ? jetzt : null, "var(--akzent)"]])).filter((m) => m[1] > 0);
  const alle = [...marken.map((m) => m[1]), ...hochs, ...tiefs];
  let lo = Math.min(...alle), hi = Math.max(...alle), pad = (hi - lo) * 0.08 || hi * 0.05;
  if (skala) ({ lo, hi, pad } = skala);                         // beim Ziehen bleibt die Skala fest
  const B = 340, H = 210, L = 196, X0 = 32, y = (v) => (H - 10 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (H - 20));
  const kurz = { "Knock-out": "KO", Einstieg: "Einstieg", "Stop-Loss": "SL", "Take-Profit": "TP", Jetzt: "Jetzt", "Break-even": "BE", Basispreis: "Basispreis", Cap: "Cap" };
  const zeile2 = (t, v) => {
    if (t === "Cap") return "darüber kein Mehrgewinn";
    if (t === "Einstieg" && x.discount) return `Abschlag ${fPct.format(rund(x.rabatt, 1))} %`;
    if (t === "Einstieg") return x.option ? (x.call ? "Call" : "Put") + (x.imGeld ? " · im Geld" : " · aus dem Geld") : `Hebel ${fPct.format(rund(x.H, 2)).replace(/[.,]?0+$/, "")}×`;
    if (t === "Basispreis" && x.option) return x.call ? "darunter wertlos am Verfall" : "darüber wertlos am Verfall";
    if (t === "Jetzt" && x.nurKurs) return "aktueller Kurs";
    if (t === "Jetzt") return `bis Einstieg ${hebelPctKurz((x.E / v - 1) * 100)}`;
    const e = x.ergebnisBei(v), p = x.inPct(e);
    return `${hebelPctKurz(p)}${x.einsatz ? " · " + (ui.verdeckt ? '<tspan fill="var(--leise)">•••</tspan>' : (e > 0 ? "+" : "") + hFmt0(e)) : ""}`;
  };
  const zone = (a, b, farbe) => `<rect x="${X0}" width="${L - X0}" y="${Math.min(y(a), y(b)).toFixed(1)}" height="${Math.abs(y(a) - y(b)).toFixed(1)}" fill="${farbe}" fill-opacity=".13"/>`;
  // Labels nicht uebereinander: mindestens 22 px Abstand (zwei Zeilen)
  const lab = marken.map((m) => ({ m, yy: y(m[1]) })).sort((a2, b2) => a2.yy - b2.yy);
  for (let k = 1; k < lab.length; k++) if (lab[k].yy - lab[k - 1].yy < 22) lab[k].yy = lab[k - 1].yy + 22;
  const ziehbar = (t) => t === "Stop-Loss" || t === "Take-Profit" || t === "Einstieg";
  // 0.77: Zeitachse je Zeitraum (5J: Jahre, 6M/1J: Monate, 1W: Tage, sonst 4 Daten) + Hoch/Tief als Punkt mit Datum
  const nK = kurse.length, xK = (i) => X0 + i / Math.max(1, nK - 1) * (L - X0), zz = zk.z;
  const tag = (i) => String(P[i][0]);
  const wechsel = (n) => P.map((_, i) => i).filter((i) => i > 0 && tag(i).slice(0, n) !== tag(i - 1).slice(0, n));
  const monat = (i) => new Date(tag(i).slice(0, 10) + "T12:00:00").toLocaleDateString(LOC_DATUM(), { month: "short" }).replace(".", "");
  let striche = nK < 2 ? [] : zz === "5j" ? wechsel(4).map((i) => [i, tag(i).slice(2, 4)])
    : zz === "1j" || zz === "6m" ? wechsel(7).map((i) => [i, monat(i)])
    : zz === "1w" ? wechsel(10).map((i) => [i, tag(i).slice(8, 10) + "." + tag(i).slice(5, 7) + "."])
    : [0, Math.round((nK - 1) / 3), Math.round(2 * (nK - 1) / 3), nK - 1].filter((i, k, a2) => a2.indexOf(i) === k).map((i) => [i, hebelTagKurz(P[i][0])]);
  striche = striche.filter((st, k, a2) => k === 0 || xK(st[0]) - xK(a2[k - 1][0]) >= (zz === "1m" || zz === "3m" ? 40 : 15));
  const datum = nK > 1 ? striche.map(([i, t]) => {
      const xx = xK(i), anker = xx < X0 + 14 ? "start" : xx > L - 14 ? "end" : "middle";
      return `<line x1="${xx.toFixed(1)}" x2="${xx.toFixed(1)}" y1="${H - 2}" y2="${H + 1}" stroke="var(--leise)"/><text x="${xx.toFixed(1)}" y="${H + 9}" font-size="8" fill="var(--leise)" text-anchor="${anker}">${t}</text>`; }).join("")
    + [[hochs.indexOf(hoch), hoch, -4], [tiefs.indexOf(tief), tief, 9]].map(([i, v, dy]) => `<circle cx="${xK(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="2.2" fill="var(--leise)"/>
      <text x="${Math.min(Math.max(xK(i), X0 + 14), L - 14).toFixed(1)}" y="${(y(v) + dy).toFixed(1)}" font-size="7.5" fill="var(--leise)" text-anchor="middle">${hebelTagKurz(P[i][0]).slice(0, 5)}</text>`).join("") : "";
  // 0.77: Preisskala links (runde Werte) mit feinen Linien
  const skalaLinks = (() => {
    const u = lo - pad, o = hi + pad, roh = (o - u) / 5; if (!(roh > 0)) return "";
    const e10 = Math.pow(10, Math.floor(Math.log10(roh))), st = [1, 2, 2.5, 5, 10].map((k) => k * e10).find((k) => k >= roh);
    const w = []; for (let v = Math.ceil(u / st) * st; v <= o && w.length < 8; v += st) w.push(v);
    return w.map((v) => `<line x1="${X0}" x2="${L}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="var(--linie)" stroke-opacity=".55" stroke-width=".6"/>
      <text x="${X0 - 2}" y="${(y(v) + 2.6).toFixed(1)}" font-size="7.5" fill="var(--leise)" text-anchor="end">${hebelKurzV(v)}</text>`).join("");
  })();
  // 0.77: Kerzen + Volumen (Volumen unten, hoechstens 28 px hoch)
  const vols = P.map((p) => p[5] > 0 ? p[5] : 0), vMax = Math.max(0, ...vols);
  const bw = Math.max(1, (L - X0) / Math.max(1, nK) * 0.65);
  const volumen = nK > 1 && vMax > 0 ? P.map((p, i) => { const hh = vols[i] / vMax * 28; return hh > 0 ? `<rect x="${(xK(i) - bw / 2).toFixed(1)}" width="${bw.toFixed(1)}" y="${(H - 10 - hh).toFixed(1)}" height="${hh.toFixed(1)}" fill="${!ohlc || p[1] >= p[2] ? "var(--plus)" : "var(--minus)"}" fill-opacity=".28"/>` : ""; }).join("") : "";
  const verlauf = nK < 2 ? "" : kerzen ? P.map((p, i) => { const xx = xK(i).toFixed(1), auf = p[1] >= p[2], fa = auf ? "var(--plus)" : "var(--minus)";
      return `<line x1="${xx}" x2="${xx}" y1="${y(p[3]).toFixed(1)}" y2="${y(p[4]).toFixed(1)}" stroke="${fa}" stroke-width=".9"/><rect x="${(xK(i) - bw / 2).toFixed(1)}" width="${bw.toFixed(1)}" y="${y(Math.max(p[1], p[2])).toFixed(1)}" height="${Math.max(0.8, Math.abs(y(p[1]) - y(p[2]))).toFixed(1)}" fill="${fa}"/>`; }).join("")
    : `<polyline points="${kurse.map((k, i) => `${xK(i).toFixed(1)},${y(k).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--akzent)" stroke-width="1.6"/>`;
  return `<svg viewBox="0 0 ${B} ${Math.max(H + (datum ? 12 : 0), (lab.at(-1)?.yy || 0) + 16)}" width="100%" aria-label="Hebel-Chart mit Marken" class="hebelchart" style="touch-action:none"
      data-lo="${lo}" data-hi="${hi}" data-pad="${pad}" data-h="${H}" data-kerzen="${kerzen ? 1 : 0}" data-volumen="${volumen ? 1 : 0}">
    ${x.discount ? zone(x.be, lo - pad, "var(--minus)") + zone(x.be, x.B, "var(--plus)") : x.option ? zone(x.B, x.be, "var(--minus)") + (x.Z > 0 && (x.call ? x.Z > x.be : x.Z < x.be) ? zone(x.be, x.Z, "var(--plus)") : "") : (x.spot && (x.ohneStop || !(x.S > 0)) ? "" : zone(x.E, x.ohneStop || !(x.S > 0) ? x.ko : x.S, "var(--minus)")) + (x.Z > 0 ? zone(x.E, x.Z, "var(--plus)") : "")}
    ${skalaLinks}${volumen}${verlauf}
    ${marken.map(([t, v, f]) => `<line x1="${X0}" x2="${L}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${f}" stroke-width="${t === "Einstieg" ? 1.6 : ziehbar(t) ? 2.2 : 1.3}" ${t === "Stop-Loss" ? 'stroke-dasharray="5 3"' : t === "Jetzt" ? 'stroke-dasharray="2 3"' : ""} data-marke="${t}"/>`).join("")}
    ${jetzt > 0 ? `<circle cx="${L}" cy="${y(jetzt).toFixed(1)}" r="3.5" fill="var(--akzent)"/>` : ""}
    ${lab.map(({ m: [t, v, f], yy }) => `<text x="${L + 5}" y="${(yy + 1).toFixed(1)}" font-size="10" fill="${f}">${kurz[t]} ${hebelKurzV(v)}${t !== "Einstieg" && t !== "Jetzt" ? " (" + hebelPctKurz((v / x.E - 1) * 100) + ")" : ""}</text>
      <text x="${L + 5}" y="${(yy + 12).toFixed(1)}" font-size="8.5" fill="${f}" fill-opacity=".85">${zeile2(t, v)}</text>`).join("")}
    ${datum}
  </svg>${basis && kurse.length > 1 ? zeitraumText(basis, zk) : ""}
  ${x.nurKurs ? `<p class="klein" style="margin:2px 0 0">Kurs des Basiswerts. Mit Einstieg und Hebel erscheinen Einstieg, Stop-Loss, Take-Profit und Knock-out im Chart.</p>`
    : x.discount ? `<p class="klein" style="margin:2px 0 0">Oben: Kurs des Basiswerts (Abstand in %). Darunter: was dein Discount-Zertifikat AM VERFALL bringt (mit Gebühren). Über dem Cap bleibt der Ertrag gleich. TP lässt sich mit dem Finger verschieben.</p>`
    : x.option ? `<p class="klein" style="margin:2px 0 0">Oben: Kurs des Basiswerts (Abstand in %). Darunter: was dein ${x.istOption ? "Options-Kontrakt" : "Optionsschein"} AM VERFALL wert ist (nur innerer Wert, mit Gebühren). Vorher kommt Zeitwert dazu. TP lässt sich mit dem Finger verschieben.</p>`
    : `<p class="klein" style="margin:2px 0 0">Oben: Kurs des Basiswerts (Abstand in %). Darunter: was das für dein Produkt heißt (mit Hebel und Kosten)${x.einsatz ? "" : " – mit Einsatz auch in Euro"}. Einstieg, SL und TP lassen sich mit dem Finger verschieben.</p>`}`;
}

/** Kacheln (auch fuer das Bild): [Titel, Wert, Unterzeile, Klasse] */
function discountKacheln(x) {
  const z = (v) => verstecktAuch("kurse") ? "•••" : fZahl.format(rund(v, v >= 100 ? 2 : 4));   // 0.87 Bugliste 11
  const k = [
    ["Basiswert jetzt", z(x.E), "Discount – günstiger als direkt kaufen", ""],
    ["Cap (Höchstbetrag)", z(x.B), `${pct(x.bpAbstand)} · darüber kein Mehrgewinn`, ""],
    ["Abschlag (Discount)", fPct.format(rund(x.rabatt, 2)) + " %", "gegenüber dem Basiswert", "plus-t"],
    ["Break-even am Verfall", z(x.be), `Puffer ${pct(x.puffer)} Basiswert`, "warn-t"],
    ["Preis je Zertifikat", hGeld(x.U), `Bezugsverhältnis ${fZahl.format(x.mul)}`, ""],
    ["Höchster Ertrag", `${x.maxErtragEur != null ? hGeldVz(x.maxErtragEur) + " · " : ""}${pct(x.maxErtrag)}`, "wenn der Basiswert am Verfall auf/über dem Cap steht", "plus-t"],
    ["Take-Profit", x.Z ? z(x.Z) : "–", x.Z ? `${pct(x.zielAbstand)} Basiswert` : "Ziel eintragen", x.Z ? "plus-t" : ""],
    ["Ergebnis am Take-Profit", x.gewinn != null ? `${x.gewinnEur != null ? hGeldVz(x.gewinnEur) + " · " : ""}${pct(x.gewinn)}` : "–", "am Verfall", x.gewinn > 0 ? "plus-t" : x.gewinn < 0 ? "minus-t" : ""],
    ["Höchster Verlust", x.maxVerlust != null ? hGeldVz(-x.maxVerlust) + " · −100 %" : "−100 %", "nur wenn der Basiswert auf 0 fällt", "minus-t"],
  ];
  if (x.einsatz) k.push(["Stückzahl", hStk(x.n), `= ${hGeld(x.investiert)}`, ""]);
  if (x.tage != null) k.push(["Restlaufzeit", x.tage >= 0 ? `${fZahl.format(x.tage)} Tage` : "abgelaufen", x.verfall, ""]);
  return k;
}

function optionKacheln(x) {
  if (x.discount) return discountKacheln(x);
  const z = (v) => verstecktAuch("kurse") ? "•••" : fZahl.format(rund(v, v >= 100 ? 2 : 4));   // 0.87 Bugliste 11
  const k = [
    ["Basiswert jetzt", z(x.E), x.call ? "Call – gewinnt, wenn er steigt" : "Put – gewinnt, wenn er fällt", ""],
    ["Basispreis", z(x.B), `${pct(x.bpAbstand)} · ${x.imGeld ? "im Geld" : "aus dem Geld"}`, ""],
    ["Break-even am Verfall", z(x.be), `${pct(x.beAbstand)} Basiswert nötig`, "warn-t"],
    [x.istOption ? "Prämie je Kontrakt" : "Preis je Schein", hGeld(x.U), x.istOption ? `${fZahl.format(x.mul)} × ${hFmt(x.P)}` : `Bezugsverhältnis ${fZahl.format(x.mul)}`, ""],
    ["Take-Profit", x.Z ? z(x.Z) : "–", x.Z ? `${pct(x.zielAbstand)} Basiswert` : "Ziel eintragen", x.Z ? "plus-t" : ""],
    ["Ergebnis am Take-Profit", x.gewinn != null ? `${x.gewinnEur != null ? hGeldVz(x.gewinnEur) + " · " : ""}${pct(x.gewinn)}` : "–", "am Verfall", x.gewinn > 0 ? "plus-t" : x.gewinn < 0 ? "minus-t" : ""],
    ["Höchster Verlust", x.maxVerlust != null ? hGeldVz(-x.maxVerlust) + " · −100 %" : "−100 %", "Prämie + Gebühren – mehr nicht", "minus-t"],
    ["Chance : Risiko", x.crv ? fPct.format(x.crv) + " : 1" : "–", "am Verfall", ""],
  ];
  if (x.einsatz) k.push([x.istOption ? "Kontrakte" : "Stückzahl", hStk(x.n), `= ${hGeld(x.investiert)}`, ""]);
  if (x.tage != null) k.push(["Restlaufzeit", x.tage >= 0 ? `${fZahl.format(x.tage)} Tage` : "abgelaufen", x.verfall, x.tage < 30 ? "warn-t" : ""]);
  return k;
}

/** Kacheln (auch fuer das Bild): [Titel, Wert, Unterzeile, Klasse] */
function hebelKacheln(x) {
  if (x.option) return optionKacheln(x);
  const z = (v) => verstecktAuch("kurse") ? "•••" : fZahl.format(rund(v, v >= 100 ? 2 : 4));   // 0.87 Bugliste 11
  const eurPct = (e, p) => `${e != null ? hGeldVz(e) + " · " : ""}${pct(p)}`;
  const j = hebelJetzt(x.r || {});
  const k = [
    ["Einstieg", z(x.E), j ? `Jetzt ${z(j)} · bis Einstieg ${pct((x.E / j - 1) * 100)}` : "Basiswert", ""],
    x.spot ? ["Hebel", "1× (Spot)", "ohne Hebel, kein Knock-out", ""] : ["Hebel", fPct.format(rund(x.H, 2)) + "×", x.produkt ? (x.koAusProdukt ? "aus dem Basispreis laut Produkt" : "Basispreis " + z(x.B)) : x.long ? "Long" : "Short", ""],
    ["Stop-Loss", x.ohneStop ? "ohne" : z(x.S), x.ohneStop ? (x.spot ? "Risiko: bis der Kurs auf 0 fällt" : "Risiko: alles bis zum Knock-out") : `${pct(x.stopAbstand)} Basiswert${x.stopAuto ? " · aus deinem Max.-Verlust" : ""}`, x.ohneStop ? "" : "warn-t"],
    ["Take-Profit", x.Z ? z(x.Z) : "–", x.Z ? `${pct(x.zielAbstand)} Basiswert` : "Gewinnziel eintragen", x.Z ? "plus-t" : ""],
    x.spot ? ["Gebühr je Seite", fPct.format(rund(x.gebuehr, 3)) + " %", "Vorgabe – beim Broker prüfen", ""] : [x.koAusProdukt ? "Knock-out laut Produkt" : x.broker === "faktor" ? "Totalverlust-Grenze (vereinfacht)" : "Knock-out ca.", z(x.ko), `${pct(x.koAbstand)} entfernt`, "minus-t"],
    ["Gewinn am Take-Profit", x.gewinn != null ? eurPct(x.gewinnEur, x.gewinn) : "–", "Produkt", "plus-t"],
    ["Verlust am Stop-Loss", !x.ohneStop && x.verlust != null ? eurPct(x.verlustEur, x.verlust) : x.risikoEur != null ? hGeldVz(-x.risikoEur) + " · " + pct(-x.risikoPct) : pct(-x.risikoPct), !x.ohneStop ? "Produkt" : x.spot ? "bis auf 0" : "bis zum Knock-out", "minus-t"],
    ["Chance : Risiko", x.crv ? fPct.format(x.crv) + " : 1" : "–", "", ""],
  ];
  if (x.stueck != null) k.push(["Stückzahl", hStk(x.stueck, " Stück"), `je ${verstecktAuch("kurse") ? "•••" : hFmt(x.kauf)} = ${hGeld(x.investiert)}${x.bvAbgeleitet ? " · Bezugsverhältnis aus dem Preis" : ""}`, ""]);
  if (x.kostenEur) k.push(["Kosten", hGeld(x.kostenEur), "Spread + Ordergebühren (Kauf und Verkauf)", ""]);
  if (x.einsatzFuerMax != null && !x.ohneStop && !x.stopAuto) k.push(["Einsatz für deinen Max.-Verlust", hGeld(x.einsatzFuerMax), x.stueckFuerMax != null && !ui.verdeckt ? "= " + fZahl.format(x.stueckFuerMax) + " Stück" : "", ""]);
  return k;
}

function hebelZahlen(x) {
  const z = (v) => verstecktAuch("kurse") ? "•••" : fZahl.format(rund(v, v >= 100 ? 2 : 4));   // 0.87 Bugliste 11
  const hin = [];
  if (x.option) {
    if (x.stueckZuWenig) hin.push(x.istOption ? "Der Einsatz reicht nicht für einen ganzen Kontrakt." : "Der Einsatz reicht nicht für einen ganzen Schein.");
    if (x.tage != null && x.tage < 30) hin.push("Weniger als 30 Tage bis zum Verfall: Der Zeitwert schmilzt jetzt besonders schnell.");
    if (!x.imGeld && !x.discount) hin.push(`Aus dem Geld: Bleibt der Basiswert bis zum Verfall ${x.call ? "unter" : "über"} dem Basispreis, ist alles weg.`);
    if (x.discount && x.E > x.B) hin.push("Der Basiswert steht schon über dem Cap: mehr als der höchste Ertrag ist nicht drin.");
    return `<div class="kennzahlen">${optionKacheln(x).map(([t, w, u, c]) => `<div><small>${t}</small><b class="${c}">${w}</b>${u ? `<small>${u}</small>` : ""}</div>`).join("")}</div>
      ${hin.map((h) => `<p class="warn-t klein">${h}</p>`).join("")}`;
  }
  if (x.koSofort) hin.push("Bei diesem Hebel fressen Wartungsmarge und Gebühren den ganzen Einsatz – die Position wäre sofort weg.");
  if (x.stopHinterKo) hin.push("Der Stop-Loss liegt hinter dem Knock-out – vorher wäre schon alles weg.");
  if (x.anpassbar && !x.spot) hin.push("Wartungsmarge und Gebühr sind Vorgaben für die kleinste Stufe – die genauen Werte zeigt die Börse (Margin-Stufen, Gebührenseite). In der EU sind manche Perps für Privatkunden nicht erhältlich.");
  if (x.hebelZuHoch) hin.push(`Kraken Futures erlaubt EU-Privatkunden höchstens ${x.hebelZuHoch}× Hebel.`);
  if (x.maxV && !x.einsatz) hin.push("Für den Stop-Loss aus deinem Max.-Verlust fehlt noch der Einsatz (was du für das Produkt bezahlst).");
  if (x.maxZuKlein) hin.push("Dein Max.-Verlust ist kleiner als Spread und Gebühren – schon direkt nach dem Kauf wärst du darüber.");
  if (x.maxUeberKo) hin.push("Dein Max.-Verlust ist größer als alles, was du bis zum Knock-out verlieren kannst – ein Stop-Loss ist dafür nicht nötig.");
  if (x.passt === "zuweit") hin.push(`Dein Stop-Loss passt nicht zum Max.-Verlust: dort verlierst du ${hGeld(-x.verlustEur)} statt höchstens ${hGeld(x.maxV)}.`);
  if (x.stueckZuWenig) hin.push("Der Einsatz reicht nicht für ein ganzes Zertifikat.");
  if (x.spreadIgnoriert) hin.push("Der Spread zählt erst mit Bezugsverhältnis oder Preis je Zertifikat.");
  if (x.gebIgnoriert) hin.push("Die Ordergebühr zählt erst mit Einsatz.");
  const vorschlag = x.stopAusMax != null && !x.stopAuto && Math.abs(x.stopAusMax - (x.S || 0)) / x.E > 0.0005
    ? `<div class="karte" style="margin:8px 0;padding:8px"><span>Stop-Loss für ${hGeld(x.maxV)} Max.-Verlust:</span> <b>${z(x.stopAusMax)}</b> <span>(${pct((x.stopAusMax / x.E - 1) * 100)} Basiswert)</span>
       <button class="knopf klein" type="button" data-rechner-stop-uebernehmen="${x.stopAusMax}">übernehmen</button></div>` : "";
  const vgl = x.vergleich.filter((w) => w.stop != null).length > 1 ? `<details class="legende" open><summary>Risiko vergleichen</summary>
      <table class="tabelle"><tr><th>Max.-Verlust</th><th>Stop-Loss</th><th>Abstand</th><th>Chance : Risiko</th></tr>
      ${x.vergleich.map((w) => `<tr><td>${hGeld(w.max)}</td><td>${w.stop != null ? z(w.stop) : "–"}</td><td>${w.abstand != null ? pct(w.abstand) : "–"}</td><td>${w.crv ? fPct.format(w.crv) + " : 1" : "–"}</td></tr>`).join("")}</table></details>` : "";
  return `
    <div class="kennzahlen">${hebelKacheln(x).map(([t, w, u, c]) => `<div><small>${t}</small><b class="${c}">${w}</b>${u ? `<small>${u}</small>` : ""}</div>`).join("")}</div>
    ${hin.map((h) => `<p class="warn-t klein">${h}</p>`).join("")}${vorschlag}${vgl}`;
}

function hebelErgebnis() {
  const r = ui.rechner || {}, x = hebelRechnen(r);
  if (!x) return `${hebelZeitraumKnoepfe(r)}${hebelChart(r)}` + (hebelBroker(r).option ? `<p class="klein" style="margin:8px 0 0">Basiswert-Kurs, Basispreis und Preis (Prämie) eintragen.</p>`
    : `<p class="klein" style="margin:8px 0 0">Einstieg und Hebel (oder Basispreis/Knock-out laut Produkt) eintragen.</p>`);   // 0.84: Chart auch ohne Hebel
  if (x.discount) return `${hebelZeitraumKnoepfe(r)}${hebelChart(r, ui.hebelSkala)}${hebelZahlen(x)}
    <p class="klein">Discount-Zertifikat: gerechnet wird der Wert am Verfall – Basiswert bis höchstens zum Cap, mal Bezugsverhältnis. Du kaufst mit Abschlag (Puffer nach unten), dafür ist der Gewinn beim Cap gedeckelt. Vor dem Verfall schwankt der Preis mit Volatilität und Restlaufzeit. Kein Knock-out, aber Emittentenrisiko. Keine Anlageberatung.</p>
    <button class="knopf" type="button" data-hebel-bild="rechner" style="width:100%">📷 Als Bild teilen (Chart + Zahlen)</button>`;
  if (x.option) return `${hebelZeitraumKnoepfe(r)}${hebelChart(r, ui.hebelSkala)}${hebelZahlen(x)}
    <p class="klein">${x.istOption ? "Option" : "Optionsschein"}: gerechnet wird nur der Wert am Verfall (innerer Wert). Vor dem Verfall hängt der Preis zusätzlich von Volatilität und Restlaufzeit ab (Zeitwert) – den echten Preis zeigt der Emittent bzw. die Börse. Verlieren kannst du höchstens, was du bezahlt hast. Optionen verkaufen (Stillhalter) rechnet die App nicht. Keine Anlageberatung.</p>
    <button class="knopf" type="button" data-hebel-bild="rechner" style="width:100%">📷 Als Bild teilen (Chart + Zahlen)</button>`;
  const faktorHinweis = x.broker === "faktor" ? "Faktor-Zertifikat vereinfacht wie ein fester Hebel: Der Emittent stellt den Hebel täglich neu ein – bei Seitwärts- und Zickzack-Kursen verlierst du dadurch zusätzlich (Pfadabhängigkeit). Statt Knock-out schützt meist eine Reset-Schwelle vor dem Totalverlust an einem Tag." : "";
  const kosten = x.produkt
    ? `Zertifikat: Wert = Abstand Kurs ↔ Basispreis × Bezugsverhältnis. Ordergebühr ${fZahl.format(rund(x.geb, 2))} ${hwSym()} je Order, Spread ${fZahl.format(x.spread)} ${hwSym()}, Finanzierung ${fPct.format(x.fin)} % p. a. über ${fZahl.format(x.tage)} Tage${x.tage ? ` (Knock-out dann ca. ${fZahl.format(rund(x.koSpaeter, 2))})` : ""}.`
    : x.spot ? `Spot ohne Hebel: Gebühr ${fPct.format(rund(x.gebuehr, 3))} % je Seite (Vorgabe, beim Broker prüfen). Kein Knock-out – im schlimmsten Fall fällt der Kurs auf 0. Beträge in ${x.waehrung}.`
    : `Knock-out nach Wartungsmarge ${fPct.format(x.wartung)} % und Gebühr ${fPct.format(x.gebuehr)} % je Seite: ${pct(x.koAbstand)} statt ${pct(x.koOhne)} (reine Rechnung 1/Hebel).`;
  return `${hebelZeitraumKnoepfe(r)}${hebelChart(r, ui.hebelSkala)}${hebelZahlen(x)}
    ${faktorHinweis ? `<p class="klein warn-t">${faktorHinweis}</p>` : ""}<p class="klein">${kosten} Ein Stop-Loss ist kein garantierter Preis: bei Kurslücken oder schnellen Bewegungen kann der Verlust größer sein. Den echten Knock-out zeigt der Emittent bzw. die Börse. Keine Anlageberatung.</p>
    <button class="knopf" type="button" data-hebel-bild="rechner" style="width:100%">📷 Als Bild teilen (Chart + Zahlen)</button>`;
}

function hebelRechner() {
  const r = ui.rechner ||= { richtung: "long" };   // 0.87: broker erst aus der gemerkten Wahl (Bugliste 6)
  if (!r.broker && !r.einstieg && !r.titel && !r.basisFrei) r.broker = EIN().rechnerMarkt === "spot" ? "spot_broker" : "zertifikat";   // 0.85: letzte Wahl Hebel/Spot
  hwSetzen(r);
  if (!ui.rechnerOffen) return `<section class="karte"><button class="knopf" data-rechner-auf="1" style="width:100%">🧮 Hebel-Rechner mit Chart (Knock-out, Stop-Loss, Take-Profit)</button></section>`;
  const f = (n, t, ph) => `<label>${HW === "EUR" ? t : t.replace(/€/g, hwSym())}<input data-rechner="${n}" inputmode="decimal" value="${esc(r[n] || "")}" placeholder="${ph}"${["einsatz", "maxverlust", "ordergebuehr"].includes(n) ? rechnerGeheim() : ""}></label>`;   // 0.87 Bugliste 8
  const basen = hebelBasisListe(), br = hebelBroker(r);
  return `
    <section class="karte formular">
      <div style="display:flex;justify-content:space-between;align-items:center"><b>🧮 Hebel-Rechner</b>
        <button class="knopf klein" data-rechner-auf="0">schließen</button></div>
      ${legende(["<b>Hebel</b> 5 heißt: bewegt sich der Basiswert 1 %, bewegt sich dein Produkt etwa 5 %. Der Hebel ändert sich mit dem Kurs.",
        "<b>Basispreis</b> = daran rechnet der Emittent den Wert: Wert je Zertifikat = (Kurs − Basispreis) × Bezugsverhältnis (bei Short umgekehrt).",
        "<b>Knock-out</b> = bei diesem Kurs endet das Produkt. Beim Turbo ist dann alles weg, beim Mini-Future gibt es oft noch einen Restwert.",
        "<b>Bezugsverhältnis</b> 0,01 heißt: ein Zertifikat steht für 1/100 des Basiswerts. Steht im Produktblatt und beim Broker.",
        "<b>Spread</b> = Unterschied zwischen Kaufkurs (Brief) und Verkaufskurs (Geld) – kostet dich beim Ein- und Ausstieg.",
        "<b>Finanzierung</b> = Kosten des Emittenten, verschieben Basispreis und Knock-out jeden Tag ein Stück zu deinem Nachteil.",
        "<b>Wartungsmarge</b> (Perp) = Rest, den die Börse behält – deshalb liegt der Knock-out bei 10× nicht 10 %, sondern etwa 7,5–8 % entfernt.",
        "<b>Stop-Loss</b> = dein Ausstieg: Position wird geschlossen, du nimmst den Rest mit – vor dem Knock-out.", "<b>Take-Profit</b> = dein Gewinnziel.",
        "<b>Max.-Verlust</b>: trag ein, wie viel Euro du höchstens verlieren willst – der Rechner zeigt den passenden Stop-Loss-Kurs.",
        "<b>Chance : Risiko</b> 2 : 1 heißt: doppelt so viel Gewinn am Take-Profit wie Verlust am Stop-Loss.",
        "Im Chart: grün = Take-Profit, gestrichelt = Stop-Loss, rot = Knock-out. Kurslücken können den Stop-Loss überspringen."], "ℹ️ Begriffe erklärt")}
      <label>Name<input data-rechner="titel" value="${esc(r.titel || "")}" placeholder="z. B. Bitcoin Boden long"></label>
      <div class="reiter"><button type="button" data-rechner-markt="hebel" class="${br.spot ? "" : "aktiv"}">⚡ Hebel & Derivate</button><button type="button" data-rechner-markt="spot" class="${br.spot ? "aktiv" : ""}">🪙 Spot (ohne Hebel)</button></div>
      <label>Produktart / Broker<select data-rechner-broker>${HEBEL_BROKER.filter((b) => !!b.spot === !!br.spot).map((b) => `<option value="${b.key}" ${br.key === b.key ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>
      <label>Währung für Einsatz und Ergebnis<select data-rechner-waehrung>${HEBEL_WAEHRUNGEN.map((w) => `<option value="${w}" ${HW === w ? "selected" : ""}>${w}</option>`).join("")}</select></label>
      ${br.discount || br.spot ? "" : `<div class="reiter"><button type="button" data-rechner-richtung="long" class="${r.richtung !== "short" ? "aktiv" : ""}">${br.option ? "Call (steigt)" : "Long"}</button>
        <button type="button" data-rechner-richtung="short" class="${r.richtung === "short" ? "aktiv" : ""}">${br.option ? "Put (fällt)" : "Short"}</button></div>`}
      <div class="reiter zeitraum" style="margin:2px 0 0">${SUCH_ARTEN.map(([k, t]) => `<button type="button" data-rechner-suchart="${k}" class="${(r.sucheArt || "alle") === k ? "aktiv" : ""}">${t}</button>`).join("")}</div>
      <div class="zwei"><label>Basiswert suchen (Name, ISIN, WKN)<input data-rechner="suche" value="${esc(r.suche || "")}" placeholder="z. B. Bitcoin, Nvidia, DAX"></label>
        <button class="knopf" type="button" data-rechner-suchen="1" style="align-self:end">🔎 Suchen</button></div>
      ${(ui.rechnerTreffer || []).length ? `<div class="karte liste" style="margin:0">${ui.rechnerTreffer.map((t, i) => `<button type="button" class="zeile" data-rechner-treffer="${i}" style="grid-template-columns:1fr auto">
        <span><span class="titel">${esc(t.name)}</span><span class="unter">${t.artDe ? `<b>${esc(t.artDe)}</b> · ` : ""}${esc(t.symbol)}${t.boerse ? " · " + esc(t.boerse) : ""}${!t.artDe && t.art ? " · " + esc(t.art) : ""}</span></span><span class="rechts">›</span></button>`).join("")}</div>` : ""}
      ${r.basisFrei ? `<p class="klein" style="margin:0"><span>Basiswert:</span> <b>${esc(r.basisFrei.name)}</b> <span>${esc(r.basisFrei.symbol)}${r.basisFrei.waehrung ? " · " + esc(r.basisFrei.waehrung) : ""}</span>${r.kursAktuell ? `<br><span>Aktueller Kurs:</span> <b>${verstecktAuch("kurse") ? "•••" : esc(r.kursAktuell)}</b>${r.kursDatum ? ` <span>(${esc(datum(r.kursDatum))})</span>` : ""}` : ""}<br><span>Einstieg selbst ändern, z. B. wenn du erst tiefer kaufen willst.</span></p>` : ""}
      ${r.basisFrei && hebelKryptoPaar(r.basisFrei.symbol) ? `<div class="reiter zeitraum" style="margin:2px 0 0"><span class="klein" style="align-self:center">Paar:</span>${KRYPTO_PAARE.map((q) =>
        `<button type="button" data-rechner-paar="${q}" class="${hebelKryptoPaar(r.basisFrei.symbol)[1] === q ? "aktiv" : ""}">${esc(hebelKryptoPaar(r.basisFrei.symbol)[0])}/${q}</button>`).join("")}</div>` : ""}
      ${basen.length || r.basisFrei ? `<label>Kursverlauf im Chart (optional)<select data-rechner-basis><option value="">– nur Marken –</option>${r.basisFrei ? `<option value="frei" ${r.basis === "frei" ? "selected" : ""}>🔎 ${esc(r.basisFrei.name)}</option>` : ""}${basen.map((b) =>
        `<option value="${esc(b.key)}" ${r.basis === b.key ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>` : ""}
      ${br.discount ? `<div class="zwei">${f("einstieg", "Basiswert-Kurs jetzt", "z. B. 180")}${f("basispreis", "Cap (Höchstbetrag)", "z. B. 190")}</div>
      <div class="zwei">${f("preis", "Preis je Zertifikat € (Brief)", "z. B. 16,20")}${f("bv", "Bezugsverhältnis", "z. B. 0,1")}</div>
      <div class="zwei"><label>Verfall<input type="date" data-rechner="verfall" value="${esc(r.verfall || "")}"></label>${f("ziel", "Take-Profit (Basiswert)", "optional")}</div>
      <div class="zwei">${f("einsatz", "Einsatz € (was du bezahlst)", "z. B. 1000")}${f("ordergebuehr", "Ordergebühr € je Order", "z. B. 1")}</div>
      <p class="klein" style="margin:0">Discount-Zertifikat: du kaufst den Basiswert mit Abschlag, der Ertrag ist beim Cap gedeckelt. Mit Laufzeit – Preis, Cap und Bezugsverhältnis stehen im Produktblatt.</p>`
      : br.option ? `<div class="zwei">${f("einstieg", "Basiswert-Kurs jetzt", "z. B. 180")}${f("basispreis", "Basispreis (Strike)", "z. B. 200")}</div>
      <div class="zwei">${br.key === "option" ? f("preis", "Prämie je Aktie €", "z. B. 4,20") + f("kontrakt", "Kontraktgröße", "100") : f("preis", "Preis je Schein € (Brief)", "z. B. 0,85") + f("bv", "Bezugsverhältnis", "z. B. 0,1")}</div>
      <div class="zwei"><label>Verfall<input type="date" data-rechner="verfall" value="${esc(r.verfall || "")}"></label>${f("ziel", "Take-Profit (Basiswert)", "optional")}</div>
      <div class="zwei">${f("einsatz", "Einsatz € (was du bezahlst)", "z. B. 300")}${f("ordergebuehr", "Ordergebühr € je Order", "z. B. 1")}</div>
      <p class="klein" style="margin:0">${br.key === "option" ? "Option: an der Börse (z. B. Eurex), 1 Kontrakt = meist 100 Aktien. Prämie je Aktie steht beim Broker." : "Optionsschein: vom Emittenten, Preis und Bezugsverhältnis stehen im Produktblatt."} Mit Laufzeit – am Verfall zählt nur der innere Wert.</p>`
      : `
      <div class="zwei">${f("einstieg", br.spot ? "Kaufkurs" : "Einstieg (Basiswert)", "z. B. 42.000")}${br.spot ? f("gebuehr", "Gebühr % je Seite", fZahl.format(br.gebuehr)) : f("hebel", br.produkt ? "Hebel (leer = aus Basispreis)" : "Hebel", "z. B. 5")}</div>
      ${br.spot ? "" : `<label><span>Hebel ziehen: <b id="hebel-wert">${esc(r.hebel || "1")}</b>×</span><input type="range" min="1" max="${EIN().maxHebel || 10}" step="0.5" data-rechner="hebel" value="${esc(String(zahl(r.hebel) || 1))}" style="width:100%"></label>`}
      ${br.produkt ? `<div class="zwei">${f("basispreis", "Basispreis laut Produkt (optional)", "z. B. 33.600")}${f("koFix", br.key === "minifuture" ? "Knock-out-Schwelle laut Produkt (optional)" : "Knock-out laut Produktblatt (optional)", "z. B. 34.500")}</div>` : ""}
      <div class="zwei">${f("stop", "Stop-Loss (leer = aus Max.-Verlust)", "optional")}${f("ziel", "Take-Profit", "optional")}</div>
      <div class="reiter"><button type="button" data-rechner-stop="mit" class="${r.ohneStop ? "" : "aktiv"}">mit Stop-Loss</button>
        <button type="button" data-rechner-stop="ohne" class="${r.ohneStop ? "aktiv" : ""}">${br.spot ? "ohne Stop-Loss" : "ohne Stop-Loss (bis Knock-out)"}</button></div>
      <div class="zwei">${f("einsatz", br.produkt ? "Einsatz € (was die Zertifikate kosten)" : br.spot ? "Einsatz € (was du kaufst)" : "Einsatz € (Marge)", "z. B. 500")}${f("maxverlust", "Max. Verlust €", "z. B. 50")}</div>
      ${br.eigeneWerte ? `<div class="zwei">${f("wartung", "Wartungsmarge %", fZahl.format(HEBEL_WARTUNG))}${f("gebuehr", "Gebühr % je Seite", fZahl.format(HEBEL_GEBUEHR))}</div>
      ${br.key === "future" ? `<div class="zwei"><label>Verfall (optional)<input type="date" data-rechner="verfall" value="${esc(r.verfall || "")}"></label><span></span></div>
      <p class="klein" style="margin:0">Future: mit Laufzeit – vor dem Verfall musst du ihn schließen oder in den nächsten Monat rollen (kostet). Margin und Gebühren stehen bei deiner Börse bzw. deinem Broker.</p>` : ""}
      <p class="klein" style="margin:0">Leer = Vorgabe ${fZahl.format(HEBEL_WARTUNG)} % / ${fZahl.format(HEBEL_GEBUEHR)} %. Die genauen Werte stehen bei deiner Börse (Margin- und Gebührenseite).</p>`
        : br.produkt ? `<details class="legende" ${r.produkt || r.bv || r.preis ? "open" : ""}><summary>Produktdaten und Kosten (aus dem Produktblatt / Broker)</summary>
      <div class="zwei">${f("produkt", "Produkt (WKN/ISIN, optional)", "z. B. aus dem Broker")}${f("preis", "Preis je Zertifikat € (Brief)", "z. B. 8,42")}</div>
      <div class="zwei">${f("bv", "Bezugsverhältnis", "z. B. 0,01")}${f("spread", "Spread € (Brief − Geld)", "z. B. 0,01")}</div>
      <div class="zwei">${f("ordergebuehr", "Ordergebühr € je Order", "z. B. 1")}${f("finanzierung", "Finanzierung % p. a.", "z. B. 5")}</div>
      <div class="zwei">${f("tage", "Haltedauer Tage", "z. B. 10")}<span></span></div>
      <p class="klein" style="margin:0">${br.key === "minifuture" ? "Mini-Future: ohne Laufzeit (anders als ein Future) – du kannst jederzeit zum aktuellen Kurs verkaufen, es gibt keinen Verfall. Knock-out-Schwelle und Basispreis werden täglich um die Finanzierungskosten angepasst." : "Knock-out-Zertifikat (Turbo): Knock-out = Basispreis, der Hebel ändert sich mit dem Kurs."} Preis je Zertifikat reicht – das Bezugsverhältnis rechnet der Rechner dann selbst (auch bei Dollar-Basiswerten).</p></details>`
        : br.spot ? `<p class="klein" style="margin:0">Spot: du kaufst den Basiswert direkt, ohne Hebel und ohne Knock-out. Leer = Vorgabe ${fZahl.format(br.gebuehr)} % Gebühr (Taker, kleinste Stufe, Stand 23.11.2026) – beim Broker prüfen. Kurs und Einsatz in der Währung des Paares eintragen, z. B. BTC/CAD in CAD.</p>`
        : br.anpassbar ? `<div class="zwei">${f("wartung", "Wartungsmarge %", fZahl.format(br.wartung))}${f("gebuehr", "Gebühr % je Seite", fZahl.format(br.gebuehr))}</div>
      <p class="klein" style="margin:0">Leer = Vorgabe ${fZahl.format(br.wartung)} % / ${fZahl.format(br.gebuehr)} % (kleinste Stufe, Stand 23.11.2026). Den genauen Liquidationspreis zeigt ${esc(br.name.replace(/ \(.*\)$/, "").replace(/^Perp – /, ""))} beim Eröffnen.</p>`
        : br.key === "faktor" ? `<p class="klein" style="margin:0">Faktor-Zertifikat: ohne Laufzeit, fester Hebel je Tag (z. B. Faktor 3). Kein klassischer Knock-out – der Rechner zeigt die rechnerische Totalverlust-Grenze ohne Tages-Reset.</p>`
        : `<p class="klein" style="margin:0">Vorgabe: Liquidation bei ${fZahl.format(br.wartung)} % Restmarge, Gebühr ${fZahl.format(br.gebuehr)} % je Seite. Den genauen Liquidationspreis zeigt ${esc(br.name.replace(/ \(.*\)$/, "").replace(/^Perp – /, ""))} beim Eröffnen. Andere Werte: „Eigene Werte“ wählen.</p>`}`}
      <label>Einstiegsbedingung (optional)<textarea data-rechner="bedingung" rows="2" placeholder="z. B. erst wenn ein Boden in Sicht ist, nicht im freien Fall · Retracement abwarten">${esc(r.bedingung || "")}</textarea></label>
      <div id="rechner-ergebnis">${hebelErgebnis()}</div>
      <button class="knopf haupt" data-rechner-notiz="1">Als Notiz speichern (mit Chart)</button>
    </section>
    ${br.produkt ? zertFinder() : ""}`;
}

const hebelFeldText = (v) => String(rund(v, v >= 100 ? 2 : v >= 1 ? 4 : 6)).replace(".", ",");
document.addEventListener("input", (ev) => {
  const n = ev.target.dataset?.rechner;
  if (!n) return;
  (ui.rechner ||= {})[n] = ev.target.value;
  if (n === "hebel") {                      // Schieberegler und Zahlenfeld gleich halten
    document.querySelectorAll('[data-rechner="hebel"]').forEach((el) => { if (el !== ev.target) el.value = ev.target.type === "range" ? String(ev.target.value).replace(".", ",") : String(zahl(ev.target.value) || 1); });
    const w = document.getElementById("hebel-wert"); if (w) w.textContent = String(ev.target.value).replace(".", ",");
  }
  const el = document.getElementById("rechner-ergebnis");
  if (el) { el.innerHTML = hebelErgebnis(); uebersetzeDom(el); }     // nur Ergebnis neu, Eingabe behaelt den Fokus
});
document.addEventListener("change", (ev) => {
  if (ev.target.dataset?.rechnerBroker != null) { (ui.rechner ||= {}).broker = ev.target.value; return zeichnen(); }
  if (ev.target.dataset?.rechnerWaehrung != null) { (ui.rechner ||= {}).waehrung = ev.target.value; return zeichnen(); }
  if (ev.target.dataset?.rechnerBasis == null) return;
  (ui.rechner ||= {}).basis = ev.target.value; const el = document.getElementById("rechner-ergebnis"); el.innerHTML = hebelErgebnis(); uebersetzeDom(el);
});

// 0.69: Stop-Loss / Take-Profit im Chart mit dem Finger ziehen - Skala bleibt waehrend des Ziehens fest
let hebelZug = null;
document.addEventListener("pointerdown", (ev) => {
  const svg = ev.target.closest?.("#rechner-ergebnis svg.hebelchart");
  if (!svg || !ui.rechner) return;
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse());
  let best = null;
  for (const l of svg.querySelectorAll("line[data-marke]")) {
    const t = l.dataset.marke; if (t !== "Stop-Loss" && t !== "Take-Profit" && t !== "Einstieg") continue;
    const dy = Math.abs(+l.getAttribute("y1") - p.y); if (dy < 14 && (!best || dy < best.dy)) best = { t, dy };
  }
  if (!best) return;
  ui.hebelSkala = { lo: +svg.dataset.lo, hi: +svg.dataset.hi, pad: +svg.dataset.pad };
  hebelZug = { feld: best.t === "Stop-Loss" ? "stop" : best.t === "Einstieg" ? "einstieg" : "ziel", h: +svg.dataset.h };
  ev.preventDefault();
});
document.addEventListener("pointermove", (ev) => {
  if (!hebelZug) return;
  const svg = document.querySelector("#rechner-ergebnis svg.hebelchart"); if (!svg) return;
  const pt = svg.createSVGPoint(); pt.x = ev.clientX; pt.y = ev.clientY;
  const p = pt.matrixTransform(svg.getScreenCTM().inverse()), s = ui.hebelSkala, H = hebelZug.h;
  const v = (s.lo - s.pad) + (H - 10 - p.y) / (H - 20) * (s.hi - s.lo + 2 * s.pad);
  if (!(v > 0)) return;
  ui.rechner[hebelZug.feld] = hebelFeldText(v);
  if (hebelZug.feld === "stop") ui.rechner.ohneStop = false;
  const f = document.querySelector(`input[data-rechner="${hebelZug.feld}"]`); if (f) f.value = ui.rechner[hebelZug.feld];
  const el = document.getElementById("rechner-ergebnis"); el.innerHTML = hebelErgebnis(); uebersetzeDom(el);
  ev.preventDefault();
}, { passive: false });
document.addEventListener("pointerup", () => {
  if (!hebelZug) return;
  hebelZug = null; ui.hebelSkala = null;
  const el = document.getElementById("rechner-ergebnis"); if (el) { el.innerHTML = hebelErgebnis(); uebersetzeDom(el); }
});

/** 0.68: Basiswert im Hebel-Rechner suchen (wie Watchlist: erst Onvista, dann Yahoo) – der Mensch wählt aus. */
// ------------------------------------------------------------ 0.73: Suche nach Art (Wunsch 22.11.: "Nasdaq" fand nur einen Green Index)
// Yahoo liefert je Treffer quoteType. Dazu feste Listen der wichtigsten Indizes und Rohstoffe (offline, sofort, eindeutig benannt).
const SUCH_ARTEN = [["alle", "Alle"], ["index", "Index"], ["aktie", "Aktie"], ["etf", "ETF"], ["krypto", "Krypto"], ["rohstoff", "Rohstoff"]];
const SUCH_TYP = { INDEX: "index", EQUITY: "aktie", ETF: "etf", MUTUALFUND: "etf", CRYPTOCURRENCY: "krypto", FUTURE: "rohstoff" };
const SUCH_TYP_DE = { index: "Index", aktie: "Aktie", etf: "ETF/Fonds", krypto: "Krypto", rohstoff: "Rohstoff (Future)" };
const FESTE_BASISWERTE = [
  ["^NDX", "Nasdaq 100", "index", "nasdaq 100 ndx us tech 100"], ["^IXIC", "Nasdaq Composite", "index", "nasdaq composite"],
  ["^GSPC", "S&P 500", "index", "s&p 500 sp500 spx"], ["^DJI", "Dow Jones Industrial", "index", "dow jones dji"],
  ["^RUT", "Russell 2000", "index", "russell 2000"], ["^GDAXI", "DAX 40", "index", "dax 40 germany"], ["^MDAXI", "MDAX", "index", "mdax"],
  ["^TECDAX", "TecDAX", "index", "tecdax"], ["^STOXX50E", "Euro Stoxx 50", "index", "euro stoxx 50 eurostoxx"], ["^FTSE", "FTSE 100", "index", "ftse 100 london"],
  ["^N225", "Nikkei 225", "index", "nikkei 225 japan"], ["^HSI", "Hang Seng", "index", "hang seng hongkong"], ["^FCHI", "CAC 40", "index", "cac 40 frankreich"],
  ["^VIX", "VIX (Volatilität)", "index", "vix volatilität angst"],
  ["GC=F", "Gold (Future)", "rohstoff", "gold"], ["SI=F", "Silber (Future)", "rohstoff", "silber silver"], ["BZ=F", "Öl Brent (Future)", "rohstoff", "öl oel brent oil"],
  ["CL=F", "Öl WTI (Future)", "rohstoff", "öl oel wti crude oil"], ["NG=F", "Erdgas (Future)", "rohstoff", "erdgas gas natural"],
  ["HG=F", "Kupfer (Future)", "rohstoff", "kupfer copper"], ["PL=F", "Platin (Future)", "rohstoff", "platin platinum"],
];
function festeTreffer(begriff, art) {
  const b = String(begriff || "").toLowerCase().trim();
  if (b.length < 2) return [];
  return FESTE_BASISWERTE.filter(([sym, name, a, w]) => (art === "alle" || art === a) && (w.includes(b) || name.toLowerCase().includes(b) || sym.toLowerCase() === b))
    .map(([symbol, name, a]) => ({ symbol, name, boerse: "", art: "", artDe: SUCH_TYP_DE[a], typ: a }));
}

async function hebelBasisSuchen() {
  if (!APP) return meldung("Suche gibt es nur in der App.");
  if (netzGesperrt()) return;
  const begriff = String(ui.rechner?.suche || "").trim();
  if (!begriff) return meldung("Erst Name, ISIN oder WKN eintragen.");
  meldung("Suche …");
  const K = begriff.toUpperCase(), kennung = istIsin(K) || istWkn(K);
  const ov = (await onvistaTreffer(kennung ? K : begriff)).slice(0, 5);
  ui.finderBasen = ov.filter((e) => e.entityType && e.entityType !== "DERIVATIVE" && e.entityType !== "FUND" && e.entityValue)
    .map((e) => ({ typ: e.entityType, wert: String(e.entityValue), name: e.tinyName || e.name || "" }));
  if (ui.rechner && ui.finderBasen.length && !(ui.rechner.ovBasis && ui.finderBasen.some((b) => b.wert === ui.rechner.ovBasis.wert))) ui.rechner.ovBasis = ui.finderBasen[0];
  const frage = istWkn(K) ? (ov[0]?.name || "") : kennung ? K : begriff;
  const j = frage ? await kursHolen(frage, "suche") : { quotes: [] };
  const art = ui.rechner?.sucheArt || "alle";
  const yahoo = (j?.quotes || []).filter((q) => q.symbol && !/\.TWO$/.test(q.symbol))
    .map((q) => { const typ = SUCH_TYP[q.quoteType] || ""; return { symbol: q.symbol, name: q.longname || q.shortname || q.symbol, boerse: q.exchDisp || q.exchange || "", art: q.typeDisp || "", artDe: SUCH_TYP_DE[typ] || "", typ }; })
    .filter((t) => art === "alle" || t.typ === art)
    .sort((a, b) => (a.typ === "krypto" && b.typ === "krypto" ? (/-EUR$/.test(b.symbol) - /-EUR$/.test(a.symbol)) : 0));
  const fest = festeTreffer(begriff, art), schon = new Set(fest.map((t) => t.symbol));
  ui.rechnerTreffer = [...fest, ...yahoo.filter((t) => !schon.has(t.symbol))].slice(0, 8);
  if (!ui.rechnerTreffer.length) meldung(!j ? "Keine Verbindung." : art === "alle" ? "Nichts gefunden." : "Nichts gefunden – andere Art wählen oder „Alle“.");
  zeichnen();
}
async function hebelBasisWaehlen(i) {
  const t = (ui.rechnerTreffer || [])[i];
  if (!t) return;
  meldung("Lade Kurs …");
  const v = (await kursHolen(t.symbol, "verlauf"))?.chart?.result?.[0];
  const ts = v?.timestamp || [], c = v?.indicators?.quote?.[0]?.close || [];
  const punkte = ts.map((x, n) => [new Date(x * 1000).toISOString().slice(0, 10), c[n]]).filter((p) => p[1] != null);   // 0.70: ganzes Jahr behalten (Zeitraum-Knoepfe)
  const kurs = v?.meta?.regularMarketPrice ?? punkte.at(-1)?.[1];
  const r = ui.rechner ||= { richtung: "long" };
  r.basisFrei = { name: t.name, symbol: t.symbol, waehrung: v?.meta?.currency || "", punkte }; r.basis = "frei";
  if (!r.waehrung && !EIN().rechnerWaehrung && HEBEL_WAEHRUNGEN.includes(String(v?.meta?.currency || "").toUpperCase())) r.waehrung = String(v.meta.currency).toUpperCase();
  if (kurs > 0) { r.einstieg = hebelFeldText(kurs); r.kursJetzt = kurs; r.kursAktuell = r.einstieg + (v?.meta?.currency ? " " + v.meta.currency : ""); r.kursDatum = heute(); }
  if (!r.titel) r.titel = t.name;
  // passender Onvista-Basiswert fuer den Zertifikate-Finder (gleicher Name zuerst)
  const fb = ui.finderBasen || [], nm = (s) => String(s || "").toLowerCase().split(/[\s(]/)[0];
  const ovb = fb.find((b) => nm(b.name) === nm(t.name)) || fb[0];
  if (ovb && !r.ovBasis) r.ovBasis = ovb;
  ui.rechnerTreffer = null; zeichnen();
  if (hebelZeitraum(r) !== "6m") hebelZeitraumLaden(r);       // gewaehlter laengerer/kuerzerer Zeitraum bleibt
  meldung(kurs > 0 ? "Kurs als Einstieg übernommen." : "Kein Kurs gefunden – Einstieg selbst eintragen.");
}

// 0.85 (Verbesserungs-Loop 3.1): Krypto-Paar waehlbar (z. B. XRP/EUR oder XRP/USD) - Kurs, Chart und Rechner-Waehrung folgen dem Paar
const KRYPTO_PAARE = ["EUR", "USD", "CAD", "CHF", "GBP"];
const hebelKryptoPaar = (sym) => { const m = /^([A-Z0-9]{2,12})-(EUR|USD|CAD|CHF|GBP)$/.exec(String(sym || "")); return m ? [m[1], m[2]] : null; };
document.addEventListener("click", (ev) => {
  const b = ev.target.closest?.("[data-rechner-paar]"), r = ui.rechner;
  if (!b || !r?.basisFrei) return;
  const p = hebelKryptoPaar(r.basisFrei.symbol), q = b.dataset.rechnerPaar;
  if (!p || p[1] === q) return;
  r.waehrung = HEBEL_WAEHRUNGEN.includes(q) ? q : r.waehrung;
  ui.rechnerTreffer = [{ symbol: p[0] + "-" + q, name: String(r.basisFrei.name || p[0]).replace(/\b(EUR|USD|CAD|CHF|GBP)\b/, q), typ: "krypto" }];
  hebelBasisWaehlen(0);
});
// 0.85 (Verbesserungs-Loop 3.2): Hebel oder Spot direkt waehlen, die Wahl bleibt fuer neue Rechnungen
document.addEventListener("click", (ev) => {
  const m = ev.target.closest?.("[data-rechner-markt]");
  if (!m) return;
  const r = ui.rechner ||= {}, spot = m.dataset.rechnerMarkt === "spot", br = hebelBroker(r);
  (S.einstellungen ||= {}).rechnerMarkt = spot ? "spot" : "hebel"; sichern();
  if (!!br.spot === spot) return zeichnen();
  r[spot ? "brokerHebel" : "brokerSpot"] = br.key;
  r.broker = r[spot ? "brokerSpot" : "brokerHebel"] || (spot ? "spot_broker" : "zertifikat");
  zeichnen();
});

/** Text fuer die Notiz aus der Rechnung. 0.87 (Bugliste 7): nur Kurse, Prozente und Hebel - keine Beträge und Stückzahlen im Text.
 *  Die stehen im gespeicherten Rechner und folgen dort der Rechner-Währung und „Beträge aus“. */
function hebelNotizText(r, x) {
  const z = (v) => v ? fZahl.format(rund(v, 4)) : "–";
  if (x.discount) return `Discount-Zertifikat${r.produkt ? " · " + r.produkt : ""}${x.verfall ? " · Verfall " + x.verfall : ""}\n` +
    `Basiswert ${z(x.E)} · Cap ${z(x.B)} · Abschlag ${fPct.format(rund(x.rabatt, 2))} % · Break-even ${z(x.be)} (${pct(x.puffer)})\n` +
    `höchster Ertrag ${pct(x.maxErtrag)}${x.Z ? ` · Take-Profit ${z(x.Z)} → ${pct(x.gewinn)}` : ""}`;
  if (x.option) return `${x.istOption ? "Option" : "Optionsschein"} · ${x.call ? "Call" : "Put"}${r.produkt ? " · " + r.produkt : ""}${x.verfall ? " · Verfall " + x.verfall : ""}\n` +
    `Basiswert ${z(x.E)} · Basispreis ${z(x.B)} (${pct(x.bpAbstand)}) · Break-even am Verfall ${z(x.be)} (${pct(x.beAbstand)})\n` +
    `${x.istOption ? "Prämie je Kontrakt" : "Preis je Schein"} ${z(x.U)} · höchster Verlust 100 %\n` +
    `${x.Z ? `Take-Profit ${z(x.Z)} → ${pct(x.gewinn)} am Verfall` : "kein Take-Profit"}`;
  return `${x.long ? "Long" : "Short"} · Hebel ${fPct.format(rund(x.H, 2))}×${r.produkt ? " · " + r.produkt : ""}\n` +
    `Einstieg ${z(x.E)} · Knock-out ${z(x.ko)} (${pct(x.koAbstand)})\n` +
    `${x.ohneStop ? "ohne Stop-Loss – Risiko bis zum Knock-out" : `Stop-Loss ${z(x.S)} → ${pct(x.verlust)}`}` +
    ` · Take-Profit ${z(x.Z)}${x.gewinn != null ? ` → ${pct(x.gewinn)}` : ""}` +
    `${x.crv ? "\nChance : Risiko " + fPct.format(x.crv) + " : 1" : ""}${r.bedingung ? "\nEinstiegsbedingung: " + r.bedingung : ""}\n(vereinfachte Rechnung, keine Anlageberatung)`;
}

document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  let x;
  if (t("[data-rechner-suchen]")) return hebelBasisSuchen();
  if ((x = t("[data-rechner-treffer]"))) return hebelBasisWaehlen(+x.dataset.rechnerTreffer);
  if ((x = t("[data-rechner-auf]"))) { ui.rechnerOffen = x.dataset.rechnerAuf === "1"; return zeichnen(); }
  if ((x = t("[data-rechner-suchart]"))) { (ui.rechner ||= {}).sucheArt = x.dataset.rechnerSuchart; if (ui.rechner.suche) return hebelBasisSuchen(); return zeichnen(); }
  if ((x = t("[data-rechner-richtung]"))) { (ui.rechner ||= {}).richtung = x.dataset.rechnerRichtung; ui.finderListe = null; return zeichnen(); }
  if ((x = t("[data-rechner-stop]"))) { (ui.rechner ||= {}).ohneStop = x.dataset.rechnerStop === "ohne"; return zeichnen(); }
  if ((x = t("[data-hebel-zeitraum]"))) {
    const r = x.dataset.zeitraumZiel === "posgr" ? (ui.posgr ||= {}) : (ui.rechner ||= {});
    r.zeitraum = x.dataset.hebelZeitraum; zeichnen(); hebelZeitraumLaden(r); return;
  }
  if ((x = t("[data-rechner-stop-uebernehmen]"))) { (ui.rechner ||= {}).stop = hebelFeldText(+x.dataset.rechnerStopUebernehmen); ui.rechner.ohneStop = false; return zeichnen(); }
  if ((x = t("[data-hebel-bild]"))) {
    const k = x.dataset.hebelBild, n = k === "rechner" ? null : k === "neu" ? ui.notiz : (S.notizen || []).find((y) => y.id === k);
    const txt = document.querySelector('#notiz-form textarea[name="text"]')?.value;
    if (n && txt != null) return hebelBildTeilen(n.rechner, document.querySelector('#notiz-form input[name="titel"]')?.value || n.titel, txt);
    return hebelBildTeilen(n ? n.rechner : ui.rechner, n ? n.titel : (ui.rechner?.titel || ""), n ? n.text : "");
  }
  if ((x = t("[data-rechner-laden]"))) {
    const n = (S.notizen || []).find((y) => y.id === x.dataset.rechnerLaden);
    if (n?.rechner) { ui.rechner = { ...n.rechner }; ui.rechnerOffen = true; ui.notizReiter = "derivate"; ui.notiz = null; zeichnen(); return scrollTo(0, 0); }
  }
  if (t("[data-rechner-notiz]")) {
    const r = hebelRechnen(ui.rechner || {});
    if (!r) return meldung("Erst Einstieg und Hebel eintragen.");
    const z = (v) => v ? fZahl.format(rund(v, 4)) : "–";
    ui.notiz = { bezug: "", rechner: { ...ui.rechner, gespeichertAm: new Date().toISOString() }, titel: ui.rechner.titel || `Hebel ${r.long ? "Long" : "Short"} ${z(r.E)}`, text: hebelNotizText(ui.rechner, r) };
    zeichnen(); return scrollTo(0, 0);
  }
});

// ------------------------------------------------------------ 0.69: Analyse als Bild (PNG) teilen
/** SVG mit aufgeloesten Farben (CSS-Variablen) fuer das Bild. */
function svgMitFarben(svg) {
  const cs = getComputedStyle(document.documentElement);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  return new XMLSerializer().serializeToString(svg).replace(/var\((--[a-z-]+)\)/g, (_, v) => cs.getPropertyValue(v).trim() || "#888");
}
async function hebelBildTeilen(r, titel, text) {
  const x = r && hebelRechnen(r);
  if (!x) return meldung("Erst Einstieg und Hebel eintragen.");
  try {
    const cs = getComputedStyle(document.documentElement), farbe = (v, s) => cs.getPropertyValue(v).trim() || s;
    const hg = farbe("--grund", "#ffffff"), tx = farbe("--text", "#111111"), leise = farbe("--leise", "#666666");
    const box = document.createElement("div"); box.innerHTML = hebelChart(r); const svg = box.querySelector("svg");
    const W = 1080, P = 48, bild = new Image();
    const vb = svg.viewBox.baseVal, chartH = Math.round((W - 2 * P) * vb.height / vb.width);
    svg.setAttribute("width", W - 2 * P); svg.setAttribute("height", chartH);
    await new Promise((ok, nein) => { bild.onload = ok; bild.onerror = nein; bild.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgMitFarben(svg)); });
    const kacheln = hebelKacheln(x).map(([t, w, u]) => [tr(t), tr(w), tr(u)]);
    const c = document.createElement("canvas"), g = c.getContext("2d");
    // Text auf Breite kuerzen bzw. umbrechen (Messung mit der echten Schrift)
    const kurz = (t, w, font) => { g.font = font; t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + "…").width > w) t = t.slice(0, -1); return t + "…"; };
    const umbruch = (t, w, font) => { g.font = font; const aus = []; let z = ""; for (const wort of String(t).split(" ")) { const n = z ? z + " " + wort : wort; if (g.measureText(n).width > w && z) { aus.push(z); z = wort; } else z = n; } if (z) aus.push(z); return aus; };
    const FN = "22px sans-serif", FB = "24px sans-serif", breit = W - 2 * P;
    const notiz = String(text || "").split("\n").filter((z) => z && !/^Einstiegsbedingung:|^Entry condition:/.test(z)).flatMap((z) => umbruch(z, breit, FN)).slice(0, 18);
    const bed = r.bedingung ? umbruch(String(r.bedingung), breit, FB).slice(0, 4) : [];
    const zeilenH = 30, kH = Math.ceil(kacheln.length / 2) * 96, nH = (notiz.length + (bed.length ? bed.length + 1 : 0)) * zeilenH;
    c.width = W; c.height = P + 70 + chartH + 30 + kH + (nH ? nH + 40 : 0) + 90;
    g.fillStyle = hg; g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = tx; g.fillText(kurz(titel || tr("Hebel-Rechner"), breit, "bold 40px sans-serif"), P, P + 30);
    g.fillStyle = leise;
    g.fillText(kurz(`${tr(x.discount ? "Discount" : x.option ? (x.call ? "Call" : "Put") : x.long ? "Long" : "Short")} · ${tr(hebelBroker(r).name).replace(/ \(.*\)$/, "")}${r.produkt ? " · " + r.produkt : ""} · ${new Date().toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })}`, breit, "24px sans-serif"), P, P + 64);
    let yy = P + 84; g.drawImage(bild, P, yy, W - 2 * P, chartH); yy += chartH + 30;
    const sp = (W - 2 * P) / 2;
    kacheln.forEach(([t, w, u], i) => {
      const xx = P + (i % 2) * sp, y0 = yy + Math.floor(i / 2) * 96;
      g.fillStyle = leise; g.fillText(kurz(t, sp - 16, "22px sans-serif"), xx, y0 + 22);
      g.fillStyle = tx; g.fillText(kurz(w, sp - 16, "bold 30px sans-serif"), xx, y0 + 56);
      g.fillStyle = leise; g.fillText(kurz(u, sp - 16, "19px sans-serif"), xx, y0 + 82);
    });
    yy += kH + 20;
    if (bed.length) { g.fillStyle = tx; g.font = "bold 24px sans-serif"; g.fillText(tr("Einstiegsbedingung:"), P, yy + 22); yy += zeilenH; g.font = FB; for (const z of bed) { g.fillText(z, P, yy + 22); yy += zeilenH; } }
    g.fillStyle = tx; g.font = FN; for (const z of notiz) { g.fillText(z, P, yy + 22); yy += zeilenH; }
    g.fillStyle = leise; g.font = "20px sans-serif"; g.fillText(tr("Depot-Kompass · vereinfachte Rechnung · keine Anlageberatung"), P, c.height - 36);
    const b64 = c.toDataURL("image/png").split(",")[1];
    const name = `depot-kompass-${String(titel || "analyse").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "analyse"}-${heute()}.png`;
    if (APP && APP.teilen) {
      // 0.70: Bild zusaetzlich in „Bilder/Depot-Kompass“ speichern (manche Android-Systeme haben kein „In Dateien speichern“ im Teilen-Menue)
      const gespeichert = APP.bildSpeichern ? APP.bildSpeichern(name, b64) : false;
      if (!APP.teilen(name, "image/png", b64, true)) meldung(gespeichert ? "Teilen ging nicht – Bild liegt in Bilder › Depot-Kompass." : "Teilen ging nicht.");
      else if (gespeichert) meldung("Bild gespeichert: Bilder › Depot-Kompass");
      return;
    }
    const a = document.createElement("a"); a.href = "data:image/png;base64," + b64; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    window.__letztesBild = { name, laenge: b64.length };
  } catch (e) { meldung("Bild ging nicht: " + (e?.message || e)); }
}

// ------------------------------------------------------------ 0.69: Zertifikate-Finder (echte Produktdaten von Onvista)
// Onvista-Derivatefinder (api.onvista.de/api/v1/derivatives/finder/configuration_query), Broker-IDs aus dessen
// Filterliste (Stand 21.11.2026). Nur auf Knopfdruck, Ergebnis 10 Minuten zwischengespeichert (Onvista nicht ueberlasten).
const FINDER_BROKER = [["", "alle Broker"], ["8260", "Trade Republic"], ["8458", "Scalable Capital"], ["8460", "Smartbroker+"], ["8", "comdirect"], ["2", "Consorsbank"],
  ["4", "ING"], ["8261", "DKB"], ["3", "flatex"], ["243", "DEGIRO"], ["5", "DB maxblue"], ["6", "S Broker"], ["8461", "1822direkt"], ["8689", "justTRADE"],
  ["298", "tradegate.direct"], ["166", "Traders Place"], ["266", "Joe Broker"], ["8459", "Finanzen invest"], ["7", "Targobank"]];
const finderCache = {};
function finderAnfrage(r) {
  const H0 = zahl(r.finderHebel) || zahl(r.hebel), H = H0 > 0 && H0 < 1.01 ? 1.01 : H0, sp = zahl(r.finderSpanne) > 0 ? zahl(r.finderSpanne) : 0.1;   // 0.84: mind. 1,01
  if (!(H >= 1)) return null;
  const p = [["entitySubType", "KNOCKOUT_CERTIFICATE"], ["idExerciseRight", r.richtung === "short" ? "1" : "2"],
    ["gearingAskRange", `${rund(Math.max(1.01, H - sp), 3)};${rund(Math.max(H + sp, 1.01 + sp), 3)}`], ["feature", r.broker === "minifuture" ? "STOP_LOSS" : "STANDARD"]];
  if (r.finderBroker) p.push(["brokerId", r.finderBroker]);
  return { H, sp, q: p.map(([k, v]) => k + "=" + v).join("&") + "&" };
}
function zertFinder() {
  const r = ui.rechner || {}, a = finderAnfrage(r), liste = ui.finderListe;
  const f = (n, t, ph) => `<label>${t}<input data-rechner="${n}" inputmode="decimal" value="${esc(r[n] || "")}" placeholder="${ph}"></label>`;
  return `<section class="karte formular" id="zertfinder">
    <b>🔍 Passende Zertifikate finden</b>
    <p class="klein" style="margin:0"><span>${r.broker === "minifuture" ? "Sucht echte Mini-Futures (Knock-out mit Stop-Loss-Schwelle) bei Onvista" : "Sucht echte Knock-out-Zertifikate (Turbos) bei Onvista"}</span> · <b>${r.richtung === "short" ? "Short" : "Long"}</b> · <span>mit deinem Hebel ± Spanne und beim gewählten Broker handelbar. Danach WKN beim Broker eingeben.</span></p>
    <label>Broker<select data-finder-broker>${FINDER_BROKER.map(([id, n]) => `<option value="${id}" ${String(r.finderBroker || "") === id ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <div class="zwei">${f("finderHebel", "Wunsch-Hebel", r.hebel || "z. B. 3")}${f("finderSpanne", "Spanne ±", "0,1")}</div>
    ${(ui.finderBasen || []).length ? `<label>Basiswert bei Onvista<select data-finder-basis>${ui.finderBasen.map((b, i) => `<option value="${i}" ${r.ovBasis && r.ovBasis.wert === b.wert ? "selected" : ""}>${esc(b.name)} (${esc(b.typ)})</option>`).join("")}</select></label>`
      : r.ovBasis ? `<p class="klein" style="margin:0"><span>Basiswert bei Onvista:</span> <b>${esc(r.ovBasis.name)}</b></p>` : `<p class="klein" style="margin:0">Erst oben den Basiswert suchen.</p>`}
    <button class="knopf haupt" type="button" data-finder-suchen="1" ${a && r.ovBasis ? "" : "disabled"}>🔍 Zertifikate suchen</button>
    ${liste ? liste.fehler ? `<p class="warn-t klein">${esc(liste.fehler)}</p>` : `
      <p class="klein" style="margin:0">${liste.gesamt} Treffer bei Onvista, die ${liste.l.length} mit dem Hebel am nächsten an ${fZahl.format(liste.H)}× · Stand ${esc(liste.zeit)}</p>
      <div class="liste">${liste.l.map((p, i) => `<div class="zeile" style="grid-template-columns:1fr auto;gap:6px">
        <span style="min-width:0"><span class="titel">${esc(p.wkn)} · ${esc(p.emittent)}</span>
          <span class="unter">Hebel ${fPct.format(p.hebel)}× · KO ${fZahl.format(p.ko)}${p.bp && Math.abs(p.bp - p.ko) > 1e-9 ? " · Basispreis " + fZahl.format(p.bp) : ""} · BV ${fZahl.format(p.bv)}</span>
          <span class="unter">Geld ${p.geld != null ? fEur.format(p.geld) : "–"} · Brief ${p.brief != null ? fEur.format(p.brief) : "–"}${p.spreadPct != null ? " · Spread " + fPct.format(p.spreadPct) + " %" : ""} · ${p.openEnd ? "Open End" : p.laufzeit ? "bis " + esc(datum(p.laufzeit)) : ""}${p.quanto ? " · währungsgesichert" : ""}</span>
          <span class="unter">${esc(p.isin)}</span></span>
        <span style="display:grid;gap:4px"><button class="knopf klein" type="button" data-finder-nehmen="${i}">übernehmen</button><button class="knopf klein" type="button" data-finder-kopieren="${i}">WKN kopieren</button>${p.url ? `<a class="knopf klein" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer" style="text-align:center;text-decoration:none;color:inherit">Onvista ↗</a>` : ""}</span></div>`).join("") || `<p class="klein">Nichts in dieser Spanne – Spanne vergrößern oder „alle Broker“.</p>`}</div>` : ""}
    <p class="klein" style="margin:0">Daten von Onvista, ohne Gewähr. Ob dein Broker das Produkt gerade handelt, siehst du dort nach Eingabe der WKN. Keine Anlageberatung.</p>
  </section>`;
}
async function finderSuchen() {
  const r = ui.rechner || {}, a = finderAnfrage(r);
  if (!a || !r.ovBasis) return meldung("Erst Basiswert und Hebel eintragen.");
  if (!APP?.onvistaFinder) return meldung("Der Zertifikate-Finder braucht die App ab Version 0.69.");
  if (netzGesperrt()) return;
  const key = [r.ovBasis.typ, r.ovBasis.wert, a.q].join("|"), alt = finderCache[key];
  let j = alt && Date.now() - alt.t < 600000 ? alt.j : null;
  if (!j) {
    meldung("Suche Zertifikate …");
    j = await new Promise((ok) => { const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, ""); kursWarten[id] = ok; APP.onvistaFinder(r.ovBasis.typ, r.ovBasis.wert, a.q, id); setTimeout(() => window.kursAntwort(id, ""), 25000); });
    if (j && Array.isArray(j.list)) finderCache[key] = { t: Date.now(), j };
  }
  if (!j || !Array.isArray(j.list)) { ui.finderListe = { fehler: "Keine Antwort von Onvista – später noch einmal versuchen." }; return zeichnen(); }
  const l = j.list.map((e) => ({
    wkn: e.instrument?.wkn || "", isin: e.instrument?.isin || "",
    // 0.84 (Verbesserungs-Loop 2.1): Datenblatt bei Onvista - nur echte onvista.de-Adressen
    url: /^https:\/\/www\.onvista\.de\/[A-Za-z0-9\/._-]{1,200}$/.test(e.instrument?.urls?.WEBSITE || "") ? e.instrument.urls.WEBSITE : "", emittent: e.issuer?.name || "", hebel: +e.gearingAsk || 0, ko: +e.knockOutAbs || 0, bp: +e.strikeAbs || 0,
    bv: +e.coverRatio || 0, geld: e.quote?.bid ?? null, brief: e.quote?.ask ?? null, openEnd: !!e.openEnded, laufzeit: (e.dateMaturity || "").slice(0, 10), quanto: !!e.quanto,
    spreadPct: e.quote?.ask > 0 && e.quote?.bid > 0 ? (e.quote.ask - e.quote.bid) / e.quote.ask * 100 : null,
  })).filter((p) => p.wkn && p.hebel > 0 && p.ko > 0).sort((p, q) => Math.abs(p.hebel - a.H) - Math.abs(q.hebel - a.H) || (p.spreadPct ?? 99) - (q.spreadPct ?? 99)).slice(0, 12);
  ui.finderListe = { l, gesamt: j.total ?? l.length, H: a.H, zeit: new Date().toLocaleTimeString(LOC_DATUM(), { hour: "2-digit", minute: "2-digit" }) };
  meldung(l.length ? `${l.length} passende Zertifikate.` : "Nichts gefunden.");
  zeichnen();
}
document.addEventListener("change", (ev) => {
  if (ev.target.dataset?.finderBroker != null) { (ui.rechner ||= {}).finderBroker = ev.target.value; ui.finderListe = null; return zeichnen(); }
  if (ev.target.dataset?.finderBasis != null) { (ui.rechner ||= {}).ovBasis = (ui.finderBasen || [])[+ev.target.value] || null; ui.finderListe = null; return zeichnen(); }
});
document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  let x;
  if (t("[data-finder-suchen]")) return finderSuchen();
  if ((x = t("[data-finder-nehmen]"))) {
    const p = ui.finderListe?.l?.[+x.dataset.finderNehmen], r = ui.rechner; if (!p || !r) return;
    Object.assign(r, { produkt: p.wkn, koFix: hebelFeldText(p.ko), basispreis: hebelFeldText(p.bp || p.ko), hebel: "", bv: "", preis: p.brief != null ? String(p.brief).replace(".", ",") : "",
      spread: p.brief != null && p.geld != null ? String(rund(p.brief - p.geld, 4)).replace(".", ",") : "" });
    meldung(`${p.wkn} übernommen – Hebel, Knock-out und Preis kommen jetzt aus dem Produkt.`); zeichnen(); return scrollTo(0, 0);
  }
  if ((x = t("[data-finder-kopieren]"))) {
    const p = ui.finderListe?.l?.[+x.dataset.finderKopieren]; if (!p) return;
    if (APP && APP.kopieren) APP.kopieren(p.wkn); else navigator.clipboard?.writeText(p.wkn).catch(() => {});
    meldung(`WKN ${p.wkn} kopiert – beim Broker in die Suche einfügen.`);
  }
});

// ------------------------------------------------------------ Eigene News-Quellen (0.17)
// Jeder liest anders: Regionalzeitung, Branchenblatt, Blog ... als RSS/Atom-Feed.
function newsQuellenKarte() {
  const e = S.einstellungen ||= {}, l = e.newsQuellen || [];
  const sch = (attr, an, titel, unter) => `<label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
      <span style="min-width:0"><span class="titel">${titel}</span><span class="unter">${unter}</span></span>
      <input type="checkbox" ${attr} ${an ? "checked" : ""} style="width:24px;height:24px"></label>`;
  return `
    <h2>Quellen</h2>
    <section class="karte liste">
      ${sch('data-newsquelle-std="newsGoogle"', e.newsGoogle !== false, "Google News", "deutsch · sucht nach deinen Werten")}
      ${sch('data-newsquelle-std="newsYahoo"', e.newsYahoo !== false, "Yahoo Finance", "englisch · sucht nach deinen Werten")}
      ${l.map((q) => `<div class="zeile" style="grid-template-columns:minmax(0,1fr) auto auto;gap:8px">
        <span style="min-width:0"><span class="titel">${esc(q.name)}</span><span class="unter" style="overflow-wrap:anywhere">${q.alle ? "alle Meldungen" : "nur zu meinen Werten"} · ${esc(q.url)}</span></span>
        <input type="checkbox" data-newsquelle-an="${esc(q.id)}" ${q.an !== false ? "checked" : ""} style="width:24px;height:24px" aria-label="an/aus">
        <button class="knopf klein" data-newsquelle-weg="${esc(q.id)}" aria-label="entfernen">✕</button></div>`).join("")}
    </section>
    <form class="karte formular" id="newsquelle-form">
      <b>Eigene Quelle hinzufügen (RSS/Atom-Feed)</b>
      <label>Name<input name="name" required maxlength="40" placeholder="z. B. Regionalzeitung"></label>
      <label>Feed-Adresse (https://…)<input name="url" required type="url" inputmode="url" placeholder="https://…/rss"></label>
      <label style="display:flex;gap:10px;align-items:center"><input type="checkbox" name="alle" style="width:22px;height:22px"> alle Meldungen (nicht nur zu meinen Werten)</label>
      <button class="knopf" type="submit">Hinzufügen</button>
      <p class="klein" style="margin:0">Tipp: Viele Zeitungen haben unten auf der Seite „RSS“. Nur https-Adressen.</p>
    </form>`;
}

document.addEventListener("change", (ev) => {
  const e = S.einstellungen ||= {}, t = ev.target;
  if (t.dataset?.newsquelleStd) { e[t.dataset.newsquelleStd] = t.checked; sichern(); return; }
  if (t.dataset?.newsquelleAn) { const q = (e.newsQuellen || []).find((x) => x.id === t.dataset.newsquelleAn); if (q) { q.an = t.checked; sichern(); } }
});
document.addEventListener("click", (ev) => {
  const x = ev.target.closest("[data-newsquelle-weg]");
  if (!x) return;
  const e = S.einstellungen ||= {};
  e.newsQuellen = (e.newsQuellen || []).filter((q) => q.id !== x.dataset.newsquelleWeg); sichern(); zeichnen();
});
document.addEventListener("submit", (ev) => {
  if (ev.target.id !== "newsquelle-form") return;
  ev.preventDefault();
  const f = new FormData(ev.target), url = String(f.get("url") || "").trim();
  if (!/^https:\/\/[^\s]+$/i.test(url)) return meldung("Bitte eine https://-Adresse eintragen.");
  const e = S.einstellungen ||= {};
  (e.newsQuellen ||= []).push({ id: neueId("q"), name: String(f.get("name") || "").trim().slice(0, 40), url, alle: !!f.get("alle"), an: true });
  sichern(); meldung("Quelle hinzugefügt – „News laden“ holt sie mit."); zeichnen();
});

/** 0.63 (Sicherheit): Mindestanforderung an Passwoerter fuer Sicherungen/Exporte - Buchstaben + Ziffern (oder sehr lang),
 *  mindestens 6 verschiedene Zeichen, keine reinen Wiederholungen/Folgen. */
function passwortStark(p) {
  p = String(p || "");
  if (new Set(p).size < 6) return false;
  if (/^(.+)\1+$/.test(p)) return false;                                  // abcabcabc
  if (/0123|1234|2345|3456|4567|5678|6789|abcd|qwer|asdf/i.test(p) && p.length < 20) return false;
  return (/[a-zäöüß]/i.test(p) && /\d/.test(p)) || p.length >= 20;
}

// ------------------------------------------------------------ Beta: Version + Fehler melden
const appVersion = () => (APP && APP.version ? APP.version() : "") || "Test";
// 0.69/0.70 (Vorgabe 21.11.): Kontakt nur noch ueber ein Discord-Ticket (Scam-Schutz) - keine E-Mail mehr in der App
const DISCORD = "https://discord.gg/wFvFpeKpm";

/** 0.76: Warnung vor Betrügern (Seed-Phrase, falscher Support) – in „Fehler melden“ und „Sicherheit“. */
function betrugHinweis() {
  return `
    <section class="karte" style="border:2px solid var(--minus)">
      <p style="margin-top:0"><b class="minus-t">⚠️ Vorsicht vor Betrügern</b></p>
      <ul class="klein" style="padding-left:18px;margin-bottom:6px">
        <li>Niemand vom Depot-Kompass-Team fragt dich jemals nach deiner Seed-Phrase (Wiederherstellungs-Wörter), Passwörtern, PIN, Zwei-Faktor-Codes oder Ausweisfotos.</li>
        <li>Unser Team schreibt dich nie von sich aus an – nicht per Direktnachricht, Mail, Telefon oder SMS.</li>
        <li>Kontakt gibt es nur über unseren Discord-Server (Ticket). Wer dich anders anschreibt und sich als Team ausgibt, ist ein Betrüger.</li>
      </ul>
      <p class="klein" style="margin-bottom:0">Die App braucht keine Zugangsdaten zu Broker oder Wallet – passt auf eure Daten auf!</p>
    </section>`;
}

function feedbackSeite() {
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Fehler melden (Alpha)</span></h2>
    <section class="karte">
      <p style="margin-top:0">Danke fürs Testen! Du hast <b>Version ${esc(appVersion())}</b>.</p>
      <p>Diese App ist in der <b>Alpha-Phase</b>. Sollte dir ein Fehler auffallen oder sonst etwas: öffne auf unserem Discord ein Ticket – dort antwortet nur das Team.</p>
      <a class="knopf haupt" href="${DISCORD}" style="display:block;text-align:center;text-decoration:none;overflow-wrap:anywhere;white-space:normal">💬 Discord-Ticket öffnen<br><span class="klein" style="overflow-wrap:anywhere">discord.gg/wFvFpeKpm</span></a>
      <p><b>Bitte schicke:</b></p>
      <ul class="klein" style="padding-left:18px">
        <li>die Versionsnummer (steht oben),</li>
        <li>was du gemacht hast und was passiert ist – Schritt für Schritt,</li>
        <li>einen Screenshot: vorher oben das Auge antippen (Beträge aus) und unter ⚙️ → Sicherheit den Bildschirmschutz kurz ausschalten,</li>
        <li>bei Import-Problemen: welcher Broker und welche Export-Art (z. B. „Kraken-App → Aktivitäten“).</li>
      </ul>
      <p><b>Bitte NICHT schicken:</b></p>
      <ul class="klein" style="padding-left:18px">
        <li>deine CSV-Dateien, Kontoauszüge oder Sicherungen,</li>
        <li>Screenshots mit Beträgen, Stückzahlen oder Kontonummern,</li>
        <li>PIN, Sicherungs-Passwort oder API-Schlüssel,</li>
        <li>deine Seed-Phrase (Wiederherstellungs-Wörter) – niemals, an niemanden.</li>
      </ul>
      <p class="klein" style="margin-bottom:0">Die App selbst sendet nichts – es gibt keine Fehlerberichte im Hintergrund.</p>
    </section>${betrugHinweis()}`;
}

// ------------------------------------------------------------ KI-Chat: Reiter, Beispiele, Verlauf (ab 0.46)
document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  let x;
  if ((x = t("[data-ki-reiter]"))) { ui.kiReiter = x.dataset.kiReiter; return zeichnen(); }
  if ((x = t("[data-ki-beispiel]"))) {
    const r = x.dataset.kiBeispiel; ui.kiRichtung = r; ui.kiChatId = null; ui.kiReiter = "chat";
    if (KI_EINZEL.has(r) && !kiSicht().liste.some((p) => p.id === ui.kiWert))
      ui.kiWert = ([...kiSicht().liste].sort((a, b) => b.wert - a.wert).find((p) => (p.inst.art || "Aktie") === "Aktie") || {}).id;
    zeichnen(); return scrollTo(0, 0);
  }
  if ((x = t("[data-ki-schnell]"))) { ui.kiRichtung = "frei"; ui.kiFrage = tr(KI_SCHNELL[+x.dataset.kiSchnell] || ""); ui.kiChatId = null; ui.kiReiter = "chat"; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-ki-chat]"))) { ui.kiChatId = x.dataset.kiChat; ui.kiReiter = "chat"; zeichnen(); return scrollTo(0, 0); }
  if ((x = t("[data-ki-chat-weg]"))) {
    if (!confirm("Dieses Gespräch löschen?")) return;
    S.kiChats = kiChats().filter((c) => c.id !== x.dataset.kiChatWeg); if (ui.kiChatId === x.dataset.kiChatWeg) ui.kiChatId = null;
    sichern(); return zeichnen();
  }
});
document.addEventListener("input", (ev) => { if (ev.target.id === "ki-rueck") ui.kiRueck = ev.target.value; });

// ------------------------------------------------------------ Benachrichtigungen (ab 0.46, nur online, ab Werk aus)
// Android prueft alle paar Stunden im Hintergrund (Java: Wachter). Uebergeben werden nur Namen, Ticker und Termine -
// verschluesselt im App-Speicher. Keine Betraege, Stueckzahlen oder Konten.
const HINWEIS_STD = { an: false, kurse: true, schwelle: 5, earnings: true, ergebnisse: true, news: false, marken: true, stunden: 12, schwelleLauf: 0,
  newsMax: 3, newsUmfang: "portfolio", adhoc: true };   // 0.85: Schlagzeilen hoechstens newsMax je Pruefung, Rest als Sammel-Meldung
// 0.85 (Verbesserungs-Loop 4.4): Ad-hoc-Meldungen je Wert abonnieren (Namen in S.einstellungen.adhocAbo)
const ADHOC_RE = /ad[- ]?hoc|insiderinformation|inside information/i;
const adhocAbo = () => new Set(EIN().adhocAbo || []);
const hinweise = () => ({ ...HINWEIS_STD, ...(EIN().hinweise || {}) });

/** Alle Werte aus allen Depots (mit Bestand) und der Watchlist - Name, Ticker, kommende Earnings - plus (0.62) alle
 *  eingeschalteten Alarme mit Yahoo-Ticker als "marken": { id, name, art: unter|ueber|zone|prozent, wert, von, bis, prozent, basis, text }. */
/** Datum (JJJJ-MM-TT) vor n Tagen. */
function vorTagen(n) { const d = new Date(Date.now() - n * 864e5); return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0"); }

function wachterWerte() {
  const m = new Map(), offen = D;
  try {
    for (const d of Object.values(S.depots || {})) {
      if (d.rolle === "beobachtet") continue;   // 0.87: Feld heisst rolle (Bugliste 4)
      D = d;
      for (const p of positionen().liste) {
        const i = p.inst || {};
        if (!i.ticker && !(i.termine?.earnings || []).length) continue;
        m.set(i.ticker || p.name, { name: p.name, ticker: i.ticker || "", earnings: [...new Set([...(i.termine?.earningsGewesen || []), ...(i.termine?.earnings || [])].filter((x) => x >= vorTagen(4)))].sort().slice(0, 6),
          suche: typeof newsBegriff === "function" ? newsBegriff(p.name) : p.name, news: !["ETF", "Fonds"].includes(i.art), marken: [] });
      }
    }
  } finally { D = offen; }
  for (const w of S.watchlist || []) if (w.ticker && !w.kursHand && !m.has(w.ticker))
    m.set(w.ticker, { name: w.name, ticker: w.ticker, suche: newsBegriff(w.name), news: hinweise().newsUmfang === "alle", marken: [],
      earnings: [...new Set([...(w.termine?.earningsGewesen || []), ...(w.termine?.earnings || [])].filter((x) => x >= vorTagen(4)))].sort().slice(0, 6) });
  for (const a of alarme()) {
    if (a.an === false) continue;
    const w = alarmWert(a.bezug);
    if (!w || !w.ticker) continue;
    const e = m.get(w.ticker) || { name: w.name, ticker: w.ticker, earnings: [], suche: newsBegriff(w.name), news: false, marken: [] };
    e.marken.push({ id: a.id, name: a.name, art: a.art, wert: a.wert, von: a.von, bis: a.bis, prozent: a.prozent, basis: a.basis, text: tr(alarmBedingung(a, true)) });
    m.set(w.ticker, e);
  }
  // 0.85: Ad-hoc nur fuer abonnierte Werte
  const abo = adhocAbo();
  for (const w of m.values()) w.adhoc = abo.has(w.name);
  // 0.80: eigener Ton je Wert (Ticker) - Android spielt ihn ueber einen eigenen Benachrichtigungs-Kanal
  const toene = EIN().alarmToene || {};
  for (const w of m.values()) w.ton = toene[w.ticker] >= 1 && toene[w.ticker] <= ALARM_TOENE.length ? +toene[w.ticker] : 0;
  // Werte mit Alarmen zuerst, damit sie bei mehr als 60 Werten sicher geprueft werden
  return [...m.values()].sort((a, b) => (b.marken.length > 0 || b.adhoc) - (a.marken.length > 0 || a.adhoc)).slice(0, 60);
}

function wachterAbgleich() {
  if (!APP || !APP.wachterSetzen) return;
  const h = hinweise();
  if (!h.an || sicherheitStatus().netzAus) { APP.wachterSetzen(""); return; }
  const ok = APP.wachterSetzen(JSON.stringify({ stunden: h.stunden, schwelle: h.schwelle, schwelleLauf: h.schwelleLauf, kurse: h.kurse, earnings: h.earnings, ergebnisse: h.ergebnisse, news: h.news, newsMax: h.newsMax, adhoc: h.adhoc, marken: h.marken, sprache: sprache(),
    texte: { kanal: tr("Depot-Kompass – Hinweise"), toene: ALARM_TOENE.map((t) => tr(t)), earningsHeute: tr("Earnings heute"), earningsMorgen: tr("Earnings morgen"), seitGestern: tr("seit dem letzten Schlusskurs"),
      eineSchlagzeile: tr("1 neue Schlagzeile"), schlagzeilen: tr("%d neue Schlagzeilen"), weitereNews: tr("Neue Schlagzeilen zu %d weiteren Werten – in der App unter News"), adhoc: tr("Ad-hoc-Meldung"),
      kursJetzt: tr("Kurs jetzt"), entsperren: tr("Neuer Hinweis – zum Ansehen entsperren"),
      zahlenDa: tr("Zahlen sind da"), erwartet: tr("erwartet"), beat: tr("über Erwartung"), miss: tr("unter Erwartung"), seitPruefung: tr("seit der letzten Prüfung") },
    werte: wachterWerte() }));
  if (!ok) {
    let grund = ""; try { grund = APP.wachterFehler ? APP.wachterFehler() : ""; } catch { /* alte Fassung */ }
    meldung(grund === "netzAus" ? "Benachrichtigungen brauchen Internet – in der App ist es aus (⚙️ → Datenschutz)."
      : "Benachrichtigungen konnten nicht eingerichtet werden." + (grund ? " Grund: " + grund : ""));
  }
}
let wachterTimer = null;
function wachterSpaeter() { if (!hinweise().an) return; clearTimeout(wachterTimer); wachterTimer = setTimeout(wachterAbgleich, 3000); }

function hinweiseSeite() {
  const h = hinweise(), aus = sicherheitStatus().netzAus;
  let st = { erlaubt: true, geplant: false };
  try { if (APP && APP.wachterStatus) st = JSON.parse(APP.wachterStatus()); } catch { /* Test im Browser */ }
  const opt = (werte, wahl, einheit) => werte.map((w) => `<option value="${w}" ${+wahl === w ? "selected" : ""}>${w} ${einheit}</option>`).join("");
  const zeile = (id, titel, unter, an) => `<label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
      <span style="min-width:0"><span class="titel">${titel}</span><span class="unter">${unter}</span></span>
      <input type="checkbox" id="${id}" ${an ? "checked" : ""} ${aus ? "disabled" : ""} style="width:26px;height:26px"></label>`;
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>🔔 Benachrichtigungen</span></h2>
    <section class="karte">
      <p style="margin-top:0">Die App kann dich auf dem Handy erinnern: an deine Kurs-Marken, an Earnings-Termine, an starke Kursbewegungen und an neue Schlagzeilen zu deinen Werten.</p>
      <p class="klein">Ehrlich gesagt: Android prüft im Hintergrund nur etwa so oft, wie du unten einstellst – frühestens stündlich, manchmal später (Akku). Das ist kein Sekunden-Alarm wie in einer Trading-App – für schnelle Stops nutze die Order beim Broker.</p>
      <p class="klein">Das geht nur mit Internet: Android startet die Prüfung alle paar Stunden im Hintergrund. Abgefragt werden nur öffentliche Kurse und Schlagzeilen zu den Namen deiner Werte – nie Beträge, Stückzahlen oder Konten. Die Liste der Werte liegt verschlüsselt auf dem Handy.</p>
      ${aus ? `<p class="klein warn-t">Internet ist in der App aus – im Offline-Modus gibt es keine Benachrichtigungen.</p>
        <button class="knopf" data-ziel="datenschutz" style="width:100%">🌐 Internet erlauben</button>` : ""}
    </section>
    <section class="karte liste">
      ${zeile("hinweis-an", "Benachrichtigungen an", "ab Werk aus", h.an && !aus)}
      ${zeile("hinweis-kurse", "Starke Kursbewegung", "Veränderung seit dem letzten Schlusskurs", h.kurse)}
      ${zeile("hinweis-marken", "Alarme", "deine Alarme aus Watchlist → 🔔 Alarme (Marken, Zonen, Bewegung in %)", h.marken)}
      ${zeile("hinweis-earnings", "Earnings heute oder morgen", "Termine aus „Kurse & Daten aktualisieren“", h.earnings)}
      ${zeile("hinweis-ergebnisse", "Earnings-Ergebnis", "sobald die Zahlen da sind: Gewinn je Aktie gegen Erwartung", h.ergebnisse)}
      ${zeile("hinweis-news", "Neue Schlagzeilen", "Google News, Suche nach dem Namen (ohne ETFs)", h.news)}
      ${zeile("hinweis-adhoc", "Ad-hoc-Meldungen", "nur für Werte, die du unter News → ⚡ abonniert hast", h.adhoc)}
    </section>
    <section class="karte formular">
      <label>Kursbewegung ab<select id="hinweis-schwelle" ${aus ? "disabled" : ""}>${opt([3, 5, 8, 10, 15], h.schwelle, "%")}</select></label>
      <label>Bewegung seit der letzten Prüfung ab<select id="hinweis-schwellelauf" ${aus ? "disabled" : ""}><option value="0" ${!h.schwelleLauf ? "selected" : ""}>aus</option>${opt([2, 3, 5], h.schwelleLauf, "%")}</select></label>
      <label>Schlagzeilen für<select id="hinweis-newsumfang" ${aus ? "disabled" : ""}><option value="portfolio" ${h.newsUmfang !== "alle" ? "selected" : ""}>Mein Portfolio</option><option value="alle" ${h.newsUmfang === "alle" ? "selected" : ""}>Portfolio und Watchlist</option></select></label>
      <label>Schlagzeilen-Meldungen je Prüfung höchstens<select id="hinweis-newsmax" ${aus ? "disabled" : ""}>${[1, 3, 5, 10].map((w) => `<option value="${w}" ${+h.newsMax === w ? "selected" : ""}>${w}</option>`).join("")}</select></label>
      <p class="klein" style="margin:0">Gibt es zu mehr Werten neue Schlagzeilen, kommt dafür nur eine Sammel-Meldung.</p>
      <label>Prüfen etwa alle<select id="hinweis-stunden" ${aus ? "disabled" : ""}>${opt([1, 3, 6, 12, 24], h.stunden, "Std.")}</select></label>
      ${h.stunden <= 3 ? `<p class="klein" style="margin:0">Häufiges Prüfen braucht etwas mehr Akku und Daten.</p>` : ""}
      <p class="klein" style="margin:0">Android legt den genauen Zeitpunkt selbst fest (Akku sparen). Es werden höchstens 60 Werte geprüft.</p>
    </section>
    ${h.an && !aus ? `<section class="karte">
      <p class="klein" style="margin-top:0">${st.erlaubt ? "✓ Vom Handy erlaubt" : "⚠️ Vom Handy nicht erlaubt – bitte in den Android-Einstellungen der App Benachrichtigungen erlauben."}</p>
      ${!st.erlaubt ? `<button class="knopf" data-los="hinweis-einstellungen" style="width:100%;margin-bottom:8px">⚙️ Android-Einstellungen öffnen</button>` : ""}
      ${h.an && !aus && !st.geplant ? `<p class="klein warn-t" style="margin-top:0">⚠️ Die Hintergrund-Prüfung ist nicht eingeplant. Schalte Benachrichtigungen einmal aus und wieder an – kommt dann eine Meldung mit „Grund“, schick sie uns.</p>` : ""}
      <p class="klein">${st.geplant ? "✓ Prüfung ist eingeplant" : "Prüfung noch nicht eingeplant"}</p>
      <button class="knopf" data-los="hinweis-test" style="width:100%">🔔 Test-Benachrichtigung</button></section>` : ""}
    ${verlaufKarte()}`;
}

document.addEventListener("change", (e) => {
  const id = e.target.id;
  if (!/^hinweis-/.test(id)) return;
  const h = (S.einstellungen ??= {}).hinweise = hinweise();
  if (id === "hinweis-an") h.an = e.target.checked;
  if (id === "hinweis-kurse") h.kurse = e.target.checked;
  if (id === "hinweis-earnings") h.earnings = e.target.checked;
  if (id === "hinweis-news") h.news = e.target.checked;
  if (id === "hinweis-adhoc") h.adhoc = e.target.checked;
  if (id === "hinweis-newsumfang") h.newsUmfang = e.target.value === "alle" ? "alle" : "portfolio";
  if (id === "hinweis-newsmax") h.newsMax = +e.target.value || 3;
  if (id === "hinweis-marken") h.marken = e.target.checked;
  if (id === "hinweis-schwelle") h.schwelle = +e.target.value;
  if (id === "hinweis-stunden") h.stunden = +e.target.value;
  if (id === "hinweis-ergebnisse") h.ergebnisse = e.target.checked;
  if (id === "hinweis-schwellelauf") h.schwelleLauf = +e.target.value;
  sichern(); wachterAbgleich();
  if (id === "hinweis-an") meldung(h.an ? "Benachrichtigungen eingeschaltet." : "Benachrichtigungen ausgeschaltet.");
  zeichnen();
});
document.addEventListener("click", (ev) => {
  if (ev.target.closest('[data-los="hinweis-einstellungen"]')) { if (APP && APP.benachrichtigungEinstellungen) APP.benachrichtigungEinstellungen(); else meldung("Nur in der App."); return; }
  if (!ev.target.closest('[data-los="hinweis-test"]')) return;
  if (!APP || !APP.wachterTest) return meldung("Nur in der App.");
  APP.wachterTest(tr("Depot-Kompass – Hinweise"), "📊 Depot-Kompass", tr("So sieht eine Benachrichtigung aus."));
});

// ------------------------------------------------------------ 0.64: Benachrichtigungsverlauf + Pruefprotokoll
// Kommt verschluesselt aus dem Wachter (verlauf.bin). Zeigt jede Meldung (auch weggewischte) und jede Hintergrund-Pruefung.
const VERLAUF_ART = { alarm: "🔔", kurs: "📈", earnings: "📅", ergebnis: "📊", news: "📰", adhoc: "⚡" };
function verlaufDaten() {
  try { if (APP && APP.wachterVerlauf) return JSON.parse(APP.wachterVerlauf()); } catch { /* alte Fassung */ }
  return window.__verlaufTest || { eintraege: [], laeufe: [] };
}
function verlaufKarte() {
  const v = verlaufDaten(), e = v.eintraege || [], l = v.laeufe || [];
  const zeit = (t) => new Date(t).toLocaleString(sprache() === "en" ? "en-GB" : "de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  const offen = ui.verlaufAlle ? e : e.slice(0, 20);
  return `<section class="karte">
      <h3 style="margin-top:0">${tr("🕘 Verlauf")}</h3>
      <p class="klein" style="margin-top:0">${tr("Jede Meldung der letzten 90 Tage – auch weggewischte. Liegt verschlüsselt nur auf diesem Handy.")}</p>
      ${e.length ? `<div class="liste">${offen.map((x) => `<div class="zeile" style="grid-template-columns:auto minmax(0,1fr)"><span>${VERLAUF_ART[x.art] || "🔔"}</span>
        <span style="min-width:0"><span class="titel">${esc(x.titel || "")}</span><span class="unter">${esc(zeit(x.t))} · ${esc(x.text || "")}</span></span></div>`).join("")}</div>
        ${e.length > 20 && !ui.verlaufAlle ? `<button class="knopf klein" data-los="verlauf-alle">${tr("Alle anzeigen")} (${e.length})</button>` : ""}`
        : `<p class="klein">${tr("Noch keine Meldungen.")}</p>`}
      <h3>${tr("Prüfprotokoll")}</h3>
      <p class="klein" style="margin-top:0">${tr("Wann Android zuletzt geprüft hat – so siehst du, ob ein Alarm zur richtigen Zeit kam.")}</p>
      ${l.length ? `<div class="klein">${l.slice(0, 10).map((x) => `${esc(zeit(x.t))} · ${x.werte} ${tr("Werte geprüft")} · ${x.meldungen} ${tr("Meldungen")}${x.fehler ? ` · ${x.fehler} ${tr("ohne Antwort")}` : ""}`).join("<br>")}</div>`
        : `<p class="klein">${tr("Noch keine Prüfung gelaufen.")}</p>`}
      ${e.length || l.length ? `<button class="knopf" data-los="verlauf-leeren" style="width:100%;margin-top:10px">${tr("🗑️ Verlauf löschen")}</button>` : ""}
    </section>`;
}
document.addEventListener("click", (ev) => {
  if (ev.target.closest('[data-los="verlauf-alle"]')) { ui.verlaufAlle = true; zeichnen(); return; }
  if (!ev.target.closest('[data-los="verlauf-leeren"]')) return;
  if (!confirm(tr("Verlauf und Prüfprotokoll löschen?"))) return;
  try { if (APP && APP.wachterVerlaufLeeren) APP.wachterVerlaufLeeren(); } catch { /* alte Fassung */ }
  window.__verlaufTest = { eintraege: [], laeufe: [] };
  meldung(tr("Verlauf gelöscht.")); zeichnen();
});

// ------------------------------------------------------------ Depot verschluesselt teilen / empfangen (ab 0.47)
// Ein einzelnes Depot als .dksafe mit eigenem Passwort - z. B. damit jemand anderes es als "beobachtet" einliest.
// Enthalten: Name, Wertpapiere, Buchungen, Cash. Nicht enthalten: Notizen, Originale, Schluessel, andere Depots.
function depotTeilenKarte(id) {
  const d = S.depots[id];
  if (!d) return "";
  return `
    <form class="karte formular" id="depot-teilen-form" data-id="${esc(id)}">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:6px"><b style="min-width:0;overflow-wrap:anywhere">🔐 Depot verschlüsselt teilen</b><button class="knopf klein" type="button" data-depot-teilen="">schließen</button></div>
      <p class="klein" style="margin:0">Erstellt eine verschlüsselte Datei nur mit diesem Depot. Die andere Person liest sie mit dem Passwort ein – als eigenes, beobachtetes Depot. Ihre übrigen Daten bleiben unberührt.</p>
      <label>Name für den Empfänger<input name="name" value="${esc(d.name)}" maxlength="40" required></label>
      <label>Passwort (mind. 12 Zeichen)<input name="pw" type="password" autocomplete="new-password" required minlength="12"></label>
      <label>Passwort wiederholen<input name="pw2" type="password" autocomplete="new-password" required minlength="12"></label>
      <p class="klein" style="margin:0">Enthalten: Wertpapiere, Buchungen und Cash dieses Depots. Nicht enthalten: Notizen, Original-Dokumente, Schlüssel, andere Depots. Das Passwort am besten auf einem anderen Weg weitergeben (z. B. persönlich).</p>
      <div class="knoepfe"><button class="knopf haupt" type="submit" name="aktion" value="teilen">📤 Teilen</button>
        <button class="knopf" type="submit" name="aktion" value="speichern">💾 Speichern</button></div>
    </form>`;
}

function depotEmpfangSeite() {
  const e = ui.depotEmpfang, d = e.depot || {};
  const andere = Object.entries(S.depots);
  return `
    <h2><button class="knopf klein" data-los="empfang-weg">‹ Abbrechen</button><span>Geteiltes Depot</span></h2>
    <form class="karte formular" id="depot-empfang-form">
      <p style="margin-top:0"><b data-kein-tr>${esc(d.name || "Depot")}</b></p>
      <p class="klein" style="margin:0">${(d.buchungen || []).length} Buchungen · ${Object.keys(d.instrumente || {}).length} Wertpapiere</p>
      ${e.erstellt ? `<p class="klein" style="margin:0" data-kein-tr>${esc(datum(e.erstellt.slice(0, 10)))}</p>` : ""}
      <label>Wohin?<select name="ziel"><option value="">als neues Depot hinzufügen</option>
        ${andere.map(([id, x]) => `<option value="${esc(id)}">vorhandenes Depot ersetzen: ${esc(x.name)}</option>`).join("")}</select></label>
      <label>Name<input name="name" value="${esc(d.name || "Geteiltes Depot")}" maxlength="40" required></label>
      <label>Person (Familie/Haushalt)<input name="person" value="${esc(d.person || "")}" placeholder="z. B. Partner, Kind, Freund"></label>
      <label>Zählt zum Vermögen?<select name="rolle">
        <option value="beobachtet" selected>beobachtet – zählt nicht mit</option>
        <option value="eigen">mein Depot – zählt zum Vermögen</option></select></label>
      <button class="knopf haupt" type="submit">Depot übernehmen</button>
      <p class="klein" style="margin-bottom:0">Deine anderen Depots, Notizen und Einstellungen bleiben unverändert.</p>
    </form>`;
}

document.addEventListener("click", (ev) => {
  const x = ev.target.closest("[data-depot-teilen]");
  if (x) { ui.depotTeilen = x.dataset.depotTeilen || null; ui.depotEdit = null; zeichnen(); return scrollTo(0, 0); }
  if (ev.target.closest('[data-los="empfang-weg"]')) { ui.depotEmpfang = null; zeichnen(); }
});

document.addEventListener("submit", (ev) => {
  const form = ev.target;
  if (form.id === "depot-teilen-form") {
    ev.preventDefault();
    const f = new FormData(form), d = S.depots[form.dataset.id], pw = String(f.get("pw") || "");
    if (!d) return;
    if (pw.length < 12) return meldung("Mindestens 12 Zeichen.");
    if (!passwortStark(pw)) return meldung("Zu einfach – bitte Buchstaben und Zahlen mischen, keine Wiederholungen.");
    if (pw !== String(f.get("pw2") || "")) return meldung("Die Passwörter sind nicht gleich.");
    if (!APP || !APP.verschluesseln) return meldung("Nur in der App möglich.");
    const name = String(f.get("name") || d.name).trim() || "Depot";
    const inhalt = JSON.stringify({ depotKompassDepot: 1, version: 1, erstellt: new Date().toISOString(),
      depot: { name, instrumente: d.instrumente || {}, buchungen: d.buchungen || [], cash: d.cash ?? null, geaendert: d.geaendert || null } });
    const datei = APP.verschluesseln(inhalt, pw);
    if (!datei) return meldung("Verschlüsseln fehlgeschlagen.");
    const dateiname = "Depot-Kompass-Depot-" + name.replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30) + "-" + heute() + ".dksafe";
    const aktion = ev.submitter?.value || "teilen";
    const ok = aktion === "teilen" && APP.teilen ? APP.teilen(dateiname, "application/octet-stream", datei, false)
      : (APP.exportieren(dateiname, "application/octet-stream", datei), true);
    meldung(ok ? (aktion === "teilen" ? "Teilen-Menü geöffnet." : "Bitte Speicherort wählen.") : "Teilen fehlgeschlagen.");
    ui.depotTeilen = null; return zeichnen();
  }
  if (form.id === "depot-empfang-form") {
    ev.preventDefault();
    const f = new FormData(form), e = ui.depotEmpfang, d = e.depot || {};
    const ziel = String(f.get("ziel") || "");
    if (ziel && !confirm("Das gewählte Depot wird durch das geteilte ersetzt. Weiter?")) return;
    const neu = Object.assign(neuesDepot(String(f.get("name") || d.name || "Depot").trim(), String(f.get("rolle") || "beobachtet")),
      { instrumente: d.instrumente || {}, buchungen: d.buchungen || [], cash: d.cash ?? null, geaendert: new Date().toISOString() });
    const person = String(f.get("person") || "").trim(); if (person) neu.person = person;
    const id = ziel || neueId("d");
    S.depots[id] = neu; ui.depotEmpfang = null; oeffnen(id); sichern();
    meldung(ziel ? "Depot ersetzt." : "Depot hinzugefügt."); return zeige("uebersicht");
  }
});

// ------------------------------------------------------------ "Teilen -> Depot-Kompass" empfangen (ab 0.47)
window.geteiltBereit = () => geteiltVerarbeiten();
async function geteiltVerarbeiten() {
  if (!APP || !APP.geteiltAnzahl) return;
  const n = APP.geteiltAnzahl();
  if (!n) return;
  if (ui.gesperrt || ui.einfuehrung) return;            // nach dem Entsperren / nach der Einfuehrung erneut
  const dateien = [];
  for (let k = 0; k < n; k++) {
    let o = null;
    try { o = JSON.parse(APP.geteiltHolen(k) || "null"); } catch { /* unten */ }
    if (!o || !o.b64) continue;
    const bin = atob(o.b64), roh = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) roh[i] = bin.charCodeAt(i);
    dateien.push(new File([roh], o.name || "geteilt", { type: o.typ || "", lastModified: Date.now() }));
  }
  APP.geteiltFertig();
  if (!dateien.length) return meldung("Geteilte Datei nicht lesbar.");
  zeige("daten");
  meldung(`${dateien.length} geteilte Datei(en) – werden eingelesen …`);
  await dateienEinlesen(dateien);
}

// ------------------------------------------------------------ Credits & Unterstuetzen (ab 0.48 eigene Seite, Vorgabe 15.11.: nicht so praesent in "Ueber die App")
function unterstuetzenSeite() {
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>💜 Credits &amp; Unterstützen</span></h2>
    <h2>Credits</h2>
    <section class="karte">
      <p class="klein" style="margin-top:0"><b>Entwicklung</b> – Depot-Kompass-Team, programmiert mit Unterstützung von Claude (Anthropic).</p>
      <p class="klein"><b>Lizenz</b> – PolyForm Noncommercial 1.0.0: Der Code ist offen, private und nicht-kommerzielle Nutzung ist frei. Kommerzielle Nutzung nur mit Erlaubnis des Teams.</p>
      <p class="klein"><b>Fremde Bausteine</b> (in der App enthalten, laufen offline):</p>
      <ul class="klein">
        <li><b>Tesseract OCR</b> (tesseract-core 5.1.1, WebAssembly) – Texterkennung für Screenshots · Apache-2.0</li>
        <li><b>Tesseract-Sprachdaten Deutsch</b> (tessdata_best) – Apache-2.0</li>
      </ul>
      <p class="klein">Alles andere (Rechnen, PDF-Lesen, Charts, Verschlüsselung, ZIP) ist eigener Code ohne fremde Bibliotheken. Keine Google-Play-Dienste, keine Tracker – Google News und Gemini nur auf Knopfdruck.</p>
      <p class="klein"><b>Datenquellen</b> – nur auf Knopfdruck und nur, wenn Internet erlaubt ist:</p>
      <ul class="klein">
        <li><b>Yahoo Finance</b> – Kurse, Kursverlauf, Termine, Earnings, Schlagzeilen</li>
        <li><b>Onvista</b> – Kurse für Zertifikate, Optionsscheine, Anleihen (per ISIN/WKN)</li>
        <li><b>Google News</b> – Schlagzeilen (RSS)</li>
        <li><b>OpenRouter</b> – KI-Chat mit eigenem Schlüssel (auch Gratis-Modelle); ebenso Anthropic, OpenAI, Google</li>
      </ul>
    </section>
    <h2>💡 Inspiration</h2>
    <section class="karte">
      <p class="klein" style="margin-top:0"><b>r/mauerstrassenwetten</b> (Reddit) – danke für Ideen, Diskussionen und die Erinnerung, dass zu jedem Depot auch Verluste und Risiko gehören.</p>
      <p class="klein"><b>Claude (Anthropic)</b> – Inspirationsquelle und Coding-Helfer bei der Entwicklung.</p>
    </section>
    <h2>Unterstützen</h2>
    <section class="karte">
      <p class="klein" style="margin-top:0">Depot-Kompass ist kostenlos und bleibt ohne Werbung. Wer das Projekt unterstützen möchte, kann anonym spenden – danke!</p>
      <p class="klein">Bitte nur im jeweils genannten Netz senden – sonst geht die Spende verloren.</p>
      ${spendenZeilen()}
    </section>`;
}

// ------------------------------------------------------------ Fehlerprotokoll (ab 0.59, Vorgabe 17.11.: Log-Sammler mit genauer Auswertung)
// Java schreibt files/fehler.log (Waechter, Abstuerze, JavaScript-Fehler aus der Konsole); die Oberflaeche ergaenzt Fehler-Meldungen
// (Zahlen maskiert). Nur technische Texte - keine Betraege, Stueckzahlen, Konten, Schluessel. Raus nur per "Teilen"/"Kopieren".
window.__protokoll = window.__protokoll || [];
function protokoll(bereich, text) {
  const t = String(text || "").slice(0, 1500);
  try { if (APP && APP.protokoll) return APP.protokoll(bereich, t); } catch { /* weiter im Speicher */ }
  window.__protokoll.push(`${new Date().toISOString().replace("T", " ").slice(0, 19)} | ${bereich} | ${t}`);
  if (window.__protokoll.length > 300) window.__protokoll.shift();
}
function protokollText() {
  try { if (APP && APP.protokollLesen) return APP.protokollLesen() || ""; } catch { /* Browser */ }
  return window.__protokoll.join("\n");
}
// 0.59: Fehlercodes (Vorgabe 17.11.: "Fehlercode anzeigen und per E-Mail weiterleiten") - Reihenfolge = Code DK-01 ... DK-08, sonst DK-99
const PROTOKOLL_URSACHEN = [
  [/netzAus|Internet in der App aus/i, "Internet ist in der App ausgeschaltet (⚙️ → Datenschutz) – dann gibt es keine Benachrichtigungen."],
  [/erlaubt=false|nicht erlaubt/i, "Android verbietet der App Benachrichtigungen – Mehr → 🔔 Benachrichtigungen → „Android-Einstellungen öffnen“."],
  [/KeyStore|Keystore|AEADBadTag|InvalidKey|KeyPermanentlyInvalidated|UnrecoverableKey/i, "Android-Schlüsselspeicher (Keystore) hat den Schlüssel abgelehnt – ab 0.58 wird er automatisch neu angelegt; tritt es weiter auf: an uns schicken."],
  [/JobScheduler|JobInfo|schedule|IllegalStateException|IllegalArgumentException/i, "Android hat die Hintergrund-Prüfung (JobScheduler) abgelehnt – Akku-Optimierung für die App prüfen."],
  [/geplant=false/i, "Die Hintergrund-Prüfung ist nicht eingeplant."],
  [/JSONException|Unterminated|SyntaxError/i, "Die Liste für den Wächter war fehlerhaft (JSON) – bitte an uns schicken."],
  [/Failed to fetch|NetworkError|timeout|Timeout|UnknownHost|HTTP \d|SocketException/i, "Datenquelle nicht erreichbar (Netz, Yahoo/Onvista) – meist vorübergehend."],
  [/OutOfMemory/i, "Zu wenig Arbeitsspeicher – sehr große Daten oder viele Screenshots."],
  [/SecurityException|permission\./i, "Der App fehlt eine Android-Berechtigung – das ist ein Fehler der App (z. B. ACCESS_NETWORK_STATE, behoben in 0.60). Bitte Fehlercode an uns schicken."],
];
/** Gruppiert gleiche Fehler (Zeit und Zahlen raus), zaehlt sie und nennt bekannte Ursachen. */
function protokollAuswerten(text) {
  const g = new Map();
  for (const z of String(text || "").split("\n").filter((x) => x.includes(" | "))) {
    const [zeit, bereich, ...rest] = z.split(" | "), msg = rest.join(" | ");
    const k = bereich + " | " + msg.replace(/\d[\d.,:]*/g, "#").slice(0, 160);
    const e = g.get(k) || { bereich, msg, anzahl: 0, erst: zeit, zuletzt: zeit };
    e.anzahl++; e.zuletzt = zeit; g.set(k, e);
  }
  return [...g.values()].sort((a, b) => b.zuletzt.localeCompare(a.zuletzt)).map((e) => {
    const n = PROTOKOLL_URSACHEN.findIndex(([re]) => re.test(e.bereich + " " + e.msg));
    return { ...e, code: n < 0 ? "DK-99" : "DK-" + String(n + 1).padStart(2, "0"), ursache: n < 0 ? "" : PROTOKOLL_URSACHEN[n][1] };
  });
}
/** Kurzbericht fuer die E-Mail: Version, Geraet, je Fehler Code + Anzahl + Text (gekuerzt, passt in einen mailto-Link). */
function protokollBericht(kopf, liste) {
  let b = kopf + "\n\n" + (liste.length ? liste.map((e) => `${e.code} · ${e.anzahl}× · zuletzt ${e.zuletzt} · ${e.bereich}: ${e.msg.slice(0, 240)}`).join("\n") : "Keine Fehler aufgezeichnet.");
  if (b.length > 1800) b = b.slice(0, 1800) + "\n… (gekürzt – ganzes Protokoll bitte über „Teilen“ anhängen)";
  return b;
}
function fehlerprotokollSeite() {
  const text = protokollText(), liste = protokollAuswerten(text);
  let geraet = ""; try { geraet = APP && APP.protokollGeraet ? APP.protokollGeraet() : navigator.userAgent.replace(/^.*?\(|\).*$/g, ""); } catch { /* egal */ }
  const kopf = `Depot-Kompass ${appVersion()} · ${geraet}`;
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>🐞 Fehlerprotokoll</span></h2>
    <section class="karte">
      <p class="klein" style="margin-top:0">Die App sammelt hier technische Fehler (Benachrichtigungen, Abstürze, Skript-Fehler, Fehlermeldungen). <b>Keine Beträge, Stückzahlen, Konten oder Schlüssel</b> – Zahlen in Meldungen werden durch # ersetzt. Das Protokoll bleibt auf dem Handy, bis du es selbst teilst.</p>
      <p class="klein" style="margin-bottom:0">${esc(kopf)}</p><p class="klein" style="margin-top:2px">${text ? text.split("\n").filter(Boolean).length : 0} Einträge</p>
      <button class="knopf haupt" data-kopieren="${esc(protokollBericht(kopf, liste))}" style="width:100%;margin-bottom:8px">📋 Fehlercodes kopieren</button>
      <a class="knopf" href="${DISCORD}" style="display:block;text-align:center;text-decoration:none;margin-bottom:8px">💬 Discord-Ticket öffnen und einfügen</a>
      <p class="klein" style="margin-top:0">Kopiert nur die Fehlercodes (ohne Beträge) – du fügst sie selbst im Ticket ein und entscheidest, was du schickst.</p>
      <div class="zwei"><button class="knopf" data-los="protokoll-teilen">📤 Ganzes Protokoll teilen</button><button class="knopf" data-kopieren="${esc(kopf + "\n" + text)}">📋 Kopieren</button></div>
      <button class="knopf" data-los="protokoll-leeren" style="width:100%;margin-top:8px">🗑️ Protokoll leeren</button>
    </section>
    <h2>Auswertung<span>${liste.length}</span></h2>
    <section class="karte liste">${liste.length ? liste.map((e) => `
      <div class="zeile" style="grid-template-columns:minmax(0,1fr) auto">
        <span style="min-width:0"><span class="titel"><b class="mono">${e.code}</b> · ${esc(e.bereich)}</span>
          <span class="unter" style="white-space:normal;overflow-wrap:anywhere">${esc(e.msg)}${e.ursache ? `<br><b>➜ ${esc(e.ursache)}</b>` : ""}</span></span>
        <span class="rechts"><b>${e.anzahl}×</b><span class="klein">${esc(e.zuletzt.slice(5, 16))}</span></span>
      </div>`).join("") : `<p class="klein" style="margin:8px">Keine Fehler aufgezeichnet. Wenn etwas schiefgeht (z. B. beim Aktualisieren), hier nachsehen.</p>`}</section>`;
}
document.addEventListener("click", (ev) => {
  const x = ev.target.closest('[data-los="protokoll-teilen"],[data-los="protokoll-leeren"]');
  if (!x) return;
  if (x.dataset.los === "protokoll-leeren") {
    try { if (APP && APP.protokollLeeren) APP.protokollLeeren(); } catch { /* Browser */ }
    window.__protokoll = []; meldung("Protokoll geleert."); return zeichnen();
  }
  let geraet = ""; try { geraet = APP && APP.protokollGeraet ? APP.protokollGeraet() : ""; } catch { /* egal */ }
  const inhalt = `Depot-Kompass ${appVersion()} · ${geraet}\n\n` + protokollText();
  if (APP && APP.teilen) { if (!APP.teilen("depot-kompass-fehlerprotokoll.txt", "text/plain", inhalt, false)) meldung("Teilen ging nicht."); }
  else { try { navigator.clipboard.writeText(inhalt); meldung("In die Zwischenablage kopiert."); } catch { meldung("Kopieren ging nicht – bitte von Hand markieren."); } }
});

// ------------------------------------------------------------ Alarme (ab 0.62)
// Vorgabe 17.11.: eigener Reiter in der Watchlist, mehrere benannte Alarme je Wert, Marke unter/ueber, Zone von-bis,
// Bewegung in %. Werte aus Watchlist und eigenen Depots. Alte Kauf-/Verkaufsmarke und "Alarm unter/ueber" werden uebernommen.
// S.alarme = [{ id, name, bezug: "w:<watchId>" | "p:<depotId>:<instId>", art: unter|ueber|zone|prozent, wert, von, bis, prozent, basis, an, erstellt }]
const ALARM_ARTEN = { unter: "Kurs fällt unter", ueber: "Kurs steigt über", zone: "Kurs in Zone (von–bis)", prozent: "Bewegung in % seit dem Setzen" };

function alarme() {
  const l = (S.alarme ??= []);
  // Uebernahme der alten Felder (Watchlist bis 0.61, Positionen 0.61) - laeuft bei jedem Aufruf, auch nach Import alter Sicherungen
  for (const w of S.watchlist || []) {
    if (w.kaufMarke != null) l.push({ id: neueId("a"), name: "Kaufmarke", bezug: "w:" + w.id, art: "unter", wert: w.kaufMarke, an: true, erstellt: heute() });
    if (w.verkaufMarke != null) l.push({ id: neueId("a"), name: "Verkaufsmarke", bezug: "w:" + w.id, art: "ueber", wert: w.verkaufMarke, an: true, erstellt: heute() });
    delete w.kaufMarke; delete w.verkaufMarke;
  }
  for (const [did, d] of Object.entries(S.depots || {}))
    for (const [iid, i] of Object.entries(d.instrumente || {})) {
      if (i.alarmUnter != null) l.push({ id: neueId("a"), name: "Alarm unter", bezug: `p:${did}:${iid}`, art: "unter", wert: i.alarmUnter, an: true, erstellt: heute() });
      if (i.alarmUeber != null) l.push({ id: neueId("a"), name: "Alarm über", bezug: `p:${did}:${iid}`, art: "ueber", wert: i.alarmUeber, an: true, erstellt: heute() });
      delete i.alarmUnter; delete i.alarmUeber;
    }
  // eingefuegte "prozent"-Alarme ohne Ausgangskurs bekommen ihn, sobald der Wert einen Kurs hat
  for (const a of l) if (a.art === "prozent" && !(a.basis > 0)) { const w = alarmWert(a.bezug); if (w && w.kurs > 0) { a.basis = w.kurs; a.basisBezug = a.bezug; } }
  return l;
}

/** Wert hinter einem Alarm: Name, Ticker (nur wenn Yahoo-Kurs), Kurs in Euro, Herkunft. */
function alarmWert(bezug) {
  const [typ, a, b] = String(bezug || "").split(":");
  if (typ === "w") {
    const w = (S.watchlist || []).find((x) => x.id === a);
    return w ? { name: w.name, ticker: w.kursHand ? "" : (w.ticker || ""), kurs: w.kurs, herkunft: "Watchlist" } : null;
  }
  if (typ === "p") {
    const d = S.depots?.[a], i = d?.instrumente?.[b];
    return i ? { name: i.name || b, ticker: i.ticker || "", kurs: i.kurs, herkunft: d.name } : null;
  }
  return null;
}

/** Alle waehlbaren Werte: Watchlist und alle Depots (Werte mit Kurs oder Ticker). */
function alarmWerteListe() {
  const l = (S.watchlist || []).map((w) => ({ bezug: "w:" + w.id, name: w.name, herkunft: "Watchlist" }));
  for (const [did, d] of Object.entries(S.depots || {}))
    for (const [iid, i] of Object.entries(d.instrumente || {}))
      if (i.ticker || i.kurs != null) l.push({ bezug: `p:${did}:${iid}`, name: i.name || iid, herkunft: d.name });
  return l.sort((x, y) => (x.name || "").localeCompare(y.name || "", "de"));
}

/** Zustand eines Alarms beim aktuellen Kurs: erreicht ja/nein und Abstand in % (positiv = Kurs muss steigen). */
function alarmStand(a, kurs) {
  if (kurs == null || !(kurs > 0)) return { erreicht: false, abstand: null };
  if (a.art === "unter") return { erreicht: kurs <= a.wert, abstand: (a.wert / kurs - 1) * 100 };
  if (a.art === "ueber") return { erreicht: kurs >= a.wert, abstand: (a.wert / kurs - 1) * 100 };
  if (a.art === "zone") {
    const lo = Math.min(a.von, a.bis), hi = Math.max(a.von, a.bis);
    return { erreicht: kurs >= lo && kurs <= hi, abstand: kurs < lo ? (lo / kurs - 1) * 100 : kurs > hi ? (hi / kurs - 1) * 100 : 0 };
  }
  if (a.art === "prozent" && a.basis > 0) {
    const jetzt = (kurs / a.basis - 1) * 100;
    return { erreicht: a.prozent < 0 ? jetzt <= a.prozent + 1e-9 : jetzt >= a.prozent - 1e-9, abstand: null, bewegung: jetzt };   // 1e-9: Rundung (90/100-1 = -9,999…)
  }
  return { erreicht: false, abstand: null };
}

/** Bedingung als kurzer Text (Euro). */
function alarmBedingung(a, roh = false) {
  // roh: fuer die Benachrichtigung - nie verdeckt (Schalter "Betraege aus" gilt nur fuer die Anzeige)
  const k = (x) => roh ? fEur.format(x) : kursE(x), p = (x) => roh ? (x > 0 ? "+" : "") + fPct.format(x) + " %" : pct(x);
  if (a.art === "unter") return `unter ${k(a.wert)}`;
  if (a.art === "ueber") return `über ${k(a.wert)}`;
  if (a.art === "zone") return `Zone ${k(Math.min(a.von, a.bis))} – ${k(Math.max(a.von, a.bis))}`;
  if (a.art === "prozent") return `${p(a.prozent)} ab ${k(a.basis)}`;
  return "";
}

/** Erreichte, eingeschaltete Alarme eines Bezugs (fuer die Markierung in der Watchlist). */
function alarmeErreicht(bezug) {
  const w = alarmWert(bezug);
  return alarme().filter((a) => a.bezug === bezug && a.an !== false && w && alarmStand(a, w.kurs).erreicht);
}

function alarmZeile(a) {
  const w = alarmWert(a.bezug);
  const st = alarmStand(a, w?.kurs);
  const zustand = a.an === false ? `<span class="marke-status st-ok">aus</span>`
    : st.erreicht ? `<span class="marke-status st-pruefen">erreicht</span>` : "";
  const abstand = st.bewegung != null ? `<span>bisher ${pct(st.bewegung)}</span>`
    : st.abstand != null && !st.erreicht ? `<span>noch ${pct(st.abstand)}</span>` : "";
  return `
    <button class="zeile" data-alarm="${esc(a.id)}" style="grid-template-columns:minmax(0,1fr) auto">
      <span style="min-width:0"><span class="titel"><span data-kein-tr>${esc(a.name || "Alarm")}</span>${zustand}</span>
        <span class="unter"><span data-kein-tr>${esc(w ? w.name : "Wert fehlt")}</span> · <span>${alarmBedingung(a)}</span>${w && !w.ticker ? ' · <span class="warn-t">ohne Ticker: nur in der App</span>' : ""}</span></span>
      <span class="rechts"><b>${w && w.kurs != null ? kursE(w.kurs) : "kein Kurs"}</b>${abstand}</span>
    </button>`;
}

/** Reiter "🔔 Alarme" der Watchlist. */
function alarmSeite() {
  const l = [...alarme()].sort((x, y) => ((alarmWert(x.bezug)?.name || "").localeCompare(alarmWert(y.bezug)?.name || "", "de")) || (x.name || "").localeCompare(y.name || "", "de"));
  const erreicht = l.filter((a) => a.an !== false && alarmStand(a, alarmWert(a.bezug)?.kurs).erreicht).length;
  return `
    <h2>Alarme <span>${l.length}${erreicht ? ` · <span class="warn-t">${erreicht} erreicht</span>` : ""}</span></h2>
    <section class="karte liste">${l.map(alarmZeile).join("") ||
      `<p class="klein" style="margin:8px">Noch keine Alarme. Unten rechts auf + tippen: Wert wählen, Namen geben (z. B. „Kaufzone“, „Stop“, „Ziel 1“) und Marke, Zone oder Bewegung in % festlegen. Pro Wert gehen beliebig viele Alarme.</p>`}</section>
    ${alarmToeneKarte(l)}
    <div class="zwei"><button class="knopf" data-alarm-import="auf">📥 Alarme einfügen</button>
      <button class="knopf" data-alarm-teilen="alle" ${l.length ? "" : "disabled"}>📤 Alle teilen</button></div>
    ${ui.alarmImport ? `<section class="karte formular" style="margin-top:10px">
      <label>Alarme als Text einfügen (eine Zeile je Alarm)<textarea id="alarm-import-text" rows="7" placeholder="Bitcoin | BTC-EUR | Kaufzone | zone 54.000 bis 56.000"></textarea></label>
      <p class="klein" style="margin:0">Aufbau: <b>Wert | Ticker | Name | Bedingung</b>. Bedingung: „unter 1.300“, „über 1.650“, „zone 1.380 bis 1.420“ oder „prozent -10“. Gibt es den Wert noch nicht, kommt er in die Watchlist. Der Text enthält nur Namen und Kurse – keine Beträge.</p>
      <div class="zwei"><button class="knopf haupt" data-alarm-import="los">Übernehmen</button><button class="knopf" data-alarm-import="zu">Abbrechen</button></div></section>` : ""}
    ${legende(["Geprüft wird bei jedem „Kurse & Daten aktualisieren“ (oben rechts 🔄) – erreichte Alarme stehen hier und in der Watchlist.",
      "Mit eingeschalteten Benachrichtigungen (⚙️ → Mehr → 🔔) meldet sich das Handy zusätzlich. Android prüft dafür nur alle paar Stunden – kein Sekunden-Alarm wie in einer Trading-App.",
      "Ein Alarm meldet sich einmal und ist wieder scharf, sobald der Kurs die Marke oder Zone verlassen hat.",
      "Werte ohne Yahoo-Ticker (z. B. Zertifikate, Handkurs) prüft nur die App selbst, nicht der Hintergrund.",
      "Teilen und Einfügen geht als einfacher Text (unverschlüsselt) – so kannst du einzelne Alarme weitergeben oder dir selbst schicken. Er enthält nur Wert, Ticker, Name und Kurs-Marken."], "ℹ️ So funktionieren die Alarme")}
    <button class="fab" data-alarm="neu" aria-label="Alarm hinzufügen">+</button>`;
}

// 0.80 (Vorgabe 23.11.): eigene Alarm-Toene je Wert - res/raw/ton_1..8.wav, selbst erzeugt (werkzeuge/toene_bauen.py)
const ALARM_TOENE = ["Zweiklang hoch", "Zweiklang tief", "Dreifach-Piep", "Glocke", "Aufsteigend", "Absteigend", "Klopfen", "Sirene kurz"];
function alarmToeneKarte(l) {
  const werte = new Map();
  for (const a of l) { const w = alarmWert(a.bezug); if (w && w.ticker && !werte.has(w.ticker)) werte.set(w.ticker, w.name); }
  if (!l.length) return "";
  const toene = EIN().alarmToene || {}, hoeren = !!(APP && APP.tonVorhoeren);
  const zeilen = [...werte].map(([ticker, name]) => {
    const t = +toene[ticker] || 0;
    return `<div class="zeile" style="grid-template-columns:minmax(0,1fr) auto auto;gap:8px;align-items:center">
      <span style="min-width:0"><span class="titel">${esc(name)}</span><span class="unter">${esc(ticker)}</span></span>
      <select data-alarm-ton="${esc(ticker)}" aria-label="Ton wählen" style="max-width:min(9em,30vw)"><option value="0">Standard (Handy-Ton)</option>${ALARM_TOENE.map((n, i) => `<option value="${i + 1}" ${t === i + 1 ? "selected" : ""}>${n}</option>`).join("")}</select>
      ${hoeren ? `<button class="knopf klein" type="button" data-ton-hoeren="${esc(ticker)}" ${t ? "" : "disabled"}>▶ Anhören</button>` : ""}</div>`;
  }).join("");
  return `<h2>🔊 Ton je Wert</h2><section class="karte liste">${zeilen || `<p class="klein" style="margin:8px">Töne gibt es für Werte mit Yahoo-Ticker (nur die prüft der Hintergrund).</p>`}
    <p class="klein" style="margin:8px">Jeder Wert kann einen eigenen Ton bekommen – so hörst du am Klang, welcher Wert sich meldet. Melden sich mehrere gleichzeitig, kommen die Töne nacheinander (ca. 2 Sekunden Abstand). Lautstärke und Ton lassen sich zusätzlich in den Android-Einstellungen je Kanal ändern.</p>
    ${hoeren ? "" : `<p class="klein" style="margin:8px">Anhören geht nur in der Android-App – der Desktop hat keine Benachrichtigungen.</p>`}</section>`;
}
document.addEventListener("change", (ev) => {
  const t = ev.target.dataset?.alarmTon;
  if (t == null) return;
  const n = +ev.target.value;
  const m = (S.einstellungen ||= {}).alarmToene ||= {};
  if (n >= 1 && n <= ALARM_TOENE.length) m[t] = n; else delete m[t];
  sichern(); if (typeof wachterAbgleich === "function") wachterAbgleich();
  if (n && APP && APP.tonVorhoeren) APP.tonVorhoeren(n);
  meldung("Ton gespeichert."); zeichnen();
});
document.addEventListener("click", (ev) => {
  const b = ev.target.closest?.("[data-ton-hoeren]");
  if (!b) return;
  const n = +((EIN().alarmToene || {})[b.dataset.tonHoeren] || 0);
  if (n && APP && APP.tonVorhoeren) APP.tonVorhoeren(n);
});

/** Kleine Liste der Alarme eines Werts (Watchlist-Eintrag oder Position) mit "+ Alarm". */
function alarmeZu(bezug) {
  const l = alarme().filter((a) => a.bezug === bezug);
  return `<h2>🔔 Alarme</h2>
    <section class="karte liste">${l.map(alarmZeile).join("") || `<p class="klein" style="margin:8px">Noch kein Alarm für diesen Wert.</p>`}
      <div style="padding:8px"><button class="knopf" type="button" data-alarm="neu" data-alarm-bezug="${esc(bezug)}" style="width:100%">+ Alarm für diesen Wert</button></div></section>`;
}

function alarmFormular() {
  const neu = ui.alarm === "neu";
  const a = ui.alarmEntwurf ??= neu ? { name: "", bezug: ui.alarmBezug || "", art: "unter", an: true }
    : { ...(alarme().find((x) => x.id === ui.alarm) || {}) };
  const z = (x) => x != null ? String(x).replace(".", ",") : "";
  const w = alarmWert(a.bezug);
  const werte = alarmWerteListe();
  const feld = (art, html) => a.art === art ? html : "";
  return `
    <h2><button class="knopf klein" data-los="zurueck">‹ Zurück</button><span>${neu ? "Neuer Alarm" : "Alarm"}</span></h2>
    <form class="karte formular" id="alarm-form">
      <label>Wert<select name="bezug" data-alarm-feld required><option value="">– Wert wählen –</option>${werte.map((x) =>
        `<option value="${esc(x.bezug)}" ${x.bezug === a.bezug ? "selected" : ""}>${esc(x.name)} · ${esc(x.herkunft)}</option>`).join("")}</select></label>
      ${w ? `<p class="klein" style="margin:0">Kurs jetzt: <b>${w.kurs != null ? kursE(w.kurs) : "kein Kurs"}</b>${!w.ticker ? ' · <span class="warn-t">ohne Ticker – nur die App prüft, kein Hintergrund-Alarm</span>' : ""}</p>` : ""}
      <label>Name<input name="name" value="${esc(a.name || "")}" placeholder="z. B. Kaufzone, Stop, Ziel 1, Nachkauf 2" maxlength="40"></label>
      <label>Art<select name="art" data-alarm-feld>${Object.entries(ALARM_ARTEN).map(([k, t]) => `<option value="${k}" ${a.art === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      ${feld("unter", `<label>Kurs € (melden bei Kurs ≤)<input name="wert" inputmode="decimal" value="${z(a.wert)}" required></label>`)}
      ${feld("ueber", `<label>Kurs € (melden bei Kurs ≥)<input name="wert" inputmode="decimal" value="${z(a.wert)}" required></label>`)}
      ${feld("zone", `<div class="zwei"><label>von €<input name="von" inputmode="decimal" value="${z(a.von)}" required></label>
        <label>bis €<input name="bis" inputmode="decimal" value="${z(a.bis)}" required></label></div>
        <p class="klein" style="margin:0">Meldet sich, sobald der Kurs in die Zone läuft – egal ob von oben oder von unten.</p>`)}
      ${feld("prozent", `<label>Bewegung in % (z. B. −10 oder 15)<input name="prozent" inputmode="decimal" value="${z(a.prozent)}" required></label>
        ${a.basis || w?.kurs != null ? `<p class="klein" style="margin:0">Gerechnet ab dem Kurs beim Speichern: <b>${kursE(a.basis || w.kurs)}</b></p>` : ""}
        <p class="klein" style="margin:0">Minus = Rückgang, Plus = Anstieg.</p>`)}
      <label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer;padding:0">
        <span>Alarm eingeschaltet</span><input type="checkbox" name="an" ${a.an !== false ? "checked" : ""} style="width:26px;height:26px"></label>
      <div class="knoepfe"><button class="knopf haupt" type="submit">Speichern</button>
        ${!neu ? `<button class="knopf" type="button" data-alarm-teilen="${esc(ui.alarm)}">📤 Teilen</button>
        <button class="knopf gefahr" type="button" data-alarm-loeschen="${esc(ui.alarm)}">Löschen</button>` : ""}</div>
    </form>`;
}

/** Formularstand in den Entwurf uebernehmen (bei Wechsel von Wert oder Art neu zeichnen). */
function alarmEntwurfLesen() {
  const f = document.getElementById("alarm-form");
  if (!f || !ui.alarmEntwurf) return;
  const d = new FormData(f), a = ui.alarmEntwurf;
  a.bezug = String(d.get("bezug") || ""); a.name = String(d.get("name") || "").trim(); a.art = String(d.get("art") || "unter"); a.an = !!d.get("an");
  for (const k of ["wert", "von", "bis", "prozent"]) if (d.has(k)) a[k] = zahl(d.get(k));
}

document.addEventListener("change", (e) => {
  if (!e.target.closest("#alarm-form") || !e.target.hasAttribute("data-alarm-feld")) return;
  alarmEntwurfLesen(); zeichnen();
});
document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  let x;
  if ((x = t("[data-watch-reiter]"))) { ui.watchReiter = x.dataset.watchReiter; return zeichnen(); }
  if ((x = t("[data-alarm]"))) {
    ui.alarm = x.dataset.alarm; ui.alarmEntwurf = null; ui.alarmBezug = x.dataset.alarmBezug || "";
    zeichnen(); return scrollTo(0, 0);
  }
  if ((x = t("[data-alarm-loeschen]"))) {
    if (!confirm("Diesen Alarm löschen?")) return;
    S.alarme = alarme().filter((a) => a.id !== x.dataset.alarmLoeschen);
    ui.alarm = null; ui.alarmEntwurf = null; sichern(); meldung("Alarm gelöscht."); return zeichnen();
  }
});
document.addEventListener("submit", (e) => {
  if (e.target.id !== "alarm-form") return;
  e.preventDefault();
  alarmEntwurfLesen();
  const a = ui.alarmEntwurf, w = alarmWert(a.bezug);
  if (!w) return meldung("Bitte einen Wert wählen.");
  if ((a.art === "unter" || a.art === "ueber") && !(a.wert > 0)) return meldung("Bitte einen Kurs eintragen.");
  if (a.art === "zone" && !(a.von > 0 && a.bis > 0)) return meldung("Bitte die Zone (von und bis) eintragen.");
  if (a.art === "prozent") {
    if (!a.prozent) return meldung("Bitte eine Bewegung in % eintragen, z. B. −10.");
    if (!a.basis || a.basisBezug !== a.bezug) {
      if (!(w.kurs > 0)) return meldung("Für „Bewegung in %“ braucht der Wert einen Kurs – erst „Kurse & Daten aktualisieren“.");
      a.basis = w.kurs; a.basisBezug = a.bezug;
    }
  }
  const sauber = { name: a.name || { unter: "Unter-Marke", ueber: "Über-Marke", zone: "Zone", prozent: "Bewegung" }[a.art], bezug: a.bezug, art: a.art, an: a.an !== false };
  if (a.art === "unter" || a.art === "ueber") sauber.wert = a.wert;
  if (a.art === "zone") { sauber.von = Math.min(a.von, a.bis); sauber.bis = Math.max(a.von, a.bis); }
  if (a.art === "prozent") { sauber.prozent = a.prozent; sauber.basis = a.basis; sauber.basisBezug = a.basisBezug; }
  const l = alarme();
  if (ui.alarm === "neu") l.push({ id: neueId("a"), erstellt: heute(), ...sauber });
  else { const alt = l.find((x) => x.id === ui.alarm); if (alt) { for (const k of ["wert", "von", "bis", "prozent", "basis", "basisBezug"]) delete alt[k]; Object.assign(alt, sauber); } }
  ui.alarm = null; ui.alarmEntwurf = null;
  sichern(); meldung(w.ticker ? "Alarm gespeichert." : "Alarm gespeichert – ohne Ticker prüft ihn nur die App, kein Hintergrund-Alarm.");
  return zeichnen();
});

// ------------------------------------------------------------ Alarme als Text teilen / einfuegen (0.62)
// Eine Zeile je Alarm:  Wert | Ticker | Name | Bedingung   (Bedingung: unter X · über X · zone X bis Y · prozent P [ab B])
// Unverschluesselt mit Absicht (Vorgabe 17.11.: "Alarme einzeln unverschluesselt importieren und exportieren") - enthaelt keine Betraege.
const alarmZahlText = (x) => String(rund(x, 8)).replace(".", ",");
function alarmAlsText(a) {
  const w = alarmWert(a.bezug) || {};
  const b = a.art === "unter" ? `unter ${alarmZahlText(a.wert)}` : a.art === "ueber" ? `über ${alarmZahlText(a.wert)}`
    : a.art === "zone" ? `zone ${alarmZahlText(a.von)} bis ${alarmZahlText(a.bis)}`
    : `prozent ${alarmZahlText(a.prozent)}${a.basis > 0 ? " ab " + alarmZahlText(a.basis) : ""}`;
  return [w.name || "", w.ticker || "", a.name || "", b].map((x) => String(x).replace(/[|\n]/g, " ").trim()).join(" | ");
}
function alarmeTextKopf() { return "# Depot-Kompass – Alarme (Wert | Ticker | Name | Bedingung)"; }

/** Text lesen -> { neu: [...], fehler: [...] }. Legt fehlende Werte als Watchlist-Eintrag an (nur wenn anwenden). */
function alarmeAusText(text, anwenden = true) {
  const neu = [], fehler = [];
  for (const [n, roh] of String(text || "").split(/\r?\n/).entries()) {
    const z = roh.trim();
    if (!z || z.startsWith("#")) continue;
    const t = z.split("|").map((x) => x.trim());
    if (t.length < 4) { fehler.push(`Zeile ${n + 1}: zu wenige Teile`); continue; }
    const [wert, ticker, name] = t, bed = t.slice(3).join(" ").replace(/\s+/g, " ");
    const m = bed.match(/^(unter|über|ueber|zone|prozent|%)\s+(.+)$/i);
    if (!m) { fehler.push(`Zeile ${n + 1}: Bedingung unbekannt`); continue; }
    const art = { "über": "ueber", "%": "prozent" }[m[1].toLowerCase()] || m[1].toLowerCase();
    const a = { name: name.slice(0, 40) || "Alarm", art, an: true };
    if (art === "zone") {
      const zz = m[2].split(/\s+bis\s+|\s*[–—-]\s*/i).map(zahl);
      if (zz.length !== 2 || !(zz[0] > 0 && zz[1] > 0)) { fehler.push(`Zeile ${n + 1}: Zone unklar`); continue; }
      a.von = Math.min(...zz); a.bis = Math.max(...zz);
    } else if (art === "prozent") {
      const pz = m[2].split(/\s+ab\s+/i); a.prozent = zahl(pz[0].replace("%", "")); if (pz[1]) a.basis = zahl(pz[1]);
      if (!a.prozent) { fehler.push(`Zeile ${n + 1}: Prozent fehlt`); continue; }
    } else { a.wert = zahl(m[2]); if (!(a.wert > 0)) { fehler.push(`Zeile ${n + 1}: Kurs fehlt`); continue; } }
    a.wertName = wert; a.ticker = ticker.toUpperCase();
    neu.push(a);
  }
  if (!anwenden) return { neu, fehler };
  const l = alarme();
  let angelegt = 0, doppelt = 0, ueber = 0;
  for (const a of neu) {
    const tk = a.ticker, nm = (a.wertName || "").toLowerCase();
    let bezug = "";
    const w = (S.watchlist || []).find((x) => (tk && (x.ticker || "").toUpperCase() === tk) || (!tk && (x.name || "").toLowerCase() === nm));
    if (w) bezug = "w:" + w.id;
    if (!bezug) for (const [did, d] of Object.entries(S.depots || {})) {
      const e = Object.entries(d.instrumente || {}).find(([, i]) => (tk && (i.ticker || "").toUpperCase() === tk) || (!tk && (i.name || "").toLowerCase() === nm));
      if (e) { bezug = `p:${did}:${e[0]}`; break; }
    }
    if (!bezug) {
      if (!a.wertName && !tk) { fehler.push("Alarm ohne Wert übersprungen"); continue; }
      const nw = { id: neueId("w"), aufgenommen: heute(), name: a.wertName || tk, kennung: tk, ticker: tk, art: /-(EUR|USD)$/.test(tk) ? "Krypto" : "Aktie" };
      (S.watchlist ??= []).push(nw); bezug = "w:" + nw.id; ueber++;
    }
    const x = { name: a.name, bezug, art: a.art, an: true };
    for (const k of ["wert", "von", "bis", "prozent", "basis"]) if (a[k] != null) x[k] = a[k];
    if (x.basis) x.basisBezug = bezug;
    if (l.some((y) => y.bezug === bezug && y.art === x.art && y.name === x.name && y.wert === x.wert && y.von === x.von && y.bis === x.bis && y.prozent === x.prozent)) { doppelt++; continue; }
    l.push({ id: neueId("a"), erstellt: heute(), ...x }); angelegt++;
  }
  return { neu, fehler, angelegt, doppelt, ueber };
}

document.addEventListener("click", (ev) => {
  let x = ev.target.closest("[data-alarm-import]");
  if (x) {
    const was = x.dataset.alarmImport;
    if (was === "auf") { ui.alarmImport = true; return zeichnen(); }
    if (was === "zu") { ui.alarmImport = false; return zeichnen(); }
    const r = alarmeAusText(document.getElementById("alarm-import-text")?.value || "");
    if (!r.angelegt && !r.doppelt) return meldung(r.fehler.length ? "Nichts übernommen – " + r.fehler.slice(0, 3).join(", ") : "Kein Alarm im Text gefunden.");
    ui.alarmImport = false; sichern();
    meldung(`${r.angelegt} Alarme übernommen` + (r.ueber ? `, ${r.ueber} Werte neu in der Watchlist` : "") + (r.doppelt ? `, ${r.doppelt} schon vorhanden` : "")
      + (r.fehler.length ? `, ${r.fehler.length} Zeilen übersprungen` : "") + (r.ueber ? " – Kurse kommen mit „Kurse & Daten aktualisieren“." : "."));
    return zeichnen();
  }
  x = ev.target.closest("[data-alarm-teilen]");
  if (!x) return;
  const l = x.dataset.alarmTeilen === "alle" ? alarme() : alarme().filter((a) => a.id === x.dataset.alarmTeilen);
  if (!l.length) return;
  const text = alarmeTextKopf() + "\n" + l.map(alarmAlsText).join("\n") + "\n";
  if (APP && APP.teilen) { if (!APP.teilen("depot-kompass-alarme.txt", "text/plain", text, false)) meldung("Teilen ging nicht."); }
  else { try { navigator.clipboard.writeText(text); meldung("In die Zwischenablage kopiert."); } catch { meldung("Kopieren ging nicht."); } }
});


// ---------------------------------------------------------------- Marktstimmung (ab 0.66)
// 0.83 Nach Update suchen: nur auf Knopfdruck, eine feste Adresse (GitHub, neueste Version). Es wird nichts installiert –
// die App zeigt nur, ob es eine neuere Version gibt und wie man aktualisiert. Ergebnis nur für diese Sitzung (nicht gespeichert).
const UPDATE_SEITE = "https://github.com/kdm-media/depot-kompass/releases/latest";
function versionTeile(v) { return String(v || "").replace(/^v/i, "").split(".").map((x) => parseInt(x, 10) || 0); }
function versionNeuer(a, b) {   // true, wenn a neuer als b
  const x = versionTeile(a), y = versionTeile(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); }
  return false;
}
function updateErgebnis() {
  const u = ui.update;
  if (!u) return "";
  if (u.fehler) return `<p class="klein" style="text-align:center">${esc(u.fehler)}</p>`;
  if (!u.neuer) return `<p class="klein" style="text-align:center">✅ Du hast die neueste Version (${esc(u.ich)}).</p>`;
  const desktop = !!(APP && APP.istDesktop);
  return `<p style="text-align:center;margin-bottom:4px"><b>🆕 Version ${esc(u.neu)} ist da</b> (du hast ${esc(u.ich)}).</p>` + (desktop
    ? `<p class="klein">So aktualisierst du am PC – im Ordner <b>desktop</b>:<br>mit Git: <code>git pull</code>, dann <code>docker compose up -d --build</code><br>
        mit ZIP: neue ZIP laden, den alten Ordner <b>desktop/daten</b> in den neuen Ordner kopieren, dann <code>docker compose up -d --build</code>.<br>Deine Daten bleiben erhalten.</p>`
    : `<p class="klein">Mit <b>Obtainium</b>: dort auf „Aktualisieren“ tippen. Ohne Obtainium: die neue APK von GitHub laden und installieren – deine Daten bleiben erhalten.</p>`)
    + `<p class="klein" style="text-align:center"><a href="${UPDATE_SEITE}">Zur Download-Seite auf GitHub</a></p>`;
}
async function updateSuchen() {
  if (!APP || !APP.updatePruefen) return meldung("Nach Update suchen gibt es nur in der App.");
  if (netzGesperrt()) return;
  meldung("Suche nach Update …");
  const r = await new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok; APP.updatePruefen(id); setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
  const ich = appVersion(), neu = r && typeof r.tag_name === "string" ? r.tag_name.replace(/^v/i, "") : "";
  if (!/^\d+(\.\d+){0,3}$/.test(neu)) ui.update = { fehler: "Keine Antwort von GitHub – später noch einmal versuchen." };
  else ui.update = { ich, neu, neuer: versionNeuer(neu, ich) };
  zeichnen();
}

// Passend zum Depot (20.11.): Krypto im Depot → Crypto Fear & Greed von alternative.me (offizieller Index);
// Aktien/ETF im Depot → VIX, der offizielle Volatilitätsindex der Cboe („Angstbarometer“), nur als Rohwert.
// KEINE eigene Berechnung. Nur auf Knopfdruck, danach offline gespeichert (S.stimmung).
const STIMMUNG_STUFE = { "Extreme Fear": "Extreme Angst", "Fear": "Angst", "Neutral": "Neutral", "Greed": "Gier", "Extreme Greed": "Extreme Gier" };

async function stimmungLaden() {
  if (!APP || !APP.stimmung) return meldung("Marktstimmung gibt es nur in der App (ab Version 0.66).");
  if (netzGesperrt()) return;
  const holen = (was) => new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok; APP.stimmung(was, id); setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
  meldung("Lade Marktstimmung …");
  const neu = { stand: new Date().toISOString() };
  const d = (await holen("krypto"))?.data;
  if (Array.isArray(d) && d.length) {
    const w = (i) => d[i] ? +d[i].value : null;
    neu.krypto = { wert: w(0), stufe: STIMMUNG_STUFE[d[0].value_classification] || d[0].value_classification, gestern: w(1), woche: w(7), monat: w(30), zeit: +d[0].timestamp * 1000 };
  }
  const r = (await holen("^VIX"))?.chart?.result?.[0];
  const c = (r?.indicators?.quote?.[0]?.close || []).filter((x) => x != null);
  if (c.length > 6) neu.vix = { wert: c.at(-1), d1: (c.at(-1) / c.at(-2) - 1) * 100, d5: (c.at(-1) / c.at(-6) - 1) * 100, zeit: r.meta?.regularMarketTime * 1000 };
  if (!neu.krypto && !neu.vix) return meldung("Keine Verbindung – Stimmung nicht geladen.");
  S.stimmung = neu; sichern(); zeichnen();
  meldung("Marktstimmung geladen.");
}

/** Halbkreis 0–100 mit den fünf Stufen des Crypto Fear & Greed Index. */
function stimmungTacho(w) {
  const B = [0, 25, 47, 54, 75, 100], F = ["#c0392b", "#e67e22", "#9d97b3", "#7bc96f", "#2ecc71"];
  const pt = (x, r) => { const a = Math.PI * (1 - x / 100); return [(60 + r * Math.cos(a)).toFixed(1), (62 - r * Math.sin(a)).toFixed(1)]; };
  const boegen = F.map((f, i) => { const [a, b] = [pt(B[i], 48), pt(B[i + 1], 48)]; return `<path d="M${a[0]},${a[1]} A48,48 0 0 1 ${b[0]},${b[1]}" stroke="${f}" stroke-width="11" fill="none"/>`; }).join("");
  const z = w == null ? "" : (() => { const [x, y] = pt(w, 40); return `<line x1="60" y1="62" x2="${x}" y2="${y}" stroke="currentColor" stroke-width="4" stroke-linecap="round"/><text x="60" y="58" text-anchor="middle" font-size="19" font-weight="800" fill="currentColor">${w}</text>`; })();
  return `<svg viewBox="0 0 120 70" width="110" height="64" role="img" aria-label="${w ?? "–"} von 100">${boegen}${z}</svg>`;
}

/** Karte in der Übersicht – zeigt nur, was zum Depot passt. liste = Positionen der Ansicht. */
function stimmungKarte(verlauf, liste) {
  const arten = new Set((liste || []).map((p) => p.inst?.art).filter(Boolean));
  const krypto = arten.has("Krypto"), aktien = [...arten].some((a) => a !== "Krypto");
  if (!krypto && !aktien) return "";
  const st = S.stimmung;
  const zahl = (x, n = 1) => x == null ? "–" : (Math.abs(x) < 0.05 ? "±" : x > 0 ? "+" : "") + x.toFixed(n).replace(".", LOC_DATUM().startsWith("de") ? "," : ".");
  const knopf = `<button class="knopf klein" data-los="stimmung-laden">${st ? "🔄 Aktualisieren" : "🌡️ Stimmung laden"}</button>`;
  const cnn = aktien ? `<p class="klein" style="margin:4px 0">Fear &amp; Greed für Aktien: <a href="https://edition.cnn.com/markets/fear-and-greed">CNN Fear &amp; Greed Index</a> (öffnet im Browser – CNN lässt keine Apps abrufen, darum nur der Link)</p>` : "";
  const hinweis = `<div class="klein warn-t">⚠ Nur Orientierung: Angst ist für viele ein Verkaufssignal – oft liegen gerade dort Chancen. Gier ist eher ein Warnsignal, besonders für einen Neueinstieg. Keine Anlageberatung.</div>`;
  if (!st) return `<h2>Marktstimmung</h2><section class="karte"><p class="klein" style="margin-top:0">${krypto && aktien ? "Krypto: Fear &amp; Greed Index · Aktien: VIX (Angstbarometer)" : krypto ? "Krypto: Fear &amp; Greed Index von alternative.me" : "Aktien: VIX, das Angstbarometer der Cboe"} – passend zu deinem Depot. Lädt nur auf Knopfdruck.</p>${cnn}${knopf}</section>`;
  const k = st.krypto, v = st.vix, teile = [];
  if (krypto) teile.push(`
      <div style="display:flex;gap:10px;align-items:center;min-width:0">${stimmungTacho(k?.wert)}
        <div style="min-width:0"><b style="display:block">${esc(k ? k.stufe : "keine Daten")}</b><span class="klein">Krypto · Fear &amp; Greed · alternative.me</span></div></div>`);
  if (aktien) teile.push(`
      <div style="display:flex;gap:10px;align-items:center;min-width:0"><b style="font-size:30px;min-width:96px;text-align:center">${v ? zahl(v.wert, 2).replace("+", "") : "–"}</b>
        <div style="min-width:0"><b style="display:block">VIX · Aktien</b><span class="klein">Angstbarometer der Cboe · ${v ? zahl(v.d1) + " % zum Vortag" : "keine Daten"}</span></div></div>`);
  const idx = verlauf?.gesamt?.index || [];
  const dep = !verlauf?.ausBuchungen && idx.length > 4 ? (idx.at(-1) / idx.at(-5) - 1) * 100 : null;   // Wochenraster: 4 Wochen
  return `<h2>Marktstimmung</h2>
    <section class="karte">
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:10px">${teile.join("")}</div>
      ${krypto && k ? `<div class="klein">Krypto: gestern ${k.gestern ?? "–"} · vor 1 Woche ${k.woche ?? "–"} · vor 1 Monat ${k.monat ?? "–"}</div>` : ""}
      ${dep != null ? `<div class="klein"><b>Dein Depot 4 Wochen ${pct(dep)}</b></div>` : ""}
      ${cnn}${hinweis}
      ${(krypto && k?.wert < 25) || (aktien && v?.wert >= 30) ? `<div class="klein" style="margin:6px 0">💜 Die Lage drückt aufs Gemüt? Du bist nicht allein: TelefonSeelsorge <a href="tel:08001110111">0800 111 0 111</a> · <a href="tel:116123">116 123</a> (kostenlos, rund um die Uhr) – <a href="#" data-ziel="mehr">mehr Hilfe</a></div>` : ""}
      <details class="klein"><summary>Woher kommen die Werte?</summary>
        ${krypto ? "<p><b>Krypto</b>: Crypto Fear &amp; Greed Index von alternative.me (0 = extreme Angst, 100 = extreme Gier).</p>" : ""}
        ${aktien ? "<p><b>Aktien</b>: VIX, der offizielle Volatilitätsindex der Cboe. Je höher, desto mehr Angst erwartet der Markt.</p>" : ""}</details>
      <div class="klein">Stand ${new Date(st.stand).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })} · offline gespeichert</div>
      ${knopf}
    </section>`;
}


// ---------------------------------------------------------------- „Was ist neu“ nach einem Update (ab 0.66, Wunsch Team 20.11.2026)
// Beim ersten Öffnen nach einem Update oben in der Übersicht: alle Versionen seit der zuletzt gesehenen (wer 0.65 → 0.67 springt, sieht 0.66 + 0.67).
// Bei frischer Installation (noch keine Buchungen) nicht – dort läuft die Einführung. Pflege: zusammen mit CHANGELOG.md je Version.
const WAS_NEU = {
  "0.66": ["🌡️ Marktstimmung in der Übersicht – passend zu deinem Depot: Krypto mit dem Fear & Greed Index, Aktien mit dem VIX (Angstbarometer).",
           "💜 „Wenn es schwer wird“: Hilfe-Kontakte (TelefonSeelsorge, rund um die Uhr) unten auf „Mehr“ und bei extremer Angst in der Marktstimmung."],
  "0.67": ["⚖️ Positionsgrößen-Rechner: Broker wählen (Trade Republic, Smartbroker+ je Emittent) – feste Gebühren in Euro werden automatisch eingerechnet.",
           "⚖️ Neu: „Positionsgröße vorgeben“, z. B. 250 € oder 500 € – der Rechner zeigt den Verlust am Stop inklusive Gebühren.",
           "✨ Diese Karte: Nach jedem Update siehst du hier einmal, was neu ist."],
  "0.68": ["🎯 Notizen → neuer Reiter „Derivate“: Hebel-Rechner für Knock-out-Zertifikate, Mini-Futures und Perps – Basiswert per Name, ISIN oder WKN suchen, Kurs wird übernommen, Verlauf im Chart.",
           "🎯 Knock-out laut Produktblatt eintragen: Der Rechner nutzt den echten Wert des Emittenten und rechnet den Hebel daraus.",
           "🏷️ Neue Anlagearten: Knock-out, Mini-Future und Perp."],
  "0.69": ["🎯 Stop-Loss aus deinem Max.-Verlust: Einsatz und Max.-Verlust in Euro eintragen – der Rechner zeigt den passenden Stop-Loss-Kurs und zeichnet ihn ein (z. B. Bitcoin 42.000, 5×, 500 €, 50 € → 41.160). Dazu ein Vergleich für 50 / 75 / 100 €.",
           "🎯 Zertifikate rechnen wie echt: Basispreis, Bezugsverhältnis, Preis je Zertifikat, Spread, Ordergebühr und Finanzierung – mit Stückzahl. Mini-Future mit Schwelle und Restwert.",
           "🔍 Zertifikate-Finder: Broker wählen, Long/Short, Wunsch-Hebel ± Spanne – echte Produkte von Onvista mit WKN/ISIN, ein Tipp übernimmt sie in den Rechner.",
           "📊 Gewinn und Verlust immer in Euro und Prozent, Kacheln für Einstieg, Hebel, Stop-Loss, Take-Profit; im Chart Stop-Loss/Take-Profit mit dem Finger ziehen.",
           "📷 Analyse als Bild teilen: Chart, Zahlen, Einstiegsbedingung und Notiz als PNG.",
           "🧮 Notizen: Rechner jetzt als Reiter oben, gespeicherte Notizen darunter.",
           "↔️ Position in ein anderes Depot verschieben · 📥 Watchlist importieren (Liste, CSV, HTML) oder alle Werte eines Depots übernehmen · HTML-Tabellen importieren.",
           "⚖️ Positionsgröße jetzt mit Hebel, 📉 mehrere Tranchen planen, 🎯 Hebelprodukte direkt aus Position und Watchlist, Depotart je Depot.",
           "📥 Alte Depot-Zusammenfassung (HTML) einlesen – Bestand mit Stückzahl und Ticker oder als Watchlist."],
  "0.70": ["📈 Hebel-Chart: Zeitraum wählbar – 1M, 3M, 6M, 1J (Tageskurse) und 5J (Wochenkurse). Mit Datum, Hoch und Tief im Zeitraum, damit Support-Zonen besser sichtbar sind.",
           "📷 Als Bild teilen: Das Bild wird zusätzlich in Bilder › Depot-Kompass gespeichert (Android 10+).",
           "🎫 Kontakt und Fehler melden jetzt über ein Ticket auf unserem Discord. „Stop“ heißt im Positionsgrößen-Rechner jetzt Stop-Loss."],
  "0.71": ["📈 Zeitraum 1M bis 5J jetzt auch im Positions-Chart des Positionsgrößen-Rechners (mit Datum, Hoch und Tief)."],
  "0.73": ["🔎 Basiswert-Suche nach Art: oben Index, Aktie, ETF, Krypto oder Rohstoff antippen – z. B. „Nasdaq“ zeigt sofort Nasdaq 100 und Nasdaq Composite.",
           "🎯 Knock-out-Zertifikat steht jetzt ganz oben. Neu: Faktor-Zertifikat, Optionsschein, Option und Future – Produkte ohne Laufzeit zuerst.",
           "📐 Optionen/Optionsscheine: Call oder Put, Basispreis, Prämie, Verfall – Break-even, Ergebnis am Take-Profit und höchster Verlust (am Verfall)."],
  "0.74": ["🎯 Neu im Derivate-Rechner: Discount-Zertifikat – Abschlag, Cap, Break-even, höchster Ertrag (Seitwärtsrendite) und Ergebnis am Verfall.",
           "ℹ️ Mini-Future erklärt: ohne Laufzeit, jederzeit verkaufbar – anders als ein Future mit festem Verfall."],
  "0.75": ["📅 Kalender: ETF-Ausschüttungen heißen jetzt so, dazu Zinsen aufs Konto und Staking-/Reward-Erträge (Krypto) am Tag der Gutschrift."],
  "0.76": ["⚠️ Vorsicht vor Betrügern: Unser Team fragt nie nach Seed-Phrase, Passwort oder PIN und schreibt dich nie von sich aus an. Kontakt nur über unseren Discord-Server – Hinweis jetzt unter Fehler melden und Sicherheit."],
  "0.77": ["🪙 Spot ohne Hebel: Kraken, Bitvavo, Binance und Bitunix – z. B. BTC/CAD nachrechnen, Gebühr als Vorgabe änderbar.",
           "📈 Neue Perps: Binance Futures und Bitunix Futures, Wartungsmarge und Gebühr änderbar. Währung für Einsatz und Ergebnis wählbar (EUR, USD, CAD, CHF, GBP, USDT, USDC).",
           "👁️ Beträge aus gilt jetzt auch im Chart (graue Punkte statt Euro) und für die Stückzahl. Unter dem Chart: Zeitachse und wann Hoch und Tief waren.",
           "🕯️ Chart mit Kerzen und Volumen, neue Wochenansicht 1W, 5J zeigt Jahre, 1J Monate. Preisskala links, Einstieg lässt sich wie SL und TP mit dem Finger ziehen.",
           "💱 Neu in den Einstellungen: „Währung der Rechner“ (EUR, USD, CAD, CHF, GBP, USDT) – damit starten alle Rechner. Bei „Beträge aus + Kurse“ verbirgt der Hebel-Chart auch die Kurse."],
  "0.87": ["🔢 Rechner: Werte aus einer Position werden in Englisch nicht mehr ×1000 übernommen, Ø-Einstand und Kurs mit allen Stellen (auch DOGE, SHIB); „0.005“ bleibt 0,005.", "🙈 „Beträge aus“: Einsatz, Max.-Verlust und Ordergebühr im Hebel-Rechner verdeckt, Kurse in den Kacheln folgen „Kurse verbergen“; Hebel-Notizen speichern nur noch Kurse und Prozente.", "🔔 Benachrichtigungen: beobachtete Depots melden sich nicht mehr, keine doppelten Meldungen nach dem Aufräumen, Kleinstkurse mit genug Stellen, Alarm-Töne dauerhaft richtig.", "📞 Notruf- und Seelsorge-Nummern öffnen am Handy das Wählfeld.", "🧮 Hebel-Rechner merkt sich Spot/Hebel wieder über einen Neustart.", "🖥️ Desktop: PIN-Bremse gilt auch beim Aufheben der Sperre, Sperren nur mit gültiger Sitzung.", "🌍 Englisch: Fußtext im Hebel-Rechner (Spot, Zertifikat in anderer Währung) übersetzt.", "📱 Handy: Ton-Auswahl und Vergleichstabelle brechen Namen nicht mehr mitten im Wort um."],
  "0.86": ["🧹 Kleinere Textkorrekturen in „Was ist neu“ und bei den Credits."],
  "0.85": ["🪙 Hebel-Rechner: oben direkt „Hebel & Derivate“ oder „Spot (ohne Hebel)“ wählen – neu auch Spot direkt beim Broker (Aktie, ETF, Krypto). Die Wahl bleibt für neue Rechnungen.", "💱 Krypto-Paar wählbar: nach der Suche z. B. XRP/EUR, XRP/USD oder XRP/CHF antippen – Kurs, Chart und Rechner-Währung folgen dem Paar.", "🔔 News-Benachrichtigungen ohne Spam: direkt auf der News-Seite an/aus, nur fürs eigene Portfolio oder mit Watchlist, höchstens 1–10 Meldungen je Prüfung, der Rest als eine Sammel-Meldung.", "⚡ Ad-hoc-Meldungen: unter News je Wert abonnieren. „News laden“ sucht dann extra danach, mit Benachrichtigungen meldet sich das Handy auch im Hintergrund. Neuer Filter „⚡ Ad-hoc“."],
  "0.84": ["📈 Hebel-Rechner: Der Kurs-Chart erscheint jetzt auch ohne Einstieg und Hebel. Bei Knock-out-Produkten wird mindestens mit Hebel 1,01 gerechnet – bei Hebel 1 lag der Knock-out auf 0 und KO-Produkte verschwanden.", "🔗 Zertifikate-Finder: Jeder Treffer hat jetzt einen Link „Onvista ↗“ zum Datenblatt.", "📰 News: neue Filter „Mein Portfolio“ und „Beobachtet“ (beobachtete Depots + Watchlist). Die Marktstimmung steht jetzt bei den News statt in der Übersicht.", "🔐 Desktop: PIN mit scrypt geschützt, im Heimnetz nur noch mit App-PIN und eigener Sitzung je Browser. Nach richtiger PIN öffnet sich die App sofort."],
  "0.83": ["🔄 Nach Update suchen: unter Mehr → Über die App fragt die App auf Knopfdruck bei GitHub nach der neuesten Version und zeigt, wie du aktualisierst (Handy: Obtainium oder APK, PC: git pull bzw. neue ZIP + docker compose). Es wird nichts automatisch installiert."],
  "0.81": ["🎫 Kontakt nur noch über ein Ticket auf unserem Discord – die App öffnet keine E-Mail mehr. Sicherheitslücken bitte vertraulich per Ticket oder privat über GitHub melden."],
  "0.80": ["🔊 Alarm-Töne je Wert: unter Watchlist → Alarme eigenen Ton wählen (8 eigene Töne) und vorab anhören. Melden sich mehrere Werte gleichzeitig, kommen die Töne nacheinander – so hörst du, welcher Wert es ist.", "⚖️ Tranchen-Rechner: Kaufpreis wählbar – Marktpreis oder eigener Preis (Limit-Order). Neu: „Jetzt kaufen oder auf Limit warten?“ – Szenario A (sofort) und B (Limit) nebeneinander, optional mit 2. Tranche: Kapital, neue Position, neuer Ø und Unterschied, dazu Kapital bis zum Ziel-Ø."],
  "0.79": ["✨ KI ist jetzt standardmäßig ausgeblendet – unten in der Leiste und unter „Mehr“. Wer sie nutzen möchte: Einstellungen → Zusatzmodule → KI-Zusammenfassung einschalten, dann erscheint „KI“ unten in der Leiste. Ohne Schalter wird nie etwas gesendet."],
  "0.78": ["📊 Krypto im Detail: Long/Short und Open Interest (Kraken Futures, Binance Futures) auf Knopfdruck – dazu Fibonacci aus dem 4h-Chart (letztes Hoch und Tief) und Marken-Vorschläge (Pivot, Unterstützung, Widerstand).",
           "📥 Neuer Import: Binance – Handelsverlauf (Spot gegen Euro). Andere Paare werden sichtbar übersprungen. Zum Ausprobieren liegt eine Testdatei bei.",
           "💵 Einstellungen → Depot-Anzeige: Werte wahlweise in US-Dollar (nur Anzeige, gerechnet wird in Euro).",
           "🌡️ Marktstimmung: Link zum CNN Fear & Greed Index für Aktien."]
};
const versionZahl = (v) => String(v).split(".").map((x) => +x || 0).reduce((a, x) => a * 1000 + x, 0);
function wasNeuKarte() {
  const v = appVersion(), e = EIN();
  if (!WAS_NEU[v] || e.neuGesehen === v) return "";
  const hatDaten = Object.values(S.depots || {}).some((d) => (d.buchungen || []).length);
  if (!hatDaten) { (S.einstellungen ||= {}).neuGesehen = v; return ""; }
  const seit = e.neuGesehen && WAS_NEU[e.neuGesehen] ? versionZahl(e.neuGesehen) : versionZahl(v) - 1;
  const neu = Object.keys(WAS_NEU).filter((k) => versionZahl(k) > seit && versionZahl(k) <= versionZahl(v)).sort((a, b) => versionZahl(a) - versionZahl(b));
  if (!neu.length) neu.push(v);
  return `<section class="karte" style="border-left:4px solid var(--akzent, #7c5cff)">
      ${neu.map((k) => `<b>✨ Neu in Version</b> <b>${esc(k)}</b>
      <ul style="margin:6px 0 10px;padding-left:18px">${WAS_NEU[k].map((z) => `<li style="display:list-item;margin:4px 0">${esc(z)}</li>`).join("")}</ul>`).join("")}
      <button class="knopf klein" data-los="neu-gelesen">Verstanden</button>
    </section>`;
}


// ---------------------------------------------------------------- Reiter „Derivate“ auf der Notizen-Seite (0.68, Wunsch Team 20.11.2026)
function derivateInfo() {
  return `<section class="karte"><p style="margin-top:0">Hier rechnest du Hebelprodukte durch: Broker und Produktart wählen, Basiswert suchen, Einstieg, Stop-Loss und Max.-Verlust – der Chart zeigt Knock-out, Stop-Loss und Take-Profit, in Prozent und Euro. Darunter findest du passende echte Zertifikate mit WKN.</p>
    <p class="klein"><b>Knock-out-Zertifikat (Turbo):</b> Knock-out = Basispreis, der Hebel ergibt sich aus dem Abstand. <b>Mini-Future:</b> ohne Laufzeit, Knock-out-Schwelle liegt vor dem Basispreis, danach gibt es oft einen Restwert. <b>Perp:</b> Kontrakt an einer Krypto-Börse ohne Ablauf – den Hebel wählst du selbst.</p>
    <p class="klein" style="margin-bottom:0">Den genauen Knock-out zeigt das Produktblatt des Emittenten bzw. die Börse. Keine Anlageberatung.</p></section>`;
}
document.addEventListener("click", (ev) => {
  const x = ev.target.closest("[data-notiz-reiter]");
  if (!x) return;
  ui.notizReiter = x.dataset.notizReiter;
  if (ui.notizReiter !== "derivate") ui.rechnerOffen = false;
  if (ui.notizReiter !== "posgr") ui.posgrOffen = false;
  if (ui.notizReiter !== "nachkauf") ui.nachkaufOffen = false;
  if (ui.notizReiter !== "gewinn") ui.gewinnOffen = false;
  zeichnen(); scrollTo(0, 0);
});

// 0.69: Rechner liegen als Reiter oben - "schließen" fuehrt zurueck zu den Notizen
document.addEventListener("click", (ev) => {
  const x = ev.target.closest('[data-posgr-auf="0"],[data-nachkauf-auf="0"],[data-gewinn-auf="0"],[data-rechner-auf="0"]');
  if (x && ui.seite === "notizen" && ui.notizReiter) ui.notizReiter = "notizen";
  // aus einer Position in einen Rechner springen: passender Reiter
  const a = ev.target.closest("[data-posgr-aus],[data-nachkauf-aus],[data-gewinn-aus]");
  if (a) { ui.notizReiter = null; ui.rechnerOffen = false; }      // Reiter "Notizen" zeigt dann genau den geoeffneten Rechner
}, true);

// ------------------------------------------------------------ 0.69: HTML-Tabellen, Watchlist-Import, Depot -> Watchlist
/** Groesste Tabelle einer HTML-Datei als CSV (Trenner ;) - fuer gespeicherte Bank-/Broker-Seiten. Leer = keine Tabelle. */
function htmlZuCsv(html) {
  let doc;
  try { doc = new DOMParser().parseFromString(String(html).slice(0, 20e6), "text/html"); } catch { return ""; }
  const tabellen = [...doc.querySelectorAll("table")].map((t) => [...t.querySelectorAll("tr")]
    .map((tr) => [...tr.querySelectorAll("th,td")].map((c) => c.textContent.replace(/\s+/g, " ").replace(/;/g, ",").trim()))
    .filter((z) => z.some(Boolean)));
  const t = tabellen.filter((x) => x.length > 1).sort((a, b) => b.length * (b[0]?.length || 1) - a.length * (a[0]?.length || 1))[0];
  if (!t) return "";
  const breite = Math.max(...t.map((z) => z.length));
  return t.filter((z) => z.length >= Math.min(2, breite)).map((z) => z.join(";")).join("\n");
}

function watchImportKarte() {
  const depots = Object.entries(S.depots).filter(([, d]) => Object.keys(d.instrumente || {}).length);
  return `<details class="karte" ${ui.watchImportOffen ? "open" : ""} data-watch-import-auf><summary><b>📥 Watchlist importieren</b></summary>
    <div class="formular" style="margin-top:8px">
      <p class="klein" style="margin:0">Datei (CSV, Text, HTML-Tabelle) oder Liste einfügen: je Zeile ein Wert – Name, ISIN, WKN oder Ticker. Doppelte Werte werden übersprungen.</p>
      <label class="knopf" style="display:block;text-align:center;cursor:pointer">📄 Datei wählen<input type="file" id="watch-import-datei" accept=".csv,.txt,.html,.htm,text/*,text/html" hidden></label>
      <label>Oder Liste einfügen<textarea id="watch-import-text" rows="4" placeholder="z. B.\nSiemens DE0007236101\nNVDA\nBitcoin"></textarea></label>
      <button class="knopf" type="button" data-watch-import-text="1">Liste übernehmen</button>
      ${depots.length ? `<label>Alle Werte eines Depots übernehmen<select id="watch-aus-depot">${depots.map(([k, d]) => `<option value="${esc(k)}">${esc(d.name)}${d.rolle === "beobachtet" ? " 👁" : ""}</option>`).join("")}</select></label>
      <button class="knopf" type="button" data-watch-aus-depot="1">Alle Werte dieses Depots zur Watchlist</button>` : ""}
    </div></details>`;
}

/** Zeilen (Text/CSV/HTML) -> Watchlist-Eintraege. Rueckgabe: Anzahl neu. */
function watchImportieren(text) {
  const db = /<table[\s>]/i.test(String(text).slice(0, 200000)) ? depotDbZuBestandCsv(text) : "";
  if (db) {        // Depot-DB-Export: Name, ISIN und Ticker direkt aus dem Bestand
    const l = S.watchlist ??= [], da = new Set(l.flatMap((w) => [w.kennung, w.ticker, (w.name || "").toLowerCase()]).filter(Boolean)); let neu = 0;
    for (const z of db.split("\n").slice(1)) {
      const [, name, , , , ticker, art, notiz] = z.split(";"), isin = (notiz.match(/ISIN ([A-Z]{2}[A-Z0-9]{10})/) || [])[1] || "";
      if (!name || da.has(isin) || da.has(name.toLowerCase())) continue;
      l.push({ id: neueId("w"), aufgenommen: heute(), name, kennung: isin || ticker, ticker, art: WATCH_ARTEN.includes(art) ? art : art === "ETC" ? "Rohstoff" : "Sonstiges", notiz: "aus Depot-Zusammenfassung" });
      da.add(isin); da.add(name.toLowerCase()); neu++;
    }
    return neu;
  }
  if (/<table[\s>]/i.test(String(text).slice(0, 200000))) text = htmlZuCsv(text);
  const zeilen = String(text || "").split(/\r?\n/).map((z) => z.trim()).filter(Boolean).slice(0, 2000);
  const l = S.watchlist ??= [];
  const da = new Set(l.flatMap((w) => [w.kennung, w.ticker, (w.name || "").toLowerCase()]).filter(Boolean));
  let neu = 0;
  for (const z of zeilen) {
    const zellen = z.split(/[;\t,]|\s{2,}/).map((x) => x.replace(/^"|"$/g, "").trim()).filter(Boolean);
    if (!zellen.length) continue;
    if (/^(name|wertpapier|bezeichnung|titel|symbol|isin|wkn)$/i.test(zellen[0])) continue;      // Kopfzeile
    const woerter = zellen.flatMap((x) => x.split(/\s+/));
    const isin = woerter.find((w) => /^[A-Z]{2}[A-Z0-9]{9}\d$/.test(w.toUpperCase()));
    const wkn = !isin && woerter.find((w) => /^[A-Z0-9]{6}$/.test(w.toUpperCase()) && /\d/.test(w));
    let name = zellen.find((x) => /[a-zäöü]{2}/i.test(x) && x !== isin && x !== wkn) || "";
    if (isin || wkn) name = name.replace(isin || wkn, "").trim();
    const kennung = (isin || wkn || (zellen.length === 1 && /^[A-Z0-9.^=-]{1,12}$/i.test(zellen[0]) ? zellen[0] : "")).toUpperCase();
    if (!name) name = kennung;
    if (!name || da.has(kennung) || da.has(name.toLowerCase())) continue;
    const krypto = /^(BTC|ETH|SOL|XRP|ADA|DOGE|DOT|LTC|LINK|AVAX|bitcoin|ethereum|solana)$/i.test(name) || /^(BTC|ETH|SOL|XRP)-/i.test(kennung);
    l.push({ id: neueId("w"), aufgenommen: heute(), name: name.slice(0, 80), kennung, art: krypto ? "Krypto" : "Aktie", notiz: "importiert" });
    da.add(kennung); da.add(name.toLowerCase()); neu++;
  }
  return neu;
}

function watchAusDepot(did) {
  const d = S.depots[did]; if (!d) return 0;
  const l = S.watchlist ??= [];
  const da = new Set(l.flatMap((w) => [w.kennung, w.ticker, (w.name || "").toLowerCase()]).filter(Boolean));
  let neu = 0;
  for (const [iid, i] of Object.entries(d.instrumente || {})) {
    const kennung = String(i.isin || iid || "").toUpperCase(), name = i.name || iid;
    if (da.has(kennung) || (i.ticker && da.has(i.ticker)) || da.has(String(name).toLowerCase())) continue;
    l.push({ id: neueId("w"), aufgenommen: heute(), name, kennung, ticker: i.ticker || "", art: WATCH_ARTEN.includes(i.art) ? i.art : i.art === "ETC" || i.art === "Fonds" ? "ETF" : "Sonstiges",
      notiz: `aus Depot ${d.name}`, ...(i.kurs > 0 ? { kurs: i.kurs, kursStart: i.kurs } : {}) });
    da.add(kennung); da.add(String(name).toLowerCase()); neu++;
  }
  return neu;
}

document.addEventListener("toggle", (ev) => { if (ev.target.matches?.("[data-watch-import-auf]")) ui.watchImportOffen = ev.target.open; }, true);
document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  if (t("[data-watch-import-text]")) {
    const n = watchImportieren(document.getElementById("watch-import-text")?.value || "");
    sichern(); meldung(n ? `${n} Werte zur Watchlist hinzugefügt – Kurse kommen mit „Kurse & Daten aktualisieren“.` : "Keine neuen Werte gefunden."); return zeichnen();
  }
  if (t("[data-watch-aus-depot]")) {
    const did = document.getElementById("watch-aus-depot")?.value, n = watchAusDepot(did);
    sichern(); meldung(n ? `${n} Werte aus „${S.depots[did]?.name}“ zur Watchlist hinzugefügt.` : "Alle Werte dieses Depots stehen schon in der Watchlist."); return zeichnen();
  }
});
document.addEventListener("change", async (ev) => {
  if (ev.target.id !== "watch-import-datei") return;
  const d = ev.target.files?.[0]; if (!d) return;
  if (d.size > 20e6) return meldung("Datei zu groß.");
  const n = watchImportieren(await d.text());
  sichern(); meldung(n ? `${n} Werte zur Watchlist hinzugefügt – Kurse kommen mit „Kurse & Daten aktualisieren“.` : "Keine neuen Werte gefunden."); zeichnen();
});

// 0.69 (Vorgabe 21.11.): aus Position/Watchlist direkt zu Hebelprodukten auf diesen Wert (Rechner + Finder vorbelegt)
function derivateZu(bezug) {
  let name = "", kurs = null, basis = "";
  if (bezug.startsWith("w:")) { const w = (S.watchlist || []).find((x) => "w:" + x.id === bezug); if (!w) return; name = w.name; kurs = w.kurs; basis = (w.verlauf?.punkte || []).length > 5 ? bezug : ""; }
  else { const i = D.instrumente[bezug]; if (!i) return; name = i.name || bezug; kurs = i.kurs; basis = (i.verlauf?.punkte || []).length > 5 ? "d:" + S.aktiv + ":" + bezug : ""; }
  const t = (v) => v > 0 ? hebelFeldText(v) : "";
  ui.rechner = { richtung: "long", broker: "zertifikat", titel: name, suche: name, einstieg: t(kurs), kursJetzt: kurs > 0 ? kurs : "", basis };
  ui.finderListe = null; ui.finderBasen = null; ui.notizReiter = "derivate"; ui.rechnerOffen = true;
  zeige("notizen"); scrollTo(0, 0);
  if (APP && !sicherheitStatus().netzAus) hebelBasisSuchen();      // Basiswert bei Onvista fuer den Finder (ein Tipp, kein Dauerabruf)
}
document.addEventListener("click", (ev) => { const x = ev.target.closest("[data-derivate-zu]"); if (x) derivateZu(x.dataset.derivateZu); });

// 0.69: Depot-Zusammenfassung (HTML-Tabelle mit Bestand) -> bestand.csv-Format.
// Positionen-Tabelle (Name, ISIN, Art, Wert, Einstand) + Tiefenanalyse (Ticker, Konto, Kurs in Handelswaehrung).
// Stueck = Wert x Devisenkurs / Kurs; Devisenkurse aus dem Dividendenkalender der Datei ("1.29 USD x 50" = 57,49 EUR), USD aus body data-usd.
function depotDbZuBestandCsv(html) {
  if (!/Kurs \(Handelswährung\)/.test(String(html).slice(0, 20e6))) return "";
  let doc; try { doc = new DOMParser().parseFromString(String(html), "text/html"); } catch { return ""; }
  const tab = [...doc.querySelectorAll("table")].find((t) => { const k = [...(t.querySelector("tr")?.children || [])].map((c) => c.textContent.trim()); return k[0] === "Position" && k.includes("Einstand") && k.includes("Wert"); });
  if (!tab) return "";
  const eZahl = (el) => el ? parseFloat(el.dataset.e ?? el.textContent.replace(/\s/g, "").replace(/\./g, "").replace(",", ".")) : NaN;
  const zeilen = [...tab.querySelectorAll("tr")].slice(1).map((tr) => {
    const td = tr.querySelectorAll("td"); if (td.length < 4) return null;
    return { name: (td[0].querySelector("b")?.textContent || td[0].textContent).trim(), notiz: (td[0].querySelector(".notiz")?.textContent || "").trim(),
      art: td[1].textContent.trim(), wert: eZahl(td[2].querySelector(".betrag") || td[2]), einstand: eZahl(td[3].querySelector(".betrag") || td[3]) };
  }).filter((z) => z && z.name && z.wert > 0);
  const fx = { EUR: [1] }, usd = parseFloat(doc.body?.dataset?.usd); if (usd > 0) fx.USD = [usd];
  for (const tr of doc.querySelectorAll("table tr")) {
    const td = tr.querySelectorAll("td"); if (td.length < 3) continue;
    const m = td[1].textContent.replace(/\u00a0/g, " ").match(/^([\d.]+) ([A-Z]{3}) × ([\d.]+)$/), eur = eZahl(td[2].querySelector(".betrag"));
    if (m && eur > 0) (fx[m[2]] ||= []).push(+m[1] * +m[3] / eur);
  }
  const kurs = (k) => { const l = fx[k]; if (!l?.length) return null; const s2 = [...l].sort((a, b) => a - b); return s2[s2.length >> 1]; };
  const tiefe = [...doc.querySelectorAll("article.deep")].map((a) => {
    const teile = (a.querySelector(".kind")?.textContent || "").split(" · ").map((x) => x.trim());
    const kv = [...a.querySelectorAll(".kv")].find((x) => /Kurs \(Handelswährung\)/.test(x.textContent));
    const m = (kv?.querySelector("b")?.textContent || "").replace(/\u00a0/g, " ").match(/([\d.,]+)\s*([A-Z]{3})/);
    return { name: teile.length >= 3 ? teile[0] : "", ticker: teile.length >= 3 ? teile[1] : teile[0] || "", konto: teile.at(-1) || "", kurs: m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null, w: m ? m[2] : "" };
  });
  const csvFeld = (v) => String(v ?? "").replace(/[;\r\n]+/g, " ").trim();
  const aus = ["Konto;Instrument;Stueck;Wert_EUR;Einstand_EUR;Ticker;Art;Notiz;Haltefrist_Ende"];
  zeilen.forEach((z, i) => {
    const t = tiefe.length === zeilen.length ? tiefe[i] : tiefe.find((x) => x.name === z.name) || {};
    const f = kurs(t.w);
    let st = t.kurs > 0 && f ? z.wert * f / t.kurs : null;
    if (st != null) { const r = Math.round(st); st = r > 0 && Math.abs(st - r) <= Math.max(0.02, st * 0.005) ? r : Math.round(st * 10000) / 10000; }
    const art = /krypto/i.test(z.art) ? "Krypto" : /rohstoff/i.test(z.art) ? "ETC" : z.art || "Aktie";
    aus.push([t.konto || "Depot", z.name, st ?? "", z.wert.toFixed(2), z.einstand.toFixed(2), t.ticker || "", art, z.notiz + (t.kurs ? ` · Kurs ${t.kurs} ${t.w}` : ""), ""].map(csvFeld).join(";"));
  });
  return zeilen.length ? aus.join("\n") : "";
}


// ---------------------------------------------------------------- Krypto-Markt im Detail
// Nur auf Knopfdruck, nur oeffentliche Marktdaten ohne Konto: Kraken Futures (Ticker mit Open Interest und Funding,
// Long/Short der Konten), Binance Futures (Long/Short der Konten, Open Interest), Kraken 4h-Kerzen (Spot gegen Euro).
// Fibonacci + Marken sind Rechenwerte aus dem Chart, KEIN Signal. Danach offline gespeichert (S.kryptoMarkt).
const kryptoKuerzel = (i) => {
  if (!i || i.art !== "Krypto") return "";
  const t = String(i.ticker || "").toUpperCase().match(/^([A-Z0-9]{2,10})-(EUR|USD)$/);
  if (t) return t[1] === "XBT" ? "BTC" : t[1];
  const c = String(i.isin || "").toUpperCase();
  return /^[A-Z0-9]{2,10}$/.test(c) && /[A-Z]/.test(c) ? (c === "XBT" ? "BTC" : c) : "";
};

/** Fibonacci aus 4h-Kerzen [[zeit, open, high, low, close], ...] (nur abgeschlossene): Hoch und Tief der letzten
 *  120 Kerzen (20 Tage). Erst Tief, dann Hoch = aufwaerts -> Ruecksetzer vom Hoch nach unten gemessen; sonst umgekehrt.
 *  Dazu Pivot (klassisch, letzte 24 Std.) und naechste Unterstuetzung/Widerstand (lokale Tiefs/Hochs, je 2 Kerzen links/rechts). */
function fibo4h(k) {
  if (!Array.isArray(k) || k.length < 10) return null;
  const f = k.slice(-120).filter((c) => Array.isArray(c) && c.length >= 5 && c.slice(1, 5).every((x) => isFinite(x) && x > 0));
  if (f.length < 10) return null;
  let hi = 0, lo = 0;
  f.forEach((c, i) => { if (c[2] > f[hi][2]) hi = i; if (c[3] < f[lo][3]) lo = i; });
  const H = f[hi][2], L = f[lo][3], spanne = H - L;
  if (!(spanne > 0)) return null;
  const aufwaerts = lo < hi;
  const stufen = [0, 23.6, 38.2, 50, 61.8, 78.6, 100].map((p) => [p, aufwaerts ? H - spanne * p / 100 : L + spanne * p / 100]);
  const jetzt = f.at(-1)[4];
  const t = f.slice(-6), ph = Math.max(...t.map((c) => c[2])), pl = Math.min(...t.map((c) => c[3])), P = (ph + pl + t.at(-1)[4]) / 3;
  const tiefs = [], hochs = [];
  for (let i = 2; i < f.length - 2; i++) {
    if (f[i][3] <= Math.min(f[i - 1][3], f[i - 2][3], f[i + 1][3], f[i + 2][3])) tiefs.push(f[i][3]);
    if (f[i][2] >= Math.max(f[i - 1][2], f[i - 2][2], f[i + 1][2], f[i + 2][2])) hochs.push(f[i][2]);
  }
  const unter = tiefs.filter((x) => x < jetzt), ueber = hochs.filter((x) => x > jetzt);
  return { hoch: H, tief: L, hochZeit: f[hi][0], tiefZeit: f[lo][0], aufwaerts, stufen, jetzt,
           pivot: { P, R1: 2 * P - pl, S1: 2 * P - ph, R2: P + (ph - pl), S2: P - (ph - pl) },
           unterstuetzung: unter.length ? Math.max(...unter) : null, widerstand: ueber.length ? Math.min(...ueber) : null,
           schluss: f.map((c) => c[4]), von: f[0][0], bis: f.at(-1)[0] };
}

async function kryptoMarktLaden(iid) {
  const sym = kryptoKuerzel(D.instrumente[iid]);
  if (!sym) return meldung("Für diesen Wert gibt es keine Krypto-Marktdaten.");
  if (!APP || !APP.krypto) return meldung("Krypto-Marktdaten gibt es nur in der App (ab Version 0.78).");
  if (netzGesperrt()) return;
  const holen = (art) => new Promise((ok) => {
    const id = Math.random().toString(36).slice(2).replace(/[^a-z0-9]/g, "");
    kursWarten[id] = ok; APP.krypto(art, sym, id); setTimeout(() => window.kursAntwort(id, ""), 20000);
  });
  meldung("Lade Krypto-Marktdaten …");
  const [kt, kls, bls, boi, k4] = await Promise.all(["kticker", "kls", "bls", "boi", "k4h"].map(holen));
  const n = { stand: new Date().toISOString(), sym };
  const tk = kt?.ticker;
  if (tk && +tk.markPrice > 0) n.kraken = { oi: +tk.openInterest, mark: +tk.markPrice, funding: tk.relativeFundingRate != null ? +tk.relativeFundingRate * 100 : null };
  const d = kls?.result?.data;
  if (Array.isArray(d?.longPercent) && d.longPercent.length) Object.assign(n.kraken ||= {}, { long: +d.longPercent.at(-1), short: +d.shortPercent.at(-1) });
  const b = Array.isArray(bls) ? bls.at(-1) : null;
  if (b && b.longAccount != null) n.binance = { long: +b.longAccount * 100, short: +b.shortAccount * 100 };
  if (boi && boi.openInterest != null) (n.binance ||= {}).oi = +boi.openInterest;
  const r = k4?.result;
  if (r && typeof r === "object") {
    const key = Object.keys(r).find((x) => x !== "last" && Array.isArray(r[x]));
    if (key) n.fibo = fibo4h(r[key].slice(0, -1).map((c) => [+c[0], +c[1], +c[2], +c[3], +c[4]]));   // letzte Kerze laeuft noch
  }
  if (!n.kraken && !n.binance && !n.fibo) return meldung("Keine Verbindung – Krypto-Marktdaten nicht geladen.");
  (S.kryptoMarkt ||= {})[sym] = n; sichern(); zeichnen();
  meldung("Krypto-Marktdaten geladen.");
}

function fiboChart(fb) {
  const s = fb?.schluss || [];
  if (s.length < 2) return "";
  const alle = [...s, fb.hoch, fb.tief], lo = Math.min(...alle), hi = Math.max(...alle), pad = (hi - lo) * 0.06 || 1;
  const B = 340, H = 170, L = 222, y = (v) => (H - 8 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (H - 16)), x = (i) => i / (s.length - 1) * L;
  const farbe = (p) => p === 61.8 ? "var(--plus)" : p === 50 ? "var(--akzent)" : p === 38.2 ? "var(--warn)" : "var(--leise)";
  const zu = verstecktAuch("kurse");
  const lab = fb.stufen.map(([p, v]) => ({ p, v, yy: y(v) })).sort((a, b) => a.yy - b.yy);
  for (let k = 1; k < lab.length; k++) if (lab[k].yy - lab[k - 1].yy < 11) lab[k].yy = lab[k - 1].yy + 11;
  return `<svg viewBox="0 0 ${B} ${Math.max(H, (lab.at(-1)?.yy || 0) + 6).toFixed(0)}" width="100%" class="fibochart" role="img" aria-label="Fibonacci 4h">
    ${fb.stufen.map(([p, v]) => `<line x1="0" x2="${L}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${farbe(p)}" stroke-width="${p === 61.8 || p === 50 ? 1.5 : 1}" ${p === 0 || p === 100 ? "" : 'stroke-dasharray="4 3"'}/>`).join("")}
    <polyline points="${s.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--text)" stroke-width="1.4"/>
    <circle cx="${L}" cy="${y(fb.jetzt).toFixed(1)}" r="3" fill="var(--akzent)"/>
    ${lab.map(({ p, v, yy }) => `<text x="${L + 5}" y="${(yy + 3).toFixed(1)}" font-size="9" fill="${farbe(p)}">${fmt({ maximumFractionDigits: 1 }).format(p)} % · ${zu ? "•••" : fZahl.format(rund(v, v >= 100 ? 2 : 4))}</text>`).join("")}
  </svg>`;
}

/** Karte im Detail eines Krypto-Werts. */
function kryptoMarktKarte(iid, i) {
  const sym = kryptoKuerzel(i);
  if (!sym) return "";
  const m = S.kryptoMarkt?.[sym];
  const knopf = `<button class="knopf klein" data-los="krypto-markt" data-id="${esc(iid)}">${m ? "🔄 Aktualisieren" : "📊 Long/Short, Open Interest, Fibonacci laden"}</button>`;
  if (!m) return `<h2>Krypto-Markt</h2><section class="karte"><p class="klein" style="margin-top:0">Long/Short und Open Interest (Kraken Futures, Binance Futures) und Fibonacci aus dem 4h-Chart (Kraken) – öffentliche Marktdaten ohne Konto. Lädt nur auf Knopfdruck.</p>${knopf}</section>`;
  const zu = verstecktAuch("kurse"), kz = (v) => v == null || !isFinite(v) ? "–" : zu ? "•••" : fZahl.format(rund(v, v >= 100 ? 2 : 4));
  const ls = (x) => x && x.long != null ? `${ant(x.long)} / ${ant(x.short)}` : "–";
  const oi = (x) => x && x.oi != null && isFinite(x.oi) ? fmt({ maximumFractionDigits: 0 }).format(x.oi) : "–";
  const fb = m.fibo, tagT = (t) => t ? new Date(t * 1000).toLocaleDateString(LOC_DATUM()) : "–";
  return `<h2>Krypto-Markt</h2>
    <section class="karte">
      <div class="kennzahlen">
        <div><small>Long / Short · Kraken</small><b>${ls(m.kraken)}</b></div>
        <div><small>Long / Short · Binance</small><b>${ls(m.binance)}</b></div>
        <div><small>Open Interest · Kraken (Coins)</small><b>${oi(m.kraken)}</b></div>
        <div><small>Open Interest · Binance (Coins)</small><b>${oi(m.binance)}</b></div>
        <div><small>Funding · Kraken (je Stunde)</small><b>${m.kraken?.funding != null ? (m.kraken.funding > 0 ? "+" : "") + fmt({ maximumFractionDigits: 4 }).format(m.kraken.funding) + " %" : "–"}</b></div>
      </div>
      <p class="klein">Long / Short = Anteil der Konten mit Long- bzw. Short-Position (nicht das Geld). Open Interest = offene Kontrakte in Coins.</p>
      ${fb ? `<h3 style="margin:10px 0 4px">Fibonacci · 4h-Chart (Kraken, in Euro)</h3>
      <div class="kennzahlen">
        <div><small>Hoch (20 Tage)</small><b>${kz(fb.hoch)}</b><small>${tagT(fb.hochZeit)}</small></div>
        <div><small>Tief (20 Tage)</small><b>${kz(fb.tief)}</b><small>${tagT(fb.tiefZeit)}</small></div>
        <div><small>Richtung</small><b>${fb.aufwaerts ? "aufwärts" : "abwärts"}</b><small>${fb.aufwaerts ? "erst Tief, dann Hoch" : "erst Hoch, dann Tief"}</small></div>
        <div><small>Kurs jetzt</small><b>${kz(fb.jetzt)}</b></div>
      </div>
      ${fiboChart(fb)}
      <p class="klein">${fb.aufwaerts ? "Rücksetzer-Linien vom Hoch nach unten gemessen (0 % = Hoch, 100 % = Tief)." : "Erholungs-Linien vom Tief nach oben gemessen (0 % = Tief, 100 % = Hoch)."}</p>
      <h3 style="margin:10px 0 4px">Marken-Vorschlag – du entscheidest</h3>
      <div class="kennzahlen">
        <div><small>Widerstand</small><b>${kz(fb.widerstand)}</b><small>letztes Hoch darüber</small></div>
        <div><small>Unterstützung</small><b>${kz(fb.unterstuetzung)}</b><small>letztes Tief darunter</small></div>
        <div><small>Pivot</small><b>${kz(fb.pivot.P)}</b><small>letzte 24 Std.</small></div>
        <div><small>R1 / S1</small><b>${kz(fb.pivot.R1)} / ${kz(fb.pivot.S1)}</b></div>
      </div>` : `<p class="klein">Fibonacci: keine 4h-Kerzen für ${esc(sym)} gegen Euro bei Kraken.</p>`}
      <div class="klein warn-t">⚠ Nur Orientierung, ohne Gewähr, keine Anlageberatung. Long/Short zeigt, wie viele Konten long oder short sind – nicht, wer recht hat. Fibonacci und Marken sind Rechenwerte aus dem Chart, kein Signal.</div>
      <details class="klein"><summary>Woher kommen die Werte?</summary>
        <p>Kraken Futures und Binance Futures: öffentliche Marktdaten (Perpetual gegen US-Dollar), ohne Konto und ohne Schlüssel. Fibonacci: 4h-Kerzen von Kraken (Spot gegen Euro), Hoch und Tief der letzten 20 Tage; die laufende Kerze zählt nicht mit.</p></details>
      <div class="klein">Stand ${new Date(m.stand).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })} · offline gespeichert</div>
      ${knopf}
    </section>`;
}
