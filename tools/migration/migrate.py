#!/usr/bin/env python3
"""Erzeugt webapp/data/lernwelt.json aus dem Access-Export (lernwelt_data.json).

Aufruf:
    python3 migrate.py <lernwelt_data.json> <bilder-ordner> <ziel.json>

- <bilder-ordner> enthält die mit extract_bilder.py erzeugten Dateien
  <AccessID>.jpg (Hochformat) und <AccessID>_q.jpg (quadratisch).
- Zeilen mit Vorname "-" sind Firmen und werden in die Firmen-Tabelle übernommen.
- Firmennamen im Feld "Verwandt" werden zu Firmenzuordnungen. Familienbeziehungen
  werden nicht erzeugt; der Freitext bleibt als Vorlage erhalten.
- Die Normalisierung (Gruppe, Geschlecht, Familienstand, Kundenprofil,
  Geburtstag) entspricht scripts/seed.ts der Abacus-App.
"""
import json
import os
import re
import sys
from difflib import SequenceMatcher
from datetime import datetime, timezone

LEER = {"", "---", "-"}


def s(val):
    if val is None:
        return None
    t = str(val).replace("\r\n", "\n").replace("\r", "\n").strip()
    return None if t in LEER else t


def zahl(val):
    t = s(val)
    if t is None:
        return None
    try:
        return int(round(float(t)))
    except ValueError:
        return None


GRUPPE = {
    "Kunde - Privat": "Privatkunde",
    "Kunde - Firma": "Firmenkunde",
    "Kunde-Firma": "Firmenkunde",
    "Bank - Mitarbeiter": "Bankmitarbeitende/r",
    "R+V - Außendienst": "R+V Außendienst",
    "R+V - Wiesbaden": "R+V Innendienst",
    "Extern": "Extern",
}


def gruppe(val):
    t = s(val)
    return GRUPPE.get(t, t) if t else None


def geschlecht(val):
    t = s(val)
    if not t:
        return None
    l = t.lower()
    if l in ("m", "männlich"):
        return "männlich"
    if l in ("f", "w", "weiblich"):
        return "weiblich"
    if l in ("d", "divers"):
        return "divers"
    return t


def familienstand(val):
    t = s(val)
    if not t:
        return "keine Angabe"
    l = t.lower()
    return {
        "verheiratet": "verheiratet",
        "ledig": "ledig / Single",
        "single": "ledig / Single",
        "in beziehung": "ledig / in Beziehung",
        "geschieden": "geschieden",
        "verwitwet": "verwitwet",
    }.get(l, t)


MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli",
          "August", "September", "Oktober", "November", "Dezember"]


def geburtstag(val):
    t = s(val)
    if not t:
        return None
    m = re.match(r"^(\d{1,2})\.\s*([A-Za-zäöüÄÖÜ]+)$", t)
    if not m:
        return None
    monat = next((x for x in MONATE if x.lower() == m.group(2).lower()), None)
    return f"{m.group(1).zfill(2)}. {monat}" if monat else None


KUNDENPROFILE = ["Durchstarter", "Karriereeltern", "Weltoffene", "Aktive",
                 "Lebensentdecker", "Familienmenschen", "Traditionelle", "Besonnene"]


def kundenprofil(val):
    """Liefert (Kundenprofil, nicht zuordenbarer Originalwert)."""
    t = s(val)
    if not t:
        return "keine Angabe", None
    first = t.split("\n")[0].strip()
    cand = first.rsplit(" - ", 1)[-1].strip()
    if cand in KUNDENPROFILE:
        return cand, None
    return "keine Angabe", (first if first not in LEER else None)


def bilder_link(val):
    t = s(val)
    return t.strip("#") if t else None


def norm(text):
    return re.sub(r"[^a-z0-9äöüß]", "", text.lower())


# Bekannte Tippfehler in der Access-Tabelle
NAMENSKORREKTUR = {"Claudio Mariani": "Pietro Mariani"}


def korrigieren(wert):
    if not isinstance(wert, str):
        return wert
    for falsch, richtig in NAMENSKORREKTUR.items():
        wert = wert.replace(falsch, richtig)
    return wert


def main(quelle, bilder, ziel):
    rows = json.load(open(quelle, encoding="utf-8"))
    rows = [{k: korrigieren(v) for k, v in r.items()} for r in rows]
    rows.sort(key=lambda r: zahl(r["ID"]) or 0)

    firmen_rows = [r for r in rows if s(r["Vorname"]) is None]
    persona_rows = [r for r in rows if s(r["Vorname"]) is not None]

    personas = []
    hinweise = []
    for i, r in enumerate(persona_rows, start=1):
        aid = zahl(r["ID"])
        kp, kp_rest = kundenprofil(r["Kundenprofil"])
        sonstiges = s(r["Sonstiges"])
        if kp_rest:
            zusatz = f"Kundenprofil laut Access: {kp_rest}"
            sonstiges = f"{sonstiges}\n{zusatz}" if sonstiges else zusatz
        bild = f"bilder/{aid}_q.jpg" if os.path.exists(os.path.join(bilder, f"{aid}_q.jpg")) else None
        gross = f"bilder/{aid}.jpg" if os.path.exists(os.path.join(bilder, f"{aid}.jpg")) else None
        plz = zahl(r["PLZ"])
        personas.append({
            "id": i,
            "personaId": aid,
            "vorname": s(r["Vorname"]) or "Unbekannt",
            "name": s(r["Name"]) or "Unbekannt",
            "gruppe": gruppe(r["Gruppe"]),
            "funktion": s(r["Funktion"]),
            "kundenprofil": kp,
            "cJourney": s(r["C-Journey"]),
            "geschlecht": geschlecht(r["Geschlecht"]),
            "herkunft": s(r["Herkunft"]),
            "geburtstag": geburtstag(r["Geburtstag"]),
            "alter": zahl(r["Alter"]),
            "strasse": s(r["Straße"]),
            "plz": str(plz).zfill(5) if plz else None,
            "ort": s(r["Ort"]),
            "stadtteil": s(r["Stadtteil"]),
            "beruf": s(r["Beruf"]),
            "familienstand": familienstand(r["Familienstand"]),
            "wohnart": s(r["Wohnart"]),
            "verwandt": s(r["Verwandt"]),
            "lebenslauf": s(r["Lebenslauf"]),
            "aktivitaeten": s(r["Aktivitäten"]),
            "charakter": s(r["Charakter"]),
            "sonstiges": sonstiges,
            "wocStimme": s(r["WoC-Stimme"]),
            "didAvatar": s(r["DID-Avatar"]),
            "bilderLink": bilder_link(r["Bilder-Link"]),
            "bild": bild,
            "bildGross": gross,
        })

    by_name = {norm(f"{p['vorname']} {p['name']}"): p for p in personas}

    def finde_persona(zeile):
        n = norm(zeile)
        treffer = [p for k, p in by_name.items() if k and k in n]
        return max(treffer, key=lambda p: len(p["vorname"] + p["name"])) if treffer else None

    def rest_ohne_name(zeile, p):
        voll = f"{p['vorname']} {p['name']}"
        t = re.sub(re.escape(voll), "", zeile, flags=re.I)
        return t.strip(" -,:;\t") or None

    # Firmen
    firmen = []
    firma_personas = []
    for i, r in enumerate(firmen_rows, start=1):
        teile = []
        rechtsform = s(r["Beruf"])
        if rechtsform:
            teile.append(f"Rechtsform: {rechtsform}")
        if s(r["Wohnart"]):
            teile.append(f"Objekt: {s(r['Wohnart'])}")
        if s(r["Lebenslauf"]):
            teile.append("Mitarbeitende: " + ", ".join(s(r["Lebenslauf"]).split("\n")))
        offen = []
        for zeile in (s(r["Verwandt"]) or "").split("\n"):
            if not zeile.strip():
                continue
            p = finde_persona(zeile)
            if p:
                firma_personas.append({"firmaId": i, "personaId": p["id"],
                                       "funktionInFirma": rest_ohne_name(zeile, p)})
            else:
                offen.append(zeile.strip())
        if offen:
            teile.append("Personen: " + "; ".join(offen))
            hinweise.append(f"Firma {s(r['Name'])}: nicht zugeordnet: {'; '.join(offen)}")
        if s(r["Sonstiges"]):
            teile.append(s(r["Sonstiges"]))
        plz = zahl(r["PLZ"])
        firmen.append({
            "id": i,
            "firmenId": zahl(r["ID"]),
            "name": s(r["Name"]),
            "funktion": s(r["Funktion"]),
            "branche": ", ".join((s(r["Aktivitäten"]) or "").split("\n")) or None,
            "strasse": s(r["Straße"]),
            "plz": str(plz).zfill(5) if plz else None,
            "ort": s(r["Ort"]),
            "sonstiges": "\n".join(teile) or None,
        })

    def finde_firma(zeile):
        n = norm(zeile)
        beste = max(firmen, key=lambda f: SequenceMatcher(None, norm(f["name"]), n).ratio(), default=None)
        if beste and SequenceMatcher(None, norm(beste["name"]), n).ratio() >= 0.8:
            return beste
        return None

    # Firmennamen im Freitext "Verwandt" werden zu Firmenzuordnungen. Familienbeziehungen
    # werden bewusst nicht erzeugt (werden in der App von Hand gepflegt); der Text bleibt stehen.
    for p in personas:
        if not p["verwandt"]:
            continue
        rest = []
        for zeile in p["verwandt"].split("\n"):
            if not zeile.strip():
                continue
            firma = None if finde_persona(zeile) else finde_firma(zeile)
            if firma:
                if not any(fp["firmaId"] == firma["id"] and fp["personaId"] == p["id"] for fp in firma_personas):
                    firma_personas.append({"firmaId": firma["id"], "personaId": p["id"], "funktionInFirma": None})
            else:
                rest.append(zeile.strip())
        p["verwandt"] = "\n".join(rest) or None

    # Funktion in der Firma aus der Berufsbezeichnung ergänzen, wo sie fehlt
    for fp in firma_personas:
        if not fp["funktionInFirma"]:
            p = next(x for x in personas if x["id"] == fp["personaId"])
            fp["funktionInFirma"] = p["beruf"]

    daten = {
        "schema": 1,
        "revision": 1,
        "geaendertAm": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "einstellungen": {"appTitel": "R+V Lernwelt – Persona-Datenbank"},
        "personas": personas,
        "firmen": firmen,
        "firmaPersonas": firma_personas,
        "beziehungen": [],
        "formate": [],
        "formatPersonas": [],
    }
    with open(ziel, "w", encoding="utf-8") as f:
        json.dump(daten, f, ensure_ascii=False, indent=1)
        f.write("\n")

    print(f"{len(personas)} Personas, {len(firmen)} Firmen, {len(firma_personas)} Firmenzuordnungen, "
          f"{sum(1 for p in personas if p['bild'])} Bilder")
    for h in hinweise:
        print("Hinweis:", h)


if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(__doc__)
        sys.exit(1)
    main(*sys.argv[1:])
