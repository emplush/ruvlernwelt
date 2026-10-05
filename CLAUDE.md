# R+V Lernwelt – Persona-Datenbank

Web-App zur Verwaltung von Personas, Firmen und E-Learning-Formaten für das Storytelling der R+V Lernwelt.
Läuft extern bei ALL-INKL.COM mit PHP 8.1+ und MySQL/MariaDB über HTTPS, mit Benutzerkonten und Rollen (Administrator, Mediengestalter, Designer, Nutzer). Alle Texte für Nutzende auf Deutsch, Anrede „Sie“.

## Aufbau

- `webapp/` wird auf den Webspace kopiert: `index.html`, `assets/` (app.js, app.css, handbuch.css, fonts, Logos, mail-logo.png), `api/index.php` (einziger Einstiegspunkt), `lib/` (PHP), `einrichtung/` (schema.sql, Startdaten), `.htaccess`, `daten/` (Galerie-Dateien, gesperrt; bei Updates nie überschreiben).
- Konfiguration (DB, Schlüssel, Einrichtungscode) in `lernwelt-konfiguration.php` über dem Web-Verzeichnis oder `webapp/konfiguration.php`; Vorlage `konfiguration.beispiel.php`. Nie einchecken.
- `webapp/handbuch.html`, `webapp/handbuch/*.jpg`, `webapp/handbuch.pdf`: das Handbuch.
- `tools/test/`: Testumgebung, API- und Browser-Test. `tools/handbuch/`: Build für Handbuch-Bilder und PDF.
- `tools/build_artifact.py`: einzelne HTML-Datei für die Vorschau auf claude.ai (nur lesend, ohne Konten).
- `tools/migration/`: einmalige Übernahme aus Access (Ergebnis liegt in `webapp/einrichtung/startdaten/`).

## Regeln

1. **Handbuch immer mitpflegen.** Jede Änderung an Funktionen, Texten, Abläufen oder Gestaltung der App aktualisiert im selben Commit:
   - den passenden Abschnitt in `webapp/handbuch.html` (neue Funktionen bekommen einen Abschnitt, entfallene werden entfernt),
   - das Datum „Stand“ im Kopf und im Fuß von `handbuch.html`,
   - Bilder und PDF mit `bash tools/handbuch/bauen.sh` (bei neuen Ansichten auch `tools/handbuch/bauen.js` um ein Foto ergänzen).
2. **Design nach „R+V Design“** (Design-System-Artefakt https://claude.ai/artifact/46SH9r4rTB8rSRjfDpnJkN): Farben nur über die Tokens in `app.css`; Mint nur für Interaktion (Hauptbutton Mint mit dunkelblauer Schrift), Orange für Toplines und Fokus, Rot nur für Fehler in Formularen (mit „Fehler:“ im Text), Radius 4 px, keine Schatten oder Verläufe, Schriften RuV Sans/RuV Slab, Symbole aus dem Iconfont `RuV-Icons-v3` (Zuordnung in `ICONS` in `app.js`). E-Mails ebenfalls im R+V-Design (`mailHtml` in `lib/mail.php`).
3. **Rechte immer auf dem Server prüfen** (`RECHTE` in `lib/konten.php`, Routen in `api/index.php`); die Oberfläche blendet nur aus. Mediengestalter dürfen nur die Rolle Nutzer einladen; Konten bearbeiten/löschen nur Administratoren; der letzte aktive Administrator ist geschützt.
4. **Sicherheit nicht aufweichen:** Passwörter nur als Argon2id-Hash, Tokens nur als SHA-256 in der DB, Sitzungs-Cookie `HttpOnly`/`SameSite=Strict`, CSRF-Token und Origin-Prüfung bei jedem POST, keine Inline-Skripte (CSP), Meldungen ohne Hinweis darauf, ob ein Konto existiert. Kein Zwang zum Passwortwechsel, keine Zwei-Faktor-Anmeldung. Anmeldung über Microsoft Entra ID ist ausdrücklich nicht gewünscht.
5. **PHP ab 8.1**, nur PDO mit Platzhaltern, Schemaänderungen in `einrichtung/schema.sql` als `CREATE TABLE IF NOT EXISTS` und `SCHEMA_VERSION` in `lib/einrichtung.php` erhöhen (bestehende Datenbanken werden beim nächsten Aufruf ergänzt).
6. **Galerie:** Uploads nur über `api/index.php?r=galerie-hochladen` (Rechte `galerie_bearbeiten`: Admin, Mediengestalter, Designer), Inhalt mit `getimagesize` prüfen, Zufallsnamen, Auslieferung nur nach Anmeldung. Kein SVG.
7. **Geklärt:** Die Lizenz der RuV-Schriften und des Iconfonts ist freigegeben. Die Persona-Illustrationen sind nicht KI-generiert, daher kein KI-Label an den Bildern. Neue KI-generierte Bilder bekämen das KI-Label aus dem Design-System.

## Prüfen und veröffentlichen

- Voraussetzung: MariaDB läuft (`mysqld_safe --user=mysql &`, vorher `mkdir -p /run/mysqld && chown mysql /run/mysqld`), PHP mit pdo_mysql.
- Testumgebung: `bash tools/test/test_starten.sh <ordner> <port> <db>` (Kopie von webapp, frische DB, Einrichtungscode `code-123-test`, Mails in `<ordner>/mails.jsonl`).
- API-Test: nach Einrichtung per curl (siehe README) `python3 tools/test/api_test.py <url> <mails.jsonl> <db>`.
- Browser-Test: `NODE_PATH=$(npm root -g) node tools/test/ui_test.js <url>/ <mails.jsonl>` auf einer frischen Umgebung.
- Syntax: `node --check webapp/assets/app.js`, `for f in webapp/lib/*.php webapp/api/index.php; do php -l $f; done`.
- Vorschau-Artefakt: `python3 tools/build_artifact.py <ziel.html>`, dann auf https://claude.ai/artifact/WKrxGYVT4Hq1Q4jUwjrTDF veröffentlichen (Handbuch-Dateien als zusätzliche Dateien mitgeben).
- Entwicklungszweig: `claude/personas-webapp-iis-migration-q9prfd`.
