"use strict";
/* Texterkennung offline (ab 0.42, Vorgabe 13.11.2026: Screenshots von Buchungen einlesen).
 *
 * Tesseract (Apache-2.0) als WebAssembly + deutsche Sprachdaten liegen in assets/ocr/ und werden
 * erst beim ersten Bild nachgeladen (App-Start bleibt schnell). Kein Netz, kein Worker, keine Google-Dienste.
 *
 *   const text = await bildText(datei)      datei = File/Blob (PNG, JPG, WebP)
 */
const OCR_ORDNER = (/\/tests\/_[a-z]+\//.test(location.pathname) ? "../../assets/" : location.pathname.includes("/tests/") ? "../assets/" : "") + "ocr/";
let ocrBereit = null;

function skriptLaden(pfad) {
  return new Promise((ok, fehler) => {
    if (document.querySelector(`script[data-ocr="${pfad}"]`)) return ok();
    const s = document.createElement("script");
    s.src = OCR_ORDNER + pfad; s.dataset.ocr = pfad;
    s.onload = () => ok(); s.onerror = () => fehler(new Error("Texterkennung fehlt in der App (" + pfad + ")"));
    document.head.append(s);
  });
}

async function gunzip(b) {
  const ds = new DecompressionStream("gzip"), w = ds.writable.getWriter();
  w.write(b).catch(() => {}); w.close().catch(() => {});
  return new Uint8Array(await new Response(ds.readable).arrayBuffer());
}

function ocrLaden() {
  return ocrBereit ??= (async () => {
    await skriptLaden("tesseract-core-lstm.wasm.js");
    await skriptLaden("ocr_deu.js");
    const M = await TesseractCore({});
    const gz = Uint8Array.from(atob(OCR_DEU_GZ_B64), (c) => c.charCodeAt(0));
    M.FS.writeFile("/deu.traineddata", await gunzip(gz));
    const api = new M.TessBaseAPI();
    if (api.Init(null, "deu", 1) === -1) throw new Error("Texterkennung konnte nicht starten.");
    return { M, api };
  })().catch((e) => { ocrBereit = null; throw e; });
}

/** Bild vorbereiten: Graustufen, dunkler Hintergrund -> umdrehen (schwarze Schrift auf Weiss), kleine Bilder vergroessern. */
async function bildVorbereiten(datei) {
  const bm = await createImageBitmap(datei);
  const f = bm.width < 1300 ? 2 : 1;                     // kleine/graue Schrift wird so deutlich sicherer erkannt
  const c = document.createElement("canvas");
  c.width = bm.width * f; c.height = bm.height * f;
  const g = c.getContext("2d", { willReadFrequently: true });
  g.drawImage(bm, 0, 0, c.width, c.height);
  const d = g.getImageData(0, 0, c.width, c.height), p = d.data;
  let summe = 0;
  for (let i = 0; i < p.length; i += 4) summe += 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
  const dunkel = summe / (p.length / 4) < 110;
  // Schwarz-Weiss: alles, was sich deutlich vom Hintergrund abhebt, wird Schrift - auch die GRAUEN Beschriftungen
  // (Trade Republic: "Verkaufen", "Steuer", Stueckzahl "3,320494 ×" sind grau auf schwarz).
  for (let i = 0; i < p.length; i += 4) {
    let y = 0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2];
    if (dunkel) y = 255 - y;
    y = y < 205 ? 0 : 255;
    p[i] = p[i + 1] = p[i + 2] = y; p[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const blob = await new Promise((ok) => c.toBlob(ok, "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

async function bildText(datei) {
  const { M, api } = await ocrLaden();
  M.FS.writeFile("/input", await bildVorbereiten(datei));
  if (api.SetImageFile(1, 0) === 1) throw new Error("Bild nicht lesbar.");
  api.SetVariable("tessedit_pageseg_mode", "4");          // eine Spalte mit unterschiedlich grossem Text
  api.Recognize(null);
  const text = api.GetUTF8Text();
  api.Clear();
  return text || "";
}
