#!/usr/bin/env python3
"""Seite im Headless-Chromium oeffnen und in ECHTER Zeit warten, bis document.title nicht mehr "WARTE" ist.

Fuer Tests mit langer Rechenzeit (Texterkennung): --virtual-time-budget wartet dort nicht.

    python3 tests/cdp_lauf.py URL [--zeit 300] [--element id]
Ausgabe: der Titel (z. B. "TEST OK"), mit --element zusaetzlich der Text dieses Elements.
Rueckgabe 0 = Titel beginnt mit "TEST OK" oder "FERTIG", sonst 1.
"""
import argparse
import asyncio
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.request

import aiohttp


async def lauf(url, zeit, element):
    profil = tempfile.mkdtemp()
    port = 29200 + os.getpid() % 500
    p = subprocess.Popen(["chromium", "--headless=new", "--disable-gpu", f"--remote-debugging-port={port}",
                          f"--user-data-dir={profil}", "--window-size=600,1000", "about:blank"],
                         stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    try:
        ws_url = None
        for _ in range(100):
            try:
                ziele = json.load(urllib.request.urlopen(f"http://127.0.0.1:{port}/json"))
                ws_url = next(z["webSocketDebuggerUrl"] for z in ziele if z.get("type") == "page")
                break
            except Exception:
                await asyncio.sleep(0.1)
        if not ws_url:
            return "FEHLER Chromium startet nicht", ""
        async with aiohttp.ClientSession() as s, s.ws_connect(ws_url, max_msg_size=0) as ws:
            n = 0

            async def befehl(methode, **params):
                nonlocal n
                n += 1
                await ws.send_json({"id": n, "method": methode, "params": params})
                while True:
                    m = await ws.receive_json()
                    if m.get("id") == n:
                        return m.get("result", {})

            async def wert(ausdruck):
                r = await befehl("Runtime.evaluate", expression=ausdruck, returnByValue=True)
                return r.get("result", {}).get("value")

            await befehl("Page.navigate", url=url)
            ende = time.time() + zeit
            titel = ""
            while time.time() < ende:
                await asyncio.sleep(0.5)
                titel = await wert("document.title") or ""
                if titel.startswith(("TEST", "FERTIG")):
                    break
            text = await wert(f"(document.getElementById({json.dumps(element)})||{{}}).textContent||''") if element else ""
            return titel or "FEHLER keine Antwort", text
    finally:
        p.terminate()
        try:
            p.wait(5)
        except Exception:
            p.kill()
        shutil.rmtree(profil, ignore_errors=True)


def main():
    a = argparse.ArgumentParser()
    a.add_argument("url")
    a.add_argument("--zeit", type=int, default=300)
    a.add_argument("--element")
    x = a.parse_args()
    titel, text = asyncio.run(lauf(x.url, x.zeit, x.element))
    print(titel)
    if text:
        print(text)
    sys.exit(0 if titel.startswith(("TEST OK", "FERTIG")) else 1)


if __name__ == "__main__":
    main()
