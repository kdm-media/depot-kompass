#!/usr/bin/env python3
"""Depot-Kompass Logo als Vektor (48 x 48): SVG fuer Vorschau/Webseite + Android-VectorDrawable fuer das App-Symbol.
Nach der Vorlage (Kompass, vier Spitzen, Nadel, gruene Balken, Umlaufbahn) - vereinfacht, damit es auch in 48 px scharf ist."""
import math, sys, pathlib
aus = pathlib.Path(sys.argv[1])
C = 24.0
def f(x): return f"{x:.2f}".rstrip("0").rstrip(".")
def ellipse(rx, ry, rot, von, bis, n=64):
    a = math.radians(rot); pts = []
    for i in range(n + 1):
        t = math.radians(von + (bis - von) * i / n)
        x, y = rx * math.cos(t), ry * math.sin(t)
        pts.append((C + x * math.cos(a) - y * math.sin(a), C + x * math.sin(a) + y * math.cos(a)))
    return "M" + " L".join(f"{f(x)},{f(y)}" for x, y in pts)
def kreis(r): return f"M{f(C - r)},{f(C)} A{f(r)},{f(r)} 0 1,1 {f(C + r)},{f(C)} A{f(r)},{f(r)} 0 1,1 {f(C - r)},{f(C)} Z"
def ring(r1, r2): return kreis(r1) + " " + f"M{f(C - r2)},{f(C)} A{f(r2)},{f(r2)} 0 1,0 {f(C + r2)},{f(C)} A{f(r2)},{f(r2)} 0 1,0 {f(C - r2)},{f(C)} Z"
spitzen = ["M24,1.5 L27.2,9 L24,11.5 L20.8,9 Z", "M24,46.5 L27.2,39 L24,36.5 L20.8,39 Z",
           "M1.5,24 L9,20.8 L11.5,24 L9,27.2 Z", "M46.5,24 L39,20.8 L36.5,24 L39,27.2 Z"]
balken = [(21.2, 29.5), (25.4, 26.5), (29.6, 23), (33.8, 19)]           # x, oben; unten = 36
balken_p = " ".join(f"M{f(x)},{f(o + 1)} Q{f(x)},{f(o)} {f(x + 1)},{f(o)} L{f(x + 2.4)},{f(o)} Q{f(x + 3.4)},{f(o)} {f(x + 3.4)},{f(o + 1)} L{f(x + 3.4)},38 L{f(x)},38 Z" for x, o in balken)
nadel_hell = "M10.8,37.2 L27.3,27.3 L37.2,10.8 Z"
nadel_dunkel = "M10.8,37.2 L20.7,20.7 L37.2,10.8 Z"
bahn_hinten = ellipse(22.5, 6.2, -24, 180, 360)
bahn_vorn = ellipse(22.5, 6.2, -24, 0, 180)
teile = [  # (name, pfad, fuellung oder None, strich, strichbreite)
    ("bahn_hinten", bahn_hinten, None, ("#7C3AED", "#2DD4BF"), 1.6),
    ("scheibe", kreis(14.2), ("#1E1652", "#0E0B2E"), None, 0),
    ("balken", balken_p, ("#34E8A0", "#19C48A"), None, 0),       # wird auf die Scheibe begrenzt
    ("ring", ring(16.6, 13.6), ("#D35BF5", "#5B2BE0"), None, 0),
    ("spitzen", " ".join(spitzen), ("#C084FC", "#6D28D9"), None, 0),
    ("nadel_dunkel", nadel_dunkel, ("#A855F7", "#7C3AED"), None, 0),
    ("nadel_hell", nadel_hell, ("#FFFFFF", "#D9CCFF"), None, 0),
    ("mitte", kreis(2.9), ("#3B2A8F", "#24186B"), ("#F5F0FF", "#F5F0FF"), 1.1),
    ("bahn_vorn", bahn_vorn, None, ("#2DD4BF", "#E879F9"), 1.9),
]
# ---------- SVG
svg = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="48" height="48"><defs>',
       f'<clipPath id="k"><path d="{kreis(14.2)}"/></clipPath>']
for i, (n, p, fu, st, sb) in enumerate(teile):
    for art, farben in (("f", fu), ("s", st)):
        if farben: svg.append(f'<linearGradient id="{art}{i}" x1="8" y1="8" x2="40" y2="40" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="{farben[0]}"/><stop offset="1" stop-color="{farben[1]}"/></linearGradient>')
svg.append("</defs>")
for i, (n, p, fu, st, sb) in enumerate(teile):
    attr = f'fill="url(#f{i})"' if fu else 'fill="none"'
    if st: attr += f' stroke="url(#s{i})" stroke-width="{sb}" stroke-linecap="round"'
    if n == "balken": attr += ' clip-path="url(#k)"'
    svg.append(f'<path d="{p}" {attr}/>')
svg.append("</svg>")
(aus / "logo.svg").write_text("\n".join(svg), encoding="utf-8")
# ---------- Android VectorDrawable (Verlaeufe ueber aapt:attr, ab Android 7)
def verlauf(farben):
    return (f'<gradient android:type="linear" android:startX="8" android:startY="8" android:endX="40" android:endY="40" '
            f'android:startColor="{farben[0]}" android:endColor="{farben[1]}"/>')
x = ['<?xml version="1.0" encoding="utf-8"?>',
     '<!-- Depot-Kompass App-Symbol (Vektor, scharf in jeder Groesse). Erzeugt mit entwurf/logo_bauen.py - nicht von Hand aendern. -->',
     '<vector xmlns:android="http://schemas.android.com/apk/res/android" xmlns:aapt="http://schemas.android.com/aapt"',
     '    android:width="48dp" android:height="48dp" android:viewportWidth="48" android:viewportHeight="48">']
for n, p, fu, st, sb in teile:
    inner = []
    kopf = f'  <path android:name="{n}" android:pathData="{p}"'
    if fu: inner.append(f'    <aapt:attr name="android:fillColor">{verlauf(fu)}</aapt:attr>')
    if st:
        kopf += f' android:strokeWidth="{sb}" android:strokeLineCap="round"'
        inner.append(f'    <aapt:attr name="android:strokeColor">{verlauf(st)}</aapt:attr>')
    zeile = kopf + ">\n" + "\n".join(inner) + "\n  </path>"
    if n == "balken": zeile = f'  <group android:name="scheibe_begrenzt">\n  <clip-path android:pathData="{kreis(14.2)}"/>\n{zeile}\n  </group>'
    x.append(zeile)
x.append("</vector>")
(aus / "icon.xml").write_text("\n".join(x) + "\n", encoding="utf-8")
print("ok")
