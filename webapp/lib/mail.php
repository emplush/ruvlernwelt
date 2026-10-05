<?php
// E-Mail-Versand per SMTP (ohne Zusatzbibliotheken) und Mail-Vorlagen im R+V-Design.
declare(strict_types=1);

function smtpEinstellungen(): array
{
    return [
        'host' => einstellung('smtp_host', ''),
        'port' => (int)einstellung('smtp_port', '465'),
        'verschluesselung' => einstellung('smtp_verschluesselung', 'ssl'), // ssl | starttls | keine
        'benutzer' => einstellung('smtp_benutzer', ''),
        'passwort' => entschluesseln(einstellung('smtp_passwort', '')),
        'absender' => einstellung('smtp_absender', ''),
        'absender_name' => einstellung('smtp_absender_name', 'R+V Lernwelt'),
    ];
}

function mailEingerichtet(): bool
{
    $s = smtpEinstellungen();
    return $s['host'] !== '' && $s['absender'] !== '';
}

final class SmtpVerbindung
{
    private $strom;

    public function __construct(array $s)
    {
        $kontext = stream_context_create(['ssl' => ['verify_peer' => true, 'verify_peer_name' => true, 'SNI_enabled' => true]]);
        $adresse = ($s['verschluesselung'] === 'ssl' ? 'ssl://' : 'tcp://') . $s['host'] . ':' . $s['port'];
        $fehlerNr = 0;
        $fehlerText = '';
        $this->strom = @stream_socket_client($adresse, $fehlerNr, $fehlerText, 15, STREAM_CLIENT_CONNECT, $kontext);
        if (!$this->strom) {
            throw new RuntimeException('Keine Verbindung zum Mailserver ' . $s['host'] . ':' . $s['port'] . '. Prüfen Sie Server, Port und Verschlüsselung' . ($fehlerText !== '' ? ' (' . $fehlerText . ')' : '; möglicherweise ist das Zertifikat des Servers ungültig') . '.');
        }
        stream_set_timeout($this->strom, 20);
        $this->erwarte(220);
        $name = preg_replace('/[^A-Za-z0-9.-]/', '', (string)($_SERVER['SERVER_NAME'] ?? 'localhost')) ?: 'localhost';
        $this->befehl('EHLO ' . $name, 250);
        if ($s['verschluesselung'] === 'starttls') {
            $this->befehl('STARTTLS', 220);
            if (!@stream_socket_enable_crypto($this->strom, true, STREAM_CRYPTO_METHOD_TLSv1_2_CLIENT | STREAM_CRYPTO_METHOD_TLSv1_3_CLIENT)) {
                throw new RuntimeException('Die verschlüsselte Verbindung (STARTTLS) zum Mailserver ist fehlgeschlagen. Möglicherweise ist das Zertifikat des Servers ungültig.');
            }
            $this->befehl('EHLO ' . $name, 250);
        }
        if ($s['benutzer'] !== '') {
            $this->befehl('AUTH LOGIN', 334);
            $this->befehl(base64_encode($s['benutzer']), 334);
            $this->befehl(base64_encode($s['passwort']), 235, 'Der Mailserver hat Benutzername oder Passwort abgelehnt.');
        }
    }

    public function senden(string $von, string $an, string $nachricht): void
    {
        $this->befehl('MAIL FROM:<' . $von . '>', 250);
        $this->befehl('RCPT TO:<' . $an . '>', [250, 251], 'Der Mailserver hat die Empfängeradresse abgelehnt.');
        $this->befehl('DATA', 354);
        // Punkte am Zeilenanfang verdoppeln (Dot-Stuffing)
        $daten = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $nachricht));
        fwrite($this->strom, str_replace("\n", "\r\n", $daten) . "\r\n.\r\n");
        $this->erwarte(250);
    }

    public function schliessen(): void
    {
        if ($this->strom) {
            @fwrite($this->strom, "QUIT\r\n");
            @fclose($this->strom);
            $this->strom = null;
        }
    }

    private function befehl(string $zeile, $erwartet, ?string $meldung = null): string
    {
        fwrite($this->strom, $zeile . "\r\n");
        return $this->erwarte($erwartet, $meldung);
    }

    private function erwarte($erwartet, ?string $meldung = null): string
    {
        $antwort = '';
        while (($zeile = fgets($this->strom, 1024)) !== false) {
            $antwort .= $zeile;
            if (strlen($zeile) < 4 || $zeile[3] === ' ') {
                break;
            }
        }
        $code = (int)substr($antwort, 0, 3);
        if (!in_array($code, (array)$erwartet, true)) {
            throw new RuntimeException($meldung ?? ('Der Mailserver meldet: ' . trim($antwort ?: 'keine Antwort')));
        }
        return $antwort;
    }
}

function mailKopfKodieren(string $text): string
{
    return preg_match('/[^\x20-\x7e]/', $text) ? '=?UTF-8?B?' . base64_encode($text) . '?=' : $text;
}

function mailSenden(string $an, string $betreff, string $html, string $textFassung, ?array $einstellungen = null): void
{
    $s = $einstellungen ?? smtpEinstellungen();
    if ($s['host'] === '' || $s['absender'] === '') {
        throw new RuntimeException('Der E-Mail-Versand ist noch nicht eingerichtet (Einstellungen → E-Mail).');
    }
    $grenze = 'b' . bin2hex(random_bytes(12));
    $domain = substr(strrchr($s['absender'], '@') ?: '@lernwelt', 1);
    $nachricht = implode("\n", [
        'Date: ' . date(DATE_RFC2822),
        'From: ' . mailKopfKodieren($s['absender_name']) . ' <' . $s['absender'] . '>',
        'To: <' . $an . '>',
        'Subject: ' . mailKopfKodieren($betreff),
        'Message-ID: <' . bin2hex(random_bytes(16)) . '@' . $domain . '>',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' . $grenze . '"',
        '',
        '--' . $grenze,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        chunk_split(base64_encode($textFassung), 76, "\n"),
        '--' . $grenze,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        chunk_split(base64_encode($html), 76, "\n"),
        '--' . $grenze . '--',
        '',
    ]);

    // Für Tests: Mails statt per SMTP in eine Datei schreiben
    $protokollDatei = (string)konfiguration()['mail_protokoll'];
    if ($protokollDatei !== '' && $s['host'] === 'datei') {
        file_put_contents($protokollDatei, json_encode(['an' => $an, 'betreff' => $betreff, 'text' => $textFassung], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n", FILE_APPEND | LOCK_EX);
        return;
    }
    $verbindung = new SmtpVerbindung($s);
    try {
        $verbindung->senden($s['absender'], $an, $nachricht);
    } finally {
        $verbindung->schliessen();
    }
}

// ------------------------------------------------------------------
// Vorlagen
// ------------------------------------------------------------------
function mailHtml(string $titel, array $absaetze, ?array $knopf = null, string $fuss = ''): string
{
    $e = function ($t) {
        return htmlspecialchars($t, ENT_QUOTES, 'UTF-8');
    };
    $logo = rtrim((string)konfiguration()['basis_url'], '/') . '/assets/mail-logo.png';
    $inhalt = '';
    foreach ($absaetze as $a) {
        $inhalt .= '<p style="margin:0 0 16px;font:16px/24px Arial,Helvetica,sans-serif;color:#001957">' . $e($a) . '</p>';
    }
    if ($knopf) {
        $inhalt .= '<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="background:#109da8;border-radius:4px">'
            . '<a href="' . $e($knopf['url']) . '" style="display:inline-block;padding:12px 24px;font:bold 16px Arial,Helvetica,sans-serif;color:#001957;text-decoration:none">' . $e($knopf['text']) . '</a>'
            . '</td></tr></table>'
            . '<p style="margin:0 0 16px;font:14px/21px Arial,Helvetica,sans-serif;color:#707070">Falls die Schaltfläche nicht funktioniert, kopieren Sie diesen Link in Ihren Browser:<br>'
            . '<a href="' . $e($knopf['url']) . '" style="color:#167b8a;word-break:break-all">' . $e($knopf['url']) . '</a></p>';
    }
    if ($fuss !== '') {
        $inhalt .= '<p style="margin:16px 0 0;font:14px/21px Arial,Helvetica,sans-serif;color:#707070">' . $e($fuss) . '</p>';
    }
    return '<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>' . $e($titel) . '</title></head>'
        . '<body style="margin:0;padding:0;background:#f5f5f5">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5"><tr><td align="center" style="padding:24px 12px">'
        . '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#ffffff;border:1px solid #c7c7c7;border-radius:4px">'
        . '<tr><td style="background:#001957;padding:20px 32px"><img src="' . $e($logo) . '" width="96" height="64" alt="R+V" style="display:block;border:0"></td></tr>'
        . '<tr><td style="padding:32px">'
        . '<p style="margin:0 0 4px;font:bold 16px Georgia,serif;color:#eb6504">Lernwelt – Persona-Datenbank</p>'
        . '<h1 style="margin:0 0 24px;font:bold 26px/1.2 Arial,Helvetica,sans-serif;color:#001957">' . $e($titel) . '</h1>'
        . $inhalt
        . '</td></tr>'
        . '<tr><td style="padding:16px 32px;border-top:1px solid #ececec;font:12px/18px Arial,Helvetica,sans-serif;color:#707070">Diese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.</td></tr>'
        . '</table></td></tr></table></body></html>';
}

function mailText(string $titel, array $absaetze, ?array $knopf = null, string $fuss = ''): string
{
    $t = "R+V Lernwelt – Persona-Datenbank\n\n" . $titel . "\n" . str_repeat('=', mb_strlen($titel)) . "\n\n" . implode("\n\n", $absaetze);
    if ($knopf) {
        $t .= "\n\n" . $knopf['text'] . ":\n" . $knopf['url'];
    }
    if ($fuss !== '') {
        $t .= "\n\n" . $fuss;
    }
    return $t . "\n\n--\nDiese E-Mail wurde automatisch versendet. Bitte antworten Sie nicht darauf.\n";
}

function mailVorlage(string $an, string $betreff, string $titel, array $absaetze, ?array $knopf = null, string $fuss = ''): void
{
    mailSenden($an, $betreff, mailHtml($titel, $absaetze, $knopf, $fuss), mailText($titel, $absaetze, $knopf, $fuss));
}

function anrede(array $b): string
{
    $name = trim(($b['vorname'] ?? '') . ' ' . ($b['nachname'] ?? ''));
    return $name !== '' ? 'Guten Tag ' . $name . ',' : 'Guten Tag,';
}
