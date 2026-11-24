// Testlauf Depot-Kompass - laeuft in der Testseite (headless Chromium) und
// meldet das Ergebnis per Seitentitel bzw. postMessage an den Rahmen.
// Sollwerte: tests/erwartet.json (Python, unabhaengig gerechnet).
"use strict";

const nah = (a, b, tol = 0.011) => Math.abs(a - b) <= tol;
// 0.78: 4h-Kerzen fuer den Fibonacci-Test (Sollwerte mit Python gerechnet: Hoch 119,5, Tief 81,5, 61,8 % = 96,016, Pivot 106,333)
const KERZEN_078 = [[1795000000,101,102.5,98.5,100],[1795014400,100,101.5,96.5,98],[1795028800,98,99.5,94.5,96],[1795043200,96,97.5,91.5,93],[1795057600,93,94.5,88.5,90],[1795072000,90,91.5,86.5,88],[1795086400,88,89.5,83.5,85],[1795100800,85,86.5,81.5,83],[1795115200,83,87.5,81.5,86],[1795129600,86,90.5,84.5,89],[1795144000,89,93.5,87.5,92],[1795158400,92,96.5,90.5,95],[1795172800,95,100.5,93.5,99],[1795187200,99,104.5,97.5,103],[1795201600,103,108.5,101.5,107],[1795216000,107,112.5,105.5,111],[1795230400,111,116.5,109.5,115],[1795244800,115,119.5,113.5,118],[1795259200,118,119.5,114.5,116],[1795273600,116,117.5,111.5,113],[1795288000,113,114.5,108.5,110],[1795302400,110,111.5,106.5,108],[1795316800,108,110.5,106.5,109],[1795331200,109,112.5,107.5,111],[1795345600,111,112.5,108.5,110],[1795360000,110,111.5,106.5,108],[1795374400,108,109.5,104.5,106],[1795388800,106,108.5,104.5,107],[1795403200,107,108.5,103.5,105],[1795417600,105,106.5,102.5,104]];
const kmTest = (sym) => ({ stand: "2026-11-23T01:00:00Z", sym, kraken: { long: 69.3, short: 30.7, oi: 1964.46, mark: 60950, funding: 0.0002 }, binance: { long: 66.91, short: 33.09, oi: 93109.24 }, fibo: fibo4h(KERZEN_078) });

async function datei(name, ordner = "beispieldaten/") { return (await fetch(ordner + name)).text(); }

async function importiere(text, name, alles = true, konto = null) {
  ui.einfuehrung = null; ui.seite = "daten";
  ui.vorschau = erkennen(text, name); zeichnen();
  if (alles && document.querySelector('[data-umfang="alles"]')) document.querySelector('[data-umfang="alles"]').click();
  if (konto) {                       // wie von Hand: Kontoname in der Vorschau aendern
    const f = document.getElementById("vorschau-konto");
    f.value = konto; f.dispatchEvent(new Event("change", { bubbles: true }));
  }
  const v = ui.vorschau, n = v.buchungen.filter((b) => !b.ueberspringen).length;
  vorschauUebernehmen();
  return { format: v.format, n, ziel: v.ziel };
}

async function beispielStand() {
  localStorage.clear();
  S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1");
  await importiere(await datei("tr_beispiel.csv"), "Transaktionsexport.csv");
  await importiere(await datei("kraken_ledger.csv"), "ledgers.csv");
  oeffnen("d1");
}

async function rechnen() {
  const soll = await (await fetch("erwartet.json")).json();
  const f = [];
  const pruefe = (ok, text) => { if (!ok) f.push(text); };

  await beispielStand();
  // --- Trade Republic
  const b = bestand();
  for (const [isin, [st, ein]] of Object.entries(soll.tr.positionen)) {
    const p = Object.values(b).find((x) => x.instrument === isin);
    pruefe(p && nah(p.stueck, st, 1e-9), `TR ${isin}: Stück ${p?.stueck} statt ${st}`);
    pruefe(p && nah(p.einstand, ein), `TR ${isin}: Einstand ${p?.einstand} statt ${ein}`);
  }
  const real = Object.values(b).reduce((s, x) => s + x.realisiert, 0);
  const div = Object.values(b).reduce((s, x) => s + x.dividenden, 0);
  pruefe(nah(real, soll.tr.realisiert), `TR realisiert ${real} statt ${soll.tr.realisiert}`);
  pruefe(nah(div, soll.tr.dividenden), `TR Dividenden ${div} statt ${soll.tr.dividenden}`);
  pruefe(nah(kontoStand().stand, soll.tr.konto), `TR Konto ${kontoStand().stand} statt ${soll.tr.konto}`);
  const tage = gvJeTag(["d1"]);
  for (const [d, g] of Object.entries(soll.tr.tage)) pruefe(tage[d] && nah(tage[d].gv, g), `G/V ${d}: ${tage[d]?.gv} statt ${g}`);
  pruefe(Object.keys(tage).length === Object.keys(soll.tr.tage).length, `G/V-Tage: ${Object.keys(tage).length}`);

  // --- doppelt importieren darf nichts aendern
  const vorher = D.buchungen.length;
  const r = await importiere(await datei("tr_beispiel.csv"), "Transaktionsexport.csv");
  oeffnen(r.ziel === "neu" ? "d1" : r.ziel);
  pruefe(D.buchungen.length === vorher, `Doppelimport: ${D.buchungen.length - vorher} neue Buchungen`);

  // --- Kraken: eigenes Depot, Bestand, Konto, Haltefristen (FIFO)
  const kid = Object.keys(S.depots).find((id) => S.depots[id].name === "Kraken");
  pruefe(!!kid, "Kraken-Depot nicht automatisch angelegt");
  if (kid) {
    oeffnen(kid);
    const ada = Object.values(bestand()).find((x) => x.instrument === "ADA");
    pruefe(ada && nah(ada.stueck, soll.kraken.ada[0], 1e-9) && nah(ada.einstand, soll.kraken.ada[1], 1e-3) && nah(ada.realisiert, soll.kraken.ada[2], 1e-3),
      `Kraken ADA ${JSON.stringify(ada && [ada.stueck, ada.einstand, ada.realisiert])} statt ${soll.kraken.ada}`);
    pruefe(nah(kontoStand().stand, soll.kraken.konto), `Kraken Konto ${kontoStand().stand} statt ${soll.kraken.konto}`);
    const hf = haltefristen().filter((x) => x.instrument === "ADA").map((x) => [x.kauf, rund(x.stueck, 8), x.ende]);
    pruefe(JSON.stringify(hf) === JSON.stringify(soll.kraken.haltefristen), `Haltefristen ${JSON.stringify(hf)}`);
    oeffnen("d1");
  }

  // --- Wertverlauf, Drawdown, KGV (kuenstliches Depot)
  const t0 = Date.UTC(2026, 0, 5) / 1000, w = 7 * 86400;
  S.depots.v = neuesDepot("Verlauf", "beobachtet"); oeffnen("v");
  D.instrumente.A = { name: "Test", art: "Aktie", kurs: 120, faktorEUR: 1,
    verlauf: { punkte: [100, 110, 99, 120].map((c, k) => [t0 + k * w, c]).concat(Array.from({ length: 8 }, (_, k) => [t0 + (4 + k) * w, 120])) } };
  const tag = (k) => new Date((t0 + k * w) * 1000).toISOString().slice(0, 10);
  D.buchungen = [{ nr: 1, typ: "kauf", datum: tag(0), instrument: "A", konto: "K", stueck: 1, kurs: 100 },
                 { nr: 2, typ: "kauf", datum: tag(2), instrument: "A", konto: "K", stueck: 1, kurs: 99 }];
  const v = wertverlauf(["v"]).gesamt;
  pruefe(JSON.stringify(v.index.slice(0, 4).map((x) => rund(x, 4))) === JSON.stringify(soll.verlauf.index), `Index ${v.index.slice(0, 4)}`);
  pruefe(nah(v.rendite * 100, soll.verlauf.rendite, 1e-3), `Rendite ${v.rendite * 100}`);
  pruefe(nah(v.drawdown * 100, soll.verlauf.drawdown, 1e-3), `Drawdown ${v.drawdown * 100}`);
  const kgv = depotKgv([{ wert: 600, inst: { art: "Aktie", termine: { kgv: 20 } } }, { wert: 400, inst: { art: "Aktie", termine: { kgv: 10 } } }]);
  pruefe(nah(kgv.kgv, soll.kgv, 1e-3), `KGV ${kgv.kgv}`);
  delete S.depots.v; oeffnen("d1");

  // --- Sachwerte: Kaufpreis mit Wertverlust, oder Wert von Hand; zaehlen nur im Gesamtvermoegen
  const vor2 = new Date(Date.now() - 2 * 365.25 * 864e5).toISOString().slice(0, 10);
  S.sachwerte = [{ id: "s1", name: "Laptop", art: "Technik", kaufdatum: vor2, kaufpreis: 2000, verlust: 25, wert: null },
                 { id: "s2", name: "Kamera", art: "Technik", kaufdatum: "", kaufpreis: 900, verlust: 25, wert: 500 }];
  pruefe(nah(sachwerteSumme(), 2000 * 0.75 ** 2 + 500, 0.5), `Sachwerte ${sachwerteSumme()} statt ${2000 * 0.75 ** 2 + 500}`);
  ui.seite = "depots"; zeichnen();
  pruefe(/Gesamtvermögen \(Depots \+ Cash \+ Sachwerte\)/.test(document.getElementById("inhalt").innerHTML), "Sachwerte fehlen im Gesamtvermögen");
  pruefe(!!document.querySelector(".fuss-hinweis"), "Hinweis keine Anlageberatung/Garantie fehlt");

  // --- Eigene News-Quelle (RSS + Atom), Filter auf eigene Werte
  const rss = `<?xml version="1.0"?><rss><channel><item><title>Alpha AG baut neues Werk in der Region</title><link>https://zeitung.example/1</link>
    <pubDate>Tue, 03 Nov 2026 08:00:00 GMT</pubDate></item><item><title>Stadtfest am Wochenende</title><link>https://zeitung.example/2</link></item></channel></rss>`;
  const atom = `<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Atom-Meldung</title><link href="https://blog.example/a"/><updated>2026-11-01T10:00:00Z</updated></entry></feed>`;
  const zl = [["Alpha AG", { name: "Alpha AG", ticker: "" }]];
  const nur = eigeneQuelleAuswerten({ name: "Regional", alle: false }, rss, zl), alles = eigeneQuelleAuswerten({ name: "Regional", alle: true }, rss, zl);
  pruefe(nur.length === 1 && nur[0].bezug === "Alpha AG" && alles.length === 2, `Eigene Quelle: ${nur.length}/${alles.length}`);
  const at = rssEintraege(atom);
  pruefe(at.length === 1 && at[0].link === "https://blog.example/a" && at[0].zeit > 0, "Atom-Feed nicht gelesen");

  // --- Stichtag-Depot (nur bestand.csv, Vorgabe 08.11.: "bei DB fehlt der Chart")
  {
    const vor = S.aktiv;
    S.depots.st = neuesDepot("Stichtag", "eigen"); oeffnen("st");
    const t0s = Date.UTC(2025, 10, 3) / 1000;
    D.instrumente.X = { name: "Stichtag AG", art: "Aktie", kurs: 150, faktorEUR: 1, verlauf: { punkte: Array.from({ length: 53 }, (_, k) => [t0s + k * 7 * 86400, 100 + k]) } };
    D.buchungen = [{ nr: 1, typ: "einbuchung", datum: heute(), instrument: "X", konto: "K", stueck: 10, einstand: 1000, kurs: 150 }];
    ui.alle = false; zeige("uebersicht");
    const svg = document.querySelector("#inhalt .wertchart svg");
    pruefe(!!svg && /heutiger Bestand/.test(document.getElementById("inhalt").textContent), "Stichtag-Depot: kein Chart des heutigen Bestands");
    const bv = bestandVerlauf(["st"]);
    pruefe(bv && nah(bv.wert[0], 1000) && nah(bv.wert.at(-1), 1520), `Stichtag-Verlauf ${bv && [bv.wert[0], bv.wert.at(-1)]}`);
    delete D.instrumente.X.verlauf; zeige("uebersicht");
    pruefe(!!document.querySelector("#inhalt .wertchart svg"), "Stichtag ohne Kurse: kein Chart");
    // Echter Kraken-Fall: Konto-Aktivitaeten (Einzahlungen, Transfers als Verlust) + Bestand von heute, ohne Kurse
    D.buchungen.push({ nr: 2, typ: "einzahlung", datum: "2026-07-15", konto: "K", betrag: 22, kontobewegung: true },
                     { nr: 3, typ: "verlust", datum: "2026-07-16", konto: "K", betrag: -20 },
                     { nr: 4, typ: "einzahlung", datum: "2026-09-19", konto: "K", betrag: 5 },
                     { nr: 5, typ: "verlust", datum: "2026-09-22", konto: "K", betrag: -5 });
    zeige("uebersicht");
    pruefe(!!document.querySelector("#inhalt .wertchart svg"), "Kraken-Fall (Konto + Bestand, ohne Kurse): kein Chart");
    // nur Kontobewegungen
    D.buchungen = D.buchungen.filter((b) => b.typ !== "einbuchung"); D.instrumente = {}; zeige("uebersicht");
    pruefe(!!document.querySelector("#inhalt .wertchart svg"), "Nur Kontobewegungen: kein Chart");
    delete S.depots.st; oeffnen(vor); ui.alle = undefined;
  }

  // --- Hebel-Rechner
  // reine Rechnung 1/Hebel (Wartungsmarge 0, Gebuehr 0)
  const l = hebelRechnen({ einstieg: "100", hebel: "5", stop: "90", ziel: "120", einsatz: "500", richtung: "long", broker: "eigen", wartung: "0", gebuehr: "0" });
  pruefe(nah(l.ko, 80) && nah(l.verlust, -50) && nah(l.gewinn, 100) && nah(l.crv, 2) && nah(l.verlustEur, -250), `Rechner long ${JSON.stringify(l)}`);
  const k2 = hebelRechnen({ einstieg: "100", hebel: "10", stop: "112", ziel: "95", richtung: "short", broker: "eigen", wartung: "0", gebuehr: "0" });
  pruefe(nah(k2.ko, 110) && k2.stopHinterKo && nah(k2.verlust, -100) && nah(k2.gewinn, 50), `Rechner short ${JSON.stringify(k2)}`);
  // --- 0.57: Knock-out NACH Wartungsmarge + Gebuehren (Vorgabe 17.11.: 10x ist nicht 10 %). Sollwerte aus Python (Decimal):
  //   long 100, 10x, MM 2,5 %, Gebuehr 0,05 %/Seite -> KO 92,40636 (-7,59364 %); short -> 107,21599 (+7,21599 %)
  //   MM 2,5 %, ohne Gebuehr -> 92,30769 (-7,69231 %); 5x long: KO 82,14469, Stop 90 -> -50,475 %, Ziel 120 -> +99,45 %; 50x -> sofort weg
  {
    const a = hebelRechnen({ einstieg: "100", hebel: "10", richtung: "long" });
    pruefe(nah(a.ko, 92.4063622, 1e-6) && nah(a.koAbstand, -7.5936378, 1e-6) && nah(a.koOhne, -10) && nah(a.wartung, 2.5) && nah(a.gebuehr, 0.05), `KO Vorgabe long: ${a.ko} / ${a.koAbstand}`);
    const b = hebelRechnen({ einstieg: "100", hebel: "10", richtung: "short" });
    pruefe(nah(b.ko, 107.2159922, 1e-6) && nah(b.koAbstand, 7.2159922, 1e-6), `KO Vorgabe short: ${b.ko}`);
    const c = hebelRechnen({ einstieg: "100", hebel: "10", richtung: "long", broker: "eigen", gebuehr: "0" });
    pruefe(nah(c.ko, 92.3076923, 1e-6), `KO MM 2,5 ohne Gebuehr: ${c.ko}`);
    const e5 = hebelRechnen({ einstieg: "100", hebel: "5", stop: "90", ziel: "120", richtung: "long" });
    pruefe(nah(e5.ko, 82.1446896, 1e-6) && nah(e5.verlust, -50.475, 1e-6) && nah(e5.gewinn, 99.45, 1e-6), `5x nach Gebuehren: ${JSON.stringify([e5.ko, e5.verlust, e5.gewinn])}`);
    // Broker-Vorgaben (Python): Hyperliquid 10x long MM 2,5 % f 0,045 % -> KO 92,39649 (-7,60351 %); Zertifikat = reine 1/Hebel -> 90; Kraken = Vorgabe
    const hl = hebelRechnen({ einstieg: "100", hebel: "10", richtung: "long", broker: "hyperliquid" });
    pruefe(nah(hl.ko, 92.3964907, 1e-6) && hl.broker === "hyperliquid", `Hyperliquid: ${hl.ko}`);
    const zt = hebelRechnen({ einstieg: "100", hebel: "10", richtung: "long", broker: "zertifikat", wartung: "9" });
    pruefe(nah(zt.ko, 90) && zt.wartung === 0, `Zertifikat: ${zt.ko}`);
    pruefe(nah(hebelRechnen({ einstieg: "100", hebel: "10", richtung: "long", broker: "kraken", wartung: "9" }).ko, 92.4063622, 1e-6), "Kraken-Vorgabe ignoriert eigene Felder nicht");
    // 0.73: Reihenfolge, Optionen (Sollwerte mit Python gerechnet), Suche nach Art
    // 0.76: Betrugs-Hinweis auf Fehler melden + Sicherheit
    for (const sx of ["feedback", "sicherheit"]) { zeige(sx); const tx = document.getElementById("inhalt").innerText;
      pruefe(/Vorsicht vor Betrügern/.test(tx) && /Seed-Phrase/.test(tx) && /nie von sich aus/.test(tx) && /Discord-Server/.test(tx), "0.76: Betrugs-Hinweis fehlt auf " + sx); }
    zeige("uebersicht");
    pruefe(HEBEL_BROKER[0].key === "zertifikat" && hebelBroker({}).key === "kraken", "0.73: Knock-out zuerst, alte Notizen ohne broker bleiben Kraken");
    { const o = hebelRechnen({ broker: "option", richtung: "long", einstieg: "180", basispreis: "200", preis: "4,20", einsatz: "1000", ordergebuehr: "1", ziel: "220" });
      pruefe(o && o.option && o.n === 2 && nah(o.investiert, 840) && nah(o.be, 204.21, 1e-9) && nah(o.gewinnEur, 3158, 1e-9) && nah(o.gewinn, 375.505351, 1e-5) && nah(o.maxVerlust, 841)
        && nah(o.ergebnisBei(190), -841) && !o.imGeld, `0.73 Option Call: ${o && JSON.stringify([o.n, o.investiert, o.be, o.gewinnEur, o.gewinn, o.maxVerlust])}`);
      const w = hebelRechnen({ broker: "optionsschein", richtung: "short", einstieg: "100", basispreis: "90", preis: "0,5", bv: "0,1", einsatz: "100", ziel: "80" });
      pruefe(w && nah(w.n, 200) && nah(w.be, 85, 1e-9) && nah(w.gewinnEur, 100, 1e-9) && nah(w.gewinn, 100, 1e-9) && nah(w.ergebnisBei(95), -100), `0.73 Optionsschein Put: ${w && JSON.stringify([w.n, w.be, w.gewinnEur])}`);
      pruefe(hebelRechnen({ broker: "option", einstieg: "180", basispreis: "200" }) === null, "0.73 Option ohne Prämie muss leer bleiben");
      const dc = hebelRechnen({ broker: "discount", einstieg: "180", basispreis: "190", preis: "16,20", bv: "0,1", einsatz: "1000", ordergebuehr: "1", ziel: "200" });
      pruefe(dc && dc.discount && dc.n === 61 && nah(dc.investiert, 988.2, 1e-9) && nah(dc.be, 162.327869, 1e-5) && nah(dc.rabatt, 10, 1e-9) && nah(dc.maxErtragEur, 168.8, 1e-9)
        && nah(dc.maxErtrag, 17.064294, 1e-5) && nah(dc.ergebnisBei(170), 46.8, 1e-9) && nah(dc.gewinnEur, 168.8, 1e-9), `0.74 Discount: ${dc && JSON.stringify([dc.n, dc.be, dc.rabatt, dc.maxErtragEur, dc.maxErtrag])}`);
      const nq = festeTreffer("nasdaq", "alle").map((t) => t.symbol);
      pruefe(nq[0] === "^NDX" && nq.includes("^IXIC") && festeTreffer("gold", "index").length === 0 && festeTreffer("gold", "rohstoff")[0]?.symbol === "GC=F", `0.73 Suche nach Art: ${nq}`);
      ui.rechner = null; ui.rechnerOffen = true; ui.notizReiter = "derivate"; zeige("notizen");
      pruefe(ui.rechner?.broker === "zertifikat" && document.querySelectorAll("[data-rechner-suchart]").length === 6, "0.73: neuer Rechner = Knock-out, 6 Such-Arten");
      ui.rechner = { broker: "option", richtung: "long", einstieg: "180", basispreis: "200", preis: "4,20", einsatz: "1000", ziel: "220", verfall: "2027-03-19" }; zeichnen();
      const txt = document.getElementById("inhalt").innerText;
      pruefe(/Break-even am Verfall/.test(txt) && /Höchster Verlust/.test(txt) && document.querySelector(".hebelchart") && /Call \(steigt\)/.test(txt), "0.73: Options-Ansicht unvollständig");
      ui.rechner = null; ui.rechnerOffen = false; ui.notizReiter = null; }
    // 0.77: Spot + neue Boersen, Waehrung, Betraege aus im Chart, Zeitachse (Sollwerte mit Python gerechnet)
    { const sp = hebelRechnen({ broker: "kraken_spot", richtung: "short", einstieg: "100", einsatz: "1000", ziel: "110", stop: "95", waehrung: "CAD" });
      pruefe(sp && sp.spot && sp.long && sp.H === 1 && sp.ko === 0 && nah(sp.gewinnEur, 91.6, 1e-9) && nah(sp.verlustEur, -57.8, 1e-9) && sp.waehrung === "CAD",
        `0.77 Spot Kraken: ${sp && JSON.stringify([sp.H, sp.ko, sp.gewinnEur, sp.verlustEur, sp.waehrung])}`);
      pruefe(nah(hebelRechnen({ broker: "bitunix", einstieg: "100", hebel: "10" }).ko, 90.56717618664521, 1e-9)
        && nah(hebelRechnen({ broker: "binance", einstieg: "100", hebel: "10" }).ko, 90.45705675539931, 1e-9)
        && nah(hebelRechnen({ broker: "binance", einstieg: "100", hebel: "10", gebuehr: "0,1" }).ko, 90.55276381909547, 1e-9), "0.77: Binance/Bitunix-Knock-out (Vorgabe und eigene Gebühr)");
      pruefe(["kraken_spot", "bitvavo", "binance_spot", "bitunix_spot", "binance", "bitunix"].every((k) => HEBEL_BROKER.some((b) => b.key === k)) && HEBEL_BROKER[0].key === "zertifikat", "0.77: neue Broker fehlen");
      const rv = { broker: "zertifikat", richtung: "long", einstieg: "100", basispreis: "90", bv: "0,1", einsatz: "500", ziel: "120", stop: "95" };
      ui.verdeckt = true; const cv = hebelChart(rv), kv = hebelKacheln(hebelRechnen(rv)); ui.verdeckt = false;
      const cs = hebelChart(rv);
      pruefe(!/[+−-]\d[\d.]*\s?€/.test(cv) && /•••/.test(cv) && /€/.test(cs) && kv.find((k) => k[0] === "Stückzahl")?.[1] === "•••",
        "0.77: Beträge aus – Chart zeigt Euro oder Stückzahl");
      const pk = []; for (let i = 0; i < 30; i++) pk.push([`2026-${String(1 + Math.floor(i / 28)).padStart(2, "0")}-${String(1 + i % 28).padStart(2, "0")}`, i === 7 ? 150 : i === 20 ? 50 : 100]);
      const zt = zeitraumText({ name: "Test" }, { punkte: pk, art: "Tageskurse" });
      pruefe(/Hoch 150 am 08\.01\.26/.test(zt) && /Tief 50 am 21\.01\.26/.test(zt), `0.77 Zeit von Hoch/Tief: ${zt}`);
      ui.rechner = { broker: "kraken_spot", einstieg: "100", einsatz: "1000" }; ui.rechnerOffen = true; ui.notizReiter = "derivate"; zeige("notizen");
      pruefe(document.querySelector("[data-rechner-waehrung]") && !document.querySelector('input[type=range][data-rechner="hebel"]') && !document.querySelector("[data-rechner-richtung]"), "0.77: Spot-Formular (Währung, kein Hebel, keine Richtung)");
      // 0.77b: Kerzen + Volumen, Jahresachse 5J, 1W, Preisskala links, Einstieg ziehbar
      const kz = []; for (let i = 0; i < 40; i++) kz.push([`2026-11-${String(10 + Math.floor(i / 8)).padStart(2, "0")}T${String(9 + i % 8).padStart(2, "0")}:30`, 100 + i % 5, 100 + (i + 2) % 5, 106 + i % 3, 95 - i % 2, 1000 + i * 10]);
      const jw = []; for (let i = 0; i < 120; i++) { const d = new Date(Date.UTC(2022, 0, 3 + i * 14)); jw.push([d.toISOString().slice(0, 10), 100 + i]); }
      ui.hebelVerlauf = { "BTC-CAD|1w": kz, "BTC-CAD|5j": jw };
      const rk = { broker: "kraken_spot", einstieg: "100", einsatz: "1000", basis: "frei", zeitraum: "1w", basisFrei: { name: "Bitcoin CAD", symbol: "BTC-CAD", punkte: [["2026-11-01", 1], ["2026-11-02", 2]] } };
      const c1 = document.createElement("div"); c1.innerHTML = hebelChart(rk); const sv = c1.querySelector("svg");
      pruefe(sv && sv.dataset.kerzen === "1" && sv.dataset.volumen === "1" && /10\.11\./.test(c1.innerHTML) && /14\.11\./.test(c1.innerHTML) && /Hoch 108 am 10\.11\.26/.test(c1.textContent), `0.77b 1W-Kerzen: ${sv && [sv.dataset.kerzen, sv.dataset.volumen]} ${c1.textContent.slice(-120)}`);
      rk.zeitraum = "5j"; const c5 = document.createElement("div"); c5.innerHTML = hebelChart(rk);
      const jt = [...c5.querySelectorAll("text")].map((t) => t.textContent);
      pruefe(["23", "24", "25", "26"].every((j) => jt.includes(j)) && c5.querySelector("svg").dataset.kerzen === "0", `0.77b 5J-Jahresachse: ${jt.join("|").slice(0, 200)}`);
      pruefe(jt.some((t) => /^\d[\d.,]*$/.test(t) && +t.replace(/\./g, "").replace(",", ".") >= 100), "0.77b Preisskala links fehlt");
      ui.rechner = Object.assign({}, rk, { zeitraum: "1w" }); ui.rechnerOffen = true; ui.notizReiter = "derivate"; zeige("notizen");
      const sv2 = document.querySelector("#rechner-ergebnis svg.hebelchart"), le = sv2 && sv2.querySelector('line[data-marke="Einstieg"]');
      if (le) { const bb = sv2.getBoundingClientRect(), m = sv2.getScreenCTM(), yy = +le.getAttribute("y1"), px = bb.left + bb.width * 0.4, py = m.f + m.d * yy;
        document.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, clientX: px, clientY: py }))); le.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, clientX: px, clientY: py }));
        document.dispatchEvent(new PointerEvent("pointermove", { bubbles: true, clientX: px, clientY: py - 30 })); document.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })); }
      pruefe(le && zahl(ui.rechner.einstieg) > 100, `0.77b Einstieg ziehen: ${ui.rechner && ui.rechner.einstieg}`);
      ui.hebelVerlauf = null; ui.rechner = null; ui.rechnerOffen = false; ui.notizReiter = null;
      // 0.77c: Waehrung der Rechner als Einstellung + Kurse verbergen im Hebel-Chart
      { const alt = S.einstellungen; S.einstellungen = { ...(alt || {}), rechnerWaehrung: "USD" };
        const hu = hebelRechnen({ broker: "kraken", einstieg: "100", hebel: "10", einsatz: "100" });
        const hc = hebelRechnen({ broker: "kraken", einstieg: "100", hebel: "10", einsatz: "100", waehrung: "CAD" });
        pruefe(hu && hu.waehrung === "USD" && hc.waehrung === "CAD" && nkUsd({}) && !nkUsd({ waehrung: "eur" }) && nkUsd({ waehrung: "usd" }),
          `0.77c Währung aus Einstellung: ${hu && hu.waehrung} ${hc && hc.waehrung}`);
        zeige("einstellungen");
        pruefe(/Währung der Rechner|Calculator currency/.test(document.body.textContent), "0.77c Einstellung „Währung der Rechner“ fehlt");
        S.einstellungen = { ...(alt || {}) }; delete S.einstellungen.rechnerWaehrung;
        pruefe(hebelRechnen({ broker: "kraken", einstieg: "100", hebel: "10" }).waehrung === "EUR" && !nkUsd({}), "0.77c ohne Einstellung muss Euro gelten");
        const rk = { broker: "kraken", einstieg: "12345", hebel: "10", einsatz: "100", ziel: "13000", stop: "12000" };
        S.einstellungen.verstecken = "kurse"; ui.verdeckt = true; const ck = hebelChart(rk); ui.verdeckt = false;
        S.einstellungen = alt;
        pruefe(!/12\.345|12345/.test(ck) && /•••/.test(ck) && /%/.test(ck) && /12\.345/.test(hebelChart(rk)), "0.77c „+ Kurse“: Hebel-Chart zeigt Kurse"); }
      ui.rechner = null; ui.rechnerOffen = false; ui.notizReiter = null; }
    ui.rechner = { einstieg: "100", hebel: "10", richtung: "long" }; ui.rechnerOffen = true; ui.notizReiter = "derivate"; zeige("notizen");
    const sel = document.querySelector("[data-rechner-broker]");
    pruefe(sel && sel.value === "kraken" && !document.querySelector('[data-rechner="wartung"]'), "Broker-Auswahl fehlt oder Felder sichtbar bei Kraken");
    sel.value = "eigen"; sel.dispatchEvent(new Event("change", { bubbles: true }));
    pruefe(ui.rechner.broker === "eigen" && !!document.querySelector('[data-rechner="wartung"]'), "Eigene Werte: Felder fehlen");
    ui.rechnerOffen = false; ui.rechner = null; ui.notizReiter = null; zeige("uebersicht");
    const e50 = hebelRechnen({ einstieg: "100", hebel: "50", richtung: "long" });
    pruefe(e50.koSofort && nah(e50.ko, 100), "50x mit MM 2,5 %: sofort weg");
    pruefe(nah(hebelRechnen({ einstieg: "100", hebel: "10", richtung: "long", broker: "eigen", wartung: "1,5" }).ko, (100 * (1 - (0.1 - 0.001 - 0.015) / (1 - 0.0005 - 0.015)))), "Wartungsmarge mit Komma");
  }
  // --- 0.59: Fehlerprotokoll - Sammeln, Gruppieren, Ursachen, Zahlen maskiert
  {
    window.__protokoll = [];
    protokoll("Wächter", "setzen=false · Länge 812 · vom Handy erlaubt=true · geplant=false · Grund=JobScheduler hat die Hintergrund-Prüfung abgelehnt (RESULT_FAILURE)");
    protokoll("Wächter", "setzen=false · Länge 815 · vom Handy erlaubt=true · geplant=false · Grund=JobScheduler hat die Hintergrund-Prüfung abgelehnt (RESULT_FAILURE)");
    meldung("Speichern fehlgeschlagen! 1.234,56 €");
    protokoll("Wächter: Einrichten fehlgeschlagen", "java.lang.SecurityException: android.permission.ACCESS_NETWORK_STATE required for jobs with a connectivity constraint");
    const a = protokollAuswerten(protokollText());
    pruefe(a.length === 3 && a.some((x) => x.anzahl === 2 && /JobScheduler/.test(x.ursache)) && a.some((x) => x.code === "DK-09"), `Protokoll-Auswertung: ${JSON.stringify(a)}`);
    pruefe(!/1\.234/.test(protokollText()) && /# €/.test(protokollText()), "Protokoll: Zahlen nicht maskiert");
    pruefe(a.find((x) => x.anzahl === 2).code === "DK-04" && /DK-04 · 2×/.test(protokollBericht("Kopf", a)), `Fehlercode: ${a.map((x) => x.code)}`);
    ui.seite = "fehlerprotokoll"; zeichnen();
    pruefe(/Auswertung/.test(document.getElementById("inhalt").textContent) && document.querySelector('[data-los="protokoll-teilen"]') , "Fehlerprotokoll-Seite fehlt");
    // 0.70: Kontakt nur ueber Discord-Ticket - Fehlercodes kopieren statt E-Mail, keine mailto-Links mehr
    { const k = document.querySelector('#inhalt button[data-kopieren]'), d = document.querySelector('#inhalt a[href^="https://discord.gg/"]');
      pruefe(k && /DK-04/.test(k.dataset.kopieren) && d && !document.querySelector('#inhalt a[href^="mailto:"]'), `Fehlercodes kopieren/Discord: ${k ? k.dataset.kopieren.slice(0, 120) : "kein Knopf"}`); }
    window.__protokoll = []; zeige("uebersicht");
  }
  // --- 0.62: Alarme - Uebernahme alter Marken, vier Arten, Zone/Prozent, Waechter-Daten, Reiter + Formular
  {
    const altW = S.watchlist, altA = S.alarme;
    S.alarme = [];
    S.watchlist = [...(altW || []), { id: "wtest", name: "Testwert", ticker: "TST.DE", kurs: 100, kaufMarke: 90, verkaufMarke: 120 },
                   { id: "wtest2", name: "Handkurs", ticker: "HND.DE", kurs: 5, kaufMarke: 6, kursHand: true }];
    const pos = positionen().liste.find((p) => p.inst);
    pruefe(!!pos, "Keine Position für den Alarm-Test");
    const tAlt = pos.inst.ticker; if (!tAlt) pos.inst.ticker = "ALM.DE";
    pos.inst.alarmUnter = 1.5;
    const l = alarme();
    pruefe(l.length === 4 && l.some((a) => a.bezug === "w:wtest" && a.name === "Kaufmarke" && a.art === "unter" && a.wert === 90)
      && l.some((a) => a.name === "Alarm unter" && a.bezug === `p:${S.aktiv}:${pos.id}`)
      && !S.watchlist.some((w) => w.kaufMarke != null) && pos.inst.alarmUnter == null, `Übernahme alter Marken: ${JSON.stringify(l)}`);
    // Zustaende (Sollwerte von Hand nachvollziehbar: 90/100-1 = -10 %)
    pruefe(alarmStand({ art: "unter", wert: 90 }, 100).erreicht === false && Math.abs(alarmStand({ art: "unter", wert: 90 }, 100).abstand + 10) < 1e-9, "Abstand Marke unter");
    pruefe(alarmStand({ art: "zone", von: 110, bis: 95 }, 100).erreicht && !alarmStand({ art: "zone", von: 95, bis: 99 }, 100).erreicht
      && Math.abs(alarmStand({ art: "zone", von: 95, bis: 99 }, 100).abstand + 1) < 1e-9, "Zone falsch");
    pruefe(alarmStand({ art: "prozent", prozent: -10, basis: 100 }, 90).erreicht && !alarmStand({ art: "prozent", prozent: -10, basis: 100 }, 91).erreicht
      && alarmStand({ art: "prozent", prozent: 15, basis: 100 }, 115).erreicht, "Bewegung in % falsch");
    l.push({ id: "az", name: "Kaufzone", bezug: "w:wtest", art: "zone", von: 95, bis: 105, an: true });
    l.push({ id: "aaus", name: "Aus", bezug: "w:wtest", art: "ueber", wert: 50, an: false });
    pruefe(watchSignal(S.watchlist.find((w) => w.id === "wtest")) === "🔔 Kaufzone", `Watchlist-Markierung: ${watchSignal(S.watchlist.find((w) => w.id === "wtest"))}`);
    const ww = wachterWerte(), e = ww.find((x) => x.ticker === "TST.DE");
    pruefe(e && e.marken.length === 3 && e.marken.some((m) => m.art === "zone" && m.von === 95 && /Zone/.test(m.text)) && !e.marken.some((m) => m.id === "aaus") && ww[0].marken.length > 0,
      `Wächter-Daten: ${JSON.stringify(e)}`);
    pruefe(!ww.some((x) => x.ticker === "HND.DE"), "Handkurs darf nicht in den Wächter");
    pruefe(ww.find((x) => x.ticker === pos.inst.ticker)?.marken.some((m) => m.art === "unter" && m.wert === 1.5), "Positions-Alarm fehlt im Wächter");
    // Reiter + Formular
    ui.seite = "watchlist"; ui.watchReiter = "alarme"; zeichnen();
    pruefe(/Kaufzone/.test(document.getElementById("inhalt").textContent) && document.querySelector('[data-alarm="neu"]'), "Reiter Alarme fehlt");
    ui.alarm = "neu"; ui.alarmEntwurf = null; ui.alarmBezug = "w:wtest"; zeichnen();
    const f = document.getElementById("alarm-form");
    f.querySelector('[name="art"]').value = "prozent"; f.querySelector('[name="art"]').dispatchEvent(new Event("change", { bubbles: true }));
    const f2 = document.getElementById("alarm-form");
    pruefe(!!f2.querySelector('[name="prozent"]') && !f2.querySelector('[name="wert"]'), "Formular: Feld für % fehlt");
    f2.querySelector('[name="name"]').value = "Rücksetzer"; f2.querySelector('[name="prozent"]').value = "-10";
    f2.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const neuA = alarme().find((a) => a.name === "Rücksetzer");
    pruefe(neuA && neuA.art === "prozent" && neuA.prozent === -10 && neuA.basis === 100 && !ui.alarm, `Alarm speichern: ${JSON.stringify(neuA)}`);
    // Text teilen / einfuegen (0.62): Rundweg, neuer Wert -> Watchlist, Doppelte, Fehlerzeilen, deutsche Zahlen
    const txt = alarmeTextKopf() + "\n" + alarme().filter((a) => a.bezug === "w:wtest").map(alarmAlsText).join("\n");
    pruefe(/Testwert \| TST\.DE \| Kaufzone \| zone 95 bis 105/.test(txt) && /Rücksetzer \| prozent -10 ab 100/.test(txt), `Alarm-Text: ${txt}`);
    const vorher = alarme().length;
    const r1 = alarmeAusText(txt);
    pruefe(r1.angelegt === 0 && r1.doppelt === alarme().filter((a) => a.bezug === "w:wtest").length && alarme().length === vorher, `Doppelte nicht erkannt: ${JSON.stringify(r1)}`);
    const r2 = alarmeAusText("Solana | SOL-EUR | Kaufzone | zone 60,1 bis 62,8\nBitcoin | BTC-EUR | Stop | unter 50.009\nXRP | XRP-EUR | Rücksetzer | prozent -8\nKaputt | X | Y | irgendwas\n# Kommentar\nTestwert | TST.DE | Ziel 2 | über 1.234,5");
    const sol = alarme().find((a) => a.name === "Kaufzone" && alarmWert(a.bezug)?.name === "Solana"), btc = alarme().find((a) => a.name === "Stop" && alarmWert(a.bezug)?.name === "Bitcoin");
    pruefe(r2.angelegt === 4 && r2.ueber === 3 && r2.fehler.length === 1 && sol && sol.von === 60.1 && sol.bis === 62.8 && btc && btc.wert === 50009
      && alarme().some((a) => a.bezug === "w:wtest" && a.name === "Ziel 2" && a.wert === 1234.5) && S.watchlist.some((w) => w.ticker === "XRP-EUR" && w.art === "Krypto"), `Alarm-Einfügen: ${JSON.stringify(r2)}`);
    if (!tAlt) delete pos.inst.ticker;
    S.watchlist = altW; S.alarme = altA; ui.watchReiter = null;
    ui.seite = "hinweise"; zeichnen();
    pruefe(!!document.getElementById("hinweis-marken") && /kein Sekunden-Alarm/.test(document.getElementById("inhalt").textContent), "Schalter Alarme fehlt");
    zeige("uebersicht");
  }
  // --- 0.63 (Sicherheit): HTML-Einschleusung - fremder Text darf nirgends als HTML wirken (alle Seiten + Formulare)
  {
    const sicher = JSON.stringify(S), altD = S.aktiv;
    const P = (k) => `<img id="xss${k}" src="x"><a id="xssa${k}" href="https://boese.example">x</a><b id="xssb${k}">`;
    D.name = "Depot" + P(1);
    const iid = Object.keys(D.instrumente)[0];
    if (iid) Object.assign(D.instrumente[iid], { name: "Wert" + P(2), notiz: P(3), branche: "Br" + P(4), ticker: "TST.DE" });
    S.watchlist = [{ id: "wx", name: "Watch" + P(5), kennung: "X" + P(6), art: "Aktie", kurs: 10, notiz: P(7), ticker: "WX.DE", aufgenommen: "2026-01-01" }];
    S.alarme = [{ id: "ax", name: "Alarm" + P(8), bezug: "w:wx", art: "unter", wert: 9, an: true }];
    S.notizen = [{ id: "nx", titel: "Notiz" + P(9), text: "Text" + P(10), datum: "2026-01-02T10:00:00Z", bezug: "" }];
    S.news = { stand: new Date().toISOString(), eintraege: [{ titel: "News" + P(11), quelle: "Quelle" + P(12), zeit: Date.now(), link: "javascript:alert(1)", bezug: "Wert" + P(2), sprache: "de" }] };
    S.kiChats = [{ id: "kx", titel: "Chat" + P(13), anbieter: "openrouter", modell: "m", erstellt: new Date().toISOString(),
      nachrichten: [{ rolle: "nutzer", text: "Frage" + P(14), zeit: new Date().toISOString() }, { rolle: "ki", text: "**Antwort**" + P(15) + "\n- Punkt" + P(16), zeit: new Date().toISOString() }] }];
    S.sachwerte = [{ id: "sx", name: "Sache" + P(17), art: "Technik", kaufdatum: "2025-01-01", kaufpreis: 100, verlust: 10, wert: null }];
    const treffer = [];
    const pruef = (wo) => { const el = document.querySelector('[id^="xss"]'); if (el) treffer.push(`${wo}: <${el.tagName.toLowerCase()} id=${el.id}>`);
      const js = [...document.querySelectorAll("a[href]")].find((a) => /^javascript:/i.test(a.getAttribute("href"))); if (js) treffer.push(wo + ": javascript-Link"); };
    const seiten = ["uebersicht", "positionen", "watchlist", "kalender", "news", "notizen", "mehr", "daten", "depots", "buchungen", "sicherheit",
                    "datenschutz", "einstellungen", "schluessel", "ki", "hinweise", "unterstuetzen", "sachwerte", "steuer", "feedback", "fehlerprotokoll"];
    for (const sx of seiten) { try { zeige(sx); pruef(sx); } catch (e) { treffer.push(sx + ": Absturz " + e.message); } }
    const extra = [["Detail", () => { ui.detail = iid; }], ["Watch-Formular", () => { ui.watch = "wx"; }], ["Alarme", () => { ui.seite = "watchlist"; ui.watchReiter = "alarme"; }],
                   ["Alarm-Formular", () => { ui.alarm = "ax"; ui.alarmEntwurf = null; }], ["Notiz", () => { ui.notiz = { id: "nx" }; }], ["KI-Chat", () => { ui.seite = "ki"; ui.kiChatId = "kx"; ui.kiReiter = "chat"; }]];
    for (const [wo, f] of extra) { try { f(); zeichnen(); pruef(wo); } catch (e) { treffer.push(wo + ": Absturz " + e.message); }
      ui.detail = null; ui.watch = null; ui.alarm = null; ui.notiz = null; ui.watchReiter = null; ui.kiChatId = null; }
    pruefe(!treffer.length, "HTML-Einschleusung möglich: " + treffer.slice(0, 8).join(" | "));
    // Gegenprobe: der Angriffstext ist wirklich angekommen - nur eben als harmloser Text
    zeige("watchlist"); const sichtbar = document.getElementById("inhalt").textContent.includes('Watch<img id="xss5"');
    zeige("notizen"); const sichtbar2 = document.getElementById("inhalt").textContent.includes('Notiz<img id="xss9"');
    pruefe(sichtbar && sichtbar2, "Gegenprobe Einschleusung: Testtext nicht sichtbar – Test wäre wirkungslos");
    S = JSON.parse(sicher); oeffnen(altD); zeige("uebersicht");
  }
  // --- 0.63 (Sicherheit): kaputte/praeparierte Dateien beim Import - kein Absturz, kein Haengen, Riesendatei abgelehnt
  {
    const sicher = JSON.stringify(S), altD = S.aktiv, fehler = [];
    let zufall = 12345; const rnd = () => (zufall = (zufall * 1103515245 + 12345) % 2147483648) / 2147483648;
    const bytes = (n) => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = Math.floor(rnd() * 256); return b; };
    const enc = (t) => new TextEncoder().encode(t);
    const faelle = [
      ["zufall.csv", bytes(5000)], ["zufall.pdf", bytes(3000)], ["leer.csv", new Uint8Array(0)],
      ["kaputt.pdf", enc("%PDF-1.7\n1 0 obj << /Length 999999 /Filter /FlateDecode >> stream\n" + "x".repeat(500) + "\nendstream endobj\n%%EOF")],
      ["nur-kopf.pdf", enc("%PDF-")], ["riesenfeld.csv", enc("Datum;Name;Betrag\n2026-01-01;" + "A".repeat(300000) + ";1\n")],
      ["html.csv", enc('Datum;Name;Stück;Kurs\n2026-01-01;<img id="xssimp" src=x>;1;2\n')], ["formel.csv", enc("Datum;Name;Betrag\n2026-01-01;=HYPERLINK(\"https://boese.example\");1\n")],
      ["falsch.zip", enc("PK\u0003\u0004kaputt")]
    ];   // Bilder (Texterkennung) prueft der eigene Screenshot-Test
    const t0 = Date.now();
    for (const [name, b] of faelle) {
      try { const f = new File([b], name, { type: /\.png$/.test(name) ? "image/png" : "" });
        await Promise.race([dateienEinlesen([f]), new Promise((_, nein) => setTimeout(() => nein(new Error("hängt")), 20000))]);
        ui.vorschau = null; ui.wiederherstellen = null; zeichnen();
        if (document.querySelector('[id^="xss"]')) fehler.push(name + ": HTML eingeschleust");
      } catch (e) { fehler.push(name + ": " + e.message); }
    }
    // Riesendatei (vorgetaeuschte Groesse) wird abgelehnt, ohne gelesen zu werden
    const gross = { name: "riesig.csv", size: 60e6, type: "", arrayBuffer: async () => { throw new Error("darf nicht gelesen werden"); } };
    try { await dateienEinlesen([gross]); } catch (e) { fehler.push("riesig: " + e.message); }
    ui.vorschau = null; ui.wiederherstellen = null;
    { const alt = D.instrumente, altB = D.buchungen; D.instrumente = { f1: { name: '=HYPERLINK("https://boese.example")', art: "Aktie" } };
      D.buchungen = [{ nr: 1, typ: "kauf", datum: "2026-01-01", instrument: "f1", konto: "+Konto", stueck: 2, kurs: 10, gebuehr: 0 }];
      const c = bestandCsv(); D.instrumente = alt; D.buchungen = altB;
      if (!/"'=HYPERLINK/.test(c) || !/'\+Konto/.test(c) || /,=/.test(c)) fehler.push("CSV-Formel nicht entschärft: " + c.split("\n")[1]); }
    pruefe(!fehler.length, "Datei-Angriff: " + fehler.slice(0, 6).join(" | "));
    S = JSON.parse(sicher); oeffnen(altD); zeige("uebersicht");
  }
  // --- 0.59: Hinweis ab -35 % (Sollwert Python: 100/0,65-100 = 53,846 %)
  {
    const p40 = { wert: 600, einstand: 1000, gvPct: -40, stueck: 10 }, p30 = { wert: 700, einstand: 1000, gvPct: -30, stueck: 10 };
    const k40 = breakEvenKarte(p40, { kurs: 60 }), k30 = breakEvenKarte(p30, { kurs: 70 });
    pruefe(/Ab etwa −35 %/.test(k40) && /\+53,85 %/.test(k40) && !/Ab etwa −35 %/.test(k30), "Hinweis ab −35 % falsch");
  }
  // --- 0.58: Steuertermine (4 je Jahr, Vorjahr bis naechstes Jahr, abschaltbar)
  {
    const st = steuerTermine(), j = +heute().slice(0, 4);
    pruefe(st.length === 12 && st.some((x) => x.datum === `${j}-12-15` && /Verlustbescheinigung/.test(x.titel)) && st.every((x) => /Ohne Gewähr/.test(x.info)), `Steuertermine: ${st.length}`);
    const ev = kalenderEreignisse([S.aktiv]);
    pruefe(ev.filter((x) => x.art === "Steuertermin").length === 12, "Steuertermine fehlen im Kalender");
    (S.einstellungen.kalAus ||= {}).Steuertermin = true;
    pruefe(!kalenderEreignisse([S.aktiv]).some((x) => x.art === "Steuertermin"), "Steuertermine nicht abschaltbar");
    delete S.einstellungen.kalAus.Steuertermin;
  }
  // --- Beispiel 08.11.: Hyperliquid Doppeltop short, Hebel 10, Einstieg 93, Stop = KO 102,3, Ziel 77
  {
    const r = { titel: "Hyper Liquid Doppel top short", richtung: "short", einstieg: "93", hebel: "10", stop: "102,3", ziel: "77", einsatz: "200", maxverlust: "50", broker: "eigen", wartung: "0", gebuehr: "0" };
    const x = hebelRechnen(r);
    pruefe(nah(x.ko, 102.3) && nah(x.koAbstand, 10) && nah(x.verlust, -100) && nah(x.gewinn, 172.043, 0.01) && nah(x.crv, 1.7204, 0.001),
           `HYPE: ${JSON.stringify([x.ko, x.koAbstand, x.verlust, x.gewinn, x.crv])}`);
    pruefe(nah(x.risikoEur, 200) && nah(x.einsatzFuerMax, 50), `HYPE Risiko ${x.risikoEur} / Einsatz für 50 € ${x.einsatzFuerMax}`);
    const xo = hebelRechnen({ ...r, stop: "98", ohneStop: true });
    pruefe(xo.ohneStop && nah(xo.risikoEur, 200) && nah(xo.einsatzFuerMax, 50), "ohne Stop: ganzer Einsatz ist Risiko");
    const xm = hebelRechnen({ ...r, stop: "98" });
    pruefe(nah(xm.verlust, -53.763, 0.01) && nah(xm.einsatzFuerMax, 50 / 0.53763, 0.05), `mit Stop 98: ${xm.verlust} / ${xm.einsatzFuerMax}`);
    // Chart: 4 Marken (Ziel, Einstieg, Stop, KO), Stop = KO hier gleich
    ui.rechner = { ...r }; ui.rechnerOffen = true; ui.notizReiter = "derivate"; zeige("notizen");
    const svg = document.querySelector("#rechner-ergebnis svg.hebelchart");
    pruefe(svg && svg.querySelectorAll("line[data-marke]").length === 4 && /KO 102,3/.test(svg.textContent), `Hebel-Chart fehlt/Marken: ${svg?.textContent}`);
    // Hebel ziehen -> KO rueckt naeher
    const regler = document.querySelector('input[type="range"][data-rechner="hebel"]');
    pruefe(regler.max === "10", `Schieberegler geht bis ${regler.max} statt 10`);
    regler.value = "5"; regler.dispatchEvent(new Event("input", { bubbles: true }));
    pruefe(/KO 111,6/.test(document.querySelector("#rechner-ergebnis svg").textContent), "Schieberegler: KO nicht 111,6 bei Hebel 5");
    // Speichern als Notiz -> Chart in der Notiz, wieder im Rechner oeffnen
    ui.rechner.hebel = "10"; document.querySelector("[data-rechner-notiz]").click();
    document.getElementById("notiz-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const nz = (S.notizen || []).at(-1);
    pruefe(nz && nz.rechner && nz.titel === "Hyper Liquid Doppel top short", "Notiz ohne Rechnung/Titel gespeichert");
    ui.notiz = { id: nz.id }; zeichnen();
    pruefe(!!document.querySelector("#inhalt svg.hebelchart"), "Notiz zeigt keinen Chart");
    document.querySelector("[data-rechner-laden]").click();
    pruefe(ui.rechnerOffen && ui.rechner.einstieg === "93" && !ui.notiz, "Im Rechner öffnen klappt nicht");
    ui.rechnerOffen = false; ui.rechner = null; ui.notizReiter = null; S.notizen = []; zeige("uebersicht");
    // 0.68: Knock-out laut Produktblatt, Bitcoin 57.000 mit 3x, Kraken-Grenze 10x
    { const k1 = hebelRechnen({ einstieg: "57000", hebel: "3", richtung: "long", broker: "zertifikat" });
      pruefe(nah(k1.ko, 38000, 1e-6) && !k1.koAusProdukt, `KO-Zertifikat 3x bei 57.000: ${k1 && k1.ko}`);
      const k2 = hebelRechnen({ einstieg: "57000", koFix: "38000", richtung: "long", broker: "zertifikat" });
      pruefe(k2 && nah(k2.H, 3, 1e-9) && nah(k2.ko, 38000) && k2.koAusProdukt, `KO laut Produkt -> Hebel 3: ${k2 && k2.H}`);
      const k3 = hebelRechnen({ einstieg: "57000", hebel: "5", koFix: "40000", richtung: "long", broker: "minifuture" });
      // 0.69: Mini-Future-Hebel kommt aus dem Basispreis; Hebel 5 -> Basispreis 45.600 laege hinter der Schwelle 40.000 -> Basispreis = Schwelle
      pruefe(k3 && nah(k3.ko, 40000) && nah(k3.H, 57000 / 17000, 1e-9), `Mini-Future: KO laut Produkt hat Vorrang: ${k3 && k3.H}`);
      const k4 = hebelRechnen({ einstieg: "57000", koFix: "60000", richtung: "long", broker: "zertifikat" });
      pruefe(k4 === null, "Long mit KO über Einstieg nicht abgefangen");
      pruefe(hebelRechnen({ einstieg: "100", hebel: "20", richtung: "long", broker: "kraken" }).hebelZuHoch === 10, "Kraken über 10x ohne Warnung");
      // --- 0.69 Backtest Stop-Loss aus Max.-Verlust. Sollwerte geschlossen mit Python gerechnet (22.11.2026), App rechnet per Bisektion.
      const B1 = { richtung: "long", broker: "zertifikat", einstieg: "42000", hebel: "5", einsatz: "500", maxverlust: "50" };
      const s1 = hebelRechnen(B1);
      pruefe(nah(s1.S, 41160, 1e-6) && s1.stopAuto && nah(s1.verlustEur, -50, 1e-6) && nah(s1.ko, 33600), `BTC 42.000/5x/50 €: ${s1.S}`);
      pruefe(nah(s1.vergleich[1].stop, 40740, 1e-6) && nah(s1.vergleich[1].max, 75), `BTC 75 €: ${JSON.stringify(s1.vergleich)}`);
      const s2 = hebelRechnen({ ...B1, stop: "40000" });
      pruefe(s2.passt === "zuweit" && nah(s2.verlustEur, -119.047619, 1e-5) && nah(s2.stopAusMax, 41160, 1e-6) && !s2.stopAuto, `Stop passt nicht zum Max.-Verlust: ${s2.passt} ${s2.verlustEur}`);
      const s3 = hebelRechnen({ richtung: "short", broker: "zertifikat", einstieg: "100", hebel: "4", einsatz: "1000", maxverlust: "100" });
      pruefe(nah(s3.S, 102.5, 1e-9) && nah(s3.ko, 125), `Short 4x: ${s3.S}`);
      const s4 = hebelRechnen({ ...B1, hebel: "", basispreis: "33600", preis: "8,42", spread: "0,01", ordergebuehr: "1" });
      pruefe(nah(s4.S, 41197.873047524, 1e-6) && s4.stueck === 59 && nah(s4.bv, 0.0010017857142857, 1e-12) && nah(s4.kostenEur, 2.59, 1e-9) && nah(s4.verlustEur, -50, 1e-6), `Kosten/Stück: ${s4.S} ${s4.stueck} ${s4.kostenEur}`);
      const s5 = hebelRechnen({ richtung: "long", broker: "minifuture", einstieg: "100", basispreis: "80", koFix: "85", bv: "0,1", einsatz: "1000", maxverlust: "100" });
      pruefe(nah(s5.S, 98, 1e-9) && nah(s5.H, 5) && s5.stueck === 500 && nah(s5.koPct, -75, 1e-9) && nah(s5.ko, 85), `Mini-Future Restwert: ${s5.S} ${s5.koPct}`);
      const s6 = hebelRechnen({ richtung: "long", broker: "zertifikat", einstieg: "100", basispreis: "80", bv: "0,1", finanzierung: "5", tage: "73", einsatz: "1000", maxverlust: "100" });
      pruefe(nah(s6.S, 98.8, 1e-9) && nah(s6.koSpaeter, 80.8, 1e-9), `Finanzierung: ${s6.S} ${s6.koSpaeter}`);
      const s7 = hebelRechnen({ richtung: "long", broker: "kraken", einstieg: "100", hebel: "10", einsatz: "200", maxverlust: "20" });
      pruefe(nah(s7.S, 99.09954977488744, 1e-9) && nah(s7.verlustEur, -20, 1e-6), `Perp Kraken 10x: ${s7.S}`);
      pruefe(hebelRechnen({ ...B1, maxverlust: "600" }).maxUeberKo && hebelRechnen({ ...B1, hebel: "", basispreis: "33600", preis: "8,42", spread: "0,01", ordergebuehr: "1", maxverlust: "2" }).maxZuKlein, "Max.-Verlust über KO / unter Kosten nicht erkannt");
      pruefe(hebelRechnen({ ...B1, einsatz: "" }).S == null && hebelRechnen({ ...B1, ohneStop: true }).S == null, "Ohne Einsatz bzw. ohne Stop-Loss darf kein Stop gesetzt werden");
      // Hebel aendern -> Chart rechnet mit (Produkt-% und Euro an den Marken)
      ui.notizReiter = "derivate"; ui.rechner = { ...B1, ziel: "48000" }; zeige("notizen");
      const t5 = document.querySelector("#rechner-ergebnis svg").textContent;
      ui.rechner.hebel = "10"; document.getElementById("rechner-ergebnis").innerHTML = hebelErgebnis();
      const t10 = document.querySelector("#rechner-ergebnis svg").textContent;
      pruefe(/SL 41\.160/.test(t5) && /-50\s€/.test(t5) && /SL 41\.580/.test(t10) && t5 !== t10, `Chart folgt dem Hebel nicht: ${t5} | ${t10}`);
      ui.rechner.kursJetzt = 45000; document.getElementById("rechner-ergebnis").innerHTML = hebelErgebnis();
      const tj = document.querySelector("#rechner-ergebnis svg").textContent;
      pruefe(/Jetzt 45\.000/.test(tj) && /bis Einstieg -6,7\s%/.test(tj) && document.querySelectorAll('#rechner-ergebnis line[data-marke="Jetzt"]').length === 1, `Aktueller Kurs fehlt im Chart: ${tj}`);
      pruefe(!!document.querySelector("[data-hebel-bild]") && !!document.querySelector("#zertfinder") && !!document.querySelector('[data-rechner="bedingung"]'), "Bild-Knopf/Finder/Einstiegsbedingung fehlt");
      ui.rechner = null; ui.notizReiter = null;
      // --- 0.69: Positionsgroesse mit Hebel + Tranchen-Plan (Sollwerte Python: 10 Stueck, Einsatz 200, -25 %, +150 € = +75 %, KO 80; Tranchen 5,625 Stueck, Ø 88,89, +6,25 € = +1,25 %)
      { ui.notizReiter = "posgr"; ui.posgrOffen = true; ui.posgr = { art: "aktie", richtung: "long", einstieg: "100", stop: "95", maxverlust: "50", ziel: "115", hebel: "5" }; zeige("notizen");
        const t = document.getElementById("posgr-ergebnis")?.textContent || "";
        pruefe(/200,00\s€/.test(t) && /-25,00\s%/.test(t) && /\+75,00\s%/.test(t) && /Knock-out ca\. 80/.test(t), `Positionsgröße mit Hebel: ${t.slice(0, 400)}`);
        ui.posgr.stop = "79"; zeige("notizen");
        pruefe(/liegt der Knock-out/.test(document.getElementById("posgr-ergebnis")?.textContent || ""), "Positionsgröße: Stop hinter KO ohne Warnung");
        const tp = tranchenRechnen({ t1k: "100", t1b: "250", t2k: "80", t2b: "250", kurs: "90" });
        pruefe(nah(tp.stueck, 5.625) && nah(tp.kapital, 500) && nah(tp.schnitt, 88.8888889, 1e-6) && nah(tp.jetzt.eur, 6.25, 1e-9) && nah(tp.jetzt.pct, 1.25, 1e-9), `Tranchen-Plan: ${JSON.stringify(tp)}`);
        ui.notizReiter = "nachkauf"; ui.nachkaufOffen = true; ui.nachkauf = { art: "aktie", t1k: "100", t1b: "250", t2k: "80", t2b: "250", kurs: "90" }; zeige("notizen");
        pruefe(/88,89/.test(document.getElementById("tranchen-ergebnis")?.textContent || ""), "Tranchen-Plan nicht in der Oberfläche");
        ui.notizReiter = null; ui.posgr = null; ui.posgrOffen = false; ui.nachkauf = null; ui.nachkaufOffen = false; zeige("uebersicht"); }
      // --- 0.69: Depot-DB-Export (erfundene Werte, gleicher Aufbau wie gemeinsam/seite.py): 400 € Wert, Kurs 50 USD, 1,25 USD/EUR -> 10 Stück; 250 € zu 25 € -> 10 Stück
      { const dbHtml = `<html><body data-usd="1.25"><table><tr><th>Position</th><th>Art</th><th>Wert</th><th>Einstand</th><th>G/V</th></tr>
          <tr><td><b>Testfirma Inc.</b><span class=notiz>Bestandsexport 01.01.2026 · ISIN US0000000001</span></td><td>Aktie</td><td class="num r"><span class="betrag" data-e="400.0000">400</span></td><td class="num r"><span class="betrag" data-e="300.0000">300</span></td><td>+100</td></tr>
          <tr><td><b>Probe AG</b><span class=notiz>ISIN DE0000000002</span></td><td>Aktie</td><td class="num r"><span class="betrag" data-e="250.0000">250</span></td><td class="num r"><span class="betrag" data-e="260.0000">260</span></td><td>-10</td></tr></table>
          <table class="legende-tab"><tr><td>Testfirma Inc.</td><td class="num r">1.25&nbsp;USD × <span class="betrag">10</span></td><td class="num r"><b><span class="betrag" data-e="10.0000">10</span></b></td></tr></table>
          <article class="deep"><span class="kind">Testfirma Inc. · TST · Depot 1</span><div class="kv"><span>Kurs (Handelswährung)</span><b class="num">50,00&nbsp;USD</b></div></article>
          <article class="deep"><span class="kind">PRB.DE · Scalable</span><div class="kv"><span>Kurs (Handelswährung)</span><b class="num">25,00&nbsp;EUR</b></div></article></body></html>`;
        const v = erkennen(dbHtml, "index.html"), b = v.buchungen || [];
        pruefe(v.format === "Depot-Bestand (bestand.csv)" && b.length === 2 && b[0].stueck === 10 && b[0].ticker === "TST" && b[0].isin === "US0000000001" && b[1].stueck === 10 && b[1].ticker === "PRB.DE" && b[1].konto === "Scalable" && nah(b[0].einstand, 300),
          `Depot-DB-Import: ${JSON.stringify(b.map((x) => [x.name, x.stueck, x.ticker, x.konto, x.isin]))}`);
        const wA = S.watchlist; S.watchlist = []; pruefe(watchImportieren(dbHtml) === 2 && S.watchlist[0].ticker === "TST", "Depot-DB -> Watchlist"); S.watchlist = wA; }
      // --- 0.69: HTML-Tabelle, Watchlist-Import, Depot -> Watchlist, Position verschieben, ZIP-Ordnung
      const html = "<html><body><table><tr><td>Menü</td></tr></table><table><tr><th>Name</th><th>ISIN</th><th>Stück</th></tr><tr><td>Siemens AG</td><td>DE0007236101</td><td>10</td></tr><tr><td>SAP; SE</td><td>DE0007164600</td><td>5</td></tr></table></body></html>";
      pruefe(htmlZuCsv(html) === "Name;ISIN;Stück\nSiemens AG;DE0007236101;10\nSAP, SE;DE0007164600;5", `HTML->CSV: ${JSON.stringify(htmlZuCsv(html))}`);
      const wAlt = S.watchlist; S.watchlist = [{ id: "wx", name: "Siemens", kennung: "DE0007236101", art: "Aktie" }];
      const nW = watchImportieren("Name;ISIN\nSiemens AG;DE0007236101\nNvidia US67066G1040\nNVDA\nBitcoin\n\nAllianz;840400");
      pruefe(nW === 4 && S.watchlist.some((w) => w.kennung === "840400" && w.name === "Allianz") && S.watchlist.some((w) => w.name === "Bitcoin" && w.art === "Krypto") && S.watchlist.some((w) => w.kennung === "US67066G1040"),
        `Watchlist-Import: ${nW} ${JSON.stringify(S.watchlist.map((w) => [w.name, w.kennung, w.art]))}`);
      pruefe(watchImportieren(html) === 1, "Watchlist-Import aus HTML (Siemens doppelt, SAP neu)");
      S.depots.__a = { name: "TA", rolle: "beobachtet", instrumente: { DE0007164600: { name: "SAP", isin: "DE0007164600", art: "Aktie", ticker: "SAP.DE" }, XYZ: { name: "Rheinmetall", isin: "DE0007030033", art: "Aktie" } },
        buchungen: [{ nr: 1, typ: "kauf", datum: "2026-01-02", instrument: "XYZ", stueck: 2, betrag: -1000 }, { nr: 2, typ: "kauf", datum: "2026-01-03", instrument: "DE0007164600", stueck: 1, betrag: -200 }], importe: [] };
      S.depots.__b = { name: "TB", rolle: "beobachtet", instrumente: {}, buchungen: [], importe: [] };
      pruefe(watchAusDepot("__a") === 1 && S.watchlist.some((w) => w.name === "Rheinmetall" && w.notiz === "aus Depot TA"), "Depot -> Watchlist (SAP schon da, Rheinmetall neu)");
      const altAktiv = S.aktiv, altConfirm = window.confirm; window.confirm = () => true;
      oeffnen("__a"); ui.alle = false; ui.detail = "XYZ"; ui.posVerschieben = "XYZ"; zeichnen();
      const zs = document.getElementById("pos-ziel"); if (zs) zs.value = "__b";
      document.querySelector("[data-pos-verschieben-ok]")?.click();
      pruefe(!S.depots.__a.instrumente.XYZ && S.depots.__b.instrumente.XYZ && S.depots.__b.buchungen.length === 1 && S.depots.__a.buchungen.length === 1, `Position verschieben CP -> DB: ${JSON.stringify([Object.keys(S.depots.__a.instrumente), Object.keys(S.depots.__b.instrumente)])}`);
      (S.originale ||= []).push({ id: "o__1", name: "bestand.html", depot: "__b", zeit: "2026-11-21T10:00:00Z" });
      pruefe(zipIndex().find((o) => o.id === "o__1")?.pfad === "originale/beobachtet/TB/2026-11-21_bestand.html", `ZIP-Ordner beobachtet: ${zipIndex().find((o) => o.id === "o__1")?.pfad}`);
      S.originale = S.originale.filter((o) => o.id !== "o__1"); window.confirm = altConfirm;
      delete S.depots.__a; delete S.depots.__b; S.watchlist = wAlt; oeffnen(altAktiv); ui.detail = null; ui.posVerschieben = null; ui.alle = undefined; zeige("uebersicht");
      ui.notizReiter = "derivate"; zeige("notizen");
      pruefe(!!document.querySelector("[data-rechner-suchen]") && !!document.querySelector("#rechner-ergebnis"), "Reiter Derivate: Suche/Rechner fehlt");
      ui.rechner = { einstieg: "57000", hebel: "3", richtung: "long", broker: "zertifikat" }; zeichnen();
      pruefe(!!document.querySelector('[data-rechner="koFix"]') && !!document.querySelector('[data-rechner="produkt"]'), "Zertifikat: Produkt-Felder fehlen");
      ui.notizReiter = null; ui.rechner = null; ui.rechnerOffen = false; zeige("uebersicht"); }
  }

  // --- Nachkauf-Rechner (0.50). Sollwerte unabhaengig mit Python Decimal gerechnet (16.11.2026).
  // Vorgabe-Beispiel B war falsch (0,000459 BTC / 271 €) - richtig: 0,00457321 BTC / 269,82 €.
  {
    const nahS = (a, b) => Math.abs(a - b) <= 0.00001;          // Stueck-Toleranz laut Vorgabe
    const grund = { bestand: "0,005062", einstand: "98.972,23", kurs: "59.000", art: "krypto" };
    const a = nachkaufRechnen({ ...grund, budget: "500" });
    pruefe(nahS(a.A.bestand, 0.01353658) && nah(a.A.einstand, 73947.61, 1) && nah(a.A.stueck, 0.00847458, 1e-8) && nah(a.A.aenderungPct, -25.28, 0.01) && a.A.gebuehr === 0,
           `Nachkauf A: ${JSON.stringify(a.A)}`);
    pruefe(a.A.bestand === 0.01353658 && a.A.einstand === 73947.61, `Nachkauf A Rundung (8 Stellen / 2 Stellen): ${a.A.bestand} / ${a.A.einstand}`);
    const b = nachkaufRechnen({ ...grund, ziel: "80.000" });
    pruefe(nahS(b.B.stueck, 0.00457321) && nah(b.B.budget, 269.82, 1) && nah(b.B.einstand, 80000, 0.01), `Nachkauf B: ${JSON.stringify(b.B)}`);
    const c = nachkaufRechnen({ ...grund, budget: "500", stufen: "85.000" });
    const z85 = c.C.find((z) => z.kurs === 85000);
    pruefe(z85 && nah(z85.erloes, 1150.61, 1) && nah(z85.gv, 149.61, 1) && nah(z85.pct, 14.95, 0.01), `Nachkauf C bei 85.000: ${JSON.stringify(z85)}`);
    pruefe(c.C.some((z) => z.breakEven && nah(z.kurs, 73947.61, 0.01)) && nah(c.nach.breakEven, 73947.61, 0.01), "Nachkauf C: Break-even-Zeile fehlt");
    const d = nachkaufRechnen({ ...grund, budget: "500", trigger: "80000" });
    pruefe(nah(d.D.anteil, 92.43, 0.1) && nahS(d.D.runner, 0.00102411) && nah(d.D.runnerWert, 81.93, 1) && nah(d.D.zurueck, 1001.00, 0.01), `Nachkauf D: ${JSON.stringify(d.D)}`);
    // Standard-Tabelle: 9 Stufen ±20 % um Break-even + Ziel-Ausstieg
    const t = nachkaufRechnen({ ...grund, budget: "500", ausstieg: "85000" });
    pruefe(t.C.length === 10 && nah(t.C[0].kurs, 73947.61 * 0.8, 0.02) && nah(t.C.at(-1).kurs, 73947.61 * 1.2, 0.02) && t.C.some((z) => z.ausstieg) && nah(t.ausstieg.gv, 149.61, 1),
           `Nachkauf C Standard: ${t.C.map((z) => z.kurs).join(" ")}`);
    // Gebuehren 0,25 %: Kauf vom Budget ab, Verkauf vom Erloes ab
    const g = nachkaufRechnen({ ...grund, budget: "500", ziel: "80000", trigger: "80000", gebuehrAn: true, gebuehr: "0,25" });
    pruefe(nahS(g.A.stueck, 0.00845339) && nah(g.A.einstand, 74063.53, 0.01) && nah(g.A.gebuehr, 1.25) && nah(g.A.netto, 498.75) && nah(g.nach.breakEven, 74249.15, 0.01),
           `Nachkauf Gebühr A: ${JSON.stringify(g.A)} BE ${g.nach.breakEven}`);
    pruefe(nahS(g.B.stueck, 0.00460564) && nah(g.B.budget, 272.41, 0.01) && nah(g.B.netto, 271.73, 0.01) && nah(g.D.anteil, 92.81, 0.01), `Nachkauf Gebühr B/D: ${JSON.stringify([g.B, g.D])}`);
    // Sonderfaelle
    pruefe(nachkaufRechnen({ ...grund, kurs: "0", budget: "500" }).fehler.length === 1, "Kurs 0 nicht abgefangen");
    pruefe(nachkaufRechnen({ ...grund, bestand: "0", ziel: "80000" }).fehler.length === 1, "Bestand 0 nicht abgefangen");
    pruefe(/über dem aktuellen Kurs/.test(nachkaufRechnen({ ...grund, ziel: "59000" }).B.fehler) && /über dem aktuellen Kurs/.test(nachkaufRechnen({ ...grund, ziel: "50000" }).B.fehler),
           "Ziel ≤ Kurs: keine klare Meldung");
    pruefe(/keine weitere Tranche nötig/.test(nachkaufRechnen({ ...grund, ziel: "99000" }).B.fehler), "Ziel über Einstand nicht erkannt");
    pruefe(/senken geht nicht/.test(nachkaufRechnen({ ...grund, kurs: "120000", ziel: "99000" }).B.fehler), "Kurs über Einstand nicht erkannt");
    const s = nachkaufRechnen({ ...grund, ziel: "59.500" });
    pruefe(nah(s.B.budget, 23577.39, 0.01) && s.warnungen.some((w) => /Sunk-Cost/.test(w)), `Sunk-Cost-Warnung fehlt: ${JSON.stringify(s)}`);
    pruefe(!a.warnungen.length, "Warnung bei normalem Budget");
    const dk = nachkaufRechnen({ ...grund, budget: "500", trigger: "73947.61" });
    pruefe(dk.D.fehler && /kein Runner/.test(dk.D.fehler), `Trigger = Break-even muss ohne Runner sein: ${JSON.stringify(dk.D)}`);
    const ak = nachkaufRechnen({ bestand: "10", einstand: "120", kurs: "80", budget: "400", art: "aktie" });
    pruefe(ak.st === 4 && ak.A.bestand === 15 && ak.A.einstand === 106.67, `Aktie (4 Stellen): ${JSON.stringify(ak.A)}`);
    // Dezimal statt Kommazahl: 0,1 + 0,2 Stueck bleibt genau 0,3
    pruefe(nachkaufRechnen({ bestand: "0,1", einstand: "10", kurs: "5", budget: "1", art: "krypto" }).A.bestand === 0.3, "Dezimalrechnung ungenau");

    // 0.87 Bugliste 24.11.: Feld-Text immer mit Komma und genug Stellen, "0.005" ist kein Tausenderpunkt
    pruefe(nkFeld(0.125) === "0,125" && nkFeld(0.1234) === "0,1234" && nkFeld(0.0000123) === "0,0000123" && nkFeld(98972.23) === "98972,23" && nkFeld(null) === "",
           `nkFeld: ${[nkFeld(0.125), nkFeld(0.1234), nkFeld(0.0000123), nkFeld(98972.23)].join(" ")}`);
    pruefe(dzZahl(dz(nkFeld(0.125)), 8) === 0.125 && dzZahl(dz("0.005"), 8) === 0.005 && dzZahl(dz("59.000"), 2) === 59000 && zahl("0.005") === 0.005 && zahl("1.234") === 1234,
           "Parser: 0.005 / 59.000 / 1.234");
    // 0.87: Testszenarien aus dem Open-Alpha-Board (b01-26..31, strategischer Hintergrund - keine Vorgabe in der App, keine Anlageberatung).
    // Sollwerte mit Python Decimal gerechnet (24.11.2026), Bestand 0,005062 BTC zu 98.972,23 €.
    {
      const h = nachkaufRechnen({ ...grund, kurs: "82.000", budget: "500" }), t = nachkaufRechnen({ ...grund, budget: "500" });
      pruefe(nah(h.A.einstand, 89698.64, 0.01) && nah(h.A.aenderungPct, -9.37, 0.01) && h.A.einstand > t.A.einstand,
             `Szenario b01-26 (Kauf über 80.000 € senkt den Schnitt kaum): ${JSON.stringify(h.A)}`);
      const l55 = nachkaufRechnen({ ...grund, budget: "500", preisArt: "limit", limit: "55.000" });
      pruefe(nahS(l55.A.stueck, 0.00909091) && nah(l55.A.einstand, 70727.33, 0.01) && l55.A.einstand < t.A.einstand,
             `Szenario b01-27 (günstiger Einstieg per Limit): ${JSON.stringify(l55.A)}`);
      const l52 = nachkaufRechnen({ ...grund, budget: "500", preisArt: "limit", limit: "52.000" });
      pruefe(nah(l52.A.einstand, 68199.99, 0.01) && nah(l52.A.aenderungPct, -31.09, 0.01), `Szenario b01-28 (tieferes Tief abwarten): ${JSON.stringify(l52.A)}`);
      const z1 = nachkaufRechnen({ ...grund, budget: "250", preisArt: "limit", limit: "56.000" });
      const z2 = nachkaufRechnen({ bestand: String(z1.A.bestand), einstand: String(z1.A.einstand), kurs: "59.000", art: "krypto", budget: "250", preisArt: "limit", limit: "52.000" });
      pruefe(nah(z1.A.einstand, 78834.23, 0.01) && nah(z2.A.einstand, 69833.89, 0.05) && nahS(z2.A.bestand, 0.01433398),
             `Szenario b01-29 (Kaufzone + Wick-Fill in zwei Tranchen): ${JSON.stringify([z1.A, z2.A])}`);
      const f = nachkaufRechnen({ ...grund, budget: "500", stufen: "50.000" }), f50 = f.C.find((z) => z.kurs === 50000);
      pruefe(f50 && nah(f50.erloes, 676.83, 0.01) && nah(f50.gv, -324.17, 0.01) && f50.gv < 0, `Szenario b01-30 (Fakeout: Kurs fällt nach dem Kauf auf 50.000): ${JSON.stringify(f50)}`);
    }

    // Oberflaeche: aus einer Position oeffnen -> Kopie, gespeicherte Position bleibt unveraendert
    zeige("positionen");
    const pos = positionen().liste.find((p) => p.stueck > 0 && !(D.instrumente[p.id] || {}).ohneStueck);
    const vorher = JSON.stringify(S.depots);
    ui.detail = pos.id; zeichnen();
    const kn = document.querySelector(`[data-nachkauf-aus]`);
    pruefe(!!kn, "Knopf „Nachkauf rechnen“ fehlt in der Position");
    kn?.click();
    pruefe(ui.seite === "notizen" && ui.nachkaufOffen && document.getElementById("nachkauf-ergebnis"), "Nachkauf-Rechner öffnet nicht aus der Position");
    pruefe(nah(zahl(ui.nachkauf.bestand), pos.stueck, 1e-8) && nah(zahl(ui.nachkauf.einstand), pos.einstand / pos.stueck, 0.01), `Werte nicht übernommen: ${JSON.stringify(ui.nachkauf)}`);
    for (const [n, w] of [["bestand", "999"], ["einstand", "1"], ["budget", "5000"], ["ziel", "2"], ["trigger", "3"]]) {
      const el = document.querySelector(`[data-nachkauf="${n}"]`); el.value = w; el.dispatchEvent(new Event("input", { bubbles: true }));
    }
    pruefe(JSON.stringify(S.depots) === vorher, "Nachkauf-Rechner hat die gespeicherte Position verändert!");
    // Live-Rechnung ohne Knopf, drei Hauptwerte sichtbar
    Object.assign(ui.nachkauf, grund, { budget: "500", ziel: "", trigger: "80000" }); zeichnen();
    const el = document.querySelector('[data-nachkauf="budget"]'); el.value = "500"; el.dispatchEvent(new Event("input", { bubbles: true }));
    const txt = document.getElementById("nachkauf-ergebnis").textContent;
    pruefe(/Neuer Einstandskurs/.test(txt) && /73\.947,61/.test(txt) && /Break-even-Kurs/.test(txt) && /Benötigtes Budget/.test(txt) && /92,43/.test(txt), `Ergebnis-Anzeige: ${txt.slice(0, 200)}`);
    pruefe(document.querySelectorAll("#nachkauf-ergebnis tr.nk-be").length === 1 && document.querySelectorAll("#nachkauf-ergebnis svg.nkchart").length === 2, "Break-even-Zeile oder Charts fehlen");
    // Betraege aus: keine Stueckzahl, kein Betrag, kein Chart
    ui.verdeckt = true; zeichnen();
    const v = document.getElementById("nachkauf-ergebnis");
    pruefe(!/0,0135|1\.001|81,9/.test(v.textContent) && !v.querySelector("svg"), `Beträge aus verbirgt nicht alles: ${v.textContent.slice(0, 200)}`);
    ui.verdeckt = false; ui.nachkaufOffen = false; ui.nachkauf = null; zeige("uebersicht");

    // --- Positionsgroessen-Rechner (0.50), Sollwerte mit Python Decimal
    {
      const p1 = positionRechnen({ einstieg: "100", stop: "95", maxverlust: "50", ziel: "115", art: "aktie" });
      pruefe(p1.stueck === 10 && p1.groesse === 1000 && p1.stopAbstand === -5 && p1.gewinn === 150 && p1.crv === 3, `Positionsgröße einfach: ${JSON.stringify(p1)}`);
      const p2 = positionRechnen({ einstieg: "59.000", stop: "56.050", maxverlust: "50", ziel: "65000" });
      pruefe(p2.stueck === 0.01694915 && p2.groesse === 1000 && nah(p2.gewinn, 101.69) && p2.crv === 2.03, `Positionsgröße BTC: ${JSON.stringify(p2)}`);
      // 50 € Risiko: 10 % Stop = 500 €, 5 % = 1.000 €, 2 % = 2.500 €
      const tab = Object.fromEntries(p2.tabelle.map((z) => [z.abstand, z.groesse]));
      pruefe(tab[10] === 500 && tab[5] === 1000 && tab[2] === 2500 && p2.tabelle.length === 8, `Spannen-Tabelle: ${JSON.stringify(tab)}`);
      const p3 = positionRechnen({ einstieg: "59000", stop: "56050", maxverlust: "50", ziel: "65000", gebuehrAn: true, gebuehr: "0,25" });
      pruefe(p3.stueck === 0.01544342 && nah(p3.groesse, 911.16) && nah(p3.gebuehren, 4.44) && nah(p3.gewinn, 87.87) && p3.crv === 1.76, `Positionsgröße Gebühr: ${JSON.stringify(p3)}`);
      const p4 = positionRechnen({ richtung: "short", einstieg: "100", stop: "104", maxverlust: "50", ziel: "90", art: "aktie" });
      pruefe(p4.stueck === 12.5 && p4.groesse === 1250 && p4.crv === 2.5 && p4.stopAbstand === 4, `Positionsgröße short: ${JSON.stringify(p4)}`);
      const p5 = positionRechnen({ einstieg: "100", stop: "95", risikoArt: "pct", risikoPct: "1", kapital: "5.000", art: "aktie" });
      pruefe(p5.maxVerlust === 50 && p5.stueck === 10 && p5.anteil === 20 && p5.risikoPct === 1 && !p5.warnungen.length, `Risiko in %: ${JSON.stringify(p5)}`);
      pruefe(positionRechnen({ einstieg: "100", stop: "99", maxverlust: "50", kapital: "1000" }).warnungen.some((w) => /größer als dein Kapital/.test(w)), "Warnung Position > Kapital fehlt");
      pruefe(/unter dem Einstieg/.test(positionRechnen({ einstieg: "100", stop: "100", maxverlust: "50" }).fehler[0]) && /über dem Einstieg/.test(positionRechnen({ richtung: "short", einstieg: "100", stop: "90", maxverlust: "50" }).fehler[0]),
             "Stop auf der falschen Seite nicht abgefangen");
      pruefe(positionRechnen({ einstieg: "0", stop: "95", maxverlust: "50" }).fehler.length && positionRechnen({ einstieg: "100", stop: "95" }).fehler.length, "Leere Eingaben nicht abgefangen");
      const sw = schwankung([[0, 100], [1, 110], [2, 99], [3, 104.94], [4, 104.94], [5, 115.434], [6, 92.3472]]);
      pruefe(nah(sw.woche, (10 + 10 + 6 + 0 + 10 + 20) / 6, 0.001) && nah(sw.ruecksetzer, 20, 0.001) && schwankung([[0, 1], [1, 2]]) === null, `Schwankung: ${JSON.stringify(sw)}`);
    }

    // --- Rechner-Plan als Notiz (0.52): speichern -> Notiz mit Chart -> wieder im Rechner oeffnen
    {
      const plaene = { posgr: { art: "aktie", richtung: "long", einstieg: "100", stop: "95", ziel: "115", maxverlust: "50", titel: "Plan Test" },
                       nachkauf: { art: "krypto", bestand: "0,005062", einstand: "98.972,23", kurs: "59.000", budget: "500", trigger: "80000" },
                       gewinn: { art: "aktie", modus: "betrag", bestand: "3", einstand: "600", k1: "1.022", b1: "500", k2: "1.200", b2: "800" } };
      for (const [typ, d] of Object.entries(plaene)) {
        S.notizen = []; ui[typ] = { ...d }; ui[typ + "Offen"] = true; zeige("notizen");
        pruefe(!!document.querySelector(`[data-plan-notiz="${typ}"]`), `Speichern-Knopf fehlt im Rechner ${typ} (Reiter ${ui.notizReiter}, Seite ${ui.seite}, Notiz ${!!ui.notiz}, Detail ${ui.detail})`); if (!document.querySelector(`[data-plan-notiz="${typ}"]`)) throw new Error(f.slice(-1)[0]);
        document.querySelector(`[data-plan-notiz="${typ}"]`).click();
        pruefe(ui.notiz && ui.notiz.plan && ui.notiz.plan.typ === typ && !!document.querySelector("#notiz-form .plan-block"), `Plan ${typ}: Notiz-Entwurf ohne Plan-Block`);
        pruefe(!/Stück|€/.test(ui.notiz.text), `Plan ${typ}: Notiztext enthält Beträge/Stück: ${ui.notiz.text}`);
        document.getElementById("notiz-form").dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        const n = S.notizen[0];
        pruefe(n && n.plan && n.plan.typ === typ && n.plan.daten.einstand === d.einstand && (typ !== "posgr" || n.titel === "Plan Test"), `Plan ${typ} nicht gespeichert: ${JSON.stringify(n)}`);
        ui[typ] = null; ui[typ + "Offen"] = false; zeige("notizen");
        pruefe(/🧮/.test(document.querySelector("[data-notiz]").textContent), `Plan ${typ}: Notiz-Zeile ohne Rechner-Symbol`);
        document.querySelector("[data-notiz]").click();
        const block = document.querySelector("#notiz-form .plan-block");
        pruefe(block && block.querySelector("svg") && block.querySelector(".kennzahlen"), `Plan ${typ}: Notiz zeigt keinen Chart/keine Zahlen`);
        document.querySelector("[data-plan-laden]").click();
        pruefe(ui.seite === "notizen" && ui[typ + "Offen"] && !ui.notiz && JSON.stringify(ui[typ]) === JSON.stringify(n.plan.daten), `Plan ${typ}: Im Rechner öffnen stellt die Eingaben nicht her`);
        ui[typ].einstand = "1"; pruefe(n.plan.daten.einstand === d.einstand, `Plan ${typ}: Ändern im Rechner verändert die gespeicherte Notiz`);
        ui[typ] = null; ui[typ + "Offen"] = false;
      }
      const ch = markenChart([["Ziel", 115, "g"], ["Einstieg", 100, "t"], ["Stop", 95, "r", 1]], 100, [[100, 95, "r"]]);
      pruefe((ch.match(/<line/g) || []).length === 3 && /Ziel 115 \(\+15 %\)/.test(ch) && /Stop 95 \(-5 %\)/.test(ch) && /Einstieg 100</.test(ch), `Marken-Chart: ${ch.replace(/<[^>]+>/g, "|")}`);
      // Englisch: "(+15 %)" statt "(+15. %)" im Chart (0.54)
      { const alt = window.sprache; window.sprache = () => "en"; fmtCache && Object.keys(fmtCache).forEach((k) => delete fmtCache[k]);
        const en = markenChart([["Ziel", 115, "g"], ["Einstieg", 100, "t"], ["Stop", 95.5, "r", 1]], 100);
        pruefe(/\(\+15 %\)/.test(en) && /\(-4\.5 %\)/.test(en) && !/\d\. %/.test(en), `Marken-Chart englisch: ${en.replace(/<[^>]+>/g, "|")}`);
        window.sprache = alt; Object.keys(fmtCache).forEach((k) => delete fmtCache[k]); }
      S.notizen = []; zeige("uebersicht");
    }
    // --- Break-even nach Gebuehren (0.55): Sollwerte mit Python
    {
      const alt = S.einstellungen.nachkaufGebuehr; S.einstellungen.nachkaufGebuehr = "";
      let b = breakEven({ einstand: 1000, wert: 700, stueck: 10 });
      pruefe(nah(b.noetig, 42.857, 0.001) && nah(b.puffer, -42.857, 0.001) && nah(b.kursBE, 100), `Break-even −30 %: ${JSON.stringify(b)}`);
      b = breakEven({ einstand: 1000, wert: 400, stueck: 10 }); pruefe(nah(b.noetig, 150, 0.001), `Break-even −60 %: ${b.noetig}`);
      b = breakEven({ einstand: 1000, wert: 11000, stueck: 10 }); pruefe(nah(b.puffer, 90.909, 0.001) && b.noetig < 0, `Puffer +1000 %: ${JSON.stringify(b)}`);
      S.einstellungen.nachkaufGebuehr = "0,25";
      b = breakEven({ einstand: 1000, wert: 700, stueck: 10 }); pruefe(nah(b.noetig, 43.215, 0.001) && nah(b.kursBE, 100.2506, 0.001) && b.gebuehr === 0.25, `Break-even mit Gebühr: ${JSON.stringify(b)}`);
      pruefe(breakEven({ einstand: 1000, wert: 0, stueck: 1 }) === null && breakEven({ ohneKurs: true, einstand: 1, wert: 1 }) === null, "Break-even ohne Kurs/Wert nicht abgefangen");
      S.einstellungen.nachkaufGebuehr = alt;
      // Anzeige: Liste und Detail, je eine Position im Minus und im Plus
      const ansichtAlt = ui.posAnsicht; ui.posAnsicht = "liste"; zeige("positionen");
      const liste = positionen().liste.filter((p) => !p.ohneKurs && p.einstand > 0);
      const mi = liste.find((p) => p.gv < 0), pl = liste.find((p) => p.gv > 0);
      const txt = document.getElementById("inhalt").textContent;
      pruefe(/Break-even \+/.test(txt) && /Puffer [−-]/.test(txt), `Break-even fehlt in der Positionsliste: ${txt.slice(0, 120)}`);
      for (const [p, muster] of [[mi, /Bis Break-even[\s\S]*Was es braucht, um wieder bei null zu sein/], [pl, /Puffer bis Break-even[\s\S]*Was ein Rücksetzer für dich bedeutet/]]) {
        if (!p) continue;
        ui.detail = p.id; zeichnen();
        const d = document.getElementById("inhalt").textContent;
        pruefe(muster.test(d) && /Verlust und nötiger Anstieg/.test(d) && /\+42,86 %/.test(d) && /\+150,00 %/.test(d), `Break-even-Karte in ${p.name}: ${d.slice(0, 160)}`);
      }
      ui.verdeckt = true; if (mi) { ui.detail = mi.id; zeichnen(); }
      pruefe(!mi || !/von \d[\d.,]* € auf/.test(document.getElementById("inhalt").textContent) || EIN().verstecken === "betraege", "Beträge aus: Break-even-Kurse sichtbar");
      ui.verdeckt = false; ui.detail = null; ui.posAnsicht = ansichtAlt; zeige("uebersicht");
    }
    // --- Broker-Gebühren in Euro (0.66): Sollwerte mit Python (Fractions) gerechnet
    {
      const P = (o) => positionRechnen(Object.assign({ art: "aktie", richtung: "long", gebuehrAn: true }, o));
      let x = P({ einstieg: "10", stop: "9", maxverlust: "50", gebuehrBroker: "tr", ziel: "12" });
      pruefe(nah(x.stueck, 48) && nah(x.groesse, 480) && nah(x.gebuehren, 2) && nah(x.gewinn, 94), `Broker TR: ${JSON.stringify([x.stueck, x.groesse, x.gebuehren, x.gewinn, x.fehler])}`);
      x = P({ einstieg: "10", stop: "9", maxverlust: "50", gebuehrBroker: "sb_aktie" });
      pruefe(nah(x.stueck, 48) && nah(x.groesse, 480) && x.warnungen.some((w) => /Unter 500/.test(w)), `Smartbroker unter 500: ${JSON.stringify([x.stueck, x.groesse, x.warnungen])}`);
      x = P({ einstieg: "100", stop: "95", maxverlust: "50", gebuehrBroker: "sb_aktie" });
      pruefe(nah(x.stueck, 10) && nah(x.groesse, 1000) && nah(x.gebuehren, 0), `Smartbroker ab 500: ${JSON.stringify([x.stueck, x.groesse, x.gebuehren])}`);
      x = P({ einstieg: "10", stop: "9", risikoArt: "groesse", positionsgroesse: "500", gebuehrBroker: "sb_unicredit" });
      pruefe(nah(x.stueck, 50) && nah(x.maxVerlust, 54), `Positionsgröße 500 UniCredit: ${JSON.stringify([x.stueck, x.maxVerlust, x.fehler])}`);
      x = P({ einstieg: "10", stop: "9", risikoArt: "groesse", positionsgroesse: "250", gebuehrBroker: "sb_unicredit" });
      pruefe(nah(x.stueck, 25) && nah(x.maxVerlust, 33), `Positionsgröße 250 UniCredit: ${JSON.stringify([x.stueck, x.maxVerlust])}`);
      x = P({ einstieg: "10", stop: "9", maxverlust: "1", gebuehrBroker: "tr" });
      pruefe(x.fehler.length === 1 && /Gebühren/.test(x.fehler[0]), `Verlust kleiner als Gebühren: ${JSON.stringify(x.fehler)}`);
      x = P({ einstieg: "10", stop: "9", maxverlust: "50", gebuehrBroker: "tr", waehrung: "usd" });
      pruefe(x.fehler.some((f) => /Euro/.test(f)), "Broker-Gebühren in Dollar nicht abgefangen");
    }
    // --- Dollar in den Rechnern (0.53): gleiche Rechnung, $-Zeichen, Umrechnung in Euro mit Kurs
    {
      ui.posgr = { art: "aktie", richtung: "long", waehrung: "usd", usdKurs: "1,08", einstieg: "100", stop: "95", ziel: "115", maxverlust: "50" }; ui.posgrOffen = true; zeige("notizen");
      let e = document.getElementById("posgr-ergebnis").textContent;
      pruefe(/1\.000,00\s\$/.test(e) && /-50,00\s\$|−50,00\s\$/.test(e) && /Position ≈ 925,93\s€/.test(e) && /Verlust am Stop-Loss ≈ 46,30\s€/.test(e) && /Gewinn am Ziel ≈ 138,89\s€/.test(e), `Dollar Positionsgröße: ${e.slice(0, 260)}`);
      pruefe(!/1\.000,00\s€/.test(e) && /Einstieg \$/.test(document.getElementById("posgr").textContent) && /Max\. Verlust \$/.test(document.getElementById("posgr").textContent), "Dollar: Beschriftung/Beträge noch in Euro");
      delete ui.posgr.usdKurs; delete (S.einstellungen ||= {}).eurUsd; zeichnen();
      pruefe(/Kurs „1 € = … \$“ eintragen/.test(document.getElementById("posgr-ergebnis").textContent), "Dollar ohne Kurs: Hinweis fehlt");
      S.einstellungen.eurUsd = { kurs: 1.25, datum: "2026-11-16" }; zeichnen();
      pruefe(/Position ≈ 800,00\s€/.test(document.getElementById("posgr-ergebnis").textContent) && /1,25 \(vom/.test(document.querySelector('[data-posgr="usdKurs"]').placeholder), "Gemerkter Euro-Dollar-Kurs wird nicht genutzt");
      document.querySelector('[data-posgr-wahl="waehrung"][data-wert="eur"]').click();
      pruefe(/1\.000,00\s€/.test(document.getElementById("posgr-ergebnis").textContent) && !document.querySelector('[data-posgr="usdKurs"]') && !/≈/.test(document.getElementById("posgr-ergebnis").textContent), "Zurück auf Euro klappt nicht");
      // 0.65: Anteil am Gesamtportfolio (alle eigenen Depots) – automatisch, ohne Kapital-Feld; Klumpen-Warnung ab 20 %
      { const ges = eigeneDepots().map(depotWerte).reduce((a, d) => a + (d.gesamt || 0), 0), txt = document.getElementById("posgr-ergebnis").textContent;
        if (ges > 0) { const soll = fPct.format(1000 / ges * 100) + " %";
          pruefe(/Anteil am Gesamtportfolio/.test(txt) && txt.includes(soll), `Anteil am Gesamtportfolio fehlt/falsch (soll ${soll}): ${txt.slice(0, 300)}`);
          pruefe((1000 / ges * 100 >= 20) === /Klumpenrisiko/.test(txt), "Klumpen-Warnung passt nicht zum Anteil"); }
        pruefe(anteilGesamtportfolio(1000, { waehrung: "usd" }) === null && anteilGesamtportfolio(0, {}) === null, "Gesamtportfolio-Anteil: Dollar/0 muss leer bleiben"); }
      ui.gewinn = { art: "aktie", modus: "betrag", waehrung: "usd", usdKurs: "1,25", bestand: "1", einstand: "500", k1: "1.022", b1: "500" }; ui.gewinnOffen = true; zeichnen();
      e = document.getElementById("gewinn-ergebnis").textContent;
      pruefe(/500,00\s\$/.test(e) && /Du nimmst raus ≈ 400,00\s€/.test(e) && /Stufe 1: Betrag \$/.test(document.getElementById("gewinn").textContent), `Dollar Gewinnmitnahme: ${e.slice(0, 200)}`);
      ui.nachkauf = { art: "krypto", waehrung: "usd", bestand: "0,005062", einstand: "98.972,23", kurs: "59.000", budget: "500" }; ui.nachkaufOffen = true; zeichnen();
      e = document.getElementById("nachkauf-ergebnis").textContent;
      pruefe(/73\.947,61\s\$/.test(e) && /Budget ≈ 400,00\s€/.test(e) && !/73\.947,61\s€/.test(e), `Dollar Nachkauf: ${e.slice(0, 200)}`);
      // Betraege aus verbirgt auch die Dollar- und die umgerechneten Euro-Betraege
      ui.verdeckt = true; zeichnen();
      pruefe(!/500,00|400,00|1\.001/.test(document.getElementById("nachkauf-ergebnis").textContent + document.getElementById("gewinn-ergebnis").textContent), "Beträge aus verbirgt Dollar/Umrechnung nicht");
      ui.verdeckt = false; for (const k of ["posgr", "gewinn", "nachkauf"]) { ui[k] = null; ui[k + "Offen"] = false; }
      delete S.einstellungen.eurUsd;
      // Legenden: in jedem Rechner, auf der Notizen-Seite und bei den Watchlist-Marken
      ui.posgrOffen = ui.gewinnOffen = ui.nachkaufOffen = ui.rechnerOffen = true; zeige("notizen");
      pruefe(document.querySelectorAll("#inhalt details.legende").length === 6, `Legenden auf der Notizen-Seite: ${document.querySelectorAll("#inhalt details.legende").length} statt 6`);   // 0.69: + Hebel-Rechner · 0.73: + Produktdaten (neuer Rechner startet als Knock-out-Zertifikat)
      ui.notizReiter = "derivate"; zeige("notizen");
      pruefe(document.querySelectorAll("#inhalt details.legende").length === 3, `Legenden im Reiter Derivate: ${document.querySelectorAll("#inhalt details.legende").length} statt 3`);   // 0.69: Rechner + Notizen darunter · 0.73: + Produktdaten (Knock-out-Zertifikat) ui.notizReiter = null;
      ui.posgrOffen = ui.gewinnOffen = ui.nachkaufOffen = ui.rechnerOffen = false;
      ui.seite = "watchlist"; ui.watchReiter = "alarme"; zeichnen(); pruefe(/einmal und ist wieder scharf/.test(document.querySelector("#inhalt details.legende")?.textContent || ""), "Legende zu den Alarmen fehlt"); ui.watchReiter = null;
      // Aktualisieren-Knopf oben neben dem Einstell-Knopf
      const kn = document.getElementById("aktualisieren-oben");
      pruefe(kn && kn.dataset.los === "kurse" && kn.nextElementSibling?.dataset.ziel === "mehr", "Aktualisieren-Knopf sitzt nicht neben dem Einstell-Knopf");
      zeige("uebersicht");
    }
    // --- Schluessel-Ampel (0.52)
    {
      pruefe(schluesselFormat("anthropic", "sk-or-v1-abcdefabcdef1234").s === "falsch" && /OpenRouter/.test(schluesselFormat("anthropic", "sk-or-v1-abcdefabcdef1234").t), "OpenRouter-Schlüssel bei Anthropic nicht erkannt");
      pruefe(schluesselFormat("openrouter", "sk-ant-api03-abcdefabcdef").s === "falsch" && schluesselFormat("openai", "sk-ant-api03-abcdefabcdef").s === "falsch" && schluesselFormat("finnhub", "AIzaSyabcdefabcdef123456").s === "falsch", "vertauschte Schlüssel nicht erkannt");
      pruefe(schluesselFormat("openai", "sk-proj-abcdefabcdef1234").s === "unklar" && schluesselFormat("openrouter", "sk-or-v1-abcdefabcdef1234").s === "unklar" && schluesselFormat("google", "AIzaSyabcdefabcdef123456").s === "unklar", "richtiges Format als falsch gewertet");
      pruefe(schluesselFormat("google", "abcdefabcdef12345678").s === "falsch" && schluesselFormat("finnhub", "kurz").s === "falsch" && schluesselFormat("twelvedata", "0123456789abcdef0123456789abcdef").s === "unklar", "Format-Grenzfälle");
      pruefe(schluesselBewerten("openai", { status: 200, text: "ok" }).s === "ok" && schluesselBewerten("openai", { status: 401, text: "Incorrect API key" }).s === "falsch" &&
             schluesselBewerten("google", { status: 400, text: "API key not valid. Please pass a valid API key." }).s === "falsch" && schluesselBewerten("google", { status: 400, text: "bad request" }).s === "unklar" &&
             schluesselBewerten("finnhub", { status: 429, text: "limit" }).s === "ok" && schluesselBewerten("fmp", { status: 500, text: "" }).s === "unklar" && schluesselBewerten("fmp", null).s === "unklar" &&
             schluesselBewerten("alphavantage", { error: { message: "nicht pruefbar" } }).s === "unklar" && /Alpha Vantage/.test(schluesselBewerten("alphavantage", { error: { message: "nicht pruefbar" } }).t) &&
             /ausgeschaltet/.test(schluesselBewerten("openai", { error: { message: "Internet ist in der App ausgeschaltet" } }).t), "Bewertung der Online-Prüfung");
      // Oberflaeche: falscher Schluessel -> rote Ampel, richtiger -> gelb (ohne App keine Online-Pruefung), entfernen -> Ampel weg
      zeige("schluessel");
      const form = () => document.querySelector('[data-schluessel-form="anthropic"]');
      form().querySelector('[name="wert"]').value = "sk-or-v1-abcdefabcdef1234"; form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      pruefe(form().querySelector(".ampel.falsch") && /OpenRouter/.test(form().querySelector(".ampel").textContent) && EIN().schluesselStatus.anthropic.s === "falsch", `Ampel nicht rot: ${form().textContent.slice(0, 200)}`);
      form().querySelector('[name="wert"]').value = "sk-ant-api03-abcdefabcdef1234"; form().dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      pruefe(form().querySelector(".ampel.unklar") && !form().querySelector(".ampel.falsch") && !!form().querySelector("[data-schluessel-pruefen]"), `Ampel nicht gelb: ${form().textContent.slice(0, 200)}`);
      localStorage.removeItem("test-schluessel-anthropic"); schluesselStatusSetzen("anthropic", null); zeige("schluessel");
      pruefe(!form().querySelector(".ampel") && !(EIN().schluesselStatus || {}).anthropic, "Ampel bleibt nach dem Entfernen stehen");
      zeige("uebersicht");
    }
    // --- Gewinnmitnahme-Rechner (0.50)
    {
      const g1 = gewinnmitnahmeRechnen({ modus: "pct", bestand: "10", einstand: "100", k1: "110", a1: "30", k2: "120", a2: "30", k3: "150", a3: "20", art: "aktie" });
      const s = g1.stufen;
      pruefe(s.length === 3 && s[0].stueck === 3 && s[0].erloes === 330 && s[0].gewinn === 30 && s[0].rest === 7 && s[0].restBis === 95.71, `Gewinnmitnahme Stufe 1: ${JSON.stringify(s[0])}`);
      pruefe(s[1].gewinn === 60 && s[1].restBis === 77.5 && s[2].gewinn === 100 && s[2].restBis === 5 && s[2].rest === 2, `Gewinnmitnahme Stufe 2/3: ${JSON.stringify(s.slice(1))}`);
      pruefe(g1.gewinn === 190 && g1.erloes === 990 && g1.rest === 2 && g1.restAnteil === 20 && g1.frei === null && g1.investiert === 1000, `Gewinnmitnahme Summe: ${JSON.stringify(g1)}`);
      const g2 = gewinnmitnahmeRechnen({ modus: "pct", bestand: "0,01353658", einstand: "73.947,61", k1: "80000", a1: "50", k2: "90000", a2: "25", gebuehrAn: true, gebuehr: "0,25" });
      pruefe(g2.stufen[0].stueck === 0.00676829 && nah(g2.stufen[0].erloes, 540.11) && nah(g2.stufen[0].gewinn, 39.61) && nah(g2.stufen[0].restBis, 68265.88) &&
             nah(g2.stufen[1].gewinn, 53.56) && nah(g2.stufen[1].restBis, 46531.77) && g2.rest === 0.00338415, `Gewinnmitnahme Gebühr: ${JSON.stringify(g2.stufen)}`);
      const g3 = gewinnmitnahmeRechnen({ modus: "pct", bestand: "10", einstand: "100", k1: "200", a1: "50", k2: "300", a2: "50", art: "aktie" });
      pruefe(g3.frei === 1 && g3.stufen[0].frei && g3.stufen[0].offen === 0 && g3.rest === 0 && g3.stufen[1].restBis === null && g3.gewinn === 1500, `Einstand zurück / alles verkauft: ${JSON.stringify(g3)}`);
      pruefe(/mehr als 100/.test(gewinnmitnahmeRechnen({ modus: "pct", bestand: "10", einstand: "100", k1: "110", a1: "60", k2: "120", a2: "50" }).fehler[0]), "Anteile > 100 % nicht abgefangen");
      pruefe(gewinnmitnahmeRechnen({ modus: "pct", bestand: "10", einstand: "100" }).fehler.length === 1 && gewinnmitnahmeRechnen({ modus: "pct", bestand: "10", einstand: "100", k1: "110" }).fehler.length === 1, "Leere/halbe Stufe nicht abgefangen");
      pruefe(gewinnmitnahmeRechnen({ modus: "pct", bestand: "10", einstand: "100", k1: "90", a1: "50" }).warnungen.length === 1, "Verkauf unter Break-even ohne Warnung");
      // Betrag in Euro rausnehmen (0.51, Beispiel 16.11.: Kurs 1.022, die eingezahlten 500 € rausnehmen, Rest laeuft)
      const r1 = gewinnmitnahmeRechnen({ bestand: "1", einstand: "500", k1: "1.022", b1: "500", art: "aktie" });
      pruefe(r1.betrag && r1.stufen[0].stueck === 0.4892 && r1.stufen[0].erloes === 500 && nah(r1.stufen[0].gewinn, 255.38) && r1.stufen[0].rest === 0.5108 && r1.stufen[0].restWert === 522 &&
             r1.frei === 1 && nah(r1.stufen[0].anteil, 48.92) && r1.stufen[0].ganz.stueck === 1 && r1.stufen[0].ganz.erloes === 1022, `Betrag rausnehmen: ${JSON.stringify(r1)}`);
      const r2 = gewinnmitnahmeRechnen({ bestand: "3", einstand: "600", k1: "1022", b1: "500", k2: "1200", b2: "800", art: "aktie" });
      pruefe(nah(r2.stufen[0].gewinn, 206.46) && nah(r2.stufen[0].restBis, 517.77) && r2.stufen[1].stueck === 0.6667 && r2.stufen[1].gewinn === 400 && nah(r2.stufen[1].restBis, 271.14) &&
             r2.erloes === 1300 && nah(r2.gewinn, 606.46) && r2.rest === 1.8441 && r2.frei === null, `Betrag zwei Stufen: ${JSON.stringify(r2.stufen)}`);
      const r3 = gewinnmitnahmeRechnen({ bestand: "0,5", einstand: "1000", k1: "1022", b1: "300", gebuehrAn: true, gebuehr: "0,25", art: "krypto" });
      pruefe(r3.stufen[0].stueck === 0.29427777 && r3.stufen[0].erloes === 300 && nah(r3.stufen[0].gewinn, 5.72) && nah(r3.stufen[0].restBis, 974.62) && r3.stufen[0].ganz === null, `Betrag mit Gebühr: ${JSON.stringify(r3.stufen)}`);
      pruefe(/gibt die Position nicht her/.test(gewinnmitnahmeRechnen({ bestand: "1", einstand: "500", k1: "1022", b1: "1100" }).fehler[0]), "Betrag größer als Position nicht abgefangen");
      pruefe(gewinnmitnahmeRechnen({ bestand: "1", einstand: "500", k1: "1022" }).fehler.length === 1 && gewinnmitnahmeRechnen({ bestand: "1", einstand: "500", k1: "1022", a1: "30" }).fehler.length === 1, "Betrags-Modus: fehlender Betrag nicht abgefangen");
      // Oberflaeche: aus Position oeffnen (Kopie), Eingaben aendern nichts am Depot, Betraege-aus verbirgt
      zeige("positionen");
      const pos = positionen().liste.find((p) => p.stueck > 0 && !(D.instrumente[p.id] || {}).ohneStueck), vorher = JSON.stringify(S.depots);
      ui.detail = pos.id; zeichnen();
      document.querySelector("[data-gewinn-aus]")?.click();
      pruefe(ui.seite === "notizen" && ui.gewinnOffen && nah(zahl(ui.gewinn.bestand), pos.stueck, 1e-8), "Gewinnmitnahme öffnet nicht aus der Position");
      // Auswahl im Rechner: Position waehlen -> Werte (Kopie) drin
      for (const ziel of ["nachkauf", "gewinn", "posgr"]) {
        ui[ziel] = null; ui[ziel + "Offen"] = true; ui.notizReiter = ziel; zeige("notizen");   // 0.69: Rechner als Reiter
        const sel = document.querySelector(`select[data-rechner-pos="${ziel}"]`);
        pruefe(!!sel && sel.options.length > 1, `Positions-Auswahl fehlt im Rechner ${ziel}`);
        sel.value = pos.id; sel.dispatchEvent(new Event("change", { bubbles: true }));
        const kurs = (D.instrumente[pos.id] || {}).kurs;
        pruefe(ui[ziel].posId === pos.id && (ziel === "posgr" ? (kurs == null || nah(zahl(ui.posgr.einstieg), kurs, 0.0001)) : nah(zahl(ui[ziel].bestand), pos.stueck, 1e-8)), `Auswahl füllt ${ziel} nicht: ${JSON.stringify(ui[ziel])}`);
        pruefe(document.querySelector(`select[data-rechner-pos="${ziel}"]`).value === pos.id, `Auswahl ${ziel} bleibt nicht stehen`);
      }
      ui.nachkaufOffen = false; ui.nachkauf = null; ui.detail = pos.id; zeichnen();
      pruefe(!!document.querySelector("[data-posgr-aus]"), "Knopf Positionsgröße fehlt in der Position"); document.querySelector("[data-posgr-aus]")?.click();
      pruefe(ui.seite === "notizen" && ui.posgrOffen && ui.posgr.posId === pos.id, "Positionsgröße öffnet nicht aus der Position");
      ui.posgrOffen = true; zeichnen();
      const setze = (sel, w) => { const el = document.querySelector(sel); el.value = w; el.dispatchEvent(new Event("input", { bubbles: true })); };
      ui.gewinn.modus = "pct"; zeichnen();
      for (const [n, w] of [["bestand", "10"], ["einstand", "100"], ["k1", "110"], ["a1", "30"]]) setze(`[data-gewinn="${n}"]`, w);
      // Betrags-Modus (0.51): Feld "Betrag €" statt "Anteil %", Knopf uebernimmt den Einstand (10 x 100 = 1.000 €)
      const pctStand = { ...ui.gewinn }; document.querySelector('[data-gewinn-wahl="modus"][data-wert="betrag"]').click();
      pruefe(document.querySelector('[data-gewinn="b1"]') && !document.querySelector('[data-gewinn="a1"]'), "Betrags-Modus zeigt kein Betragsfeld");
      setze('[data-gewinn="k1"]', "200"); document.querySelector("[data-gewinn-einstand]").click();
      pruefe(ui.gewinn.b1 === "1000,00" && /ab Stufe 1/.test(document.getElementById("gewinn-ergebnis").textContent) && /5 Stück/.test(document.getElementById("gewinn-ergebnis").textContent),
             `Einstand übernehmen: ${ui.gewinn.b1} / ${document.getElementById("gewinn-ergebnis").textContent.slice(0, 160)}`);
      ui.gewinn = pctStand; zeichnen();
      for (const [n, w] of [["einstieg", "100"], ["stop", "95"], ["maxverlust", "50"]]) setze(`[data-posgr="${n}"]`, w);
      document.querySelector("[data-posgr-depot]").click();
      pruefe(JSON.stringify(S.depots) === vorher, "Rechner haben das Depot verändert!");
      pruefe(zahl(ui.posgr.kapital) > 0, "Depotwert nicht als Kapital übernommen");
      const tg = document.getElementById("gewinn-ergebnis").textContent, tp = document.getElementById("posgr-ergebnis").textContent;
      pruefe(/Du nimmst raus/.test(tg) && /330,00/.test(tg) && /\+30,00/.test(tg) && /95,71/.test(tg), `Gewinnmitnahme-Anzeige: ${tg.slice(0, 200)}`);
      pruefe(/Positionsgröße/.test(tp) && /1\.000,00/.test(tp) && /−50,00|-50,00/.test(tp) && document.querySelectorAll("#posgr-ergebnis table tr").length === 9, `Positionsgröße-Anzeige: ${tp.slice(0, 200)}`);
      ui.verdeckt = true; zeichnen();
      pruefe(!/330,00|\+30,00|7 Stück/.test(document.getElementById("gewinn-ergebnis").textContent) && !/1\.000,00|50,00|10 Stück/.test(document.getElementById("posgr-ergebnis").textContent),
             "Beträge aus verbirgt in den neuen Rechnern nicht alles");
      ui.verdeckt = false; ui.gewinnOffen = false; ui.posgrOffen = false; ui.gewinn = null; ui.posgr = null; zeige("uebersicht");
    }
  }

  // --- Einstellungen: Verstecken-Modus
  ui.verdeckt = true; S.einstellungen.verstecken = "betraege";
  pruefe(pct(12.5) === "+12,50 %" && kursE(10) !== ZU, "Verstecken 'nur Beträge' zeigt keine Prozente/Kurse");
  S.einstellungen.verstecken = "kurse"; pruefe(kursE(10) === ZU && pct(1) !== "•• %", "Verstecken '+ Kurse'");
  S.einstellungen.verstecken = "alles"; pruefe(pct(1) === "•• %", "Verstecken 'alles'");
  delete S.einstellungen.verstecken; ui.verdeckt = false;

  // --- KI-Daten: nie Euro-Betraege
  pruefe(!/\d[\d.,]*\s?€/.test(kiDaten("watchlist")), "KI-Daten enthalten Euro");
  for (const n of Object.values(D.instrumente)) pruefe(!kiDaten("watchlist").includes(n.name) || (S.watchlist || []).some((w) => w.name === n.name), `KI-Daten enthalten Depotwert ${n.name}`);
  // 11.11.: Portfolio-Fragen - nur Prozente, nie Euro, Stueckzahlen, Konten oder Personen; Anteile + Cash = 100 %
  {
    const { liste } = positionen(), konten = [...new Set(D.buchungen.map((b) => b.konto).filter(Boolean))];
    for (const [r, mitP] of ["check", "minus", "plus", "aufloesen", "frei"].flatMap((r) => [[r, false], [r, true]])) {
      S.einstellungen.kiProzente = mitP;
      const txt = kiDaten(r, { wert: liste[0]?.id }).replace(/Einstiegskurs [\d.,]+/g, "");
      pruefe(!/€|EUR\b/.test(txt), `KI ${r}: Euro im Text`);
      for (const p of liste) {
        const st = String(rund(p.stueck, 4)).replace(".", ",");
        pruefe(!(p.stueck >= 2 && new RegExp("(^|[^\\d,])" + st.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![\\d,%])").test(txt.replace(/\d+,\d+ %|[+-]?\d+(,\d+)? %/g, ""))), `KI ${r}: Stückzahl ${st} von ${p.name}`);
      }
      for (const k of konten) pruefe(!txt.includes(k) || liste.some((p) => p.name.includes(k)), `KI ${r}: Kontoname ${k}`);
    }
    S.einstellungen.kiProzente = false;
    pruefe(!/%/.test(kiDaten("check")) && /Long, Einstiegskurs/.test(kiDaten("check")), "KI ab Werk: Prozente gesendet oder Einstieg fehlt");
    S.einstellungen.kiProzente = true;
    const chk = kiDaten("check"), anteile = [...chk.matchAll(/(?<![\w-])Anteil (-?\d+(?:,\d+)?) %/g)].map((m) => +m[1].replace(",", "."));
    const cashA = +(chk.match(/Cash-Anteil (-?\d+(?:,\d+)?) %/) || [0, "0"])[1].replace(",", ".");
    pruefe(liste.length <= 40 ? Math.abs(anteile.reduce((a, b) => a + b, 0) + cashA - 100) < 0.1 * (liste.length + 1) : true, `KI check: Anteile + Cash = ${anteile.reduce((a, b) => a + b, 0) + cashA} statt 100`);
    delete S.einstellungen.kiProzente;
  }

  // --- Jede Seite zeichnet; Betraege aus = kein Euro im DOM
  ui.verdeckt = true;
  for (const s of ["uebersicht", "positionen", "watchlist", "kalender", "mehr", "buchungen", "notizen", "ki", "hinweise", "unterstuetzen", "schluessel",
                   "datenschutz", "depots", "daten", "news", "sicherheit", "sachwerte", "kalender", "einstellungen"]) {
    try { zeige(s); } catch (e) { f.push(`Seite ${s}: ${e.message}`); continue; }
    if (["uebersicht", "positionen", "buchungen", "depots", "sachwerte", "kalender"].includes(s) && /\d[\d.]*,\d\d\s?€/.test(document.getElementById("inhalt").innerHTML))
      f.push(`Beträge aus: Euro sichtbar auf ${s}`);
  }
  ui.posAnsicht = "heatmap"; zeige("positionen"); ui.posAnsicht = "liste";
  ui.kalArt = "gv"; ui.gvMonat = "2026-01"; zeige("kalender");
  pruefe(document.querySelectorAll(".gvtag.plus").length === 2, "G/V-Kalender: 2 grüne Tage erwartet");
  ui.kalArt = null; ui.verdeckt = false;
  return f;
}

/** Grosser Test: 750.000 EUR auf 6 Broker, 2 Jahre (tests/grosstest.py). */
async function grossTest() {
  const soll = await (await fetch("grosstest/erwartet.json")).json();
  const f = [];
  const pruefe = (ok, text) => { if (!ok) f.push(text); };
  localStorage.clear();
  S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1");
  const G = "grosstest/";
  await importiere(await datei("1_kraken_krypto_halten_ledgers.csv", G), "ledgers.csv");
  await importiere(await datei("2_bitvavo_krypto_sparplan.csv", G), "bitvavo.csv");
  await importiere(await datei("3_okx_krypto_handel.csv", G), "okx.csv");
  await importiere(await datei("4_scalable_etf_sparplan.csv", G), "Broker-Transactions.csv");
  await importiere(await datei("5_smartbroker_einzelwerte.csv", G), "transaktionen.csv");
  await importiere(await datei("6_traderepublic_daytrading.csv", G), "Transaktionsexport.csv");
  // Offline, VOR der Kursliste: Verlauf nur aus den eigenen Ausfuehrungskursen (Python: soll.ohne_kurse)
  const ok = wertverlauf(Object.keys(S.depots)), so = soll.ohne_kurse;
  if (!ok || !ok.ausBuchungen) pruefe(false, "Ohne Kurse: kein Verlauf aus Buchungen");
  else {
    const n = so.index.length;
    pruefe(new Date(ok.raster[0] * 1000).toISOString().slice(0, 10) === so.raster[0], `Ohne Kurse: Start ${new Date(ok.raster[0] * 1000).toISOString()} statt ${so.raster[0]}`);
    const k1 = ok.gesamt.index.slice(0, n).findIndex((x, i) => Math.abs(x - so.index[i]) > 0.002);
    pruefe(k1 < 0, `Ohne Kurse: Index Woche ${k1}: ${ok.gesamt.index[k1]} statt ${so.index[k1]}`);
    const k2 = ok.gesamt.wert.slice(0, n).findIndex((x, i) => Math.abs(x - so.wert[i]) > 0.02);
    pruefe(k2 < 0, `Ohne Kurse: Wert Woche ${k2}: ${ok.gesamt.wert[k2]} statt ${so.wert[k2]}`);
    const k3 = ok.gesamt.einsatz.slice(0, n).findIndex((x, i) => Math.abs(x - so.einsatz[i]) > 0.05);
    pruefe(k3 < 0, `Ohne Kurse: Eingesetzt Woche ${k3}: ${ok.gesamt.einsatz[k3]} statt ${so.einsatz[k3]}`);
    const gOff = gesamtDaten().gesamt;
    pruefe(Math.abs(gOff - so.wert.at(-1)) < 0.05, `Ohne Kurse: Gesamtvermögen ${gOff} passt nicht zum Chart ${so.wert.at(-1)}`);
    pruefe(Math.abs(ok.gesamt.index.at(-1) - so.index.at(-1)) < 0.002, `Ohne Kurse: Endstand ${ok.gesamt.index.at(-1)} statt ${so.index.at(-1)}`);
  }
  if (new URLSearchParams(location.search).get("offline")) { ui.alle = true; zeige("uebersicht"); return f; }
  const kl = erkennen(await datei("7_kursliste_wochenkurse.csv", G), "kurse.csv");
  const [n, fremd] = kurslisteUebernehmen(kl.kursliste);
  pruefe(!fremd.length, `Kursliste: unbekannt ${fremd}`);
  const ids = {};
  for (const [id, d] of Object.entries(S.depots)) ids[d.name] = id;
  pruefe(Object.keys(ids).sort().join() === Object.keys(soll.depots).sort().join(), `Depots: ${Object.keys(ids)}`);
  const nahR = (a, b, rel = 1e-6, abs = 0.02) => Math.abs(a - b) <= Math.max(abs, Math.abs(b) * rel);
  for (const [name, x] of Object.entries(soll.depots)) {
    if (!ids[name]) continue;
    oeffnen(ids[name]);
    const b = bestand();
    const offen = Object.values(b).filter((p) => p.stueck > 1e-9);
    pruefe(offen.length === Object.keys(x.positionen).length, `${name}: ${offen.length} Positionen statt ${Object.keys(x.positionen).length}`);
    for (const [iid, [st, ein]] of Object.entries(x.positionen)) {
      const p = offen.find((q) => q.instrument === iid);
      pruefe(p && nahR(p.stueck, st, 1e-9, 1e-7) && nahR(p.einstand, ein), `${name} ${iid}: ${p && [p.stueck, p.einstand]} statt ${[st, ein]}`);
    }
    const real = Object.values(b).reduce((s, p) => s + p.realisiert, 0), div = Object.values(b).reduce((s, p) => s + p.dividenden, 0);
    pruefe(nahR(real, x.realisiert), `${name}: realisiert ${real} statt ${x.realisiert}`);
    pruefe(nahR(div, x.dividenden), `${name}: Dividenden ${div} statt ${x.dividenden}`);
    const k = kontoStand();
    pruefe(x.konto == null ? !k : k && nahR(k.stand, x.konto), `${name}: Konto ${k && k.stand} statt ${x.konto}`);
    pruefe(D.buchungen.length === x.buchungen, `${name}: ${D.buchungen.length} Buchungen statt ${x.buchungen}`);
    const v = wertverlauf([ids[name]]).gesamt, s = x.verlauf;
    vergleicheVerlauf(name, v, s, pruefe);
    if (name === "Smartbroker") {
      const etc = Object.values(D.instrumente).filter((i) => i.art === "ETC").length;
      pruefe(etc === 2, `Smartbroker: ${etc} ETC statt 2 (Gold, Silber)`);
    }
    if (name === "Smartbroker") {
      const dv = kalenderEreignisse([ids[name]]).filter((e) => e.sicher);
      pruefe(dv.length > 10 && dv.every((e) => /auf deinen Einsatz/.test(e.info)), `Kalender: ${dv.length} Dividenden, ohne %: ${dv.filter((e) => !/auf deinen Einsatz/.test(e.info)).map((e) => e.datum + " " + e.titel + " " + e.info).slice(0, 3).join(" / ")}`);
      pruefe(nahR(dv.reduce((a2, e) => a2 + e.eur, 0), x.dividenden), "Kalender: Summe Dividenden");
    }
    if (name === "Scalable") pruefe(Object.values(D.instrumente).every((i) => i.art === "ETF"), "Scalable: nicht alles ETF");
  }
  const alle = Object.values(ids);
  vergleicheVerlauf("GESAMT", wertverlauf(alle).gesamt, soll.gesamt, pruefe);
  // Steuer je Jahr = Python (Krypto FIFO mit Haltefrist, Aktien-Topf, sonstige, Ertraege, Steuer)
  { const st = steuerJahre(Object.values(ids));
    for (const [jahr, x] of Object.entries(soll.steuer))
      for (const [k, w] of Object.entries(x)) pruefe(st[jahr] && Math.abs(st[jahr][k] - w) < 0.05, `Steuer ${jahr} ${k}: ${st[jahr]?.[k]} statt ${w}`);
    pruefe(Object.keys(st).sort().join() === Object.keys(soll.steuer).sort().join(), `Steuer-Jahre ${Object.keys(st)}`);
  }
  // Uebersicht = alle Depots zusammen (Vorgabe 07.11.)
  ui.alle = true; ui.chartArt = null; zeige("uebersicht");
  // Gesamt = genau EINE Linie (Vorgabe 07.11.: keine zweite/gestrichelte Linie); einzeln = eine je Depot
  pruefe(document.querySelectorAll("#inhalt .wertchart svg polyline").length === 1, "Gesamt-Chart hat nicht genau eine Linie");
  ui.chartArt = "einzeln"; zeige("uebersicht");
  pruefe(document.querySelectorAll("#inhalt .wertchart svg polyline").length === 6, "Depots einzeln: nicht 6 Linien");
  for (const zr of ["1w", "1m", "3m", "6m", "1j", "3j", "5j", "alle"]) {
    ui.wertZeitraum = zr; zeige("uebersicht");
    if (!document.querySelector("#inhalt .wertchart svg polyline")) pruefe(false, `Zeitraum ${zr}: kein Chart`);
  }
  ui.wertZeitraum = null;
  ui.chartArt = null; zeige("uebersicht");
  const gd = gesamtDaten();
  pruefe(nahR(gd.gesamt, soll.gesamt.wert.at(-1), 1e-6, 0.05), `Gesamtübersicht ${gd.gesamt} statt ${soll.gesamt.wert.at(-1)}`);
  pruefe(document.getElementById("titel").textContent === "Alle Depots", "Titel nicht 'Alle Depots'");
  pruefe(document.querySelectorAll("#inhalt [data-sicht]").length === 2 && sichten().length === 7, `Sicht-Leiste fehlt (${sichten().length} Sichten)`);
  // ‹ › blaettert reihum durch alle Depots und zurueck zu "Alle"; auf der Positionen-Seite genauso
  {
    const namen = [];
    for (let k = 0; k < 7; k++) { namen.push(gesamtAnsicht() ? "alle" : S.aktiv); document.querySelector('#inhalt [data-sicht="1"]').click(); }
    pruefe(new Set(namen).size === 7 && gesamtAnsicht(), `Sicht-Leiste blättert nicht durch alle (${namen.join(",")})`);
    zeige("positionen"); document.querySelector('#inhalt [data-sicht="1"]').click();
    pruefe(ui.seite === "positionen" && !gesamtAnsicht() && document.querySelector("#inhalt .sichtleiste b").textContent === D.name, "Sicht-Leiste auf Positionen");
    document.querySelector('#inhalt [data-sicht="-1"]').click(); pruefe(gesamtAnsicht(), "Sicht zurück auf Alle");
    document.querySelector("#inhalt [data-sicht-wahl]").click();
    pruefe(document.querySelectorAll("#inhalt [data-sicht-nr]").length === 7, "Sicht-Auswahl (antippen) fehlt");
    document.querySelector('#inhalt [data-sicht-nr="3"]').click(); pruefe(!gesamtAnsicht() && sichtIndex() === 3, "Sicht-Auswahl springt nicht");
    sichtSetzen(sichten()[0]); zeige("uebersicht");
  }
  // Familie: Kraken, Bitvavo, OKX gehoeren "Partner" -> getrennte Summen, Haushalt = alles
  for (const n of ["Kraken", "Bitvavo", "OKX"]) S.depots[ids[n]].person = "Partner";
  ui.person = "Partner"; ui.alle = true; zeige("uebersicht");
  const gP = gesamtDaten(), sollP = ["Kraken", "Bitvavo", "OKX"].reduce((a2, n) => a2 + soll.depots[n].wert_heute, 0);
  pruefe(nahR(gP.gesamt, sollP, 1e-6, 0.05) && gP.ids.length === 3, `Person Partner: ${gP.gesamt} statt ${sollP}`);
  pruefe(document.getElementById("titel").textContent.startsWith("Partner"), "Titel Person fehlt");
  ui.person = "Ich"; const gI = gesamtDaten();
  pruefe(nahR(gI.gesamt + gP.gesamt, gd.gesamt, 1e-6, 0.05), "Ich + Partner ≠ Haushalt");
  ui.person = null; zeige("uebersicht");
  pruefe(sichten().length === 9 && sichtName(sichten()[0]) === "👪 Haushalt" && sichten().some((s) => sichtName(s) === "Alle von Partner") && nahR(gesamtDaten().gesamt, gd.gesamt, 1e-6, 0.05),
         `Haushalt-Sichten/-Summe: ${sichten().map(sichtName).join(" | ")}`);
  sichtSetzen(sichten().find((s) => s.alle && s.person === "Partner")); pruefe(ui.person === "Partner" && gesamtAnsicht() && nahR(gesamtDaten().gesamt, sollP, 1e-6, 0.05), "Sicht 'Alle von Partner'");
  sichtSetzen(sichten()[0]);
  for (const n of ["Kraken", "Bitvavo", "OKX"]) delete S.depots[ids[n]].person;

  // Depot bearbeiten: eines als "beobachtet" markieren -> zaehlt nicht mehr zum Gesamtvermoegen
  document.querySelector(`#inhalt [data-depot-edit="${ids.OKX}"]`).click();
  const fo = document.getElementById("depot-bearbeiten-form");
  pruefe(!!fo, "Bearbeiten-Formular fehlt");
  if (fo) {
    fo.querySelector('[name="rolle"]').value = "beobachtet"; fo.querySelector('[name="name"]').value = "OKX (Freund)";
    fo.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    const g2 = gesamtDaten();
    pruefe(S.depots[ids.OKX].name === "OKX (Freund)" && nahR(g2.gesamt, gd.gesamt - soll.depots.OKX.wert_heute, 1e-6, 0.05), `Beobachtet: Gesamt ${g2.gesamt}`);
    S.depots[ids.OKX].rolle = "eigen"; S.depots[ids.OKX].name = "OKX";
  }
  document.querySelector('#inhalt [data-ansicht]:not([data-ansicht="alle"])').click();
  pruefe(!gesamtAnsicht() && document.getElementById("titel").textContent !== "Alle Depots", "Reiter öffnet kein Einzeldepot");
  ui.alle = true;
  const t = gvJeTag([ids["Trade Republic"]]), tw = Object.values(t);
  pruefe(tw.length === soll.daytrading.tage, `Daytrading: ${tw.length} Tage statt ${soll.daytrading.tage}`);
  pruefe(tw.filter((x) => x.gv > 0).length === soll.daytrading.gewinntage, "Daytrading: Gewinntage");
  pruefe(tw.reduce((s, x) => s + x.trades, 0) === soll.daytrading.trades, "Daytrading: Anzahl Verkäufe");
  pruefe(nahR(tw.reduce((s, x) => s + x.gv, 0), soll.daytrading.summe), "Daytrading: Summe");
  // Seiten mit grossem Stand zeichnen ohne Absturz
  if (new URLSearchParams(location.search).get("einzeln")) ui.chartArt = "einzeln";
  if (new URLSearchParams(location.search).get("zeigen")) { oeffnen(ids[new URLSearchParams(location.search).get("depot") || "Smartbroker"]); ui.kalMonat = "2025-05"; zeige(new URLSearchParams(location.search).get("zeigen")); return f; }
  for (const sn of ["uebersicht", "positionen", "depots", "kalender"]) try { zeige(sn); } catch (e) { f.push(`Seite ${sn}: ${e.message}`); }
  return f;
}

function vergleicheVerlauf(name, v, s, pruefe) {
  if (!v) return pruefe(false, `${name}: kein Verlauf`);
  const n = (a, b, t = 1e-3) => Math.abs(a - b) <= t;
  pruefe(v.index.length === s.index.length, `${name}: ${v.index.length} Wochen statt ${s.index.length}`);
  const k = v.index.findIndex((x, i) => !n(x, s.index[i], 0.002));
  pruefe(k < 0, `${name}: Index Woche ${k}: ${v.index[k]} statt ${s.index[k]}`);
  const kw = v.wert.findIndex((x, i) => !n(x, s.wert[i], 0.02));
  const ke = v.einsatz.findIndex((x, i) => !n(x, s.einsatz[i], 0.05));
  pruefe(ke < 0, `${name}: Eingesetzt Woche ${ke}: ${v.einsatz[ke]} statt ${s.einsatz[ke]}`);
  pruefe(kw < 0, `${name}: Wert Woche ${kw}: ${v.wert[kw]} statt ${s.wert[kw]}`);
  pruefe(n(v.rendite * 100, s.rendite), `${name}: Rendite ${v.rendite * 100} statt ${s.rendite}`);
  pruefe(n(v.drawdown * 100, s.drawdown), `${name}: Drawdown ${v.drawdown * 100} statt ${s.drawdown}`);
  pruefe(n(v.hoch.wert, s.hoch[0], 0.02) && v.hoch.datum === s.hoch[1], `${name}: Hoch ${v.hoch.wert} ${v.hoch.datum} statt ${s.hoch}`);
  pruefe(n(v.tief.wert, s.tief[0], 0.02) && v.tief.datum === s.tief[1], `${name}: Tief ${v.tief.wert} ${v.tief.datum} statt ${s.tief}`);
  pruefe(n(v.indexHoch, s.indexHoch, 0.002) && n(v.indexTief, s.indexTief, 0.002), `${name}: Index-Hoch/Tief`);
}

/** Mehrere Dateien auf einmal, absichtlich in verdrehter Reihenfolge: Kursliste muss
 *  zuletzt laufen, jede Vorschau wird uebernommen, am Ende stimmt GESAMT. */
async function mehrfachTest() {
  const soll = await (await fetch("grosstest/erwartet.json")).json(), f = [];
  localStorage.clear();
  S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
  const namen = ["7_kursliste_wochenkurse.csv", "6_traderepublic_daytrading.csv", "1_kraken_krypto_halten_ledgers.csv", "3_okx_krypto_handel.csv",
                 "5_smartbroker_einzelwerte.csv", "2_bitvavo_krypto_sparplan.csv", "4_scalable_etf_sparplan.csv"];
  // wie File-Objekte (name + text()), aber ohne Blob-Lesen - das laeuft im Testbrowser ausserhalb der Zeitsteuerung
  const dateien = await Promise.all(namen.map(async (n) => { const t = await datei(n, "grosstest/"); return { name: "Test_" + n, text: async () => t }; }));
  await dateienEinlesen(dateien);
  let runden = 0;
  while (ui.vorschau && runden++ < 20) {
    if (document.querySelector('[data-umfang="alles"]')) document.querySelector('[data-umfang="alles"]').click();
    vorschauUebernehmen();
  }
  if (ui.importSchlange) f.push("Schlange nicht leer");
  const n = Object.keys(S.depots).length;
  if (n !== 6) f.push(`${n} Depots statt 6 (${Object.values(S.depots).map((d) => d.name + ":" + d.buchungen.length)}) Fehler ${(ui.importFehler || []).join(" | ")}`);
  ui.alle = true;
  const t0 = performance.now(); zeige("uebersicht"); const msUeb = performance.now() - t0;
  const t1 = performance.now(); wertverlauf(Object.keys(S.depots)); const msVerl = performance.now() - t1;
  if (msUeb > 3000) f.push(`Übersicht zu langsam: ${Math.round(msUeb)} ms (Wertverlauf ${Math.round(msVerl)} ms)`);
  ui.messung = `Übersicht ${Math.round(msUeb)} ms, Wertverlauf ${Math.round(msVerl)} ms`;
  const g = gesamtDaten();
  if (Math.abs(g.gesamt - soll.gesamt.wert.at(-1)) > 0.05) f.push(`Mehrfach-Import: Gesamt ${g.gesamt} statt ${soll.gesamt.wert.at(-1)}`);
  return f;
}

/** 10 Testfaelle (tests/testfaelle.py): Robustheit und Rechnung. */
async function faelleTest() {
  const soll = await (await fetch("testfaelle/erwartet.json")).json();
  const f = [], T = "testfaelle/";
  const pruefe = (ok, text) => { if (!ok) f.push(text); };
  localStorage.clear();
  S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1");
  const summe = (feld) => Object.values(bestand()).reduce((a, p) => a + p[feld], 0);
  const offen = () => Object.values(bestand()).filter((p) => p.stueck > 1e-9);
  const fall = async (nr, datei, konto = "Test " + nr) => {
    const r = await importiere(await datei_(datei), datei, true, konto);
    oeffnen(Object.entries(S.depots).find(([, d]) => d.name === konto)?.[0] || S.aktiv);
    return r;
  };
  const datei_ = (n) => datei(n, n.startsWith("grosstest/") ? "" : T);
  // 1 doppelt
  await importiere(await datei("6_traderepublic_daytrading.csv", "grosstest/"), "x.csv");
  const r1 = await importiere(await datei("6_traderepublic_daytrading.csv", "grosstest/"), "x.csv");
  pruefe(r1.n === 0, `Fall 1: ${r1.n} neue statt 0`);
  // 11 Kraken-App "Activities": Transfers an Challenge = Verlust (ab Werk), wahlweise Aus-/Einzahlung
  {
    const v11 = erkennen(await datei("11_kraken_app_aktivitaeten.csv", T), "krak-activities.csv");
    pruefe(v11.format.startsWith("Kraken – Aktivitäten"), `Fall 11: Format ${v11.format}`);
    await fall(11, "11_kraken_app_aktivitaeten.csv");
    const k11 = kontoStand();
    pruefe(k11 && nah(k11.stand, soll["11"].konto) && nah(k11.verluste, soll["11"].verluste) && nah(k11.bonus, soll["11"].bonus),
           `Fall 11: Konto ${k11?.stand} Verluste ${k11?.verluste} Bonus ${k11?.bonus}`);
    const r11 = Object.values(bestand()).reduce((a2, x) => a2 + x.realisiert, 0);
    pruefe(nah(r11, soll["11"].realisiert) && !Object.values(bestand()).some((x) => x.stueck > 1e-9), `Fall 11: Challenge in $ realisiert ${r11} statt ${soll["11"].realisiert}`);
    const e11 = einsatzVerlauf([S.aktiv]);
    pruefe(e11 && nah(e11.einsatz.at(-1), soll["11"].einsatz), `Fall 11: eingesetzt ${e11?.einsatz.at(-1)} statt ${soll["11"].einsatz}`);
    ui.vorschau = v11; v11.transferAls = "auszahlung"; v11.ziel = "neu"; vorschauPruefen(v11);
    pruefe(v11.buchungen.filter((b) => b.typ === "auszahlung").length === 3 && v11.buchungen.filter((b) => b.typ === "einzahlung").length === 4 && v11.buchungen.some((b) => /Challenge/.test(b.notiz || "") && b.typ === "verkauf"), "Fall 11: Umschalten auf Aus-/Einzahlung");
    ui.vorschau = null;
  }
  // 2 Excel
  await fall(2, "02_excel_umgespeichert.csv");
  // Chart auch OHNE Kursverlauf (Vorgabe 07.11.: "sehe keinen Chart"): eingesetzt laut Buchungen
  ui.alle = false; zeige("uebersicht");
  pruefe(!!document.querySelector("#inhalt .wertchart svg"), "Kein Chart ohne Kursverlauf");
  const ev = einsatzVerlauf([S.aktiv]);
  pruefe(ev && nah(ev.einsatz.at(-1), 1000), `Eingesetzt ohne Kurse ${ev?.einsatz.at(-1)} statt 1000`);
  pruefe(nah(summe("realisiert"), soll["2"].realisiert), `Fall 2: realisiert ${summe("realisiert")}`);
  pruefe(kontoStand() && nah(kontoStand().stand, soll["2"].konto), `Fall 2: Konto ${kontoStand()?.stand}`);
  pruefe(offen().length === 1 && nah(offen()[0].stueck, 0.0125, 1e-9), `Fall 2: BTC ${offen()[0]?.stueck}`);
  // 3 Angriff im Namen
  await fall(3, "03_sonderzeichen_und_angriff.csv");
  zeige("positionen");
  const inh = document.getElementById("inhalt");
  pruefe(!inh.querySelector("img") && document.title.indexOf("XSS") < 0, "Fall 3: HTML im Namen wurde ausgeführt");
  pruefe(inh.textContent.includes("Müller & Söhne"), "Fall 3: Name nicht als Text sichtbar");
  pruefe(nah(summe("einstand"), soll["3"].einstand), "Fall 3: Einstand");
  // 4 Ueberverkauf
  await fall(4, "04_mehr_verkauft_als_gekauft.csv");
  pruefe(nah(summe("realisiert"), soll["4"].realisiert), `Fall 4: realisiert ${summe("realisiert")}`);
  pruefe(Object.values(bestand()).every((p) => p.stueck >= 0) && offen().length === 0, "Fall 4: Minus-Bestand");
  zeige("uebersicht");
  pruefe(/über dem Bestand/.test(document.getElementById("inhalt").textContent), "Fall 4: keine Warnung");
  // 5 neu gekauft
  await fall(5, "05_verkauft_und_neu_gekauft.csv");
  const p5 = offen()[0];
  pruefe(p5 && p5.stueck === 8 && nah(p5.einstand, 381) && nah(summe("realisiert"), soll["5"].realisiert), `Fall 5: ${p5 && [p5.stueck, p5.einstand]}`);
  // 6 Smartbroker
  const r6 = await fall(6, "06_storno_steuer_dividende.csv");
  const p6 = offen()[0];
  pruefe(r6.n === 3 && p6 && p6.stueck === 25 && nah(p6.einstand, soll["6"].einstand) && nah(summe("realisiert"), soll["6"].realisiert)
         && nah(summe("dividenden"), soll["6"].dividenden), `Fall 6: ${r6.n} ${p6 && [p6.stueck, p6.einstand]} ${summe("realisiert")} ${summe("dividenden")}`);
  // 7 + 8: Meldung statt Absturz
  // 8 Kontoauszug + 12 unbekannter Broker: Spalten zuordnen (Vorschlag), gemerkte Zuordnung beim zweiten Mal
  {
    const r8 = erkennen(await datei("08_falsches_format_kontoauszug.csv", T), "konto.csv");
    pruefe(!!r8.zuordnen, "Fall 8: keine Zuordnungs-Seite");
    if (r8.zuordnen) {
      const v8 = zuordnungAnwenden(r8.zuordnen, r8.zuordnen.z);
      pruefe(v8.format.startsWith("Kontoauszug") && nah(v8.buchungen.reduce((a2, b) => a2 + b.betrag, 0), soll["8"].konto), `Fall 8: ${v8.format} ${v8.buchungen.map((b) => b.betrag)}`);
    }
    const t12 = await datei("12_unbekannter_broker.csv", T), r12 = erkennen(t12, "fremd.csv");
    pruefe(!!r12.zuordnen, "Fall 12: keine Zuordnungs-Seite");
    if (r12.zuordnen) {
      const z = r12.zuordnen.z;
      pruefe(z.spalten.datum === 0 && z.spalten.isin === 3 && z.spalten.stueck === 4 && z.spalten.betrag === 6 && z.spalten.gebuehr === 7 && z.spalten.steuer === 8,
             `Fall 12: Vorschlag ${JSON.stringify(z.spalten)}`);
      z.typen.Depotentgelt = "gebuehr"; z.konto = "Test 12";
      ui.seite = "daten"; ui.zuordnung = r12.zuordnen; zeichnen();
      document.getElementById("zuordnung-merken").checked = true;
      document.querySelector('[data-los="zuordnung-ok"]').click();
      pruefe(!!ui.vorschau, "Fall 12: keine Vorschau nach Zuordnung");
      if (ui.vorschau) { ui.vorschau.ziel = "neu"; vorschauUebernehmen(); }
      oeffnen(Object.entries(S.depots).find(([, d]) => d.name === "Test 12")?.[0] || S.aktiv);
      const p12 = offen()[0];
      pruefe(p12 && p12.stueck === 18 && nah(p12.einstand, soll["12"].einstand) && nah(summe("realisiert"), soll["12"].realisiert) && nah(summe("dividenden"), soll["12"].dividenden),
             `Fall 12: ${p12 && [p12.stueck, p12.einstand]} real ${summe("realisiert")} div ${summe("dividenden")}`);
      pruefe(kontoStand()?.gebuehren === 2, "Fall 12: Depotentgelt nicht als Gebühr");
      const nochmal = erkennen(t12, "fremd.csv");
      pruefe(!nochmal.zuordnen && nochmal.buchungen?.every((b) => b.ueberspringen), "Fall 12: zweites Mal nicht automatisch erkannt / doppelt");
    }
  }
  // 14-16 PDF-Import (ab 0.31): Kraken-Kontoauszug, Bank-Tabelle in zwei Bauarten, Scan und Passwort
  {
    const pdfDatei = async (n) => new File([await (await fetch(T + n)).arrayBuffer()], n);
    const kontoSetzen = (name) => { ui.einfuehrung = null; ui.seite = "daten"; zeichnen();
      const f = document.getElementById("vorschau-konto"); f.value = name; f.dispatchEvent(new Event("change", { bubbles: true })); };
    await dateienEinlesen([await pdfDatei("14_kraken_kontoauszug.pdf")]);
    const v14 = ui.vorschau, s14 = soll["14"];
    pruefe(v14 && v14.format === "Kraken – Kontoauszug (PDF)" && v14.buchungen.length === s14.buchungen && v14.buchungen.every((b) => !b.ueberspringen),
           `Fall 14: ${v14 ? v14.format + " " + v14.buchungen.length + " Buchungen" : "keine Vorschau – " + document.getElementById("meldung").textContent}`);
    if (v14) {
      pruefe(v14.buchungen.filter((b) => b.startbestand).length === 3 && v14.buchungen.every((b) => b.datum >= "2026-02-28" && b.datum <= "2026-03-31"), "Fall 14: Anfangsbestand/Datum");
      kontoSetzen("Test 14");
      pruefe(!!document.querySelector("[data-transfer]"), "Fall 14: Transfer-Schalter fehlt");
      vorschauUebernehmen();
      oeffnen(Object.entries(S.depots).find(([, d]) => d.name === "Test 14")?.[0] || S.aktiv);
      const st = (id) => Object.values(bestand()).find((p) => p.instrument === id)?.stueck;
      pruefe(nah(st("BTC"), s14.btc, 1e-9) && nah(st("ETH"), s14.eth, 1e-9) && nah(st("USD"), 0, 1e-9), `Fall 14: BTC ${st("BTC")} ETH ${st("ETH")} USD ${st("USD")}`);
      pruefe(nah(summe("einstand"), s14.einstand) && nah(summe("realisiert"), s14.realisiert), `Fall 14: Einstand ${summe("einstand")} realisiert ${summe("realisiert")}`);
      const k14 = kontoStand();
      pruefe(k14 && nah(k14.stand, s14.konto) && nah(k14.verluste, s14.verluste) && nah(k14.bonus, s14.bonus), `Fall 14: Konto ${k14?.stand} Verluste ${k14?.verluste} Bonus ${k14?.bonus}`);
      // dieselbe PDF noch einmal: nichts Neues
      await dateienEinlesen([await pdfDatei("14_kraken_kontoauszug.pdf")]);
      if (ui.vorschau) kontoSetzen("Test 14");
      pruefe(ui.vorschau && ui.vorschau.buchungen.every((b) => b.ueberspringen), "Fall 14: zweiter Import nicht als doppelt erkannt");
      // Transfers als Aus-/Einzahlung: Dollar-Transfer wird Ausbuchung statt Verlust
      const pdf14 = await pdfLesen(new Uint8Array(await (await fetch(T + "14_kraken_kontoauszug.pdf")).arrayBuffer()));
      const w14 = erkennenPdf(pdf14, "x.pdf"); w14.ziel = "neu"; w14.transferAls = "auszahlung"; vorschauPruefen(w14);
      pruefe(w14.buchungen.filter((b) => b.typ === "ausbuchung").length === 1 && w14.buchungen.filter((b) => b.typ === "auszahlung").length === 1
             && w14.buchungen.filter((b) => b.typ === "einzahlung").length === 2 && !w14.buchungen.some((b) => b.typ === "verlust"), "Fall 14: Umschalten auf Aus-/Einzahlung");
    }
    ui.vorschau = null; ui.importSchlange = null;
    const lesePdf = async (n) => erkennenPdf(await pdfLesen(new Uint8Array(await (await fetch(T + n)).arrayBuffer())), n);
    const uebernehmen = (v, konto) => { ui.vorschau = v; kontoSetzen(konto); const n = ui.vorschau.buchungen.filter((b) => !b.ueberspringen).length; vorschauUebernehmen();
      oeffnen(Object.entries(S.depots).find(([, d]) => d.name === konto)?.[0] || S.aktiv); return n; };
    for (const n of ["15a_bank_kontoauszug_einfach.pdf", "15b_bank_kontoauszug_gepackt.pdf"]) {
      let v15;
      try { v15 = await lesePdf(n); } catch (e) { pruefe(false, `Fall 15 ${n}: ${e.message}`); continue; }
      pruefe(!v15.zuordnen && /Kontoauszug \(PDF\)$/.test(v15.format || ""), `Fall 15 ${n}: nicht als Kontoauszug erkannt (${v15.format})`);
      if (v15.zuordnen) continue;
      const n15 = v15.buchungen.map((b) => b.notiz);
      pruefe(v15.buchungen.length === soll["15"].buchungen && nah(v15.buchungen.reduce((a2, b) => a2 + b.betrag, 0), soll["15"].konto), `Fall 15 ${n}: ${v15.buchungen.map((b) => b.betrag)}`);
      pruefe(n15[0] === "Gehalt März Müller GmbH" && n15[1] === "Miete Wohnung Dauerauftrag 0815" && n15[2] === "Übertrag Sparkonto (Rücklage)", `Fall 15 ${n}: Texte ${n15.join(" / ")}`);
      pruefe(v15.buchungen.map((b) => b.datum).join() === "2026-03-02,2026-03-05,2026-03-17", `Fall 15 ${n}: Datum ${v15.buchungen.map((b) => b.datum)}`);
    }
    try {   // 17 zweizeiliger Kopf, Euro-Zeichen, Gegenprobe
      const v17 = await lesePdf("17_bank_zweizeiliger_kopf.pdf"), s17 = soll["17"];
      pruefe(v17.format === "Revolut – Kontoauszug (PDF)" && v17.buchungen.length === s17.buchungen && /stimmt/.test(v17.hinweis || ""), `Fall 17: ${v17.format} ${v17.buchungen.length} „${v17.hinweis}“`);
      uebernehmen(v17, "Test 17");
      const k17 = kontoStand();
      pruefe(k17 && nah(k17.stand, s17.konto) && nah(k17.karte, s17.karte) && nah(k17.gebuehren, s17.gebuehren), `Fall 17: Konto ${k17?.stand} Karte ${k17?.karte} Gebühren ${k17?.gebuehren}`);
      const w17 = await lesePdf("17_bank_zweizeiliger_kopf.pdf"); w17.ziel = S.aktiv; vorschauPruefen(w17);
      pruefe(w17.buchungen.every((b) => b.ueberspringen), "Fall 17: zweiter Import nicht als doppelt erkannt");
    } catch (e) { pruefe(false, "Fall 17: " + e.message); }
    try {   // 18 Broker-Verrechnungskonto: Kauf/Verkauf/Ausschuettung aus dem Auszug
      const v18 = await lesePdf("18_broker_verrechnungskonto.pdf"), s18 = soll["18"];
      pruefe(v18.buchungen.length === s18.buchungen && /stimmt/.test(v18.hinweis || ""), `Fall 18: ${v18.buchungen.length} Buchungen „${v18.hinweis}“ ${v18.buchungen.map((b) => b.typ)}`);
      uebernehmen(v18, "Test 18");
      const p18 = offen()[0], k18 = kontoStand();
      pruefe(p18 && nah(p18.stueck, s18.stueck, 1e-9) && D.instrumente[p18.instrument]?.name === "Test AG" && nah(summe("realisiert"), s18.realisiert) && nah(summe("dividenden"), s18.dividenden),
             `Fall 18: ${p18 && [p18.stueck, D.instrumente[p18.instrument]?.name]} real ${summe("realisiert")} div ${summe("dividenden")}`);
      pruefe(k18 && nah(k18.stand, s18.konto), `Fall 18: Konto ${k18?.stand}`);
    } catch (e) { pruefe(false, "Fall 18: " + e.message); }
    try {   // 19 Kraken: Ledger-PDF, danach der Kaufbeleg desselben Kaufs
      const v19 = await lesePdf("19a_kraken_ledger.pdf"), s19 = soll["19"];
      pruefe(v19.format === "Kraken – Ledger (PDF)" && v19.buchungen.length === s19.buchungen, `Fall 19: ${v19.format} ${v19.buchungen.length} ${v19.buchungen.map((b) => b.typ)}`);
      uebernehmen(v19, "Test 19");
      const st19 = () => Object.values(bestand()).find((p) => p.instrument === "ADA")?.stueck;
      pruefe(nah(st19(), s19.ada, 1e-9) && nah(kontoStand()?.stand, s19.konto), `Fall 19: ADA ${st19()} Konto ${kontoStand()?.stand}`);
      const b19 = await lesePdf("19b_kraken_kaufbeleg.pdf");
      pruefe(b19.format === "Kraken – Kaufbeleg (PDF)" && b19.buchungen.length === 1 && nah(b19.buchungen[0].stueck, 5.755063, 1e-9) && b19.buchungen[0].kasse === -1 && b19.buchungen[0].datum === "2026-08-20",
             `Fall 19: Beleg ${JSON.stringify(b19.buchungen[0])}`);
      b19.ziel = S.aktiv; vorschauPruefen(b19);
      pruefe(b19.buchungen[0].ueberspringen && /schon da/.test(b19.buchungen[0].grund), `Fall 19: Beleg nicht als doppelt erkannt (${b19.buchungen[0].grund})`);
      b19.ziel = "neu"; vorschauPruefen(b19);
      pruefe(!b19.buchungen[0].ueberspringen, "Fall 19: Beleg im leeren Depot übersprungen");
    } catch (e) { pruefe(false, "Fall 19: " + e.message); }
    try {   // 20 Trade Republic: Datum ueber 3 Zeilen, Beschreibung vor dem Tag, quantity unter dem Jahr, Seitenwechsel
      const v20 = await lesePdf("20_traderepublic_kontoauszug.pdf"), s20 = soll["20"];
      pruefe(v20.format === "Trade Republic – Kontoauszug (PDF)" && v20.buchungen.length === s20.buchungen && /stimmt/.test(v20.hinweis || ""),
             `Fall 20: ${v20.format} ${v20.buchungen.length} „${v20.hinweis}“ ${v20.buchungen.map((b) => b.datum + " " + b.typ + " " + (b.stueck || b.betrag)).join(", ")}`);
      uebernehmen(v20, "Test 20");
      const st = (isin) => Object.values(bestand()).find((p) => p.instrument === isin)?.stueck;
      pruefe(nah(st("DE000TEST020"), s20.test_ag, 1e-9) && nah(st("IE000TEST203"), s20.etf, 1e-9) && nah(summe("realisiert"), s20.realisiert) && nah(summe("dividenden"), s20.dividenden),
             `Fall 20: Test AG ${st("DE000TEST020")} ETF ${st("IE000TEST203")} real ${summe("realisiert")} div ${summe("dividenden")}`);
      pruefe(nah(kontoStand()?.stand, s20.konto) && D.instrumente["DE000TEST020"]?.name === "TEST AG", `Fall 20: Konto ${kontoStand()?.stand} Name ${D.instrumente["DE000TEST020"]?.name}`);
    } catch (e) { pruefe(false, "Fall 20: " + e.message); }
    // 23 Einzel-Abrechnungen je Broker (ab 0.49): Typ, Stueck, Kurs, Endbetrag, Konto, Gegenprobe
    for (const [n, konto, typ, st, kurs, kasse, steuer] of [
      ["23a_scalable_kauf.pdf", "Scalable", "kauf", 12, 25.5, -306.99, 0], ["23b_smartbroker_verkauf.pdf", "Smartbroker", "verkauf", 20, 50, 969.63, 26.37],
      ["23c_baader_kauf.pdf", "Scalable", "kauf", 5, 80, -400.99, 0], ["23d_traderepublic_verkauf.pdf", "Trade Republic", "verkauf", 10, 120, 1146.25, 52.75],
      ["23e_revolut_kauf.pdf", "Revolut", "kauf", 4.5, 20, -90, 0]]) {
      try {
        const v = await lesePdf(n), b = v.buchungen[0];
        pruefe(v.konto === konto && b.typ === typ && nah(b.stueck, st, 1e-9) && nah(b.kurs, kurs, 1e-9) && nah(b.kasse, kasse) && nah(b.steuer, steuer) && /stimmt/.test(v.hinweis || "") && /TEST23/.test(b.isin),
               `Fall 23 ${n}: ${v.konto} ${b.typ} ${b.stueck} × ${b.kurs} = ${b.kasse} Steuer ${b.steuer} ${b.isin} „${v.hinweis}“`);
      } catch (e) { pruefe(false, `Fall 23 ${n}: ` + e.message); }
    }
    ui.vorschau = null; ui.importSchlange = null;
    for (const [n, wort] of [["16a_scan_ohne_text.pdf", "keinen lesbaren Text"], ["16b_passwort.pdf", "passwortgeschützt"]]) {
      ui.vorschau = null;
      await dateienEinlesen([await pdfDatei(n)]);
      pruefe(!ui.vorschau && !ui.zuordnung && document.getElementById("meldung").textContent.includes(wort), `Fall 16 ${n}: Meldung „${document.getElementById("meldung").textContent}“`);
    }
    ui.vorschau = null; ui.zuordnung = null; ui.importSchlange = null;
  }
  // 13 Bestand + aeltere Transaktionen -> Startbestand zurueckrechnen
  {
    await fall(13, "13a_bestand_stichtag.csv");
    const id13 = S.aktiv;
    ui.einfuehrung = null; ui.seite = "daten";
    ui.vorschau = erkennen(await datei("13b_aeltere_transaktionen.csv", T), "Transaktionsexport.csv"); ui.vorschau.ziel = id13; vorschauPruefen(ui.vorschau); zeichnen();
    pruefe(ui.vorschau.rueck === 3 && ui.vorschau.buchungen.every((b) => !b.ueberspringen), `Fall 13: ${ui.vorschau.rueck} zum Zurückrechnen, übersprungen ${ui.vorschau.buchungen.filter((b) => b.ueberspringen).length}`);
    vorschauUebernehmen(); oeffnen(id13);
    const e13 = D.buchungen.find((b) => b.typ === "einbuchung"), p13 = offen()[0];
    pruefe(e13 && nah(e13.stueck, soll["13"].anfang) && e13.datum === soll["13"]["anfang_datum"], `Fall 13: Anfang ${e13 && [e13.stueck, e13.datum]}`);
    pruefe(p13 && nah(p13.stueck, soll["13"].stueck) && nah(p13.einstand, soll["13"].einstand) && nah(summe("realisiert"), soll["13"].realisiert),
           `Fall 13: ${p13 && [p13.stueck, p13.einstand]} real ${summe("realisiert")}`);
  }
  for (const [nr, d, muster] of [[7, "07_leer_nur_kopfzeile.csv", /keine Buchungen/i]]) {
    let msg = "";
    try { erkennen(await datei(d, T), d); } catch (e) { msg = e.message; }
    pruefe(muster.test(msg), `Fall ${nr}: Meldung „${msg}“`);
  }
  // 9 Riesendatei
  const t0 = performance.now();
  const r9 = await fall(9, "09_riesendatei_20000_zeilen.csv");
  zeige("uebersicht"); ui.kalArt = "gv"; zeige("kalender"); ui.kalArt = null;
  const ms = performance.now() - t0;
  pruefe(D.buchungen.length === soll["9"].buchungen && nah(summe("realisiert"), soll["9"].realisiert, 0.05), `Fall 9: ${D.buchungen.length} Buchungen, ${summe("realisiert")}`);
  pruefe(ms < 20000, `Fall 9: zu langsam (${Math.round(ms)} ms)`);
  // 10 Kraken doppelt
  await fall(10, "10a_kraken_ledgers.csv");
  const r10 = await fall(10, "10b_kraken_trades.csv");
  const p10 = offen()[0];
  pruefe(r10.n === 0, `Fall 10: ${r10.n} doppelte Trades`);
  pruefe(p10 && nah(p10.stueck, 0.2, 1e-9) && nah(p10.einstand, soll["10"].einstand) && nah(summe("realisiert"), soll["10"].realisiert)
         && nah(kontoStand().stand, soll["10"].konto) && D.buchungen.length === soll["10"].buchungen, `Fall 10: ${p10 && [p10.stueck, p10.einstand]} ${summe("realisiert")} ${kontoStand()?.stand}`);
  // 25 Binance-Handelsverlauf (0.78): neues + altes Format, Sollwerte mit Python gerechnet (scratchpad soll_078.py)
  {
    const pos = (c) => offen().find((p) => p.instrument === c);
    const r25 = await fall(25, "25a_binance_handelsverlauf.csv"), b = pos("BTC"), e = pos("ETH");
    pruefe(b && nah(b.stueck, 0.00599, 1e-9) && nah(b.einstand, 359.4) && e && nah(e.stueck, 0.2, 1e-9) && nah(e.einstand, 500) && !pos("SOL") && nah(summe("realisiert"), 39.72),
           `Fall 25a Binance: n=${r25.n} BTC ${b && [b.stueck, b.einstand]} ETH ${e && e.einstand} SOL ${!!pos("SOL")} real ${summe("realisiert")}`);
    pruefe(D.buchungen.some((x) => /BNB/.test(x.notiz || "")), "Fall 25a Binance: Gebühr in BNB fehlt als Notiz");
    const r25b = await fall(26, "25b_binance_alt.csv"), a = pos("ADA");
    pruefe(a && nah(a.stueck, 599, 1e-9) && nah(a.einstand, 299.5) && nah(summe("realisiert"), 39.76), `Fall 25b Binance alt: n=${r25b.n} ADA ${a && [a.stueck, a.einstand]} real ${summe("realisiert")}`);
  }
  // 0.79 Tranchen: sofort (A) gegen Limit (B) + 2. Tranche - Testfall nur Testdaten (Sollwerte mit Python)
  {
    const v = vergleichRechnen({ art: "krypto", bestand: "0,005", einstand: "100.000", kurs: "60.000", budget: "500", limit: "50.250", limit2: "45.000", ziel: "70.000" });
    pruefe(v.A && v.A.einstand === 75000 && v.A.bestand === 0.01333333 && v.A.aenderungPct === -25 && v.B.einstand === 66888.52 && v.B.stueck === 0.00995025
           && v.B.aenderungPct === -33.11 && v.B2 && v.B2.einstand === 57556.47 && v.B2.kapital === 1000 && v.B2.einsatz === 1500 && v.diff.einstand === 8111.48
           && v.diff.stueckMehr === 0.00161692 && v.diff.wertMehr === 97.01 && v.ziel.markt === 900 && v.ziel.limit === 381.65 && v.ziel.diff === 518.35,
           `Tranchen-Vergleich: ${JSON.stringify(v)}`);
    const v2 = vergleichRechnen({ bestand: "0,005", einstand: "100.000", kurs: "60.000", budget: "500" });
    pruefe(v2.fehlt && v2.fehlt.length === 1, `Tranchen-Vergleich ohne Limit: ${JSON.stringify(v2)}`);
    const v3 = vergleichRechnen({ bestand: "0,005", einstand: "100.000", kurs: "60.000", budget: "500", limit: "65.000" });
    pruefe(v3.hinweise.length === 1 && v3.diff.einstand < 0, `Tranchen-Vergleich Limit über Kurs: ${JSON.stringify(v3.hinweise)}`);
    const n = nachkaufRechnen({ art: "krypto", bestand: "0,005", einstand: "100.000", kurs: "60.000", budget: "500", preisArt: "limit", limit: "50.250" });
    pruefe(!n.fehler.length && n.A.einstand === 66888.52 && n.kaufpreis === 50250 && n.A.wert === 897.01, `Nachkauf mit Limit-Kaufpreis: ${JSON.stringify(n.A)}`);
    const n2 = nachkaufRechnen({ bestand: "0,005", einstand: "100.000", kurs: "60.000", budget: "500", preisArt: "limit" });
    pruefe(n2.fehler.length === 1, "Nachkauf: Limit gewählt ohne Preis nicht abgefangen");
  }
  // 0.78 Fibonacci aus 4h-Kerzen
  {
    const fb = fibo4h(KERZEN_078);
    pruefe(fb && fb.hoch === 119.5 && fb.tief === 81.5 && fb.aufwaerts && nah(fb.stufen[4][1], 96.016, 1e-9) && nah(fb.stufen[2][1], 104.984, 1e-9)
           && nah(fb.pivot.P, 106.3333333, 1e-6) && nah(fb.pivot.R1, 110.1666667, 1e-6) && nah(fb.pivot.S1, 100.1666667, 1e-6) && fb.unterstuetzung === 81.5 && fb.widerstand === 112.5,
           `Fibonacci 4h: ${fb && JSON.stringify([fb.hoch, fb.tief, fb.aufwaerts, fb.stufen[4], fb.pivot, fb.unterstuetzung, fb.widerstand])}`);
    pruefe(fibo4h([]) === null && fibo4h(KERZEN_078.slice(0, 5)) === null, "Fibonacci 4h: zu wenige Kerzen nicht abgefangen");
  }
  // 21 Import ins falsche Depot (0.41): ganzen Import verschieben, einzelne Buchung zurueck, Import zuruecknehmen
  {
    const confirmAlt = window.confirm; window.confirm = () => true;
    const vorher = Object.keys(S.depots).length;
    await fall(21, "05_verkauft_und_neu_gekauft.csv");                       // landet in "Test 21"
    const a = S.aktiv, nA = D.buchungen.length, stA = offen()[0]?.stueck;
    const b = neueId("d"); S.depots[b] = neuesDepot("Test 21 richtig", "eigen");
    ui.seite = "buchungen"; ui.importWahl = null; zeichnen();
    const g = importGruppen();
    pruefe(g.length === 1 && g[0].n === nA && !!D.importe?.length, `Fall 21: Import-Gruppe ${g.length} / ${g[0]?.n} statt ${nA}`);
    document.querySelector(`#inhalt [data-import-wahl="${g[0].key}"]`).click();
    document.getElementById("import-ziel").value = b;
    document.querySelector(`#inhalt [data-import-verschieben="${g[0].key}"]`).click();
    pruefe(S.depots[a].buchungen.length === 0 && Object.keys(S.depots[a].instrumente).length === 0 && S.depots[b].buchungen.length === nA, `Fall 21: verschieben ${S.depots[a].buchungen.length} / ${S.depots[b].buchungen.length}`);
    oeffnen(b);
    pruefe(nah(offen()[0]?.stueck, stA, 1e-9) && nah(summe("realisiert"), soll["5"].realisiert), `Fall 21: Bestand nach Verschieben ${offen()[0]?.stueck} statt ${stA}`);
    // eine Buchung einzeln zurueck
    const eine = D.buchungen[0];
    ui.formular = { nr: eine.nr }; ui.seite = "buchungen"; zeichnen();
    document.getElementById("buchung-ziel").value = a;
    document.querySelector(`#inhalt [data-buchung-verschieben="${eine.nr}"]`).click();
    pruefe(S.depots[b].buchungen.length === nA - 1 && S.depots[a].buchungen.length === 1 && !!S.depots[a].instrumente[S.depots[a].buchungen[0].instrument], "Fall 21: Einzelbuchung verschieben");
    // Import zuruecknehmen
    ui.formular = null; ui.importWahl = null; zeichnen();
    const g2 = importGruppen();
    document.querySelector(`#inhalt [data-import-wahl="${g2[0].key}"]`).click();
    document.querySelector(`#inhalt [data-import-loeschen="${g2[0].key}"]`).click();
    pruefe(D.buchungen.length === 0 && Object.keys(D.instrumente).length === 0 && !(D.importe || []).length, `Fall 21: zurücknehmen ${D.buchungen.length} Buchungen übrig`);
    pruefe(Object.keys(S.depots).length === vorher + 2, "Fall 21: Depot-Anzahl");
    window.confirm = confirmAlt;
  }
  return f;
}

/** Klick-Test: jede Seite, jeden Knopf, jedes Formular, jeden Schalter - Fehler sammeln. */
async function klickTest(gross = false) {
  if (gross) {
    // grosser Stand: 6 Depots, 2 Jahre, Kursliste - wie beim Beta-Test
    localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
    const namen = ["1_kraken_krypto_halten_ledgers.csv", "2_bitvavo_krypto_sparplan.csv", "3_okx_krypto_handel.csv", "4_scalable_etf_sparplan.csv",
                   "5_smartbroker_einzelwerte.csv", "6_traderepublic_daytrading.csv", "7_kursliste_wochenkurse.csv"];
    await dateienEinlesen(await Promise.all(namen.map(async (n) => { const t = await datei(n, "grosstest/"); return { name: n, text: async () => t }; })));
    for (let k = 0; ui.vorschau && k < 20; k++) vorschauUebernehmen();
  } else await beispielStand();
  S.sachwerte = [{ id: "s1", name: "Laptop", art: "Technik", kaufdatum: "2025-01-01", kaufpreis: 1200, verlust: 25, wert: null }];
  S.watchlist = [{ id: "w1", name: "Testwert", kennung: "TEST", art: "Aktie", kurs: 10, kaufMarke: 9, verkaufMarke: 12, aufgenommen: "2026-01-01" }];
  S.notizen = [{ id: "n1", titel: "Plan", text: "x", datum: "2026-01-02T10:00:00Z", bezug: "",
                 rechner: { richtung: "short", einstieg: "93", hebel: "10", stop: "102,3", ziel: "77" } }];
  S.eigeneTermine = [{ id: "t1", datum: "2026-12-01", art: "Erinnerung", titel: "Test", depot: S.aktiv }];
  Object.values(S.depots)[1].person = "Partner";
  window.confirm = () => false; window.prompt = () => null; window.alert = () => {};
  const fehler = [];
  let wo = "";
  const fang = (e) => fehler.push(`${wo}: ${e.message || e.reason || e}`);
  window.addEventListener("error", fang); window.addEventListener("unhandledrejection", fang);
  const seiten = ["uebersicht", "positionen", "watchlist", "kalender", "news", "notizen", "mehr", "daten", "depots", "buchungen", "sicherheit",
                  "datenschutz", "einstellungen", "schluessel", "ki", "hinweise", "unterstuetzen", "sachwerte", "steuer", "feedback"];
  const SEL = "[data-ziel],[data-los],[data-ansicht],[data-person],[data-plus],[data-depot-edit],[data-kaltag],[data-kalmonat],[data-wertzeitraum]," +
              "[data-chartart],[data-aufteilung],[data-posansicht],[data-position],[data-notiz],[data-notiz-neu],[data-watch],[data-termin],[data-sachwert]," +
              "[data-einst],[data-steuerjahr],[data-rechner-auf],[data-kal],[data-kalart],[data-gvmonat],[data-newsfilter],[data-neu],[data-bearbeiten]," +
              "[data-rechner-richtung],[data-rechner-stop],[data-rechner-laden],[data-rechner-notiz],[data-depot],[data-chartart],[data-depot-leeren],[data-depot-weg]";
  const frisch = (sn) => { Object.assign(ui, { plus: null, depotEdit: null, sachwert: null, zuordnung: null, vorschau: null, einfuehrung: null }); zeige(sn); };
  const zurueckTaste = () => { for (let k = 0; k < 6 && window.zurueck(); k++); };
  let klicks = 0;
  for (const sn of seiten) {
    try { frisch(sn); } catch (e) { fehler.push(`Seite ${sn}: ${e.message}`); continue; }
    const n = document.querySelectorAll("#inhalt " + SEL.split(",").join(",#inhalt ")).length;
    for (let i = 0; i < n; i++) {
      try {
        frisch(sn);
        const el = document.querySelectorAll("#inhalt " + SEL.split(",").join(",#inhalt "))[i];
        if (!el) continue;
        wo = `${sn} › ${(el.textContent || el.outerHTML).trim().replace(/\s+/g, " ").slice(0, 40)}`;
        el.click(); klicks++;
        if (!document.getElementById("inhalt").innerHTML.trim()) fehler.push(`${wo}: leere Seite`);
        zeichnen(); zurueckTaste();
      } catch (e) { fehler.push(`${wo}: ${e.message}`); }
    }
    // Schalter/Auswahl umschalten und Formulare abschicken
    frisch(sn);
    for (const el of [...document.querySelectorAll("#inhalt select, #inhalt input[type=checkbox]")]) {
      try { wo = `${sn} › Schalter ${el.id || el.name || Object.keys(el.dataset)[0] || ""}`;
            if (el.tagName === "SELECT" && el.options.length > 1) el.selectedIndex = el.options.length - 1; else if (el.type === "checkbox") el.checked = !el.checked;
            el.dispatchEvent(new Event("change", { bubbles: true })); }
      catch (e) { fehler.push(`${wo}: ${e.message}`); }
    }
    frisch(sn);
    for (const id of [...document.querySelectorAll("#inhalt form")].map((f) => f.id).filter((x) => x && !/pin|pw-form|wiederherstellen/.test(x))) {
      try { frisch(sn); const f = document.getElementById(id); if (!f) continue; wo = `${sn} › Formular ${id}`;
            f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); zeichnen(); zurueckTaste(); }
      catch (e) { fehler.push(`${wo}: ${e.message}`); }
    }
  }
  await new Promise((r) => setTimeout(r, 300));
  if (klicks < 60) fehler.push(`nur ${klicks} Klicks – Test unvollständig?`);
  ui.klicks = klicks;
  return fehler;
}

/** Kalender: jeden Monat der 2 Jahre blaettern, jeden Tag mit Eintrag antippen, Summen pruefen. */
async function kalenderTest() {
  const soll = await (await fetch("grosstest/erwartet.json")).json(), f = [];
  localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
  const namen = ["1_kraken_krypto_halten_ledgers.csv", "2_bitvavo_krypto_sparplan.csv", "3_okx_krypto_handel.csv", "4_scalable_etf_sparplan.csv",
                 "5_smartbroker_einzelwerte.csv", "6_traderepublic_daytrading.csv", "7_kursliste_wochenkurse.csv"];
  await dateienEinlesen(await Promise.all(namen.map(async (n) => { const t = await datei(n, "grosstest/"); return { name: n, text: async () => t }; })));
  for (let k = 0; ui.vorschau && k < 20; k++) vorschauUebernehmen();
  ui.alle = true; ui.kalenderAlle = true; ui.kalArt = null;
  const alleIds = Object.keys(S.depots), ev = kalenderEreignisse(alleIds);
  // Kaeufe/Verkaeufe (0.38): je Tag+Wert+Richtung ein Eintrag, Stueck-Summe = Buchungen
  {
    const gruppen = new Set(), stSoll = {}, stIst = {};
    for (const id of alleIds) for (const b of S.depots[id].buchungen) if ((b.typ === "kauf" || b.typ === "verkauf") && b.datum) {
      gruppen.add(id + "|" + b.datum + "|" + b.instrument + "|" + b.typ); stSoll[b.typ] = (stSoll[b.typ] || 0) + (+b.stueck || 0); }
    const h = ev.filter((x) => x.art === "Kauf" || x.art === "Verkauf");
    if (h.length !== gruppen.size) f.push(`Kalender Käufe/Verkäufe: ${h.length} Einträge statt ${gruppen.size}`);
    for (const x of h) { const m = x.info.match(/([\d.,]+) Stück/); stIst[x.art === "Kauf" ? "kauf" : "verkauf"] = (stIst[x.art === "Kauf" ? "kauf" : "verkauf"] || 0) + (m ? zahl(m[1]) : 0); }
    for (const k of ["kauf", "verkauf"]) if (Math.abs((stIst[k] || 0) - (stSoll[k] || 0)) > 0.01 * Math.max(1, h.length)) f.push(`Kalender ${k}: ${stIst[k]} Stück statt ${stSoll[k]}`);
    if (ev.some((x) => x.art === "Ex-Dividende" && /nicht im Bestand/.test(x.info || ""))) f.push("Kommender Ex-Tag für verkauften Wert");
  }
  let divSumme = 0, tageGeklickt = 0, monate = 0;
  for (let m = new Date(Date.UTC(2024, 10, 1)); m <= new Date(Date.UTC(2026, 10, 1)); m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    const mon = m.toISOString().slice(0, 7);
    ui.kalMonat = mon; ui.kalTag = null; zeige("kalender"); ui.kalenderAlle = true; ui.kalMonat = mon; zeichnen(); monate++;
    const imMonat = ev.filter((x) => x.datum.startsWith(mon));
    const zeilen = document.querySelectorAll("#inhalt .karte.liste .zeile").length;
    if (zeilen !== imMonat.length) f.push(`${mon}: ${zeilen} Zeilen statt ${imMonat.length}`);
    const sollDiv = imMonat.filter((x) => x.sicher).reduce((a, x) => a + x.eur, 0);
    divSumme += sollDiv;
    const angezeigt = zahl(document.querySelector("#inhalt .kennzahlen b").textContent);
    if (Math.abs((angezeigt || 0) - sollDiv) > 0.01) f.push(`${mon}: Dividenden angezeigt ${angezeigt} statt ${sollDiv.toFixed(2)}`);
    // jeden Tag mit Eintrag antippen: Liste = Eintraege dieses Tages
    for (const tag of [...new Set(imMonat.map((x) => x.datum))]) {
      const knopf = document.querySelector(`#inhalt [data-kaltag="${tag}"]`);
      if (!knopf) { f.push(`${tag}: Tag fehlt im Raster`); continue; }
      knopf.click(); tageGeklickt++;
      const n = document.querySelectorAll("#inhalt .karte.liste .zeile").length, sollN = imMonat.filter((x) => x.datum === tag).length;
      if (n !== sollN) f.push(`${tag}: ${n} Einträge statt ${sollN}`);
      knopf.isConnected || document.querySelector(`#inhalt [data-kaltag="${tag}"]`)?.click();   // Auswahl wieder aufheben
      ui.kalTag = null; zeichnen();
    }
  }
  const sollGesamt = Object.values(soll.depots).reduce((a, d) => a + d.dividenden, 0);
  if (Math.abs(divSumme - sollGesamt) > 0.05) f.push(`Dividenden im Kalender ${divSumme.toFixed(2)} statt ${sollGesamt.toFixed(2)} (Python)`);
  // Gewinn/Verlust je Tag: alle Monate blaettern, Summe = realisiert TR (Python)
  ui.kalArt = "gv"; ui.kalenderAlle = false; oeffnen(Object.keys(S.depots).find((k) => S.depots[k].name === "Trade Republic"));
  let gvSumme = 0;
  for (let m = new Date(Date.UTC(2024, 10, 1)); m <= new Date(Date.UTC(2026, 10, 1)); m = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 1))) {
    ui.gvMonat = m.toISOString().slice(0, 7); zeige("kalender"); ui.kalArt = "gv"; ui.gvMonat = m.toISOString().slice(0, 7); zeichnen();
    gvSumme += Object.entries(gvJeTag([S.aktiv])).filter(([d]) => d.startsWith(ui.gvMonat)).reduce((a, [, x]) => a + x.gv, 0);
    if (!document.querySelector("#inhalt .gvraster")) f.push(`G/V ${ui.gvMonat}: kein Raster`);
  }
  if (Math.abs(gvSumme - soll.daytrading.summe) > 0.05) f.push(`G/V-Kalender Summe ${gvSumme.toFixed(2)} statt ${soll.daytrading.summe}`);
  ui.kalArt = null;
  if (tageGeklickt < 30) f.push(`nur ${tageGeklickt} Tage geklickt`);
  ui.kalBericht = `${monate} Monate, ${tageGeklickt} Tage, ${ev.length} Einträge`;
  return f;
}

/** Englisch (0.38): jede Seite in kleinen und grossen Daten, Leiste/Kopf/Mehr uebersetzt, kein deutscher Text uebrig
 *  (ausser eigenen Namen: Depots, Wertpapiere, Notizen, Sachwerte, Importtexte). */
const SPRACHE_ORIGINAL = window.sprache;
async function englischTest() {
  const f = [];
  window.sprache = () => "en";
  window.__fehlend = new Set();
  const seiten = ["uebersicht", "positionen", "watchlist", "kalender", "news", "notizen", "mehr", "daten", "depots", "buchungen", "sicherheit",
                  "datenschutz", "einstellungen", "schluessel", "ki", "hinweise", "unterstuetzen", "sachwerte", "steuer", "feedback"];
  const namen = new Set(["Google News", "Yahoo Finance", "Depot-Kompass", "https://…/rss", "Finnhub", "Twelve Data", "Financial Modeling Prep", "Alpha Vantage", ".dksafe"]);
  const namenMerken = () => {
    for (const d of Object.values(S.depots)) { namen.add(d.name); for (const i of Object.values(d.instrumente)) namen.add(i.name);
      for (const b of d.buchungen) { if (b.notiz) namen.add(b.notiz); } }
    for (const x of [...(S.notizen || []), ...(S.sachwerte || []), ...(S.watchlist || [])]) for (const v of Object.values(x)) if (typeof v === "string") namen.add(v);
  };
  for (const gross of [false, true]) {
    if (gross) {
      localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
      const namen = ["1_kraken_krypto_halten_ledgers.csv", "2_bitvavo_krypto_sparplan.csv", "3_okx_krypto_handel.csv", "4_scalable_etf_sparplan.csv",
                     "5_smartbroker_einzelwerte.csv", "6_traderepublic_daytrading.csv", "7_kursliste_wochenkurse.csv"];
      await dateienEinlesen(await Promise.all(namen.map(async (n) => { const t = await datei(n, "grosstest/"); return { name: n, text: async () => t }; })));
      for (let k = 0; ui.vorschau && k < 20; k++) vorschauUebernehmen();
    } else await beispielStand();
    S.sachwerte = [{ id: "s1", name: "Laptop", art: "Technik", kaufdatum: "2025-01-01", kaufpreis: 1200, verlust: 25, wert: null }];
    S.watchlist = [{ id: "w1", name: "Testwert", kennung: "TEST", art: "Aktie", kurs: 10, kaufMarke: 9, verkaufMarke: 12, aufgenommen: "2026-01-01" }];
    // 0.66: Marktstimmung mit Daten (Krypto alternative.me, Aktien VIX)
    S.stimmung = { stand: "2026-11-20T00:30:00Z", krypto: { wert: 12, stufe: "Extreme Angst", gestern: 10, woche: 28, monat: 55 }, vix: { wert: 28.44, d1: 15.8, d5: 30.1 } };
    S.notizen = [{ id: "n1", titel: "Plan", text: "x", datum: "2026-01-02T10:00:00Z", bezug: "", rechner: { richtung: "short", einstieg: "93", hebel: "10", stop: "102,3", ziel: "77" } }];
    S.notizen.push({ id: "n2", titel: "Plan", text: "x", datum: "2026-01-03T10:00:00Z", bezug: "", plan: { typ: "gewinn", daten: { art: "aktie", modus: "betrag", bestand: "3", einstand: "600", k1: "1.022", b1: "500" } } });
    localStorage.setItem("test-schluessel-openai", "sk-or-v1-abcdefabcdef1234"); (S.einstellungen.schluesselStatus ||= {}).openai = schluesselFormat("openai", "sk-or-v1-abcdefabcdef1234");
    ui.notiz = { id: "n2" }; try { zeichnen(); } catch (e) { f.push("Plan-Notiz: " + e.message); } ui.notiz = null;
    ui.nachkaufOffen = true; ui.nachkauf = { name: "Bitcoin", bestand: "0,005062", einstand: "98.972,23", kurs: "59.000", kursDatum: "2026-11-16", art: "krypto", budget: "500", ziel: "80.000", limit: "50.250", limit2: "45.000", ausstieg: "85000", trigger: "80000", gebuehrAn: true, gebuehr: "0,25" };
    ui.posgrOffen = true; ui.posgr = { art: "krypto", richtung: "long", einstieg: "59.000", stop: "56.050", maxverlust: "50", kapital: "5.000", ziel: "65.000", gebuehrAn: true, gebuehr: "0,25" }; ui.gewinnOffen = true; ui.gewinn = { name: "Bitcoin", art: "krypto", modus: "pct", bestand: "0,01353658", einstand: "73.947,61", k1: "80.000", a1: "50", k2: "90.000", a2: "25", gebuehrAn: true, gebuehr: "0,25" };
    S.einstellungen.eurUsd = { kurs: 1.0842, datum: "2026-11-16" }; ui.rechnerOffen = true; ui.rechner = { richtung: "long", einstieg: "100", hebel: "5" };
    for (const k of ["posgr", "gewinn", "nachkauf"]) { try { ui[k].waehrung = "usd"; zeige("notizen"); ui[k].waehrung = "eur"; } catch (e) { f.push("Dollar " + k + ": " + e.message); } }
    // 0.66: „Was ist neu“-Karte + Broker-Gebühren/Positionsgröße vorgeben im Rechner (auch übersetzt)
    WAS_NEU["Test"] = WAS_NEU["0.67"]; S.einstellungen.neuGesehen = "0.65";
    try { const altR = ui.rechner; ui.rechner = { einstieg: "57000", hebel: "3", richtung: "long", broker: "minifuture", koFix: "38000", basisFrei: { name: "Bitcoin USD", symbol: "BTC-USD", waehrung: "USD", punkte: [["2026-11-01", 60000], ["2026-11-08", 58000], ["2026-11-15", 57000]] }, basis: "frei" };
          ui.rechnerTreffer = [{ symbol: "BTC-USD", name: "Bitcoin USD", boerse: "CCC", art: "Cryptocurrency" }];
          for (const n of ["Bitcoin USD", "🔎 Bitcoin USD", "BTC-USD · USD", "BTC-USD · CCC · Cryptocurrency"]) namen.add(n);
          ui.notizReiter = "derivate"; zeige("notizen"); ui.rechner = Object.assign({}, ui.rechner, { broker: "zertifikat" }); zeichnen();
          ui.rechner = Object.assign({}, ui.rechner, { broker: "kraken", hebel: "20", koFix: "" }); zeichnen();
          ui.notizReiter = null; ui.rechnerTreffer = null; ui.rechner = altR; } catch (e) { f.push("Derivate-Reiter: " + e.message); }
    try { const alt = Object.assign({}, ui.posgr); Object.assign(ui.posgr, { gebuehrBroker: "sb_unicredit", risikoArt: "groesse", positionsgroesse: "250", waehrung: "eur" }); zeige("notizen");
          Object.assign(ui.posgr, { risikoArt: "eur", gebuehrBroker: "tr" }); zeige("notizen"); ui.posgr = alt; } catch (e) { f.push("Broker-Rechner: " + e.message); }
    ui.watch = "neu"; try { zeichnen(); } catch (e) { f.push("Watch-Formular: " + e.message); } ui.watch = null;
    // 0.62: Alarme - Reiter, Formular in allen vier Arten, Alarme im Watchlist-Eintrag
    try {
      S.alarme = [{ id: "ap", name: "Rücksetzer", bezug: "w:w1", art: "prozent", prozent: -10, basis: 10, an: true }, { id: "az", name: "Zone", bezug: "w:w1", art: "zone", von: 8, bis: 11, an: false }];
      ui.seite = "watchlist"; ui.watchReiter = "alarme"; ui.alarmImport = true; zeichnen(); ui.alarmImport = false;
      for (const art of ["unter", "ueber", "zone", "prozent"]) { ui.alarm = "neu"; ui.alarmEntwurf = { name: "", bezug: "w:w1", art, an: true }; zeichnen(); }
      ui.alarm = null; ui.alarmEntwurf = null; ui.watch = "w1"; zeichnen(); ui.watch = null; ui.watchReiter = null;
    } catch (e) { f.push("Alarme: " + e.message); }
    for (const p of positionen().liste.filter((x) => !x.ohneKurs).filter((x, n, l) => x === l.find((y) => y.gv < 0) || x === l.find((y) => y.gv > 0))) {
      ui.detail = p.id; try { zeichnen(); } catch (e) { f.push("Detail " + p.name + ": " + e.message); } }
    ui.detail = null;
    // 0.78: Krypto-Markt im Detail (ohne und mit Daten) + Depot-Anzeige in US-Dollar
    { const altA = S.aktiv; let kp = null;
      for (const dk of Object.keys(S.depots)) { oeffnen(dk); kp = positionen().liste.find((x) => kryptoKuerzel(D.instrumente[x.id])); if (kp) break; }
      if (kp) { const sym = kryptoKuerzel(D.instrumente[kp.id]), alt = S.kryptoMarkt; S.kryptoMarkt = {};
        try { ui.detail = kp.id; zeichnen(); if (!document.querySelector('[data-los="krypto-markt"]')) f.push("Krypto-Markt: Knopf fehlt im Detail");
              S.kryptoMarkt[sym] = kmTest(sym); zeichnen(); if (!document.querySelector("#inhalt .fibochart")) f.push("Krypto-Markt: Fibonacci-Chart fehlt");
              ui.verdeckt = true; zeichnen(); ui.verdeckt = false; } catch (e) { f.push("Krypto-Markt: " + e.message); }
        S.kryptoMarkt = alt; ui.detail = null; ui.verdeckt = false; } else if (gross) f.push("Krypto-Markt: kein Krypto-Wert im Testdepot");
      oeffnen(altA); }
    try { S.einstellungen.anzeigeWaehrung = "USD"; zeige("uebersicht"); const t = document.getElementById("inhalt").textContent;
          if (!/\$/.test(t)) f.push("USD-Anzeige: kein $ in der Übersicht"); zeige("einstellungen"); zeige("positionen"); }
    catch (e) { f.push("USD-Anzeige: " + e.message); }
    delete S.einstellungen.anzeigeWaehrung;
    // 0.80: Alarm-Ton je Wert - Karte, Auswahl gespeichert, Ton geht mit an den Waechter
    { const wAlt = S.watchlist, aAlt = S.alarme, tAlt = S.einstellungen.alarmToene;
      namen.add("Tonwert"); namen.add("Ton-Test"); namen.add("TON.DE");   // erfundene Testnamen, keine Oberflächentexte
      S.watchlist = [...(wAlt || []), { id: "wton", name: "Tonwert", kennung: "TON", art: "Aktie", kurs: 10, ticker: "TON.DE", aufgenommen: "2026-01-01" }];
      S.alarme = [...(aAlt || []), { id: "aton", name: "Ton-Test", bezug: "w:wton", art: "unter", wert: 9, an: true }];
      S.einstellungen.alarmToene = { "TON.DE": 3 };
      try { ui.seite = "watchlist"; ui.watchReiter = "alarme"; zeichnen();
            const sel = document.querySelector('[data-alarm-ton="TON.DE"]');
            if (!sel || sel.value !== "3") f.push("Alarm-Ton: Auswahl fehlt oder falsch (" + (sel && sel.value) + ")");
            const ww = wachterWerte().find((x) => x.ticker === "TON.DE");
            if (!ww || ww.ton !== 3) f.push("Alarm-Ton: Ton fehlt in den Wächter-Daten (" + JSON.stringify(ww && ww.ton) + ")");
            if (sel) { sel.value = "0"; sel.dispatchEvent(new Event("change", { bubbles: true })); }
            if ((S.einstellungen.alarmToene || {})["TON.DE"]) f.push("Alarm-Ton: Standard wählen hat den Ton nicht entfernt");
      } catch (e) { f.push("Alarm-Ton: " + e.message); }
      S.watchlist = wAlt; S.alarme = aAlt; S.einstellungen.alarmToene = tAlt; ui.watchReiter = null; zeige("uebersicht"); }
    // 0.79: KI ohne Schalter unsichtbar (Leiste + Mehr), mit Schalter sichtbar
    { const kiAlt = S.einstellungen.ki, kb = () => document.querySelector('#leiste [data-ziel="ki"]');
      S.einstellungen.ki = false; zeige("mehr");
      if (!kb()?.hidden || !document.getElementById("leiste").classList.contains("ohne-ki") || document.querySelector('#inhalt [data-ziel="ki"]')) f.push("KI aus: KI ist noch sichtbar (Leiste oder Mehr)");
      S.einstellungen.ki = true; zeige("mehr");
      if (kb()?.hidden || !document.querySelector('#inhalt [data-ziel="ki"]')) f.push("KI an: KI-Knopf oder Kachel fehlt");
      S.einstellungen.ki = kiAlt; zeige("uebersicht"); }
    for (const s of seiten) { ui.alle = undefined; try { zeige(s); } catch (e) { f.push(`${s}: ${e.message}`); } }
    ui.einfuehrung = 1; zeichnen(); ui.einfuehrung = 2; zeichnen(); ui.einfuehrung = 3; zeichnen(); ui.einfuehrung = null;
    ui.gesperrt = true; ui.pinBereit = true; ui.pinMeldung = "Falsche PIN – noch 3 Versuche bis zur Wartezeit."; try { zeichnen(); } catch (e) { f.push("PIN-Seite: " + e.message); }
    ui.gesperrt = false; ui.pinMeldung = ""; ui.pinBereit = false;
    namenMerken();
  }
  const leiste = [...document.querySelectorAll("#leiste .l")].map((x) => x.textContent).join(",");
  if (leiste !== "Overview,Positions,Calendar,News,Notes,AI") f.push("Leiste: " + leiste);
  zeige("mehr"); if (!/Settings/.test(document.getElementById("inhalt").textContent)) f.push("Mehr nicht englisch");
  // Umschalten per Antippen (0.39): auf der Mehr-Seite und in den Einstellungen, echte Einstellung statt Test-Ueberschreibung
  window.sprache = SPRACHE_ORIGINAL;
  // Sprachwahl NUR in den Einstellungen (Vorgabe 13.11.): nicht auf der Mehr-Seite, nicht in der Einfuehrung
  zeige("mehr"); if (document.querySelector('#inhalt [data-einst="sprache"]')) f.push("Sprachwahl steht noch auf der Mehr-Seite");
  ui.einfuehrung = 1; zeichnen(); if (document.querySelector('#inhalt [data-einst="sprache"]')) f.push("Sprachwahl steht noch in der Einführung"); ui.einfuehrung = null;
  for (const seite of ["einstellungen"]) {
    S.einstellungen.sprache = "de"; zeige(seite);
    document.querySelector('#inhalt [data-einst="sprache"][data-wert="en"]')?.click();
    const l1 = [...document.querySelectorAll("#leiste .l")].map((x) => x.textContent).join(",");
    if (S.einstellungen.sprache !== "en" || l1 !== "Overview,Positions,Calendar,News,Notes,AI") f.push(`${seite}: English antippen wirkt nicht (${l1})`);
    document.querySelector('#inhalt [data-einst="sprache"][data-wert="de"]')?.click();
    const l2 = [...document.querySelectorAll("#leiste .l")].map((x) => x.textContent).join(",");
    if (S.einstellungen.sprache !== "de" || l2 !== "Übersicht,Positionen,Kalender,News,Notizen,KI") f.push(`${seite}: zurück auf Deutsch wirkt nicht (${l2})`);
  }
  window.sprache = () => "en";
  const rest = [...window.__fehlend].filter((s) => /[a-zäöüß]{3}/.test(s) && ![...namen].some((n) => n && (s.includes(n) || n.includes(s))));
  window.sprache = () => "de";
  if (rest.length) f.push(`${rest.length} unübersetzt: ` + rest.slice(0, 8).map((s) => "„" + s.slice(0, 40) + "“").join(", "));
  return f;
}

/** Suche (0.55): Antworten wie im echten Suchtest vom 17.11.2026 (Yahoo per ISIN = London/USD, per WKN = Taiwan-Fehltreffer,
 *  Onvista = deutsches Kuerzel; Krypto ohne Euro-Paar). Erwartet: immer die Euro-Notierung, nie ".TWO". */
async function suchTest() {
  (S.einstellungen ||= {}).einfuehrung = 99; ui.einfuehrung = null;
  const f = [], q = (s, typ = "ETF", ex = "") => ({ symbol: s, quoteType: typ, exchange: ex, shortname: s });
  window.__suche = {
    onvista: { IE00B4L5Y983: [{ entityType: "FUND", isin: "IE00B4L5Y983", wkn: "A0RPWH", symbol: "EUNL", name: "iShares Core MSCI World UCITS ETF" }],
               A0RPWH: [{ entityType: "FUND", isin: "IE00B4L5Y983", wkn: "A0RPWH", symbol: "EUNL", name: "iShares Core MSCI World UCITS ETF" }],
               "716460": [{ entityType: "STOCK", isin: "DE0007164600", wkn: "716460", symbol: "SAP", name: "SAP SE" }],
               DE0005933931: [{ entityType: "FUND", isin: "DE0005933931", wkn: "593393", symbol: "EXS1", name: "iShares Core DAX UCITS ETF" }],
               JE00B1VS3333: [{ entityType: "DERIVATIVE", isin: "JE00B1VS3333", symbol: "16IA", name: "WisdomTree Physical Silver" }],
               "Münchener Rück": [{ entityType: "STOCK", isin: "DE0008430026", wkn: "843002", symbol: "MUV2", name: "Münchener Rückversicherungs-Gesellschaft" }] },
    yahoo: { IE00B4L5Y983: [q("IWDA.L")], "716460": [q("716460.TWO", "EQUITY")], DE0005933931: [], JE00B1VS3333: [q("JE00B1VS3333.SG", "ETF")],
             "SAP SE": [q("SAP.DE", "EQUITY"), q("SAP", "EQUITY")], NEAR: [q("NEAR-USD", "CRYPTOCURRENCY"), q("WNEAR-USD", "CRYPTOCURRENCY")],
             HYPE: [q("HYPE32196-USD", "CRYPTOCURRENCY")], "Münchener Rück": [] },
    kurse: { "EUNL.DE": [95.1, "EUR"], "IWDA.L": [143, "USD"], "SAP.DE": [213.4, "EUR"], "EXS1.DE": [219.2, "EUR"], "JE00B1VS3333.SG": [38.7, "EUR"],
             "MUV2.DE": [591.6, "EUR"], "BTC-EUR": [58647, "EUR"], "NEAR-USD": [2.1, "USD"], "HYPE32196-USD": [31, "USD"] } };
  const soll = async (wert, erwartet, was) => { const r = await wert; if (r !== erwartet) f.push(`${was}: ${r} statt ${erwartet}`); };
  await soll(tickerSuchen({ isin: "IE00B4L5Y983", art: "ETF" }), "EUNL.DE", "ETF per ISIN (statt London IWDA.L)");
  await soll(tickerSuchen({ isin: "DE0005933931", art: "ETF" }), "EXS1.DE", "iShares Core DAX (Yahoo findet nichts)");
  await soll(tickerSuchen({ isin: "JE00B1VS3333", art: "ETC" }), "JE00B1VS3333.SG", "ETC ohne Xetra-Kurs -> Stuttgart");
  await soll(watchTicker({ kennung: "716460", art: "Aktie" }), "SAP.DE", "WKN SAP (nicht Taiwan 716460.TWO)");
  await soll(watchTicker({ kennung: "a0rpwh", art: "ETF" }), "EUNL.DE", "WKN klein geschrieben");
  await soll(tickerSuchen({ isin: "BTC", art: "Krypto" }), "BTC-EUR", "Krypto mit Euro-Paar");
  await soll(tickerSuchen({ isin: "NEAR", art: "Krypto" }), "NEAR-USD", "NEAR ohne Euro-Paar (nicht WNEAR)");
  await soll(tickerSuchen({ isin: "HYPE", art: "Krypto" }), "HYPE32196-USD", "HYPE ohne Euro-Paar");
  // Trefferliste in der Watchlist: Onvista-Vorschlag vorne, nie .TWO
  zeige("watchlist"); ui.watch = "neu"; ui.watchEntwurf = { name: "", kennung: "716460", art: "Aktie" }; zeichnen();
  await tickerTreffer();
  const tr = (ui.treffer || []).map((x) => x.symbol);
  if (tr[0] !== "SAP.DE" || tr.some((s) => /\.TWO$/.test(s))) f.push("Trefferliste WKN: " + tr.join(","));
  ui.watchEntwurf = { name: "Münchener Rück", kennung: "", art: "Aktie" }; zeichnen(); await tickerTreffer();
  if ((ui.treffer || [])[0]?.symbol !== "MUV2.DE") f.push("Trefferliste Name Münchener Rück: " + (ui.treffer || []).map((x) => x.symbol).join(","));
  // Krypto-Reparatur beim Aktualisieren: vorhandener NEAR-EUR-Ticker wird einmal geprueft und ersetzt
  ui.watch = null; ui.treffer = null; window.__suche = null;
  return f;
}

/** Zertifikate (0.42): Eintragen von Hand mit WKN bzw. ISIN, dann "Kurse & Daten aktualisieren" -> Onvista (Attrappe). */
async function zertifikatTest() {
  const f = [], pruefe = (ok, text) => { if (!ok) f.push(text); };
  if (!APP?.onvistaSuche) return ["Attrappe fehlt"];
  localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
  const eintragen = (name, kennung, art) => {
    ui.formular = {}; ui.seite = "buchungen"; zeichnen();
    const form = document.getElementById("buchung-form"), setz = (n, w) => { form.elements[n].value = w; };
    setz("typ", "kauf"); setz("datum", "2026-11-10"); setz("instrument", name); setz("kennung", kennung); setz("wertart", art);
    setz("stueck", "100"); setz("kurs", "4,50"); setz("gebuehr", "1");
    form.dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  };
  eintragen("Nvidia Turbo Long", "BE0F1P", "Zertifikat");              // nur WKN
  await new Promise((r) => setTimeout(r, 50));
  const i = Object.values(D.instrumente)[0];
  pruefe(i?.art === "Zertifikat" && i?.wkn === "BE0F1P", `Zertifikat angelegt: ${JSON.stringify(i)}`);
  await kurseAktualisieren();
  pruefe(i?.kurs === 5.57 && i?.isin === "DE000BE0F1P5" && i?.onvistaArt === "BOND" && /Onvista/.test(i?.kursQuelle || "") && i?.kursDatum === "2026-11-12",
         `Zertifikat-Kurs: ${JSON.stringify(i)}`);
  pruefe(!window.__aufrufe.some((a) => a.startsWith("suche:")), "Yahoo-Tickersuche für Zertifikat sollte ausbleiben: " + window.__aufrufe.join(","));
  const p = positionen().liste[0];
  pruefe(p && nah(p.wert, 557) && nah(p.gv, 557 - 451), `Position: Wert ${p?.wert} G/V ${p?.gv}`);
  // Earnings (0.43): vergangener Termin mit Auswertung, kommender Termin, Aktualisieren ueber die Attrappe
  {
    const iid = "US0000TEST01"; D.instrumente[iid] = { name: "Earnings AG", isin: iid, art: "Aktie", ticker: "EARN" };
    D.buchungen.push({ nr: 99, typ: "kauf", datum: "2025-01-02", instrument: iid, konto: "", stueck: 10, kurs: 100, gebuehr: 0, steuer: 0, quelle: "von Hand" });
    D.instrumente[iid].termine = { earnings: ["2099-02-10"], earningsGewesen: ["2026-10-29"], quartale: [], finanzen: [], stand: "2026-10-01" };
    let ev = kalenderEreignisse([S.aktiv]).filter((x) => x.art === "Earnings");
    pruefe(ev.length === 2 && ev.some((x) => x.datum === "2026-10-29" && /noch nicht geladen/.test(x.info)), "Earnings: vergangener Termin fehlt: " + JSON.stringify(ev));
    ui.detail = null; ui.formular = null; ui.seite = "kalender"; ui.kalArt = null; ui.kalMonat = "2026-10"; ui.kalTag = null; zeichnen();
    const knopf = document.querySelector(`#inhalt [data-earnings="${S.aktiv}|${iid}|2026-10-29"]`);
    pruefe(!!knopf, "Earnings-Knopf fehlt: " + [...document.querySelectorAll("#inhalt [data-earnings]")].map((k) => k.dataset.earnings).join(",") + " Seite " + ui.seite + " Monat " + ui.kalMonat + " " + document.querySelector("#inhalt h2")?.textContent);
    knopf?.click();
    pruefe(/Noch keine Auswertung/.test(document.getElementById("inhalt").textContent), "Earnings-Karte ohne Hinweis: " + JSON.stringify(ui.earnings));
    window.__earnings = { quartale: [{ quarter: { fmt: "2026-09-30" }, epsActual: { raw: 1.25 }, epsEstimate: { raw: 1.1 }, surprisePercent: { raw: 0.1364 } }] };
    document.querySelector("#inhalt [data-earnings-neu]")?.click();
    await new Promise((r) => setTimeout(r, 300));
    const txt = document.getElementById("inhalt").textContent;
    pruefe(/1,25/.test(txt) && /1,1/.test(txt) && /13,64/.test(txt), "Earnings nach Aktualisieren: " + txt.slice(txt.indexOf("Earnings"), txt.indexOf("Earnings") + 200));
    ev = kalenderEreignisse([S.aktiv]).filter((x) => x.art === "Earnings" && x.datum === "2026-10-29");
    pruefe(/Ergebnis je Aktie 1,25 \(erwartet 1,1\)/.test(ev[0]?.info || ""), "Earnings-Info im Kalender: " + ev[0]?.info);
    ui.earnings = null;
    delete D.instrumente[iid]; D.buchungen = D.buchungen.filter((b) => b.nr !== 99);
  }
  // zweites Aktualisieren: keine neue Suche mehr (Art + ISIN gemerkt)
  const vorher = window.__aufrufe.filter((a) => a.startsWith("onvistaSuche")).length;
  await kurseAktualisieren();
  pruefe(window.__aufrufe.filter((a) => a.startsWith("onvistaSuche")).length === vorher, "Zweites Aktualisieren sucht erneut");
  return f;
}

/** Originale + ZIP-Export (0.44): Import legt Original ab, neu einlesen ohne Doppel, Export-Verzeichnis, Zuruecknehmen raeumt auf,
 *  Wiederherstellen aus ZIP (Attrappe statt Java). */
async function originaleTest() {
  const f = [], pruefe = (ok, text) => { if (!ok) f.push(text); };
  if (!APP?.originalAblegen) return ["Attrappe fehlt"];
  localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
  window.confirm = () => true;
  const datei_ = async (n, als) => new File([await (await fetch("testfaelle/" + n)).arrayBuffer()], als || n);
  await dateienEinlesen([await datei_("05_verkauft_und_neu_gekauft.csv", "TR Export März.csv")]);
  const k = document.getElementById("vorschau-konto"); if (k) { k.value = "Test 23"; k.dispatchEvent(new Event("change", { bubbles: true })); }
  ui.seite = "daten"; zeichnen(); vorschauUebernehmen();
  oeffnen(Object.entries(S.depots).find(([, d]) => d.name === "Test 23")?.[0] || S.aktiv);
  const n0 = D.buchungen.length, o0 = S.originale?.[0], altImp = o0?.importId;
  pruefe(S.originale?.length === 1 && o0.name === "TR Export März.csv" && o0.typ === "CSV" && o0.depot === S.aktiv && Object.keys(window.__ablage).length === 1, "Original nicht abgelegt: " + JSON.stringify(S.originale));
  pruefe(D.buchungen.every((b) => b.importId === o0.importId), "Original nicht dem Import zugeordnet");
  // PDF und Screenshot ebenfalls
  await dateienEinlesen([await datei_("17_bank_zweizeiliger_kopf.pdf")]); if (ui.vorschau) { ui.vorschau.ziel = S.aktiv; ui.vorschau.zielGewaehlt = true; vorschauPruefen(ui.vorschau); ui.seite = "daten"; zeichnen(); vorschauUebernehmen(); }
  pruefe(S.originale.length === 2 && S.originale[1].typ === "PDF", "PDF-Original fehlt");
  // neu einlesen: gleiche Buchungen, kein zweites Original
  ui.seite = "buchungen"; ui.importWahl = altImp; zeichnen();
  const neuKnopf = document.querySelector(`#inhalt [data-import-neu="${altImp}"]`);
  pruefe(!!neuKnopf, "Neu-einlesen-Knopf fehlt: seite " + ui.seite + " detail " + ui.detail + " formular " + JSON.stringify(ui.formular) + " vorschau " + !!ui.vorschau + " | " + document.querySelector("#inhalt h2")?.textContent + " | Gruppen " + importGruppen().map((g) => g.key).join(",") + " wahl " + ui.importWahl);
  neuKnopf?.click();
  await new Promise((r) => setTimeout(r, 300));
  if (ui.vorschau) { ui.vorschau.ziel = S.aktiv; ui.vorschau.zielGewaehlt = true; vorschauPruefen(ui.vorschau); ui.seite = "daten"; zeichnen(); vorschauUebernehmen(); }
  const o1 = S.originale.find((o) => o.id === o0.id);
  pruefe(S.originale.length === 2 && Object.keys(window.__ablage).length === 2 && o1 && o1.importId !== altImp && !D.buchungen.some((b) => b.importId === altImp) && D.buchungen.filter((b) => b.importId === o1.importId).length === n0,
         `Neu einlesen: ${S.originale.length} Originale, Ablage ${Object.keys(window.__ablage).length}, Buchungen ${D.buchungen.filter((b) => b.importId === o1?.importId).length} statt ${n0}`);
  // Export: Pfade nach Depot sortiert, alle Kennungen
  zipExportieren();
  const ix = window.__zip?.index || [];
  pruefe(ix.length === 2 && ix.every((x) => x.pfad.startsWith("originale/Test 23/") && window.__ablage[x.id]) && /TR Export März\.csv$/.test(ix[0].pfad) && /LIESMICH|Wiederherstellen/.test(window.__zip.liesmich),
         "ZIP-Verzeichnis: " + JSON.stringify(ix.map((x) => x.pfad)));
  // Zuruecknehmen loescht das Original
  const imp = o1.importId;
  ui.seite = "buchungen"; ui.importWahl = imp; zeichnen();
  document.querySelector(`#inhalt [data-import-loeschen="${imp}"]`)?.click();
  pruefe(S.originale.length === 1 && !window.__ablage[o0.id] && !D.buchungen.some((b) => b.importId === imp), "Zurücknehmen räumt Original nicht auf");
  // Wiederherstellen aus ZIP: falsches Passwort, dann richtiges
  window.__zipDaten = JSON.stringify({ depots: { d9: neuesDepot("Aus ZIP", "eigen") }, aktiv: "d9", einstellungen: { einfuehrung: 99 }, originale: [{ id: "o1abcdef12", name: "a.pdf" }] });
  ui.wiederherstellen = { zip: "UEsDBA==", name: "export.zip" }; zeichnen();
  const form = () => document.getElementById("wiederherstellen-form");
  form().elements.pw.value = "falsch"; form().dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  pruefe(!!ui.wiederherstellen && /Falsches Passwort/.test(document.getElementById("meldung").textContent), "Falsches ZIP-Passwort nicht gemeldet");
  form().elements.pw.value = "richtig"; form().dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  pruefe(!ui.wiederherstellen && S.depots.d9?.name === "Aus ZIP" && S.originale?.length === 1, "ZIP-Wiederherstellen: " + Object.keys(S.depots));
  // ZIP-Datei im Import wird erkannt
  ui.wiederherstellen = null;
  await dateienEinlesen([new File([new Uint8Array([0x50, 0x4b, 3, 4, 1, 2, 3])], "Depot-Kompass-Export-2026-11-13.zip")]);
  pruefe(ui.wiederherstellen?.zip && /Verschlüsselte ZIP/.test(document.getElementById("inhalt").textContent), "ZIP-Datei im Import nicht erkannt: wh " + JSON.stringify(ui.wiederherstellen) + " | " + document.getElementById("meldung").textContent + " | " + document.querySelector("#inhalt h2")?.textContent);
  ui.wiederherstellen = null;
  return f;
}

/** Screenshots (0.42): erfundene TR-Screenshots per Texterkennung, danach Wochen-Export ersetzt sie. Echte Zeit noetig (cdp_lauf.py). */
async function screenshotTest() {
  const f = [], soll = (await (await fetch("testfaelle/erwartet.json")).json())["22"];
  const pruefe = (ok, text) => { if (!ok) f.push(text); };
  localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
  const bild = async (n) => new File([await (await fetch("testfaelle/" + n)).blob()], n.replace(/^\d+[a-z]_/, ""), { type: "image/png" });
  const vorschau = [];
  for (const n of ["22a_Screenshot_20260315-123506_Trade Republic.png", "22b_Screenshot_20260320-201113_Trade Republic.png"]) {
    await dateienEinlesen([await bild(n)]);
    const v = ui.vorschau;
    pruefe(!!v, `Fall 22 ${n}: keine Vorschau – ${document.getElementById("meldung").textContent}`);
    if (!v) continue;
    vorschau.push(v.buchungen[0]);
    pruefe(/stimmt/.test(v.hinweis || ""), `Fall 22 ${n}: Gegenprobe „${v.hinweis}“`);
    const k = document.getElementById("vorschau-konto"); if (k) { k.value = "Test 22"; k.dispatchEvent(new Event("change", { bubbles: true })); }
    ui.seite = "daten"; zeichnen(); vorschauUebernehmen();
  }
  const [k1, k2] = vorschau;
  pruefe(k1?.typ === "kauf" && k1?.datum === soll.datum_kauf && nah(k1?.stueck, 4, 1e-9) && nah(k1?.kurs, 125) && nah(k1?.gebuehr, 1) && nah(k1?.kasse, -501), `Fall 22 Kauf: ${JSON.stringify(k1)}`);
  pruefe(k2?.typ === "verkauf" && k2?.datum === soll.datum_verkauf && nah(k2?.stueck, 1.5, 1e-9) && nah(k2?.kurs, 130) && nah(k2?.kasse, 194), `Fall 22 Verkauf: ${JSON.stringify(k2)}`);
  pruefe(k2?.isin === instrumentId(k1?.isin, k1?.name, false) || namePasst(k1?.name, k2?.name), "Fall 22: Verkauf nicht dem gekauften Wert zugeordnet");
  oeffnen(Object.entries(S.depots).find(([, d]) => d.name === "Test 22")?.[0] || S.aktiv);
  const pos = () => Object.values(bestand()).filter((p) => p.stueck > 1e-9);
  const real = () => Object.values(bestand()).reduce((a, p) => a + p.realisiert, 0);
  pruefe(pos().length === 1 && nah(pos()[0].stueck, soll.stueck, 1e-9) && nah(pos()[0].einstand, soll.einstand) && nah(real(), soll.realisiert),
         `Fall 22 nach Screenshots: ${pos().map((p) => p.stueck + "/" + p.einstand)} real ${real()}`);
  // Wochen-Export mit denselben Trades (ISIN) ins selbe Depot
  const csv = await (await fetch("testfaelle/22c_traderepublic_export.csv")).text();
  ui.vorschau = erkennen(csv, "export.csv"); ui.vorschau.ziel = S.aktiv; ui.vorschau.zielGewaehlt = true; vorschauPruefen(ui.vorschau);
  ui.seite = "daten"; zeichnen(); vorschauUebernehmen();
  pruefe(D.buchungen.length === 2 && !D.buchungen.some((b) => b.screenshot) && pos().length === 1 && pos()[0].instrument === "DE000TEST221" && nah(pos()[0].stueck, soll.stueck, 1e-9),
         `Fall 22 nach Export: ${D.buchungen.length} Buchungen, Screenshot übrig ${D.buchungen.filter((b) => b.screenshot).length}, Positionen ${pos().map((p) => p.instrument + " " + p.stueck)}`);
  // 24 Screenshots anderer Broker (ab 0.49): Scalable (hell), Smartbroker+ (dunkel, Aktivität), Revolut (englisch)
  for (const [n, typ, name, st, kurs, kasse, datum, isin] of [
    ["24a_Screenshot_20261108-101800_Scalable.png", "kauf", "Test Industrie AG", 15, 42, -630.99, "2026-11-08", "DE000TEST241"],
    ["24b_Screenshot_20261109-140500_Smartbroker.png", "verkauf", "Test Pharma SE", 40, 18.5, 736, "2026-11-09", "DE000TEST242"],
    ["24c_Screenshot_20261110-091200_Revolut.png", "kauf", "Test Robotics Inc", 3, 150, -450, "2026-11-10", ""],
    ["24d_Screenshot_20261111-080000_Kraken.png", "kauf", "Bitcoin", 0.01, 60000, -601.5, "2026-11-11", ""],
    ["24e_Screenshot_20261112-190000_Bitvavo.png", "kauf", "Cardano", 500, 0.4, -200.5, "2026-11-12", ""]]) {
    ui.vorschau = null;
    await dateienEinlesen([await bild(n)]);
    const v = ui.vorschau, b = v?.buchungen?.[0];
    pruefe(b && b.typ === typ && namePasst(name, b.name) && nah(b.stueck, st, 1e-9) && nah(b.kurs, kurs) && nah(b.kasse, kasse) && b.datum === datum && (!isin || b.isin === isin) && /stimmt/.test(v.hinweis || ""),
           `Fall 24 ${n}: ${JSON.stringify(b)} „${v?.hinweis}“ ${document.getElementById("meldung").textContent}`);
  }
  ui.vorschau = null;
  // Short-Zertifikat per Screenshot (0.43): Art Zertifikat, Richtung short, KI sagt "Short"
  await dateienEinlesen([await bild("22d_Screenshot_20260321-101500_Trade Republic.png")]);
  const vs = ui.vorschau, bs = vs?.buchungen?.[0];
  pruefe(bs && bs.art === "Zertifikat" && bs.richtung === "short" && nah(bs.stueck, 50, 1e-9) && nah(bs.kasse, -251) && /Short/.test(vs.hinweis || ""), `Fall 22 Short: ${JSON.stringify(bs)} „${vs?.hinweis}“`);
  if (vs) { vs.ziel = S.aktiv; vs.zielGewaehlt = true; vorschauPruefen(vs); ui.seite = "daten"; zeichnen(); vorschauUebernehmen(); }
  const inst = Object.values(D.instrumente).find((i) => /Turbo Short/i.test(i.name));
  pruefe(inst?.richtung === "short" && inst?.art === "Zertifikat", `Fall 22 Short-Wert: ${JSON.stringify(inst)}`);
  pruefe(/Test Turbo Short \(Zertifikat\): Short, Einstiegskurs/.test(kiDaten("check")), "KI kennt Short nicht: " + kiDaten("check").split("\n").find((z) => /Turbo/.test(z)));
  // Namensbeispiele
  for (const [n, r] of [["NVIDIA Turbo Short", "short"], ["VONTOBEL TURBOP O.END NVIDIA 224,83", "short"], ["DAX Mini Long", "long"], ["Call Optionsschein SAP", "long"],
                        ["Put auf Tesla", "short"], ["Siemens Energy", null], ["Faktor 5x Short Gold", "short"], ["Longevity AG", null]])
    pruefe(richtungAusName(n) === r, `Richtung „${n}“: ${richtungAusName(n)} statt ${r}`);
  return f;
}

/** Nur zum Durchlesen: sichtbarer Text aller Seiten (tests/texte.sh). */
async function texteSammeln() {
  await beispielStand();
  S.sachwerte = [{ id: "s1", name: "Laptop", art: "Technik", kaufdatum: "2025-01-01", kaufpreis: 1200, verlust: 25, wert: null }];
  const aus = [];
  const seiten = ["uebersicht", "positionen", "watchlist", "kalender", "news", "notizen", "mehr", "daten", "depots", "buchungen", "sicherheit",
                  "datenschutz", "einstellungen", "schluessel", "ki", "hinweise", "unterstuetzen", "sachwerte", "steuer", "feedback"];
  for (const sn of seiten) { ui.alle = undefined; zeige(sn); aus.push("=== " + sn + "\n" + document.getElementById("inhalt").innerText); }
  ui.einfuehrung = 1; zeichnen(); aus.push("=== einfuehrung 1\n" + document.getElementById("inhalt").innerText);
  ui.einfuehrung = 2; zeichnen(); aus.push("=== einfuehrung 2\n" + document.getElementById("inhalt").innerText);
  ui.einfuehrung = 3; zeichnen(); aus.push("=== einfuehrung 3\n" + document.getElementById("inhalt").innerText);
  ui.einfuehrung = null; ui.plus = "depot"; zeige("uebersicht"); ui.plus = "depot"; zeichnen(); aus.push("=== plus\n" + document.getElementById("inhalt").innerText);
  ui.depotEdit = S.aktiv; zeichnen(); aus.push("=== bearbeiten\n" + document.getElementById("inhalt").innerText);
  const pre = document.createElement("pre"); pre.id = "texte"; pre.textContent = aus.join("\n\n"); document.body.appendChild(pre);
  return [];
}

/** Seitenmodus fuer den Rahmen: Seite zeigen, Ueberlauf messen. */
async function seitePruefen(q) {
  if (q.get("gross")) {                 // grosser erfundener Bestand (6 Depots) - fuer Bildschirmfotos der Webseite
    localStorage.clear(); S = leererGesamtstand(); S.einstellungen.einfuehrung = 99; oeffnen("d1"); ui.einfuehrung = null;
    const namen = ["1_kraken_krypto_halten_ledgers.csv", "2_bitvavo_krypto_sparplan.csv", "3_okx_krypto_handel.csv", "4_scalable_etf_sparplan.csv",
                   "5_smartbroker_einzelwerte.csv", "6_traderepublic_daytrading.csv", "7_kursliste_wochenkurse.csv"];
    await dateienEinlesen(await Promise.all(namen.map(async (n) => { const t = await datei(n, "grosstest/"); return { name: n, text: async () => t }; })));
    for (let k = 0; ui.vorschau && k < 20; k++) vorschauUebernehmen();
    ui.alle = true;
  } else await beispielStand();
  if (q.get("ki")) { S.einstellungen.ki = true; S.einstellungen.kiModelle = ["meta-llama/llama-3.3-70b-instruct:free"]; S.einstellungen.kiModell = S.einstellungen.kiModelle[0]; }
  // KI-Chat (ab 0.46): erfundenes Beispiel-Gespraech fuer die Layout-Pruefung (Chat, Beispiele, Verlauf)
  if (q.get("kichat")) { S.einstellungen.ki = true; S.kiChats = [{ id: "k1", titel: "Earnings auswerten · Alpha AG", anbieter: "anthropic", modell: "beispiel-modell-mit-sehr-langem-namen-2026",
    erstellt: "2026-11-15T10:00:00Z", nachrichten: [{ rolle: "nutzer", daten: true, text: "Die neuesten Quartalszahlen sind draußen …\n\nWert: Alpha AG (Aktie)" },
    { rolle: "ki", text: "## Kurzfazit\nDas Ergebnis je Aktie lag **12 % über der Erwartung**. Umsatz und Gewinn wachsen seit vier Quartalen.\n\n- Chance: Margen steigen\n- Risiko: hohe Bewertung\n\nKeine Anlageberatung – die Entscheidung liegt bei dir." },
    { rolle: "nutzer", text: "Was bedeutet das für meinen Einstieg bei 52,70?" },
    { rolle: "fehler", text: "Zu viele Anfragen oder Kontingent aufgebraucht. Bitte kurz warten oder ein anderes Modell wählen." }] }]; ui.kiChatId = "k1"; }
  if (q.get("kireiter")) ui.kiReiter = q.get("kireiter");
  // Depot teilen / geteiltes Depot empfangen (ab 0.47)
  if (q.get("teilen")) ui.depotTeilen = S.aktiv;
  if (q.get("empfang")) ui.depotEmpfang = { depot: { name: "Depot einer anderen Person mit langem Namen", instrumente: D.instrumente, buchungen: D.buchungen }, erstellt: "2026-11-15T10:00:00Z" };
  // Analysten-Karte (ab 0.46): erfundene Werte an der ersten Aktie, Detailansicht offen
  if (q.get("analysten")) { const [id, i] = Object.entries(D.instrumente).find(([, x]) => (x.art || "Aktie") === "Aktie") || [];
    if (i) { i.kurs = 100; i.termine = { ...(i.termine || {}), stand: "2026-11-15", analysten: { mittel: 125.5, median: 120, hoch: 180, tief: 80, anzahl: 31, empfehlung: "buy", wert: 1.8,
      verteilung: { starkKaufen: 8, kaufen: 15, halten: 6, verkaufen: 1, starkVerkaufen: 1 },
      historie: [{ datum: "2026-11-12", haus: "Beispielbank Research International", von: "Hold", zu: "Buy", ziel: 130, zielVorher: 95 }, { datum: "2026-11-02", haus: "Musterhaus", von: "Buy", zu: "Buy", ziel: 110, zielVorher: 110 }] } };
      window.__analystenId = id; } }
  S.sachwerte = [{ id: "s1", name: "Spiegelreflexkamera mit Objektiv und Zubehör", art: "Technik", kaufdatum: "2024-03-01", kaufpreis: 2899.99, verlust: 25, wert: null },
                 { id: "s2", name: "Goldbarren 100 g", art: "Edelmetall (physisch)", kaufdatum: "2023-05-01", kaufpreis: 6100, verlust: 0, wert: 11250 }];
  if (q.get("heat")) ui.posAnsicht = "heatmap";
  if (q.get("rechner")) { ui.rechnerOffen = true; ui.rechner = { einstieg: "18.540,25", hebel: "12,5", stop: "17.900", ziel: "19.800", einsatz: "2500", richtung: "long" }; }
  if (q.get("nachkauf")) { ui.nachkaufOffen = true; ui.nachkauf = { name: "Bitcoin", bestand: "0,005062", einstand: "98.972,23", kurs: "59.000", kursDatum: "2026-11-16", art: "krypto", budget: "500", ziel: "80.000", limit: "50.250", limit2: "45.000", ausstieg: "85000", trigger: "80000", gebuehrAn: true, gebuehr: "0,25" }; }
  if (q.get("rechner3")) { ui.posgrOffen = true; ui.posgr = { art: "krypto", richtung: "long", einstieg: "59.000", stop: "56.050", maxverlust: "50", kapital: "5.000", ziel: "65.000", gebuehrAn: !!q.get("gebuehr"), gebuehr: "0,25" }; ui.gewinnOffen = true; ui.gewinn = { name: "Bitcoin", art: "krypto", modus: "pct", bestand: "0,01353658", einstand: "73.947,61", k1: "80.000", a1: "50", k2: "90.000", a2: "25", gebuehrAn: true, gebuehr: "0,25" }; }
  if (q.get("betrag")) { ui.gewinnOffen = true; ui.gewinn = { name: "Rheinmetall", art: "aktie", modus: "betrag", bestand: "3", einstand: "600", k1: "1.022", b1: "500", k2: "1.200", b2: "800", gebuehrAn: !!q.get("gebuehr"), gebuehr: "0,25" }; }
  if (q.get("ampel")) { for (const [d, k] of [["openai", "sk-or-v1-abcdefabcdef1234"], ["anthropic", "sk-ant-api03-abcdefabcdef1234"], ["finnhub", "abcdefabcdef1234abcdef"]]) {
      localStorage.setItem("test-schluessel-" + d, k); (S.einstellungen.schluesselStatus ||= {})[d] = schluesselFormat(d, k); }
    S.einstellungen.schluesselStatus.finnhub = { s: "ok", t: "Gültig – vom Dienst bestätigt." }; }
  if (q.get("plannotiz")) { S.notizen = [{ id: "n9", titel: "Rheinmetall Gewinnmitnahme", text: "Einstand 600", datum: "2026-11-16T10:00:00Z", bezug: "",
      plan: { typ: "gewinn", daten: { art: "aktie", modus: "betrag", bestand: "3", einstand: "600", k1: "1.022", b1: "500", k2: "1.200", b2: "800" } } }]; }
  if (q.get("dollar")) { S.einstellungen.eurUsd = { kurs: 1.0842, datum: "2026-11-16" }; for (const k of ["posgr", "gewinn", "nachkauf"]) if (ui[k]) ui[k].waehrung = "usd"; }
  if (q.get("alarme")) {
    S.watchlist = [{ id: "w1", name: "Rheinmetall", kennung: "703000", ticker: "RHM.DE", art: "Aktie", kurs: 1488.5, aufgenommen: "2026-11-01" },
                   { id: "w2", name: "Bitcoin", kennung: "BTC", ticker: "BTC-EUR", art: "Krypto", kurs: 79120, aufgenommen: "2026-11-01" }];
    S.alarme = [{ id: "a1", name: "Kaufzone", bezug: "w:w1", art: "zone", von: 1380, bis: 1420, an: true }, { id: "a2", name: "Stop", bezug: "w:w1", art: "unter", wert: 1300, an: true },
                { id: "a3", name: "Ziel 1", bezug: "w:w1", art: "ueber", wert: 1650, an: true }, { id: "a4", name: "Rücksetzer", bezug: "w:w2", art: "prozent", prozent: -10, basis: 82000, an: true },
                { id: "a5", name: "Ausbruch", bezug: "w:w2", art: "ueber", wert: 78000, an: true }];
    ui.watchReiter = "alarme";
    if (q.get("alarme") === "form") { ui.alarm = "neu"; ui.alarmEntwurf = { name: "Kaufzone 2", bezug: "w:w1", art: "zone", von: 1250, bis: 1300, an: true }; }
  }
  if (q.get("einzeln")) ui.alle = false;
  if (q.get("plus")) ui.plus = q.get("plus");
  if (q.get("bearbeiten")) ui.depotEdit = S.aktiv;
  if (q.get("dunkel")) { S.einstellungen.design = "schwarz"; designAnwenden(); }
  if (q.get("kal")) { ui.kalArt = "gv"; ui.gvMonat = "2026-01"; }
  zeige(q.get("seite"));
  if (q.get("plannotiz")) { ui.notiz = { id: "n9" }; zeichnen(); }
  if (q.get("bedetail")) { const l = positionen().liste.filter((p) => !p.ohneKurs && p.einstand > 0); const p = q.get("bedetail") === "minus" ? l.find((x) => x.gv < 0) : l.find((x) => x.gv > 0);
    if (p) { ui.detail = p.id; zeichnen(); const d = document.querySelector(".be-karte details"); if (d) d.open = true; } }
  // Bildschirmfotos: Inhalt nach oben schieben statt rollen (Rollen wird im Aufnahme-Modus nicht gezeichnet); Kopf und Leiste bleiben stehen
  if (q.get("zu")) { const el = /^[.#\[]/.test(q.get("zu")) ? document.querySelector(q.get("zu")) : document.getElementById(q.get("zu")), inh = document.getElementById("inhalt");
    if (el && inh) inh.style.marginTop = -(el.getBoundingClientRect().top - inh.getBoundingClientRect().top - (+q.get("hoch") || 20)) + "px"; }
  if (window.__analystenId) { ui.detail = window.__analystenId; zeichnen(); }
  if (q.get("schrift")) document.body.style.zoom = q.get("schrift") / 100;
  await new Promise((r) => setTimeout(r, 200));
  const breit = innerWidth, zu = [];
  for (const el of document.querySelectorAll("body *")) {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > breit + 1 || r.left < -1) && getComputedStyle(el).position !== "fixed")
      zu.push((el.className || el.tagName) + "=" + (el.textContent || "").trim().slice(0, 20));
  }
  // Abgeschnittener Text (… oder Zeilen-Begrenzung) - ausser News-Titeln nirgends erlaubt
  for (const el of document.querySelectorAll("#inhalt *")) {
    const cs = getComputedStyle(el);
    if (el.closest(".zeile.news") || !el.childNodes.length) continue;
    const kurz = (cs.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 1) ||
                 (cs.webkitLineClamp && cs.webkitLineClamp !== "none" && el.scrollHeight > el.clientHeight + 1);
    if (kurz) zu.push("ABGESCHNITTEN " + (el.className || el.tagName) + "=" + (el.textContent || "").trim().slice(0, 30));
  }
  return { scroll: document.documentElement.scrollWidth - breit, zu: zu.slice(0, 3) };
}

(async () => {
  const q = new URLSearchParams(location.search);
  let text;
  if (q.get("sammeln")) { window.__textSammler = new Set(); window.__fehlend = new Set(); }
  if (q.get("sprache")) { const l = q.get("sprache"); window.sprache = () => l; }
  try {
    if (q.get("modus") === "kalender") {
      const f = await kalenderTest();
      text = f.length ? "FEHLER " + f.slice(0, 12).join(" ; ") : "OK";
      if (q.get("zahl")) text += " · " + ui.kalBericht;
    } else if (q.get("modus") === "klicken") {
      const f = await klickTest(!!q.get("gross"));
      text = f.length ? "FEHLER " + [...new Set(f)].slice(0, 15).join(" ; ") : "OK";
      if (q.get("zahl")) text += " · " + ui.klicks + " Klicks";
    } else if (q.get("modus") === "originale") {
      const f = await originaleTest();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
    } else if (q.get("modus") === "suche") {
      const f = await suchTest();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
    } else if (q.get("modus") === "zertifikat") {
      const f = await zertifikatTest();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
    } else if (q.get("modus") === "screenshot") {
      const f = await screenshotTest();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
    } else if (q.get("modus") === "englisch") {
      const f = await englischTest();
      text = f.length ? "FEHLER " + f.slice(0, 12).join(" ; ") : "OK";
    } else if (q.get("modus") === "texte") {
      await texteSammeln(); text = "OK";
    } else if (q.get("modus") === "mehrfach") {
      const f = await mehrfachTest();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
      if (q.get("zeit")) text += " · " + ui.messung;
    } else if (q.get("modus") === "faelle") {
      const f = await faelleTest();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
    } else if (q.get("modus") === "gross") {
      const f = await grossTest();
      text = f.length ? "FEHLER " + f.slice(0, 12).join(" ; ") : "OK";
    } else if (q.get("modus") === "seite") {
      const r = await seitePruefen(q);
      text = r.scroll > 0 || r.zu.length ? `FEHLER ueberlauf ${r.scroll}px ${r.zu.join(" | ")}` : "OK";
    } else {
      const f = await rechnen();
      text = f.length ? "FEHLER " + f.join(" ; ") : "OK";
    }
  } catch (e) { text = "FEHLER Absturz: " + e.message + " @ " + String(e.stack || "").split("\n").slice(1, 4).join(" | "); }
  if (window.__textSammler) { const pre = document.createElement("pre"); pre.id = "sammlung"; pre.textContent = JSON.stringify({ texte: [...window.__textSammler], fehlend: [...window.__fehlend] }); document.body.append(pre); }
  document.title = "TEST " + text;
  if (parent !== window) parent.postMessage("TEST " + text, "*");
})();
