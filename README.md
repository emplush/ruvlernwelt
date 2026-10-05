# R+V Lernwelt – Persona-Datenbank

Web-App zur Verwaltung der Personas, Firmen und E-Learning-Formate, die in der Lernwelt für das Storytelling genutzt werden.
Läuft bei **ALL-INKL.COM** (oder einem anderen Hoster) mit **PHP 8.1+ und MySQL/MariaDB**, über HTTPS, ohne Build-Schritt.
Zugang über persönliche Benutzerkonten mit Rollen; neue Personen kommen per Einladung.

## Inhalt

| Ordner / Datei | Zweck |
|---|---|
| `webapp/` | Die komplette Anwendung. Dieser Ordner wird auf den Webspace kopiert. |
| `webapp/index.html`, `webapp/assets/` | Oberfläche (HTML, CSS, JavaScript), Hausschriften, Iconfont und Logos aus „R+V Design“ |
| `webapp/handbuch.html`, `webapp/handbuch.pdf`, `webapp/handbuch/` | Handbuch als Webseite und PDF, in der App unter „Handbuch“ verlinkt |
| `webapp/api/index.php` | Einziger Einstiegspunkt des Servers (JSON-API) |
| `webapp/lib/` | PHP-Teil: Datenbank, Konten und Sitzungen, Daten und Versionen, E-Mail, Wartung, Einrichtung |
| `webapp/einrichtung/` | Datenbankschema (`schema.sql`) und Startdaten aus Access (`startdaten/`), die bei der Einrichtung übernommen werden |
| `webapp/konfiguration.beispiel.php` | Vorlage für die Konfiguration (Datenbank, Schlüssel, Einrichtungscode) |
| `webapp/.htaccess` | HTTPS-Umleitung, Sicherheits-Header (CSP, HSTS), Zugriffssperren |
| `webapp/daten/` | Galerie-Bilder (`daten/galerie/<persona>/`), per `.htaccess` gesperrt; alternativ Ordner außerhalb des Webs (`galerie_ordner`) |
| `webapp/api/.user.ini` | PHP-Grenzen für Uploads bis 20 MB |
| `tools/test/` | Testumgebung (`test_starten.sh`), API-Test (`api_test.py`), Browser-Test (`ui_test.js`) |
| `tools/handbuch/` | Build der Handbuch-Bilder und des PDFs (`bash tools/handbuch/bauen.sh`) |
| `tools/build_artifact.py` | Baut eine einzelne HTML-Datei als Vorschau (nur lesend) |
| `tools/migration/` | Skripte der einmaligen Übernahme aus Access |

`lib/`, `einrichtung/` und Konfigurationsdateien sind per `.htaccess` gesperrt. Daten und Bilder liegen in der Datenbank und sind nur nach der Anmeldung über `api/index.php` erreichbar.

## Installation bei ALL-INKL

Die ausführliche Anleitung mit Bildern steht im Handbuch, Kapitel „Installation und Betrieb“. Kurzfassung:

1. Im KAS eine **MySQL-Datenbank** anlegen und eine Domain/Subdomain mit **SSL-Zertifikat** (Let's Encrypt) einrichten. PHP-Version 8.1 oder neuer wählen.
2. Den Inhalt von `webapp/` per FTP in das Verzeichnis der Domain laden.
3. `konfiguration.beispiel.php` kopieren, ausfüllen und als **`lernwelt-konfiguration.php` eine Ebene über dem Web-Verzeichnis** ablegen (alternativ als `konfiguration.php` im Web-Verzeichnis; sie ist dann per `.htaccess` gesperrt).
   Schlüssel erzeugen: `php -r "echo bin2hex(random_bytes(32));"`
4. Die Adresse aufrufen. Es erscheint die **Einrichtung**: Einrichtungscode aus der Konfiguration, Name, Org-Einheit und Passwort des ersten Administrators (`erster_admin`) eingeben. Die Tabellen werden angelegt und die Startdaten übernommen.
5. Unter **Einstellungen → E-Mail-Versand** das Postfach eintragen (z. B. `info@ruv-lernwelt.de`, Server aus dem KAS, Port 465, SSL/TLS) und eine Test-E-Mail senden.
6. Im KAS einen **Cronjob** (täglich) auf `https://<adresse>/api/index.php?r=wartung&schluessel=<cron_schluessel>` anlegen. Ohne Cronjob läuft die Wartung beim ersten Aufruf des Tages.

**Bei Updates** nur die Programmdateien ersetzen (`index.html`, `handbuch*`, `assets/`, `api/`, `lib/`, `einrichtung/schema.sql`, `.htaccess`). Die Konfigurationsdatei und der Ordner `daten/` (Galerie) bleiben, alles andere liegt in der Datenbank. Neue Tabellen legt die Anwendung beim ersten Aufruf selbst an (`SCHEMA_VERSION` in `lib/einrichtung.php`).

Uploads bis 20 MB erlaubt `api/.user.ini`. Greift sie nicht, im KAS unter PHP-Einstellungen `upload_max_filesize = 21M` und `post_max_size = 24M` setzen.

## Rollen

| Recht | Administrator | Mediengestalter | Designer | Nutzer |
|---|---|---|---|---|
| Personas, Firmen, Formate ansehen | ja | ja | ja | ja |
| … anlegen, bearbeiten, löschen, Versionen wiederherstellen | ja | ja | – | – |
| Galerie ansehen, Bilder herunterladen (einzeln, ZIP) | ja | ja | ja | ja |
| Galerie: Bilder hochladen, beschreiben, löschen | ja | ja | ja | – |
| Benutzerliste ansehen | ja | ja (nur lesen) | – | – |
| Personen einladen | alle Rollen | nur Rolle Nutzer | – | – |
| Konten bearbeiten, deaktivieren, löschen | ja | – | – | – |
| Protokoll, Einstellungen, Export/Import | ja | – | – | – |

Die Rechte prüft der Server bei jeder Anfrage; die Oberfläche blendet nur aus, was ohnehin abgelehnt würde.

## Sicherheit

- **Passwörter:** Argon2id (Fallback bcrypt), mindestens 10 Zeichen, kein erzwungener Wechsel. Neue Passwörter werden gegen bekannte Datenlecks geprüft (Have I Been Pwned, k-Anonymität: nur die ersten 5 Zeichen des SHA-1-Werts verlassen den Server).
- **Sitzungen:** serverseitig gespeichert, im Cookie nur ein Zufallswert (`__Host-`, `Secure`, `HttpOnly`, `SameSite=Strict`). Ablauf nach 2 Stunden Inaktivität, spätestens nach 12 Stunden. Passwort- oder Rollenwechsel beendet alle anderen Sitzungen.
- **CSRF:** jede Änderung braucht ein Sitzungs-Token im Header und eine passende Herkunft (Origin).
- **Links in E-Mails:** Einmal-Token, in der Datenbank nur als Hash. Einladung 7 Tage, Passwort zurücksetzen 1 Stunde, E-Mail-Bestätigung 24 Stunden.
- **Drosselung:** Anmeldung höchstens 5 Versuche je E-Mail-Adresse und 30 je IP-Adresse in 15 Minuten; „Passwort vergessen“ 3 je Adresse pro Stunde. Meldungen verraten nicht, ob ein Konto existiert.
- **Hinweis-E-Mails** bei geändertem Passwort und geänderter E-Mail-Adresse (an die bisherige Adresse).
- **Header:** HSTS, Content-Security-Policy ohne Inline-Skripte, `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy: no-referrer`.
- **Inaktive Konten** werden nach 12 Monaten ohne Anmeldung deaktiviert (nie der letzte Administrator); Administratoren werden 14 Tage vorher informiert.
- **Protokoll:** Anmeldungen, Kontoänderungen und Datenänderungen. IP-Adressen werden nach 90 Tagen entfernt, Einträge nach 2 Jahren gelöscht.
- **Geheimnisse** (Datenbank-Passwort, Schlüssel) stehen nur in der Konfigurationsdatei, nie im Repository. Das SMTP-Passwort liegt AES-256-GCM-verschlüsselt in der Datenbank.

## Daten

- Jede Änderung legt eine **Version** an; ältere Stände lassen sich vergleichen und wiederherstellen, gelöschte Einträge unter Einstellungen zurückholen.
- Speichern zwei Personen gleichzeitig denselben Eintrag, lehnt der Server die zweite Änderung ab und zeigt den Konflikt an.
- **Galerie** je Persona: Bilder (JPG, PNG, WebP, GIF, bis 20 MB) per Drag & Drop hochladen; Dateinamen werden bereinigt, doppelte Dateien erkannt, Originale unverändert gespeichert, Vorschaubilder im Browser (Ersatz: GD auf dem Server) erzeugt. Großansicht mit Blättern, Download einzeln oder als ZIP, Beschreibung, „Als Profilbild“. Gespeichert unter Zufallsnamen, nur nach Anmeldung abrufbar; Hochladen, Löschen und ZIP-Downloads stehen im Protokoll.
- **Export/Import** (Einstellungen) als JSON-Datei mit eingebetteten Profilbildern; die Galerie-Bilder sichert man über den Galerie-Ordner (FTP/Backup des Hosters).
- Regelmäßige Sicherungen der Datenbank bietet der KAS (Datenbank → Backup) bzw. das Backup des Hosters.

## Entwicklung und Tests

Voraussetzungen: PHP 8.1+ mit `pdo_mysql`, MariaDB/MySQL (root über Socket), Python 3, Node.js mit Playwright.

```bash
# Frische Testumgebung (Kopie von webapp/, leere Datenbank, PHP-Server; Mails landen in <ordner>/mails.jsonl)
bash tools/test/test_starten.sh /tmp/lw 8301 lernwelt_test
# API-Test: erst einrichten, dann prüfen
curl -s -X POST -H 'Content-Type: application/json' -H 'X-Lernwelt: 1' -H 'Origin: http://127.0.0.1:8301' \
  -d '{"code":"code-123-test","vorname":"Michael","nachname":"Herget","orgEinheit":"VH-VP","passwort":"EinSicheresPasswort-2026"}' \
  'http://127.0.0.1:8301/api/index.php?r=einrichten'
python3 tools/test/api_test.py http://127.0.0.1:8301 /tmp/lw/mails.jsonl lernwelt_test
# Browser-Test (richtet selbst ein; eigene Umgebung)
bash tools/test/test_starten.sh /tmp/lw2 8302 lernwelt_ui
NODE_PATH=$(npm root -g) node tools/test/ui_test.js http://127.0.0.1:8302/ /tmp/lw2/mails.jsonl
# Handbuch-Bilder und PDF
bash tools/handbuch/bauen.sh
```

## Datenübernahme aus Access

Die Startdaten in `webapp/einrichtung/startdaten/` wurden aus `Lernwelt_Test.accdb` (Tabelle `Lernwelt`, 61 Zeilen) erzeugt:

- **52 Personas** mit allen Feldern, Werte wie in der Abacus-App vereinheitlicht.
- **9 Firmen** aus den Zeilen mit Vorname „-“, mit 13 Zuordnungen von Personen.
- Familienbeziehungen werden in der App von Hand gepflegt; der Access-Text „Verwandt“ steht unter „Weitere Familienangaben“.
- „Claudio Mariani“ wurde zu **Pietro Mariani** korrigiert.
- **27 Profilbilder** als JPG (aus eingebetteten PDF-Dokumenten).

Die Übernahme läuft einmalig bei der Einrichtung. Die Skripte in `tools/migration/` dienen nur der Nachvollziehbarkeit und schreiben in `webapp/einrichtung/startdaten/`.
