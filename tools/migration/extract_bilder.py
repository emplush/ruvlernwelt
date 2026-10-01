#!/usr/bin/env python3
"""Wandelt die Profilbilder aus der Access-Datenbank in JPG-Dateien um.

Die Bilder liegen in Access als OLE-Objekt "Acrobat Document" (ein PDF je
Persona). DumpOle.java schreibt die Rohdaten als ole/<AccessID>.bin, dieses
Skript holt das PDF heraus und erzeugt:
    <AccessID>.jpg    Hochformat, 600 px hoch (Detailseite)
    <AccessID>_q.jpg  quadratischer Kopf-Ausschnitt, 320 px (Kacheln)

Aufruf:  python3 extract_bilder.py <ole-ordner> <ziel-ordner>
Benötigt: pip install olefile pymupdf pillow
"""
import glob
import io
import os
import sys

import olefile
import pymupdf
from PIL import Image

OLE_SIGNATUR = b"\xd0\xcf\x11\xe0\xa1\xb1\x1a\xe1"


def pdf_aus_ole(raw):
    start = raw.find(OLE_SIGNATUR)
    if start < 0:
        return None
    ole = olefile.OleFileIO(io.BytesIO(raw[start:]))
    for stream in ole.listdir():
        data = ole.openstream(stream).read()
        pos = data.find(b"%PDF", 0, 1024)
        if pos >= 0:
            return data[pos:]
    return None


def main(quelle, ziel):
    os.makedirs(ziel, exist_ok=True)
    anzahl = 0
    for datei in sorted(glob.glob(os.path.join(quelle, "*.bin"))):
        aid = os.path.splitext(os.path.basename(datei))[0]
        pdf = pdf_aus_ole(open(datei, "rb").read())
        if not pdf:
            print(f"{aid}: kein PDF gefunden")
            continue
        seite = pymupdf.open(stream=pdf, filetype="pdf")[0]
        zoom = 600 / seite.rect.height
        pix = seite.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom))
        bild = Image.open(io.BytesIO(pix.tobytes("png"))).convert("RGB")
        bild.save(os.path.join(ziel, f"{aid}.jpg"), "JPEG", quality=82, optimize=True)
        w, _ = bild.size
        kante = int(w * 0.62)
        links = (w - kante) // 2
        kopf = bild.crop((links, 0, links + kante, kante)).resize((320, 320), Image.LANCZOS)
        kopf.save(os.path.join(ziel, f"{aid}_q.jpg"), "JPEG", quality=85, optimize=True)
        anzahl += 1
    print(f"{anzahl} Bilder erzeugt")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    main(*sys.argv[1:])
