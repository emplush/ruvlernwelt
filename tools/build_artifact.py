#!/usr/bin/env python3
"""Baut aus webapp/ eine einzelne HTML-Datei für die Artifact-Vorschau auf claude.ai.

CSS, JavaScript, Logo, Startdaten und Bilder werden eingebettet. Die Vorschau
zeigt die Daten nur lesend (ohne Konten); für den Betrieb ist webapp/ mit PHP und
MySQL gedacht (siehe README.md).

Aufruf:  python3 tools/build_artifact.py <ziel.html>
"""
import base64
import json
import os
import sys

WEBAPP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "webapp")
STARTDATEN = os.path.join(WEBAPP, "einrichtung", "startdaten")


def data_uri(pfad, mime):
    with open(pfad, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode("ascii")


def main(ziel):
    with open(os.path.join(STARTDATEN, "lernwelt.json"), encoding="utf-8") as f:
        daten = json.load(f)
    for p in daten["personas"]:
        for feld in ("bild", "bildGross"):
            wert = p.get(feld)
            if wert and not wert.startswith("data:"):
                p[feld] = data_uri(os.path.join(STARTDATEN, wert), "image/jpeg")

    css = open(os.path.join(WEBAPP, "assets", "app.css"), encoding="utf-8").read()
    for datei in os.listdir(os.path.join(WEBAPP, "assets", "fonts")):
        css = css.replace(f'url("fonts/{datei}")', 'url("' + data_uri(os.path.join(WEBAPP, "assets", "fonts", datei), "font/woff2") + '")')
    js = open(os.path.join(WEBAPP, "assets", "app.js"), encoding="utf-8").read()
    for logo in ("logo-negativ.svg", "logo-claim-positiv.svg"):
        js = js.replace("assets/" + logo, data_uri(os.path.join(WEBAPP, "assets", logo), "image/svg+xml"))
    daten_json = json.dumps(daten, ensure_ascii=False).replace("</", "<\\/")

    html = (
        "<title>R+V Lernwelt Personas</title>\n"
        f"<style>\n{css}\n</style>\n"
        '<div id="app" class="app"><div class="laden">Daten werden geladen …</div></div>\n'
        f'<script type="application/json" id="startdaten">{daten_json}</script>\n'
        f"<script>\n{js}\n</script>\n"
    )
    with open(ziel, "w", encoding="utf-8") as f:
        f.write(html)
    print(f"{ziel}: {len(html.encode('utf-8')) / 1024 / 1024:.1f} MB")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1])
