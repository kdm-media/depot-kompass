# Depot-Kompass Desktop (Linux, Windows & macOS)

Dieselbe Oberfläche wie die Android-App – lokal im Browser, über Docker. Kalender, KI-Chat, Importe (CSV, PDF, Screenshot),
Steuer-Übersicht usw. funktionieren genauso. 🇬🇧 [English below](#english)

## Datenschutz
- Läuft nur auf deinem Rechner unter `http://127.0.0.1:8098` – nicht im Netzwerk erreichbar, **kein Online-Konto, kein Login**.
- Daten, API-Schlüssel und Original-Dokumente liegen verschlüsselt (AES-256-GCM) im Ordner `daten/`.
  Mit App-PIN ist der Schlüssel zusätzlich mit der PIN geschützt.
- Sicherungen (`.dksafe`) haben dasselbe Format wie in der Android-App: Handy ↔ PC austauschbar.
- Ins Internet nur auf Knopfdruck (Kurse, News, KI) und nur zu festen Adressen. Internet lässt sich in der App ganz abschalten.

## Starten
Voraussetzung: [Docker](https://docs.docker.com/get-docker/) (Linux) bzw. Docker Desktop (Windows, macOS).
Die Desktop-Version nutzt **dieselben App-Dateien** wie die Android-App – nach einem Update hat sie automatisch denselben Stand und dieselbe Versionsnummer.

### Windows (Schritt für Schritt)
1. **Docker Desktop** installieren (docs.docker.com → „Docker Desktop for Windows“) und einmal starten.
2. Auf GitHub **Code → Download ZIP** und die ZIP entpacken (z. B. nach `Dokumente\depot-kompass`).
3. Im entpackten Ordner den Unterordner `desktop` öffnen, in die Adresszeile `powershell` tippen und Enter drücken.
4. `docker compose up -d --build` eingeben – beim ersten Mal dauert es ein paar Minuten.
5. Im Browser <http://127.0.0.1:8098> öffnen.

### macOS (Schritt für Schritt)
1. **Docker Desktop for Mac** installieren (Apple-Chip oder Intel – passende Version wählen) und starten.
2. Auf GitHub **Code → Download ZIP** und entpacken.
3. Programm **Terminal** öffnen, `cd ` tippen, den Ordner `desktop` ins Fenster ziehen, Enter.
4. `docker compose up -d --build` eingeben.
5. Im Browser <http://127.0.0.1:8098> öffnen.

### Linux

```bash
docker compose up -d --build
```
Dann im Browser öffnen: <http://127.0.0.1:8098>

Stoppen: `docker compose stop` · Aktualisieren: `docker compose up -d --build`

**Wichtig:** Den Ordner `daten/` regelmäßig sichern (oder in der App eine `.dksafe`-Sicherung anlegen – sie landet in `daten/sicherungen/`).

## Noch nicht auf dem Desktop
- Verschlüsselte ZIP mit Original-Dokumenten (bitte die `.dksafe`-Sicherung nutzen)
- Benachrichtigungen (gibt es nur in der Android-App)

---

<a id="english"></a>
## English

The same interface as the Android app – locally in your browser via Docker.

- Runs only on your computer at `http://127.0.0.1:8098` – not reachable from the network, **no online account, no login**.
- Data, API keys and original documents are stored encrypted (AES-256-GCM) in `daten/`; with an app PIN the key is additionally protected by the PIN.
- Backups (`.dksafe`) use the same format as the Android app: phone ↔ PC interchangeable.
- Internet only at the push of a button and only to fixed addresses; it can be switched off completely in the app.

Start: install Docker (Linux) or Docker Desktop (Windows, macOS), download the repository as ZIP, open a terminal in the `desktop` folder and run `docker compose up -d --build`, then open <http://127.0.0.1:8098>. The desktop version uses the same app files as Android, so it always has the same version. Back up the `daten/` folder regularly.
Not yet on desktop: encrypted ZIP with originals, notifications (Android only).
