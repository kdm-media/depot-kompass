# Änderungen – Depot-Kompass

Alle Versionen sind **Alpha** (Testphase). Neueste oben.

## 0.86 – 23.11.2026 – Textkorrekturen
- 🧹 Kleinere Textkorrekturen in „Was ist neu“ und bei den Credits.

## 0.85 – 23.11.2026 – Krypto-Paar, Spot-Auswahl, News ohne Spam, Ad-hoc-Meldungen
- 🪙 Hebel-Rechner: oben direkt „Hebel & Derivate“ oder „Spot (ohne Hebel)“ wählen – neu auch Spot direkt beim Broker (Aktie, ETF, Krypto). Die Wahl bleibt für neue Rechnungen.
- 💱 Krypto-Paar wählbar: nach der Suche z. B. XRP/EUR, XRP/USD oder XRP/CHF antippen – Kurs, Chart und Rechner-Währung folgen dem Paar.
- 🔔 News-Benachrichtigungen ohne Spam: direkt auf der News-Seite an/aus, nur fürs eigene Portfolio oder mit Watchlist, höchstens 1–10 Meldungen je Prüfung, der Rest als eine Sammel-Meldung.
- ⚡ Ad-hoc-Meldungen: unter News je Wert abonnieren. „News laden“ sucht dann extra danach, mit Benachrichtigungen meldet sich das Handy auch im Hintergrund. Neuer Filter „⚡ Ad-hoc“.

## 0.84 – 23.11.2026 – Chart ohne Hebel, Onvista-Link, News-Filter, Desktop-Sicherheit
- **Hebel-Rechner:** Kurs-Chart auch ohne Einstieg/Hebel; KO-Produkte mit mindestens Hebel 1,01 (bei Hebel 1 lag der Knock-out auf 0).
- **Zertifikate-Finder:** Link „Onvista ↗“ zum Datenblatt je Treffer.
- **News:** Filter „Mein Portfolio“ und „Beobachtet“; die Marktstimmung steht jetzt bei den News.
- **Desktop (Sicherheit):** PIN-Hülle mit scrypt (alte werden beim Entsperren umgestellt), Heimnetz nur mit App-PIN und eigener Sitzung je Browser, eigene RSS-Quellen nur zu öffentlichen https-Adressen, engere Grenzen für Anfragen und Sicherungsdateien. Nach richtiger PIN öffnet sich die App sofort (vorher erst nach Neuladen).

## 0.83 – 23.11.2026 – Nach Update suchen
- **🔄 Nach Update suchen:** unter *Mehr → Über die App* fragt die App nur auf Knopfdruck bei GitHub nach der neuesten Version (eine feste Adresse, respektiert „Internet aus“). Ist eine neuere Version da, zeigt sie, wie du aktualisierst: am Handy über Obtainium oder die neue APK, am PC im Ordner `desktop` mit `git pull` bzw. neuer ZIP und `docker compose up -d --build` – deine Daten bleiben erhalten. Es wird nichts automatisch installiert.
- **Datenschutz-Seite:** „Fehler melden“ verweist auf das Discord-Ticket.

## 0.81 – 23.11.2026 – Kontakt nur über Discord-Ticket
- **🎫 Nur noch Discord-Ticket:** Fragen, Fehler und Wünsche ausschließlich über ein Ticket auf unserem Discord-Server. Die App öffnet keine E-Mail mehr (auch technisch gesperrt). Sicherheitslücken bitte vertraulich per Ticket oder privat über GitHub (*Security → Report a vulnerability*) melden.

## 0.80 – 23.11.2026 – Tranchen: jetzt kaufen oder auf Limit warten? · Alarm-Töne je Wert
- **🔊 Alarm-Töne je Wert:** unter *Watchlist → Alarme* bekommt jeder Wert mit Ticker auf Wunsch einen eigenen Ton (8 selbst erzeugte Töne: Zweiklang hoch/tief, Dreifach-Piep, Glocke, aufsteigend, absteigend, Klopfen, Sirene kurz) – gespeichert und vorab anhörbar. Unter Android hat jeder Ton einen eigenen Benachrichtigungs-Kanal; melden sich mehrere Werte gleichzeitig, kommen die Töne nacheinander (ca. 2 s Abstand), so ist am Klang erkennbar, welcher Wert sich meldet. Keine neue Berechtigung nötig.
- **⚖️ Kaufpreis wählbar:** im Tranchen-Rechner *Marktpreis* (wie bisher) oder *eigener Preis (Limit-Order)*. A (festes Budget) und B (Ziel-Einstand) rechnen mit dem gewählten Kaufpreis; Wert und Gewinn bleiben zum Kurs jetzt.
- **Neuer Vergleich „Jetzt kaufen oder auf Limit warten?“:** Szenario A (sofort zum Kurs jetzt) und B (dein Limit) nebeneinander, optional mit 2. Tranche bei tieferem Limit – je Szenario zusätzliches Kapital, neue Position, Einsatz gesamt, neuer Ø und Veränderung. Dazu Ø-Unterschied, mehr Stück fürs gleiche Geld und Kapital bis zum Ziel-Ø (sofort vs. Limit) sowie ein Balkenbild. Hinweis: Ein Limit wird nur ausgeführt, wenn der Kurs dorthin fällt.

## 0.79 – 23.11.2026 – KI nur auf Wunsch sichtbar
- **✨ KI standardmäßig ausgeblendet:** ohne Schalter gibt es unten in der Leiste keinen KI-Knopf und unter *Mehr* keine KI-Kachel – es wird nie etwas gesendet. Einschalten unter *Einstellungen → Zusatzmodule → KI-Zusammenfassung*, dann erscheint „KI“ unten in der Leiste. Wer KI schon an hatte, behält sie.

## 0.78 – 23.11.2026 – Krypto-Markt, Binance-Import, Dollar-Anzeige
- **📊 Krypto-Markt im Detail:** bei Krypto-Werten auf Knopfdruck Long/Short (Anteil der Konten) und Open Interest von Kraken Futures und Binance Futures, Funding von Kraken – öffentliche Marktdaten ohne Konto, danach offline gespeichert.
- **📐 Fibonacci aus dem 4h-Chart:** letztes Hoch und Tief der letzten 20 Tage (Kraken, Spot gegen Euro), Linien 23,6 / 38,2 / 50 / 61,8 / 78,6 % im Chart. Dazu **Marken-Vorschlag – du entscheidest:** Pivot (24 Std.), R1/S1, nächste Unterstützung und nächster Widerstand. Rechenwerte, kein Signal.
- **📥 Binance-Import:** Handelsverlauf (neues und altes Format), nur Spot gegen Euro; andere Paare werden sichtbar übersprungen, Gebühren in BNB als Notiz. Zum Ausprobieren ohne Konto: `testdaten/einzelne_beispiele/25a_binance_handelsverlauf.csv` und `25b_binance_alt.csv`.
- **💵 Depot-Anzeige in US-Dollar (Einstellungen):** Werte, Gewinne und Kurse wahlweise in Dollar – nur Anzeige, gerechnet und gespeichert wird in Euro (Kurs EUR/USD vom letzten Aktualisieren). Die Rechner behalten ihre eigene Währung.
- **🌡️ Marktstimmung:** Link zum CNN Fear & Greed Index für Aktien (CNN lässt keine Apps abrufen, darum nur der Link).
- **🖥️ Desktop (Docker):** Hinweis, dass Bilder und Exporte im Download-Ordner des Browsers landen; im Heimnetz oder über ein eigenes VPN per `.env` erreichbar (nie 0.0.0.0, kein Port am Router).

## 0.77 – 23.11.2026 – Spot, neue Börsen, Beträge aus im Chart
- **🪙 Spot ohne Hebel:** Kraken, Bitvavo, Binance und Bitunix. Kein Knock-out, nur kaufen; Gebühr je Seite als Vorgabe (kleinste Stufe, Stand 23.11.2026) und änderbar. Damit lässt sich z. B. BTC/CAD nachrechnen.
- **📈 Neue Perps:** Binance Futures (USDⓈ-M) und Bitunix Futures, Wartungsmarge und Gebühr als änderbare Vorgabe mit Hinweis „beim Broker prüfen“.
- **💱 Währung im Hebel-Rechner:** EUR, USD, CAD, CHF, GBP, USDT, USDC für Einsatz, Gewinn und Verlust. Bei der Basiswert-Suche wird die Währung des Treffers vorgeschlagen.
- **👁️ Beträge aus:** gilt jetzt auch für die zweite Zeile im Chart (graue Punkte statt Euro) und für die Stückzahl. Prozente bleiben sichtbar.
- **🕘 Zeitachse:** unter dem Chart vier Daten, Hoch und Tief als Punkt mit Datum; im Text „Hoch … am …, Tief … am …“ (auch im Positions-Chart).
- **🕯️ Kerzen mit Volumen:** Chart zeigt Kerzen (Docht) und darunter Volumen; neue Wochenansicht **1W** (Stundenkerzen), 5J mit Jahreszahlen, 6M/1J mit Monaten. Preisskala links, Einstieg lässt sich wie SL und TP ziehen.
- **💱 Währung der Rechner (Einstellungen):** EUR, USD, CAD, CHF, GBP, USDT als Standard für alle Rechner; im Rechner weiter umstellbar. Depot bleibt in Euro.
- **🙈 Beträge aus + Kurse:** der Hebel-Chart verbirgt dann auch die Kurse (Marken, Skala, Hoch/Tief) – nur Prozente bleiben.

## 0.76 – 22.11.2026 – Warnung vor Betrügern
- **⚠️ Vorsicht vor Betrügern:** unter *Fehler melden* und *Sicherheit & Sicherung* ein deutlicher Hinweis: Das Team fragt nie nach Seed-Phrase (Wiederherstellungs-Wörter), Passwörtern, PIN, Zwei-Faktor-Codes oder Ausweisfotos, schreibt nie von sich aus an – Kontakt nur über den Discord-Server (Ticket). Die Liste „Bitte NICHT schicken“ nennt jetzt auch die Seed-Phrase.

## 0.75 – 22.11.2026 – Kalender: Ausschüttungen, Zinsen, Staking
- **📅 Kalender:** Ausschüttungen von ETFs/Fonds werden als „Ausschüttung“ angezeigt, dazu neu **Zinsen** aufs Konto (🏦) und **Staking-/Reward-Erträge** (🪙, Krypto, Stückzahl) am Tag der Gutschrift. Die Euro-Summen „Dividenden“ bleiben wie bisher.

## 0.74 – 22.11.2026 – Discount-Zertifikat
- **🎯 Discount-Zertifikat** im Derivate-Rechner: Basiswert-Kurs, Cap, Preis je Zertifikat, Bezugsverhältnis, Verfall. Ergebnis am Verfall: Abschlag in %, Break-even (Puffer nach unten), höchster Ertrag (Seitwärtsrendite) in € und %, Ergebnis am Take-Profit, Restlaufzeit; Chart mit Cap und Break-even.
- **Mini-Future erklärt:** ohne Laufzeit, jederzeit zum aktuellen Kurs verkaufbar – anders als ein Future mit festem Verfall.

## 0.73 – 22.11.2026 – Suche nach Art, Optionen und weitere Derivate
- **🔎 Basiswert-Suche nach Art:** oben Alle · Index · Aktie · ETF · Krypto · Rohstoff. Die wichtigsten Indizes (Nasdaq 100, Nasdaq Composite, S&P 500, DAX 40, Euro Stoxx 50 …) und Rohstoffe (Gold, Silber, Öl, Erdgas, Kupfer) stehen eindeutig benannt ganz oben. Jeder Treffer zeigt seine Art.
- **🎯 Produktart neu sortiert:** Knock-out-Zertifikat/Turbo ganz oben (neuer Rechner startet damit), dann Mini-Future, Faktor-Zertifikat, Perps – Produkte ohne Laufzeit zuerst, danach Optionsschein, Option und Future (mit Laufzeit). Alte Notizen bleiben unverändert.
- **📐 Optionsschein und Option (Kauf):** Call oder Put, Basispreis, Preis bzw. Prämie, Bezugsverhältnis bzw. Kontraktgröße, Verfall. Ergebnis am Verfall (innerer Wert): Break-even, Ergebnis am Take-Profit in € und %, höchster Verlust = Prämie + Gebühren, Restlaufzeit, Chart mit Basispreis und Break-even. Zeitwert vor dem Verfall wird ehrlich als nicht gerechnet genannt.
- **Faktor-Zertifikat** (vereinfacht, mit Hinweis auf Tages-Reset und Pfadabhängigkeit) und **Future** (mit Verfall, Margin und Gebühren selbst eintragen).

## 0.72 – 22.11.2026 – Aufgeräumt für die Veröffentlichung
- Gleiche Funktionen wie 0.71. Interne Sicherungskopien sind nicht mehr im App-Paket, Texte und Kommentare bereinigt.

## 0.71 – 22.11.2026 – Zeitraum auch im Positions-Chart
- **📈 Positionsgrößen-Rechner:** Wer unter „Schwankung prüfen“ einen Wert wählt, bekommt über dem Positions-Chart dieselben Knöpfe 1M · 3M · 6M · 1J · 5J wie im Hebel-Chart, darunter Datum von–bis, Hoch und Tief. Die Schwankungs-Rechnung bleibt bei den Wochenkursen.

## 0.70 – 22.11.2026 – Hebel-Chart mit Zeitraum, Bild wird gespeichert
- **📈 Zeitraum im Hebel-Chart:** Knöpfe 1M · 3M · 6M · 1J · 5J. Bis 1 Jahr Tageskurse, 5 Jahre Wochenkurse – nur auf Knopfdruck geladen. Unter dem Chart Datum von–bis, Hoch und Tief im Zeitraum (für Support-Zonen). Ohne Verbindung bleiben die gespeicherten Wochenkurse, der Text sagt das.
- **📷 Als Bild teilen speichert mit:** Das PNG landet zusätzlich in **Bilder › Depot-Kompass** (Android 10+, ohne Berechtigung) – praktisch auf Android-Systemen, deren Teilen-Menü kein „In Dateien speichern“ hat.
- **🎫 Kontakt über Discord-Ticket:** Kontakt, Fehler melden und Fehlerprotokoll verweisen auf ein Ticket auf unserem Discord („Fehlercodes kopieren“ statt E-Mail).
- **Positionsgrößen-Rechner:** „Stop“ heißt jetzt Stop-Loss.

## 0.69 – 22.11.2026 – Hebel-Rechner neu: Stop-Loss aus Max.-Verlust, Zertifikate-Finder
- **🎯 Stop-Loss aus dem Max.-Verlust:** Einsatz (was die Zertifikate kosten) und Max.-Verlust in Euro eintragen – der Rechner berechnet den passenden Stop-Loss-Kurs, zeichnet ihn ein und zeigt einen Vergleich für das 1-, 1,5- und 2-Fache (z. B. 50 / 75 / 100 €). Beispiel: Bitcoin 42.000, Hebel 5, 500 €, max. 50 € → Stop-Loss 41.160 (−2 %). Passt ein eingetragener Stop-Loss nicht zum Max.-Verlust, kommt ein Hinweis mit „übernehmen“.
- **Zertifikate wie echt gerechnet:** Wert je Zertifikat = (Kurs − Basispreis) × Bezugsverhältnis; Hebel aus dem **Basispreis**. Neu: Basispreis, Preis je Zertifikat (Brief), Bezugsverhältnis, Spread, Ordergebühr in €, Finanzierung % p. a. mit Haltedauer, **Stückzahl** (ganze Zertifikate). Mini-Future: Knock-out-Schwelle getrennt vom Basispreis, Restwert nach dem Knock-out.
- **„Stop“ heißt jetzt Stop-Loss, „Ziel“ Take-Profit.** Kacheln: Einstieg, Hebel, Stop-Loss, Take-Profit, Knock-out, Gewinn und Verlust **in Euro und Prozent**, Chance : Risiko, Stückzahl, Kosten.
- **Chart:** an jeder Marke Basiswert-% und Produkt-% mit Euro – rechnet beim Ändern des Hebels sofort mit. Stop-Loss und Take-Profit lassen sich mit dem Finger verschieben.
- **🔍 Zertifikate-Finder:** Broker wählen (Trade Republic, Scalable, Smartbroker+, comdirect …), Long/Short, Wunsch-Hebel ± Spanne – echte Knock-outs bzw. Mini-Futures von Onvista mit WKN/ISIN, Emittent, Hebel, Knock-out, Basispreis, Geld/Brief. „übernehmen“ füllt den Rechner, „WKN kopieren“ für die Suche beim Broker. Nur auf Knopfdruck, 10 Minuten zwischengespeichert.
- **📷 Als Bild teilen:** Chart, Kacheln, Einstiegsbedingung und Notiz als PNG – im Rechner und in jeder gespeicherten Analyse. Neues Feld **Einstiegsbedingung** (z. B. „erst wenn ein Boden in Sicht ist“).
- **Notizen:** Rechner als Reiter oben (📝 Notizen · ⚖️ Positionsgröße · 📉 Tranchen · 💰 Gewinnmitnahme · 🎯 Derivate), gespeicherte Notizen immer darunter. Begriffe zu Knock-outs ausführlicher erklärt.
- **↔️ Position in anderes Depot verschieben** (in der Position) und lose Dokumente in ein anderes Depot legen. Export-ZIP: beobachtete Depots im eigenen Ordner.
- **📥 Watchlist importieren:** Liste einfügen, CSV/Text/HTML-Datei oder „alle Werte eines Depots zur Watchlist“.
- **HTML-Import:** gespeicherte Bank-/Broker-Seiten – die größte Tabelle wird gelesen.
- **⚖️ Positionsgrößen-Rechner mit Hebel:** Einsatz (Marge), Knock-out ca., Verlust und Gewinn in € und % (auf den Einsatz), Warnung wenn der Knock-out vor dem Stop-Loss liegt.
- **📉 Mehrere Tranchen planen:** bis zu 5 Einstiege mit Kurs und Betrag – Ø Einstand, Gesamtposition, Gesamtkapital, Gewinn/Verlust jetzt und am Ziel.
- **Chart: aktueller Kurs** als Linie mit „bis Einstieg x %“ – auch auf dem Bild.
- **🎯 Hebelprodukte** direkt aus jeder Position und jedem Watchlist-Wert (Rechner und Finder vorbelegt).
- **Depotart** je Depot: Langfristig, Swingtrading, Daytrading, Privates Vermögen.
- **Depot-DB-Zusammenfassung (HTML) einlesen:** Bestand mit Stückzahl, Ticker, Konto und ISIN – oder alle Werte als Watchlist.
- Desktop (Docker): Zertifikate-Finder, Marktstimmung, Bild teilen (Download) und Kopieren funktionieren jetzt auch dort.

## 0.68 – 20.11.2026 – Derivate: Knock-out, Mini-Future, Perp
- **🎯 Neuer Reiter „Derivate“** unter Notizen: der Hebel-Rechner mit Chart, jetzt mit **Basiswert-Suche** (Name, ISIN, WKN) – der aktuelle Kurs wird als Einstieg übernommen, der Kursverlauf erscheint im Chart (z. B. Bitcoin 57.000 mit 3× → Knock-out 38.000).
- **Produktarten** klar ausgeschildert: Knock-out-Zertifikat, Mini-Future (open end), Perp – Kraken Futures (EU-Privatkunden höchstens 10×, mit Warnung darüber), Perp – Hyperliquid, eigene Werte.
- **Knock-out laut Produktblatt:** Bei Zertifikat und Mini-Future lassen sich Produkt-WKN/ISIN und der echte Knock-out des Emittenten eintragen – der Rechner nutzt diesen Wert und berechnet den Hebel daraus, wenn das Hebel-Feld leer ist.
- **Neue Anlagearten** in Buchungen und Watchlist: Knock-out, Mini-Future, Perp (Knock-out und Mini-Future bekommen Kurse über Onvista wie Zertifikate).

## 0.67 – 20.11.2026 – Broker-Gebühren im Positionsgrößen-Rechner
- **⚖️ Broker wählen:** Im Positionsgrößen-Rechner unter „Gebühren berücksichtigen“ einen Broker auswählen – feste Gebühren in Euro je Order werden automatisch eingerechnet: Trade Republic 1 €; Smartbroker+ über gettex: Aktien/ETF 0 € ab 500 € (sonst 1 €), Zertifikate UniCredit 0 € ab 500 € (sonst 4 €), Goldman Sachs 2 € ab 500 € (sonst 4 €), andere Emittenten 4 €. Unter 500 € gibt es einen Hinweis. Eigene Gebühr in % geht weiterhin. Börsenplatz-Entgelte und Spread sind nicht enthalten.
- **⚖️ Positionsgröße vorgeben:** Neben „Verlust in €“ und „Verlust in %“ jetzt auch „Positionsgröße vorgeben“ (z. B. 250 € oder 500 €) – der Rechner zeigt den Verlust am Stop inklusive Gebühren.
- **✨ Was ist neu:** Nach jedem Update erscheint beim ersten Öffnen oben in der Übersicht einmal eine Karte mit den Neuerungen (bei übersprungenen Versionen alle seit der zuletzt gesehenen).

## 0.66 – 20.11.2026 – Marktstimmung & Hilfe
- **🌡️ Marktstimmung in der Übersicht:** passend zu deinem Depot – Krypto mit dem Crypto Fear & Greed Index (alternative.me), Aktien mit dem VIX (offizieller Volatilitätsindex der Cboe, „Angstbarometer“). Lädt nur auf Knopfdruck, danach offline gespeichert. Hinweis: Angst ist für viele ein Verkaufssignal – oft liegen gerade dort Chancen; Gier ist eher ein Warnsignal. Keine Anlageberatung.
- **💜 Wenn es schwer wird:** Hilfe-Kontakte (TelefonSeelsorge 0800 111 0 111 · 0800 111 0 222 · 116 123, kostenlos, anonym, rund um die Uhr; Notruf 112) unten auf „Mehr“ und bei extremer Angst in der Marktstimmung.

## 0.65 – 19.11.2026 – Positionsgröße im Verhältnis zum ganzen Portfolio
- **⚖️ Anteil am Gesamtportfolio:** Der Positionsgrößen-Rechner zeigt jetzt automatisch, wie viel Prozent deines gesamten Portfolios (alle eigenen Depots inkl. Cash) die geplante Position ausmacht – ohne dass du das Kapital eintragen musst. Ab 20 % kommt ein Hinweis auf Klumpenrisiko. Nur Rechnung, keine Anlageberatung.
- Zu finden unter Notizen → ⚖️ Positionsgrößen-Rechner oder direkt in jeder Position über „⚖️ Positionsgröße“.

## 0.64 – 18.11.2026 – Earnings-Ergebnis & Benachrichtigungsverlauf
- **📊 Earnings-Ergebnis als Benachrichtigung:** Am Earnings-Tag und bis zu 4 Tage danach prüft die App, ob die Zahlen da sind, und meldet den Gewinn je Aktie gegen die Erwartung, z. B. „Zahlen sind da: EPS 2,61 · erwartet 2,49 · über Erwartung (+4,8 %)“. Gilt für Werte aus Depots und Watchlist mit Earnings-Termin; eigener Schalter „Earnings-Ergebnis“.
- **🕘 Benachrichtigungsverlauf:** Unter ⚙️ → Mehr → 🔔 steht jede Meldung der letzten 90 Tage, auch weggewischte – mit Zeit, Wert und Text. Dazu ein **Prüfprotokoll**: wann Android zuletzt geprüft hat, wie viele Werte und wie viele Meldungen. Liegt verschlüsselt nur auf dem Handy, mit „Verlauf löschen“.
- **Häufiger prüfen:** Prüfabstand jetzt wählbar ab **1 Stunde** (vorher ab 6). Neu: **Bewegung seit der letzten Prüfung** (z. B. ab 3 %) – zusätzlich zur Bewegung seit dem Vortag. Ehrlicher Hinweis bleibt: Android legt den genauen Zeitpunkt selbst fest.
- **Earnings der Watchlist im Kalender:** Termine und Ergebnisse von Watchlist-Werten stehen jetzt mit „Watchlist“ im Kalender (vorher nur Depot-Werte), antippen zeigt die Auswertung.
- Noch nicht dabei: Zusammenfassung des Earnings-Calls (braucht eine Quelle für das Gesprächsprotokoll – wird geprüft).

## 0.63 – 17.11.2026 – Sicherheits-Update
- **Sperrbildschirm:** Benachrichtigungen zeigen auf dem gesperrten Handy keine Inhalte mehr (keine Namen, Kurse oder Marken) – nur „Neuer Hinweis – zum Ansehen entsperren“.
- **Stärkere Passwörter:** Sicherungs-Passwort jetzt mindestens 14 Zeichen, Depot teilen mindestens 12 – jeweils mit Buchstaben und Zahlen, ohne Wiederholungen. Der ZIP-Export verlangt ein Sicherungs-Passwort mit mindestens 14 Zeichen, weil das ZIP-Format den Schlüssel nur schwach ableitet.
- **Präparierte Dateien:** Dateien über 50 MB werden nicht eingelesen; überlange Zeilen und Felder in CSV-Dateien werden gekappt (vorher konnte eine präparierte Datei die App sekundenlang lahmlegen); PDFs haben eine Gesamtgrenze beim Entpacken.
- **CSV-Export:** Text, der in Excel/LibreOffice als Formel laufen würde (=, +, -, @), wird entschärft.
- **Geprüft:** Ein neuer automatischer Angriffstest schleust HTML in alle Felder (Depots, Wertpapiere, Notizen, Watchlist, Alarme, News, KI-Antworten, Sachwerte) und prüft jede Seite – nirgends wird fremder Text zu HTML. Dazu ein Test mit kaputten und präparierten Dateien.
- Neu: `SECURITY.md` – wie man Sicherheitslücken vertraulich meldet.

## 0.62 – 17.11.2026
- **🔔 Alarme als eigener Reiter in der Watchlist** (Watchlist → „🔔 Alarme“): Pro Wert beliebig viele Alarme, jeder mit eigenem Namen – z. B. „Kaufzone“, „Stop“, „Ziel 1“, „Nachkauf 2“. Vier Arten: **Kurs fällt unter**, **Kurs steigt über**, **Zone von–bis** (meldet sich, sobald der Kurs in die Zone läuft) und **Bewegung in %** seit dem Setzen (z. B. −10 %). Wählbar sind Werte aus der Watchlist und aus allen eigenen Depots.
- Die Liste zeigt je Alarm Kurs, Abstand („noch −4,6 %“) und „erreicht“; einzeln ein- und ausschaltbar. In jedem Watchlist-Eintrag und jeder Position stehen die eigenen Alarme mit „+ Alarm für diesen Wert“.
- Bisherige Kauf-/Verkaufsmarken und „Alarm unter/über“ aus 0.61 werden automatisch zu benannten Alarmen; die alten Felder sind weg.
- Benachrichtigung mit Namen des Alarms („🔔 Rheinmetall – Kaufzone“). Android prüft weiter nur alle paar Stunden; Werte ohne Yahoo-Ticker prüft nur die App.
- **Alarme teilen und einfügen** als einfacher Text (bewusst unverschlüsselt, nur Wert, Ticker, Name und Kurs-Marken – keine Beträge): „📤 Alle teilen“ oder einzeln im Alarm, „📥 Alarme einfügen“ im Reiter. Eine Zeile je Alarm, z. B. `Bitcoin | BTC-EUR | Kaufzone | zone 54.000 bis 56.000`. Fehlende Werte kommen automatisch in die Watchlist, Doppelte werden erkannt.
- Credits: „keine Google-Play-Dienste, keine Tracker – Google News und Gemini nur auf Knopfdruck“ (vorher missverständlich „keine Google-Dienste“).

## 0.61 – 17.11.2026
- **🔔 Kurs-Alarme als Benachrichtigung:** Kaufmarke und Verkaufsmarke aus der Watchlist melden sich jetzt auch aufs Handy, wenn der Kurs sie erreicht – nicht erst beim nächsten Öffnen der App. Neu in jeder Position: **Alarm unter / Alarm über** (z. B. Stop-, Nachkauf- oder Ziel-Marke). Kurse in Dollar, Pfund usw. werden wie in der App in Euro umgerechnet. Jede Marke meldet sich einmal und ist wieder scharf, sobald der Kurs sie verlassen hat.
- Eigener Schalter „Kurs-Alarme (Marken)“ unter ⚙️ → Mehr → 🔔 Benachrichtigungen. Ehrlicher Hinweis: Android prüft im Hintergrund nur alle paar Stunden – kein Sekunden-Alarm wie in einer Trading-App.

## 0.60 – 17.11.2026
- **Benachrichtigungen funktionieren wieder:** Das neue Fehlerprotokoll hat die Ursache gezeigt – Android verlangt für die Hintergrund-Prüfung „nur mit Internet“ die Berechtigung „Netzwerkstatus lesen“ (ACCESS_NETWORK_STATE). Sie fehlte; jetzt ist sie eingetragen (normale Berechtigung, keine Rückfrage, liest nur „Netz da ja/nein“).
- Fehlerprotokoll erkennt fehlende Berechtigungen als eigenen Fehlercode (DK-09).
- Positionsliste: Prozent, Betrag und „Break-even“ stehen wieder sauber getrennt untereinander (klebten bei großer Schrift aneinander).

## 0.59 – 17.11.2026
- **Hinweis schon ab −35 %:** Ab etwa −35 % braucht es über +54 % Anstieg, um wieder bei null zu sein. Die Break-even-Karte zeigt dann, dass manche die Position auflösen und bei Bedarf neu eröffnen, um den Verlust zu begrenzen – mit Hinweis zur Verlustverrechnung. Keine Empfehlung.
- **Credits: neuer Abschnitt „💡 Inspiration“** – Dank an r/mauerstrassenwetten und Claude (Anthropic) als Inspirationsquelle und Coding-Helfer.
- **🐞 Fehlerprotokoll** (Mehr → Fehlerprotokoll): sammelt technische Fehler – Benachrichtigungen, Abstürze, Skript-Fehler, Fehlermeldungen –, fasst gleiche Fehler zusammen, zeigt Fehlercodes (DK-01 … DK-99) mit bekannter Ursache und schickt sie auf Wunsch per E-Mail – du siehst die Mail vorher. Läuft komplett lokal, ohne Beträge (Zahlen werden durch # ersetzt), bleibt auf dem Handy, bis du es teilst.
- **Benachrichtigungen nach „Aktualisieren“:** Die Hintergrund-Prüfung wurde bei jedem Speichern neu bei Android angemeldet – Android begrenzt das. Jetzt nur noch, wenn sich etwas ändert; eine Ablehnung durch Android wird erkannt und protokolliert.
- **Desktop-Version (Docker):** zeigt jetzt automatisch dieselbe Versionsnummer wie die App; Schritt-für-Schritt-Anleitung für Windows und macOS.

## 0.58 – 17.11.2026
- **Steuertermine im Kalender** (ohne Gewähr, in den Einstellungen abschaltbar): Vorabpauschale Anfang Januar, Abgabefrist Steuererklärung 31.07., Freistellungsauftrag prüfen 01.12., Verlustbescheinigung beantragen bis 15.12.
- **Hinweis bei großem Minus:** Ab −50 % zeigt die Break-even-Karte, dass realisierte Verluste steuerlich mit Gewinnen verrechnet werden können – nur Rechnung und Hinweis, keine Empfehlung.
- **Benachrichtigungen:** Schlägt das Einrichten fehl, nennt die App jetzt den Grund. Ein beschädigter Schlüssel im Android-Speicher wird automatisch neu angelegt. Neuer Knopf „Android-Einstellungen öffnen“, wenn das Handy Benachrichtigungen verbietet, und ein Hinweis, wenn die Hintergrund-Prüfung nicht eingeplant ist.

## 0.57 – 17.11.2026
- **Hebel-Rechner rechnet den echten Knock-out:** Bei 10× liegt die Liquidation nicht 10 % entfernt, sondern wegen Wartungsmarge und Gebühren näher (bei Kraken Futures etwa 7,6–7,7 %). Der Rechner zieht beides ab und zeigt „−7,59 % statt −10 %“. Gewinn und Verlust an Stop und Ziel stehen jetzt nach Gebühren.
- **Broker wählbar:** Kraken Futures (EU), Hyperliquid, Knock-out-Zertifikat (Trade Republic, Scalable, Smartbroker …) oder eigene Werte für Wartungsmarge und Gebühr. Warnung, wenn ein Hebel den Einsatz sofort auffressen würde.

## 0.56 – 17.11.2026
- Der Nachkauf-Rechner heißt jetzt **„In Tranchen kaufen“** – für einen entspannten Durchschnittspreis. Alle Texte, Knöpfe und Erklärungen angepasst.

## 0.55 – 17.11.2026
- **Break-even immer sichtbar:** In der Positionsliste steht bei jeder Position „bis Break-even +X %“ (im Minus) bzw. „Puffer −X %“ (im Plus), nach Gebühren. In der Position selbst eine eigene Kennzahl und ein Rechenbeispiel: was es braucht, um wieder bei null zu sein (mit Ziel-Kurs) – oder was ein Rücksetzer von 20 % für dich bedeutet. Dazu die Tabelle „Verlust und nötiger Anstieg“ (−50 % braucht +100 %). Nur Rechnung, keine Empfehlung.
- **Bessere Suche:** ISIN und WKN werden jetzt über Onvista aufgelöst und landen bei der Xetra- bzw. Frankfurt-Notierung in Euro – vorher oft London/Mailand in Dollar oder Pfund. Gefunden werden jetzt auch Xetra-Gold, iShares Core DAX, ETCs (über Stuttgart) und Aktien per WKN. Die Trefferliste in der Watchlist zeigt die Euro-Notierung zuerst; Fehltreffer per WKN an fremden Börsen sind ausgeschlossen. Getestet mit 53 echten ETFs, ETCs und Aktien.
- **Krypto ohne Euro-Paar** (z. B. NEAR, HYPE, SUI) bekommt automatisch einen Kurs über die Dollar-Notierung, in Euro umgerechnet.

## 0.54 – 16.11.2026
- Englisch: Prozentangaben in den Rechner-Charts ohne überflüssigen Punkt („+100 %“ statt „+100. %“).
- Store-Bilder und Store-Texte auf aktuellem Stand.

## 0.53 – 16.11.2026
- **Aktualisieren-Knopf oben:** „Kurse & Daten aktualisieren“ sitzt jetzt als 🔄 neben dem Einstell-Knopf (⚙️) – von jeder Seite aus erreichbar. Der Knopf unter Import bleibt.
- **Dollar in den Rechnern:** Positionsgröße, Nachkauf und Gewinnmitnahme lassen sich auf Dollar umstellen. Mit dem Kurs „1 € = … $“ (wird bei „Kurse aktualisieren“ gemerkt oder von Hand eingetragen) stehen die Hauptwerte zusätzlich in Euro da.
- **Kurz erklärt:** aufklappbare Erklärung in jedem der vier Rechner, eine Legende auf der Notizen-Seite und eine Erklärung zu Kauf- und Verkaufsmarke in der Watchlist.

## 0.52 – 16.11.2026
- **Rechner-Pläne als Notiz speichern:** Positionsgröße, Nachkauf und Gewinnmitnahme haben jetzt „Als Notiz speichern (mit Chart)“. Die Notiz zeigt Chart und Zahlen und lässt sich mit „Im Rechner öffnen und ändern“ jederzeit weiterbearbeiten. Aus einer Position gespeicherte Pläne erscheinen auch dort unter Notizen.
- Positionsgröße und Gewinnmitnahme zeigen einen Chart mit Marken (Einstieg, Stop, Ziel bzw. Einstand und Verkaufsstufen).
- **Schlüssel-Ampel:** Nach dem Speichern eines API-Schlüssels prüft die App ihn – 🟢 gültig, 🔴 ungültig oder falsche Zeile (z. B. OpenRouter-Schlüssel bei Claude), 🟡 nicht prüfbar. Knopf „Prüfen“ je Dienst. Vertauschte Schlüssel werden schon ohne Internet am Format erkannt.

## 0.51 – 16.11.2026
- **Gewinnmitnahme nach Betrag:** Statt Prozent trägst du ein, wie viel Euro du rausnehmen willst (z. B. „500 € bei Kurs 1.022“) – der Rechner zeigt, wie viele Stück das sind, den Gewinn darin und was vom Rest weiterläuft (Stück und Wert). Knopf „Einstand als Betrag übernehmen“: genau das eingezahlte Geld rausnehmen. Bei Aktien zusätzlich die Zahl für ganze Stücke. Anteil in % bleibt als zweite Möglichkeit.

## 0.50 – 16.11.2026
- **Positionsgrößen-Rechner:** Einstieg, Stop und maximaler Verlust (in € oder % vom Kapital) ergeben Stückzahl und Positionsgröße – enger Stop = größere Position, weiter Stop = kleinere, der Verlust am Stop bleibt gleich. Tabelle „gleiches Risiko, anderer Stop-Abstand“, Chance-Risiko-Verhältnis, Long/Short, Hinweis auf die übliche Wochenschwankung.
- **Gewinnmitnahme-Rechner:** nur einen Teil verkaufen, in bis zu vier Stufen – Erlös und Gewinn je Stufe, Rest, „Einstand zurück“ und bis zu welchem Kurs der Rest abgesichert ist.
- Alle Rechner: Auswahl „Aus deinen Positionen übernehmen“ und Knöpfe in jeder Position (es wird immer nur eine Kopie gerechnet).
- **Nachkauf-Rechner** (Notizen und in jeder Position „📉 Nachkauf rechnen“): A · was wird mein neuer Einstand mit diesem Budget, B · wie viel brauche ich für einen Ziel-Einstand, C · Exit-Szenarien mit Break-even, D · „Einstand rausnehmen“ mit Runner. Optional mit Gebühren (brutto/netto), Warnung bei überproportional großem Nachkauf. Reines Was-wäre-wenn – die gespeicherte Position wird nie verändert. Exakte Dezimalrechnung.

## 0.49 – 15.11.2026
- **Screenshot-Import für alle Broker:** Order-Screenshots von Scalable Capital, Smartbroker+, Revolut, Kraken, Bitvavo, OKX und anderen werden erkannt (Kauf/Verkauf, Name, ISIN, Stück, Kurs, Gebühr, Betrag, Datum) – offline, mit Gegenprobe. Trade Republic wie bisher.
- **Wertpapier-Abrechnungen als PDF** (eine Abrechnung je Kauf/Verkauf): Scalable Capital (auch Sparplan), Smartbroker+ / DAB BNP Paribas (mit Steuern), Trade Republic, Revolut und ältere Baader-Bank-Abrechnungen – landen im passenden Depot, mit Gegenprobe gegen den Endbetrag.
- Texterkennung robuster: „O“ statt „0“ in ISINs wird über die Prüfziffer korrigiert, englische Zahlen wie „€60,000.00“ werden richtig gelesen.

## 0.48 – 15.11.2026
- **Credits & Unterstützen** als eigene Seite (⚙️ → Mehr, unter „Fehler melden“) statt mitten in „Über die App“.
- Einstufungen der Analystenhäuser auf Deutsch (z. B. „Übergewichten“ statt „Overweight“).

## 0.47 – 15.11.2026
- **Analysten:** In der Detailansicht eines Werts neue Karte mit durchschnittlichem Kursziel, Median, Spanne, Abstand zum aktuellen Kurs, Anzahl der Analysten, Konsens und Verteilung Kaufen/Halten/Verkaufen – dazu die letzten Einstufungen der Analystenhäuser mit altem und neuem Kursziel (Quelle Yahoo Finance, kommt mit „Kurse & Daten aktualisieren“).
- **KI:** neue Frage „Analysten & Kursziele“; bei allen Einzelwert-Fragen gehen die Analystendaten mit.
- **Sicherungen heißen jetzt `.dksafe`.** Ältere Sicherungen werden am Inhalt erkannt und lassen sich weiter einlesen.
- **Neuer Signierschlüssel** (Herausgeber „Depot-Kompass“): Die App muss einmal neu installiert werden – vorher eine Sicherung anlegen, alte App deinstallieren, neue installieren, Sicherung einlesen.
- Interne Namen vereinheitlicht; „Über die App“ nennt nur noch Depot-Kompass.
- **Depot verschlüsselt teilen** (✏️ Depot bearbeiten → 🔐): ein einzelnes Depot als `.dksafe` mit eigenem Passwort – über das Teilen-Menü oder zum Speichern. Enthalten: Wertpapiere, Buchungen, Cash; keine Notizen, Originale oder Schlüssel.
- **Geteiltes Depot einlesen:** wird als neues (beobachtetes) Depot hinzugefügt oder ersetzt gezielt ein vorhandenes – alle anderen Daten bleiben unverändert.
- **„Teilen → Depot-Kompass“:** Sicherungen, Screenshots, PDFs und CSV-Dateien aus jeder App direkt an Depot-Kompass schicken – sie landen im normalen Import (bei aktiver PIN erst nach dem Entsperren).

## 0.46 – 15.11.2026
- **KI als Chat:** richtiges Gespräch mit Antwortfenster und **Rückfragen**; Gespräche bleiben verschlüsselt auf dem Handy (Verlauf, höchstens 30, einzeln löschbar), als Notiz speicherbar.
- **Vier KI-Anbieter mit eigenem Schlüssel:** OpenRouter (auch Gratis-Modelle), **Anthropic (Claude)**, **OpenAI (ChatGPT)**, **Google (Gemini)** – Modell-Liste je Anbieter. Ein Claude-/ChatGPT-Abo lässt sich nicht verbinden, nur API-Schlüssel.
- **Reiter „Beispiele“** mit fertigen Fragen, z. B. „Earnings auswerten“ („Die Nvidia-Earnings sind draußen – werte sie vollständig aus“), „Chancen & Risiken eines Werts“, „Schlagzeilen einordnen“, dazu schnelle Fragen.
- **Earnings in der KI:** Bei Einzelwert-Fragen gehen öffentliche Quartalszahlen mit (Ergebnis je Aktie gegen Erwartung, Umsatz und Gewinn je Quartal, KGV, Termine, Schlagzeilen).
- **Neuer Master-Prompt:** persönlicher Aktien-Analyst, der klar und begründet Stellung bezieht (Szenarien, Chancen, Risiken) statt auszuweichen – die Entscheidung bleibt bei dir.
- **Positionen:** Hinweis, wenn Kurse fehlen oder älter als 24 Stunden sind, mit Knöpfen „Internet erlauben“ und „API-Schlüssel“.
- **Spenden-Adressen** (Bitcoin, Monero, Ethereum, Solana, Tron, Stellar, Hyperliquid) mit Kopier-Knopf und Hinweis „nur im genannten Netz senden“.
- Sicherungs-Hinweis nennt keinen bestimmten Passwort-Manager mehr.
- **Benachrichtigungen** (⚙️ → Mehr → 🔔, ab Werk aus, nur mit Internet): starke Kursbewegung (Schwelle wählbar), Earnings heute/morgen, neue Schlagzeilen. Android prüft alle paar Stunden im Hintergrund – kein Server, keine Google-Dienste; die Liste der Werte liegt verschlüsselt auf dem Handy. Neue Berechtigung: Benachrichtigungen.
- **Englisch:** Zahlen und Datum im englischen Format (1,234.56 € · 15/11/2026); die KI-Vorschau, der Auftrag und der Master-Prompt sind auf Englisch.
- **Desktop-Version (Alpha)** für Linux, Windows und macOS per Docker: dieselbe Oberfläche im Browser, lokal unter 127.0.0.1, verschlüsselt, `.dksafe` austauschbar.
- **Testdaten-Ordner** zum Ausprobieren ohne eigenen Broker (6 Broker, 2 Jahre, alles erfunden).
- Hinweis „Community-Server auf Discord – folgt“.

## 0.45 – 14.11.2026
- **Neuer Name: Depot-Kompass.**
- **Neue Paket-Kennung `app.depotkompass`:** Die App muss einmal neu installiert werden. Vorher in der alten Version eine `.dksafe`-Sicherung oder den ZIP-Export anlegen und danach in der neuen App einlesen – alte Sicherungen und Exporte werden weiter erkannt.
- **Credits:** alle genutzten fremden Bausteine (Tesseract OCR, Apache-2.0) und Datenquellen (Yahoo Finance, Onvista, Google News, OpenRouter).
- **Unterstützen:** Bereich für anonyme Spenden mit Kopier-Knopf (Adressen folgen zum Release).
- Englische Übersetzung für Credits und Unterstützen.
- Sicherheits-Durchsicht vor der Veröffentlichung: keine Schlüssel, Passwörter oder Keystores im Code und im Verlauf; Schutzliste (.gitignore) erweitert.
- Vorbereitung für F-Droid und IzzyOnDroid: Store-Texte, Symbol und Screenshots auf Deutsch und Englisch; keine Google- oder Play-Dienste.
- README auf Deutsch und Englisch.

## 0.44 – 13.11.2026
- **Originale aufheben:** jede importierte Datei (CSV, PDF, Screenshot) bleibt in der App (mit App-PIN verschlüsselt); „Aus dem Original neu einlesen“.
- **Alles exportieren als verschlüsselte ZIP** (AES-256, Sicherungs-Passwort): Daten + alle Originale nach Depot sortiert – am PC mit 7-Zip öffnen; in der App wiederherstellen.

## 0.43 – 13.11.2026
- Long/Short bei Zertifikaten erkannt (Name, Screenshot, Onvista) und in der Position wählbar.
- Kalender: Earnings antippen → Ergebnis je Aktie (tatsächlich/erwartet, Überraschung) mit „Aktualisieren“; vergangene Termine bleiben sichtbar.
- Fehler behoben: Zertifikate wurden beim Bearbeiten der Position zur „Aktie“.

## 0.42 – 13.11.2026
- **Screenshots einlesen:** Screenshot einer ausgeführten Trade-Republic-Order (Kauf/Verkauf) wählen – die Texterkennung läuft komplett auf dem Handy, ohne Internet. Gegenprobe Stück × Kurs ± Kosten = Summe.
- Der vollständige Export ersetzt später die Screenshot-Buchungen automatisch (keine Doppelten).
- **Zertifikate, Optionsscheine, Anleihen:** von Hand mit ISIN oder WKN eintragen; „Kurse & Daten aktualisieren“ holt ihren Kurs über Onvista.

## 0.41 – 13.11.2026
- Sprache nur noch unter ⚙️ → Einstellungen (ab Werk Deutsch).
- Import-Knöpfe heißen „CSV- oder PDF-Datei“.
- **Importe verwalten:** ⚙️ → Buchungen → Importe: einen ganzen Import in ein anderes Depot verschieben oder zurücknehmen; einzelne Buchungen verschieben.

## 0.40 – 13.11.2026
- Einführung und PIN-Bildschirm auch auf Englisch.
- Datenschutz-Seite: Hinweis zum Mail-Knopf.

## 0.39 – 12.11.2026
- Zurückschalten von Englisch auf Deutsch repariert (untere Leiste blieb englisch).

## 0.38 – 11.11.2026
- **Englisch** als zweite Sprache (alle Seiten, Meldungen, Rückfragen; die KI antwortet passend).
- **Kalender:** Käufe 🛒 und Verkäufe 🏷️ je Tag und Wert, abschaltbar.
- Kalender: keine kommenden Ex-Tage mehr für Werte, die nicht mehr im Bestand sind.
- **Fingerabdruck entfernt** – private Finanzdaten nur mit PIN (löste beim Einrichten einen Absturz aus).

## 0.37 – 11.11.2026
- ✨ KI als eigener Knopf in der unteren Leiste.
- Kontakt-Adresse und „Fehler melden“ per Mail; Kennzeichnung „Alpha“.
- Untere Leiste bei großer Schrift sauber gekürzt.

## 0.36 – 11.11.2026
- KI bekommt nur Name, Art, Einstiegskurs und Long/Short (Anteile in % nur auf Wunsch).
- Neues Vektor-Logo, scharf in jeder Größe.

## 0.35 – 11.11.2026
- **KI-Fragen zum Portfolio:** Portfolio-Check, Positionen im Minus, Gewinne mitnehmen?, Wert auflösen und umgewichten, eigene Frage – Vorschau des gesendeten Textes.
- **Depot/Person wechseln** auf Übersicht, Positionen, Kalender und KI: ‹ › oder wischen.
- „Über die App“ mit Credits.

## 0.32 – 0.34 – 11.11.2026
- **PDF-Import** für Kontoauszüge von Trade Republic, Revolut, Smartbroker+, Scalable, Sparkasse und anderen Banken; Kraken (Kontoauszug, Monatsauszug, Ledger, Bestand, Kaufbeleg).
- **Gegenprobe** in der Vorschau: stimmt der Kontostand mit dem Auszug?
- Doppelte Buchungen aus verschiedenen Exporten werden erkannt.

## 0.31 – 11.11.2026
- Erster PDF-Import (eigener Leser, offline, ohne Fremd-Bibliothek): Kraken-Kontoauszug und PDF-Tabellen.

## 0.30 – 08.11.2026
- Komplett-Durchgang: jeder Knopf jeder Seite automatisch getestet, Kalender-Test.
- Kalender und „Demnächst“ beachten die Personen-Auswahl.

## 0.28 – 0.29 – 08.11.2026
- **Hebel- und Positionsgrößen-Rechner** mit Chart (Einstieg, Knock-out, Stop, Ziel), als Notiz speicherbar.

## 0.24 – 0.27 – 08.11.2026
- Chart erscheint in jeder Depot-Art; Zeiträume 1W bis Alles.
- Kraken-App „Aktivitäten“; Transfers (z. B. Challenges) als Verlust.
- **Jede CSV** über „Spalten zuordnen“, auch Kontoauszüge.
- **Personen/Haushalt**, **Steuer-Übersicht**, Startbestand zurückrechnen.

## 0.16 – 0.23 – 07.11.2026
- Verschlüsselung mit App-PIN, verschlüsselte Sicherung `.dksafe`, Internet abschaltbar.
- Sachwerte, Einstellungen (Design, Verstecken), eigene News-Quellen.
- Übersicht über alle Depots mit Wertverlauf.

## 0.1 – 0.15 – 07.11.2026
- Import Trade Republic, Scalable, Smartbroker+, Kraken, Bitvavo, OKX, Bestandsliste.
- Mehrere Depots, Cash, Kalender (Dividenden, Ex-Tage, Earnings, Haltefristen), Positionen, Heatmap, Watchlist, Notizen, News.
