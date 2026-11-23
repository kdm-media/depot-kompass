#!/usr/bin/env python3
"""Grosser Testlauf: erfundenes Vermoegen 750.000 EUR auf 6 Broker, 2 Jahre.

Alles ERFUNDEN (Kurse per Zufall mit festem Startwert, Namen/ISINs nur damit
es echt aussieht). Schreibt tests/grosstest/*.csv (die Dateien, die man in
die App importiert) und tests/grosstest/erwartet.json.

Die Sollwerte werden direkt aus den erzeugten Ereignissen gerechnet - nicht
aus den CSV-Dateien und nicht mit App-Code. Stimmen App und Python ueberein,
sind Import UND Rechnung richtig.

    python3 -I tests/grosstest.py

Depots (Import-Reihenfolge):
  1 Kraken           Krypto halten    70.000  Ledger, Sparplan, Staking
  2 Bitvavo          Krypto-Sparplan  40.000  Transaktionen, Staking
  3 OKX              Krypto-Handel    40.000  Handelsverlauf (nur Trades, kein Konto)
  4 Scalable         ETF-Sparplan    200.000  Transaktionen, Einmalanlage + monatlich
  5 Smartbroker      20 Einzelwerte  300.000  Transaktionen inkl. Gold-/Silber-ETC, Dividenden
  6 Trade Republic   Daytrading      100.000  Transaktionsexport mit Konto (Zinsen, Karte)
  7 Kursliste        Wochenkurse aller Werte (Import danach, Internet darf aus sein)
"""
import csv
import json
import math
import random
from datetime import date, timedelta
from pathlib import Path

HIER = Path(__file__).resolve().parent
AUS = HIER / "grosstest"
AUS.mkdir(exist_ok=True)
R = random.Random(20261107)

START = date(2024, 11, 11)                 # Montag
WOCHEN = 104
RASTER = [START + timedelta(weeks=k) for k in range(WOCHEN)]
ENDE = RASTER[-1]


def woche_von(d):
    """Index der Rasterwoche, deren Kurs fuer ein Datum gilt (letzter Montag <= d)."""
    return min(WOCHEN - 1, max(0, (d - START).days // 7))


# ------------------------------------------------------------------ Kurse
# (kennung, name, art, startkurs, rendite p.a., schwankung p.a., nachkommastellen)
WERTE = [
    # Krypto
    ("BTC", "Bitcoin", "Krypto", 72000, 0.22, 0.50, 2), ("ETH", "Ethereum", "Krypto", 2900, 0.12, 0.65, 2),
    ("SOL", "Solana", "Krypto", 190, 0.25, 0.85, 3), ("ADA", "Cardano", "Krypto", 0.55, 0.10, 0.90, 5),
    ("DOT", "Polkadot", "Krypto", 6.2, -0.05, 0.85, 4), ("XRP", "XRP", "Krypto", 1.1, 0.30, 0.90, 5),
    ("LINK", "Chainlink", "Krypto", 14.5, 0.15, 0.85, 4), ("AVAX", "Avalanche", "Krypto", 32, 0.05, 0.90, 3),
    # ETFs (Scalable)
    ("IE00B4L5Y983", "iShares Core MSCI World UCITS ETF", "ETF", 98, 0.09, 0.15, 2),
    ("LU1681043599", "Amundi MSCI World UCITS ETF", "ETF", 520, 0.09, 0.15, 2),
    ("IE00BKM4GZ66", "iShares Core MSCI EM IMI UCITS ETF", "ETF", 33, 0.06, 0.18, 2),
    ("IE00B5BMR087", "iShares Core S&P 500 UCITS ETF", "ETF", 560, 0.11, 0.17, 2),
    ("IE00B3RBWM25", "Vanguard FTSE All-World UCITS ETF (Dist)", "ETF", 125, 0.085, 0.15, 2),
    # Einzelwerte (Smartbroker)
    ("DE0007164600", "SAP SE", "Aktie", 215, 0.14, 0.26, 2), ("DE0007236101", "Siemens AG", "Aktie", 180, 0.10, 0.24, 2),
    ("DE0008404005", "Allianz SE", "Aktie", 290, 0.09, 0.20, 2), ("DE0008430026", "Münchener Rück AG", "Aktie", 480, 0.08, 0.20, 2),
    ("DE0005557508", "Deutsche Telekom AG", "Aktie", 28, 0.11, 0.18, 2), ("US0378331005", "Apple Inc.", "Aktie", 210, 0.10, 0.27, 2),
    ("US5949181045", "Microsoft Corp.", "Aktie", 395, 0.12, 0.25, 2), ("US67066G1040", "NVIDIA Corp.", "Aktie", 135, 0.30, 0.50, 2),
    ("US02079K3059", "Alphabet Inc. A", "Aktie", 165, 0.12, 0.30, 2), ("US0231351067", "Amazon.com Inc.", "Aktie", 190, 0.12, 0.32, 2),
    ("NL0010273215", "ASML Holding N.V.", "Aktie", 640, 0.08, 0.38, 2), ("DK0062498333", "Novo Nordisk A/S B", "Aktie", 100, -0.15, 0.40, 2),
    ("FR0000121014", "LVMH Moët Hennessy", "Aktie", 640, -0.03, 0.30, 2), ("CH0038863350", "Nestlé S.A.", "Aktie", 84, -0.02, 0.17, 2),
    ("US4781601046", "Johnson & Johnson", "Aktie", 148, 0.04, 0.18, 2), ("US92826C8394", "Visa Inc. A", "Aktie", 280, 0.11, 0.21, 2),
    ("DE0007030033", "Rheinmetall AG", "Aktie", 490, 0.45, 0.45, 2), ("DE0005190003", "BMW AG", "Aktie", 72, -0.04, 0.28, 2),
    ("DE000A0S9GB0", "Xetra-Gold ETC", "ETC", 78, 0.18, 0.15, 2), ("JE00B1VS3333", "WisdomTree Physical Silver ETC", "ETC", 28, 0.20, 0.28, 2),
    # Daytrading (Trade Republic)
    ("US88160R1014", "Tesla Inc.", "Aktie", 310, 0.10, 0.60, 2), ("US0079031078", "Advanced Micro Devices", "Aktie", 135, 0.05, 0.50, 2),
    ("US30303M1027", "Meta Platforms A", "Aktie", 540, 0.15, 0.35, 2), ("US69608A1088", "Palantir Technologies", "Aktie", 45, 0.40, 0.65, 2),
]
INFO = {k: dict(name=n, art=a, nk=nk) for k, n, a, *_x, nk in WERTE}
KURS = {}
for k, n, a, p0, mu, sig, nk in WERTE:
    # Zufallsweg mit Schwankung sig, am Ende genau auf der geplanten Rendite mu p. a.
    # ("normale, unterschiedliche Renditen" - kein Zufalls-Crash um 80 %)
    weg = [0.0]
    for w in range(1, WOCHEN):
        weg.append(weg[-1] + min(0.6, sig) / math.sqrt(52) * R.gauss(0, 1))
    ziel = math.log(1 + mu) * (WOCHEN - 1) / 52
    KURS[k] = [round(p0 * math.exp(x - w / (WOCHEN - 1) * (weg[-1] - ziel)), nk) for w, x in enumerate(weg)]


def preis(kennung, d, streu=0.0):
    """Handelskurs an einem Tag: Wochenkurs +- etwas Tagesschwankung."""
    p = KURS[kennung][woche_von(d)] * (1 + R.uniform(-streu, streu))
    return round(p, INFO[kennung]["nk"])


def tage(von, bis, wochentage=(0, 1, 2, 3, 4)):
    d = von
    while d <= bis:
        if d.weekday() in wochentage:
            yield d
        d += timedelta(days=1)


# ------------------------------------------------------------------ Ereignisse
# Einheitliche Ereignisliste je Depot - daraus entstehen CSV UND Sollwerte.
# typ: kauf/verkauf (stueck, kurs, gebuehr, steuer, kasse), staking (stueck),
#      dividende (betrag brutto, steuer), ein/aus/karte/zinsen (betrag mit Vorzeichen)
EV = {"Kraken": [], "Bitvavo": [], "OKX": [], "Scalable": [], "Smartbroker": [], "Trade Republic": []}


def ev(depot, **x):
    EV[depot].append(x)


def r2(x):
    return round(x + 0.0, 2)


# --- 1 Kraken: Krypto halten (70.000: 28.000 Start + 24 x 1.750)
mix = {"BTC": 0.5, "ETH": 0.25, "SOL": 0.12, "ADA": 0.08, "DOT": 0.05}
ev("Kraken", typ="ein", datum=START + timedelta(days=1), betrag=28000.0)
for k, anteil in mix.items():
    d = START + timedelta(days=2)
    euro = r2(25200 * anteil); kurs = preis(k, d, 0.01); st = round(euro / kurs, 8)
    ev("Kraken", typ="kauf", datum=d, inst=k, stueck=st, euro=euro, gebuehr=r2(euro * 0.0026))
for m in range(1, 25):
    d0 = date(2024 + (10 + m) // 12, (10 + m) % 12 + 1, 1)
    d = next(tage(d0, d0 + timedelta(days=7), (1,)))           # erster Dienstag
    if d > ENDE:
        break
    ev("Kraken", typ="ein", datum=d - timedelta(days=1), betrag=1750.0)
    for k, anteil in mix.items():
        euro = r2(1680 * anteil); kurs = preis(k, d, 0.01); st = round(euro / kurs, 8)
        ev("Kraken", typ="kauf", datum=d, inst=k, stueck=st, euro=euro, gebuehr=r2(euro * 0.0026))
    for k, rate in (("ADA", 0.025), ("DOT", 0.11), ("SOL", 0.06)):    # Staking-Ertrag (Jahreszins / 12)
        bisher = sum(e["stueck"] if e["typ"] in ("kauf", "staking") else -e["stueck"] if e["typ"] == "verkauf" else 0
                     for e in EV["Kraken"] if e.get("inst") == k)
        ev("Kraken", typ="staking", datum=d + timedelta(days=3), inst=k, stueck=round(bisher * rate / 12, 8))
# Teilverkauf ETH (Gewinnmitnahme) und SOL
for k, frac, d in (("ETH", 0.30, date(2025, 12, 10)), ("SOL", 0.25, date(2026, 6, 17))):
    bisher = sum(e["stueck"] if e["typ"] in ("kauf", "staking") else -e["stueck"] if e["typ"] == "verkauf" else 0
                 for e in EV["Kraken"] if e.get("inst") == k and e["datum"] < d)
    st = round(bisher * frac, 8); kurs = preis(k, d, 0.01); euro = r2(st * kurs)
    ev("Kraken", typ="verkauf", datum=d, inst=k, stueck=st, euro=euro, gebuehr=r2(euro * 0.0026))

# --- 2 Bitvavo: Krypto-Sparplan (40.000: 10.000 Start + 24 x 1.250), ETH-Staking
ev("Bitvavo", typ="ein", datum=START + timedelta(days=2), betrag=10000.0)
for k, euro in (("BTC", 5700.0), ("ETH", 3800.0)):
    d = START + timedelta(days=3); kurs = preis(k, d, 0.01)
    ev("Bitvavo", typ="kauf", datum=d, inst=k, stueck=round(euro / kurs, 8), euro=euro, gebuehr=r2(euro * 0.0025))
for m in range(1, 25):
    d = date(2024 + (10 + m) // 12, (10 + m) % 12 + 1, 15)
    if d > ENDE:
        break
    ev("Bitvavo", typ="ein", datum=d - timedelta(days=1), betrag=1250.0)
    for k, euro in (("BTC", 720.0), ("ETH", 480.0)):
        kurs = preis(k, d, 0.01)
        ev("Bitvavo", typ="kauf", datum=d, inst=k, stueck=round(euro / kurs, 8), euro=euro, gebuehr=r2(euro * 0.0025))
    eth = sum(e["stueck"] if e["typ"] in ("kauf", "staking") else -e["stueck"] if e["typ"] == "verkauf" else 0
              for e in EV["Bitvavo"] if e.get("inst") == "ETH")
    ev("Bitvavo", typ="staking", datum=d + timedelta(days=5), inst="ETH", stueck=round(eth * 0.03 / 12, 8))
d = date(2026, 4, 8)
btc = sum(e["stueck"] if e["typ"] == "kauf" else 0 for e in EV["Bitvavo"] if e.get("inst") == "BTC" and e["datum"] < d)
st = round(btc * 0.2, 8); euro = r2(st * preis("BTC", d, 0.01))
ev("Bitvavo", typ="verkauf", datum=d, inst="BTC", stueck=st, euro=euro, gebuehr=r2(euro * 0.0025))

# --- 3 OKX: Krypto-Handel (40.000), Swing-Trades 1-12 Tage, Gebuehr in Euro
offen_bis = {}
for d in tage(START + timedelta(days=3), ENDE - timedelta(days=14)):
    if R.random() > 0.22:
        continue
    k = R.choice(["BTC", "ETH", "SOL", "XRP", "LINK", "AVAX"])
    if offen_bis.get(k, START) >= d:
        continue
    kurs = preis(k, d, 0.03); st = round(R.uniform(3000, 9000) / kurs, 8)
    raus = d + timedelta(days=R.randint(1, 12))
    kurs2 = round(preis(k, raus, 0.03) * (1 + R.gauss(0.004, 0.02)), INFO[k]["nk"])
    ev("OKX", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=r2(st * kurs * 0.001))
    ev("OKX", typ="verkauf", datum=raus, inst=k, stueck=st, kurs=kurs2, gebuehr=r2(st * kurs2 * 0.001), steuer=0.0)
    offen_bis[k] = raus
for k, d in (("BTC", ENDE - timedelta(days=10)), ("SOL", ENDE - timedelta(days=6))):
    kurs = preis(k, d, 0.02); st = round(5000 / kurs, 8)
    ev("OKX", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=r2(st * kurs * 0.001))

# --- 3 Scalable: ETF-Sparplan (200.000: 120.000 Start + 24 x 3.333,33)
gewicht = {"IE00B4L5Y983": 0.35, "LU1681043599": 0.20, "IE00B5BMR087": 0.20, "IE00BKM4GZ66": 0.15, "IE00B3RBWM25": 0.10}
for k, g in gewicht.items():
    d = START + timedelta(days=4)
    kurs = preis(k, d, 0.003); st = round(120000 * g / kurs, 6)
    ev("Scalable", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=0.99, sparplan=False)
for m in range(1, 25):
    d = date(2024 + (10 + m) // 12, (10 + m) % 12 + 1, 2)
    if d > ENDE:
        break
    while d.weekday() > 4:
        d += timedelta(days=1)
    for k, g in gewicht.items():
        kurs = preis(k, d, 0.003); st = round(3333.33 * g / kurs, 6)
        ev("Scalable", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=0.0, sparplan=True)
    if m % 3 == 0:                          # Ausschuettung Vanguard quartalsweise
        bisher = sum(e["stueck"] for e in EV["Scalable"] if e.get("inst") == "IE00B3RBWM25" and e["typ"] == "kauf")
        brutto = r2(bisher * 0.48)
        ev("Scalable", typ="dividende", datum=d + timedelta(days=14), inst="IE00B3RBWM25", betrag=brutto, steuer=r2(brutto * 0.7 * 0.26375))
# Umschichtung: EM-Teil verkaufen
d = date(2026, 3, 18)
bisher = sum(e["stueck"] for e in EV["Scalable"] if e.get("inst") == "IE00BKM4GZ66" and e["typ"] == "kauf" and e["datum"] < d)
kurs = preis("IE00BKM4GZ66", d, 0.003)
ev("Scalable", typ="verkauf", datum=d, inst="IE00BKM4GZ66", stueck=round(bisher * 0.5, 6), kurs=kurs, gebuehr=0.99, steuer=0.0)

# --- 4 Smartbroker: 20 Einzelwerte inkl. Gold/Silber (300.000)
einzel = [k for k, *_r in WERTE if INFO[k]["art"] in ("Aktie", "ETC")][:20]
DIVI = {"DE0007164600": 2.2, "DE0007236101": 5.2, "DE0008404005": 15.4, "DE0008430026": 20, "DE0005557508": 0.9, "US0378331005": 0.95,
        "US5949181045": 3.1, "US02079K3059": 0.75, "NL0010273215": 6.4, "DK0062498333": 1.5, "FR0000121014": 13, "CH0038863350": 3.1,
        "US4781601046": 4.7, "US92826C8394": 2.2, "DE0007030033": 8.1, "DE0005190003": 4.3}
for j, k in enumerate(einzel):
    d = START + timedelta(days=2 + j % 4)
    budget = 15000 if INFO[k]["art"] == "Aktie" else 18000
    kurs = preis(k, d, 0.005); st = max(1, int(budget / kurs))
    ev("Smartbroker", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=4.0)
for k, d, faktor in (("US67066G1040", date(2025, 7, 15), 0.5), ("DE0007030033", date(2025, 10, 8), 0.4),
                     ("DK0062498333", date(2025, 9, 3), 1.0), ("US0378331005", date(2026, 2, 11), 0.3)):
    st = sum(e["stueck"] if e["typ"] == "kauf" else -e["stueck"] if e["typ"] == "verkauf" else 0
             for e in EV["Smartbroker"] if e.get("inst") == k and e["datum"] < d)
    ev("Smartbroker", typ="verkauf", datum=d, inst=k, stueck=int(st * faktor), kurs=preis(k, d, 0.005), gebuehr=4.0, steuer=0.0)
for k, d, budget in (("DE0008430026", date(2025, 9, 10), 10000), ("JE00B1VS3333", date(2026, 1, 14), 8000),
                     ("US5949181045", date(2026, 4, 22), 7000), ("DE000A0S9GB0", date(2026, 8, 5), 9000)):
    kurs = preis(k, d, 0.005)
    ev("Smartbroker", typ="kauf", datum=d, inst=k, stueck=int(budget / kurs), kurs=kurs, gebuehr=4.0)

for jahr in (2025, 2026):                  # Dividenden: eine je Jahr (US/ASML quartalsweise vereinfacht als eine)
    for j, (k, dps) in enumerate(DIVI.items()):
        d = date(jahr, 4 + j % 4, 10 + j % 15)
        if d > ENDE:
            continue
        st = sum(e["stueck"] if e["typ"] == "kauf" else -e["stueck"] if e["typ"] == "verkauf" else 0
                 for e in EV["Smartbroker"] if e.get("inst") == k and e["datum"] <= d)
        if st > 0:
            brutto = r2(st * dps)
            ev("Smartbroker", typ="dividende", datum=d, inst=k, betrag=brutto, steuer=r2(brutto * 0.26375))
# --- 5 Trade Republic: Daytrading (100.000) mit Konto
TRW = ["US88160R1014", "US0079031078", "US30303M1027", "US69608A1088", "US67066G1040", "DE0007030033"]
ev("Trade Republic", typ="ein", datum=START, betrag=100000.0)
for d in tage(START + timedelta(days=1), ENDE):
    if R.random() < 0.40:                   # an ca. 60 % der Handelstage wird gehandelt
        continue
    for _ in range(R.randint(1, 3)):
        k = R.choice(TRW)
        kurs = round(preis(k, d, 0.02), 2); st = max(1, int(R.uniform(8000, 25000) / kurs))
        kurs2 = round(kurs * (1 + R.gauss(0.0006, 0.012)), 2)
        ev("Trade Republic", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=1.0, kasse=r2(-st * kurs))
        ev("Trade Republic", typ="verkauf", datum=d, inst=k, stueck=st, kurs=kurs2, gebuehr=1.0, steuer=0.0, kasse=r2(st * kurs2))
for m in range(24):                         # Zinsen auf Cash, ein paar Kartenzahlungen, eine Auszahlung
    d = date(2024 + (11 + m) // 12, (11 + m) % 12 + 1, 1) - timedelta(days=1)
    if START < d <= ENDE:
        ev("Trade Republic", typ="zinsen", datum=d, betrag=r2(R.uniform(80, 160)))
for d, b, h in ((date(2025, 2, 14), -86.40, "Elektronikmarkt"), (date(2025, 8, 2), -42.15, "Tankstelle"), (date(2026, 5, 20), -129.99, "Baumarkt")):
    ev("Trade Republic", typ="karte", datum=d, betrag=b, haendler=h)
ev("Trade Republic", typ="aus", datum=date(2026, 7, 1), betrag=-5000.0)
# zwei Positionen ueber Nacht offen
for k, d in (("US88160R1014", ENDE - timedelta(days=3)), ("US69608A1088", ENDE - timedelta(days=1))):
    kurs = round(preis(k, d, 0.01), 2); st = int(10000 / kurs)
    ev("Trade Republic", typ="kauf", datum=d, inst=k, stueck=st, kurs=kurs, gebuehr=1.0, kasse=r2(-st * kurs))

for name in EV:                               # keine Buchungen in der Zukunft (nach dem Stichtag)
    EV[name] = sorted((e for e in EV[name] if e["datum"] <= ENDE), key=lambda e: e["datum"])


# ------------------------------------------------------------------ CSV schreiben
def de(x, nk=2):
    """Deutsche Zahl ohne Tausenderpunkt (wie Scalable/Smartbroker)."""
    return f"{x:.{nk}f}".replace(".", ",")


def kraken_ledger(depot, datei, praefix):
    alias = {"BTC": "XXBT", "ETH": "XETH", "XRP": "XXRP"}
    with (AUS / datei).open("w", newline="", encoding="utf-8") as f:
        w = csv.writer(f, quoting=csv.QUOTE_ALL)
        w.writerow(["txid", "refid", "time", "type", "subtype", "aclass", "subclass", "asset", "wallet", "amount", "fee", "balance"])
        for n, e in enumerate(EV[depot]):
            t = e["datum"].isoformat() + f" {10 + n % 8:02d}:{n % 60:02d}:00"
            ref, tx = f"{praefix}R{n:05d}", f"{praefix}L{n:05d}"
            if e["typ"] in ("ein",):
                w.writerow([tx, ref, t, "deposit", "", "currency", "", "ZEUR", "spot / main", f"{e['betrag']:.4f}", "0.0000", ""])
            elif e["typ"] in ("kauf", "verkauf"):
                a = alias.get(e["inst"], e["inst"]); vz = -1 if e["typ"] == "kauf" else 1
                w.writerow([tx + "A", ref, t, "trade", "", "currency", "", "ZEUR", "spot / main", f"{vz * e['euro']:.4f}", f"{e['gebuehr']:.4f}", ""])
                w.writerow([tx + "B", ref, t, "trade", "", "currency", "", a, "spot / main", f"{-vz * e['stueck']:.8f}", "0.00000000", ""])
            elif e["typ"] == "staking":
                w.writerow([tx, ref, t, "staking", "", "currency", "", e["inst"] + ".S", "earn / bonded", f"{e['stueck']:.8f}", "0.00000000", ""])


kraken_ledger("Kraken", "1_kraken_krypto_halten_ledgers.csv", "KH")

with (AUS / "2_bitvavo_krypto_sparplan.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["Timezone", "Date", "Time", "Type", "Currency", "Amount", "Quote Currency", "Quote Price", "Received / Paid Currency",
                "Received / Paid Amount", "Fee currency", "Fee amount", "Status", "Transaction ID", "Address"])
    for n, e in enumerate(EV["Bitvavo"]):
        d, t, tid = e["datum"].isoformat(), f"{9 + n % 10:02d}:{n % 60:02d}:{n % 37:02d}.{n % 1000:03d}", f"bv-test-{n:05d}"
        if e["typ"] == "ein":
            w.writerow(["Europe/Amsterdam", d, t, "deposit", "EUR", f"{e['betrag']:.2f}", "", "", "", "", "", "", "Completed", tid, ""])
        elif e["typ"] in ("kauf", "verkauf"):
            vz = 1 if e["typ"] == "kauf" else -1
            w.writerow(["Europe/Amsterdam", d, t, "buy" if vz > 0 else "sell", e["inst"], f"{vz * e['stueck']:.8f}", "EUR",
                        f"{e['euro'] / e['stueck']:.2f}", "EUR", f"{-vz * e['euro']:.2f}", "EUR", f"{e['gebuehr']:.2f}", "Completed", tid, ""])
        elif e["typ"] == "staking":
            w.writerow(["Europe/Amsterdam", d, t, "staking", e["inst"], f"{e['stueck']:.8f}", "", "", "", "", e["inst"], "", "Distributed", tid, ""])
    # ein abgebrochener Kauf (darf NICHT zaehlen)
    w.writerow(["Europe/Amsterdam", "2025-06-03", "10:00:00", "buy", "BTC", "0.10000000", "EUR", "60000.00", "EUR", "-6000.00", "EUR", "15.00", "Canceled", "bv-test-storno", ""])

with (AUS / "3_okx_krypto_handel.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["User ID", "Order ID", "Time", "Trade Type", "Symbol", "Action", "Amount", "Trading Unit", "Filled Price", "PnL", "Fee",
                "Fee Unit", "Position Change", "Position Balance", "Balance Change", "Balance", "Balance Unit"])
    for n, e in enumerate(EV["OKX"]):
        w.writerow(["999000111", f"{700000000 + n}", e["datum"].isoformat() + f" {8 + n % 12:02d}:{n % 60:02d}:{n % 59:02d}", "Spot",
                    e["inst"] + "-EUR", "Buy" if e["typ"] == "kauf" else "Sell", f"{e['stueck']:.8f}", e["inst"],
                    f"{e['kurs']:.{INFO[e['inst']]['nk']}f}", "", f"{-e['gebuehr']:.2f}", "EUR", "", "", "", "", ""])
    # ein USDT-Paar und ein Perpetual: sichtbar uebersprungen
    w.writerow(["999000111", "799999998", "2025-07-01 12:00:00", "Spot", "BTC-USDT", "Buy", "0.01000000", "BTC", "60000.00", "", "-0.60", "USDT", "", "", "", "", ""])
    w.writerow(["999000111", "799999999", "2025-07-02 12:00:00", "Perpetual", "BTC-USDT-SWAP", "Buy", "1", "Cont", "60000.00", "", "-0.30", "USDT", "", "", "", "", ""])

with (AUS / "4_scalable_etf_sparplan.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["date", "time", "status", "reference", "description", "assetType", "type", "isin", "shares", "price", "amount", "fee", "tax", "currency"])
    for n, e in enumerate(EV["Scalable"]):
        name = INFO[e["inst"]]["name"]
        if e["typ"] == "dividende":
            w.writerow([e["datum"].isoformat(), "09:00:00", "Executed", f"SC{n:05d}", name, "Security", "Distribution", e["inst"], "", "",
                        de(e["betrag"]), "0,00", de(-e["steuer"]), "EUR"])
        else:
            typ = "Savings plan" if e.get("sparplan") else "Buy" if e["typ"] == "kauf" else "Sell"
            vz = -1 if e["typ"] == "kauf" else 1
            w.writerow([e["datum"].isoformat(), f"{9 + n % 8:02d}:{n % 60:02d}:00", "Executed", f"SC{n:05d}", name, "Security", typ, e["inst"],
                        de(-vz * e["stueck"], 6), de(e["kurs"]), de(vz * e["stueck"] * e["kurs"]), de(-e["gebuehr"]), de(-e.get("steuer", 0.0)), "EUR"])
    # eine stornierte Order (darf NICHT zaehlen) und Geldbewegungen (sind kein Wertpapier)
    w.writerow(["2025-05-06", "10:00:00", "Cancelled", "SC99999", INFO["IE00B5BMR087"]["name"], "Security", "Buy", "IE00B5BMR087", "10,000000", "500,00", "-5000,00", "0,00", "0,00", "EUR"])
    w.writerow(["2024-11-12", "08:00:00", "Executed", "SC99998", "Einzahlung", "Cash", "Deposit", "", "", "", "120000,00", "0,00", "0,00", "EUR"])

with (AUS / "5_smartbroker_einzelwerte.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["DEPOTNUMMER", "TRANSAKTIONSTYP", "STATUS DER TRANSAKTION", "HANDELSDATUM", "VALUTADATUM", "AUSFÜHRUNGSZEITPUNKT", "ISIN",
                "KÜRZEL", "NAME 1", "STÜCKE", "AUSFÜHRUNGSKURS", "GESAMTBETRAG IN KONTOWÄHRUNG", "GEBÜHREN IN KONTOWÄHRUNG", "STEUERN IN KONTOWÄHRUNG"])
    for n, e in enumerate(EV["Smartbroker"]):
        zeit = e["datum"].isoformat() + f"T{9 + n % 8:02d}:{n % 60:02d}:00"
        name = INFO[e["inst"]]["name"]
        if e["typ"] == "dividende":
            w.writerow(["TEST0001", "DIVIDEND", "CONFIRMED", e["datum"].isoformat(), e["datum"].isoformat(), zeit, e["inst"], "", name, "", "",
                        de(e["betrag"]), "0,00", de(e["steuer"])])
        else:
            vz = -1 if e["typ"] == "kauf" else 1
            w.writerow(["TEST0001", "BUY" if e["typ"] == "kauf" else "SELL", "CONFIRMED", e["datum"].isoformat(), e["datum"].isoformat(), zeit,
                        e["inst"], "", name, de(e["stueck"], 0), de(e["kurs"]), de(vz * e["stueck"] * e["kurs"]), de(e["gebuehr"]), de(e.get("steuer", 0.0))])
    w.writerow(["TEST0001", "BUY", "CANCELLED", "2025-03-03", "2025-03-05", "2025-03-03T10:00:00", "US0378331005", "", "Apple Inc.", "100", "200,00",
                "-20000,00", "4,00", "0,00"])

KOPF = ["datetime", "date", "account_type", "category", "type", "asset_class", "name", "symbol", "shares", "price", "amount",
        "fee", "tax", "currency", "original_amount", "original_currency", "fx_rate", "description", "transaction_id",
        "counterparty_name", "counterparty_iban", "payment_reference", "mcc_code"]
with (AUS / "6_traderepublic_daytrading.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(KOPF)
    for n, e in enumerate(EV["Trade Republic"]):
        d = e["datum"].isoformat(); tid = f"test-dt-{n:05d}"
        zeit = d + f"T{8 + n % 12:02d}:{n % 60:02d}:00.000Z"
        if e["typ"] in ("kauf", "verkauf"):
            vz = -1 if e["typ"] == "kauf" else 1
            w.writerow([zeit, d, "DEFAULT", "TRADING", "BUY" if vz < 0 else "SELL", "STOCK", INFO[e["inst"]]["name"], e["inst"],
                        f"{-vz * e['stueck']}", f"{e['kurs']:.2f}", f"{e['kasse']:.2f}", f"{-e['gebuehr']:.2f}",
                        f"{-e.get('steuer', 0.0):.2f}" if e.get("steuer") else "", "EUR", "", "", "", "", tid, "", "", "", ""])
        else:
            typ = {"ein": "TRANSFER_INBOUND", "aus": "TRANSFER_OUTBOUND", "zinsen": "INTEREST_PAYMENT", "karte": "CARD_TRANSACTION"}[e["typ"]]
            w.writerow([zeit, d, "DEFAULT", "CASH", typ, "", e.get("haendler", ""), "", "", "", f"{e['betrag']:.2f}", "", "", "EUR",
                        "", "", "", "", tid, "Max Test" if e["typ"] in ("ein", "aus") else "", "DE00TEST" if e["typ"] in ("ein", "aus") else "", "", ""])

with (AUS / "7_kursliste_wochenkurse.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["datum", "kennung", "name", "kurs_eur"])
    for k in KURS:
        for i, d in enumerate(RASTER):
            w.writerow([d.isoformat(), k, INFO[k]["name"], de(KURS[k][i], INFO[k]["nk"])])


# ------------------------------------------------------------------ Sollwerte (eigene Rechnung)
MIT_GELD = {"Kraken", "Bitvavo", "Trade Republic"}


def kasse(depot, e):
    """Geldbewegung auf dem Verrechnungskonto."""
    if e["typ"] == "kauf":
        return (-e["euro"] if "euro" in e else e.get("kasse", -e["stueck"] * e["kurs"])) - e["gebuehr"]
    if e["typ"] == "verkauf":
        return (e["euro"] if "euro" in e else e.get("kasse", e["stueck"] * e["kurs"])) - e["gebuehr"] - e.get("steuer", 0.0)
    if e["typ"] == "dividende":
        return e["betrag"] - e["steuer"]
    if e["typ"] in ("ein", "aus", "karte", "zinsen"):
        return e["betrag"]
    return 0.0


def stkurs(e):
    return e["euro"] / e["stueck"] if "euro" in e else e["kurs"]


soll = {"depots": {}, "raster": [d.isoformat() for d in RASTER]}
wochen_alle = []
for depot, liste in EV.items():
    pos, real, div = {}, 0.0, 0.0
    for e in liste:
        if e["typ"] in ("kauf", "staking"):
            p = pos.setdefault(e["inst"], [0.0, 0.0])
            p[0] += e["stueck"]; p[1] += e["stueck"] * stkurs(e) + e["gebuehr"] if e["typ"] == "kauf" else 0.0
        elif e["typ"] == "verkauf":
            p = pos[e["inst"]]
            abg = p[1] * min(e["stueck"], p[0]) / p[0]
            real += e["stueck"] * stkurs(e) - e["gebuehr"] - e.get("steuer", 0.0) - abg
            p[1] -= abg; p[0] -= e["stueck"]
            if abs(p[0]) < 1e-9:
                p[0] = p[1] = 0.0
        elif e["typ"] == "dividende":
            div += e["betrag"] - e["steuer"]
    konto = sum(kasse(depot, e) for e in liste) if depot in MIT_GELD else None
    # Wochenwerte: Wert und Fluss
    wochen = []
    for k, d in enumerate(RASTER):
        st, geld, fluss = {}, 0.0, 0.0
        for e in liste:
            if e["datum"] <= d:
                if "inst" in e and e["typ"] in ("kauf", "verkauf", "staking"):
                    st[e["inst"]] = st.get(e["inst"], 0.0) + (e["stueck"] if e["typ"] != "verkauf" else -e["stueck"])
                geld += kasse(depot, e)
            if k and RASTER[k - 1] < e["datum"] <= d:
                if depot in MIT_GELD:
                    if e["typ"] in ("ein", "aus", "karte"):
                        fluss += e["betrag"]
                elif e["typ"] in ("kauf", "verkauf", "dividende"):
                    fluss -= kasse(depot, e)          # echtes Geld der Ausfuehrung
        wert = sum(max(0.0, s) * KURS[i][k] for i, s in st.items()) + (geld if depot in MIT_GELD else 0.0)
        wochen.append((wert, fluss))
    wochen_alle.append(wochen)

    def reihe(wo):
        wert, idx, x, einsatz = [], [], 100.0, []
        for k, (v, f) in enumerate(wo):
            einsatz.append(einsatz[-1] + f if k else v)       # Startwert + Ein-/Auszahlungen
            if k and wert[k - 1] > 0 and wert[k - 1] + f / 2 > 0:      # Dietz
                x *= 1 + (v - wert[k - 1] - f) / (wert[k - 1] + f / 2)
            wert.append(v); idx.append(x)
        spitze, dd = -1e18, 0.0
        for x in idx:
            spitze = max(spitze, x); dd = max(dd, (spitze - x) / spitze)
        mw = [(v, k) for k, v in enumerate(wert) if v > 0]
        hoch, tief = max(mw), min(mw)
        return {"index": [round(x, 4) for x in idx], "wert": [round(v, 2) for v in wert], "einsatz": [round(v, 2) for v in einsatz], "rendite": round((idx[-1] / 100 - 1) * 100, 4),
                "drawdown": round(dd * 100, 4), "hoch": [round(hoch[0], 2), RASTER[hoch[1]].isoformat()],
                "tief": [round(tief[0], 2), RASTER[tief[1]].isoformat()], "indexHoch": round(max(idx), 4), "indexTief": round(min(idx), 4)}

    soll["depots"][depot] = {
        "positionen": {i: [round(p[0], 8), round(p[1], 2)] for i, p in sorted(pos.items()) if p[0] > 1e-9},
        "realisiert": round(real, 2), "dividenden": round(div, 2), "konto": None if konto is None else round(konto, 2),
        "buchungen": sum(1 for e in liste if depot in MIT_GELD or e["typ"] not in ("ein", "aus", "karte", "zinsen")),
        "verlauf": reihe(wochen),
    }
    soll["depots"][depot]["wert_heute"] = soll["depots"][depot]["verlauf"]["wert"][-1]

summe = [(sum(w[k][0] for w in wochen_alle), sum(w[k][1] for w in wochen_alle)) for k in range(WOCHEN)]
soll["gesamt"] = reihe(summe)

# --- Verlauf OHNE Kursliste (offline): Kurse nur aus den eigenen Ausfuehrungskursen.
# Raster: jeden Montag ab der ersten Buchung; Kurs einer Woche = letzter Kauf-/Verkaufskurs
# bis Montag + 3 Tage. Danach bleibt alles gleich (App laeuft bis heute weiter).
alle_daten = [e["datum"] for l in EV.values() for e in l]
m0 = min(alle_daten) - timedelta(days=min(alle_daten).weekday())
RASTER2 = [m0 + timedelta(weeks=k) for k in range((max(alle_daten) - m0).days // 7 + 2)]
wochen2 = []
for depot, liste in EV.items():
    marken = {}
    for e in liste:
        if e["typ"] in ("kauf", "verkauf"):
            marken.setdefault(e["inst"], []).append((e["datum"], stkurs(e)))
    def mark(i, d):
        pr = None
        for t, c in marken.get(i, []):
            if t <= d + timedelta(days=3): pr = c
        return pr
    w = []
    for k, d in enumerate(RASTER2):
        st, geld, fluss = {}, 0.0, 0.0
        for e in liste:
            if e["datum"] <= d:
                if "inst" in e and e["typ"] in ("kauf", "verkauf", "staking"):
                    st[e["inst"]] = st.get(e["inst"], 0.0) + (e["stueck"] if e["typ"] != "verkauf" else -e["stueck"])
                geld += kasse(depot, e)
            if k and RASTER2[k - 1] < e["datum"] <= d:
                if depot in MIT_GELD:
                    if e["typ"] in ("ein", "aus", "karte"):
                        fluss += e["betrag"]
                elif e["typ"] in ("kauf", "verkauf", "dividende"):
                    fluss -= kasse(depot, e)
        wert = sum(max(0.0, s_) * (mark(i, d) or 0.0) for i, s_ in st.items()) + (geld if depot in MIT_GELD else 0.0)
        w.append((wert, fluss))
    wochen2.append(w)
soll["ohne_kurse"] = reihe([(sum(w[k][0] for w in wochen2), sum(w[k][1] for w in wochen2)) for k in range(len(RASTER2))])
soll["ohne_kurse"]["raster"] = [d.isoformat() for d in RASTER2]
# --- Steuer je Jahr (unabhaengig): Wertpapiere Durchschnittseinstand, Krypto FIFO,
# frei ab dem Tag NACH dem Jahrestag
def frist(d):
    return date(d.year + 1, d.month, d.day) + timedelta(days=1)

steuer = {}
def sj(d):
    return steuer.setdefault(str(d.year), {"aktienPlus": 0.0, "aktienMinus": 0.0, "sonstige": 0.0, "ertraege": 0.0, "kryptoPflichtig": 0.0, "kryptoFrei": 0.0, "steuer": 0.0})
for depot, liste in EV.items():
    pos, posten = {}, {}
    for e in liste:
        if e["typ"] == "zinsen":
            sj(e["datum"])["ertraege"] += e["betrag"]; continue
        if e["typ"] == "dividende":
            y = sj(e["datum"]); y["ertraege"] += e["betrag"]; y["steuer"] += e["steuer"]; continue
        if "inst" not in e:
            continue
        art = INFO[e["inst"]]["art"]
        if art == "Krypto":
            l = posten.setdefault(e["inst"], [])
            if e["typ"] == "kauf":
                l.append([e["datum"], e["stueck"], e["stueck"] * stkurs(e) + e["gebuehr"]])
            elif e["typ"] == "staking":
                l.append([e["datum"], e["stueck"], 0.0])
            elif e["typ"] == "verkauf":
                rest, pr = e["stueck"], stkurs(e)
                while rest > 1e-12 and l:
                    n = min(rest, l[0][1]); k = l[0][2] * n / l[0][1]
                    g = n * pr - e["gebuehr"] * n / e["stueck"] - k
                    sj(e["datum"])["kryptoFrei" if e["datum"] >= frist(l[0][0]) else "kryptoPflichtig"] += g
                    l[0][2] -= k; l[0][1] -= n; rest -= n
                    if l[0][1] <= 1e-12: l.pop(0)
                sj(e["datum"])["steuer"] += e.get("steuer", 0.0)
            continue
        q = pos.setdefault(e["inst"], [0.0, 0.0])
        if e["typ"] == "kauf":
            q[0] += e["stueck"]; q[1] += e["stueck"] * stkurs(e) + e["gebuehr"]
        elif e["typ"] == "verkauf":
            m = min(e["stueck"], q[0]); abg = q[1] * m / q[0]
            g = m * stkurs(e) - e["gebuehr"] - abg; y = sj(e["datum"])
            if art == "Aktie": y["aktienPlus" if g >= 0 else "aktienMinus"] += g
            else: y["sonstige"] += g
            y["steuer"] += e.get("steuer", 0.0)
            q[1] -= abg; q[0] -= m
soll["steuer"] = {k: {kk: round(vv, 2) for kk, vv in v.items()} for k, v in steuer.items()}

# Daytrading: realisierter G/V je Tag (TR) - Summe und Anzahl Tage
tage_gv = {}
p = {}
for e in EV["Trade Republic"]:
    if e["typ"] == "kauf":
        q = p.setdefault(e["inst"], [0.0, 0.0]); q[0] += e["stueck"]; q[1] += e["stueck"] * e["kurs"] + e["gebuehr"]
    elif e["typ"] == "verkauf":
        q = p[e["inst"]]; abg = q[1] * e["stueck"] / q[0]
        g = e["stueck"] * e["kurs"] - e["gebuehr"] - abg
        t = tage_gv.setdefault(e["datum"].isoformat(), [0.0, 0]); t[0] += g; t[1] += 1
        q[1] -= abg; q[0] -= e["stueck"]
        if abs(q[0]) < 1e-9:
            q[0] = q[1] = 0.0
soll["daytrading"] = {"tage": len(tage_gv), "gewinntage": sum(1 for g, _ in tage_gv.values() if g > 0),
                      "summe": round(sum(g for g, _ in tage_gv.values()), 2), "trades": sum(n for _, n in tage_gv.values())}
soll["eingezahlt"] = round(sum(e["betrag"] for l in EV.values() for e in l if e["typ"] == "ein")
                           + 40000 + 200000 + 300000, 2)   # OKX/Scalable/Smartbroker ohne Kontodatei: Startkapital laut Plan
(AUS / "erwartet.json").write_text(json.dumps(soll, indent=1, ensure_ascii=False), encoding="utf-8")

# Kurzfassung fuer Vorgabe
z = [f"Großer Test – Stand {ENDE.strftime('%d.%m.%Y')} (erfundene Daten, Zeitraum {START.strftime('%d.%m.%Y')}–{ENDE.strftime('%d.%m.%Y')})", ""]
fmt = lambda x: f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
for depot, x in soll["depots"].items():
    v = x["verlauf"]
    z.append(f"{depot}: Wert heute {fmt(x['wert_heute'])} €, Rendite {fmt(v['rendite'])} %, max. Drawdown −{fmt(v['drawdown'])} %, "
             f"Hoch {fmt(v['hoch'][0])} € ({v['hoch'][1]}), Tief {fmt(v['tief'][0])} € ({v['tief'][1]}), "
             f"realisiert {fmt(x['realisiert'])} €, Dividenden {fmt(x['dividenden'])} €"
             + (f", Konto {fmt(x['konto'])} €" if x["konto"] is not None else "") + f", {len(x['positionen'])} Positionen")
g = soll["gesamt"]
z += ["", f"GESAMT: Wert heute {fmt(g['wert'][-1])} €, Rendite {fmt(g['rendite'])} %, max. Drawdown −{fmt(g['drawdown'])} %, "
          f"Hoch {fmt(g['hoch'][0])} € ({g['hoch'][1]}), Tief {fmt(g['tief'][0])} € ({g['tief'][1]})",
      f"OHNE Kursliste (nur die 6 Broker-Dateien, offline aus den Kauf-/Verkaufskursen): Wert {fmt(soll['ohne_kurse']['wert'][-1])} €, "
      f"eingesetzt {fmt(soll['ohne_kurse']['einsatz'][-1])} €, Rendite {fmt(soll['ohne_kurse']['rendite'])} %, max. Drawdown −{fmt(soll['ohne_kurse']['drawdown'])} %",
      f"MIT Kursliste (Test_7 zuletzt): siehe GESAMT oben; eingesetzt {fmt(soll['gesamt']['einsatz'][-1])} €",
      f"Daytrading TR: {soll['daytrading']['tage']} Handelstage, {soll['daytrading']['gewinntage']} Gewinntage, "
      f"{soll['daytrading']['trades']} Verkäufe, Summe {fmt(soll['daytrading']['summe'])} €"]
(AUS / "SOLLWERTE.txt").write_text("\n".join(z) + "\n", encoding="utf-8")
print("\n".join(z))
