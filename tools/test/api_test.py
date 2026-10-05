#!/usr/bin/env python3
"""API-Test der Persona-Datenbank gegen einen frisch eingerichteten Testserver.

Aufruf: python3 api_test.py <basis-url> <mail-protokoll.jsonl> <mysql-datenbank>
Voraussetzung: Die Anwendung ist mit Einrichtungscode "code-123-test" eingerichtet,
Admin michael.herget@ruv.de / Passwort "EinSicheresPasswort-2026", Mails gehen in die Datei
(SMTP-Host "datei"). Der mysql-Client wird für das Zurückdatieren von Anmeldungen genutzt.
Startet bei jedem Lauf mit leerer Datenbank (tools/test/test_starten.sh).
"""
import http.cookiejar
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

BASIS, MAILS, DB = sys.argv[1].rstrip('/'), sys.argv[2], sys.argv[3]
ADMIN, ADMIN_PW = 'michael.herget@ruv.de', 'EinSicheresPasswort-2026'
fehler = []


def pruefe(bedingung, text):
    print(('OK     ' if bedingung else 'FEHLER ') + text)
    if not bedingung:
        fehler.append(text)


class Sitzung:
    def __init__(self):
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))
        self.csrf = ''

    def anfrage(self, route, daten=None, header=None, roh=False):
        url = BASIS + '/api/index.php?r=' + route
        h = {'X-Lernwelt': '1', 'Content-Type': 'application/json', 'X-CSRF-Token': self.csrf}
        h.update(header or {})
        req = urllib.request.Request(url, data=None if daten is None else json.dumps(daten).encode(), headers=h, method='GET' if daten is None else 'POST')
        try:
            with self.opener.open(req) as r:
                inhalt = r.read()
                return r.status, (inhalt if roh else json.loads(inhalt))
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read() or b'{}')

    def anmelden(self, email, pw):
        s, d = self.anfrage('anmelden', {'email': email, 'passwort': pw})
        if s == 200:
            self.csrf = d['ich']['csrf']
        return s, d


def mails():
    try:
        return [json.loads(z) for z in open(MAILS, encoding='utf-8') if z.strip()]
    except FileNotFoundError:
        return []


def letzter_link(an, art):
    for m in reversed(mails()):
        if m['an'] == an:
            t = re.search(r'#/' + art + r'/([A-Za-z0-9_-]+)', m['text'])
            if t:
                return t.group(1)
    return None


def sql(befehl):
    subprocess.run(['mysql', '-uroot', DB, '-e', befehl], check=True)


# --- Admin
admin = Sitzung()
s, d = admin.anmelden(ADMIN, 'falsch-falsch-falsch')
pruefe(s == 401 and 'falsch' in d['meldung'], 'Falsches Passwort wird abgelehnt (allgemeine Meldung)')
s, d = admin.anmelden('niemand@example.org', 'irgendwas-langes')
pruefe(s == 401 and d['meldung'] == 'E-Mail-Adresse oder Passwort ist falsch.', 'Unbekannte E-Mail: gleiche Meldung')
s, d = admin.anmelden(ADMIN, ADMIN_PW)
pruefe(s == 200 and d['ich']['rolle'] == 'admin', 'Admin meldet sich an')

s, d = admin.anfrage('einstellungen-speichern', {'smtp': {'host': 'datei', 'port': 465, 'verschluesselung': 'ssl', 'benutzer': 'info@ruv-lernwelt.de', 'passwort': 'smtp-geheim', 'absender': 'info@ruv-lernwelt.de', 'absenderName': 'R+V Lernwelt'}})
pruefe(s == 200 and d['smtp']['passwortGesetzt'] and 'passwort' not in d['smtp'], 'SMTP-Einstellungen gespeichert, Passwort nicht zurückgegeben')
gespeichert = subprocess.run(['mysql', '-uroot', DB, '-N', '-e', "SELECT wert FROM einstellungen WHERE schluessel='smtp_passwort'"], capture_output=True, text=True).stdout
pruefe('smtp-geheim' not in gespeichert and len(gespeichert.strip()) > 20, 'SMTP-Passwort verschlüsselt in der Datenbank')

# CSRF
s, d = admin.anfrage('konto', {'vorname': 'X', 'nachname': 'Y'}, {'X-CSRF-Token': 'falsch'})
pruefe(s == 403, 'Ohne gültiges CSRF-Token keine Änderung')
s, d = admin.anfrage('konto', {'vorname': 'X', 'nachname': 'Y'}, {'X-Lernwelt': ''})
pruefe(s == 403, 'Ohne X-Lernwelt-Header keine Änderung')
s, d = admin.anfrage('konto', {'vorname': 'X', 'nachname': 'Y'}, {'Origin': 'https://boese.example'})
pruefe(s == 403, 'Fremde Herkunft (Origin) wird abgelehnt')

# --- Einladungen
s, d = admin.anfrage('einladen', {'email': 'MG@Example.org', 'rolle': 'mediengestalter', 'vorname': 'Mia', 'nachname': 'Gestalter', 'orgEinheit': 'vh-vp-tv'})
pruefe(s == 200 and d['mailGesendet'], 'Admin lädt Mediengestalterin ein, Mail versendet')
s, d = admin.anfrage('einladen', {'email': 'mg@example.org', 'rolle': 'nutzer', 'vorname': 'A', 'nachname': 'B', 'orgEinheit': 'VH'})
pruefe(s == 400 and 'bereits eingeladen' in d['meldung'], 'Doppelte Einladung wird abgelehnt')
for falsch in ['V', 'VHV', 'VH-', 'VH-VP-TV-PR-XX', 'VH_VP']:
    s, d = admin.anfrage('einladen', {'email': 'x%s@example.org' % len(falsch), 'rolle': 'nutzer', 'vorname': 'A', 'nachname': 'B', 'orgEinheit': falsch})
    pruefe(s == 400 and 'Org-Einheit' in d['meldung'], 'Ungültige Org-Einheit "%s" abgelehnt' % falsch)

token = letzter_link('mg@example.org', 'einladung')
pruefe(token is not None, 'Einladungsmail enthält Link')
gast = Sitzung()
s, d = gast.anfrage('token-info', {'token': token, 'zweck': 'einladung'})
pruefe(s == 200 and d['email'] == 'mg@example.org' and d['rolleName'] == 'Mediengestalter', 'Einladung zeigt E-Mail und Rolle')
s, d = gast.anfrage('einladung-annehmen', {'token': token, 'vorname': 'Mia', 'nachname': 'Gestalter', 'passwort': 'kurz'})
pruefe(s == 400 and 'mindestens' in d['meldung'], 'Zu kurzes Passwort abgelehnt')
s, d = gast.anfrage('einladung-annehmen', {'token': token, 'vorname': 'Mia', 'nachname': 'Gestalter', 'passwort': 'mg@example.org'})
pruefe(s == 400, 'Passwort = E-Mail abgelehnt')
s, d = gast.anfrage('einladung-annehmen', {'token': token, 'vorname': 'Mia', 'nachname': 'Gestalter', 'passwort': 'Mediengestalterin-2026'})
pruefe(s == 200 and d['ich']['rolle'] == 'mediengestalter' and d['ich']['orgEinheit'] == 'VH-VP-TV', 'Einladung angenommen, direkt angemeldet')
gast.csrf = d['ich']['csrf']
s, d = Sitzung().anfrage('einladung-annehmen', {'token': token, 'vorname': 'X', 'nachname': 'Y', 'passwort': 'Noch-ein-Passwort-1'})
pruefe(s == 400, 'Einladungslink nur einmal verwendbar')
mg = gast

# Mediengestalter: Rechte
s, d = mg.anfrage('einstellungen')
pruefe(s == 403, 'Mediengestalter: keine Einstellungen')
s, d = mg.anfrage('protokoll')
pruefe(s == 403, 'Mediengestalter: kein Protokoll')
s, d = mg.anfrage('benutzer')
pruefe(s == 200 and len(d['benutzer']) == 2, 'Mediengestalter sieht die Benutzerliste')
s, d = mg.anfrage('einladen', {'email': 'designer@example.org', 'rolle': 'designer', 'vorname': 'De', 'nachname': 'Signer', 'orgEinheit': 'VH'})
pruefe(s == 403, 'Mediengestalter darf keine Designer einladen')
s, d = mg.anfrage('einladen', {'email': 'nutzer@example.org', 'rolle': 'nutzer', 'vorname': 'Nora', 'nachname': 'Nutzer', 'orgEinheit': 'VH-VP'})
pruefe(s == 200, 'Mediengestalter lädt Nutzerin ein')
nutzer_id = [b for b in d['benutzer'] if b['email'] == 'nutzer@example.org'][0]['id']
s, d = mg.anfrage('benutzer-speichern', {'id': nutzer_id, 'email': 'nutzer@example.org', 'rolle': 'admin', 'vorname': 'N', 'nachname': 'N', 'orgEinheit': 'VH'})
pruefe(s == 403, 'Mediengestalter darf Konten nicht bearbeiten')
s, d = mg.anfrage('benutzer-loeschen', {'id': nutzer_id})
pruefe(s == 403, 'Mediengestalter darf Konten nicht löschen')
s, d = mg.anfrage('einladung-erneut', {'id': nutzer_id})
pruefe(s == 200, 'Mediengestalter sendet Einladung an Nutzerin erneut')
alter_token = token
token = letzter_link('nutzer@example.org', 'einladung')

# Daten bearbeiten als Mediengestalter
s, d = mg.anfrage('daten')
p = [x for x in d['personas'] if x['vorname'] == 'Ottmar'][0]
s, d = mg.anfrage('speichern', {'typ': 'persona', 'id': p['id'], 'version': p['version'], 'daten': dict(p, beruf='Braumeister i. R.'), 'firmen': [], 'beziehungen': [{'andere': p['id'] + 1, 'verhaeltnis': 'Ehefrau', 'gegen': 'Ehemann'}]})
pruefe(s == 200, 'Mediengestalter ändert Persona')
p2 = [x for x in d['daten']['personas'] if x['id'] == p['id']][0]
pruefe(p2['beruf'] == 'Braumeister i. R.' and p2['geaendertVon'] == 'Mia Gestalter' and p2['version'] == p['version'] + 1, '„Zuletzt geändert von“ und Version stimmen')
s, d = admin.anfrage('speichern', {'typ': 'persona', 'id': p['id'], 'version': p['version'], 'daten': dict(p, beruf='Konflikt')})
pruefe(s == 409 and d.get('konflikt'), 'Veraltete Version führt zu Konflikt')

# --- Nutzerin: nur lesen
nutzer = Sitzung()
s, d = nutzer.anfrage('einladung-annehmen', {'token': token, 'vorname': 'Nora', 'nachname': 'Nutzer', 'passwort': 'Nutzerin-Passwort-26'})
pruefe(s == 200 and d['ich']['rechte'] == [], 'Nutzerin aktiviert Konto (keine Rechte)')
nutzer.csrf = d['ich']['csrf']
s, _ = Sitzung().anfrage('token-info', {'token': alter_token, 'zweck': 'einladung'})
pruefe(s == 400, 'Alter Einladungslink ist nach erneutem Senden ungültig')
s, d = nutzer.anfrage('daten')
pruefe(s == 200 and len(d['personas']) == 52, 'Nutzerin sieht Personas')
s, d = nutzer.anfrage('speichern', {'typ': 'firma', 'daten': {'name': 'Test'}})
pruefe(s == 403, 'Nutzerin darf nichts anlegen')
s, d = nutzer.anfrage('loeschen', {'typ': 'persona', 'id': 1})
pruefe(s == 403, 'Nutzerin darf nichts löschen')
s, d = nutzer.anfrage('benutzer')
pruefe(s == 403, 'Nutzerin sieht keine Benutzerverwaltung')

# --- Versionen und Wiederherstellen
s, d = admin.anfrage('versionen&typ=persona&id=%d' % p['id'])
pruefe(s == 200 and d['versionen'][0]['aktion'] == 'geaendert' and d['versionen'][1]['aktion'] == 'importiert', 'Versionsliste der Persona')
s, d = admin.anfrage('wiederherstellen', {'versionId': d['versionen'][1]['id']})
p3 = [x for x in d['daten']['personas'] if x['id'] == p['id']][0]
pruefe(s == 200 and p3['beruf'] == p['beruf'], 'Alter Stand wiederhergestellt')
s, d = admin.anfrage('loeschen', {'typ': 'firma', 'id': 1})
pruefe(s == 200 and not any(f['id'] == 1 for f in d['daten']['firmen']), 'Firma gelöscht')
s, d = admin.anfrage('geloescht')
pruefe(s == 200 and d['eintraege'][0]['typ'] == 'firma', 'Gelöschte Firma erscheint in „Gelöschte Einträge“')
s, d = admin.anfrage('wiederherstellen', {'versionId': d['eintraege'][0]['versionId']})
pruefe(s == 200 and any(f['id'] == 1 for f in d['daten']['firmen']) and any(fp['firmaId'] == 1 for fp in d['daten']['firmaPersonas']), 'Gelöschte Firma samt Zuordnungen wiederhergestellt')

# --- Passwort vergessen
vorher = len(mails())
s, d = Sitzung().anfrage('passwort-vergessen', {'email': 'unbekannt@example.org'})
pruefe(s == 200 and len(mails()) == vorher, 'Passwort vergessen: unbekannte Adresse, gleiche Antwort, keine Mail')
s, d = Sitzung().anfrage('passwort-vergessen', {'email': 'nutzer@example.org'})
link = letzter_link('nutzer@example.org', 'passwort-neu')
pruefe(s == 200 and link, 'Passwort vergessen: Mail mit Link')
s, d = Sitzung().anfrage('passwort-zuruecksetzen', {'token': link, 'passwort': 'Neues-Nutzer-Passwort-1'})
pruefe(s == 200, 'Neues Passwort gesetzt')
s, d = nutzer.anfrage('daten')
pruefe(s == 401, 'Alte Sitzung nach Zurücksetzen beendet')
pruefe(any(m['an'] == 'nutzer@example.org' and 'Passwort wurde geändert' in m['betreff'] for m in mails()), 'Hinweis-Mail „Passwort geändert“')
s, d = Sitzung().anfrage('passwort-zuruecksetzen', {'token': link, 'passwort': 'Noch-ein-Passwort-2'})
pruefe(s == 400, 'Link zum Zurücksetzen nur einmal gültig')

# --- Eigenes Konto
s, d = nutzer.anmelden('nutzer@example.org', 'Neues-Nutzer-Passwort-1')
s, d = nutzer.anfrage('email-aendern', {'passwort': 'falsch', 'email': 'neu@example.org'})
pruefe(s == 400, 'E-Mail-Änderung braucht das richtige Passwort')
s, d = nutzer.anfrage('email-aendern', {'passwort': 'Neues-Nutzer-Passwort-1', 'email': 'nora.neu@example.org'})
t = letzter_link('nora.neu@example.org', 'email-bestaetigen')
s2, d2 = Sitzung().anfrage('email-bestaetigen', {'token': t})
pruefe(s == 200 and s2 == 200 and d2['email'] == 'nora.neu@example.org', 'Neue E-Mail-Adresse bestätigt')
pruefe(any(m['an'] == 'nutzer@example.org' and 'E-Mail-Adresse wurde geändert' in m['betreff'] for m in mails()), 'Hinweis an die alte Adresse')
s, d = nutzer.anfrage('passwort-aendern', {'alt': 'Neues-Nutzer-Passwort-1', 'neu': 'Drittes-Passwort-2026'})
pruefe(s == 200, 'Eigenes Passwort geändert')

# --- Benutzerverwaltung durch Admin
s, d = admin.anfrage('benutzer-speichern', {'id': 1, 'email': ADMIN, 'rolle': 'nutzer', 'vorname': 'Michael', 'nachname': 'Herget', 'orgEinheit': 'VH-VP'})
pruefe(s == 400 and 'letzte aktive Administrator' in d['meldung'], 'Letzter Admin kann nicht herabgestuft werden')
s, d = admin.anfrage('benutzer-loeschen', {'id': 1})
pruefe(s == 400, 'Eigenes Konto kann nicht gelöscht werden')
nora = [b for b in admin.anfrage('benutzer')[1]['benutzer'] if b['email'] == 'nora.neu@example.org'][0]
s, d = admin.anfrage('benutzer-speichern', {'id': nora['id'], 'email': nora['email'], 'rolle': 'designer', 'vorname': 'Nora', 'nachname': 'Nutzer', 'orgEinheit': 'VH-VP-TV-PR'})
pruefe(s == 200, 'Admin ändert Rolle und Org-Einheit')
s, d = nutzer.anfrage('daten')
pruefe(s == 401, 'Rollenänderung beendet die Sitzung der Person')
s, d = admin.anfrage('benutzer-status', {'id': nora['id'], 'aktiv': False})
s2, d2 = Sitzung().anmelden('nora.neu@example.org', 'Drittes-Passwort-2026')
pruefe(s == 200 and s2 == 403 and 'deaktiviert' in d2['meldung'], 'Deaktiviertes Konto kann sich nicht anmelden')
s, d = admin.anfrage('benutzer-status', {'id': nora['id'], 'aktiv': True})
s2, d2 = Sitzung().anmelden('nora.neu@example.org', 'Drittes-Passwort-2026')
pruefe(s == 200 and s2 == 200 and d2['ich']['rolle'] == 'designer', 'Wieder aktiviert, Anmeldung als Designer')

# --- Drosselung
for i in range(5):
    Sitzung().anmelden('nora.neu@example.org', 'falsch-%d-xxxxxxxx' % i)
s, d = Sitzung().anmelden('nora.neu@example.org', 'Drittes-Passwort-2026')
pruefe(s == 429, 'Nach 5 Fehlversuchen für ein Konto gesperrt (auch mit richtigem Passwort)')
s, d = Sitzung().anmelden('gibtsnicht@example.org', 'x')
for i in range(5):
    Sitzung().anmelden('gibtsnicht@example.org', 'x%d' % i)
s, d = Sitzung().anmelden('gibtsnicht@example.org', 'x')
pruefe(s == 429, 'Sperre auch bei unbekannter Adresse (verrät nichts)')

# --- Inaktivität
sql("UPDATE benutzer SET letzte_anmeldung = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 13 MONTH), aktiviert_am = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 14 MONTH) WHERE email = 'mg@example.org'")
sql("UPDATE benutzer SET letzte_anmeldung = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 355 DAY), aktiviert_am = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 400 DAY) WHERE email = 'nora.neu@example.org'")
s, d = Sitzung().anfrage('wartung&schluessel=falsch')
pruefe(s == 403, 'Wartung nur mit Cron-Schlüssel')
s, d = Sitzung().anfrage('wartung&schluessel=cron-test')
pruefe(s == 200 and d['deaktiviert'] == 1 and d['gewarnt'] == 1, 'Wartung: 1 Konto deaktiviert, 1 Warnung')
pruefe(any(m['an'] == ADMIN and 'bald automatisch deaktiviert' in m['betreff'] and 'nora.neu@example.org' in m['text'] for m in mails()), 'Admin erhält Warnung zu bald inaktiven Konten')

# --- Protokoll, Export, Import
s, d = admin.anfrage('protokoll&bereich=konten')
pruefe(s == 200 and d['gesamt'] > 10 and any('automatisch deaktiviert' in e['beschreibung'] for e in d['eintraege']), 'Protokoll enthält Kontoereignisse')
s, export = admin.anfrage('export')
pruefe(s == 200 and export['personas'][2]['bild'] and export['personas'][2]['bild'].startswith('data:image/jpeg'), 'Export enthält Bilder als Daten')
s, d = admin.anfrage('import', export)
pruefe(s == 200 and d['anzahl']['personas'] == 52, 'Import des Exports')

# --- Mail-Test (Datei)
s, d = admin.anfrage('mail-test', {'an': ADMIN})
pruefe(s == 200, 'Test-Mail versendet')

# --- Abmelden
s, d = admin.anfrage('abmelden', {})
s, d = admin.anfrage('daten')
pruefe(s == 401, 'Nach Abmelden kein Zugriff')

print('\n%d Fehler' % len(fehler))
sys.exit(1 if fehler else 0)
