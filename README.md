# Depot-Kompass

**Dein Kompass fürs ganze Vermögen.** Alle Depots, Krypto-Konten, Cash und Sachwerte an einem Ort – auf deinem
Android-Handy, offline, ohne Konto, ohne Tracking, ohne Abo.

🇬🇧 [English version below](#english)

Webseite: <https://depot-kompass.pages.dev> · Status: **Alpha** (Testphase) · Lizenz: **PolyForm Noncommercial 1.0.0** (Code offen, nicht-kommerziell frei)

**Download & Quellcode:** Android-App (APK) unter [Releases](../../releases/latest) · Desktop-Version für Linux, Windows und macOS (Docker) im Ordner [`desktop/`](desktop/) · der komplette Quellcode liegt hier im Repository.
**Kontakt & Fehler melden:** nur per Ticket auf unserem Discord-Server: <https://discord.gg/wFvFpeKpm>

> **Keine Anlageberatung, keine Steuerberatung, keine Garantie.** Die App rechnet nur mit
> deinen eigenen Daten. Kurse und Termine aus dem Internet können verspätet oder falsch sein.

---

## Projektziel

Wer bei mehreren Brokern, Banken und Krypto-Börsen ist, verliert schnell den Überblick. Die meisten
Portfolio-Apps lösen das mit einem Konto in der Cloud – und bekommen dafür alle Finanzdaten.
Depot-Kompass macht es andersherum: Du lädst die Exporte deiner Broker (CSV, PDF oder Screenshot),
und **alles wird auf dem Handy gerechnet**. Kein Server, kein Konto, keine Werbung.

## Datenschutz-Prinzipien

1. **Deine Daten bleiben auf dem Handy.** Es gibt keinen Server und kein Benutzerkonto.
2. **Nur zwei Berechtigungen: Internet** (lässt sich in der App ganz abschalten) und **Benachrichtigungen** (ab Werk aus). Keine Kontakte,
   kein Standort, keine Kamera, keine Google-Dienste, keine Werbe-ID, keine Tracker.
3. **Ins Netz nur auf Knopfdruck.** Dann wird nur gefragt, **welche** Werte du hast – nie Stückzahlen,
   Beträge, Konten oder Personen.
4. **Verschlüsselt ab Werk:** App-PIN mit AES-256 (Android Keystore), Sicherungen und Exporte nur verschlüsselt.
   **PIN weg = Daten weg** – es gibt keine Hintertür.
5. **KI nur, wenn du willst:** ab Werk aus, mit eigenem Schlüssel, und vor dem Senden siehst du genau den Text, der rausgeht.
6. **Offener Quellcode** (PolyForm Noncommercial), damit jeder nachprüfen kann, was die App tut.

## Funktionen

### Übersicht
- **Gesamtvermögen** über alle Depots, mit Cash und Sachwerten. Eine Linie zeigt den Wertverlauf über
  **1 Woche bis 5 Jahre oder alles**, dazu das eingesetzte Geld und den Gewinn in € und %.
- **Mehrere Depots** mit Reitern je Depot. Wahlweise liegen alle Depots übereinander, in % vergleichbar.
- **Familie/Haushalt:** Jedes Depot gehört einer Person (Ich, Partner, Kind …). Es gibt Summen je Person
  und für den ganzen Haushalt. Depots anderer lassen sich „beobachten“, ohne dass sie mitzählen.
- **Wertverlauf auch ganz offline:** Er wird aus den Kauf- und Verkaufskursen deiner eigenen
  Buchungen gerechnet. Mit Internet kommen echte Wochenkurse dazu.
- Rendite zeitgewichtet: Ein- und Auszahlungen werden herausgerechnet. Daytrading-Gewinne zählen mit.
  Dazu maximaler Drawdown, Hoch und Tief.
- **Streuung & Klumpen** (größte Position, Branche, Krypto-Anteil, effektiv gestreut), Heatmap, KGV.

### Import
- **Erkannt werden:** Trade Republic, Scalable Capital, Smartbroker+, Kraken (Ledger, Trades, Kraken-App),
  Bitvavo, OKX, Binance, Depot-Bestand (`bestand.csv`) und eine Kursliste.
- **Jede andere CSV, auch Kontoauszüge:** Du ordnest die Spalten einmal zu, danach erkennt die App
  den Broker selbst.
- **PDF (offline gelesen, ohne Fremd-Bibliothek):** Kontoauszüge von Trade Republic, Revolut, Smartbroker+,
  Scalable, Sparkasse und anderen Banken; Kraken (Kontoauszug, Ledger, Bestand, Kaufbeleg); jede PDF mit
  Tabelle über „Spalten zuordnen“. Die Vorschau prüft den Kontostand gegen den Auszug („Gegenprobe“).
  Doppeltes aus verschiedenen Exporten wird erkannt.
- **Screenshot** einer ausgeführten Order – Trade Republic, Scalable Capital, Smartbroker+, Revolut, Kraken, Bitvavo, OKX und andere: Texterkennung (Tesseract) direkt auf dem Handy, ohne Internet.
- **Wertpapier-Abrechnungen (PDF)** je Kauf/Verkauf von Scalable Capital, Smartbroker+, Trade Republic, Revolut und Baader Bank, mit Gegenprobe.
  Der wöchentliche Export ersetzt diese Buchungen später automatisch.
- **Zertifikate, Optionsscheine, Anleihen** mit ISIN/WKN – Kurse über Onvista.
- **Mehrere Dateien auf einmal.** Jede läuft durch eine Vorschau. Doppelte Buchungen werden erkannt,
  Stornos übersprungen, Excel-umgespeicherte Dateien (Komma statt Punkt) richtig gelesen.
- **Bestand zum Stichtag + ältere Transaktionen:** Der Anfangsbestand wird zurückgerechnet, so entsteht
  ein echter Verlauf.
- Transfers an andere Konten, z. B. Trading-Challenges, kannst du als **Verlust** werten.

### Weitere Seiten
| Seite | Inhalt |
|---|---|
| **Positionen** | Liste und Heatmap, Ø Kaufkurs, Gewinn seit Kauf, Mini-Chart, Quartalszahlen, Zielgewicht; **Watchlist** mit Kauf-/Verkaufsmarken |
| **Kalender** | Monatsansicht: erhaltene Dividenden mit % auf deinen Einsatz, Käufe/Verkäufe, Ex-Tage mit Berechtigung („am Vortag im Bestand?“), Earnings, Krypto-Haltefristen, eigene Termine; Gewinn/Verlust je Tag für Daytrader |
| **News** | Meldungen zu deinen Werten aus Google News, Yahoo und **eigenen RSS-Quellen** (z. B. Regionalzeitung) |
| **Notizen** | Durchsuchbare Notizen und der **Hebel- und Positionsgrößen-Rechner** mit Chart: Einstieg, Knock-out, Stop, Ziel, Hebel-Schieberegler, Risiko mit/ohne Stop, Einsatz für einen festen Maximalverlust, speicherbar |
| **Steuer** | Je Jahr: Aktien-Gewinne/-Verluste, ETF/ETC, Dividenden + Zinsen, Krypto nach FIFO (unter/über 1 Jahr, Freigrenze) |
| **Sachwerte** | Kamera, Laptop, Auto, physisches Gold … mit Wertverlust je Jahr oder eigenem Wert |
| **✨ KI** | **Chat mit Rückfragen** zu Portfolio und Einzelwerten (Check, Earnings auswerten, Chancen & Risiken, Schlagzeilen einordnen, Positionen im Minus, Gewinne mitnehmen?, umgewichten, eigene Frage), Reiter mit Beispiel-Fragen, Verlauf auf dem Handy – mit eigenem Schlüssel für OpenRouter, Anthropic (Claude), OpenAI (ChatGPT) oder Google (Gemini) |

**Bedienung:** Depot oder Person wechseln mit ‹ › oben oder per Wischen · Sprache Deutsch/English (⚙️ → Einstellungen) · Kalender auch mit Käufen/Verkäufen.
| **Einstellungen** | Design hell/dunkel/schwarz, „Verstecken“ (Beträge aus, nur Prozent), Kalender, Startseite, Sperrzeit |

### Datenschutz & Sicherheit
- **Nur zwei Berechtigungen: Internet und Benachrichtigungen** (beide abschaltbar, Benachrichtigungen ab Werk aus). Keine Kontakte, kein Standort, keine Kamera, keine Google-Dienste,
  keine Werbe-ID, keine Tracker.
- **Internet ganz aus** per Schalter möglich. Wenn an, fragt die App nur auf Knopfdruck nach, **welche**
  Werte du hast (Yahoo Finance, Onvista für Zertifikate, Google News, eigene Feeds), nie nach Stückzahlen oder Beträgen.
- **App-PIN** (6 Ziffern), bewusst **ohne Fingerabdruck** (private Finanzdaten nur mit PIN). Die Daten sind dann mit AES-256 verschlüsselt und
  an das Gerät gebunden (Android Keystore). **PIN weg = Daten weg**, es gibt keine Hintertür.
- **Original-Dokumente** (CSV, PDF, Screenshots) bleiben in der App, mit App-PIN verschlüsselt. **„Alles exportieren“**
  erzeugt eine mit AES-256 verschlüsselte ZIP (Daten + alle Originale), die sich am PC mit 7-Zip öffnen lässt.
- **Sicherungen und Exporte nur verschlüsselt** (`.dksafe`, AES-256-GCM, eigenes Passwort), in einen
  Ordner deiner Wahl. Kein Cloud-Backup, kein Geräte-Umzug.
- Die Oberfläche darf selbst nichts aus dem Netz laden (Content-Security-Policy, Sperre im WebView),
  nur HTTPS, Bildschirmschutz ab Werk an.
- **KI** ist ein Zusatzmodul, ab Werk **aus**. Wenn an, gehen auf Knopfdruck Fragen zu Portfolio und Watchlist
  über OpenRouter mit deinem eigenen Schlüssel – dabei nur **Name, Art, Einstiegskurs und Long/Short**
  (Anteile in % nur, wenn du es einschaltest). **Nie Depotbeträge, Stückzahlen, Konten oder Personen.**
  Vor dem Senden zeigt die App genau den Text, der rausgeht.
- **Fehler melden** nur per Ticket auf unserem Discord-Server (⚙️ → Fehler melden zeigt, was ins Ticket gehört). Die App sendet selbst keine Fehlerberichte.

## Datenquellen & API-Schlüssel

| Dienst | Wofür | Schlüssel nötig? |
|---|---|---|
| **Yahoo Finance** | Kurse, Kursverlauf, Dividenden-/Earnings-Termine, Schlagzeilen | nein |
| **Onvista** | Kurse für Zertifikate, Optionsscheine, Anleihen (per ISIN/WKN) | nein |
| **Google News** | Schlagzeilen zu deinen Werten (RSS) | nein |
| **OpenRouter** | KI-Chat (auch Gratis-Modelle mit „:free“) | ja, **kostenlos** möglich |
| **Google (Gemini)** | KI-Chat | ja, mit **kostenlosem Kontingent** |
| **Anthropic (Claude)** | KI-Chat für genauere Analysen | ja, Abrechnung nach Verbrauch |
| **OpenAI (ChatGPT)** | KI-Chat | ja, Abrechnung nach Verbrauch |

Alle Abrufe laufen nur auf Knopfdruck und nur, wenn Internet in der App erlaubt ist.
Unter **⚙️ → API-Schlüssel** steht neben jedem Dienst ein direkter Link zur Seite, auf der du in wenigen
Klicks einen Schlüssel erstellst (OpenRouter und Google kostenlos, Claude und ChatGPT nach Verbrauch; ein Claude- oder ChatGPT-Abo lässt sich nicht verbinden). Für Finnhub, Alpha Vantage, Twelve Data und Financial
Modeling Prep lassen sich dort schon Schlüssel hinterlegen; genutzt werden sie in einer späteren Version.
Die Schlüssel liegen verschlüsselt auf dem Handy und gehen nur an den jeweiligen Dienst.

## Ausprobieren ohne eigenen Broker

Im Ordner [`testdaten/`](testdaten/) liegen erfundene Beispiel-Exporte von 6 Brokern (2 Jahre) mit Sollwerten, dazu PDF-Kontoauszüge und Order-Screenshots. Alles ausgedacht – damit lässt sich die ganze App testen.

## Installieren

1. `Depot-Kompass-<version>.apk` von den GitHub-Releases aufs Handy holen.
2. Beim Öffnen „Installation aus dieser Quelle erlauben“ bestätigen.
3. Beim ersten Start wählen: **offline** oder **mit Internet**. Dann die **App-PIN** festlegen.
4. ⚙️ → *Import* → die CSV- oder PDF-Exporte deiner Broker wählen (gern alle auf einmal).

Voraussetzung: Android 8 oder neuer.

> **Umstieg von einer älteren Testversion:** In der alten App eine `.dksafe`-Sicherung anlegen, die alte App deinstallieren,
> die neue installieren und die Sicherung dort einlesen.

## Android-App selbst kompilieren

Die App braucht weder Android Studio noch Gradle. Gebaut wird mit den Kommandozeilen-Werkzeugen
`aapt2`, `javac`, `d8` und `apksigner` – zum Beispiel direkt auf einem Android-Handy in **Termux**:

```bash
pkg install git openjdk-21 aapt2 apksigner d8 python
git clone <repository-adresse> depot-kompass
cd depot-kompass
./bauen.sh            # erzeugt Depot-Kompass-<version>.apk
```

Beim ersten Bau entsteht ein eigener Signierschlüssel in `~/.depot-kompass-signatur/`. **Sichere ihn gut:**
Updates lassen sich nur mit demselben Schlüssel über eine installierte App spielen.
Selbst gebaute APKs tragen deinen eigenen Schlüssel – sie lassen sich nicht über die offizielle Version installieren.

Aufbau:
```
AndroidManifest.xml          Version, Berechtigungen (Internet, Benachrichtigungen), Backup aus
src/app/depotkompass/        WebView-Hülle: Dateien, Netz (nur auf Knopfdruck), PIN, Verschlüsselung
assets/                      Oberfläche und alle Rechnungen (HTML/JS/CSS)
assets/ocr/                  Tesseract OCR (WebAssembly) + deutsche Sprachdaten, Apache-2.0
res/xml/                     Netz-Regeln (nur HTTPS), kein Cloud-Backup
fastlane/                    Store-Texte und Screenshots (F-Droid / IzzyOnDroid)
build.gradle, settings.gradle  Entwurf für einen Gradle-Bau (F-Droid) – noch ungetestet; geprüft ist bauen.sh
tests/                       Testlauf mit erfundenen Daten
werkzeuge/                   sicherung_oeffnen.py (Sicherung am PC öffnen)
```

**Grundsatz:** Quelle der Wahrheit sind die Buchungen. Bestand, Einstand, Gewinn und Verlauf werden
immer daraus gerechnet, nie gespeichert.

## Testen

Vor jeder Version:

```bash
tests/pruefen.sh      # braucht python3 + chromium, Ergebnis: ALLES OK
```

- Alle Rechnungen werden **unabhängig in Python** nachgerechnet und mit der App verglichen: Bestand,
  Einstand, realisiert, Dividenden, Konto, Wert, eingesetztes Geld und Rendite jede Woche, Drawdown,
  Hoch/Tief, Steuer je Jahr.
- **Großer Test:** erfundene 750.000 € auf 6 Broker über 2 Jahre (≈ 6.000 Zeilen), mit und ohne Kursliste.
- **Testfälle:** Excel-Dateien, Angriffs-Code im Namen, Überverkauf, Storno, Riesendatei mit 20.000 Zeilen,
  Kontoauszug, unbekannter Broker, Bestand + Historie, Kraken-App mit Challenges.
- Jede Seite in 3 Breiten × 2 Schriftgrößen: kein Überlauf, kein abgeschnittener Text.

Alle Testdaten sind erfunden.

## Sicherung am PC öffnen

```bash
python3 werkzeuge/sicherung_oeffnen.py meine-sicherung.dksafe
```

Der ZIP-Export („Alles exportieren“) ist eine normale AES-256-ZIP und lässt sich mit 7-Zip öffnen.

## Self-Hosted / Desktop (Linux, Windows & macOS, Alpha)

Im Ordner [`desktop/`](desktop/) liegt die Desktop-Version als Docker-Container: **dieselbe Oberfläche wie die App**
(Kalender, KI-Chat, Importe, Steuer …) im Browser unter `http://127.0.0.1:8098`. Lokaler Zugang ohne Online-Konto,
Daten verschlüsselt im Ordner `desktop/daten/`, Sicherungen (`.dksafe`) zwischen Handy und PC austauschbar.

```bash
cd desktop && docker compose up -d --build
```

## Lizenz

**PolyForm Noncommercial 1.0.0** – siehe [LICENSE](LICENSE). Der Code ist offen: Du darfst die App
**privat und nicht-kommerziell** nutzen, verändern und weitergeben (auch Schulen, Vereine, Forschung).
**Kommerzielle Nutzung** – z. B. verkaufen, in ein Bezahlprodukt einbauen, für Kunden betreiben – nur mit
schriftlicher Erlaubnis des Depot-Kompass-Teams.
Enthaltene Fremd-Bausteine: Tesseract OCR und Tesseract-Sprachdaten (Apache-2.0, `assets/ocr/LICENSE-tesseract.txt`).

## Unterstützen

Depot-Kompass ist kostenlos und ohne Werbung. Wer das Projekt unterstützen möchte, kann anonym spenden – danke!
Die Adressen stehen auch in der App unter **⚙️ → Mehr → Unterstützen** (mit Kopier-Knopf).
**Bitte nur im jeweils genannten Netz senden** – sonst geht die Spende verloren.

| Netz | Adresse |
|---|---|
| Hyperliquid | `0x8Df090f2176bF76270dE12Bbe9E5B811Cf5b18B4` |
| Bitcoin (BTC) | `bc1qxkw0k556x9qdr5hqjf7lfkdktjx0masdvs98cp` |
| Monero (XMR) | `47WpTbRSA4UAA3Rx2iZcBqMfP8bMwKhF6BYio31umvJQ2zMNNn7GCJQSAYySHvkAcDKvSJ8DDMcSdeKWrA8ULQ1BA1E2aqc` |
| Ethereum (ETH · MetaMask) | `0x51234446Cb2DF9860D2C65B96F240d3bdFAe696F` |
| Solana (SOL) | `BCjbXmmMD976EjQkn4tMwP71W6EDMu5z7exGWLVGZF8Q` |
| Tron (TRX) | `TJ3oMWqVES94LgR1MZs3eLCGAS5i2jpE4o` |
| Stellar (XLM) | `GD5PG25W25JIQU4VR4WXZURUGU2VIYSYBIBAJX7VUWCRGW76RPRLYG4P` |

## Kontakt

Fehler und Ideen: nur per Ticket auf unserem Discord-Server (<https://discord.gg/wFvFpeKpm>, Hinweise in der App unter **⚙️ → Fehler melden**).
Herausgeber: Depot-Kompass (Projekt).

---

<a id="english"></a>

# Depot-Kompass (English)

**Your compass for all your wealth.** All your portfolios, crypto accounts, cash and assets in one place –
on your Android phone, offline, without an account, without tracking, without a subscription.

Website: <https://depot-kompass.pages.dev/en/> · Status: **alpha** · License: **PolyForm Noncommercial 1.0.0** (source available, free for noncommercial use)

**Download & source code:** Android app (APK) under [Releases](../../releases/latest) · desktop version for Linux, Windows and macOS (Docker) in the [`desktop/`](desktop/) folder · the complete source code is in this repository.
**Contact & bug reports:** only via a ticket on our Discord server: <https://discord.gg/wFvFpeKpm>

> **Not investment or tax advice, no guarantee.** The app only calculates with your own data.
> Prices and dates from the internet may be delayed or wrong.

## Project goal

If you use several brokers, banks and crypto exchanges, it is easy to lose track. Most portfolio apps
solve this with a cloud account – and get all your financial data in return. Depot-Kompass does it the
other way round: you load the exports from your brokers (CSV, PDF or screenshot) and **everything is
calculated on your phone**. No server, no account, no ads.

## Privacy principles

1. **Your data stays on your phone.** There is no server and no user account.
2. **Only two permissions: internet** (can be switched off completely in the app) and **notifications** (off by default). No contacts,
   no location, no camera, no Google services, no advertising ID, no trackers.
3. **Online only at the push of a button.** Only **which** securities you hold is requested – never
   quantities, amounts, accounts or people.
4. **Encrypted by default:** app PIN with AES-256 (Android Keystore); backups and exports are always encrypted.
   **Lost PIN = lost data** – there is no back door.
5. **AI only if you want it:** off by default, with your own key, and you see the exact text before it is sent.
6. **Source available** (PolyForm Noncommercial), so anyone can check what the app does.

## Features

- **Total wealth** across all portfolios incl. cash and physical assets, value history from 1 week to 5 years,
  time-weighted return, drawdown, diversification and cluster risks, heatmap.
- **Import:** Trade Republic, Scalable Capital, Smartbroker+, Revolut, Kraken, Bitvavo, OKX, Binance, Sparkasse and other
  banks (CSV or PDF, read offline); any other CSV via column mapping; **screenshots** of executed Trade Republic
  orders with on-device text recognition; certificates, warrants and bonds via ISIN/WKN.
- Duplicate detection, imports can be undone or moved to another portfolio, originals are kept encrypted.
- **Calendar** with daily profit/loss, dividends, ex-dates, earnings and crypto holding periods.
- **Tax overview** per year (German rules), **leverage and position-size calculator**, notes, watchlist,
  news incl. your own RSS feeds, household with several people.
- **AI chat with follow-up questions** about your portfolio and single securities (incl. earnings analysis, example prompts, local history) – own key for OpenRouter, Anthropic (Claude), OpenAI (ChatGPT) or Google (Gemini); optional, off by default.
- German and English user interface.

## Data sources & API keys

| Service | Used for | Key required? |
|---|---|---|
| **Yahoo Finance** | prices, price history, dividend/earnings dates, headlines | no |
| **Onvista** | prices for certificates, warrants, bonds (by ISIN/WKN) | no |
| **Google News** | headlines for your securities (RSS) | no |
| **OpenRouter** | AI chat (free models ending in ":free" too) | yes, **free** possible |
| **Google (Gemini)** | AI chat | yes, with a **free quota** |
| **Anthropic (Claude)** | AI chat for more detailed analyses | yes, billed by usage |
| **OpenAI (ChatGPT)** | AI chat | yes, billed by usage |

All requests are made only at the push of a button and only if internet is allowed in the app.
Under **⚙️ → API keys** every service has a direct link to the page where you can create a key in a few clicks
(OpenRouter and Google free, Claude and ChatGPT billed by usage; a Claude or ChatGPT subscription cannot be connected). Keys for Finnhub, Alpha Vantage, Twelve Data and Financial Modeling Prep can already be
stored there; they will be used in a later version. Keys are stored encrypted on the phone and only sent to their service.

## Try it without your own broker

The [`testdaten/`](testdaten/) folder contains invented sample exports from 6 brokers (2 years) with expected values, plus PDF statements and order screenshots. All made up – use them to test the whole app.

## Install

1. Download `Depot-Kompass-<version>.apk` from the GitHub releases to your phone.
2. Allow "install from this source" when opening it.
3. On first start choose **offline** or **with internet**, then set your **app PIN**.
4. ⚙️ → *Import* → choose the CSV or PDF exports of your brokers (several at once is fine).

Requires Android 8 or newer.

## Build the Android app yourself

No Android Studio and no Gradle needed. The app is built with the command-line tools `aapt2`, `javac`,
`d8` and `apksigner` – for example directly on an Android phone in **Termux**:

```bash
pkg install git openjdk-21 aapt2 apksigner d8 python
git clone <repository-url> depot-kompass
cd depot-kompass
./bauen.sh            # creates Depot-Kompass-<version>.apk
```

The first build creates your own signing key in `~/.depot-kompass-signatur/`. **Keep it safe:** updates can only be
installed over an existing app with the same key. Tests: `tests/pruefen.sh` (needs python3 + chromium).

## Self-hosted / desktop (Linux, Windows & macOS, alpha)

The [`desktop/`](desktop/) folder contains the desktop version as a Docker container: **the same interface as the app**
(calendar, AI chat, imports, tax …) in your browser at `http://127.0.0.1:8098`. Local access without an online account,
data encrypted in `desktop/daten/`, backups (`.dksafe`) interchangeable between phone and PC.

```bash
cd desktop && docker compose up -d --build
```

## License

**PolyForm Noncommercial 1.0.0** – see [LICENSE](LICENSE). Free for personal and other noncommercial use, including changing and sharing. Commercial use only with written permission from the Depot-Kompass-Team. Included third-party components: Tesseract OCR and Tesseract language
data (Apache-2.0, `assets/ocr/LICENSE-tesseract.txt`).

## Support

Depot-Kompass is free and ad-free. If you would like to support the project, you can donate anonymously – thank you!
The addresses are also in the app under **⚙️ → More → Support** (with a copy button).
**Please only send on the network named** – otherwise the donation is lost.

| Network | Address |
|---|---|
| Hyperliquid | `0x8Df090f2176bF76270dE12Bbe9E5B811Cf5b18B4` |
| Bitcoin (BTC) | `bc1qxkw0k556x9qdr5hqjf7lfkdktjx0masdvs98cp` |
| Monero (XMR) | `47WpTbRSA4UAA3Rx2iZcBqMfP8bMwKhF6BYio31umvJQ2zMNNn7GCJQSAYySHvkAcDKvSJ8DDMcSdeKWrA8ULQ1BA1E2aqc` |
| Ethereum (ETH · MetaMask) | `0x51234446Cb2DF9860D2C65B96F240d3bdFAe696F` |
| Solana (SOL) | `BCjbXmmMD976EjQkn4tMwP71W6EDMu5z7exGWLVGZF8Q` |
| Tron (TRX) | `TJ3oMWqVES94LgR1MZs3eLCGAS5i2jpE4o` |
| Stellar (XLM) | `GD5PG25W25JIQU4VR4WXZURUGU2VIYSYBIBAJX7VUWCRGW76RPRLYG4P` |
