#!/usr/bin/env python3
"""Depot-Kompass Desktop (Linux & Windows per Docker) - dieselbe Oberflaeche wie die Android-App.

Der Server ersetzt die Android-Schnittstelle (window.Android):
  - Daten, Schluessel und Original-Dokumente liegen nur in /daten, verschluesselt (AES-256-GCM).
    Mit App-PIN: Hauptschluessel mit scrypt(PIN) eingepackt (bis 0.83 PBKDF2, wird beim Entsperren umgepackt);
    ohne PIN: Schluesseldatei im Datenordner.
  - Sicherungen (.dksafe) im gleichen Format wie die App - Handy <-> PC austauschbar.
  - Netz nur auf Knopfdruck und nur zu festen Adressen (Yahoo, Onvista, Google News, KI-Anbieter).
  - Nur 127.0.0.1, jede API-Anfrage braucht den Kopf X-Depot-Kompass (kein Zugriff von fremden Webseiten).
  - Heimnetz (DK_HOSTS gesetzt): nur mit App-PIN, und jeder Browser braucht nach der PIN eine eigene Sitzung (Cookie).
Kein Konto, kein Online-Login.
"""
import base64
import hashlib
import http.cookiejar
import http.cookies
import ipaddress
import json
import os
import re
import secrets
import shutil
import socket
import sys
import threading
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
try:
    DATEN.mkdir(parents=True, exist_ok=True)
    (DATEN / "originale").mkdir(exist_ok=True)
    (DATEN / "sicherungen").mkdir(exist_ok=True)
except PermissionError:
    # Haeufig unter Linux: Docker hat den Ordner "daten" als root angelegt (0.72 Frischtest)
    print("FEHLER: Kein Schreibrecht im Ordner daten/. Unter Linux im Ordner desktop einmal ausfuehren:\n"
          "  sudo chown -R 1000:1000 daten\n"
          "und dann: docker compose up -d   (Windows/macOS: Ordner daten loeschen und neu starten)", flush=True)
    raise SystemExit(1)

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


# Audit 23.11.2026: Am Desktop gibt es keinen Geraeteschluessel wie den Android-Keystore. Wer den Ordner daten/
# kopiert, kann die 6-stellige PIN auf einem fremden Rechner durchprobieren. scrypt (speicherhart, ~128 MB je
# Versuch) macht das um ein Vielfaches teurer als PBKDF2 - ganz verhindern kann es das bei 6 Ziffern nicht.
PIN_KDF = "scrypt-17-8-1"
PIN_SPERRE = threading.Lock()          # PIN-Versuche nacheinander, auch bei parallelen Anfragen


def pin_schluessel(pin: str, salz: bytes, kdf: str) -> bytes:
    if kdf == PIN_KDF:
        return hashlib.scrypt(pin.encode(), salt=salz, n=1 << 17, r=8, p=1, maxmem=256 * 1024 * 1024, dklen=32)
    return pbkdf2(pin, salz)            # alte Huellen (bis 0.83) - beim naechsten Entsperren auf scrypt umgepackt


def pin_oeffnen(pin, e: dict) -> bytes:
    return auspacken(pin_schluessel(str(pin), unb64(e["pinSalz"]), e.get("pinKdf", "pbkdf2")), unb64(e["pinHuelle"]))


def pin_huelle(pin: str, k: bytes) -> dict:
    salz = secrets.token_bytes(16)
    return {"pinHuelle": b64(einpacken(pin_schluessel(pin, salz, PIN_KDF), k)), "pinSalz": b64(salz), "pinKdf": PIN_KDF}


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
        if not 1000 <= int(d["runden"]) <= 2_000_000:
            return None
        return AESGCM(pbkdf2(pw, unb64(d["salz"]), int(d["runden"]))).decrypt(unb64(d["iv"]), unb64(d["daten"]), None).decode()
    except Exception:
        return None


# ------------------------------------------------------------ Netz (nur feste Ziele)
KEKSE = http.cookiejar.CookieJar()
OEFFNER = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(KEKSE))
crumb_wert = None
UPDATE_URL = "https://api.github.com/repos/kdm-media/depot-kompass/releases/latest"   # 0.83 Nach Update suchen - nur genau diese Adresse
ERLAUBT = re.compile(r"^https://([a-z0-9-]+\.)*(yahoo\.com|onvista\.de|alternative\.me|news\.google\.com|openrouter\.ai|anthropic\.com|openai\.com|googleapis\.com|kraken\.com|binance\.com)(/|$)")


def holen(adresse: str, methode="GET", koerper=None, koepfe=None, timeout=20):
    if adresse != UPDATE_URL and not ERLAUBT.match(adresse):
        raise ValueError("Adresse nicht erlaubt")
    req = urllib.request.Request(adresse, data=koerper, method=methode, headers={"User-Agent": "Mozilla/5.0", **(koepfe or {})})
    try:
        with OEFFNER.open(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def oeffentlich(adresse: str) -> bool:
    """Audit 23.11.: eigene RSS-Quellen nur https und nur oeffentliche IPs (nichts im Heimnetz, kein localhost, kein VPN-Bereich)."""
    try:
        u = urllib.parse.urlsplit(adresse)
        if u.scheme != "https" or not u.hostname:
            return False
        ips = {x[4][0].split("%")[0] for x in socket.getaddrinfo(u.hostname, u.port or 443, proto=socket.IPPROTO_TCP)}
        return bool(ips) and all(ipaddress.ip_address(ip).is_global for ip in ips)
    except Exception:
        return False


class NurOeffentlich(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, kopf, neu):
        if not oeffentlich(neu):
            return None                       # -> HTTPError, Abruf endet leer
        return super().redirect_request(req, fp, code, msg, kopf, neu)


RSS_OEFFNER = urllib.request.build_opener(NurOeffentlich)


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
    elif art == "chartZeitraum":
        # 0.70 Zeitraum im Hebel-Chart - wie MainActivity.chartZeitraum nur feste Zeitraeume
        p = {"1w": "range=5d&interval=60m", "1m": "range=1mo&interval=1d", "3m": "range=3mo&interval=1d", "6m": "range=6mo&interval=1d",
             "1j": "range=1y&interval=1d", "5j": "range=5y&interval=1wk"}.get(a[1] if len(a) > 1 else "")
        if not p or not a[0] or len(a[0]) > 40:
            return ""
        u = f"https://query1.finance.yahoo.com/v8/finance/chart/{q(a[0], safe='')}?{p}"
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
    elif art == "onvistaFinder":
        # 0.69 Zertifikate-Finder - wie MainActivity.onvistaFinder streng geprueft
        if (not re.fullmatch(r"[A-Z_]{2,20}", a[0]) or not re.fullmatch(r"[A-Za-z0-9._-]{1,40}", a[1])
                or not re.fullmatch(r"[A-Za-z0-9_=&;.-]{1,400}", a[2])):
            return ""
        u = ("https://api.onvista.de/api/v1/derivatives/finder/configuration_query?application=WEBSITE&device=DESKTOP"
             f"&entityTypeUnderlying={a[0]}&entityValueUnderlying={q(a[1], safe='')}&page=0&perPage=40&queryParameters={q(a[2], safe='')}")
    elif art == "stimmung":
        # 0.66 Marktstimmung - nur diese zwei festen Adressen
        if a[0] == "krypto":
            u = "https://api.alternative.me/fng/?limit=31"
        elif a[0] == "^VIX":
            u = "https://query1.finance.yahoo.com/v8/finance/chart/%5EVIX?range=1mo&interval=1d"
        else:
            return ""
    elif art == "krypto":
        # 0.78 Krypto-Marktdaten - wie MainActivity.krypto: nur feste, oeffentliche Adressen ohne Konto
        w, sym = (a + ["", ""])[:2]
        if not re.fullmatch(r"[A-Z0-9]{2,10}", sym or ""):
            return ""
        k = "XBT" if sym == "BTC" else sym
        seit = int(time.time()) - 10800
        u = {"kticker": f"https://futures.kraken.com/derivatives/api/v3/tickers/PF_{k}USD",
             "kls": f"https://futures.kraken.com/api/charts/v1/analytics/PF_{k}USD/long-short-info?interval=3600&since={seit}",
             "bls": f"https://fapi.binance.com/futures/data/globalLongShortAccountRatio?symbol={sym}USDT&period=1h&limit=1",
             "boi": f"https://fapi.binance.com/fapi/v1/openInterest?symbol={sym}USDT",
             "k4h": f"https://api.kraken.com/0/public/OHLC?pair={sym}EUR&interval=240"}.get(w)
        if not u:
            return ""
    elif art == "update":
        # 0.83 Nach Update suchen - wie MainActivity.updatePruefen: nur diese eine feste Adresse
        u = UPDATE_URL
    elif art == "modelle":
        u = "https://openrouter.ai/api/v1/models"
    elif art == "rss":
        # eigene RSS-Quellen: nur https, Antwort roh - hier bewusst ohne Zielliste (vom Nutzer eingetragen)
        if not a[0].startswith("https://") or len(a[0]) > 500 or not oeffentlich(a[0]):
            return ""
        req = urllib.request.Request(a[0], headers={"User-Agent": "Mozilla/5.0"})
        try:
            with RSS_OEFFNER.open(req, timeout=20) as r:
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


def pin_versuch(pin):
    """0.87: gemeinsame PIN-Pruefung mit Fehlversuch-Zaehler und Wartezeit -> (Schluessel oder None, Antwort)."""
    with PIN_SPERRE:
        e, jetzt = einst(), time.time()
        if jetzt < e.get("sperreBis", 0):
            return None, f"warten:{int(e['sperreBis'] - jetzt) + 1}"
        try:
            k = pin_oeffnen(pin, e)
        except Exception:
            f = e.get("fehlversuche", 0) + 1
            pause = 30 * (1 << min(f - 5, 6)) if f >= 5 else 0
            einst_setzen(fehlversuche=f, **({"sperreBis": jetzt + pause} if pause else {}))
            return None, (f"warten:{pause}" if pause else f"falsch:{5 - f}")
        neu = pin_huelle(str(pin), k) if e.get("pinKdf") != PIN_KDF else {}   # alte PBKDF2-Huelle umpacken
        einst_setzen(fehlversuche=0, **neu)
        return k, "ok"


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
        huelle = pin_huelle(pin, neu)
        if not pin_aktiv():
            alles_umschluesseln(alt, neu)
            (DATEN / "schluessel.key").unlink(missing_ok=True)
        einst_setzen(**huelle, fehlversuche=0)
        haupt = neu
        return True
    if name == "pinPruefen":
        k, antwort = pin_versuch(a[0])
        if k is not None:
            haupt = k
        return antwort
    if name == "sperreAufheben":
        # 0.87 (Bugliste 2): nur entsperrt und mit derselben Fehlversuch-Bremse wie pinPruefen
        if haupt is None:
            return False
        k, _ = pin_versuch(a[0])
        if k is None:
            return False
        e = einst()
        neu = secrets.token_bytes(32)
        alles_umschluesseln(k, neu)
        f = DATEN / "schluessel.key"
        f.write_bytes(neu)
        os.chmod(f, 0o600)
        e = einst()
        for x in ("pinHuelle", "pinSalz", "pinKdf"):
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
        SITZUNGEN.clear()
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
        SITZUNGEN.clear()
        return True
    raise KeyError(name)


# ------------------------------------------------------------ HTTP
# Audit 23.11.2026: Im Heimnetz (DK_HOSTS gesetzt) erreicht jedes Geraet im WLAN den Server. Deshalb dort:
#   - ohne App-PIN keine Daten (Hinweisseite statt App),
#   - mit PIN braucht jeder Browser nach richtiger PIN eine eigene Sitzung (Cookie, HttpOnly, SameSite=Strict).
#     Ein anderes Geraet sieht nur die PIN-Abfrage, auch wenn die App gerade auf dem PC entsperrt ist.
# Der Host-Kopf ist dafuer kein Beweis (jeder kann ihn setzen) - darum gilt das fuer ALLE Anfragen, sobald DK_HOSTS gesetzt ist.
HEIMNETZ = bool(os.environ.get("DK_HOSTS", "").strip())
SITZUNGEN = {}                         # Token -> letzte Nutzung (nur im Speicher)
SITZUNG_DAUER = 12 * 3600
OHNE_SITZUNG = {"version", "sicherheitStatus", "revision", "pinPruefen", "laden",   # 0.87: sperren nur mit Sitzung (Bugliste 14)
                "sperrBildschirmBereit", "schutzSetzen"}   # die letzten beiden tun am Desktop nichts (nur true)
MAX_ANFRAGE = 80_000_000               # 50-MB-Datei als Base64 + Rand (vorher 200 MB)
HEIMNETZ_OHNE_PIN = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
    "<title>Depot-Kompass</title><body style='font-family:sans-serif;max-width:40em;margin:2em auto;padding:0 1em'>"
    "<h2>Depot-Kompass: Heimnetz nur mit App-PIN</h2>"
    "<p>Im Heimnetz kann jedes Ger&auml;t im WLAN diese Adresse aufrufen. Deshalb zeigt die App hier erst Daten, wenn eine App-PIN gesetzt ist.</p>"
    "<ol><li>In der Datei <code>.env</code> die Zeilen <code>DK_BIND</code> und <code>DK_HOSTS</code> vor&uuml;bergehend mit <code>#</code> auskommentieren.</li>"
    "<li><code>docker compose up -d</code>, dann am PC <code>http://127.0.0.1:8098</code> &ouml;ffnen.</li>"
    "<li>Unter <b>Mehr &rarr; Sicherheit &amp; Sicherung</b> eine App-PIN setzen.</li>"
    "<li><code>#</code> wieder entfernen, <code>docker compose up -d</code>.</li></ol>"
    "<p lang=en><i>Home network access needs an app PIN: comment out DK_BIND and DK_HOSTS in .env, run docker compose up -d, "
    "open http://127.0.0.1:8098 on the PC, set a PIN under More &rarr; Security &amp; backup, then restore .env and run docker compose up -d.</i></p>")


def sitzung_neu() -> str:
    jetzt = time.time()
    for t, z in list(SITZUNGEN.items()):
        if jetzt - z > SITZUNG_DAUER:
            SITZUNGEN.pop(t, None)
    t = secrets.token_urlsafe(32)
    SITZUNGEN[t] = jetzt
    return t


class Anfrage(BaseHTTPRequestHandler):
    server_version = "DepotKompass"

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def senden(self, code, daten: bytes, typ="text/plain; charset=utf-8", keks=None):
        self.send_response(code)
        self.send_header("Content-Type", typ)
        if keks:
            self.send_header("Set-Cookie", f"dk_sitzung={keks}; HttpOnly; SameSite=Strict; Path=/")
        self.send_header("Content-Length", str(len(daten)))
        self.end_headers()
        self.wfile.write(daten)

    def host_ok(self) -> bool:
        h = (self.headers.get("Host") or "").split(":")[0]
        erlaubt = {"127.0.0.1", "localhost"} | {x.strip() for x in os.environ.get("DK_HOSTS", "").split(",") if x.strip()}
        return h in erlaubt                              # gegen DNS-Rebinding (DK_HOSTS = zusaetzliche Heimnetz-IPs)

    def sitzung_ok(self) -> bool:
        try:
            k = http.cookies.SimpleCookie(self.headers.get("Cookie") or "").get("dk_sitzung")
        except Exception:
            return False
        z = SITZUNGEN.get(k.value) if k else None
        if z is None or time.time() - z > SITZUNG_DAUER:
            return False
        SITZUNGEN[k.value] = time.time()
        return True

    def do_GET(self):
        if not self.host_ok():
            return self.senden(403, b"")
        pfad = urllib.parse.urlparse(self.path).path
        if pfad == "/":
            if HEIMNETZ and not pin_aktiv():
                return self.senden(200, HEIMNETZ_OHNE_PIN.encode(), "text/html; charset=utf-8")
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
        if laenge > MAX_ANFRAGE:
            return self.senden(413, b"")
        try:
            a = json.loads(self.rfile.read(laenge) or b"[]")
        except Exception:
            return self.senden(400, b"")
        pfad = urllib.parse.urlparse(self.path).path
        zuletzt_aktiv = time.time()
        name = pfad[len("/api/"):] if pfad.startswith("/api/") else ""
        if HEIMNETZ:
            if not pin_aktiv():
                return self.senden(403, b"")
            if not self.sitzung_ok():
                if name == "laden":
                    return self.senden(200, json.dumps("\u0000GESPERRT").encode(), "application/json")
                if name not in OHNE_SITZUNG:
                    return self.senden(403, b"")
        try:
            if pfad.startswith("/api/netz/"):
                art = pfad[len("/api/netz/"):]
                antwort = ki_anfrage(*a) if art == "kiAnfrage" else ki_anfrage("openrouter", "", a[0]) if art == "ki" else netz_abruf(art, a)
                return self.senden(200, antwort.encode())
            if pfad.startswith("/api/"):
                r = bruecke(name, a)
                keks = sitzung_neu() if HEIMNETZ and name == "pinPruefen" and r == "ok" else None
                return self.senden(200, json.dumps(r).encode(), "application/json", keks)
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
