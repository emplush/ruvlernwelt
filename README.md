# R+V Lernwelt – Persona-Datenbank

Web-App zur Verwaltung der Personas, Firmen und E-Learning-Formate, die in der Lernwelt für das Storytelling genutzt werden.
Nachbau der Abacus-App (`Persona_Datenverwaltung_Tool.zip`) für den IIS: **ohne Datenbank, ohne Node.js und ohne Build-Schritt**.

## Inhalt

| Ordner / Datei | Zweck |
|---|---|
| `webapp/` | Die komplette Anwendung. Dieser Ordner wird auf den IIS kopiert. |
| `webapp/index.html`, `webapp/assets/` | Oberfläche (HTML, CSS, JavaScript), R+V-Logo |
| `webapp/data/lernwelt.json` | Alle Daten: Personas, Firmen, Beziehungen, Formate, Einstellungen |
| `webapp/bilder/` | Profilbilder (`<AccessID>.jpg` Hochformat, `<AccessID>_q.jpg` quadratisch) |
| `webapp/api/speichern.ashx` | Optionale Server-Speicherung (ASP.NET 4.x) |
| `webapp/web.config` | IIS-Einstellungen (JSON-MIME-Typ, Startseite, kein Caching der Daten) |
| `tools/migration/` | Skripte für die Übernahme aus Access |
| `tools/build_artifact.py` | Baut eine einzelne HTML-Datei als Vorschau (Artifact) |

## Installation auf dem IIS

1. Den Ordner `webapp` auf den Server kopieren, z. B. nach `C:\inetpub\lernwelt-personas`.
2. Im IIS-Manager eine neue Website oder eine Anwendung unter einer bestehenden Website anlegen und den physischen Pfad auf diesen Ordner setzen.
3. Aufrufen, zum Beispiel `http://server/lernwelt-personas/`. Die Personas erscheinen sofort.

Mehr ist für das **Lesen** nicht nötig. Es werden nur statische Dateien ausgeliefert.

### Speichern auf dem Server (empfohlen)

Damit Änderungen direkt für alle gespeichert werden:

1. Im Server-Manager das Feature **ASP.NET 4.x** für den IIS aktivieren (*Webserver → Anwendungsentwicklung → ASP.NET 4.x*), falls noch nicht vorhanden.
2. Den Anwendungspool auf **.NET CLR v4.0** stellen (Standard bei neuen Pools).
3. Der Identität des Anwendungspools (z. B. `IIS AppPool\lernwelt-personas`) das Recht **Ändern** auf die Ordner `webapp\data` und `webapp\bilder` geben.

Die App erkennt das automatisch. Unten in der Navigation steht dann „Gespeichert auf dem Server“.

Was beim Speichern passiert:

- Die Datei `data/lernwelt.json` wird ersetzt. Die vorherige Fassung landet in `data/sicherung/` (die letzten 50 bleiben erhalten).
- Hochgeladene Profilbilder werden als JPG-Dateien in `bilder/` abgelegt.
- Hat jemand anderes zwischenzeitlich gespeichert, lehnt der Server die Änderung ab und die App bittet, die Seite neu zu laden. So überschreibt niemand unbemerkt fremde Änderungen.

### Ohne Server-Speicherung

Ist ASP.NET nicht verfügbar, funktioniert die App trotzdem. Änderungen bleiben dann zunächst im Browser. Unter **Einstellungen → Daten exportieren** entsteht eine JSON-Datei, mit der Sie `data/lernwelt.json` auf dem Server ersetzen. Eine gelbe Leiste erinnert daran, solange es nicht exportierte Änderungen gibt.

### Anmeldung

Die Abacus-App hatte ein gemeinsames Passwort. Ohne Server-Logik wäre eine Passwortabfrage im Browser kein wirksamer Schutz, weil `data/lernwelt.json` direkt abrufbar bleibt. Den Zugriff regelt deshalb der IIS:

1. Im IIS-Manager die Website wählen → **Authentifizierung**.
2. **Anonyme Authentifizierung** deaktivieren, **Windows-Authentifizierung** aktivieren (ggf. vorher im Server-Manager als Rollendienst installieren).
3. Optional unter **Autorisierungsregeln** nur eine AD-Gruppe zulassen.

## Datenübernahme aus Access

Die Datei `data/lernwelt.json` wurde aus `Lernwelt_Test.accdb` (Tabelle `Lernwelt`, 61 Zeilen) erzeugt:

- **52 Personas** mit allen Feldern. Werte wurden wie in der Abacus-App vereinheitlicht (Gruppe, Geschlecht, Familienstand, Kundenprofil, Geburtstag als „TT. Monat“).
- **9 Firmen**: Die Zeilen mit Vorname „-“ (z. B. *EGOWI*, *Pizza Solemio*, *Mazur-Bau*) sind jetzt Firmen mit Adresse, Branche und Beschreibung. Die genannten Personen wurden der Firma zugeordnet (13 Zuordnungen).
- **52 Familienbeziehungen**: Namen im Feld „Verwandt“, die zu einer Persona passen, sind jetzt echte Verknüpfungen. Was nicht zugeordnet werden konnte (z. B. „Sohn Fynn-Luka, 8 Jahre“), steht weiter unter „Weitere Familienangaben“.
- **27 Profilbilder**: In Access als eingebettete PDF-Dokumente gespeichert, jetzt als JPG-Dateien.
- Kundenprofile, die keiner der acht Zielgruppen entsprechen (z. B. „BD WiBa Privat“), stehen als Hinweis im Feld „Sonstiges“.

Zum erneuten Ausführen der Übernahme:

```bash
pip install olefile pymupdf pillow
# 1. Bilder aus Access auslesen (Jackcess-JARs liegen in der Abacus-ZIP)
javac -cp jackcess.jar:commons-lang.jar:commons-lang3.jar:commons-logging.jar tools/migration/DumpOle.java
java  -cp jackcess.jar:commons-lang.jar:commons-lang3.jar:commons-logging.jar:tools/migration DumpOle Lernwelt_Test.accdb   # schreibt ole/*.bin
python3 tools/migration/extract_bilder.py ole webapp/bilder
# 2. Daten umwandeln (lernwelt_data.json stammt aus der Abacus-ZIP)
python3 tools/migration/migrate.py lernwelt_data.json webapp/bilder webapp/data/lernwelt.json
```

## Datenformat

`data/lernwelt.json` enthält die Listen `personas`, `firmen`, `firmaPersonas`, `beziehungen`, `formate`, `formatPersonas` sowie `einstellungen` und eine `revision`.
Beziehungen sind gerichtet: `{"personaId": 3, "relatedPersonaId": 1, "verhaeltnis": "Vater"}` bedeutet „Persona 1 ist der Vater von Persona 3“.
