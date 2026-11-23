#!/usr/bin/env python3
"""10 Testfaelle: haelt die App das aus, rechnet sie richtig? Alles ERFUNDEN.

Schreibt tests/testfaelle/*.csv, erwartet.json und TESTFAELLE.txt (Anleitung).
Die grossen Testdateien (Fall 1) kommen aus tests/grosstest/.

    python3 -I tests/testfaelle.py
"""
import csv
import json
from pathlib import Path

HIER = Path(__file__).resolve().parent
AUS = HIER / "testfaelle"
AUS.mkdir(exist_ok=True)
KOPF = ["datetime", "date", "account_type", "category", "type", "asset_class", "name", "symbol", "shares", "price", "amount",
        "fee", "tax", "currency", "original_amount", "original_currency", "fx_rate", "description", "transaction_id",
        "counterparty_name", "counterparty_iban", "payment_reference", "mcc_code"]


def tr_zeile(n, d, kat, typ, art, name, isin, st, kurs, betrag, geb="", steu=""):
    return [d + "T10:00:00.000Z", d, "DEFAULT", kat, typ, art, name, isin, st, kurs, betrag, geb, steu, "EUR",
            "", "", "", "", f"fall-{n}", "", "", "", ""]


def tr_schreiben(datei, zeilen, excel=False):
    with (AUS / datei).open("w", newline="", encoding="utf-8-sig" if excel else "utf-8") as f:
        if excel:   # so speichert Excel (deutsch): Semikolon, Komma, BOM, CRLF, ohne Anfuehrungszeichen
            w = csv.writer(f, delimiter=";", lineterminator="\r\n")
            w.writerow(KOPF)
            for z in zeilen:
                w.writerow([str(x).replace(".", ",") if i in (8, 9, 10, 11, 12) else x for i, x in enumerate(z)])
        else:
            w = csv.writer(f, quoting=csv.QUOTE_ALL)
            w.writerow(KOPF)
            w.writerows(zeilen)


soll = {}

# 2 - Excel hat die TR-Datei umgespeichert
z2 = [tr_zeile("2a", "2026-03-02", "CASH", "TRANSFER_INBOUND", "", "", "", "", "", "1000.00"),
      tr_zeile("2b", "2026-03-03", "TRADING", "BUY", "STOCK", "Beispiel AG", "DE000TEST0002", "3", "101.50", "-304.50", "-1.00"),
      tr_zeile("2c", "2026-03-10", "TRADING", "SELL", "STOCK", "Beispiel AG", "DE000TEST0002", "-3", "110.25", "330.75", "-1.00"),
      tr_zeile("2d", "2026-03-11", "TRADING", "BUY", "CRYPTO", "Bitcoin", "BTC", "0.0125", "64000.00", "-800.00", "-1.00")]
tr_schreiben("02_excel_umgespeichert.csv", z2, excel=True)
soll["2"] = {"realisiert": round(330.75 - 1 - (304.5 + 1), 2), "konto": round(1000 - 305.5 + 329.75 - 801, 2),
             "btc": 0.0125, "positionen": 1}

# 3 - Sonderzeichen, Umlaute und ein Angriff im Namen
boese = '<img src=x onerror="document.title=\'XSS\'">Müller & Söhne "Prüf" AG'
z3 = [tr_zeile("3a", "2026-04-01", "TRADING", "BUY", "STOCK", boese, "DE000TEST0003", "7", "12.34", "-86.38", "-1.00")]
tr_schreiben("03_sonderzeichen_und_angriff.csv", z3)
soll["3"] = {"name": boese, "einstand": round(7 * 12.34 + 1, 2)}

# 4 - mehr verkauft als im Bestand (Kauf fehlt in der Datei)
z4 = [tr_zeile("4a", "2026-05-04", "TRADING", "BUY", "STOCK", "Lücken AG", "DE000TEST0004", "10", "50.00", "-500.00", "-1.00"),
      tr_zeile("4b", "2026-05-20", "TRADING", "SELL", "STOCK", "Lücken AG", "DE000TEST0004", "-15", "60.00", "900.00", "-1.00")]
tr_schreiben("04_mehr_verkauft_als_gekauft.csv", z4)
soll["4"] = {"realisiert": round(10 * 60 - 1 - 501, 2), "positionen": 0, "warnung": True}

# 5 - alles verkauft, spaeter neu gekauft: Einstand beginnt neu
z5 = [tr_zeile("5a", "2025-01-10", "TRADING", "BUY", "STOCK", "Wieder AG", "DE000TEST0005", "20", "40.00", "-800.00", "-1.00"),
      tr_zeile("5b", "2025-06-10", "TRADING", "SELL", "STOCK", "Wieder AG", "DE000TEST0005", "-20", "55.00", "1100.00", "-1.00", "-52.00"),
      tr_zeile("5c", "2025-09-01", "TRADING", "BUY", "STOCK", "Wieder AG", "DE000TEST0005", "8", "47.50", "-380.00", "-1.00")]
tr_schreiben("05_verkauft_und_neu_gekauft.csv", z5)
soll["5"] = {"stueck": 8, "einstand": 381.0, "kaufkurs": round(381 / 8, 4), "realisiert": round(1100 - 1 - 52 - 801, 2)}

# 6 - Smartbroker: Storno, Teilverkauf mit Steuer, Dividende mit Quellensteuer
with (AUS / "06_storno_steuer_dividende.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["DEPOTNUMMER", "TRANSAKTIONSTYP", "STATUS DER TRANSAKTION", "HANDELSDATUM", "VALUTADATUM", "AUSFÜHRUNGSZEITPUNKT", "ISIN",
                "KÜRZEL", "NAME 1", "STÜCKE", "AUSFÜHRUNGSKURS", "GESAMTBETRAG IN KONTOWÄHRUNG", "GEBÜHREN IN KONTOWÄHRUNG", "STEUERN IN KONTOWÄHRUNG"])
    w.writerows([
        ["T6", "BUY", "CONFIRMED", "2025-02-03", "2025-02-05", "2025-02-03T09:10:00", "US000TEST006", "", "Fall Sechs Inc.", "40", "125,50", "-5020,00", "4,90", "0,00"],
        ["T6", "BUY", "CANCELLED", "2025-02-04", "2025-02-06", "2025-02-04T09:10:00", "US000TEST006", "", "Fall Sechs Inc.", "400", "125,00", "-50000,00", "4,90", "0,00"],
        ["T6", "DIVIDEND", "CONFIRMED", "2025-05-15", "2025-05-15", "2025-05-15T00:00:00", "US000TEST006", "", "Fall Sechs Inc.", "", "", "36,00", "0,00", "9,50"],
        ["T6", "SELL", "CONFIRMED", "2025-08-20", "2025-08-22", "2025-08-20T15:30:00", "US000TEST006", "", "Fall Sechs Inc.", "15", "140,00", "2100,00", "4,90", "52,30"],
    ])
ein = 40 * 125.5 + 4.9
abg = ein * 15 / 40
soll["6"] = {"stueck": 25, "einstand": round(ein - abg, 2), "realisiert": round(15 * 140 - 4.9 - 52.3 - abg, 2), "dividenden": round(36 - 9.5, 2),
             "buchungen": 3}

# 7 - leere Datei (nur Kopfzeile)
tr_schreiben("07_leer_nur_kopfzeile.csv", [])
# 8 - falsches Format (Kontoauszug einer Bank)
(AUS / "08_falsches_format_kontoauszug.csv").write_text(
    "Buchungstag;Valuta;Auftraggeber;Verwendungszweck;Betrag\n01.03.2026;01.03.2026;Stadtwerke;Abschlag;-89,00\n", encoding="utf-8")

# 12 - unbekannter Broker (Spalten wie bei vielen deutschen Banken) -> Spalten zuordnen
with (AUS / "12_unbekannter_broker.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, delimiter=";")
    w.writerow(["Buchungstag", "Geschäftsart", "Wertpapierbezeichnung", "ISIN", "Stück/Nominale", "Kurs", "Betrag (EUR)", "Provision", "Steuern"])
    w.writerows([["03.02.2025", "Kauf", "Beispiel Werke AG", "DE000TEST0012", "20", "45,50", "-910,00", "4,95", ""],
                 ["10.03.2025", "Kauf", "Beispiel Werke AG", "DE000TEST0012", "10", "48,00", "-480,00", "4,95", ""],
                 ["15.05.2025", "Dividende", "Beispiel Werke AG", "DE000TEST0012", "30", "", "36,00", "", "9,50"],
                 ["20.08.2025", "Verkauf", "Beispiel Werke AG", "DE000TEST0012", "12", "52,00", "624,00", "4,95", "8,10"],
                 ["21.08.2025", "Depotentgelt", "", "", "", "", "-2,00", "", ""]])
ein = 20 * 45.5 + 4.95 + 10 * 48 + 4.95
abg = ein * 12 / 30
soll["12"] = {"stueck": 18, "einstand": round(ein - abg, 2), "realisiert": round(12 * 52 - 4.95 - 8.10 - abg, 2), "dividenden": round(36 - 9.5, 2)}
soll["8"] = {"konto": -89.0}

# 13 - Bestand zum Stichtag (bestand.csv) + aeltere Transaktionen: Startbestand zurueckrechnen
with (AUS / "13a_bestand_stichtag.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f)
    w.writerow(["Konto", "Instrument", "Art", "Ticker", "Stueck", "Wert_EUR", "Einstand_EUR", "Haltefrist_Ende", "Notiz"])
    w.writerow(["Test 13", "Rueck AG", "Aktie", "", "15", "1500.00", "1350.00", "", "Bestand · ISIN DE000TEST013"])
z13 = [tr_zeile("13a", "2025-01-10", "TRADING", "BUY", "STOCK", "Rueck AG", "DE000TEST013", "6", "90.00", "-540.00", "-1.00"),
       tr_zeile("13b", "2025-06-10", "TRADING", "BUY", "STOCK", "Rueck AG", "DE000TEST013", "6", "95.00", "-570.00", "-1.00"),
       tr_zeile("13c", "2025-09-10", "TRADING", "SELL", "STOCK", "Rueck AG", "DE000TEST013", "-2", "100.00", "200.00", "-1.00")]
tr_schreiben("13b_aeltere_transaktionen.csv", z13)
ein = 1350 * 5 / 15 + 541 + 571; abg = ein * 2 / 17
soll["13"] = {"anfang": 5, "anfang_datum": "2025-01-09", "stueck": 15, "einstand": round(ein - abg, 2), "realisiert": round(200 - 1 - abg, 2)}

# 9 - Riesendatei: 20.000 Zeilen Daytrading (10 Jahre)
z9, n = [tr_zeile("9-0", "2016-01-04", "CASH", "TRANSFER_INBOUND", "", "", "", "", "", "50000.00")], 1
from datetime import date, timedelta
d, real = date(2016, 1, 5), 0.0
while len(z9) < 20000:
    if d.weekday() < 5:
        k = n % 4
        kurs, kurs2 = 100 + k * 10 + (n % 7), 100 + k * 10 + (n % 7) + ((n % 5) - 2) * 0.5
        ds = d.isoformat()
        z9.append(tr_zeile(f"9-{n}a", ds, "TRADING", "BUY", "STOCK", f"Riese {k}", f"DE000RIESE0{k}", "50", f"{kurs:.2f}", f"{-50 * kurs:.2f}", "-1.00"))
        z9.append(tr_zeile(f"9-{n}b", ds, "TRADING", "SELL", "STOCK", f"Riese {k}", f"DE000RIESE0{k}", "-50", f"{kurs2:.2f}", f"{50 * kurs2:.2f}", "-1.00"))
        real += 50 * kurs2 - 1 - (50 * kurs + 1)
        n += 1
    d += timedelta(days=1)
tr_schreiben("09_riesendatei_20000_zeilen.csv", z9)
soll["9"] = {"buchungen": len(z9), "realisiert": round(real, 2), "positionen": 0}

# 10 - Kraken: Ledger UND Trades vom selben Konto - nichts doppelt
with (AUS / "10a_kraken_ledgers.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(["txid", "refid", "time", "type", "subtype", "aclass", "subclass", "asset", "wallet", "amount", "fee", "balance"])
    w.writerows([["L1", "D1", "2026-02-01 10:00:00", "deposit", "", "currency", "", "ZEUR", "spot / main", "2000.0000", "0.0000", ""],
                 ["L2", "TQ1", "2026-02-02 11:00:00", "trade", "", "currency", "", "ZEUR", "spot / main", "-900.0000", "2.3400", ""],
                 ["L3", "TQ1", "2026-02-02 11:00:00", "trade", "", "currency", "", "XETH", "spot / main", "0.3000000000", "0.0000000000", ""],
                 ["L4", "TQ2", "2026-03-02 11:00:00", "trade", "", "currency", "", "XETH", "spot / main", "-0.1000000000", "0.0000000000", ""],
                 ["L5", "TQ2", "2026-03-02 11:00:00", "trade", "", "currency", "", "ZEUR", "spot / main", "330.0000", "0.8600", ""]])
with (AUS / "10b_kraken_trades.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_ALL)
    w.writerow(["txid", "ordertxid", "pair", "time", "type", "ordertype", "price", "cost", "fee", "vol", "margin", "misc", "ledgers"])
    w.writerows([["TQ1", "O1", "XETHZEUR", "2026-02-02 11:00:00", "buy", "limit", "3000.00", "900.00", "2.34", "0.30", "0", "", "L2,L3"],
                 ["TQ2", "O2", "XETHZEUR", "2026-03-02 11:00:00", "sell", "limit", "3300.00", "330.00", "0.86", "0.10", "0", "", "L4,L5"]])
ein = 900 + 2.34
soll["10"] = {"eth": 0.2, "einstand": round(ein * 2 / 3, 2), "realisiert": round(330 - 0.86 - ein / 3, 2), "konto": round(2000 - 902.34 + 329.14, 2),
              "buchungen": 3}

# 11 - Kraken-App "Activities": Einzahlungen, Transfers an ein Challenge-Konto, Rueckzahlung, Abhebung
with (AUS / "11_kraken_app_aktivitaeten.csv").open("w", newline="", encoding="utf-8") as f:
    w = csv.writer(f, quoting=csv.QUOTE_NONNUMERIC)
    w.writerow(["Date (UTC)", "Type", "Subtype", "Asset", "Asset Name", "Wallet", "Amount", "Price (EUR)", "Fee", "Fee (EUR)", "Value (EUR)", "Counter party", "Reference"])
    for d, typ, unter, betrag, gegen, ref in [
            ("2026-07-01 10:00:00", "Third Party Payment", "Deposit", 10.0, "", "FT-TEST-1"),
            ("2026-07-01 10:05:00", "Transfer", "", -10.0, "TEST-CHALLENGE-1", "TR-TEST-1"),
            ("2026-08-03 09:00:00", "Third Party Payment", "Deposit", 50.0, "", "FT-TEST-2"),
            ("2026-08-03 09:10:00", "Transfer", "", -50.0, "TEST-CHALLENGE-1", "TR-TEST-2"),
            ("2026-09-15 18:00:00", "Transfer", "", 20.0, "TEST-CHALLENGE-1", "TR-TEST-3"),
            ("2026-09-20 12:00:00", "Third Party Payment", "Deposit", 25.0, "", "FT-TEST-3"),
            ("2026-09-21 12:00:00", "Third Party Payment", "Withdrawal", -15.0, "Max Test", "FT-TEST-4")]:
        w.writerow([d, typ, unter, "EUR", "Euro", "Everyday", betrag, 1, 0, 0, betrag, gegen, ref])
    # Challenge in Dollar: erst Euro in USD tauschen, dann Challenge kaufen (wie in einer echten Kraken-App)
    w.writerow(["2026-10-07 15:06:00", "Convert", "", "EUR", "Euro", "Everyday", -18.0, 1, 0, 0, -18.0, "", "CV-TEST-1"])
    w.writerow(["2026-10-07 15:06:00", "Convert", "", "USD", "US Dollar", "Everyday", 20.0, 0.9, 0, 0, 18.0, "", "CV-TEST-1"])
    w.writerow(["2026-10-07 15:06:30", "Challenge", "Purchase", "USD", "US Dollar", "Everyday", -20.0, 0.9, 0, 0, -18.0, "", "CH-TEST-1"])
# Konto: Einzahlungen 85, Transfers -60 +20, Abhebung -15, Tausch -18 -> 12; Challenge-Verlust 18 realisiert
soll["11"] = {"konto": 12.0, "verluste": 60.0, "bonus": 20.0, "einsatz": 70.0, "realisiert": -18.0}

# ---------------------------------------------------------------- PDF-Testdateien (ab 0.31)
# Von Hand gebaute PDFs, ohne fremde Bibliothek. Zwei Bauarten, damit beide Wege des PDF-Lesers geprueft sind:
#   "einfach": Standardschrift Helvetica (WinAnsi), unkomprimiert - so schreiben reportlab/FPDF/viele Banken
#   "cid":     eingebettete-Schrift-Art (Type0, Identity-H, ToUnicode), Flate, gespiegelte Matrix - so schreibt Kraken (Typst)
#   objstm=True: Objekte gepackt im Objekt-Strom mit XRef-Strom (PDF 1.5+, Word/Banken)
import zlib

HELV = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278] + [556] * 10 + [278, 278, 584, 584, 584, 556, 1015,
        667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611,
        278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278,
        556, 500, 722, 500, 500, 500, 334, 260, 334, 584]


def pdf_bauen(seiten, art="einfach", objstm=False, gr=7, breite=792, hoehe=612, verschluesselt=False):
    """seiten = [[(x, y_von_oben, text, rechtsbuendig), ...], ...] -> bytes"""
    zeichen = sorted({c for s in seiten for _, _, t, _ in s for c in t})
    cid = {c: i + 1 for i, c in enumerate(zeichen)}
    wb = (lambda t: 0.5 * len(t) * gr) if art == "cid" else (lambda t: sum(HELV[ord(c) - 32] if 32 <= ord(c) < 127 else 556 for c in t) / 1000 * gr)
    objekte = {}                      # nr -> bytes (ohne "obj"-Rahmen) oder (dict-bytes, strom-bytes)
    n_seiten = len(seiten)
    nr_font, nr_cidfont, nr_tu, nr_pages, nr_kat = 1, 2, 3, 4, 5
    if art == "cid":
        cmap = ("/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CMapName /Test def\n/CMapType 2 def\n"
                "1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n")
        ziffern = [c for c in zeichen if c.isdigit()]
        if ziffern != [chr(ord(ziffern[0]) + i) for i in range(len(ziffern))] if ziffern else False:
            ziffern = []              # nicht lueckenlos: alles einzeln
        rest = [c for c in zeichen if c not in ziffern]
        if ziffern:                   # Ziffern als Bereich (bfrange), der Rest einzeln (bfchar)
            cmap += "1 beginbfrange\n<%04X> <%04X> <%04X>\nendbfrange\n" % (cid[ziffern[0]], cid[ziffern[-1]], ord(ziffern[0]))
        cmap += "%d beginbfchar\n" % len(rest) + "".join("<%04X> <%04X>\n" % (cid[c], ord(c)) for c in rest) + "endbfchar\nendcmap\nend\nend\n"
        objekte[nr_font] = b"<</Type/Font/Subtype/Type0/BaseFont/TESTAA+Probe/Encoding/Identity-H/DescendantFonts[2 0 R]/ToUnicode 3 0 R>>"
        objekte[nr_cidfont] = b"<</Type/Font/Subtype/CIDFontType2/BaseFont/TESTAA+Probe/CIDSystemInfo<</Registry(Adobe)/Ordering(Identity)/Supplement 0>>/DW 500/W[0 [600]]>>"
        z = zlib.compress(cmap.encode("latin-1"))
        objekte[nr_tu] = (b"<</Filter/FlateDecode/Length %d>>" % len(z), z)
    else:
        objekte[nr_font] = b"<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>"
        objekte[nr_cidfont] = b"null"
        objekte[nr_tu] = b"null"
    kids = []
    for i, s in enumerate(seiten):
        nr_inh, nr_seite = 6 + 2 * i, 7 + 2 * i
        teile = []
        for x, y, t, rechts in s:
            if rechts:
                x = x - wb(t)
            if art == "cid":
                h = "".join("%04X" % cid[c] for c in t)
                mitte = (len(t) // 2) * 4               # TJ mit Unterschneidung mitten im Wort, wie echte PDFs
                tj = "[<%s> -12 <%s>] TJ" % (h[:mitte], h[mitte:]) if 0 < mitte < len(h) else "[<%s>] TJ" % h
                teile.append("q 1 0 0 -1 0 %d cm BT 1 0 0 -1 %.2f %.2f Tm /f0 %g Tf %s ET Q" % (hoehe, x, y, gr, tj))
            else:
                roh = t.encode("cp1252")
                lit = "".join("\\%03o" % b if b > 126 or b < 32 else ("\\" + chr(b) if chr(b) in "()\\" else chr(b)) for b in roh)
                teile.append("BT /f0 %g Tf %.2f %.2f Td (%s) Tj ET" % (gr, x, hoehe - y, lit))
        inhalt = ("\n".join(teile) + "\n").encode("latin-1")
        if not s:                                       # Seite ohne Text: nur ein Rechteck (wie ein Scan)
            inhalt = b"0.9 g 50 50 300 200 re f\n"
        if art == "cid":
            z = zlib.compress(inhalt)
            objekte[nr_inh] = (b"<</Filter/FlateDecode/Length %d>>" % len(z), z)
        else:
            objekte[nr_inh] = (b"<</Length %d>>" % len(inhalt), inhalt)
        objekte[nr_seite] = b"<</Type/Page/Parent 4 0 R/MediaBox[0 0 %d %d]/Contents %d 0 R/Resources<</Font<</f0 1 0 R>>>>>>" % (breite, hoehe, nr_inh)
        kids.append(nr_seite)
    objekte[nr_pages] = b"<</Type/Pages/Count %d/Kids[%s]>>" % (n_seiten, " ".join("%d 0 R" % k for k in kids).encode())
    objekte[nr_kat] = b"<</Type/Catalog/Pages 4 0 R>>"
    aus = bytearray(b"%PDF-1.7\n%\xe2\xe3\xcf\xd3\n")
    lage = {}

    def schreibe(nr, o):
        lage[nr] = len(aus)
        if isinstance(o, tuple):
            aus.extend(b"%d 0 obj\n%s\nstream\n" % (nr, o[0]) + o[1] + b"\nendstream\nendobj\n")
        else:
            aus.extend(b"%d 0 obj\n%s\nendobj\n" % (nr, o))

    groesse = max(objekte) + 1
    if not objstm:
        for nr in sorted(objekte):
            schreibe(nr, objekte[nr])
        xref = len(aus)
        aus.extend(b"xref\n0 %d\n0000000000 65535 f \n" % groesse + b"".join(b"%010d 00000 n \n" % lage[n] for n in range(1, groesse)))
        aus.extend(b"trailer\n<</Size %d/Root 5 0 R%s>>\nstartxref\n%d\n%%%%EOF\n" % (groesse, b"/Encrypt 99 0 R" if verschluesselt else b"", xref))
        return bytes(aus)
    # Objekt-Strom: alles ausser den Stroemen selbst
    gepackt = [n for n in sorted(objekte) if not isinstance(objekte[n], tuple)]
    koerper, kopf = b"", []
    for n in gepackt:
        kopf.append("%d %d" % (n, len(koerper)))
        koerper += objekte[n] + b"\n"
    kopf_b = (" ".join(kopf) + "\n").encode()
    nr_os, nr_xr = groesse, groesse + 1
    z = zlib.compress(kopf_b + koerper)
    for nr in sorted(objekte):
        if isinstance(objekte[nr], tuple):
            schreibe(nr, objekte[nr])
    schreibe(nr_os, (b"<</Type/ObjStm/N %d/First %d/Filter/FlateDecode/Length %d>>" % (len(gepackt), len(kopf_b), len(z)), z))
    xref = len(aus)
    zeilen = b"\x00" + (0).to_bytes(4, "big") + b"\xff\xff"
    for n in range(1, nr_xr + 1):
        if n in gepackt:
            zeilen += b"\x02" + nr_os.to_bytes(4, "big") + gepackt.index(n).to_bytes(2, "big")
        else:
            zeilen += b"\x01" + (xref if n == nr_xr else lage[n]).to_bytes(4, "big") + b"\x00\x00"
    zx = zlib.compress(zeilen)
    aus.extend(b"%d 0 obj\n<</Type/XRef/Size %d/W[1 4 2]/Root 5 0 R/Filter/FlateDecode/Length %d>>\nstream\n" % (nr_xr, nr_xr + 1, len(zx)) + zx
               + b"\nendstream\nendobj\nstartxref\n%d\n%%%%EOF\n" % xref)
    return bytes(aus)


# 14 - Kraken "Account Statement" als PDF (Aufbau wie das Original: 3 Textzeilen je Buchung, 2 Seiten)
def kraken_pdf():
    kopf_s = lambda: [(767, 30, "Account Statement: Mar 01, 2026 - Mar 31, 2026", True),
                      (767, 42, "All portfolio balances are recorded as of 2026-03-31 23:59:59 UTC", True)]
    spalten_a = [(31, "Date (UTC)", False), (87, "Type", False), (129, "Asset", False), (164, "Wallet", False), (328, "Amount", True),
                 (422, "Price (EUR)", True), (511, "Fee (EUR)", True), (607, "Value (EUR)", True), (620, "Reference", False)]

    def buchung(y, tag, uhr, typ, unter, asset, menge, kurs, geb, wert, ref):
        z = [(31, y, tag, False), (164, y, "Spot", False), (31, y + 16, uhr, False), (164, y + 16, "Main", False),
             (129, y + 8, asset, False), (328, y + 8, menge, True), (422, y + 8, kurs, True), (511, y + 8, geb, True), (607, y + 8, wert, True), (620, y + 8, ref, False)]
        z += [(87, y, typ, False), (87, y + 16, unter, False)] if unter else [(87, y + 8, typ, False)]
        return z

    s1 = kopf_s() + [(25, 80, "Max Mustermann", False), (25, 92, "Kraken Public ID:", False), (25, 104, "AA00 TEST TEST 0000", False), (25, 140, "Portfolio", False)]
    pk = ["Asset", "Wallet", "Open Qty", "Open Price (EUR)", "Open Value (EUR)", "Close Qty", "Close Price (EUR)", "Close Value (EUR)", "Net Change (EUR)"]
    px = [31, 85, 205, 299, 394, 472, 567, 664, 761]
    s1 += [(x, 160, t, i > 1) for i, (x, t) in enumerate(zip(px, pk))]
    for j, r in enumerate([["BTC", "Spot", "0.01000000", "50000.0000", "500.0000", "0.01002400", "51000.0000", "511.2240", "11.2240"],
                           ["ETH", "Spot", "0.50000000", "2000.0000", "1,000.0000", "0.50000000", "1900.0000", "950.0000", "-50.0000"],
                           ["EUR", "Spot", "100.0000", "1", "100.0000", "80.0000", "1", "80.0000", "-20.0000"]]):
        s1 += [(x, 176 + 16 * j, t, i > 1) for i, (x, t) in enumerate(zip(px, r))]
    s1 += [(31, 224, "Total", False), (394, 224, "1,600.0000", True), (664, 224, "1,541.2240", True), (761, 224, "-58.7760", True)]
    s1 += [(25, 250, "Stock Portfolio", False)] + [(x, 266, t, i > 1) for i, (x, t) in enumerate(zip(px, pk))] + [(350, 282, "Account has no balances", False)]
    s1 += [(25, 310, "Activity", False)] + [(x, 330, t, r) for x, t, r in spalten_a]
    s1 += buchung(350, "2026-03-03", "10:00:01", "Transfer", "", "EUR", "50.0000", "1", "0", "50.0000", "TRTEST-AAAA1-000001")
    s1 += buchung(380, "2026-03-07", "02:07:22", "Earn", "Reward", "BTC", "0.00001000", "52345.6000", "0.1047", "0.5235", "ELTEST-AAAA1-000002")
    s1 += buchung(410, "2026-03-10", "13:06:16", "Instant", "Spend", "EUR", "-60.0000", "1", "0", "-60.0000", "TSTEST-AAAA1-000003")
    s1 += buchung(440, "2026-03-10", "13:06:16", "Instant", "Receive", "USD", "64.0000", "0.9300", "0.4650", "59.5200", "TSTEST-AAAA1-000003")
    s1 += buchung(470, "2026-03-10", "13:06:18", "Transfer", "", "USD", "-63.5000", "0.9300", "0", "-59.0550", "TRTEST-AAAA1-000005")
    s1 += [(767, 590, "Page 1/2", True)]
    s2 = kopf_s() + [(x, 70, t, r) for x, t, r in spalten_a]
    s2 += buchung(90, "2026-03-14", "02:07:27", "Earn", "Reward", "BTC", "0.00002000", "51000.0000", "0.2040", "1.0200", "ELTEST-AAAA1-000006")
    s2 += buchung(120, "2026-03-20", "09:30:00", "Transfer", "", "EUR", "-10.0000", "1", "0", "-10.0000", "TRTEST-AAAA1-000007")
    s2 += [(25, 180, "Disclaimer:", False), (25, 196, "This is an invented test statement and contains no real data.", False), (767, 590, "Page 2/2", True)]
    return pdf_bauen([s1, s2], art="cid")


(AUS / "14_kraken_kontoauszug.pdf").write_bytes(kraken_pdf())
# Anfang BTC 0,01 (500 EUR) + ETH 0,5 (1000 EUR) + 100 EUR. Ertraege 0,00003 BTC brutto, Gebuehr 0,000006 BTC -> 0,010024 (= Close Qty).
# Konto: 100 + 50 (Transfer rein) - 60 (Tausch in Dollar) - 10 (Transfer raus) = 80. Dollar: 63,5 netto fuer 60 EUR, dann Transfer = Verlust 60.
soll["14"] = {"buchungen": 9, "btc": 0.010024, "eth": 0.5, "einstand": 1500.0, "konto": 80.0, "verluste": 10.0, "bonus": 50.0, "realisiert": -60.0}

# 15 - Bank-Kontoauszug als PDF (unbekanntes Format): Tabelle -> "Spalten zuordnen". Deutsche Zahlen, Umlaute, Folgezeile.
def bank_pdf(**kw):
    s = [(50, 40, "Musterbank AG – Kontoauszug 03/2026", False), (50, 60, "Kontoinhaber: Max Mustermann", False),
         (50, 100, "Buchungstag", False), (140, 100, "Verwendungszweck", False), (520, 100, "Betrag (EUR)", True),
         (50, 120, "02.03.2026", False), (140, 120, "Gehalt März Müller GmbH", False), (520, 120, "2.500,00", True),
         (50, 140, "05.03.2026", False), (100, 140, "Miete Wohnung", False), (520, 140, "-850,00", True),   # dicht am Datum: eine breite Zelle (wie Sparkasse)
         (140, 152, "Dauerauftrag 0815", False),
         (50, 172, "17.03.2026", False), (140, 172, "Übertrag Sparkonto (Rücklage)", False), (520, 172, "-1.200,50", True),
         (50, 400, "Bitte prüfen Sie den Auszug. Einwendungen innerhalb von sechs Wochen.", False)]
    return pdf_bauen([s], gr=9, breite=595, hoehe=842, **kw)


(AUS / "15a_bank_kontoauszug_einfach.pdf").write_bytes(bank_pdf(art="einfach"))
(AUS / "15b_bank_kontoauszug_gepackt.pdf").write_bytes(bank_pdf(art="cid", objstm=True))
soll["15"] = {"konto": 449.5, "buchungen": 3}
# 16 - PDFs, die nicht gehen: Scan (kein Text) und Passwortschutz -> klare Meldung statt Absturz
(AUS / "16a_scan_ohne_text.pdf").write_bytes(pdf_bauen([[]]))
(AUS / "16b_passwort.pdf").write_bytes(pdf_bauen([[(50, 50, "Geheim 01.01.2026 Betrag 5,00", False)]], verschluesselt=True))


# 17 - Bank-Auszug mit zweizeiligem Kopf, Euro-Zeichen an der Zahl, laufendem Guthaben (Aufbau wie Revolut "Individueller Auszug")
def revolut_pdf():
    s = [(560, 30, "Individueller Auszug", True), (560, 42, "01.03.2026 - 31.03.2026", True), (50, 70, "Revolut Bank UAB (Testdaten)", False),
         (330, 100, "Eröffnungskontostand", False), (560, 100, "10,00€", True), (330, 114, "Schlussguthaben", False), (560, 114, "64,51€", True),
         (320, 150, "Geld ein-", False), (50, 160, "Datum", False), (120, 160, "Beschreibung", False), (240, 160, "Kategorie", False), (400, 160, "Guthaben", False),
         (500, 160, "Gebühren", False), (320, 170, "/ausgezahlt", False)]
    for i, (d, t, k, b, g) in enumerate([("02.03.2026", "Zahlung von MAX TEST", "Geld einzahlen", "80,00€", "90,00€"), ("05.03.2026", "Supermarkt Müller", "Händler", "-19,99€", "70,01€"),
                                         ("20.03.2026", "Kartengebühr", "Händler", "-5,50€", "64,51€")]):
        y = 190 + 16 * i
        s += [(50, y, d, False), (120, y, t, False), (240, y, k, False), (320, y, b, False), (400, y, g, False), (500, y, "0,00€", False)]
    s += [(50, 240, "Gesamt", False), (320, 240, "54,51€", False)]
    return pdf_bauen([s], art="cid", gr=8, breite=595, hoehe=842)


(AUS / "17_bank_zweizeiliger_kopf.pdf").write_bytes(revolut_pdf())
soll["17"] = {"konto": 64.51, "buchungen": 4, "karte": 19.99, "gebuehren": 5.5}

# 18 - Verrechnungskonto eines Brokers als PDF: Belastung/Gutschrift, Kauf/Verkauf/Ausschuettung mit ISIN in der Folgezeile, Steuer
def broker_pdf():
    s = [(50, 40, "Testbroker Bank GmbH – Kontoauszug", False), (50, 60, "Zeitraum 01.04.2026 - 30.04.2026", False),
         (50, 90, "Kontostand am 01.04.2026", False), (300, 90, "100,00 EUR", True), (50, 104, "Kontostand am 30.04.2026", False), (300, 104, "414,50 EUR", True),
         (50, 140, "Buchungstag", False), (130, 140, "Erläuterungen", False), (330, 140, "Valuta", False), (460, 140, "Belastung", True), (545, 140, "Gutschrift", True),
         (460, 150, "in EUR", True), (545, 150, "in EUR", True)]
    y = 170
    for d, t, folge, soll_, haben in [("02.04.2026", "Überweisung", "", "", "500,00"), ("03.04.2026", "Kauf eines Finanzinstruments", "3,00 Stk. Test AG (DE000TEST014)", "300,00", ""),
                                      ("15.04.2026", "Kapitalmaßnahme Ausschüttungen", "Test AG (DE000TEST014)", "", "6,00"), ("15.04.2026", "Kapitalertragssteuer", "", "1,50", ""),
                                      ("28.04.2026", "Verkauf eines Finanzinstruments", "1,00 Stk. Test AG (DE000TEST014)", "", "110,00")]:
        s += [(50, y, d, False), (130, y, t, False), (330, y, d, False)] + ([(460, y, soll_, True)] if soll_ else []) + ([(545, y, haben, True)] if haben else [])
        if folge:
            y += 11
            s += [(130, y, folge, False)]
        y += 20
    s += [(50, y + 10, "Kontostand in EUR am 30.04.2026", False), (545, y + 10, "414,50", True)]
    return pdf_bauen([s], art="einfach", gr=9, breite=595, hoehe=842)


(AUS / "18_broker_verrechnungskonto.pdf").write_bytes(broker_pdf())
soll["18"] = {"konto": 414.5, "stueck": 2.0, "realisiert": 10.0, "dividenden": 6.0, "buchungen": 6}

# 19 - Kraken doppelt als PDF: Ledger-PDF (gerundet, ohne refid) und der Kaufbeleg desselben Kaufs -> Beleg wird als doppelt erkannt
def kraken_ledger_pdf():
    sp = [(40, "Unique ID", False), (190, "Time (UTC)", False), (270, "Type", False), (340, "Asset", False), (390, "Wallet", False), (510, "Amount", True), (580, "Fee", True), (700, "Resulting Balance", True)]
    s = [(700, 30, "Statement Period: Aug 01, 2026 - Aug 31, 2026", True), (40, 50, "Payward Ireland Limited", False), (300, 50, "Max Mustermann", False)] + [(x, 80, t, r) for x, t, r in sp]
    y = 100
    for uid, tag, uhr, typ, unter, asset, menge, geb, saldo in [("LTEST1-AAAAA-BBBBB1", "2026-08-19", "10:00:00", "Deposit", "", "EUR", "5.0000", "0", "5.0000"),
                                                                ("LTEST2-AAAAA-BBBBB2", "2026-08-20", "18:40:00", "Instant", "Spend", "EUR", "-0.9901", "0.0099", "4.0000"),
                                                                ("LTEST3-AAAAA-BBBBB3", "2026-08-20", "18:40:00", "Instant", "Receive", "ADA", "5.7551", "0", "5.7551"),
                                                                ("LTEST4-AAAAA-BBBBB4", "2026-08-26", "02:07:17", "Earn", "Reward", "ADA", "0.0030", "0.0009", "5.7572")]:
        s += [(190, y, tag, False), (270, y, typ, False), (40, y + 8, uid, False), (340, y + 8, asset, False), (390, y + 8, "Spot / Main", False), (510, y + 8, menge, True),
              (580, y + 8, geb, True), (700, y + 8, saldo, True), (190, y + 16, uhr, False)] + ([(270, y + 16, unter, False)] if unter else [])
        y += 30
    s += [(700, 590, "Page 1 of 1", True)]
    return pdf_bauen([s], art="cid")


def kraken_beleg_pdf():
    z = ["Du hast ADA gekauft", "Von Kraken <noreply@example.com>", "Datum Donnerstag, 20. August 2026 um 18:40", "Du hast ADA gekauft",
         "Deinem Kontoguthaben wurden insgesamt 5,755063 ADA hinzugefügt.", "Hier sind die Details:", "€1 mit Kontoguthaben bezahlt", "Transaktions-ID: TESTID1",
         "Datum: 20.08.2026", "ADA-Preis: €0,172", "Gebühren: €0,01"]
    return pdf_bauen([[(60, 60 + 18 * i, t, False) for i, t in enumerate(z)]], art="einfach", gr=10, breite=595, hoehe=842)


(AUS / "19a_kraken_ledger.pdf").write_bytes(kraken_ledger_pdf())
(AUS / "19b_kraken_kaufbeleg.pdf").write_bytes(kraken_beleg_pdf())
# Ledger: 5 EUR rein, Kauf 5,7551 ADA fuer 1,00 EUR (0,9901 + 0,0099 Gebuehr), Ertrag 0,0030 - 0,0009 -> 5,7572 ADA, Konto 4,00 EUR
soll["19"] = {"ada": 5.7572, "konto": 4.0, "buchungen": 3}

# 20 - Trade Republic "Kontoauszug" als PDF: Datum ueber 3 Zeilen (Tag / Monat / Jahr), Beschreibung teils VOR dem Tag,
#      "quantity" teils UNTER dem Jahr, Ein-/Ausgang in zwei dicht beieinander stehenden Spalten (wie im Original)
def tr_pdf():
    s = [(50, 30, "TRADE REPUBLIC BANK GMBH BRUNNENSTRASSE 19-21 10119 BERLIN", False), (50, 60, "MAX MUSTERMANN", False),
         (380, 60, "DATUM 01 März 2026 - 30 Apr. 2026", False), (50, 100, "KONTOÜBERSICHT", False),
         (50, 120, "PRODUKT", False), (140, 120, "ANFANGSSALDO", False), (240, 120, "ZAHLUNGSEINGANG", False), (360, 120, "ZAHLUNGSAUSGANG", False), (500, 120, "ENDSALDO", False),
         (50, 134, "Cashkonto", False), (140, 134, "0,00 €", False), (240, 134, "1.066,10 €", False), (360, 134, "415,00 €", False), (500, 134, "651,10 €", False),
         (50, 170, "UMSATZÜBERSICHT", False),
         (50, 190, "DATUM", False), (80, 190, "TYP", False), (140, 190, "BESCHREIBUNG", False), (330, 190, "ZAHLUNGSEINGANG", False), (393, 190, "ZAHLUNGSAUSGANG", False), (500, 190, "SALDO", False)]
    y = 214
    def eintrag(tag, monat, jahr, typ, vorher, mitte, nachher, ein, aus_, saldo):
        nonlocal y
        z = []
        if vorher: z.append((140, y - 4, vorher, False))
        z += [(50, y - 8, tag, False), (50, y, monat, False), (80, y, typ, False), (50, y + 8, jahr, False), (546, y, saldo, True)]
        if mitte: z.append((140, y, mitte, False))
        if nachher: z.append((140, y + 12, nachher, False))
        if ein: z.append((385, y, ein, True))
        if aus_: z.append((450, y, aus_, True))
        y += 32
        return z
    s += eintrag("02", "März", "2026", "Überweisung", "", "Incoming transfer from Max Test", "", "1.000,00 €", "", "1.000,00 €")
    s += eintrag("03", "März", "2026", "Handel", "Buy trade DE000TEST020 TEST AG, quantity: 4", "", "", "", "200,00 €", "800,00 €")
    s += eintrag("05", "März", "2026", "Handel", "Savings plan execution IE000TEST203 Test", "MSCI World UCITS ETF Acc, quantity:", "0.5", "", "50,00 €", "750,00 €")
    s += eintrag("10", "März", "2026", "Kartentransaktion", "", "Bäckerei Müller", "", "", "5,00 €", "745,00 €")
    s += eintrag("01", "Apr.", "2026", "Zinsen", "", "Interest payment", "", "1,10 €", "", "746,10 €")
    s += eintrag("15", "Apr.", "2026", "Handel", "", "Sell trade DE000TEST020 TEST AG, quantity: 1", "", "60,00 €", "", "806,10 €")
    s += eintrag("20", "Apr.", "2026", "Ertrag", "", "Cash Dividend for ISIN DE000TEST020", "", "5,00 €", "", "811,10 €")
    s += eintrag("28", "Apr.", "2026", "Überweisung", "", "Outgoing transfer for Max Test", "", "", "100,00 €", "711,10 €")
    s += [(50, 780, "Trade Republic Bank GmbH www.traderepublic.com", False), (480, 800, "Seite 1 von 2", False)]
    s2 = [(50, 30, "TRADE REPUBLIC BANK GMBH BRUNNENSTRASSE 19-21 10119 BERLIN", False),
          (50, 60, "DATUM", False), (80, 60, "TYP", False), (140, 60, "BESCHREIBUNG", False), (330, 60, "ZAHLUNGSEINGANG", False), (393, 60, "ZAHLUNGSAUSGANG", False), (500, 60, "SALDO", False)]
    y = 84
    s2 += eintrag("30", "Apr.", "2026", "Gebühr", "", "Trade Republic Card", "", "", "60,00 €", "651,10 €")
    s2 += [(50, 140, "BARMITTELÜBERSICHT", False), (480, 800, "Seite 2 von 2", False)]
    return pdf_bauen([s, s2], art="cid", gr=6.8, breite=595, hoehe=842)


(AUS / "20_traderepublic_kontoauszug.pdf").write_bytes(tr_pdf())

# 23 Einzel-Abrechnungen (PDF) je Broker - erfundene Werte, Aufbau wie die echten Abrechnungen (ab 0.49)
def abr_pdf(zeilen):
    return pdf_bauen([[(40, 40 + i * 12, z, False) for i, z in enumerate(zeilen)]], breite=600, hoehe=800)
ABR = {
  "23a_scalable_kauf.pdf": ["Scalable Capital Bank GmbH • Teststraße 1 • 80000 München", "Datum 03.11.2026", "Wertpapierabrechnung", "für Kundenauftrag",
      "Ausführung 03.11.2026 10:15:00 Geschäft 1", "Typ Wertpapier Anzahl Kurs Betrag", "Kauf Test Welt ETF Acc 12,00 Stk. 25,50 EUR 306,00 EUR", "IE000TEST231",
      "Ordergebühren +0,99 EUR", "Belastung 306,99 EUR"],
  "23b_smartbroker_verkauf.pdf": ["Wertpapierabrechnung", "Verkauf Kommissionsgeschäft", "Wir haben für Sie verkauft", "Gattungsbezeichnung ISIN",
      "Test Maschinenbau AG Inhaber-Aktien o.N. DE000TEST232", "Nominal Kurs", "STK 20,000 EUR 50,0000", "Handelstag 04.11.2026 Kurswert EUR 1.000,00",
      "Handelszeit 11:00* Provision EUR 4,00-", "Börse Tradegate Kapitalertragsteuer EUR 25,00-", "Verwahrart Girosammelverwahrung Solidaritätszuschlag EUR 1,37-",
      "Wert Konto-Nr. Betrag zu Ihren Gunsten", "06.11.2026 0000000000 EUR 969,63", "im laufenden Jahr einbehaltene Kapitalertragsteuer EUR 99,00",
      "BNP Paribas S.A. Niederlassung Deutschland"],
  "23c_baader_kauf.pdf": ["Scalable Capital Vermögensverw.GmbH", "Wertpapierabrechnung: Kauf", "Auftragsdatum: 05.11.2026 Beauftragter Ausführungsplatz: XETRA",
      "Nominale ISIN: DE000TEST233 WKN: TEST23 Kurs", "STK 5 Test Chemie SE EUR 80,00", "Kurswert EUR 400,00", "Provision EUR 0,99",
      "Zu Lasten Konto 00000000 Valuta: 07.11.2026 EUR 400,99", "Handelsdatum Handelsuhrzeit", "05.11.2026 09:30:00:00", "Baader Bank Aktiengesellschaft"],
  "23d_traderepublic_verkauf.pdf": ["TRADE REPUBLIC BANK GMBH TESTSTRASSE 1 10000 BERLIN", "WERTPAPIERABRECHNUNG", "Market-Order Verkauf am 06.11.2026, um 15:00 Uhr an der Testbörse.",
      "POSITION ANZAHL KURS BETRAG", "Test Software Inc. 10 Stk. 120,00 EUR 1.200,00 EUR", "Registered Shares DL -,01", "US000TEST234", "GESAMT 1.200,00 EUR", "ABRECHNUNG",
      "Fremdkostenzuschlag -1,00 EUR", "Kapitalertragssteuer -50,00 EUR", "Solidaritätszuschlag -2,75 EUR", "GESAMT 1.146,25 EUR"],
  "23e_revolut_kauf.pdf": ["Trade Confirmation", "Revolut Securities Europe UAB", "Confirmation date 07 Nov 2026", "Order details",
      "Symbol Security Name ISIN Type Quantity Unit Price Total Amount Settlement date", "TST Test Global ETF (Acc) IE000TEST235 Buy 4.5 €20.00 €90 11 Nov 2026",
      "Fees summary", "Commission €0", "Total Fee charged €0"],
}
for n, z in ABR.items():
    (AUS / n).write_bytes(abr_pdf(z))
# Konto: +1000 -200 -50 -5 +1,10 +60 +5 -100 -60 = 651,10. Test AG: 4 - 1 = 3 Stueck, Einstand 150, realisiert 60 - 50 = 10. ETF 0,5. Dividende 5.
soll["20"] = {"konto": 651.1, "test_ag": 3.0, "etf": 0.5, "realisiert": 10.0, "dividenden": 5.0, "buchungen": 9}


# ---------------------------------------------------------------- 22 Screenshots im Trade-Republic-Stil (ab 0.42, erfunden)
# Dunkler Hintergrund, graue Beschriftungen, weisse Werte - wie die TR-App. Danach der Wochen-Export (CSV) mit denselben
# Trades: er muss die Screenshot-Buchungen ERSETZEN (keine Doppelten).
import cairo


def tr_screenshot(datei, kopf, zeit, art, asset, stueck, kurs, zeilen):
    w, h = 903, 1300
    s = cairo.ImageSurface(cairo.FORMAT_RGB24, w, h)
    c = cairo.Context(s)
    c.set_source_rgb(0, 0, 0); c.paint()

    def text(x, y, t, groesse, farbe, fett=False, rechts=False):
        c.select_font_face("DejaVu Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if fett else cairo.FONT_WEIGHT_NORMAL)
        c.set_font_size(groesse); c.set_source_rgb(*farbe)
        if rechts:
            x = x - c.text_extents(t).x_advance
        c.move_to(x, y); c.show_text(t)
    weiss, grau, gruen = (1, 1, 1), (0.47, 0.47, 0.49), (0.2, 0.85, 0.3)
    text(70, 60, "20:11", 26, weiss)
    text(70, 350, kopf, 44, weiss, True)
    text(70, 410, zeit, 28, grau)
    text(70, 550, "Übersicht", 30, weiss, True)
    y = 640
    for label, wert, farbe in [(art, "Ausgeführt", gruen), ("Asset", asset, weiss)]:
        text(70, y, label, 30, grau); text(833, y, wert, 30, farbe, True, True); y += 88
    text(70, y, "Transaktion  >", 30, grau)
    preis = kurs + " €"
    c.select_font_face("DejaVu Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD); c.set_font_size(30)
    breite = c.text_extents(preis).x_advance
    text(833, y, preis, 30, weiss, True, True); text(833 - breite - 18, y, stueck + " ×", 30, grau, False, True); y += 88
    for label, wert in zeilen:
        text(70, y, label, 30, grau); text(833, y, wert, 30, weiss, True, True); y += 88
    s.write_to_png(str(AUS / datei))


tr_screenshot("22a_Screenshot_20260315-123506_Trade Republic.png", "Du hast 501,00 € investiert", "Heute · 12:34", "Kauf", "Test Energy",
              "4", "125,00", [("Gebühr", "1,00 €"), ("Summe", "501,00 €")])
tr_screenshot("22b_Screenshot_20260320-201113_Trade Republic.png", "Du hast 194,00 € erhalten", "Gestern · 20:10", "Verkaufen", "Test Energy",
              "1,5", "130,00", [("Steuer  >", "0,00 €"), ("Gebühr", "1,00 €"), ("Summe", "194,00 €")])
tr_screenshot("22d_Screenshot_20260321-101500_Trade Republic.png", "Du hast 251,00 € investiert", "Heute · 10:14", "Kauf", "Test Turbo Short",
              "50", "5,00", [("Gebühr", "1,00 €"), ("Summe", "251,00 €")])

# 24 Screenshots anderer Broker (ab 0.49): erfundene Werte, typische Detail-Ansicht "Bezeichnung links, Wert rechts"
def app_screenshot(datei, kopf, zeilen, dunkel=False):
    w, h = 903, 1500
    s = cairo.ImageSurface(cairo.FORMAT_RGB24, w, h)
    c = cairo.Context(s)
    grund, haupt, leise = ((0.07, 0.07, 0.09), (1, 1, 1), (0.6, 0.6, 0.65)) if dunkel else ((1, 1, 1), (0.08, 0.08, 0.1), (0.42, 0.42, 0.46))
    c.set_source_rgb(*grund); c.paint()
    def text(x, y, tx, groesse, farbe, fett=False, rechts=False):
        c.select_font_face("DejaVu Sans", cairo.FONT_SLANT_NORMAL, cairo.FONT_WEIGHT_BOLD if fett else cairo.FONT_WEIGHT_NORMAL)
        c.set_font_size(groesse); c.set_source_rgb(*farbe)
        if rechts:
            x = x - c.text_extents(tx).x_advance
        c.move_to(x, y); c.show_text(tx)
    text(70, 60, "10:42", 26, haupt)
    y = 200
    for k in kopf:
        text(70, y, k, 40 if y == 200 else 32, haupt, y == 200); y += 70
    y += 50
    for label, wert in zeilen:
        text(70, y, label, 30, leise); text(833, y, wert, 30, haupt, True, True); y += 84
    s.write_to_png(str(AUS / datei))


app_screenshot("24a_Screenshot_20261108-101800_Scalable.png", ["Kauf · Ausgeführt", "Test Industrie AG", "DE000TEST241"],
               [("Stück", "15"), ("Ausführungskurs", "42,00 €"), ("Ordervolumen", "630,00 €"), ("Ordergebühren", "0,99 €"), ("Gesamt", "630,99 €"),
                ("Ausgeführt am", "08.11.2026 10:15"), ("Handelsplatz", "gettex")])
app_screenshot("24b_Screenshot_20261109-140500_Smartbroker.png", ["Aktivität", "Verkauf", "Test Pharma SE", "DE000TEST242"],
               [("Handelsplatz", "Tradegate"), ("Ausführungskurs", "18,50 EUR"), ("Ausführungszeit", "09.11.2026 14:02"), ("Stückzahl", "40"),
                ("Kurswert", "740,00 EUR"), ("Provision", "4,00 EUR"), ("Endbetrag", "736,00 EUR")], dunkel=True)
app_screenshot("24d_Screenshot_20261111-080000_Kraken.png", ["Buy BTC", "Bitcoin"],
               [("Amount", "0.01 BTC"), ("Price", "€60,000.00"), ("Fee", "€1.50"), ("Total", "€601.50"), ("Date", "11 Nov 2026")], dunkel=True)
app_screenshot("24e_Screenshot_20261112-190000_Bitvavo.png", ["Gekauft", "Cardano"],
               [("Menge", "500 ADA"), ("Preis", "0,40 €"), ("Gebühr", "0,50 €"), ("Gesamt", "200,50 €"), ("Datum", "12.11.2026")])
app_screenshot("24c_Screenshot_20261110-091200_Revolut.png", ["Bought", "Test Robotics Inc"],
               [("Quantity", "3"), ("Price", "€150.00"), ("Fees", "€0.00"), ("Total", "€450.00"), ("Date", "10 Nov 2026")], dunkel=True)
# Wochen-Export mit denselben Trades (mit ISIN, TR-Format)
tr_schreiben("22c_traderepublic_export.csv", [
    tr_zeile(221, "2026-03-15", "TRADING", "BUY", "STOCK", "TEST ENERGY AG", "DE000TEST221", "4", "125.00", "-500.00", "-1.00"),
    tr_zeile(222, "2026-03-19", "TRADING", "SELL", "STOCK", "TEST ENERGY AG", "DE000TEST221", "-1.5", "130.00", "195.00", "-1.00")])
# Bestand 2,5 Stueck; Einstand 501 * 2,5/4; realisiert = 1,5*130 - 1 - 501*1,5/4
soll["22"] = {"stueck": 2.5, "einstand": round(501 * 2.5 / 4, 6), "realisiert": round(1.5 * 130 - 1 - 501 * 1.5 / 4, 6),
              "datum_kauf": "2026-03-15", "datum_verkauf": "2026-03-19"}

(AUS / "erwartet.json").write_text(json.dumps(soll, indent=1, ensure_ascii=False), encoding="utf-8")
fmt = lambda x: f"{x:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
(AUS / "TESTFAELLE.txt").write_text(f"""TESTFÄLLE – Depot-Kompass (erfundene Daten)
Am besten NACH dem großen Test. Für die Fälle 2–10 im Import-Feld „Konto für diese Datei“
jeweils  Test 2,  Test 3 …  eintragen → jeder Fall bekommt sein eigenes Depot (danach löschbar).

 1  Doppelt importieren    6_traderepublic_daytrading.csv (großer Test) NOCHMAL importieren (Konto NICHT ändern)
                           → Vorschau: alle Zeilen „schon importiert“, 0 neue Buchungen.
 2  Excel-Datei            02_excel_umgespeichert.csv (Semikolon, Komma, so speichert Excel)
                           → wird als Trade Republic erkannt; realisiert {fmt(soll['2']['realisiert'])} €, Konto {fmt(soll['2']['konto'])} €, 0,0125 BTC
 3  Sonderzeichen/Angriff  03_sonderzeichen_und_angriff.csv – Name enthält HTML-Code
                           → Name steht als Text da (Müller & Söhne …), nichts passiert, kein Bild, kein Popup
 4  Mehr verkauft als da   04_mehr_verkauft_als_gekauft.csv (Kauf fehlt in der Datei)
                           → Warnung in der Übersicht, kein Minus-Bestand, realisiert {fmt(soll['4']['realisiert'])} € (nur auf den vorhandenen 10 Stück)
 5  Neu gekauft            05_verkauft_und_neu_gekauft.csv
                           → 8 Stück, Ø Kaufkurs {fmt(soll['5']['kaufkurs'])} € (fängt neu an), realisiert {fmt(soll['5']['realisiert'])} €
 6  Storno/Steuer/Dividende 06_storno_steuer_dividende.csv (Smartbroker)
                           → Storno übersprungen; 25 Stück, Einstand {fmt(soll['6']['einstand'])} €, realisiert {fmt(soll['6']['realisiert'])} €, Dividende netto {fmt(soll['6']['dividenden'])} €
 7  Leere Datei            07_leer_nur_kopfzeile.csv → Meldung „keine Buchungen“, kein Absturz
 8  Kontoauszug           08_falsches_format_kontoauszug.csv → Seite „Spalten zuordnen“ (Vorschlag passt), als Kontoauszug: Konto −89,00 €
12  Unbekannter Broker     12_unbekannter_broker.csv → „Spalten zuordnen“: Vorschlag übernehmen, „Depotentgelt“ = Gebühr
                           → 18 Stück, Dividende netto 26,50 €; beim zweiten Mal erkennt die App das Format von selbst
 9  Riesendatei            09_riesendatei_20000_zeilen.csv (20.000 Zeilen, 10 Jahre Daytrading)
                           → dauert ein paar Sekunden; realisiert {fmt(soll['9']['realisiert'])} €; Kalender „Gewinn/Verlust je Tag“ blättern
11  Kraken-App         11_kraken_app_aktivitaeten.csv (Konto „Test 11“) – Vorschau „Transfers als Verlust“
                           → Konto 12,00 €, Verluste (Transfers) 60,00 €, Gutschriften 20,00 €, Challenge in $: realisiert −18,00 €; eingesetzt 70 €
13  Bestand + Historie    13a_bestand_stichtag.csv, dann 13b_aeltere_transaktionen.csv INS SELBE Depot („Test 13“)
                           → „Bestand zurückrechnen“: 15 Stück wie im Bestand, Verlauf ab 09.01.2025, realisiert +15,24 €
14  Kraken-PDF            14_kraken_kontoauszug.pdf (Konto „Test 14“) – Kontoauszug als PDF, wie ihn die Kraken-App liefert
                           → 9 Buchungen: Anfangsbestand + Erträge + Transfers; 0,010024 BTC, 0,5 ETH, Konto 80,00 €, Verluste 10,00 €, Dollar-Transfer: realisiert −60,00 €
15  Bank-PDF              15a_bank_kontoauszug_einfach.pdf oder 15b_bank_kontoauszug_gepackt.pdf → wird direkt als Kontoauszug erkannt: Konto 449,50 €
17  Bank-PDF, 2-zeiliger Kopf  17_bank_zweizeiliger_kopf.pdf → Konto 64,51 €, Vorschau: „Gegenprobe … stimmt“
18  Broker-Konto als PDF  18_broker_verrechnungskonto.pdf → 2 Stück Test AG, realisiert +10,00 €, Dividende 6,00 €, Konto 414,50 €
20  Trade Republic PDF    20_traderepublic_kontoauszug.pdf (Kontoauszug aus der TR-App, 2 Seiten)
23  Einzel-Abrechnungen  23a Scalable Kauf · 23b Smartbroker+ Verkauf mit Steuern · 23c Baader Kauf · 23d Trade Republic Verkauf · 23e Revolut Kauf (PDF)
                           → 3 Stück Test AG, 0,5 ETF, realisiert +10,00 €, Dividende 5,00 €, Konto 651,10 €
22  Screenshots (TR)     22a_…png (Kauf), 22b_…png (Verkauf) ins Depot „Test 22“, danach 22c_traderepublic_export.csv
                           → 2,5 Stück Test Energy; der Export ersetzt die Screenshot-Buchungen (keine Doppelten)
19  Kraken-PDF doppelt    19a_kraken_ledger.pdf, danach 19b_kraken_kaufbeleg.pdf (beide Konto „Test 19“)
                           → beim Beleg: 0 neue („vermutlich schon da“); 5,7572 ADA, Konto 4,00 €
16  PDF geht nicht        16a_scan_ohne_text.pdf → Meldung „kein lesbarer Text“; 16b_passwort.pdf → Meldung „passwortgeschützt“
10  Kraken doppelt         10a_kraken_ledgers.csv, danach 10b_kraken_trades.csv (beide Konto „Test 10“)
                           → beim zweiten: 0 neue (gleiche Trades); 0,2 ETH, realisiert {fmt(soll['10']['realisiert'])} €, Konto {fmt(soll['10']['konto'])} €

Danach Internet an: Mehr → Datenschutz → Internet erlauben, dann Import → „Kurse & Daten aktualisieren“.
Erwartung: echte Kurse, % seit Kauf, Charts, Earnings-/Dividenden-Termine im Kalender (nur für echte ISINs –
die TEST-ISINs aus 2–10 und die Kursliste-Werte bleiben ohne Treffer bzw. bekommen echte Kurse).
""", encoding="utf-8")
print(json.dumps(soll, ensure_ascii=False))
