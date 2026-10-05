<?php
// Erst-Einrichtung (Tabellen, erster Administrator, Startdaten) und Admin-Einstellungen.
declare(strict_types=1);

function eingerichtet(): bool
{
    try {
        return (int)wert('SELECT COUNT(*) FROM benutzer') > 0;
    } catch (PDOException $e) {
        return false; // Tabellen fehlen noch
    }
}

function schemaAnlegen(): void
{
    $sql = (string)file_get_contents(dirname(__DIR__) . '/einrichtung/schema.sql');
    $sql = preg_replace('/^--.*$/m', '', $sql);
    foreach (array_filter(array_map('trim', explode(';', $sql))) as $anweisung) {
        db()->exec($anweisung);
    }
}

// Bei neuen Tabellen erhöhen; bestehende Datenbanken werden beim nächsten Aufruf ergänzt.
const SCHEMA_VERSION = 2;

function schemaAktualisieren(): void
{
    if ((int)einstellung('schema_version', '1') < SCHEMA_VERSION) {
        schemaAnlegen();
        einstellungSetzen('schema_version', (string)SCHEMA_VERSION);
    }
}

function einrichtungStatus(): array
{
    return ['eingerichtet' => eingerichtet(), 'ersterAdmin' => (string)konfiguration()['erster_admin']];
}

function einrichten(array $e): array
{
    if (eingerichtet()) {
        throw new ApiFehler(403, 'Die Anwendung ist bereits eingerichtet.');
    }
    $code = (string)konfiguration()['einrichtungs_code'];
    schemaAnlegen();
    einstellungSetzen('schema_version', (string)SCHEMA_VERSION);
    drosseln('einrichten:' . ip(), 10, 3600, 'Zu viele Versuche. Bitte versuchen Sie es in einer Stunde erneut.');
    if ($code === '' || !hash_equals($code, (string)($e['code'] ?? ''))) {
        drosselungMerken('einrichten:' . ip());
        throw new ApiFehler(403, 'Der Einrichtungscode ist falsch. Er steht in der Datei konfiguration.php.');
    }
    $email = emailNormalisieren((string)(konfiguration()['erster_admin'] ?: ($e['email'] ?? '')));
    $vorname = text($e, 'vorname', 100, true);
    $nachname = text($e, 'nachname', 100, true);
    $org = orgEinheitNormalisieren($e['orgEinheit'] ?? '');
    $passwort = (string)($e['passwort'] ?? '');
    passwortRegelnPruefen($passwort, $email);

    abfrage(
        "INSERT INTO benutzer (email, vorname, nachname, org_einheit, rolle, status, passwort_hash, erstellt_am, aktiviert_am, letzte_anmeldung) VALUES (?, ?, ?, ?, 'admin', 'aktiv', ?, ?, ?, ?)",
        [$email, $vorname, $nachname, $org, passwortHash($passwort), jetzt(), jetzt(), jetzt()]
    );
    $admin = zeile('SELECT * FROM benutzer WHERE id = ?', [(int)db()->lastInsertId()]);
    einstellungSetzen('schema_version', '1');
    if (einstellung('app_titel') === null) {
        einstellungSetzen('app_titel', 'R+V Lernwelt – Persona-Datenbank');
    }
    protokoll('eingerichtet', 'Anwendung eingerichtet, erster Administrator ' . $email, 'benutzer', (int)$admin['id'], $admin);

    // Bestandsdaten aus der Übernahme (einrichtung/startdaten) einspielen
    $start = dirname(__DIR__) . '/einrichtung/startdaten';
    $importiert = null;
    if (is_file($start . '/lernwelt.json') && (int)wert('SELECT COUNT(*) FROM personas') === 0) {
        $daten = json_decode((string)file_get_contents($start . '/lernwelt.json'), true);
        if (is_array($daten)) {
            $importiert = importieren($daten, $admin, $start . '/bilder');
        }
    }
    sitzungStarten($admin);
    return ['ich' => ich(), 'importiert' => $importiert];
}

// ------------------------------------------------------------------
// Einstellungen (nur Administration)
// ------------------------------------------------------------------
function einstellungenLesen(): array
{
    rechtePruefen(angemeldet(), 'einstellungen');
    $s = smtpEinstellungen();
    return [
        'appTitel' => einstellung('app_titel', 'R+V Lernwelt – Persona-Datenbank'),
        'smtp' => [
            'host' => $s['host'], 'port' => $s['port'], 'verschluesselung' => $s['verschluesselung'],
            'benutzer' => $s['benutzer'], 'absender' => $s['absender'], 'absenderName' => $s['absender_name'],
            'passwortGesetzt' => $s['passwort'] !== '',
        ],
        'mailEingerichtet' => mailEingerichtet(),
        'galerie' => galerieStatistik(),
    ];
}

function einstellungenSpeichern(array $e): array
{
    $b = angemeldet();
    rechtePruefen($b, 'einstellungen');
    if (array_key_exists('appTitel', $e)) {
        einstellungSetzen('app_titel', text($e, 'appTitel', 120, true));
        protokoll('einstellungen', 'Titel der Anwendung geändert');
    }
    if (isset($e['smtp']) && is_array($e['smtp'])) {
        $s = $e['smtp'];
        $verschl = (string)($s['verschluesselung'] ?? 'ssl');
        if (!in_array($verschl, ['ssl', 'starttls', 'keine'], true)) {
            throw new ApiFehler(400, 'Unbekannte Verschlüsselung.');
        }
        $port = ganzzahl($s, 'port') ?? 465;
        if ($port < 1 || $port > 65535) {
            throw new ApiFehler(400, 'Ungültiger Port.');
        }
        $absender = text($s, 'absender', 190);
        if ($absender !== null) {
            $absender = emailNormalisieren($absender);
        }
        einstellungSetzen('smtp_host', text($s, 'host', 190) ?? '');
        einstellungSetzen('smtp_port', (string)$port);
        einstellungSetzen('smtp_verschluesselung', $verschl);
        einstellungSetzen('smtp_benutzer', text($s, 'benutzer', 190) ?? '');
        einstellungSetzen('smtp_absender', $absender ?? '');
        einstellungSetzen('smtp_absender_name', text($s, 'absenderName', 100) ?? 'R+V Lernwelt');
        if (isset($s['passwort']) && is_string($s['passwort']) && $s['passwort'] !== '') {
            einstellungSetzen('smtp_passwort', verschluesseln($s['passwort']));
        }
        protokoll('einstellungen', 'E-Mail-Einstellungen geändert');
    }
    return einstellungenLesen();
}

function mailTest(array $e): array
{
    $b = angemeldet();
    rechtePruefen($b, 'einstellungen');
    $an = emailNormalisieren((string)($e['an'] ?? $b['email']));
    try {
        mailVorlage($an, 'Test-E-Mail der Persona-Datenbank', 'Der E-Mail-Versand funktioniert', [
            anrede($b),
            'Diese Test-E-Mail bestätigt, dass die Persona-Datenbank E-Mails versenden kann. Einladungen und Links zum Zurücksetzen von Passwörtern kommen damit an.',
        ]);
    } catch (RuntimeException $ex) {
        throw new ApiFehler(400, 'Die Test-E-Mail konnte nicht gesendet werden: ' . $ex->getMessage());
    }
    protokoll('mail_test', 'Test-E-Mail an ' . $an . ' gesendet');
    return ['ok' => true];
}

function protokollLesen(array $q): array
{
    rechtePruefen(angemeldet(), 'protokoll');
    $seite = max(1, (int)($q['seite'] ?? 1));
    $proSeite = 50;
    $bedingungen = [];
    $werte = [];
    $suche = trim((string)($q['suche'] ?? ''));
    if ($suche !== '') {
        $bedingungen[] = '(beschreibung LIKE ? OR benutzer_name LIKE ?)';
        $werte[] = '%' . $suche . '%';
        $werte[] = '%' . $suche . '%';
    }
    $bereich = (string)($q['bereich'] ?? '');
    if ($bereich === 'daten') {
        $bedingungen[] = "objekt_typ IN ('persona', 'firma', 'format')";
    } elseif ($bereich === 'konten') {
        $bedingungen[] = "(objekt_typ = 'benutzer' OR aktion IN ('eingerichtet', 'einstellungen', 'mail_test', 'mail_fehler', 'importiert', 'exportiert'))";
    }
    $wo = $bedingungen ? ' WHERE ' . implode(' AND ', $bedingungen) : '';
    $gesamt = (int)wert('SELECT COUNT(*) FROM protokoll' . $wo, $werte);
    $zeilen = abfrage('SELECT * FROM protokoll' . $wo . ' ORDER BY id DESC LIMIT ' . $proSeite . ' OFFSET ' . (($seite - 1) * $proSeite), $werte)->fetchAll();
    return [
        'gesamt' => $gesamt, 'seite' => $seite, 'seiten' => max(1, (int)ceil($gesamt / $proSeite)),
        'eintraege' => array_map(function ($z) {
            return [
                'id' => (int)$z['id'], 'zeit' => iso($z['zeit']), 'benutzer' => $z['benutzer_name'], 'aktion' => $z['aktion'],
                'objektTyp' => $z['objekt_typ'], 'objektId' => $z['objekt_id'] === null ? null : (int)$z['objekt_id'],
                'beschreibung' => $z['beschreibung'], 'ip' => $z['ip'],
            ];
        }, $zeilen),
    ];
}
