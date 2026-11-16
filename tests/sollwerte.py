#!/usr/bin/env python3
"""Beispieldaten + Sollwerte fuer den Testlauf - unabhaengig von der App gerechnet.

Alle Daten sind ERFUNDEN (keine echten Depots im Repository). Das Skript
schreibt tests/beispieldaten/*.csv und tests/erwartet.json.

    python3 -I tests/sollwerte.py
"""
import csv
import json
from datetime import date, timedelta
from pathlib import Path

HIER = Path(__file__).resolve().parent
DATEN = HIER / "beispieldaten"
DATEN.mkdir(exist_ok=True)

# --------------------------------------------------------------- Trade Republic
# (datum, kategorie, typ, art, name, isin, stueck, kurs, betrag, gebuehr, steuer)
TR = [
    ("2026-01-05", "CASH", "TRANSFER_INBOUND", "", "", "", "", "", 2000.00, "", ""),
    ("2026-01-06", "TRADING", "BUY", "STOCK", "Alpha AG", "DE000ALPHA01", 10, 50.00, -500.00, -1.00, ""),
    ("2026-01-06", "TRADING", "BUY", "STOCK", "Beta Inc", "US000BETA001", 4, 100.00, -400.00, -1.00, ""),
    ("2026-01-07", "TRADING", "BUY", "CRYPTO", "Bitcoin", "BTC", 0.01, 40000.00, -400.00, -1.00, ""),
    ("2026-01-08", "TRADING", "SELL", "STOCK", "Alpha AG", "DE000ALPHA01", -4, 55.00, 220.00, -1.00, ""),
    ("2026-01-08", "TRADING", "SELL", "STOCK", "Beta Inc", "US000BETA001", -1, 90.00, 90.00, -1.00, ""),
    ("2026-01-12", "TRADING", "BUY", "STOCK", "Alpha AG", "DE000ALPHA01", 2, 60.00, -120.00, -1.00, ""),
    ("2026-01-15", "TRADING", "SELL", "STOCK", "Alpha AG", "DE000ALPHA01", -3, 58.00, 174.00, -1.00, -2.50),
    ("2026-01-20", "CASH", "DIVIDEND", "STOCK", "Beta Inc", "US000BETA001", 3, "", 6.00, "", -0.90),
    ("2026-01-22", "CASH", "CARD_TRANSACTION", "", "Baeckerei", "", "", "", -12.50, "", ""),
    ("2026-01-31", "CASH", "INTEREST_PAYMENT", "", "", "", "", "", 1.20, "", ""),
    ("2026-02-01", "CASH", "TRANSFER_OUTBOUND", "", "", "", "", "", -100.00, "", ""),
]
KOPF = ["datetime", "date", "account_type", "category", "type", "asset_class", "name", "symbol", "shares", "price", "amount",
        "fee", "tax", "currency", "original_amount", "original_currency", "fx_rate", "description", "transaction_id",
        "counterparty_name", "counterparty_iban", "payment_reference", "mcc_code"]
with (DATEN / "tr_beispiel.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(KOPF)
    for k, (d, kat, typ, art, name, isin, st, kurs, betrag, geb, steu) in enumerate(TR):
        w.writerow([d + "T10:00:00.000Z", d, "DEFAULT", kat, typ, art, name, isin, st, kurs, betrag, geb, steu, "EUR",
                    "", "", "", typ, f"test-{k:04d}", "", "", "", ""])

# Durchschnittseinstand, realisiert, je Tag, Dividenden, Konto - eigene Rechnung
pos, tage, real, div = {}, {}, 0.0, 0.0
f = lambda x: float(x) if x != "" else 0.0
for d, kat, typ, art, name, isin, st, kurs, betrag, geb, steu in TR:
    if kat == "TRADING":
        p = pos.setdefault(isin, {"name": name, "st": 0.0, "ein": 0.0})
        s = abs(f(st))
        if typ == "BUY":
            p["st"] += s; p["ein"] += s * f(kurs) + abs(f(geb))
        else:
            abg = p["ein"] * min(s, p["st"]) / p["st"]
            g = s * f(kurs) - abs(f(geb)) - abs(f(steu)) - abg
            real += g; tage[d] = tage.get(d, 0.0) + g
            p["ein"] -= abg; p["st"] -= s
    elif typ == "DIVIDEND":
        div += f(betrag) - abs(f(steu))
konto = sum(f(b) - abs(f(g)) - abs(f(s)) for _, _, _, _, _, _, _, _, b, g, s in TR)

# --------------------------------------------------------------- Kraken (Ledger)
KR = [
    ("L1", "R1", "2026-01-05 10:00:00", "deposit", "ZEUR", 100.0, 0.0),
    ("L2", "T1", "2026-01-06 11:00:00", "trade", "ZEUR", -50.0, 0.2),
    ("L3", "T1", "2026-01-06 11:00:00", "trade", "ADA", 100.0, 0.0),
    ("L6", "R2", "2026-03-01 00:00:00", "staking", "ADA.S", 1.5, 0.0),
    ("L7", "T3", "2026-04-01 12:00:00", "trade", "ADA", -40.0, 0.0),
    ("L8", "T3", "2026-04-01 12:00:00", "trade", "ZEUR", 28.0, 0.1),
]
with (DATEN / "kraken_ledger.csv").open("w", newline="", encoding="utf-8") as f2:
    w = csv.writer(f2, quoting=csv.QUOTE_ALL)
    w.writerow(["txid", "refid", "time", "type", "subtype", "aclass", "subclass", "asset", "wallet", "amount", "fee", "balance"])
    for tx, ref, t, typ, asset, menge, fee in KR:
        w.writerow([tx, ref, t, typ, "", "currency", "", asset, "spot / main", f"{menge:.8f}", f"{fee:.8f}", ""])
ada_st, ada_ein = 100.0, 50.2
ada_st += 1.5
abg = ada_ein * 40 / ada_st
ada_real = 28 - 0.1 - abg
ada_ein -= abg; ada_st -= 40
# FIFO-Haltefristen ADA: Kauf 100 (06.01.), Staking 1,5 (01.03.), Verkauf 40 -> Rest 60 + 1,5
hf = [["2026-01-06", 60.0, "2027-01-07"], ["2026-03-01", 1.5, "2027-03-02"]]   # frei ab dem Tag NACH dem Jahrestag

# --------------------------------------------------------------- Wertverlauf / Drawdown / KGV
kurse, zugang = [100, 110, 99, 120], [1, 0, 1, 0]
st, wert, idx = 0, [], [100.0]
for k, c in enumerate(kurse):
    st += zugang[k]; wert.append(st * c)
for k in range(1, 4):
    f = zugang[k] * kurse[k]                     # Kauf zum Ausfuehrungskurs, Dietz
    idx.append(idx[-1] * (1 + (wert[k] - wert[k - 1] - f) / (wert[k - 1] + f / 2)))
spitze, dd = 0.0, 0.0
for x in idx:
    spitze = max(spitze, x); dd = max(dd, (spitze - x) / spitze)

soll = {
    "tr": {"positionen": {i: [round(p["st"], 8), round(p["ein"], 4)] for i, p in pos.items() if p["st"] > 1e-9},
           "realisiert": round(real, 4), "dividenden": round(div, 4), "konto": round(konto, 2),
           "tage": {d: round(g, 4) for d, g in tage.items()}},
    "kraken": {"ada": [round(ada_st, 8), round(ada_ein, 4), round(ada_real, 4)], "konto": round(100 - 50.2 + 27.9, 2),
               "haltefristen": hf},
    "verlauf": {"index": [round(x, 4) for x in idx], "rendite": round((idx[-1] / 100 - 1) * 100, 4), "drawdown": round(dd * 100, 4)},
    "kgv": round(1000 / (600 / 20 + 400 / 10), 4),
}
(HIER / "erwartet.json").write_text(json.dumps(soll, indent=1), encoding="utf-8")
print(json.dumps(soll, indent=1))
