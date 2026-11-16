#!/data/data/com.termux/files/usr/bin/bash
# APK bauen in Termux - ohne Gradle, nur aapt2 + javac + d8 + apksigner.
#
#   cd ~/android-depot && ./bauen.sh
#
# Der Signierschluessel liegt in ~/.depot-kompass-signatur/ und darf NIE verloren
# gehen: Updates lassen sich nur mit demselben Schluessel installieren.
set -euo pipefail
cd "$(dirname "$0")"

ANDROID_JAR="$PREFIX/share/java/android.jar"
SIG="$HOME/.depot-kompass-signatur"
B=build
rm -rf "$B" && mkdir -p "$B/res" "$B/klassen" "$B/dex"

if [ ! -f "$SIG/depot-kompass.jks" ]; then
  mkdir -p "$SIG" && chmod 700 "$SIG"
  head -c 24 /dev/urandom | base64 | tr -d '/+=' > "$SIG/passwort"
  chmod 600 "$SIG/passwort"
  keytool -genkeypair -keystore "$SIG/depot-kompass.jks" -alias depot-kompass -keyalg RSA -keysize 4096 -validity 10000 \
    -storepass "$(cat "$SIG/passwort")" -keypass "$(cat "$SIG/passwort")" -dname "CN=Depot-Kompass" >/dev/null
  echo "Neuer Signierschluessel: $SIG/depot-kompass.jks - sichern!"
fi

aapt2 compile --dir res -o "$B/res/"
# Ressourcen-Tabelle aus dem System: das android.jar von Termux hat keine.
aapt2 link -o "$B/roh.apk" -I /system/framework/framework-res.apk --manifest AndroidManifest.xml -A assets \
  --min-sdk-version 26 --target-sdk-version 34 "$B"/res/*.flat
# Fehler muessen den Bau abbrechen - sonst entsteht eine APK ohne MainActivity.
if ! javac -source 8 -target 8 -nowarn -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" \
  -d "$B/klassen" $(find src -name '*.java') > "$B/javac.log" 2>&1; then
  grep -v -i "warning" "$B/javac.log"; echo "JAVA-FEHLER - Bau abgebrochen"; exit 1
fi
d8 --release --min-api 26 --lib "$ANDROID_JAR" --output "$B/dex" $(find "$B/klassen" -name '*.class')
python3 - "$B/roh.apk" "$B/dex/classes.dex" <<'EOF'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], "a", zipfile.ZIP_DEFLATED) as z:
    z.write(sys.argv[2], "classes.dex")
EOF
zipalign -f 4 "$B/roh.apk" "$B/ausgerichtet.apk" 2>/dev/null || cp "$B/roh.apk" "$B/ausgerichtet.apk"
VERSION=$(grep -o 'versionName="[^"]*"' AndroidManifest.xml | cut -d'"' -f2)
ZIEL="Depot-Kompass-$VERSION.apk"
apksigner sign --ks "$SIG/depot-kompass.jks" --ks-pass "file:$SIG/passwort" --out "$ZIEL" "$B/ausgerichtet.apk"
apksigner verify "$ZIEL" && echo "fertig: $PWD/$ZIEL ($(du -h "$ZIEL" | cut -f1))"
