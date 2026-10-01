# R+V Lernwelt – Persona-Datenbank

Web-App zur Verwaltung der Personas, Firmen und E-Learning-Formate, die in der Lernwelt für das Storytelling genutzt werden.
Nachbau der Abacus-App (`Persona_Datenverwaltung_Tool.zip`) für den IIS: **ohne Datenbank, ohne Node.js und ohne Build-Schritt**.

## Inhalt

| Ordner / Datei | Zweck |
|---|---|
| `webapp/` | Die komplette Anwendung. Dieser Ordner wird auf den IIS kopiert. |
| `webapp/index.html`, `webapp/assets/` | Oberfläche (HTML, CSS, JavaScript), Hausschriften, Iconfont und Logos aus „R+V Design“ |
| `webapp/handbuch.html`, `webapp/handbuch.pdf`, `webapp/handbuch/` | Handbuch als Webseite und PDF, in der App unter „Handbuch“ verlinkt |
| `webapp/api/daten.ashx` | Server-Teil (ASP.NET 4.x): Anmeldung, Laden, Speichern, Bilder |
| `webapp/App_Data/lernwelt.json` | Alle Daten: Personas, Firmen, Beziehungen, Formate, Einstellungen |
| `webapp/App_Data/bilder/` | Profilbilder (`<AccessID>.jpg` Hochformat, `<AccessID>_q.jpg` quadratisch) |
| `webapp/App_Data/anmeldung.json` | Passwort-Schlüssel und Einstellung der Passwortabfrage (entsteht beim ersten Aufruf) |
| `webapp/web.config` | IIS-Einstellungen (Startseite, MIME-Typen) |
| `tools/migration/` | Skripte für die Übernahme aus Access |
| `tools/handbuch/` | Testserver sowie Build der Handbuch-Bilder und des PDFs (`bash tools/handbuch/bauen.sh`) |
| `tools/build_artifact.py` | Baut eine einzelne HTML-Datei als Vorschau (Artifact) |

Der IIS liefert den Ordner `App_Data` grundsätzlich nicht aus. Die Daten sind deshalb nur über `api/daten.ashx` erreichbar, und nur nach der Anmeldung.

## Installation auf dem IIS

Voraussetzung ist **ASP.NET 4.x** (Server-Manager → Rollen und Features → *Webserver → Anwendungsentwicklung → ASP.NET 4.x*). Weitere Software ist nicht nötig.

1. Den Ordner `webapp` auf den Server kopieren, z. B. nach `C:\inetpub\lernwelt-personas`.
2. Im IIS-Manager eine neue Website oder eine Anwendung unter einer bestehenden Website anlegen und den physischen Pfad auf diesen Ordner setzen. Der Anwendungspool nutzt **.NET CLR v4.0** (Standard).
3. Der Identität des Anwendungspools (z. B. `IIS AppPool\lernwelt-personas`) das Recht **Ändern** auf den Ordner `webapp\App_Data` geben.
4. Aufrufen, zum Beispiel `http://server/lernwelt-personas/`, und mit dem Standardpasswort **RuVTest1234** anmelden.

Fehlen die Schreibrechte, zeigt die App oben einen Hinweis. Lesen funktioniert dann, Speichern nicht.

**Bei Updates** der Anwendung den Ordner `App_Data` auf dem Server nicht überschreiben, sonst gehen Daten und Passwort verloren. Es genügt, `index.html`, `handbuch.html`, `handbuch.pdf`, `handbuch/`, `assets/`, `api/` und `web.config` zu ersetzen.

Das ausführliche Handbuch für Redaktion und Administration steht in der Anwendung unter **Handbuch** und als `webapp/handbuch.pdf`.

### Speichern

- Änderungen landen sofort in `App_Data/lernwelt.json`. Die vorherige Fassung wird in `App_Data/sicherung/` abgelegt (die letzten 50 bleiben erhalten).
- Hochgeladene Profilbilder werden als JPG-Dateien in `App_Data/bilder/` gespeichert.
- Hat jemand anderes zwischenzeitlich gespeichert, lehnt der Server die Änderung ab und die App bittet, die Seite neu zu laden. So überschreibt niemand unbemerkt fremde Änderungen.
- Unter **Einstellungen → Daten exportieren** lässt sich jederzeit eine Sicherung als JSON-Datei herunterladen und später wieder importieren.

### Passwort

- Beim ersten Aufruf gilt das Standardpasswort **RuVTest1234**. Ein Wechsel wird nicht erzwungen.
- Unter **Einstellungen → Anmeldung & Passwort** lässt sich das Passwort ändern und die Passwortabfrage aus- und wieder einschalten. Beides verlangt das aktuelle Passwort.
- Passwort vergessen: `App_Data/anmeldung.json` auf dem Server löschen. Danach gilt wieder das Standardpasswort.

So ist die Anmeldung ohne HTTPS abgesichert:

- **Das Passwort wird nie übertragen.** Der Browser berechnet daraus einen Schlüssel (PBKDF2-SHA256, 60.000 Runden) und schickt nur einen Nachweis, der mit einem Einmalwert des Servers verknüpft ist. Ein mitgeschnittener Nachweis ist wertlos, weil jeder Einmalwert nur einmal und 5 Minuten lang gilt.
- **Auch beim Passwortwechsel** geht das neue Passwort nicht übers Netz. Übertragen wird nur sein Schlüssel, verschlüsselt mit dem Schlüssel des alten Passworts.
- **Auf dem Server** liegt nur der abgeleitete Schlüssel, nicht das Passwort.
- **Sitzung:** Nach der Anmeldung gilt ein signiertes Cookie (`HttpOnly`, `SameSite=Strict`) für 10 Stunden. Nach einem Passwortwechsel werden alle anderen Sitzungen beendet.
- **Fehlversuche:** Nach 5 falschen Eingaben ist die Anmeldung von dieser Rechneradresse 15 Minuten gesperrt.

Was ohne HTTPS nicht geht: Wer den Netzwerkverkehr mitliest, sieht die übertragenen Daten und das Sitzungs-Cookie. Mit dem Cookie könnte er die laufende Sitzung bis zu ihrem Ablauf mitbenutzen. Außerdem kann er mit einem mitgeschnittenen Nachweis offline Passwörter durchprobieren. Ein langes Passwort macht das praktisch aussichtslos, ein kurzes wie das Standardpasswort nicht.

## Datenübernahme aus Access

Die Datei `App_Data/lernwelt.json` wurde aus `Lernwelt_Test.accdb` (Tabelle `Lernwelt`, 61 Zeilen) erzeugt:

- **52 Personas** mit allen Feldern. Werte wurden wie in der Abacus-App vereinheitlicht (Gruppe, Geschlecht, Familienstand, Kundenprofil, Geburtstag als „TT. Monat“).
- **9 Firmen**: Die Zeilen mit Vorname „-“ (z. B. *EGOWI*, *Pizza Solemio*, *Mazur-Bau*) sind jetzt Firmen mit Adresse, Branche und Beschreibung. Die genannten Personen wurden der Firma zugeordnet (13 Zuordnungen).
- **Familienbeziehungen** werden in der App von Hand gepflegt. Der ursprüngliche Text aus dem Access-Feld „Verwandt“ steht als Vorlage unter „Weitere Familienangaben“.
- In Access stand beim Inhaber von *Pizza Solemio* „Claudio Mariani“. Richtig ist **Pietro Mariani**; die Übernahme korrigiert das.
- **27 Profilbilder**: In Access als eingebettete PDF-Dokumente gespeichert, jetzt als JPG-Dateien.
- Kundenprofile, die keiner der acht Zielgruppen entsprechen (z. B. „BD WiBa Privat“), stehen als Hinweis im Feld „Sonstiges“.

Zum erneuten Ausführen der Übernahme:

```bash
pip install olefile pymupdf pillow
# 1. Bilder aus Access auslesen (Jackcess-JARs liegen in der Abacus-ZIP)
javac -cp jackcess.jar:commons-lang.jar:commons-lang3.jar:commons-logging.jar tools/migration/DumpOle.java
java  -cp jackcess.jar:commons-lang.jar:commons-lang3.jar:commons-logging.jar:tools/migration DumpOle Lernwelt_Test.accdb   # schreibt ole/*.bin
python3 tools/migration/extract_bilder.py ole webapp/App_Data/bilder
# 2. Daten umwandeln (lernwelt_data.json stammt aus der Abacus-ZIP)
python3 tools/migration/migrate.py lernwelt_data.json webapp/App_Data/bilder webapp/App_Data/lernwelt.json
```

## Datenformat

`App_Data/lernwelt.json` enthält die Listen `personas`, `firmen`, `firmaPersonas`, `beziehungen`, `formate`, `formatPersonas` sowie `einstellungen` und eine `revision`.
Beziehungen sind gerichtet: `{"personaId": 3, "relatedPersonaId": 1, "verhaeltnis": "Vater"}` bedeutet „Persona 1 ist der Vater von Persona 3“.
