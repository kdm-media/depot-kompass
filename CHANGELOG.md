# Änderungen – Depot-Kompass

Alle Versionen sind **Alpha** (Testphase). Neueste oben.

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
- **Credits:** alle genutzten Open-Source-Bausteine (Tesseract OCR, Apache-2.0) und Datenquellen (Yahoo Finance, Onvista, Google News, OpenRouter).
- **Unterstützen:** Bereich für anonyme Spenden mit Kopier-Knopf (Adressen folgen zum Release).
- Englische Übersetzung für Credits und Unterstützen.
- Lizenz: GPL-3.0 – der Code wird Open Source.
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
