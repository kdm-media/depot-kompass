# Testdaten – Depot-Kompass ausprobieren ohne eigenen Broker

🇬🇧 [English below](#english)

Alle Dateien hier sind **erfunden**: Namen, Beträge und Kurse sind ausgedacht (ISINs sehen nur echt aus).
Es sind keine echten Depots, keine Konten und keine Schlüssel enthalten. Damit kannst du die App komplett
testen, auch wenn du (noch) keinen der unterstützten Broker nutzt.

## 1. Großer Test – 6 Broker, 2 Jahre, 750.000 € (erfunden)
1. App starten und **„📴 Offline starten“** wählen – sonst holt die App echte Kurse und die Sollwerte passen nicht.
2. Übersicht → **„📄 CSV, PDF oder Screenshot wählen“** → alle `Test_*.csv` auf einmal wählen, jede Vorschau übernehmen.
3. Die richtigen Zahlen stehen in `Test_SOLLWERTE.txt` (unabhängig in Python nachgerechnet).

Ausführliche Anleitung: [`ANLEITUNG.txt`](ANLEITUNG.txt)

| Datei | Broker | Inhalt |
|---|---|---|
| `Test_1_kraken_krypto_halten_ledgers.csv` | Kraken | Krypto halten, Staking |
| `Test_2_bitvavo_krypto_sparplan.csv` | Bitvavo | Sparplan |
| `Test_3_okx_krypto_handel.csv` | OKX | Krypto-Handel |
| `Test_4_scalable_etf_sparplan.csv` | Scalable Capital | ETF-Sparplan |
| `Test_5_smartbroker_einzelwerte.csv` | Smartbroker+ | Einzelaktien, Dividenden |
| `Test_6_traderepublic_daytrading.csv` | Trade Republic | Daytrading |
| `Test_7_kursliste_wochenkurse.csv` | – | Wochenkurse für alle Depots |

## 2. Einzelne Beispiele
Im Ordner [`einzelne_beispiele/`](einzelne_beispiele/): PDF-Kontoauszüge (Trade Republic, Kraken, Bank),
ein Kraken-Kaufbeleg und **Screenshots ausgeführter Orders** (Trade Republic, Scalable, Smartbroker+, Revolut, Kraken, Bitvavo), PDF-Abrechnungen je Broker für den Screenshot-Import (Texterkennung offline).

---

<a id="english"></a>
## English

All files here are **invented**: names, amounts and prices are made up (ISINs only look real). They contain no real
portfolios, accounts or keys. Use them to test the whole app even if you do not use one of the supported brokers.

1. Start the app and choose **"📴 Start offline"** – otherwise real prices are loaded and the expected values no longer match.
2. Overview → **"📄 Choose CSV, PDF or screenshot"** → select all `Test_*.csv` at once and accept each preview.
3. The correct figures are in `Test_SOLLWERTE.txt` (calculated independently in Python; German).

`einzelne_beispiele/` contains PDF statements, a Kraken purchase receipt and screenshots of executed Trade Republic orders.
