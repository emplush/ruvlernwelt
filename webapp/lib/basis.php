<?php
// Grundfunktionen: Konfiguration, Datenbank, Antworten, Protokoll, Einstellungen, Verschlüsselung.
declare(strict_types=1);

final class ApiFehler extends Exception
{
    public int $status;
    public array $extra;

    public function __construct(int $status, string $meldung, array $extra = [])
    {
        parent::__construct($meldung);
        $this->status = $status;
        $this->extra = $extra;
    }
}

function konfiguration(): array
{
    static $konfig = null;
    if ($konfig !== null) {
        return $konfig;
    }
    // Bevorzugt außerhalb des Web-Verzeichnisses, sonst im Anwendungsordner (per .htaccess gesperrt)
    $kandidaten = [
        dirname(__DIR__, 2) . '/lernwelt-konfiguration.php',
        dirname(__DIR__) . '/konfiguration.php',
    ];
    foreach ($kandidaten as $datei) {
        if (is_file($datei)) {
            $konfig = require $datei;
            break;
        }
    }
    if (!is_array($konfig)) {
        throw new ApiFehler(500, 'Die Konfigurationsdatei fehlt. Bitte konfiguration.php nach der Anleitung anlegen.');
    }
    $konfig += [
        'https' => true,
        'hibp' => true,
        'basis_url' => '',
        'erster_admin' => '',
        'mail_protokoll' => '',
    ];
    if (!preg_match('/^[0-9a-f]{64}$/', (string)($konfig['schluessel'] ?? ''))) {
        throw new ApiFehler(500, 'In der Konfiguration fehlt ein gültiger "schluessel" (64 Hex-Zeichen).');
    }
    return $konfig;
}

function db(): PDO
{
    static $pdo = null;
    if ($pdo !== null) {
        return $pdo;
    }
    $k = konfiguration()['db'];
    $dsn = 'mysql:host=' . $k['host'] . ';port=' . (int)($k['port'] ?? 3306) . ';dbname=' . $k['name'] . ';charset=utf8mb4';
    try {
        $pdo = new PDO($dsn, $k['benutzer'], $k['passwort'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
    } catch (PDOException $e) {
        throw new ApiFehler(500, 'Die Datenbank ist nicht erreichbar. Bitte die Zugangsdaten in der Konfiguration prüfen.');
    }
    $pdo->exec("SET time_zone = '+00:00'");
    return $pdo;
}

function abfrage(string $sql, array $werte = []): PDOStatement
{
    $st = db()->prepare($sql);
    $st->execute($werte);
    return $st;
}

function zeile(string $sql, array $werte = []): ?array
{
    $z = abfrage($sql, $werte)->fetch();
    return $z === false ? null : $z;
}

function wert(string $sql, array $werte = [])
{
    $w = abfrage($sql, $werte)->fetchColumn();
    return $w === false ? null : $w;
}

function transaktion(callable $fn)
{
    $pdo = db();
    $pdo->beginTransaction();
    try {
        $erg = $fn();
        $pdo->commit();
        return $erg;
    } catch (Throwable $e) {
        $pdo->rollBack();
        throw $e;
    }
}

// Alle Zeiten in UTC; der Browser zeigt sie in Ortszeit an
function jetzt(int $sekundenVersatz = 0): string
{
    return gmdate('Y-m-d H:i:s', time() + $sekundenVersatz);
}

function iso(?string $dbZeit): ?string
{
    return $dbZeit === null ? null : str_replace(' ', 'T', $dbZeit) . 'Z';
}

function zufallsToken(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function ip(): string
{
    return substr((string)($_SERVER['REMOTE_ADDR'] ?? ''), 0, 45);
}

function eingabe(): array
{
    static $daten = null;
    if ($daten === null) {
        $roh = file_get_contents('php://input');
        $daten = $roh === '' || $roh === false ? [] : json_decode($roh, true);
        if (!is_array($daten)) {
            throw new ApiFehler(400, 'Ungültige Anfrage.');
        }
    }
    return $daten;
}

function text(array $d, string $feld, int $max = 255, bool $pflicht = false): ?string
{
    $w = $d[$feld] ?? null;
    if ($w === null || (is_string($w) && trim($w) === '')) {
        if ($pflicht) {
            throw new ApiFehler(400, 'Das Feld "' . $feld . '" ist ein Pflichtfeld.');
        }
        return null;
    }
    if (!is_scalar($w)) {
        throw new ApiFehler(400, 'Ungültiger Wert im Feld "' . $feld . '".');
    }
    $w = trim((string)$w);
    if (mb_strlen($w) > $max) {
        throw new ApiFehler(400, 'Der Text im Feld "' . $feld . '" ist zu lang (höchstens ' . $max . ' Zeichen).');
    }
    return $w;
}

function ganzzahl(array $d, string $feld): ?int
{
    $w = $d[$feld] ?? null;
    if ($w === null || $w === '') {
        return null;
    }
    if (!is_numeric($w)) {
        throw new ApiFehler(400, 'Im Feld "' . $feld . '" wird eine Zahl erwartet.');
    }
    return (int)$w;
}

function antwort(array $daten, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($daten, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
}

// ------------------------------------------------------------------
// Einstellungen (Tabelle einstellungen)
// ------------------------------------------------------------------
function einstellung(string $schluessel, ?string $vorgabe = null): ?string
{
    $w = wert('SELECT wert FROM einstellungen WHERE schluessel = ?', [$schluessel]);
    return $w === null ? $vorgabe : (string)$w;
}

function einstellungSetzen(string $schluessel, ?string $wert): void
{
    abfrage('INSERT INTO einstellungen (schluessel, wert) VALUES (?, ?) ON DUPLICATE KEY UPDATE wert = VALUES(wert)', [$schluessel, $wert]);
}

// AES-256-GCM mit dem Schlüssel aus der Konfiguration (für das SMTP-Passwort)
function verschluesseln(string $klartext): string
{
    $schluessel = hex2bin(konfiguration()['schluessel']);
    $iv = random_bytes(12);
    $tag = '';
    $chiffre = openssl_encrypt($klartext, 'aes-256-gcm', $schluessel, OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $chiffre);
}

function entschluesseln(?string $daten): string
{
    if ($daten === null || $daten === '') {
        return '';
    }
    $roh = base64_decode($daten, true);
    if ($roh === false || strlen($roh) < 28) {
        return '';
    }
    $schluessel = hex2bin(konfiguration()['schluessel']);
    $klar = openssl_decrypt(substr($roh, 28), 'aes-256-gcm', $schluessel, OPENSSL_RAW_DATA, substr($roh, 0, 12), substr($roh, 12, 16));
    return $klar === false ? '' : $klar;
}

// ------------------------------------------------------------------
// Protokoll
// ------------------------------------------------------------------
function protokoll(string $aktion, string $beschreibung, ?string $objektTyp = null, ?int $objektId = null, ?array $benutzer = null): void
{
    $b = $benutzer ?? aktuellerBenutzerOderNull();
    abfrage(
        'INSERT INTO protokoll (zeit, benutzer_id, benutzer_name, aktion, objekt_typ, objekt_id, beschreibung, ip) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [jetzt(), $b['id'] ?? null, $b ? anzeigeName($b) : '', $aktion, $objektTyp, $objektId, mb_substr($beschreibung, 0, 500), ip()]
    );
}

function anzeigeName(array $b): string
{
    $name = trim(($b['vorname'] ?? '') . ' ' . ($b['nachname'] ?? ''));
    return $name !== '' ? $name : (string)($b['email'] ?? '');
}

// ------------------------------------------------------------------
// Drosselung (Rate-Limits)
// ------------------------------------------------------------------
function drosselungZaehlen(string $schluessel, int $sekunden): int
{
    return (int)wert('SELECT COUNT(*) FROM drosselung WHERE schluessel = ? AND zeit > ?', [$schluessel, jetzt(-$sekunden)]);
}

function drosselungMerken(string $schluessel): void
{
    abfrage('INSERT INTO drosselung (schluessel, zeit) VALUES (?, ?)', [$schluessel, jetzt()]);
}

function drosselungLoeschen(string $schluessel): void
{
    abfrage('DELETE FROM drosselung WHERE schluessel = ?', [$schluessel]);
}

function drosseln(string $schluessel, int $max, int $sekunden, string $meldung): void
{
    if (drosselungZaehlen($schluessel, $sekunden) >= $max) {
        throw new ApiFehler(429, $meldung);
    }
}
