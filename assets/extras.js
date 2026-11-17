// Depot-Kompass - Watchlist, Notiz-Datenbank, API-Schluessel, KI.
// Wird VOR app.js geladen; alle Funktionen hier laufen erst auf Abruf und
// nutzen dann S, D, ui und die Helfer aus app.js.
"use strict";

// ------------------------------------------------------------ Watchlist
// Liegt depotuebergreifend in S.watchlist: beobachten, ohne zu besitzen.
const WATCH_ARTEN = ["Aktie", "ETF", "Zertifikat", "Optionsschein", "Anleihe", "Krypto", "Rohstoff", "Index", "Sonstiges"];

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
  const such = (ui.notizSuche || "").toLowerCase();
  const liste = [...(S.notizen || [])]
    .filter((n) => !such || (n.titel + " " + n.text + " " + (n.bezugName || "")).toLowerCase().includes(such))
    .sort((a, b) => b.datum.localeCompare(a.datum));
  return `
    <h2>Notizen <span>${(S.notizen || []).length}</span></h2>
    <section class="karte formular"><input id="notiz-suche" type="search" placeholder="Suchen …" value="${esc(ui.notizSuche || "")}">
      ${legende(["<b>+</b> unten rechts legt eine neue Notiz an.", "<b>🧮</b> vor dem Titel = Notiz mit gespeichertem Rechner-Plan (Chart und Zahlen) – antippen und „Im Rechner öffnen“.",
        "Notizen aus einer Position oder der Watchlist stehen auch dort.", "Die vier Rechner: 🧮 Hebel · ⚖️ Positionsgröße · 📉 In Tranchen kaufen · 💰 Gewinnmitnahme. Jeder Plan lässt sich als Notiz speichern.",
        "Kurs-Alarme stellst du in der Watchlist ein: Wert antippen → Kaufmarke und Verkaufsmarke."], "ℹ️ Legende")}</section>
    ${hebelRechner()}
    ${posgrRechner()}
    ${nachkaufRechner()}
    ${gewinnRechner()}
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
      ${xr ? `<div>${hebelChart(n.rechner)}${hebelZahlen(xr)}${n.id ? `<button class="knopf" type="button" data-rechner-laden="${esc(n.id)}" style="width:100%">🧮 Im Rechner öffnen und ändern</button>` : ""}</div>` : ""}
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
  // Doppelte Titel raus, neueste zuerst, hoechstens 200 behalten
  const gesehen = new Set(), alle = [];
  for (const n of [...neu, ...(S.news?.eintraege || [])].sort((a, b) => b.zeit - a.zeit)) {
    const key = n.titel.toLowerCase().replace(/\W+/g, "").slice(0, 80);
    if (!n.link || gesehen.has(key)) continue;
    gesehen.add(key); alle.push(n);
  }
  S.news = { stand: new Date().toISOString(), eintraege: alle.slice(0, 200) };
  sichern(); zeichnen();
  meldung(`${neu.length} Meldungen geladen.`);
}

function newsListe(eintraege) {
  return eintraege.map((n) => `
    <a class="zeile news" href="${esc(/^https?:\/\//i.test(n.link) ? n.link : "#")}" style="grid-template-columns:minmax(0,1fr);text-decoration:none;color:inherit">
      <span style="min-width:0"><span class="titel">${esc(n.titel)}</span>
        <span class="unter">${esc(n.bezug)} · ${esc(n.quelle)} · ${n.zeit ? new Date(n.zeit).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" }) : ""}${n.sprache === "en" ? " · EN" : ""}</span></span>
    </a>`).join("");
}

function newsSeite() {
  const alle = S.news?.eintraege || [];
  const filter = ui.newsFilter || "";
  const bezuege = [...new Set(alle.map((n) => n.bezug))];
  const liste = alle.filter((n) => !filter || n.bezug === filter).slice(0, 80);
  return `
    <h2>News</h2>
    <section class="karte">
      <button class="knopf haupt" data-los="news-laden" style="width:100%">News laden</button>
      <p class="klein" style="margin-bottom:0">${S.news?.stand ? `Stand ${new Date(S.news.stand).toLocaleString(LOC_DATUM(), { dateStyle: "short", timeStyle: "short" })} · offline gespeichert` : "Noch nichts geladen."}
        Für deine Aktien und Kryptowerte (Depot + Watchlist) aus Google News, Yahoo und deinen eigenen Quellen (unten). Antippen öffnet den Artikel im Browser.</p>
    </section>
    ${bezuege.length > 1 ? `<div class="reiter" style="margin:12px 0 0"><button data-newsfilter="" class="${!filter ? "aktiv" : ""}">Alle</button>${bezuege.map((b) =>
      `<button data-newsfilter="${esc(b)}" class="${filter === b ? "aktiv" : ""}">${esc(b)}</button>`).join("")}</div>` : ""}
    <section class="karte liste" style="margin-top:10px">${newsListe(liste) || `<p class="klein" style="margin:8px">Keine Meldungen.</p>`}</section>
    ${newsQuellenKarte()}
`;
}

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
        <label>${st.passwort ? "Sicherungs-Passwort ändern" : "1. Sicherungs-Passwort festlegen"}<input name="pw1" type="password" autocomplete="new-password" minlength="10" placeholder="mindestens 10 Zeichen, eigenes Passwort"></label>
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
      ${k("ki", "✨", "KI-Fragen zum Portfolio", EIN().ki ? "Chat mit Rückfragen, Earnings, Beispiele · nur Name, Einstieg, Long/Short an deinen KI-Anbieter" : "aus · hier einschalten")}
      ${k("einstellungen", "⚙️", "Einstellungen", "Sprache, Design hell/dunkel, Verstecken, Kalender, Startseite")}
      ${k("hinweise", "🔔", "Benachrichtigungen", EIN().hinweise?.an ? "an · Kurse, Earnings, Schlagzeilen" : "aus · nur mit Internet")}
      ${k("fehlerprotokoll", "🐞", "Fehlerprotokoll", "technische Fehler sammeln, auswerten und teilen – ohne Beträge")}
      ${k("sicherheit", "🔒", "Sicherheit &amp; Sicherung", "App-Sperre, Bildschirmschutz, verschlüsselte Sicherung")}
      ${k("schluessel", "🔑", "API-Schlüssel", "KI (OpenRouter, Claude, ChatGPT, Gemini) und weitere Dienste – eigene Schlüssel eintragen")}
      ${k("datenschutz", "🛡️", "Datenschutz", "was die App wann sendet")}
      <button class="zeile" data-einf="1"><span class="mono">ℹ️</span>
        <span style="min-width:0"><span class="titel">Hinweis &amp; Anleitung</span><span class="unter">keine Anlageberatung · so funktioniert die App</span></span><span class="rechts">›</span></button>
      ${k("depots", "🗂️", "Depots verwalten", "alle Depots als Liste, Cash je Depot, anlegen")}
      ${k("feedback", "🐞", "Fehler melden (Alpha)", "E-Mail an uns – was du schicken sollst und was nicht")}
      ${k("unterstuetzen", "💜", "Credits & Unterstützen", "Wer und was dahintersteckt – und wie du das Projekt unterstützen kannst")}
    </section>
    <h2>Über die App</h2>
    <section class="karte">
      <img src="${location.pathname.includes("/tests/") ? "../assets/" : ""}logo.svg" alt="" class="ueber-logo">
      <p style="margin-top:0;text-align:center"><b>Depot-Kompass</b> · Version ${esc(appVersion())} · Alpha</p>
      <p class="klein" style="text-align:center">Diese App ist in der <b>Alpha-Phase</b>. Fällt dir ein Fehler auf oder hast du eine Idee? Schreib uns:<br>
        <a href="${kontaktLink("Rückmeldung")}" style="overflow-wrap:anywhere">${KONTAKT}</a></p>
      <p class="klein" style="text-align:center">💬 Community-Server auf Discord für Fragen, Ideen und Feedback – folgt.</p>
      <p class="klein">Idee, Tests &amp; Gestaltung: <b>Depot-Kompass-Team</b><br>
        Ohne Werbung, ohne Tracking, ohne Konto. Keine Anlageberatung.</p>
      <button class="knopf" data-ziel="unterstuetzen" style="width:100%">💜 Credits &amp; Unterstützen</button>
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
        <li><b>Links</b> (Artikel, Schlüssel holen) öffnen im Browser.</li>
        <li><b>API-Schlüssel</b> (⚙️ → API-Schlüssel) gehen nur an den jeweiligen Dienst.</li>
        <li><b>Fehler melden:</b> der Mail-Knopf öffnet nur dein Mail-Programm – was du schickst, entscheidest du dort.</li>
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
    if (a.length < 10) return meldung("Mindestens 10 Zeichen.");
    if (/^\d+$/.test(a) || new Set(a).size < 5) return meldung("Zu einfach – bitte Buchstaben und Zahlen mischen.");
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
    <h2>Hebel-Rechner</h2>
    <section class="karte">${wahl("maxHebel", e.maxHebel || 10, { 5: "bis 5×", 10: "bis 10×", 20: "bis 20×", 50: "bis 50×" })}
      <p class="klein">So weit geht der Schieberegler. Höherer Hebel = Knock-out rückt sehr nah an den Einstieg.</p></section>
    <h2>Zusatzmodule</h2>
    <section class="karte liste">
      <label class="zeile" style="grid-template-columns:minmax(0,1fr) auto;cursor:pointer">
        <span style="min-width:0"><span class="titel">✨ KI-Zusammenfassung</span><span class="unter">Aus = nichts wird gesendet. An = KI-Chat zu Portfolio, Einzelwerten und Watchlist über deinen Anbieter (eigener Schlüssel) – nur Name, Einstiegskurs, Long/Short (Anteile nur auf Wunsch), nie Depotbeträge, Stückzahlen oder Konten, nur auf Knopfdruck.</span></span>
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

// ------------------------------------------------------------ Hebel-Rechner (0.28: mit Chart)
// Marken (Einstieg, Knock-out, Stop, Ziel) als Linien, Hebel per Schieberegler, Risiko mit/ohne
// Stop und Positionsgroesse fuer einen festen Maximalverlust. Speicherbar als Notiz mit Chart.
// Vereinfacht (ohne Aufgeld, Finanzierungskosten, Spread) - der echte KO des Emittenten weicht ab.
// 0.57: Vorgaben je Broker (Vorgabe 17.11.: "auf unsere aktiven Broker anwenden, auswaehlbar").
//  Kraken Futures EU-Privatkunde: laut Kraken-API (marginSchedules "europa" retail) Anfangsmarge 10 % (max. 10x), Wartungsmarge 5 %;
//   Kraken zeigt bei 10x einen Liquidationspreis um 7,7 % -> wirksame Schwelle ca. 2,5 % (halbe Wartungsmarge). Taker-Gebuehr 0,05 %.
//  Hyperliquid: Wartungsmarge = halbe Anfangsmarge bei Hoechsthebel (bei 20x: 2,5 %), Taker 0,045 %.
//  Knock-out-Zertifikat (Trade Republic, Scalable, Smartbroker ...): keine Marge, Schwelle legt der Emittent fest; Ordergebuehr fest in Euro.
const HEBEL_BROKER = [
  { key: "kraken", name: "Kraken Futures (EU)", wartung: 2.5, gebuehr: 0.05 },
  { key: "hyperliquid", name: "Hyperliquid", wartung: 2.5, gebuehr: 0.045 },
  { key: "zertifikat", name: "Knock-out-Zertifikat (Trade Republic, Scalable, Smartbroker …)", wartung: 0, gebuehr: 0 },
  { key: "eigen", name: "Eigene Werte", wartung: null, gebuehr: null },
];
const hebelBroker = (r) => HEBEL_BROKER.find((b) => b.key === (r && r.broker)) || HEBEL_BROKER[0];
const HEBEL_WARTUNG = 2.5, HEBEL_GEBUEHR = 0.05;   // Vorgaben in % fuer "Eigene Werte" mit leeren Feldern
function hebelRechnen(r) {
  const E = zahl(r.einstieg), H = zahl(r.hebel), S = zahl(r.stop), Z = zahl(r.ziel), einsatz = zahl(r.einsatz), maxV = zahl(r.maxverlust);
  if (!(E > 0) || !(H >= 1)) return null;
  const long = r.richtung !== "short", vz = long ? 1 : -1;
  // 0.57: Knock-out/Liquidation NACH Wartungsmarge und Gebuehren (Vorgabe 17.11.: 10x ist nicht 10 %, sondern ca. 7,7 %).
  // Liquidation, wenn Einsatz - Verlust - Gebuehr Eroeffnen - Gebuehr Schliessen = Wartungsmarge (alles bezogen auf das Volumen):
  //   long:  1/H - d - f - f(1-d) = m(1-d)  ->  d = (1/H - 2f - m) / (1 - f - m)
  //   short: 1/H - d - f - f(1+d) = m(1+d)  ->  d = (1/H - 2f - m) / (1 + f + m)
  const leer = (w) => w == null || String(w).trim() === "";
  const br = hebelBroker(r), eigen = br.key === "eigen";
  const m = Math.min(50, Math.max(0, !eigen ? br.wartung : leer(r.wartung) ? HEBEL_WARTUNG : zahl(r.wartung) || 0)) / 100;
  const f = Math.min(5, Math.max(0, !eigen ? br.gebuehr : leer(r.gebuehr) ? HEBEL_GEBUEHR : zahl(r.gebuehr) || 0)) / 100;
  const d = Math.max(0, (1 / H - 2 * f - m) / (long ? 1 - f - m : 1 + f + m));
  const ko = long ? E * (1 - d) : E * (1 + d);
  const hinterKo = (x) => (long ? x <= ko : x >= ko);
  // Produkt in % vom Einsatz bei Basiswert x, nach Gebuehren (Eroeffnen + Schliessen); am/hinter dem KO ist alles weg
  const wirkung = (x) => hinterKo(x) ? -100 : Math.max(-100, H * (vz * (x / E - 1) - f - f * x / E) * 100);
  const v = S > 0 ? wirkung(S) : null, g = Z > 0 ? wirkung(Z) : null;
  const ohneStop = r.ohneStop || !(S > 0);
  const risikoPct = ohneStop ? 100 : Math.abs(v);                         // ohne Stop: ganzer Einsatz kann weg (Knock-out)
  return { E, H, S, Z, long, ko, broker: br.key, wartung: m * 100, gebuehr: f * 100, koOhne: (long ? -100 : 100) / H, koSofort: d <= 0, koAbstand: (ko / E - 1) * 100, stopAbstand: S > 0 ? (S / E - 1) * 100 : null,
           zielAbstand: Z > 0 ? (Z / E - 1) * 100 : null, verlust: v, gewinn: g, crv: g > 0 && risikoPct > 0 ? g / risikoPct : null,
           ohneStop, risikoPct, risikoEur: einsatz ? einsatz * risikoPct / 100 : null,
           verlustEur: einsatz && v != null ? einsatz * v / 100 : null, gewinnEur: einsatz && g != null ? einsatz * g / 100 : null,
           einsatzFuerMax: maxV > 0 && risikoPct > 0 ? maxV / (risikoPct / 100) : null,
           stopHinterKo: S > 0 && (long ? S <= ko : S >= ko) };
}

/** Kursverlauf des gewaehlten Basiswerts (Depot oder Watchlist), in seiner Waehrung. */
function hebelBasisListe() {
  const l = [];
  for (const [did, d] of Object.entries(S.depots))
    for (const [iid, i] of Object.entries(d.instrumente)) if ((i.verlauf?.punkte || []).length > 5 && !l.some((x) => x.name === i.name)) l.push({ key: "d:" + did + ":" + iid, name: i.name || iid, punkte: i.verlauf.punkte });
  for (const w of S.watchlist || []) if ((w.verlauf?.punkte || []).length > 5) l.push({ key: "w:" + w.id, name: w.name, punkte: w.verlauf.punkte });
  return l;
}

/** Der Chart: Kursverlauf (wenn vorhanden) + Marken mit Verlust-/Gewinnzone. */
function hebelChart(r) {
  const x = hebelRechnen(r || {});
  if (!x) return "";
  const basis = hebelBasisListe().find((b) => b.key === r.basis);
  const kurse = basis ? basis.punkte.slice(-26).map((p) => p[1]) : [];
  const marken = [["Ziel", x.Z, "var(--plus)"], ["Einstieg", x.E, "var(--text)"], ["Stop", x.ohneStop ? null : x.S, "var(--warn)"], ["Knock-out", x.ko, "var(--minus)"]].filter((m) => m[1] > 0);
  const alle = [...marken.map((m) => m[1]), ...kurse], lo = Math.min(...alle), hi = Math.max(...alle), pad = (hi - lo) * 0.08 || hi * 0.05;
  const B = 300, H = 170, L = 180, y = (v) => (H - 8 - (v - (lo - pad)) / (hi - lo + 2 * pad) * (H - 16));
  // kurze Beschriftung, damit sie auch bei grossen Kursen (DAX 18.540) neben den Chart passt
  const z = (v) => fZahl.format(rund(v, v >= 1000 ? 0 : v >= 100 ? 1 : v >= 1 ? 2 : 4));
  const kurz = { "Knock-out": "KO", Einstieg: "Einstieg", Stop: "Stop", Ziel: "Ziel" };
  const zone = (a, b, farbe) => `<rect x="0" width="${L}" y="${Math.min(y(a), y(b)).toFixed(1)}" height="${Math.abs(y(a) - y(b)).toFixed(1)}" fill="${farbe}" fill-opacity=".13"/>`;
  // Labels nicht uebereinander: mindestens 12 px Abstand
  const lab = marken.map((m) => ({ m, yy: y(m[1]) })).sort((a2, b2) => a2.yy - b2.yy);
  for (let k = 1; k < lab.length; k++) if (lab[k].yy - lab[k - 1].yy < 12) lab[k].yy = lab[k - 1].yy + 12;
  return `<svg viewBox="0 0 ${B} ${H}" width="100%" aria-label="Hebel-Chart mit Marken" class="hebelchart">
    ${zone(x.E, x.ohneStop || !(x.S > 0) ? x.ko : x.S, "var(--minus)")}${x.Z > 0 ? zone(x.E, x.Z, "var(--plus)") : ""}
    ${kurse.length > 1 ? `<polyline points="${kurse.map((k, i) => `${(i / (kurse.length - 1) * L).toFixed(1)},${y(k).toFixed(1)}`).join(" ")}" fill="none" stroke="var(--akzent)" stroke-width="1.6"/>` : ""}
    ${marken.map(([t, v, f]) => `<line x1="0" x2="${L}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="${f}" stroke-width="${t === "Einstieg" ? 1.6 : 1.3}" ${t === "Stop" ? 'stroke-dasharray="4 3"' : ""}/>`).join("")}
    ${lab.map(({ m: [t, v, f], yy }) => `<text x="${L + 5}" y="${(yy + 3.5).toFixed(1)}" font-size="9.5" fill="${f}">${kurz[t]} ${z(v)}${t !== "Einstieg" ? " (" + ((v / x.E - 1) * 100 > 0 ? "+" : "") + fPct.format(rund((v / x.E - 1) * 100, 1)).replace(/[.,]?0+$/, "") + " %)" : ""}</text>`).join("")}
  </svg>${basis ? `<p class="klein" style="margin:2px 0 0">Linie: ${esc(basis.name)}, letzte 6 Monate (Wochenkurse).</p>` : ""}`;
}

function hebelZahlen(x) {
  const z = (v) => fZahl.format(rund(v, v >= 100 ? 2 : 4));
  return `
    <div class="kennzahlen">
      <div><small>Knock-out ca.</small><b class="minus-t">${z(x.ko)}</b><small>${pct(x.koAbstand)} entfernt</small></div>
      <div><small>Stop</small><b>${x.ohneStop ? "ohne" : z(x.S)}</b><small>${!x.ohneStop && x.verlust != null ? "Produkt " + pct(x.verlust) : "Risiko: alles bis KO"}</small></div>
      <div><small>Ziel</small><b>${x.Z ? z(x.Z) : "–"}</b><small>${x.gewinn != null ? "Produkt " + pct(x.gewinn) : ""}</small></div>
      <div><small>Chance : Risiko</small><b>${x.crv ? fPct.format(x.crv) + " : 1" : "–"}</b></div>
      ${x.risikoEur != null ? `<div><small>Risiko bei deinem Einsatz</small><b class="minus-t">${eur(x.risikoEur)}</b></div>` : ""}
      ${x.gewinnEur != null ? `<div><small>Gewinn bei Ziel</small><b class="plus-t">${eur(x.gewinnEur)}</b></div>` : ""}
      ${x.einsatzFuerMax != null ? `<div><small>Einsatz für deinen Max.-Verlust</small><b>${eur(x.einsatzFuerMax)}</b></div>` : ""}
    </div>
    ${x.koSofort ? `<p class="warn-t klein">Bei diesem Hebel fressen Wartungsmarge und Gebühren den ganzen Einsatz – die Position wäre sofort weg.</p>` : ""}
    ${x.stopHinterKo ? `<p class="warn-t klein">Der Stop liegt hinter dem Knock-out – vorher wäre schon alles weg.</p>` : ""}`;
}

function hebelErgebnis() {
  const r = ui.rechner || {}, x = hebelRechnen(r);
  if (!x) return `<p class="klein" style="margin:8px 0 0">Einstieg und Hebel eintragen.</p>`;
  return `${hebelChart(r)}${hebelZahlen(x)}
    <p class="klein">Knock-out nach Wartungsmarge ${fPct.format(x.wartung)} % und Gebühr ${fPct.format(x.gebuehr)} % je Seite: ${pct(x.koAbstand)} statt ${pct(x.koOhne)} (reine Rechnung 1/Hebel). Finanzierungskosten, Aufgeld und Spread sind nicht enthalten – den echten Liquidations- bzw. Knock-out-Preis zeigt deine Börse oder der Emittent. Keine Anlageberatung.</p>`;
}

function hebelRechner() {
  const r = ui.rechner ||= { richtung: "long" };
  if (!ui.rechnerOffen) return `<section class="karte"><button class="knopf" data-rechner-auf="1" style="width:100%">🧮 Hebel-Rechner mit Chart (Knock-out, Stop, Ziel)</button></section>`;
  const f = (n, t, ph) => `<label>${t}<input data-rechner="${n}" inputmode="decimal" value="${esc(r[n] || "")}" placeholder="${ph}"></label>`;
  const basen = hebelBasisListe();
  return `
    <section class="karte formular">
      <div style="display:flex;justify-content:space-between;align-items:center"><b>🧮 Hebel-Rechner</b>
        <button class="knopf klein" data-rechner-auf="0">schließen</button></div>
      ${legende(["<b>Hebel</b> 10 heißt: bewegt sich der Basiswert 1 %, bewegt sich dein Produkt 10 %.", "<b>Knock-out</b> = bei diesem Kurs ist der Einsatz weg.",
        "<b>Wartungsmarge</b> = Rest, den die Börse behält – deshalb liegt der Knock-out bei 10× nicht 10 %, sondern etwa 7,5–8 % entfernt.",
        "<b>Stop</b> = dein eigener Ausstieg vorher · <b>Ziel</b> = dort willst du Gewinn mitnehmen.", "<b>Chance : Risiko</b> 2 : 1 heißt: doppelt so viel Gewinn am Ziel wie Verlust am Stop.",
        "Im Chart: grün = Ziel, gestrichelt = Stop, rot = Knock-out."])}
      <label>Name<input data-rechner="titel" value="${esc(r.titel || "")}" placeholder="z. B. Hyperliquid Doppeltop short"></label>
      <div class="reiter"><button type="button" data-rechner-richtung="long" class="${r.richtung !== "short" ? "aktiv" : ""}">Long</button>
        <button type="button" data-rechner-richtung="short" class="${r.richtung === "short" ? "aktiv" : ""}">Short</button></div>
      ${basen.length ? `<label>Kursverlauf im Chart (optional)<select data-rechner-basis><option value="">– nur Marken –</option>${basen.map((b) =>
        `<option value="${esc(b.key)}" ${r.basis === b.key ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>` : ""}
      <div class="zwei">${f("einstieg", "Einstieg (Basiswert)", "z. B. 93")}${f("hebel", "Hebel", "z. B. 10")}</div>
      <label><span>Hebel ziehen: <b id="hebel-wert">${esc(r.hebel || "1")}</b>×</span><input type="range" min="1" max="${EIN().maxHebel || 10}" step="0.5" data-rechner="hebel" value="${esc(String(zahl(r.hebel) || 1))}" style="width:100%"></label>
      <div class="zwei">${f("stop", "Stop", "optional")}${f("ziel", "Ziel", "optional")}</div>
      <div class="reiter"><button type="button" data-rechner-stop="mit" class="${r.ohneStop ? "" : "aktiv"}">mit Stop</button>
        <button type="button" data-rechner-stop="ohne" class="${r.ohneStop ? "aktiv" : ""}">ohne Stop (ganzer Einsatz)</button></div>
      <label>Broker / Produkt<select data-rechner-broker>${HEBEL_BROKER.map((b) => `<option value="${b.key}" ${hebelBroker(r).key === b.key ? "selected" : ""}>${esc(b.name)}</option>`).join("")}</select></label>
      ${hebelBroker(r).key === "eigen" ? `<div class="zwei">${f("wartung", "Wartungsmarge %", fZahl.format(HEBEL_WARTUNG))}${f("gebuehr", "Gebühr % je Seite", fZahl.format(HEBEL_GEBUEHR))}</div>
      <p class="klein" style="margin:0">Leer = Vorgabe ${fZahl.format(HEBEL_WARTUNG)} % / ${fZahl.format(HEBEL_GEBUEHR)} %. Die genauen Werte stehen bei deiner Börse (Margin- und Gebührenseite).</p>`
        : hebelBroker(r).key === "zertifikat" ? `<p class="klein" style="margin:0">Beim Zertifikat legt der Emittent die Knock-out-Schwelle fest – meist etwas vor dem Basispreis. Den genauen Wert findest du im Produktblatt; die Ordergebühr ist ein fester Euro-Betrag.</p>`
        : `<p class="klein" style="margin:0">Vorgabe: Liquidation bei ${fZahl.format(hebelBroker(r).wartung)} % Restmarge, Gebühr ${fZahl.format(hebelBroker(r).gebuehr)} % je Seite. Den genauen Liquidationspreis zeigt ${esc(hebelBroker(r).name.replace(/ \(.*\)$/, ""))} beim Eröffnen. Andere Werte: „Eigene Werte“ wählen.</p>`}
      <div class="zwei">${f("einsatz", "Einsatz € (optional)", "z. B. 500")}${f("maxverlust", "Max. Verlust € (optional)", "z. B. 50")}</div>
      <div id="rechner-ergebnis">${hebelErgebnis()}</div>
      <button class="knopf haupt" data-rechner-notiz="1">Als Notiz speichern (mit Chart)</button>
    </section>`;
}

document.addEventListener("input", (ev) => {
  const n = ev.target.dataset?.rechner;
  if (!n) return;
  (ui.rechner ||= {})[n] = ev.target.value;
  if (n === "hebel") {                      // Schieberegler und Zahlenfeld gleich halten
    document.querySelectorAll('[data-rechner="hebel"]').forEach((el) => { if (el !== ev.target) el.value = ev.target.type === "range" ? String(ev.target.value).replace(".", ",") : String(zahl(ev.target.value) || 1); });
    const w = document.getElementById("hebel-wert"); if (w) w.textContent = String(ev.target.value).replace(".", ",");
  }
  document.getElementById("rechner-ergebnis").innerHTML = hebelErgebnis();     // nur Ergebnis neu, Eingabe behaelt den Fokus
});
document.addEventListener("change", (ev) => {
  if (ev.target.dataset?.rechnerBroker != null) { (ui.rechner ||= {}).broker = ev.target.value; return zeichnen(); }
  if (ev.target.dataset?.rechnerBasis == null) return;
  (ui.rechner ||= {}).basis = ev.target.value; document.getElementById("rechner-ergebnis").innerHTML = hebelErgebnis();
});
document.addEventListener("click", (ev) => {
  const t = (s) => ev.target.closest(s);
  let x;
  if ((x = t("[data-rechner-auf]"))) { ui.rechnerOffen = x.dataset.rechnerAuf === "1"; return zeichnen(); }
  if ((x = t("[data-rechner-richtung]"))) { (ui.rechner ||= {}).richtung = x.dataset.rechnerRichtung; return zeichnen(); }
  if ((x = t("[data-rechner-stop]"))) { (ui.rechner ||= {}).ohneStop = x.dataset.rechnerStop === "ohne"; return zeichnen(); }
  if ((x = t("[data-rechner-laden]"))) {
    const n = (S.notizen || []).find((y) => y.id === x.dataset.rechnerLaden);
    if (n?.rechner) { ui.rechner = { ...n.rechner }; ui.rechnerOffen = true; ui.notiz = null; zeichnen(); return scrollTo(0, 0); }
  }
  if (t("[data-rechner-notiz]")) {
    const r = hebelRechnen(ui.rechner || {});
    if (!r) return meldung("Erst Einstieg und Hebel eintragen.");
    const z = (v) => v ? fZahl.format(rund(v, 4)) : "–";
    ui.notiz = { bezug: "", rechner: { ...ui.rechner }, titel: ui.rechner.titel || `Hebel ${r.long ? "Long" : "Short"} ${z(r.E)}`,
      text: `${r.long ? "Long" : "Short"} · Hebel ${z(r.H)}\nEinstieg ${z(r.E)} · Knock-out ca. ${z(r.ko)} (${pct(r.koAbstand)})\n` +
      `${r.ohneStop ? "ohne Stop – Risiko: ganzer Einsatz bis Knock-out" : `Stop ${z(r.S)}${r.verlust != null ? " → Produkt " + pct(r.verlust) : ""}`} · Ziel ${z(r.Z)}${r.gewinn != null ? " → Produkt " + pct(r.gewinn) : ""}` +
      `${r.crv ? "\nChance : Risiko " + fPct.format(r.crv) + " : 1" : ""}${r.einsatzFuerMax ? "\nEinsatz für max. Verlust: " + fEur.format(r.einsatzFuerMax) : ""}\n(vereinfachte Rechnung)` };
    zeichnen(); return scrollTo(0, 0);
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

// ------------------------------------------------------------ Beta: Version + Fehler melden
const appVersion = () => (APP && APP.version ? APP.version() : "") || "Test";
const KONTAKT = "depot-kompass.breach557@passmail.net";
const kontaktLink = (betreff) => `mailto:${KONTAKT}?subject=${encodeURIComponent(betreff + " – Depot-Kompass " + appVersion())}`;

function feedbackSeite() {
  return `
    <h2><button class="knopf klein" data-ziel="mehr">‹ Mehr</button><span>Fehler melden (Alpha)</span></h2>
    <section class="karte">
      <p style="margin-top:0">Danke fürs Testen! Du hast <b>Version ${esc(appVersion())}</b>.</p>
      <p>Diese App ist in der <b>Alpha-Phase</b>. Sollte dir ein Fehler auffallen oder sonst etwas: schreib uns eine Mail.</p>
      <a class="knopf haupt" href="${kontaktLink("Fehler")}" style="display:block;text-align:center;text-decoration:none;overflow-wrap:anywhere;white-space:normal">✉️ Mail an uns<br><span class="klein" style="overflow-wrap:anywhere">${KONTAKT}</span></a>
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
        <li>PIN, Sicherungs-Passwort oder API-Schlüssel.</li>
      </ul>
      <p class="klein" style="margin-bottom:0">Die App selbst sendet nichts – es gibt keine Fehlerberichte im Hintergrund.</p>
    </section>`;
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
const HINWEIS_STD = { an: false, kurse: true, schwelle: 5, earnings: true, news: false, marken: true, stunden: 12 };
const hinweise = () => ({ ...HINWEIS_STD, ...(EIN().hinweise || {}) });

/** Alle Werte aus allen Depots (mit Bestand) und der Watchlist - Name, Ticker, kommende Earnings - plus (0.62) alle
 *  eingeschalteten Alarme mit Yahoo-Ticker als "marken": { id, name, art: unter|ueber|zone|prozent, wert, von, bis, prozent, basis, text }. */
function wachterWerte() {
  const m = new Map(), offen = D;
  try {
    for (const d of Object.values(S.depots || {})) {
      if (d.beobachtet) continue;
      D = d;
      for (const p of positionen().liste) {
        const i = p.inst || {};
        if (!i.ticker && !(i.termine?.earnings || []).length) continue;
        m.set(i.ticker || p.name, { name: p.name, ticker: i.ticker || "", earnings: (i.termine?.earnings || []).filter((x) => x >= heute()).slice(0, 4),
          suche: typeof newsBegriff === "function" ? newsBegriff(p.name) : p.name, news: !["ETF", "Fonds"].includes(i.art), marken: [] });
      }
    }
  } finally { D = offen; }
  for (const w of S.watchlist || []) if (w.ticker && !w.kursHand && !m.has(w.ticker))
    m.set(w.ticker, { name: w.name, ticker: w.ticker, earnings: [], suche: newsBegriff(w.name), news: true, marken: [] });
  for (const a of alarme()) {
    if (a.an === false) continue;
    const w = alarmWert(a.bezug);
    if (!w || !w.ticker) continue;
    const e = m.get(w.ticker) || { name: w.name, ticker: w.ticker, earnings: [], suche: newsBegriff(w.name), news: false, marken: [] };
    e.marken.push({ id: a.id, name: a.name, art: a.art, wert: a.wert, von: a.von, bis: a.bis, prozent: a.prozent, basis: a.basis, text: tr(alarmBedingung(a, true)) });
    m.set(w.ticker, e);
  }
  // Werte mit Alarmen zuerst, damit sie bei mehr als 60 Werten sicher geprueft werden
  return [...m.values()].sort((a, b) => (b.marken.length > 0) - (a.marken.length > 0)).slice(0, 60);
}

function wachterAbgleich() {
  if (!APP || !APP.wachterSetzen) return;
  const h = hinweise();
  if (!h.an || sicherheitStatus().netzAus) { APP.wachterSetzen(""); return; }
  const ok = APP.wachterSetzen(JSON.stringify({ stunden: h.stunden, schwelle: h.schwelle, kurse: h.kurse, earnings: h.earnings, news: h.news, marken: h.marken, sprache: sprache(),
    texte: { kanal: tr("Depot-Kompass – Hinweise"), earningsHeute: tr("Earnings heute"), earningsMorgen: tr("Earnings morgen"), seitGestern: tr("seit dem letzten Schlusskurs"),
      eineSchlagzeile: tr("1 neue Schlagzeile"), schlagzeilen: tr("%d neue Schlagzeilen"),
      kursJetzt: tr("Kurs jetzt") },
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
      <p class="klein">Ehrlich gesagt: Android prüft im Hintergrund nur alle paar Stunden (Akku). Das ist kein Sekunden-Alarm wie in einer Trading-App – für schnelle Stops nutze die Order beim Broker.</p>
      <p class="klein">Das geht nur mit Internet: Android startet die Prüfung alle paar Stunden im Hintergrund. Abgefragt werden nur öffentliche Kurse und Schlagzeilen zu den Namen deiner Werte – nie Beträge, Stückzahlen oder Konten. Die Liste der Werte liegt verschlüsselt auf dem Handy.</p>
      ${aus ? `<p class="klein warn-t">Internet ist in der App aus – im Offline-Modus gibt es keine Benachrichtigungen.</p>
        <button class="knopf" data-ziel="datenschutz" style="width:100%">🌐 Internet erlauben</button>` : ""}
    </section>
    <section class="karte liste">
      ${zeile("hinweis-an", "Benachrichtigungen an", "ab Werk aus", h.an && !aus)}
      ${zeile("hinweis-kurse", "Starke Kursbewegung", "Veränderung seit dem letzten Schlusskurs", h.kurse)}
      ${zeile("hinweis-marken", "Alarme", "deine Alarme aus Watchlist → 🔔 Alarme (Marken, Zonen, Bewegung in %)", h.marken)}
      ${zeile("hinweis-earnings", "Earnings heute oder morgen", "Termine aus „Kurse & Daten aktualisieren“", h.earnings)}
      ${zeile("hinweis-news", "Neue Schlagzeilen", "Google News, Suche nach dem Namen (ohne ETFs)", h.news)}
    </section>
    <section class="karte formular">
      <label>Kursbewegung ab<select id="hinweis-schwelle" ${aus ? "disabled" : ""}>${opt([3, 5, 8, 10, 15], h.schwelle, "%")}</select></label>
      <label>Prüfen etwa alle<select id="hinweis-stunden" ${aus ? "disabled" : ""}>${opt([6, 12, 24], h.stunden, "Std.")}</select></label>
      <p class="klein" style="margin:0">Android legt den genauen Zeitpunkt selbst fest (Akku sparen). Es werden höchstens 60 Werte geprüft.</p>
    </section>
    ${h.an && !aus ? `<section class="karte">
      <p class="klein" style="margin-top:0">${st.erlaubt ? "✓ Vom Handy erlaubt" : "⚠️ Vom Handy nicht erlaubt – bitte in den Android-Einstellungen der App Benachrichtigungen erlauben."}</p>
      ${!st.erlaubt ? `<button class="knopf" data-los="hinweis-einstellungen" style="width:100%;margin-bottom:8px">⚙️ Android-Einstellungen öffnen</button>` : ""}
      ${h.an && !aus && !st.geplant ? `<p class="klein warn-t" style="margin-top:0">⚠️ Die Hintergrund-Prüfung ist nicht eingeplant. Schalte Benachrichtigungen einmal aus und wieder an – kommt dann eine Meldung mit „Grund“, schick sie uns.</p>` : ""}
      <p class="klein">${st.geplant ? "✓ Prüfung ist eingeplant" : "Prüfung noch nicht eingeplant"}</p>
      <button class="knopf" data-los="hinweis-test" style="width:100%">🔔 Test-Benachrichtigung</button></section>` : ""}`;
}

document.addEventListener("change", (e) => {
  const id = e.target.id;
  if (!/^hinweis-/.test(id)) return;
  const h = (S.einstellungen ??= {}).hinweise = hinweise();
  if (id === "hinweis-an") h.an = e.target.checked;
  if (id === "hinweis-kurse") h.kurse = e.target.checked;
  if (id === "hinweis-earnings") h.earnings = e.target.checked;
  if (id === "hinweis-news") h.news = e.target.checked;
  if (id === "hinweis-marken") h.marken = e.target.checked;
  if (id === "hinweis-schwelle") h.schwelle = +e.target.value;
  if (id === "hinweis-stunden") h.stunden = +e.target.value;
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
      <label>Passwort (mind. 8 Zeichen)<input name="pw" type="password" autocomplete="new-password" required minlength="8"></label>
      <label>Passwort wiederholen<input name="pw2" type="password" autocomplete="new-password" required minlength="8"></label>
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
    if (pw.length < 8) return meldung("Mindestens 8 Zeichen.");
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
      <p class="klein"><b>Open-Source-Bausteine</b> (in der App enthalten, laufen offline):</p>
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
      <a class="knopf haupt" href="mailto:${KONTAKT}?subject=${encodeURIComponent("Fehlerprotokoll – Depot-Kompass " + appVersion())}&body=${encodeURIComponent(protokollBericht(kopf, liste))}" style="display:block;text-align:center;text-decoration:none;margin-bottom:8px">✉️ Fehlercodes per E-Mail senden</a>
      <p class="klein" style="margin-top:0">Öffnet deine Mail-App mit den Fehlercodes – du siehst alles vorher und entscheidest selbst, ob du sendest.</p>
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
