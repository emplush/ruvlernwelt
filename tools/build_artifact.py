#!/usr/bin/env python3
"""Baut aus webapp/ eine einzelne HTML-Datei für die Artifact-Vorschau auf claude.ai.

CSS, JavaScript, Logo, Daten und Bilder werden eingebettet. Die Vorschau
speichert Änderungen nur im Browser; für den Betrieb ist webapp/ auf dem IIS gedacht.

Aufruf:  python3 tools/build_artifact.py <ziel.html>
"""
import base64
import json
import os
import sys

WEBAPP = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "webapp")


def data_uri(pfad, mime):
    with open(pfad, "rb") as f:
        return f"data:{mime};base64," + base64.b64encode(f.read()).decode("ascii")


def main(ziel):
    with open(os.path.join(WEBAPP, "data", "lernwelt.json"), encoding="utf-8") as f:
        daten = json.load(f)
    for p in daten["personas"]:
        for feld in ("bild", "bildGross"):
            wert = p.get(feld)
            if wert and not wert.startswith("data:"):
                p[feld] = data_uri(os.path.join(WEBAPP, wert), "image/jpeg")

    css = open(os.path.join(WEBAPP, "assets", "app.css"), encoding="utf-8").read()
    js = open(os.path.join(WEBAPP, "assets", "app.js"), encoding="utf-8").read()
    logo = data_uri(os.path.join(WEBAPP, "assets", "ruv-logo.png"), "image/png")
    js = js.replace("assets/ruv-logo.png", logo)
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
