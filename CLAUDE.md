# R+V Lernwelt – Persona-Datenbank

Web-App zur Verwaltung von Personas, Firmen und E-Learning-Formaten für das Storytelling der R+V Lernwelt.
Läuft auf einem IIS ohne Datenbank (ASP.NET 4.x, ohne HTTPS). Alle Texte für Nutzende auf Deutsch, Anrede „Sie“.

## Aufbau

- `webapp/` wird auf den IIS kopiert: `index.html`, `assets/` (app.js, krypto.js, app.css, handbuch.css, fonts, Logos), `api/daten.ashx` (Server-Teil), `App_Data/` (Daten, nie per HTTP erreichbar).
- `webapp/handbuch.html`, `webapp/handbuch/*.jpg`, `webapp/handbuch.pdf`: das Handbuch.
- `tools/handbuch/`: Testserver und Build für Handbuch-Bilder und PDF.
- `tools/build_artifact.py`: einzelne HTML-Datei für die Vorschau auf claude.ai.
- `tools/migration/`: einmalige Übernahme aus Access (nicht erneut über bestehende Daten laufen lassen).

## Regeln

1. **Handbuch immer mitpflegen.** Jede Änderung an Funktionen, Texten, Abläufen oder Gestaltung der App aktualisiert im selben Commit:
   - den passenden Abschnitt in `webapp/handbuch.html` (neue Funktionen bekommen einen Abschnitt, entfallene werden entfernt),
   - das Datum „Stand“ im Kopf und im Fuß von `handbuch.html`,
   - Bilder und PDF mit `bash tools/handbuch/bauen.sh` (bei neuen Ansichten auch `tools/handbuch/bauen.js` um ein Foto ergänzen).
2. **Design nach „R+V Design“** (Design-System-Artefakt https://claude.ai/artifact/46SH9r4rTB8rSRjfDpnJkN): Farben nur über die Tokens in `app.css`; Mint nur für Interaktion (Hauptbutton Mint mit dunkelblauer Schrift), Orange für Toplines und Fokus, Rot nur für Fehler in Formularen (mit „Fehler:“ im Text), Radius 4 px, keine Schatten oder Verläufe, Schriften RuV Sans/RuV Slab, Symbole aus dem Iconfont `RuV-Icons-v3` (Zuordnung in `ICONS` in `app.js`).
3. **`api/daten.ashx` nur in C#-5-Syntax** (der IIS übersetzt ohne Roslyn): kein `=>` bei Membern, kein `$""`, kein `?.`, kein `nameof`. Prüfen mit `mcs -langversion:5`.
4. **Das Passwort verlässt den Browser nie** (Challenge-Response in `krypto.js` und `daten.ashx`). Änderungen am Protokoll immer auf beiden Seiten und im Testserver `tools/handbuch/testserver.py`.
5. **`App_Data` nie überschreiben** bei Updates auf dem Server.

## Prüfen und veröffentlichen

- Testserver: `python3 tools/handbuch/testserver.py <kopie-von-webapp> 8190` (immer auf einer Kopie, schreibt in die Daten). Passwort `RuVTest1234`.
- Syntax: `node --check webapp/assets/app.js`.
- Vorschau-Artefakt: `python3 tools/build_artifact.py <ziel.html>`, dann auf https://claude.ai/artifact/WKrxGYVT4Hq1Q4jUwjrTDF veröffentlichen (Handbuch-Dateien als zusätzliche Dateien mitgeben).
- Entwicklungszweig: `claude/personas-webapp-iis-migration-q9prfd`.
