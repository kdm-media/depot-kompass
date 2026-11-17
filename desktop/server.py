#!/usr/bin/env python3
"""Depot-Kompass Desktop (Linux & Windows per Docker) - dieselbe Oberflaeche wie die Android-App.

Der Server ersetzt die Android-Schnittstelle (window.Android):
  - Daten, Schluessel und Original-Dokumente liegen nur in /daten, verschluesselt (AES-256-GCM).
    Mit App-PIN: Hauptschluessel mit PBKDF2-SHA256(PIN) eingepackt; ohne PIN: Schluesseldatei im Datenordner.
  - Sicherungen (.dksafe) im gleichen Format wie die App - Handy <-> PC austauschbar.
  - Netz nur auf Knopfdruck und nur zu festen Adressen (Yahoo, Onvista, Google News, KI-Anbieter).
  - Nur 127.0.0.1, jede API-Anfrage braucht den Kopf X-Depot-Kompass (kein Zugriff von fremden Webseiten).
Kein Konto, kein Online-Login.
"""
import base64
import hashlib
import http.cookiejar
import json
import os
import re
import secrets
import shutil
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

ASSETS = Path(os.environ.get("ASSETS", "/app/assets"))
DATEN = Path(os.environ.get("DATEN", "/daten"))
PORT = int(os.environ.get("PORT", "8098"))
def _version():
    """Versionsnummer aus dem AndroidManifest (gleicher Stand wie die App), sonst VERSION-Variable."""
    if os.environ.get("VERSION"):
        return os.environ["VERSION"]
    try:
        import re
        m = re.search(r'versionName="([^"]+)"', Path(os.environ.get("MANIFEST", "/app/AndroidManifest.xml")).read_text(encoding="utf-8"))
        return (m.group(1) + " Desktop") if m else "Desktop"
    except OSError:
        return "Desktop"
VERSION = _version()
RUNDEN = 200000
BEHALTEN = 10
DATEN.mkdir(parents=True, exist_ok=True)
(DATEN / "originale").mkdir(exist_ok=True)
(DATEN / "sicherungen").mkdir(exist_ok=True)

# ------------------------------------------------------------ Zustand
EINST = DATEN / "einstellungen.json"
haupt = None            # entsperrter Hauptschluessel (nur im Speicher)
zuletzt_aktiv = time.time()


def einst() -> dict:
    try:
        return json.loads(EINST.read_text(encoding="utf-8"))
    except Exception:
        return {}


def einst_setzen(**w):
    e = einst()
    e.update(w)
    tmp = EINST.with_suffix(".neu")
    tmp.write_text(json.dumps(e), encoding="utf-8")
    tmp.replace(EINST)


def b64(b: bytes) -> str: return base64.b64encode(b).decode()
def unb64(s: str) -> bytes: return base64.b64decode(s)


def pbkdf2(pw: str, salz: bytes, runden: int = RUNDEN) -> bytes:
    return hashlib.pbkdf2_hmac("sha256", pw.encode(), salz, runden, 32)


def einpacken(k: bytes, daten: bytes) -> bytes:
    iv = secrets.token_bytes(12)
    return iv + AESGCM(k).encrypt(iv, daten, None)


def auspacken(k: bytes, roh: bytes) -> bytes:
    return AESGCM(k).decrypt(roh[:12], roh[12:], None)


def pin_aktiv() -> bool:
    return "pinHuelle" in einst()


def schluessel_holen():
    """Hauptschluessel: mit PIN nur nach dem Entsperren, ohne PIN aus der Schluesseldatei (wird beim ersten Start angelegt)."""
    global haupt
    if haupt is not None:
        return haupt
    if pin_aktiv():
        return None
    f = DATEN / "schluessel.key"
    if not f.exists():
        f.write_bytes(secrets.token_bytes(32))
        os.chmod(f, 0o600)
    haupt = f.read_bytes()
    return haupt


def datei_lesen(name: str):
    k = schluessel_holen()
    f = DATEN / name
    if k is None or not f.exists():
        return None
    return auspacken(k, f.read_bytes())


def datei_schreiben(name: str, daten: bytes) -> bool:
    k = schluessel_holen()
    if k is None:
        return False
    f = DATEN / name
    tmp = f.with_name(f.name + ".neu")
    tmp.write_bytes(einpacken(k, daten))
    tmp.replace(f)
    return True


def alles_umschluesseln(alt: bytes, neu: bytes):
    """Beim Ein-/Ausschalten der PIN: alle verschluesselten Dateien mit dem neuen Schluessel neu schreiben."""
    dateien = [p for p in [DATEN / "depot.bin", DATEN / "api-schluessel.bin"] if p.exists()] + list((DATEN / "originale").glob("*.bin"))
    for p in dateien:
        klar = auspacken(alt, p.read_bytes())
        p.write_bytes(einpacken(neu, klar))


# ------------------------------------------------------------ API-Schluessel (KI usw.)
def api_schluessel() -> dict:
    roh = datei_lesen("api-schluessel.bin")
    return json.loads(roh) if roh else {}


def api_schluessel_setzen(m: dict) -> bool:
    return datei_schreiben("api-schluessel.bin", json.dumps(m).encode())


# ------------------------------------------------------------ Sicherung (.dksafe, wie Sicherung.java)
def sicherung_verschluesseln(text: str, pw: str) -> str:
    salz, iv = secrets.token_bytes(16), secrets.token_bytes(12)
    daten = AESGCM(pbkdf2(pw, salz)).encrypt(iv, text.encode(), None)
    return json.dumps({"format": "depot-kompass-sicherung", "version": 1, "kdf": "PBKDF2-SHA256", "runden": RUNDEN,
                       "erstellt": datetime.now().strftime("%Y-%m-%dT%H:%M:%S"), "salz": b64(salz), "iv": b64(iv), "daten": b64(daten)},
                      separators=(",", ":"))


def sicherung_entschluesseln(datei: str, pw: str):
    try:
        d = json.loads(datei)
        return AESGCM(pbkdf2(pw, unb64(d["salz"]), int(d["runden"]))).decrypt(unb64(d["iv"]), unb64(d["daten"]), None).decode()
    except Exception:
        return None


# ------------------------------------------------------------ Netz (nur feste Ziele)
KEKSE = http.cookiejar.CookieJar()
OEFFNER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(KEKSE))
crumb_wert = None
ERLAUBT = re.compile(r"^https://([a-z0-9-]+\.)*(yahoo\.com|onvista\.de|news\.google\.com|openrouter\.ai|anthropic\.com|openai\.com|googleapis\.com)(/|$)")


def holen(adresse: str, methode="GET", koerper=None, koepfe=None, timeout=20):
    if not ERLAUBT.match(adresse):
        raise ValueError("Adresse nicht erlaubt")
    req = urllib.request.Request(adresse, data=koerper, method=methode, headers={"User-Agent": "Mozilla/5.0", **(koepfe or {})})
    try:
        with OEFFNER.open(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def netz_aus() -> bool:
    return bool(einst().get("netzAus", False))


def crumb():
    global crumb_wert
    if crumb_wert:
        return crumb_wert
    try:
        holen("https://fc.yahoo.com")
    except Exception:
        pass
    _, c = holen("https://query2.finance.yahoo.com/v1/test/getcrumb")
    c = c.strip()
    if not c or len(c) > 40 or "<" in c:
        raise ValueError("kein crumb")
    crumb_wert = c
    return c


def netz_abruf(art: str, a: list) -> str:
    """Wie MainActivity.abrufen: Antwort roh (leer = keine Verbindung)."""
    global crumb_wert
    if netz_aus():
        return ""
    q = urllib.parse.quote
    if art == "kurs":
        u = f"https://query1.finance.yahoo.com/v8/finance/chart/{q(a[0], safe='')}?range=5d&interval=1d"
    elif art == "suche":
        u = f"https://query1.finance.yahoo.com/v1/finance/search?quotesCount=10&newsCount=0&q={q(a[0])}"
    elif art == "verlauf":
        u = f"https://query1.finance.yahoo.com/v8/finance/chart/{q(a[0], safe='')}?range=1y&interval=1wk&events=div"
    elif art == "yahooNews":
        u = f"https://query1.finance.yahoo.com/v1/finance/search?quotesCount=0&newsCount=10&q={q(a[0])}"
    elif art == "googleNews":
        u = "https://news.google.com/rss/search?hl=de&gl=DE&ceid=DE:de&q=" + q('"' + a[0] + '"')
    elif art == "onvistaSuche":
        if not a[0].strip() or len(a[0]) > 80:
            return ""
        u = "https://api.onvista.de/api/v1/instruments/query?limit=5&searchValue=" + q(a[0].strip())
    elif art == "onvistaKurs":
        if not re.fullmatch(r"[A-Z_]{2,20}", a[0]) or not re.fullmatch(r"[A-Z]{2}[A-Z0-9]{9}[0-9]", a[1]):
            return ""
        u = f"https://api.onvista.de/api/v1/instruments/{a[0]}/ISIN:{a[1]}/snapshot"
    elif art == "modelle":
        u = "https://openrouter.ai/api/v1/models"
    elif art == "rss":
        # eigene RSS-Quellen: nur https, Antwort roh - hier bewusst ohne Zielliste (vom Nutzer eingetragen)
        if not a[0].startswith("https://") or len(a[0]) > 500:
            return ""
        req = urllib.request.Request(a[0], headers={"User-Agent": "Mozilla/5.0"})
        try:
            with urllib.request.urlopen(req, timeout=20) as r:
                return r.read(3_000_000).decode("utf-8", "replace")
        except Exception:
            return ""
    elif art == "termine":
        for versuch in (1, 2):
            try:
                u = (f"https://query2.finance.yahoo.com/v10/finance/quoteSummary/{q(a[0], safe='')}"
                     f"?modules=calendarEvents,earnings,earningsHistory,summaryDetail,financialData,recommendationTrend,upgradeDowngradeHistory&crumb={q(crumb())}")
                st, t = holen(u)
                if st < 400:
                    return t
                crumb_wert = None
            except Exception:
                crumb_wert = None
        return ""
    else:
        return ""
    try:
        st, t = holen(u)
        return t if st < 400 else ""
    except Exception:
        return ""


def ki_anfrage(anbieter: str, modell: str, koerper: str) -> str:
    """Wie MainActivity.kiAnfrage - Schluessel setzt erst der Server ein."""
    def fehler(msg): return json.dumps({"error": {"message": msg}})
    if netz_aus():
        return fehler("Internet ist in der App ausgeschaltet")
    liste = not koerper
    k = api_schluessel().get(anbieter)
    if k is None and not (liste and anbieter == "openrouter"):
        return fehler("kein Schluessel")
    if modell and not re.fullmatch(r"[A-Za-z0-9._:/-]{1,120}", modell):
        return fehler("ungueltiges Modell")
    if anbieter == "openrouter":
        u = "https://openrouter.ai/api/v1/models" if liste else "https://openrouter.ai/api/v1/chat/completions"
    elif anbieter == "openai":
        u = "https://api.openai.com/v1/models" if liste else "https://api.openai.com/v1/chat/completions"
    elif anbieter == "anthropic":
        u = "https://api.anthropic.com/v1/models?limit=100" if liste else "https://api.anthropic.com/v1/messages"
    elif anbieter == "google":
        if not liste and not re.fullmatch(r"[A-Za-z0-9._-]{1,80}", modell or ""):
            return fehler("ungueltiges Modell")
        u = ("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200" if liste
             else f"https://generativelanguage.googleapis.com/v1beta/models/{modell}:generateContent")
    else:
        return fehler("unbekannter Anbieter")
    kopf = {"Accept": "application/json"}
    if k:
        if anbieter == "anthropic":
            kopf.update({"x-api-key": k, "anthropic-version": "2023-06-01"})
        elif anbieter == "google":
            kopf["x-goog-api-key"] = k
        else:
            kopf["Authorization"] = "Bearer " + k
    if anbieter == "openrouter":
        kopf["X-Title"] = "Depot-Kompass"
    if not liste:
        kopf["Content-Type"] = "application/json"
    try:
        st, t = holen(u, "GET" if liste else "POST", None if liste else koerper.encode(), kopf, timeout=180)
    except Exception as e:
        return fehler(re.sub(r"[^\w .:-]", "", str(e)))
    if st >= 400:
        try:
            return json.dumps({"status": st, "roh": json.loads(t)})
        except Exception:
            return json.dumps({"status": st, "roh": {}})
    return t


# ------------------------------------------------------------ Bruecken-Funktionen (synchron, wie @JavascriptInterface)
def status() -> dict:
    e = einst()
    return {"sperre": pin_aktiv(), "schutz": False, "pin": pin_aktiv(), "netzAus": netz_aus(), "sperreNach": e.get("sperreNach", 60),
            "geraetGesichert": True, "passwort": "sicherung" in (api_schluessel() if schluessel_holen() else {}),
            "ordner": "Datenordner/sicherungen", "letzte": e.get("letzteSicherung", 0), "datei": e.get("letzteDatei", ""), "desktop": True}


def jetzt_sichern() -> str:
    pw = api_schluessel().get("sicherung")
    if not pw:
        return "kein Passwort"
    roh = datei_lesen("depot.bin")
    if roh is None:
        return "keine Daten"
    name = "Depot-Kompass-Sicherung-" + datetime.now().strftime("%Y-%m-%d_%H-%M") + ".dksafe"
    (DATEN / "sicherungen" / name).write_text(sicherung_verschluesseln(roh.decode(), pw), encoding="utf-8")
    alte = sorted((DATEN / "sicherungen").glob("*.dksafe"))
    for p in alte[:-BEHALTEN]:
        p.unlink()
    einst_setzen(letzteSicherung=int(time.time() * 1000), letzteDatei=name)
    return "ok:" + name


def bruecke(name: str, a: list):
    global haupt
    if name == "laden":
        if pin_aktiv() and haupt is None:
            return "\u0000GESPERRT"
        roh = datei_lesen("depot.bin")
        return roh.decode() if roh else ""
    if name == "sichern":
        # Schutz gegen alte Tabs: nur speichern, wenn der Tab den aktuellen Stand kennt (Revision)
        rev = einst().get("rev", 0)
        if len(a) > 1 and a[1] is not None and int(a[1]) != rev:
            return {"veraltet": True}
        if not datei_schreiben("depot.bin", a[0].encode()):
            return False
        einst_setzen(rev=rev + 1)
        return {"rev": rev + 1}
    if name == "revision":
        return einst().get("rev", 0)
    if name == "version":
        return VERSION
    if name == "sicherheitStatus":
        return json.dumps(status())
    if name == "netzSetzen":
        einst_setzen(netzAus=bool(a[0]))
        return True
    if name == "sperreNachSetzen":
        einst_setzen(sperreNach=int(a[0]))
        return True
    if name == "pinSetzen":
        pin = str(a[0])
        if not re.fullmatch(r"\d{6}", pin):
            return False
        alt = schluessel_holen()
        if alt is None:
            return False
        neu = alt if pin_aktiv() else secrets.token_bytes(32)
        salz = secrets.token_bytes(16)
        huelle = einpacken(pbkdf2(pin, salz), neu)
        if not pin_aktiv():
            alles_umschluesseln(alt, neu)
            (DATEN / "schluessel.key").unlink(missing_ok=True)
        einst_setzen(pinHuelle=b64(huelle), pinSalz=b64(salz), fehlversuche=0)
        haupt = neu
        return True
    if name == "pinPruefen":
        e, jetzt = einst(), time.time()
        if jetzt < e.get("sperreBis", 0):
            return f"warten:{int(e['sperreBis'] - jetzt) + 1}"
        try:
            haupt = auspacken(pbkdf2(str(a[0]), unb64(e["pinSalz"])), unb64(e["pinHuelle"]))
            einst_setzen(fehlversuche=0)
            return "ok"
        except Exception:
            f = e.get("fehlversuche", 0) + 1
            pause = 30 * (1 << min(f - 5, 6)) if f >= 5 else 0
            einst_setzen(fehlversuche=f, **({"sperreBis": jetzt + pause} if pause else {}))
            return f"warten:{pause}" if pause else f"falsch:{5 - f}"
    if name == "sperreAufheben":
        e = einst()
        try:
            k = auspacken(pbkdf2(str(a[0]), unb64(e["pinSalz"])), unb64(e["pinHuelle"]))
        except Exception:
            return False
        neu = secrets.token_bytes(32)
        alles_umschluesseln(k, neu)
        f = DATEN / "schluessel.key"
        f.write_bytes(neu)
        os.chmod(f, 0o600)
        e = einst()
        for x in ("pinHuelle", "pinSalz"):
            e.pop(x, None)
        EINST.write_text(json.dumps(e), encoding="utf-8")
        haupt = neu
        return True
    if name == "allesLoeschen":
        for p in DATEN.iterdir():
            shutil.rmtree(p) if p.is_dir() else p.unlink()
        (DATEN / "originale").mkdir(exist_ok=True)
        (DATEN / "sicherungen").mkdir(exist_ok=True)
        haupt = None
        return True
    if name == "schluesselSetzen":
        dienst, wert = str(a[0]), str(a[1] or "").strip()
        if not re.fullmatch(r"[a-z]{2,20}", dienst):
            return False
        m = api_schluessel() if schluessel_holen() else None
        if m is None:
            return False
        if wert:
            m[dienst] = wert
        else:
            m.pop(dienst, None)
        return api_schluessel_setzen(m)
    if name == "schluesselEnde":
        s = (api_schluessel() if schluessel_holen() else {}).get(str(a[0]))
        return "" if not s else (s[-4:] if len(s) > 4 else "****")
    if name == "verschluesseln":
        return sicherung_verschluesseln(a[0], a[1])
    if name == "entschluesseln":
        return sicherung_entschluesseln(a[0], a[1]) or ""
    if name == "exportVerschluesselt":
        pw = api_schluessel().get("sicherung")
        return sicherung_verschluesseln(a[1], pw) if pw else ""
    if name == "jetztSichern":
        return jetzt_sichern()
    if name == "originalAblegen":
        oid = secrets.token_hex(8)
        return oid if datei_schreiben(f"originale/{oid}.bin", unb64(a[0])) else ""
    if name == "originalLesen":
        oid = str(a[0])
        if not re.fullmatch(r"[A-Za-z0-9]{4,40}", oid):
            return ""
        roh = datei_lesen(f"originale/{oid}.bin")
        return b64(roh) if roh else ""
    if name == "originalLoeschen":
        oid = str(a[0])
        if re.fullmatch(r"[A-Za-z0-9]{4,40}", oid):
            (DATEN / "originale" / f"{oid}.bin").unlink(missing_ok=True)
        return True
    if name == "zipExport":
        return "Fehler: Die verschlüsselte ZIP gibt es auf dem Desktop noch nicht – bitte die Sicherung (.dksafe) nutzen."
    if name == "zipLesen":
        return json.dumps({"fehler": "desktop"})
    if name in ("schutzSetzen", "sperrBildschirmBereit", "ordnerWaehlen"):
        return True
    if name == "sperren":
        haupt = None if pin_aktiv() else haupt
        return True
    raise KeyError(name)


# ------------------------------------------------------------ HTTP
class Anfrage(BaseHTTPRequestHandler):
    server_version = "DepotKompass"

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def senden(self, code, daten: bytes, typ="text/plain; charset=utf-8"):
        self.send_response(code)
        self.send_header("Content-Type", typ)
        self.send_header("Content-Length", str(len(daten)))
        self.end_headers()
        self.wfile.write(daten)

    def host_ok(self) -> bool:
        h = (self.headers.get("Host") or "").split(":")[0]
        return h in ("127.0.0.1", "localhost")          # gegen DNS-Rebinding

    def do_GET(self):
        if not self.host_ok():
            return self.senden(403, b"")
        pfad = urllib.parse.urlparse(self.path).path
        if pfad == "/":
            html = (ASSETS / "index.html").read_text(encoding="utf-8")
            html = html.replace('<script src="sprache.js"></script>', '<script src="desktop_bruecke.js"></script><script src="sprache.js"></script>', 1)
            return self.senden(200, html.encode(), "text/html; charset=utf-8")
        if pfad == "/desktop_bruecke.js":
            return self.senden(200, (Path(__file__).parent / "desktop_bruecke.js").read_bytes(), "text/javascript; charset=utf-8")
        f = (ASSETS / pfad.lstrip("/")).resolve()
        if not str(f).startswith(str(ASSETS.resolve()) + os.sep) or not f.is_file():
            return self.senden(404, b"")
        typ = {".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml",
               ".html": "text/html; charset=utf-8", ".wasm": "application/wasm"}.get(f.suffix, "application/octet-stream")
        self.senden(200, f.read_bytes(), typ)

    def do_POST(self):
        global zuletzt_aktiv
        if not self.host_ok() or self.headers.get("X-Depot-Kompass") != "1":
            return self.senden(403, b"")
        laenge = int(self.headers.get("Content-Length") or 0)
        if laenge > 200_000_000:
            return self.senden(413, b"")
        try:
            a = json.loads(self.rfile.read(laenge) or b"[]")
        except Exception:
            return self.senden(400, b"")
        pfad = urllib.parse.urlparse(self.path).path
        zuletzt_aktiv = time.time()
        try:
            if pfad.startswith("/api/netz/"):
                art = pfad[len("/api/netz/"):]
                antwort = ki_anfrage(*a) if art == "kiAnfrage" else ki_anfrage("openrouter", "", a[0]) if art == "ki" else netz_abruf(art, a)
                return self.senden(200, antwort.encode())
            if pfad.startswith("/api/"):
                r = bruecke(pfad[len("/api/"):], a)
                return self.senden(200, json.dumps(r).encode(), "application/json")
        except KeyError:
            return self.senden(404, b"")
        except Exception as e:
            print("Fehler:", type(e).__name__, file=sys.stderr)
            return self.senden(500, b"")
        self.senden(404, b"")

    def log_message(self, fmt, *args):
        pass        # keine Zugriffs-Protokolle (Datenschutz)


if __name__ == "__main__":
    print(f"Depot-Kompass Desktop: http://127.0.0.1:{PORT}  (Daten: {DATEN})", flush=True)
    ThreadingHTTPServer(("0.0.0.0" if os.environ.get("IM_CONTAINER") else "127.0.0.1", PORT), Anfrage).serve_forever()
