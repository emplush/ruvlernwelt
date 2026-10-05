<?php
// Benutzerkonten: Rollen und Rechte, Sitzungen, Passwörter, Einmal-Links.
declare(strict_types=1);

const ROLLEN = [
    'admin' => 'Administrator',
    'mediengestalter' => 'Mediengestalter',
    'designer' => 'Designer',
    'nutzer' => 'Nutzer',
];

const RECHTE = [
    'admin' => ['daten_bearbeiten', 'galerie_bearbeiten', 'benutzer_sehen', 'benutzer_einladen', 'benutzer_verwalten', 'einstellungen', 'protokoll'],
    'mediengestalter' => ['daten_bearbeiten', 'galerie_bearbeiten', 'benutzer_sehen', 'benutzer_einladen'],
    'designer' => ['galerie_bearbeiten'],
    'nutzer' => [],
];

// Welche Rollen eine Rolle einladen darf
const EINLADBARE_ROLLEN = [
    'admin' => ['admin', 'mediengestalter', 'designer', 'nutzer'],
    'mediengestalter' => ['nutzer'],
];

const SITZUNG_LEERLAUF = 2 * 3600;     // Abmeldung nach 2 Stunden ohne Aktivität
const SITZUNG_HOECHSTENS = 12 * 3600;  // spätestens nach 12 Stunden neu anmelden
const EINLADUNG_GUELTIG = 7 * 86400;
const PASSWORT_LINK_GUELTIG = 3600;
const EMAIL_LINK_GUELTIG = 86400;
const PASSWORT_MIN = 10;
const PASSWORT_MAX = 256;

function recht(array $benutzer, string $recht): bool
{
    return in_array($recht, RECHTE[$benutzer['rolle']] ?? [], true);
}

function rechtePruefen(array $benutzer, string $recht): void
{
    if (!recht($benutzer, $recht)) {
        throw new ApiFehler(403, 'Dafür fehlt Ihnen die Berechtigung.');
    }
}

function rechteListe(array $benutzer): array
{
    return RECHTE[$benutzer['rolle']] ?? [];
}

function emailNormalisieren(?string $email): string
{
    $email = mb_strtolower(trim((string)$email));
    if ($email === '' || strlen($email) > 190 || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new ApiFehler(400, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    }
    return $email;
}

// Org-Einheit: 1 bis 4 Teile aus je 2 Zeichen, getrennt durch "-" (z. B. VH-VP-TV-PR)
function orgEinheitNormalisieren(?string $wert): string
{
    $w = strtoupper(trim((string)$wert));
    if (!preg_match('/^[A-Z0-9]{2}(-[A-Z0-9]{2}){0,3}$/', $w)) {
        throw new ApiFehler(400, 'Die Org-Einheit besteht aus 2 bis 11 Zeichen in Zweiergruppen mit Bindestrich, z. B. VH-VP-TV.');
    }
    return $w;
}

function rolleNormalisieren(?string $rolle): string
{
    if (!isset(ROLLEN[$rolle])) {
        throw new ApiFehler(400, 'Unbekannte Rolle.');
    }
    return $rolle;
}

// ------------------------------------------------------------------
// Passwörter
// ------------------------------------------------------------------
function passwortHash(string $passwort): string
{
    if (defined('PASSWORD_ARGON2ID')) {
        return password_hash($passwort, PASSWORD_ARGON2ID, ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 1]);
    }
    return password_hash($passwort, PASSWORD_BCRYPT, ['cost' => 12]);
}

function passwortRegelnPruefen(string $passwort, string $email): void
{
    $laenge = mb_strlen($passwort);
    if ($laenge < PASSWORT_MIN) {
        throw new ApiFehler(400, 'Das Passwort muss mindestens ' . PASSWORT_MIN . ' Zeichen lang sein.');
    }
    if ($laenge > PASSWORT_MAX) {
        throw new ApiFehler(400, 'Das Passwort darf höchstens ' . PASSWORT_MAX . ' Zeichen lang sein.');
    }
    if (mb_strtolower($passwort) === mb_strtolower($email)) {
        throw new ApiFehler(400, 'Das Passwort darf nicht Ihre E-Mail-Adresse sein.');
    }
    if (passwortGeleakt($passwort)) {
        throw new ApiFehler(400, 'Dieses Passwort ist in bekannten Datenlecks aufgetaucht und daher unsicher. Bitte wählen Sie ein anderes.');
    }
}

// Prüfung gegen "Have I Been Pwned" (k-Anonymität: nur die ersten 5 Zeichen des SHA-1-Hashes verlassen den Server)
function passwortGeleakt(string $passwort): bool
{
    if (!konfiguration()['hibp'] || !function_exists('curl_init')) {
        return false;
    }
    $hash = strtoupper(sha1($passwort));
    $ch = curl_init((string)(konfiguration()['hibp_url'] ?? 'https://api.pwnedpasswords.com/range/') . substr($hash, 0, 5));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 4,
        CURLOPT_CONNECTTIMEOUT => 3,
        CURLOPT_HTTPHEADER => ['Add-Padding: true', 'User-Agent: RuV-Lernwelt-Persona-Datenbank'],
    ]);
    $antwort = curl_exec($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (!is_string($antwort) || $status !== 200) {
        return false; // Dienst nicht erreichbar: Passwort nicht blockieren
    }
    $rest = substr($hash, 5);
    foreach (explode("\n", $antwort) as $zeile) {
        $teile = explode(':', trim($zeile));
        if (count($teile) === 2 && $teile[0] === $rest && (int)$teile[1] > 0) {
            return true;
        }
    }
    return false;
}

// ------------------------------------------------------------------
// Sitzungen
// ------------------------------------------------------------------
function cookieName(): string
{
    return konfiguration()['https'] ? '__Host-lernwelt' : 'lernwelt';
}

function cookieSetzen(string $wert, bool $loeschen = false): void
{
    setcookie(cookieName(), $wert, [
        'expires' => $loeschen ? time() - 3600 : 0,
        'path' => '/',
        'secure' => (bool)konfiguration()['https'],
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
}

function sitzungStarten(array $benutzer): array
{
    $geheimnis = zufallsToken();
    $csrf = bin2hex(random_bytes(32));
    abfrage(
        'INSERT INTO sitzungen (id, benutzer_id, csrf, erstellt_am, zuletzt_aktiv, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [hash('sha256', $geheimnis), $benutzer['id'], $csrf, jetzt(), jetzt(), ip(), substr((string)($_SERVER['HTTP_USER_AGENT'] ?? ''), 0, 255)]
    );
    cookieSetzen($geheimnis);
    $GLOBALS['__benutzer'] = $benutzer + ['sitzung_id' => hash('sha256', $geheimnis), 'csrf' => $csrf];
    return $GLOBALS['__benutzer'];
}

function sitzungBeenden(): void
{
    $b = aktuellerBenutzerOderNull();
    if ($b) {
        abfrage('DELETE FROM sitzungen WHERE id = ?', [$b['sitzung_id']]);
    }
    cookieSetzen('', true);
    $GLOBALS['__benutzer'] = null;
}

// Beendet alle Sitzungen eines Kontos, optional außer der aktuellen
function sitzungenBeenden(int $benutzerId, ?string $ausser = null): void
{
    if ($ausser) {
        abfrage('DELETE FROM sitzungen WHERE benutzer_id = ? AND id <> ?', [$benutzerId, $ausser]);
    } else {
        abfrage('DELETE FROM sitzungen WHERE benutzer_id = ?', [$benutzerId]);
    }
}

function aktuellerBenutzerOderNull(): ?array
{
    if (array_key_exists('__benutzer', $GLOBALS)) {
        return $GLOBALS['__benutzer'];
    }
    $GLOBALS['__benutzer'] = null;
    $geheimnis = $_COOKIE[cookieName()] ?? '';
    if (!is_string($geheimnis) || $geheimnis === '' || strlen($geheimnis) > 100) {
        return null;
    }
    $id = hash('sha256', $geheimnis);
    $s = zeile(
        'SELECT s.id AS sitzung_id, s.csrf, s.erstellt_am AS s_erstellt, s.zuletzt_aktiv, b.* FROM sitzungen s JOIN benutzer b ON b.id = s.benutzer_id WHERE s.id = ?',
        [$id]
    );
    if (!$s) {
        return null;
    }
    $jetzt = time();
    $leerlauf = $jetzt - strtotime($s['zuletzt_aktiv'] . ' UTC');
    $alter = $jetzt - strtotime($s['s_erstellt'] . ' UTC');
    if ($s['status'] !== 'aktiv' || $leerlauf > SITZUNG_LEERLAUF || $alter > SITZUNG_HOECHSTENS) {
        abfrage('DELETE FROM sitzungen WHERE id = ?', [$id]);
        return null;
    }
    if ($leerlauf > 60) {
        abfrage('UPDATE sitzungen SET zuletzt_aktiv = ? WHERE id = ?', [jetzt(), $id]);
    }
    unset($s['passwort_hash']);
    $GLOBALS['__benutzer'] = $s;
    return $s;
}

function angemeldet(): array
{
    $b = aktuellerBenutzerOderNull();
    if (!$b) {
        throw new ApiFehler(401, 'Bitte melden Sie sich an.', ['anmelden' => true]);
    }
    return $b;
}

function benutzerOeffentlich(array $b): array
{
    return [
        'id' => (int)$b['id'],
        'email' => $b['email'],
        'vorname' => $b['vorname'],
        'nachname' => $b['nachname'],
        'orgEinheit' => $b['org_einheit'],
        'rolle' => $b['rolle'],
        'rolleName' => ROLLEN[$b['rolle']] ?? $b['rolle'],
        'status' => $b['status'],
        'letzteAnmeldung' => iso($b['letzte_anmeldung'] ?? null),
        'erstelltAm' => iso($b['erstellt_am'] ?? null),
        'aktiviertAm' => iso($b['aktiviert_am'] ?? null),
    ];
}

// ------------------------------------------------------------------
// Einmal-Links
// ------------------------------------------------------------------
function tokenErstellen(int $benutzerId, string $zweck, int $gueltigSekunden, ?string $neueEmail = null): string
{
    // Ältere, noch offene Links desselben Zwecks werden ungültig
    abfrage('UPDATE tokens SET verwendet_am = ? WHERE benutzer_id = ? AND zweck = ? AND verwendet_am IS NULL', [jetzt(), $benutzerId, $zweck]);
    $token = zufallsToken();
    abfrage(
        'INSERT INTO tokens (token_hash, benutzer_id, zweck, neue_email, erstellt_am, ablauf) VALUES (?, ?, ?, ?, ?, ?)',
        [hash('sha256', $token), $benutzerId, $zweck, $neueEmail, jetzt(), jetzt($gueltigSekunden)]
    );
    return $token;
}

function tokenLesen(?string $token, string $zweck): array
{
    if (!is_string($token) || !preg_match('/^[A-Za-z0-9_-]{20,100}$/', $token)) {
        throw new ApiFehler(400, 'Der Link ist ungültig oder abgelaufen.');
    }
    $t = zeile(
        'SELECT t.id AS token_id, t.neue_email, t.ablauf, t.verwendet_am, b.* FROM tokens t JOIN benutzer b ON b.id = t.benutzer_id WHERE t.token_hash = ? AND t.zweck = ?',
        [hash('sha256', $token), $zweck]
    );
    if (!$t || $t['verwendet_am'] !== null || strtotime($t['ablauf'] . ' UTC') < time()) {
        throw new ApiFehler(400, 'Der Link ist ungültig oder abgelaufen.');
    }
    return $t;
}

function tokenVerbrauchen(int $tokenId): void
{
    abfrage('UPDATE tokens SET verwendet_am = ? WHERE id = ?', [jetzt(), $tokenId]);
}

function appLink(string $pfad): string
{
    $basis = rtrim((string)konfiguration()['basis_url'], '/');
    if ($basis === '') {
        $schema = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
        $verzeichnis = rtrim(str_replace('\\', '/', dirname(dirname((string)($_SERVER['SCRIPT_NAME'] ?? '/api/index.php')))), '/');
        $basis = $schema . '://' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $verzeichnis;
    }
    return $basis . '/#/' . $pfad;
}
