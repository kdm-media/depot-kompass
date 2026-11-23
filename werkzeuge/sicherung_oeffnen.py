#!/usr/bin/env python3
"""Depot-Kompass: .dksafe-Datei am PC (Linux) oeffnen - nur lokal, nichts geht ins Netz.

    python3 sicherung_oeffnen.py DATEI.dksafe            -> fragt das Passwort, schreibt DATEI.json bzw. .csv
    python3 sicherung_oeffnen.py DATEI.dksafe --targz    -> zusaetzlich als .tar.gz gepackt (unverschluesselt!)

Format (wie Sicherung.java): JSON mit salz, iv, daten (Base64), runden;
Schluessel = PBKDF2-SHA256(Passwort, salz, runden, 32 Byte), Inhalt = AES-256-GCM.
Braucht python3-cryptography (Debian: apt install python3-cryptography).
"""
import base64
import getpass
import hashlib
import io
import json
import sys
import tarfile
from pathlib import Path

from cryptography.hazmat.primitives.ciphers.aead import AESGCM


def oeffnen(roh: str, passwort: str) -> str:
    d = json.loads(roh)
    if not all(k in d for k in ("salz", "iv", "daten", "runden")):
        raise ValueError("keine Depot-Kompass-Sicherung")
    k = hashlib.pbkdf2_hmac("sha256", passwort.encode(), base64.b64decode(d["salz"]), int(d["runden"]), 32)
    return AESGCM(k).decrypt(base64.b64decode(d["iv"]), base64.b64decode(d["daten"]), None).decode()


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    quelle = Path(sys.argv[1])
    try:
        inhalt = oeffnen(quelle.read_text(encoding="utf-8"), getpass.getpass("Passwort: "))
    except Exception:
        sys.exit("Falsches Passwort oder beschaedigte Datei.")
    endung = ".json" if inhalt.lstrip().startswith("{") else ".csv"
    name = quelle.name.removesuffix(".dksafe")
    ziel = quelle.with_name(name if name.endswith(endung) else name + endung)
    ziel.write_text(inhalt, encoding="utf-8")
    print("entschluesselt:", ziel, "- Achtung: diese Datei ist jetzt OFFEN lesbar.")
    if "--targz" in sys.argv:
        tz = ziel.with_suffix(ziel.suffix + ".tar.gz")
        with tarfile.open(tz, "w:gz") as t:
            daten = inhalt.encode()
            info = tarfile.TarInfo(ziel.name); info.size = len(daten)
            t.addfile(info, io.BytesIO(daten))
        print("gepackt:", tz)


if __name__ == "__main__":
    main()
