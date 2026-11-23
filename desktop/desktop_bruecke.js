"use strict";
/* Depot-Kompass Desktop: ersetzt die Android-Schnittstelle (window.Android) durch Aufrufe an den lokalen Server.
 * Synchrone Funktionen (wie @JavascriptInterface) per synchronem XHR - nur an 127.0.0.1, nie ins Internet. */
(() => {
  const sync = (name, args) => {
    const x = new XMLHttpRequest();
    x.open("POST", "/api/" + name, false);
    x.setRequestHeader("X-Depot-Kompass", "1");
    x.setRequestHeader("Content-Type", "application/json");
    x.send(JSON.stringify(args));
    if (x.status !== 200) throw new Error("Desktop-Server: " + name + " " + x.status);
    return JSON.parse(x.responseText);
  };
  const b64 = (text) => { const b = new TextEncoder().encode(text); let s = ""; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(s); };
  const netz = (art, args, id) => {
    fetch("/api/netz/" + art, { method: "POST", headers: { "X-Depot-Kompass": "1", "Content-Type": "application/json" }, body: JSON.stringify(args) })
      .then((r) => r.ok ? r.text() : "").catch(() => "")
      .then((t) => window.kursAntwort(id, t ? b64(t) : ""));
  };
  const herunterladen = (name, mime, text) => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: mime || "application/octet-stream" }));
    a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  };
  const S = (n) => (...a) => sync(n, a);
  let rev = null;
  window.Android = {
    laden: () => { const d = sync("laden", []); rev = sync("revision", []); return d; },
    sichern: (json) => {
      const r = sync("sichern", [json, rev]);
      if (r && r.veraltet) { alert("Die Daten wurden inzwischen in einem anderen Fenster geändert. Die Seite wird neu geladen."); location.reload(); return false; }
      if (r && r.rev != null) rev = r.rev;
      return !!r;
    },
    version: S("version"), sicherheitStatus: S("sicherheitStatus"),
    netzSetzen: S("netzSetzen"), sperreNachSetzen: S("sperreNachSetzen"), schutzSetzen: S("schutzSetzen"), sperrBildschirmBereit: S("sperrBildschirmBereit"),
    pinSetzen: S("pinSetzen"),
    // Audit 23.11.: wie MainActivity - nach richtiger PIN die Oberflaeche selbst entsperren (vorher blieb die PIN-Seite bis zum Neuladen)
    pinPruefen: (pin) => { const r = sync("pinPruefen", [pin]); if (r === "ok") setTimeout(() => window.entsperrt && window.entsperrt(), 0); return r; }, sperreAufheben: S("sperreAufheben"), allesLoeschen: S("allesLoeschen"),
    schluesselSetzen: S("schluesselSetzen"), schluesselEnde: S("schluesselEnde"),
    verschluesseln: S("verschluesseln"), entschluesseln: S("entschluesseln"), jetztSichern: S("jetztSichern"),
    originalAblegen: S("originalAblegen"), originalLesen: S("originalLesen"), originalLoeschen: S("originalLoeschen"),
    zipExport: S("zipExport"), zipLesen: S("zipLesen"),
    ordnerWaehlen: () => alert("Auf dem Desktop liegen Sicherungen im Datenordner unter „sicherungen“."),
    exportieren: (name, mime, text) => herunterladen(name, mime, text),
    exportVerschluesselt: (name, text) => { const s = sync("exportVerschluesselt", [name, text]); if (!s) return false; herunterladen(name, "application/octet-stream", s); return true; },
    kurs: (t, id) => netz("kurs", [t], id), suche: (b, id) => netz("suche", [b], id), verlauf: (t, id) => netz("verlauf", [t], id),
    termine: (t, id) => netz("termine", [t], id), yahooNews: (b, id) => netz("yahooNews", [b], id), googleNews: (b, id) => netz("googleNews", [b], id),
    rss: (u, id) => netz("rss", [u], id), onvistaSuche: (b, id) => netz("onvistaSuche", [b], id), onvistaKurs: (a, i, id) => netz("onvistaKurs", [a, i], id),
    onvistaFinder: (t, w, f, id) => netz("onvistaFinder", [t, w, f], id), stimmung: (w, id) => netz("stimmung", [w], id),
    krypto: (art, sym, id) => netz("krypto", [art, sym], id),   // 0.78
    updatePruefen: (id) => netz("update", [], id), istDesktop: () => true,   // 0.83
    chartZeitraum: (t, z, id) => netz("chartZeitraum", [t, z], id),   // 0.70 (bildSpeichern gibt es am Desktop nicht: Teilen = Herunterladen)
    // 0.69: Teilen = Datei herunterladen (Bild, Text), Kopieren = Zwischenablage
    teilen: (name, mime, inhalt, istB64) => {
      try {
        if (istB64) { const bin = atob(inhalt), b = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([b], { type: mime || "application/octet-stream" })); a.download = name;
          document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000); }
        else herunterladen(name, mime, inhalt);
        // 0.78: am Desktop landet „Teilen“ als Datei im Download-Ordner des Browsers - sagen, wo
        try { setTimeout(() => meldung("Gespeichert im Download-Ordner deines Browsers."), 1500); } catch { /* egal */ }
        return true;
      } catch { return false; }
    },
    kopieren: (text) => { try { navigator.clipboard.writeText(String(text)); } catch { /* ohne Zwischenablage */ } },
    modelle: (id) => netz("modelle", [], id), ki: (k, id) => netz("ki", [k], id),
    kiAnfrage: (anbieter, modell, koerper, id) => netz("kiAnfrage", [anbieter, modell, koerper], id),
  };
  // App-Sperre nach Zeit (wie onResume in der App): Tab war laenger als "Sperre nach" im Hintergrund -> sperren und neu laden
  let weg = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { weg = Date.now(); return; }
    try {
      const st = JSON.parse(window.Android.sicherheitStatus());
      if (st.pin && weg && Date.now() - weg >= (st.sperreNach || 60) * 1000) { sync("sperren", []); location.reload(); }
    } catch { /* Server weg */ }
  });
})();
