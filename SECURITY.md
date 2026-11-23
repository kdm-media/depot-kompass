# Sicherheit / Security

## Deutsch

### Eine Sicherheitslücke melden
Bitte **nicht** öffentlich als Issue posten. Stattdessen vertraulich:
- auf GitHub: Reiter **Security → „Report a vulnerability“** (privat, nur für das Projekt sichtbar), oder
- auf unserem Discord-Server per **Ticket** (nur das Team sieht es) – die Lücke selbst bitte nicht in offene Kanäle schreiben.

Offizielle Kommunikation gibt es nur über Discord. Nachrichten von anderen Adressen oder Konten sind nicht von uns.

Hilfreich sind: App-Version, Android-Version/Gerät, Schritte zum Nachstellen, erwartete und tatsächliche Wirkung. Bitte keine echten Finanzdaten mitschicken – zum Nachstellen gibt es den Ordner `testdaten/`.

Wir antworten so schnell wie möglich, bestätigen den Eingang, beheben die Lücke und nennen dich – wenn du möchtest – im Changelog. Wir schreiben niemanden ungefragt an und fragen nie nach Passwörtern, PINs oder Schlüsseln.

### Unterstützte Versionen
Nur die jeweils **neueste Version** (GitHub „Latest“). Depot-Kompass ist eine Alpha-Version.

### Was die App schützt (Stand 0.82)
- Alle Daten bleiben auf dem Gerät, verschlüsselt (AES-GCM mit Schlüssel im Android-Keystore; optionale PIN mit PBKDF2-SHA256, 200 000 Runden). Kein Konto, kein Server, keine Cloud, **keine Tracker**, keine Google-Play-Dienste.
- Internet nur auf Knopfdruck bzw. für die freiwilligen Benachrichtigungen, nur HTTPS (kein Klartext), feste Adressen. Internet lässt sich ganz abschalten.
- Oberfläche (WebView) lädt nur eigene Dateien, strenge Content-Security-Policy (keine fremden oder eingebetteten Skripte), kein Datei-Zugriff, kein Debugging, Bildschirmschutz gegen Screenshots.
- Android-Backup ist abgeschaltet; Sicherungen nur verschlüsselt (`.dksafe`, PBKDF2-SHA256).
- Benachrichtigungen zeigen auf dem Sperrbildschirm keine Inhalte.
- Fremde Dateien (CSV/PDF/Bilder) werden mit Größen- und Feldgrenzen eingelesen; eingeschleuster Text wird nie als HTML ausgeführt (automatischer Test bei jeder Version).

### Bekannte Grenzen
- **ZIP-Export:** Das ZIP-Format (WinZip-AES) leitet den Schlüssel nur mit 1000 Runden ab. Deshalb verlangt die App dafür ein Sicherungs-Passwort mit mindestens 14 Zeichen.
- **Texterkennung:** Tesseract (Apache-2.0) ist als fertig übersetztes WebAssembly enthalten, nicht aus Quellcode gebaut.
- **Desktop (Docker): PIN ohne Geräteschlüssel.** Am Handy ist die PIN zusätzlich an den Android-Keystore gebunden, am PC nicht. Die PIN-Hülle ist dort mit scrypt geschützt, eine 6-stellige PIN lässt sich mit einer Kopie des Ordners `daten/` aber trotzdem offline durchprobieren. Den Rechner selbst schützen (Benutzerpasswort, Festplattenverschlüsselung).
- **Desktop im Heimnetz:** nur mit App-PIN, jeder Browser braucht eine eigene Sitzung. Die Verbindung ist unverschlüsseltes `http` – nur im eigenen, vertrauenswürdigen Netz oder über ein eigenes VPN nutzen, nie per Port-Freigabe ins Internet.
- Gegen ein gerootetes oder mit Schadsoftware befallenes Gerät kann keine App vollständig schützen.

---

## English

### Reporting a vulnerability
Please do **not** open a public issue. Report privately instead:
- on GitHub: **Security → "Report a vulnerability"** (private, visible only to the project), or
- on our Discord server via a **ticket** (only the team can see it) – please do not post the issue itself in open channels.

Official communication only happens on Discord. Messages from other addresses or accounts are not from us.

Please include app version, Android version/device, steps to reproduce, expected and actual impact. Do not send real financial data – use the `testdaten/` folder to reproduce.

We confirm receipt, fix the issue and – if you wish – credit you in the changelog. We never contact anyone unsolicited and never ask for passwords, PINs or keys.

### Supported versions
Only the **latest release** (GitHub "Latest"). Depot-Kompass is alpha software.

### What the app protects (as of 0.82)
- All data stays on the device, encrypted (AES-GCM with a key in the Android Keystore; optional PIN with PBKDF2-SHA256, 200,000 rounds). No account, no server, no cloud, **no trackers**, no Google Play services.
- Internet only on request or for the optional notifications, HTTPS only, fixed endpoints; internet can be switched off completely.
- The UI (WebView) loads only bundled files, strict Content Security Policy (no third-party or inline scripts), no file access, no debugging, screenshot protection.
- Android backup disabled; backups only encrypted (`.dksafe`, PBKDF2-SHA256).
- Notifications show no content on the lock screen.
- Untrusted files (CSV/PDF/images) are read with size and field limits; injected text is never executed as HTML (automated test for every release).

### Known limitations
- **ZIP export:** the ZIP format (WinZip AES) derives the key with only 1000 rounds, so the app requires a backup password of at least 14 characters for it.
- **Text recognition:** Tesseract (Apache-2.0) is bundled as prebuilt WebAssembly, not built from source.
- **Desktop (Docker): PIN without a device key.** On the phone the PIN is also bound to the Android Keystore, on a PC it is not. The PIN wrapper uses scrypt there, but a 6-digit PIN can still be brute-forced offline with a copy of the `daten/` folder. Protect the computer itself (user password, disk encryption).
- **Desktop on the home network:** only with an app PIN, every browser needs its own session. The connection is plain `http` – use it only on your own trusted network or through your own VPN, never via port forwarding to the internet.
- No app can fully protect against a rooted or malware-infected device.
