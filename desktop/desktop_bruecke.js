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
    pinSetzen: S("pinSetzen"), pinPruefen: S("pinPruefen"), sperreAufheben: S("sperreAufheben"), allesLoeschen: S("allesLoeschen"),
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
