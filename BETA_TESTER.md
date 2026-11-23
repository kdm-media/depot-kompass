# Depot-Kompass – Alpha-Test

Danke, dass du mittestest! Die App ist noch in Arbeit. Sie soll dir zeigen, was in all deinen Depots,
Konten und Sachwerten steckt, und zwar **nur auf deinem Handy**.

> **Keine Anlageberatung, keine Steuerberatung, keine Garantie.** Prüfe wichtige Zahlen immer beim Broker.

## 1. Installieren
1. Die Datei `Depot-Kompass-<version>.apk` öffnen, die du bekommen hast.
2. „Installation aus dieser Quelle erlauben“ bestätigen.
3. Updates: Die neue Version einfach drüber installieren, deine Daten bleiben.

## 2. Erster Start
1. **Offline** oder **mit Internet** wählen. Mit Internet holt die App auf Knopfdruck aktuelle Kurse
   und Termine. Sie fragt dabei nur, welche Werte du hast, nie nach Beträgen.
2. **App-PIN festlegen** (6 Ziffern). Wichtig: **PIN vergessen = Daten weg.** Darum gleich danach
   unter ⚙️ → *Sicherheit & Sicherung* ein Sicherungs-Passwort und einen Ordner einrichten.

## 3. Daten holen
Exportiere bei deinem Broker die **Transaktionen als CSV**, dann in der App:
**Übersicht → „Dateien wählen“** (oder ⚙️ → *Import*). Mehrere Dateien auf einmal gehen auch.

| Broker | Wo der Export ist (ungefähr) |
|---|---|
| Trade Republic | Profil → Transaktionen → Export (CSV) |
| Scalable Capital | Transaktionen → Export |
| Smartbroker+ | Depot → Transaktionen / Depotbestand → CSV |
| Kraken | Kraken Pro: Verlauf → Export (Ledger oder Trades); Kraken-App: Aktivitäten → Export |
| Bitvavo | Web: Transaktionsverlauf → Export (CSV) |
| OKX | Assets → Order Center → Handelsverlauf → Download |
| **andere / Girokonto** | Irgendeine CSV wählen → die App fragt einmal, welche Spalte was ist, und merkt es sich |

**PDF geht auch:** Kontoauszüge von Trade Republic, Revolut, Smartbroker+, Scalable, Sparkasse und anderen Banken,
Kraken (Kontoauszug, Ledger, Bestand, Kaufbeleg-Mail) und jede PDF mit einer Tabelle. Nicht: Scans/Fotos, PDFs mit Passwort.
Die Vorschau zeigt eine **Gegenprobe**, ob der Kontostand mit dem Auszug übereinstimmt.

## 4. Was du testen kannst
- [ ] Stimmen Bestand, Einstand und Gewinn mit deinem Broker überein?
- [ ] Übersicht: Gesamtvermögen, Chart (1W bis Alles), Depots einzeln
- [ ] Kalender: erhaltene Dividenden, Ex-Tage, Haltefristen, Käufe/Verkäufe
- [ ] Depot/Person wechseln: ‹ › oben oder wischen
- [ ] Sprache: ⚙️ → Einstellungen → Sprache Deutsch/English (und zurück)
- [ ] Screenshot einer ausgeführten Order (Trade Republic, Scalable, Smartbroker+, Revolut, Kraken, Bitvavo …) importieren (CSV / PDF / Screenshot wählen) – stimmt die Gegenprobe?
- [ ] Zertifikat von Hand mit WKN eintragen, dann ⚙️ → Import → „Kurse & Daten aktualisieren“ – kommt ein Kurs?
- [ ] ⚙️ → Import → „Alles exportieren (ZIP)“ → am PC mit 7-Zip und Passwort öffnen; in der App wiederherstellen
- [ ] Kalender: Earnings antippen → „Aktualisieren“
- [ ] Import ins falsche Depot: ⚙️ → Buchungen → Importe → verschieben oder zurücknehmen
- [ ] ✨ KI (unten rechts): einschalten, „Gratis-Modelle laden“, eine Frage senden
- [ ] Positionen, Heatmap, Watchlist
- [ ] Notizen und **Hebel-Rechner** mit Chart
- [ ] ⚙️ → Steuer-Übersicht: Passen die Jahre ungefähr zu deiner Jahresbescheinigung?
- [ ] Auge oben: verschwinden alle Beträge?
- [ ] App schließen und wieder öffnen: Kommt die PIN? (Fingerabdruck gibt es bewusst nicht.)
- [ ] Sicherung anlegen und auf einem zweiten Gerät wiederherstellen (wenn du eins hast)

## 5. Fehler melden
In der App: **⚙️ → „Fehler melden (Alpha)“** – dort steht, wie du auf unserem Discord ein **Ticket** öffnest (der einzige offizielle Weg). Kurz gesagt:
- **Schicken:** Versionsnummer, was du gemacht hast, was passiert ist, ein Screenshot **mit Auge zu**
  (Beträge aus).
- **Nicht schicken:** deine CSV-Dateien, Kontoauszüge, Sicherungen, Beträge, PIN oder Passwörter.

Die App sendet selbst nichts: keine Statistik, keine Fehlerberichte im Hintergrund.
