#!/usr/bin/env bash
# Testlauf Depot-Kompass - vor jeder neuen Version.
#   tests/pruefen.sh            Rechnungen + alle Seiten in 3 Breiten x 2 Schriftgroessen
# Braucht: python3, chromium. Nur erfundene Beispieldaten (tests/beispieldaten).
set -uo pipefail
cd "$(dirname "$0")"
python3 -I sollwerte.py > /dev/null
python3 -I grosstest.py > /dev/null
python3 -I testfaelle.py > /dev/null
# Testseite aus der echten index.html bauen (gleiche Skripte, plus testlauf.js)
sed -e 's#href="style.css"#href="../assets/style.css"#' -e 's#src="logo.svg"#src="../assets/logo.svg"#' -e 's#<script src="sprache.js"></script>#<script src="../assets/sprache.js"></script>#' -e 's#<script src="sprache_en.js"></script>#<script src="../assets/sprache_en.js"></script>#' -e 's#<script src="pdflesen.js"></script>#<script src="../assets/pdflesen.js"></script>#' -e 's#<script src="texterkennung.js"></script>#<script src="../assets/texterkennung.js"></script>#' -e 's#<script src="nachkauf.js"></script>#<script src="../assets/nachkauf.js"></script>#' -e 's#<script src="extras.js"></script>#<script src="attrappe.js"></script><script src="../assets/extras.js"></script>#' \
    -e 's#<script src="app.js"></script>#<script src="../assets/app.js"></script><script src="testlauf.js"></script>#' ../assets/index.html > testseite.html
PORT=$((20000 + RANDOM % 20000))
python3 -m http.server "$PORT" --bind 127.0.0.1 --directory .. > /dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null; rm -rf "$PROFIL" testseite.html' EXIT
PROFIL=$(mktemp -d)
sleep 0.5
# $2 = virtuelle Zeit in ms (Standard 30 s); jeder Aufruf mit frischem Profil, damit nichts haengen bleibt
titel() { local pr; pr=$(mktemp -d -p "$PROFIL"); timeout 300 chromium --headless=new --disable-gpu --user-data-dir="$pr" --hide-scrollbars --window-size=600,1000 \
          --virtual-time-budget="${2:-30000}" --dump-dom "$1" 2>/dev/null | grep -o "<title>[^<]*" | sed 's#<title>##'; rm -rf "$pr"; }
FEHLER=0
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=rechnen")
echo "Rechnungen: ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=gross")
echo "Großer Test (750.000 €, 6 Broker, 2 Jahre): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=mehrfach" 90000)
echo "Mehrere Dateien auf einmal (verdrehte Reihenfolge): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=kalender" 240000)
echo "Kalender (25 Monate, jeder Tag, Summen = Python): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=klicken" 240000)
echo "Klick-Test (jeder Knopf jeder Seite): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=klicken&gross=1" 240000)
echo "Klick-Test mit großen Daten: ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=faelle")
echo "10 Testfälle (Excel, Angriff, Überverkauf, 20.000 Zeilen …): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=zertifikat&attrappe=1" 60000)
echo "Zertifikate (Kurs über Onvista per ISIN/WKN, Attrappe ohne Netz): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=suche&attrappe=1" 60000)
echo "Suche (ISIN/WKN über Onvista zur Euro-Notierung, keine Taiwan-Fehltreffer, Krypto ohne Euro-Paar): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(python3 cdp_lauf.py "http://127.0.0.1:$PORT/tests/testseite.html?modus=originale&attrappe=1" --zeit 120 | head -1)
echo "Originale + ZIP-Export/-Wiederherstellen (Attrappe): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
# Texterkennung braucht ECHTE Rechenzeit (virtuelle Zeit wartet nicht) -> eigener Steuerer
R=$(python3 cdp_lauf.py "http://127.0.0.1:$PORT/tests/testseite.html?modus=screenshot" --zeit 300 | head -1)
echo "Screenshot-Import (Texterkennung, Export ersetzt Screenshots): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
R=$(titel "http://127.0.0.1:$PORT/tests/testseite.html?modus=englisch" 120000)
echo "Englisch (jede Seite, kein deutscher Rest): ${R:-keine Antwort}"; [[ "$R" == "TEST OK" ]] || FEHLER=1
[[ -n "${NUR_RECHNEN:-}" ]] && { [[ $FEHLER == 0 ]] && echo "ALLES OK" || echo "FEHLER GEFUNDEN"; exit $FEHLER; }
for g in "360 780" "412 915" "440 960"; do set -- $g
  for z in 100 160; do
    for s in uebersicht positionen "positionen&heat=1" watchlist kalender news notizen "kalender&kal=1" mehr feedback depots ki news sicherheit daten datenschutz sachwerte einstellungen "notizen&rechner=1" "notizen&nachkauf=1" "notizen&rechner3=1&gebuehr=1" "notizen&betrag=1&gebuehr=1" "positionen&bedetail=minus" "positionen&bedetail=plus" "notizen&rechner3=1&dollar=1" "notizen&nachkauf=1&dollar=1" "schluessel&ampel=1" "notizen&plannotiz=1" "uebersicht&dunkel=1" "uebersicht&einzeln=1" "uebersicht&plus=depot" "uebersicht&bearbeiten=1" steuer einstellungen "ki&kichat=1" "ki&ki=1&kireiter=beispiele" "ki&kichat=1&kireiter=verlauf" hinweise "positionen&analysten=1" "uebersicht&teilen=1" "uebersicht&empfang=1" unterstuetzen fehlerprotokoll; do
      R=$(titel "http://127.0.0.1:$PORT/tests/rahmen.html?w=$1&h=$2&p=seite%3D${s//&/%26}%26schrift%3D$z")
      if [[ "$R" != "TEST OK" ]]; then echo "  $1px $z% ${s}: ${R:-keine Antwort}"; FEHLER=1; fi
    done
  done
done
for s in uebersicht positionen kalender mehr einstellungen ki daten sicherheit "notizen&nachkauf=1" "notizen&rechner3=1&gebuehr=1" "notizen&betrag=1&gebuehr=1" "positionen&bedetail=minus" "positionen&bedetail=plus" "notizen&rechner3=1&dollar=1" "notizen&nachkauf=1&dollar=1" "schluessel&ampel=1" "notizen&plannotiz=1" "ki&kichat=1" "ki&ki=1&kireiter=beispiele" "ki&kichat=1&kireiter=verlauf" hinweise "positionen&analysten=1" "uebersicht&teilen=1" "uebersicht&empfang=1" unterstuetzen; do
  R=$(titel "http://127.0.0.1:$PORT/tests/rahmen.html?w=360&h=780&p=seite%3D${s}%26schrift%3D160%26sprache%3Den")
  if [[ "$R" != "TEST OK" ]]; then echo "  Englisch 360px 160% ${s}: ${R:-keine Antwort}"; FEHLER=1; fi
done
[[ $FEHLER == 0 ]] && echo "ALLES OK" || echo "FEHLER GEFUNDEN"
exit $FEHLER
