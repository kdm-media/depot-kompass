#!/bin/bash
# Texterkennung fuer assets/ocr/ neu holen (gedrosselt) und Pruefsummen kontrollieren.
# Quelle: npm tesseract.js-core@5.1.1 (Apache-2.0) und @tesseract.js-data/deu@1.0.0 (4.0.0_best_int).
set -euo pipefail
cd "$(dirname "$0")/../assets/ocr"
T=$(mktemp -d)
curl -s --fail --limit-rate 500k -o "$T/core.js" https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1/tesseract-core-lstm.wasm.js
curl -s --fail --limit-rate 500k -o "$T/deu.gz" https://cdn.jsdelivr.net/npm/@tesseract.js-data/deu@1.0.0/4.0.0_best_int/deu.traineddata.gz
python3 -I - "$T" <<'PY'
import sys,hashlib,base64
t=sys.argv[1]
for f,h in [("core.js","jwSqDMgee94z+A6S+gGnpmXwtIhNCYrPXenHEEoR36o="),("deu.gz","MGxCgNDL7Ub7/3J0hr1DuScwGBuugPVpQaCR82O98os=")]:
    assert base64.b64encode(hashlib.sha256(open(f"{t}/{f}","rb").read()).digest()).decode()==h, f+" Pruefsumme falsch"
d=open(f"{t}/deu.gz","rb").read()
open("ocr_deu.js","w").write('"use strict";\n/* Deutsche Sprachdaten fuer Tesseract (tessdata best_int, Apache-2.0), gzip + base64. */\nconst OCR_DEU_GZ_B64 = "'+base64.b64encode(d).decode()+'";\n')
PY
cp "$T/core.js" tesseract-core-lstm.wasm.js; rm -rf "$T"; echo ok
