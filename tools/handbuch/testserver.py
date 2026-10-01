# Testserver für Entwicklung und Handbuch-Bilder: liefert webapp/ aus und bildet
# api/daten.ashx mit demselben Protokoll nach (Anmeldung, Laden, Speichern, Bilder).
# Aufruf: python3 testserver.py <webapp-kopie> <port>   (Standardpasswort RuVTest1234)
# Achtung: schreibt in die übergebene Kopie, nie auf das Original anwenden.
import json, os, sys, hmac, hashlib, secrets, time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
ROOT, PORT = sys.argv[1], int(sys.argv[2])
AD = os.path.join(ROOT, 'App_Data')
ITER = 60000
def H(k, m): return hmac.new(k, m.encode(), hashlib.sha256).digest()
cfg_pfad = os.path.join(AD, 'anmeldung.json')
if not os.path.exists(cfg_pfad):
    salt = secrets.token_hex(16)
    json.dump({'aktiv': True, 'salt': salt, 'iterationen': ITER, 'schluessel': hashlib.pbkdf2_hmac('sha256', b'RuVTest1234', bytes.fromhex(salt), ITER).hex(), 'geheimnis': secrets.token_hex(32)}, open(cfg_pfad, 'w'))
nonces = {}; fehl = {}
def cfg(): return json.load(open(cfg_pfad))
def sitzung(c): i = f"{int(time.time())+36000}.{secrets.token_hex(16)}"; return i + '.' + H(bytes.fromhex(c['geheimnis']), i).hex()
def gueltig(c, w):
    if not w or '.' not in w: return False
    i, s = w.rsplit('.', 1)
    return hmac.compare_digest(H(bytes.fromhex(c['geheimnis']), i).hex(), s) and int(i.split('.')[0]) > time.time()
def beweis_ok(c, zweck, n, zusatz, b):
    if nonces.pop(n, 0) < time.time(): return False
    return hmac.compare_digest(H(bytes.fromhex(c['schluessel']), f"{zweck}:{n}:{zusatz}").hex(), b or '')
class Hd(SimpleHTTPRequestHandler):
    def __init__(s, *a, **k): super().__init__(*a, directory=ROOT, **k)
    def log_message(s, *a): pass
    def send(s, code, obj=None, cookie=None, raw=None, ctype='application/json'):
        b = raw if raw is not None else json.dumps(obj, ensure_ascii=False).encode()
        s.send_response(code); s.send_header('Content-Type', ctype); s.send_header('Content-Length', str(len(b)))
        if cookie is not None: s.send_header('Set-Cookie', f"lernwelt_sitzung={cookie}; Path=/; HttpOnly; SameSite=Strict")
        s.end_headers(); s.wfile.write(b)
    def cookie(s):
        for teil in (s.headers.get('Cookie') or '').split(';'):
            k, _, v = teil.strip().partition('=')
            if k == 'lernwelt_sitzung': return v
    def do_GET(s):
        u = urlparse(s.path)
        if u.path.startswith('/App_Data'): return s.send(404, {'ok': False})
        if u.path == '/api/daten.ashx': return s.api(u, None)
        super().do_GET()
    def do_POST(s):
        u = urlparse(s.path)
        if s.headers.get('X-Lernwelt') != '1': return s.send(403, {'ok': False})
        s.api(u, json.loads(s.rfile.read(int(s.headers['Content-Length'])) or b'{}'))
    def api(s, u, body):
        q = parse_qs(u.query); a = q.get('aktion', [''])[0]; c = cfg(); ip = s.client_address[0]
        ang = not c['aktiv'] or gueltig(c, s.cookie())
        if body is not None and a in ('anmelden', 'passwort', 'abfrage') and fehl.get(ip, 0) >= 5: return s.send(429, {'ok': False, 'meldung': 'Zu viele Fehlversuche. Bitte in 15 Minuten erneut versuchen.'})
        daten_pfad = os.path.join(AD, 'lernwelt.json')
        if a == 'status': return s.send(200, {'ok': True, 'anmeldungAktiv': c['aktiv'], 'angemeldet': ang, 'appTitel': json.load(open(daten_pfad))['einstellungen']['appTitel'], 'schreibfehler': None})
        if a == 'challenge':
            n = secrets.token_hex(16); nonces[n] = time.time() + 300
            return s.send(200, {'ok': True, 'salt': c['salt'], 'iterationen': c['iterationen'], 'nonce': n, 'neuSalt': secrets.token_hex(16), 'neuIterationen': ITER})
        if a == 'anmelden':
            if not beweis_ok(c, 'anmelden', body.get('nonce'), '', body.get('beweis')):
                fehl[ip] = fehl.get(ip, 0) + 1; return s.send(401, {'ok': False, 'meldung': 'Das Passwort ist falsch.'})
            fehl.pop(ip, None); return s.send(200, {'ok': True}, cookie=sitzung(c))
        if a == 'abmelden': return s.send(200, {'ok': True}, cookie='')
        if a == 'passwort':
            n = body.get('nonce')
            if not beweis_ok(c, 'passwort', n, body.get('neuSalt'), body.get('beweis')):
                fehl[ip] = fehl.get(ip, 0) + 1; return s.send(401, {'ok': False, 'meldung': 'Das aktuelle Passwort ist falsch.'})
            m = H(bytes.fromhex(c['schluessel']), 'schluessel:' + n)
            c.update(salt=body['neuSalt'], iterationen=ITER, schluessel=bytes(x ^ y for x, y in zip(bytes.fromhex(body['neu']), m)).hex(), geheimnis=secrets.token_hex(32))
            json.dump(c, open(cfg_pfad, 'w')); return s.send(200, {'ok': True}, cookie=sitzung(c))
        if a == 'abfrage':
            akt = body.get('aktiv') is True
            if not beweis_ok(c, 'abfrage', body.get('nonce'), '1' if akt else '0', body.get('beweis')):
                fehl[ip] = fehl.get(ip, 0) + 1; return s.send(401, {'ok': False, 'meldung': 'Das Passwort ist falsch.'})
            c['aktiv'] = akt; json.dump(c, open(cfg_pfad, 'w'))
            return s.send(200, {'ok': True, 'anmeldungAktiv': akt}, cookie=sitzung(c) if akt else None)
        if not ang: return s.send(401, {'ok': False, 'anmelden': True, 'meldung': 'Bitte melden Sie sich an.'})
        if a == 'laden': return s.send(200, raw=open(daten_pfad, 'rb').read())
        if a == 'bild':
            p = os.path.join(AD, 'bilder', os.path.basename(q.get('name', [''])[0]))
            return s.send(200, raw=open(p, 'rb').read(), ctype='image/jpeg') if os.path.exists(p) else s.send(404, {'ok': False})
        if a == 'speichern':
            d = json.load(open(daten_pfad))
            if body['erwarteteRevision'] != d['revision']: return s.send(409, {'ok': False})
            neu = body['daten']; neu['revision'] = d['revision'] + 1
            json.dump(neu, open(daten_pfad, 'w'), ensure_ascii=False)
            return s.send(200, {'ok': True, 'revision': neu['revision'], 'daten': neu})
        s.send(404, {'ok': False})
ThreadingHTTPServer(('127.0.0.1', PORT), Hd).serve_forever()
