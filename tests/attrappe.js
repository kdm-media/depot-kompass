"use strict";
/* Attrappe der Android-Schnittstelle (nur Tests, nur mit ?attrappe=1): antwortet wie Yahoo/Onvista mit festen Werten, ohne Netz. */
if (new URLSearchParams(location.search).get("attrappe")) {
  const antwort = (id, obj) => setTimeout(() => window.kursAntwort(id, obj == null ? "" : btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(obj))))), 5);
  const ZERT = { isin: "DE000BE0F1P5", wkn: "BE0F1P", entityType: "BOND", name: "VONTOBEL TURBOP O.END NVIDIA 224,83" };
  window.__aufrufe = []; window.__ablage = {}; window.__ablageNr = 0;
  window.Android = {
    laden: () => "", sichern: () => "ok", version: () => "Test", schluesselEnde: () => "",
    sicherheitStatus: () => JSON.stringify({ sperre: false, schutz: false, netzAus: false, pin: true, passwort: false, ordner: null, letzte: 0, datei: "" }),
    kurs: (t, id) => { window.__aufrufe.push("kurs:" + t); const S2 = window.__suche;
      const p = t === "EURUSD=X" ? [1.1, "USD"] : S2 && S2.kurse[t] ? S2.kurse[t] : null;
      antwort(id, p ? { chart: { result: [{ meta: { regularMarketPrice: p[0], currency: p[1], regularMarketTime: 1763000000 } }] } } : null); },
    suche: (b, id) => { window.__aufrufe.push("suche:" + b); const S2 = window.__suche; antwort(id, { quotes: (S2 && S2.yahoo[b]) || [] }); },
    verlauf: (t, id) => antwort(id, null),
    termine: (t, id) => { window.__aufrufe.push("termine:" + t); const e = window.__earnings;
      antwort(id, e ? { quoteSummary: { result: [{ calendarEvents: { earnings: { earningsDate: [{ raw: 4074000000 }] } }, earningsHistory: { history: e.quartale }, earnings: { financialsChart: { quarterly: [] } }, summaryDetail: {} }] } } : null); },
    originalAblegen: (b64) => { const id = "o" + (++window.__ablageNr) + "abcdef12"; window.__ablage[id] = b64; return id; },
    originalLesen: (id) => window.__ablage[id] || "", originalLoeschen: (id) => { delete window.__ablage[id]; },
    schluessel: () => "", zipExport: (index, name, liesmich) => { window.__zip = { index: JSON.parse(index), name, liesmich }; return "ok"; },
    zipLesen: (b64, pw) => pw !== "richtig" ? JSON.stringify({ fehler: "passwort" }) : JSON.stringify({ daten: window.__zipDaten, index: "[]", originale: 2 }),
    onvistaSuche: (b, id) => { window.__aufrufe.push("onvistaSuche:" + b); const S2 = window.__suche;
      antwort(id, { list: [ZERT.isin, ZERT.wkn].includes(b) ? [{ entityType: ZERT.entityType, isin: ZERT.isin, wkn: ZERT.wkn, name: ZERT.name }] : (S2 && S2.onvista[b]) || [] }); },
    onvistaKurs: (art, isin, id) => { window.__aufrufe.push("onvistaKurs:" + art + ":" + isin);
      antwort(id, art === ZERT.entityType && isin === ZERT.isin ? { quote: { last: 5.57, isoCurrency: "EUR", datetimeLast: "2026-11-12T19:47:37.913+00:00", market: { name: "Stuttgart" } } } : {}); },
  };
}
