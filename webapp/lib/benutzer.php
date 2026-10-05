<?php
// Anmeldung, Einladung, Passwort vergessen, eigenes Konto, Benutzerverwaltung.
declare(strict_types=1);

// Vergleichs-Hash für unbekannte Konten, damit die Antwortzeit nichts verrät
const DUMMY_HASH = '$argon2id$v=19$m=65536,t=3,p=1$amVoSERFNWxOdEUza2YyVw$19HwYWLmPegr5qxXQW9M5D/FfDiSPZ7cLP9lK3fKsMI';

function ich(): array
{
    $b = angemeldet();
    return benutzerOeffentlich($b) + [
        'rechte' => rechteListe($b),
        'einladbareRollen' => array_map(function ($r) {
            return ['wert' => $r, 'name' => ROLLEN[$r]];
        }, EINLADBARE_ROLLEN[$b['rolle']] ?? []),
        'csrf' => $b['csrf'],
    ];
}

function anzahlAktiverAdmins(): int
{
    return (int)wert("SELECT COUNT(*) FROM benutzer WHERE rolle = 'admin' AND status = 'aktiv'");
}

// ------------------------------------------------------------------
// Anmelden, Abmelden, Passwort vergessen
// ------------------------------------------------------------------
function anmelden(array $e): array
{
    $email = mb_strtolower(trim((string)($e['email'] ?? '')));
    $passwort = (string)($e['passwort'] ?? '');
    drosseln('anmelden-ip:' . ip(), 30, 900, 'Zu viele Anmeldeversuche von Ihrem Anschluss. Bitte versuchen Sie es in 15 Minuten erneut.');
    drosseln('anmelden:' . $email, 5, 900, 'Zu viele Fehlversuche für diese E-Mail-Adresse. Bitte versuchen Sie es in 15 Minuten erneut.');

    $b = $email !== '' ? zeile('SELECT * FROM benutzer WHERE email = ?', [$email]) : null;
    $hash = $b && $b['passwort_hash'] ? $b['passwort_hash'] : DUMMY_HASH;
    $ok = password_verify($passwort, $hash) && $b && $b['status'] !== 'eingeladen';
    if (!$ok) {
        drosselungMerken('anmelden-ip:' . ip());
        drosselungMerken('anmelden:' . $email);
        protokoll('anmeldung_fehlgeschlagen', 'Fehlgeschlagene Anmeldung für ' . mb_substr($email, 0, 190), 'benutzer', $b ? (int)$b['id'] : null, null);
        throw new ApiFehler(401, 'E-Mail-Adresse oder Passwort ist falsch.');
    }
    if ($b['status'] === 'deaktiviert') {
        throw new ApiFehler(403, 'Ihr Konto ist deaktiviert. Bitte wenden Sie sich an die Administration.');
    }
    if (password_needs_rehash($b['passwort_hash'], defined('PASSWORD_ARGON2ID') ? PASSWORD_ARGON2ID : PASSWORD_BCRYPT, defined('PASSWORD_ARGON2ID') ? ['memory_cost' => 65536, 'time_cost' => 3, 'threads' => 1] : ['cost' => 12])) {
        abfrage('UPDATE benutzer SET passwort_hash = ? WHERE id = ?', [passwortHash($passwort), $b['id']]);
    }
    abfrage('UPDATE benutzer SET letzte_anmeldung = ?, inaktiv_gewarnt_am = NULL WHERE id = ?', [jetzt(), $b['id']]);
    drosselungLoeschen('anmelden:' . $email);
    sitzungStarten($b);
    protokoll('anmeldung', 'Angemeldet', 'benutzer', (int)$b['id']);
    return ich();
}

function abmelden(): void
{
    $b = aktuellerBenutzerOderNull();
    if ($b) {
        protokoll('abmeldung', 'Abgemeldet', 'benutzer', (int)$b['id']);
    }
    sitzungBeenden();
}

function passwortVergessen(array $e): void
{
    drosseln('vergessen-ip:' . ip(), 10, 3600, 'Zu viele Anfragen von Ihrem Anschluss. Bitte versuchen Sie es in einer Stunde erneut.');
    drosselungMerken('vergessen-ip:' . ip());
    $email = mb_strtolower(trim((string)($e['email'] ?? '')));
    if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        throw new ApiFehler(400, 'Bitte geben Sie eine gültige E-Mail-Adresse ein.');
    }
    // Immer dieselbe Antwort, egal ob ein Konto existiert
    if (drosselungZaehlen('vergessen:' . $email, 3600) >= 3) {
        return;
    }
    drosselungMerken('vergessen:' . $email);
    $b = zeile("SELECT * FROM benutzer WHERE email = ? AND status = 'aktiv'", [$email]);
    if (!$b) {
        return;
    }
    $token = tokenErstellen((int)$b['id'], 'passwort', PASSWORT_LINK_GUELTIG);
    try {
        mailVorlage($b['email'], 'Passwort zurücksetzen', 'Neues Passwort festlegen', [
            anrede($b),
            'Sie haben angefordert, Ihr Passwort für die Persona-Datenbank zurückzusetzen. Der Link ist eine Stunde gültig und kann nur einmal verwendet werden.',
        ], ['text' => 'Neues Passwort festlegen', 'url' => appLink('passwort-neu/' . $token)],
            'Wenn Sie das nicht angefordert haben, können Sie diese E-Mail ignorieren. Ihr bisheriges Passwort bleibt gültig.');
        protokoll('passwort_link', 'Link zum Zurücksetzen des Passworts versendet', 'benutzer', (int)$b['id'], $b);
    } catch (RuntimeException $ex) {
        protokoll('mail_fehler', 'Mail „Passwort zurücksetzen“ an ' . $b['email'] . ' fehlgeschlagen: ' . $ex->getMessage(), 'benutzer', (int)$b['id'], $b);
    }
}

function tokenInfo(array $e): array
{
    $zweck = (string)($e['zweck'] ?? '');
    if (!in_array($zweck, ['einladung', 'passwort'], true)) {
        throw new ApiFehler(400, 'Ungültige Anfrage.');
    }
    $t = tokenLesen($e['token'] ?? null, $zweck);
    if ($zweck === 'einladung' && $t['status'] !== 'eingeladen') {
        throw new ApiFehler(400, 'Diese Einladung wurde bereits angenommen. Melden Sie sich mit Ihrer E-Mail-Adresse an.');
    }
    return ['email' => $t['email'], 'vorname' => $t['vorname'], 'nachname' => $t['nachname'], 'rolleName' => ROLLEN[$t['rolle']] ?? ''];
}

function einladungAnnehmen(array $e): array
{
    $t = tokenLesen($e['token'] ?? null, 'einladung');
    if ($t['status'] !== 'eingeladen') {
        throw new ApiFehler(400, 'Diese Einladung wurde bereits angenommen. Melden Sie sich mit Ihrer E-Mail-Adresse an.');
    }
    $vorname = text($e, 'vorname', 100, true);
    $nachname = text($e, 'nachname', 100, true);
    $passwort = (string)($e['passwort'] ?? '');
    passwortRegelnPruefen($passwort, $t['email']);
    abfrage(
        "UPDATE benutzer SET vorname = ?, nachname = ?, passwort_hash = ?, status = 'aktiv', aktiviert_am = ?, letzte_anmeldung = ? WHERE id = ?",
        [$vorname, $nachname, passwortHash($passwort), jetzt(), jetzt(), $t['id']]
    );
    tokenVerbrauchen((int)$t['token_id']);
    $b = zeile('SELECT * FROM benutzer WHERE id = ?', [$t['id']]);
    sitzungStarten($b);
    protokoll('einladung_angenommen', 'Einladung angenommen, Konto aktiviert', 'benutzer', (int)$b['id']);
    return ich();
}

function passwortZuruecksetzen(array $e): array
{
    $t = tokenLesen($e['token'] ?? null, 'passwort');
    if ($t['status'] !== 'aktiv') {
        throw new ApiFehler(400, 'Der Link ist ungültig oder abgelaufen.');
    }
    $passwort = (string)($e['passwort'] ?? '');
    passwortRegelnPruefen($passwort, $t['email']);
    abfrage('UPDATE benutzer SET passwort_hash = ?, letzte_anmeldung = ? WHERE id = ?', [passwortHash($passwort), jetzt(), $t['id']]);
    tokenVerbrauchen((int)$t['token_id']);
    sitzungenBeenden((int)$t['id']);
    drosselungLoeschen('anmelden:' . $t['email']);
    $b = zeile('SELECT * FROM benutzer WHERE id = ?', [$t['id']]);
    sitzungStarten($b);
    protokoll('passwort_zurueckgesetzt', 'Passwort über „Passwort vergessen“ neu festgelegt', 'benutzer', (int)$b['id']);
    hinweisMail($b, 'Ihr Passwort wurde geändert', 'Das Passwort für Ihr Konto in der Persona-Datenbank wurde soeben neu festgelegt. Alle anderen Anmeldungen wurden beendet.');
    return ich();
}

function emailBestaetigen(array $e): array
{
    $t = tokenLesen($e['token'] ?? null, 'email');
    $neu = (string)$t['neue_email'];
    if (wert('SELECT id FROM benutzer WHERE email = ? AND id <> ?', [$neu, $t['id']])) {
        throw new ApiFehler(400, 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.');
    }
    $alt = $t['email'];
    abfrage('UPDATE benutzer SET email = ? WHERE id = ?', [$neu, $t['id']]);
    tokenVerbrauchen((int)$t['token_id']);
    $b = zeile('SELECT * FROM benutzer WHERE id = ?', [$t['id']]);
    protokoll('email_geaendert', 'E-Mail-Adresse von ' . $alt . ' auf ' . $neu . ' geändert', 'benutzer', (int)$b['id'], $b);
    hinweisMail(['email' => $alt] + $b, 'Ihre E-Mail-Adresse wurde geändert', 'Die E-Mail-Adresse Ihres Kontos in der Persona-Datenbank wurde auf ' . $neu . ' geändert. Melden Sie sich künftig mit der neuen Adresse an.');
    return ['email' => $neu];
}

// Sicherheitshinweis an den Kontoinhaber; Fehler beim Versand blockieren den Ablauf nicht
function hinweisMail(array $b, string $betreff, string $text): void
{
    try {
        mailVorlage($b['email'], $betreff, $betreff, [anrede($b), $text], null,
            'Wenn Sie das nicht selbst waren, wenden Sie sich bitte sofort an die Administration.');
    } catch (Throwable $ex) {
        protokoll('mail_fehler', 'Hinweis-Mail „' . $betreff . '“ an ' . $b['email'] . ' fehlgeschlagen: ' . $ex->getMessage(), 'benutzer', (int)($b['id'] ?? 0) ?: null);
    }
}

// ------------------------------------------------------------------
// Eigenes Konto
// ------------------------------------------------------------------
function kontoSpeichern(array $e): array
{
    $b = angemeldet();
    abfrage('UPDATE benutzer SET vorname = ?, nachname = ? WHERE id = ?', [text($e, 'vorname', 100, true), text($e, 'nachname', 100, true), $b['id']]);
    protokoll('konto_geaendert', 'Eigenen Namen geändert', 'benutzer', (int)$b['id']);
    unset($GLOBALS['__benutzer']);
    return ich();
}

function eigenesPasswortPruefen(array $b, string $passwort): void
{
    drosseln('konto-pw:' . $b['id'], 5, 900, 'Zu viele Fehlversuche. Bitte versuchen Sie es in 15 Minuten erneut.');
    $hash = (string)wert('SELECT passwort_hash FROM benutzer WHERE id = ?', [$b['id']]);
    if (!password_verify($passwort, $hash)) {
        drosselungMerken('konto-pw:' . $b['id']);
        throw new ApiFehler(400, 'Das aktuelle Passwort ist falsch.');
    }
}

function passwortAendern(array $e): void
{
    $b = angemeldet();
    eigenesPasswortPruefen($b, (string)($e['alt'] ?? ''));
    $neu = (string)($e['neu'] ?? '');
    passwortRegelnPruefen($neu, $b['email']);
    abfrage('UPDATE benutzer SET passwort_hash = ? WHERE id = ?', [passwortHash($neu), $b['id']]);
    sitzungenBeenden((int)$b['id'], $b['sitzung_id']);
    protokoll('passwort_geaendert', 'Eigenes Passwort geändert', 'benutzer', (int)$b['id']);
    hinweisMail($b, 'Ihr Passwort wurde geändert', 'Das Passwort für Ihr Konto in der Persona-Datenbank wurde soeben geändert. Alle anderen Anmeldungen wurden beendet.');
}

function emailAendern(array $e): array
{
    $b = angemeldet();
    eigenesPasswortPruefen($b, (string)($e['passwort'] ?? ''));
    $neu = emailNormalisieren($e['email'] ?? '');
    if ($neu === $b['email']) {
        throw new ApiFehler(400, 'Das ist bereits Ihre E-Mail-Adresse.');
    }
    if (wert('SELECT id FROM benutzer WHERE email = ?', [$neu])) {
        throw new ApiFehler(400, 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.');
    }
    $token = tokenErstellen((int)$b['id'], 'email', EMAIL_LINK_GUELTIG, $neu);
    try {
        mailVorlage($neu, 'Neue E-Mail-Adresse bestätigen', 'E-Mail-Adresse bestätigen', [
            anrede($b),
            'Sie möchten Ihre E-Mail-Adresse für die Persona-Datenbank auf diese Adresse ändern. Bitte bestätigen Sie das innerhalb von 24 Stunden.',
        ], ['text' => 'E-Mail-Adresse bestätigen', 'url' => appLink('email-bestaetigen/' . $token)]);
    } catch (RuntimeException $ex) {
        throw new ApiFehler(500, 'Die Bestätigungs-E-Mail konnte nicht gesendet werden: ' . $ex->getMessage());
    }
    protokoll('email_aenderung_angefordert', 'Änderung der E-Mail-Adresse auf ' . $neu . ' angefordert', 'benutzer', (int)$b['id']);
    return ['email' => $neu];
}

function ueberallAbmelden(): void
{
    $b = angemeldet();
    sitzungenBeenden((int)$b['id'], $b['sitzung_id']);
    protokoll('sitzungen_beendet', 'Alle anderen Anmeldungen beendet', 'benutzer', (int)$b['id']);
}

// ------------------------------------------------------------------
// Benutzerverwaltung
// ------------------------------------------------------------------
function benutzerListe(): array
{
    $b = angemeldet();
    rechtePruefen($b, 'benutzer_sehen');
    $zeilen = abfrage(
        "SELECT b.*, e.vorname AS e_vorname, e.nachname AS e_nachname, e.email AS e_email,
                (SELECT MAX(t.ablauf) FROM tokens t WHERE t.benutzer_id = b.id AND t.zweck = 'einladung' AND t.verwendet_am IS NULL) AS einladung_ablauf
         FROM benutzer b LEFT JOIN benutzer e ON e.id = b.erstellt_von ORDER BY b.nachname, b.vorname, b.email"
    )->fetchAll();
    return array_map(function ($z) {
        $o = benutzerOeffentlich($z);
        $o['eingeladenVon'] = $z['e_email'] ? anzeigeName(['vorname' => $z['e_vorname'], 'nachname' => $z['e_nachname'], 'email' => $z['e_email']]) : '';
        $o['einladungAblauf'] = iso($z['einladung_ablauf']);
        $o['einladungAbgelaufen'] = $z['status'] === 'eingeladen' && (!$z['einladung_ablauf'] || strtotime($z['einladung_ablauf'] . ' UTC') < time());
        return $o;
    }, $zeilen);
}

function einladungSenden(array $neu, array $einlader): array
{
    $token = tokenErstellen((int)$neu['id'], 'einladung', EINLADUNG_GUELTIG);
    $url = appLink('einladung/' . $token);
    try {
        mailVorlage($neu['email'], 'Einladung zur Persona-Datenbank der R+V Lernwelt', 'Sie sind eingeladen', [
            anrede($neu),
            anzeigeName($einlader) . ' hat Sie als ' . (ROLLEN[$neu['rolle']] ?? '') . ' zur Persona-Datenbank der R+V Lernwelt eingeladen.',
            'Legen Sie über den folgenden Link Ihr Passwort fest, um Ihr Konto zu aktivieren. Der Link ist 7 Tage gültig.',
        ], ['text' => 'Konto aktivieren', 'url' => $url]);
        return ['mailGesendet' => true];
    } catch (RuntimeException $ex) {
        protokoll('mail_fehler', 'Einladung an ' . $neu['email'] . ' nicht versendet: ' . $ex->getMessage(), 'benutzer', (int)$neu['id'], $einlader);
        // Ohne Mailversand erhält die einladende Person den Link zum Weitergeben
        return ['mailGesendet' => false, 'mailFehler' => $ex->getMessage(), 'link' => $url];
    }
}

function einladen(array $e): array
{
    $b = angemeldet();
    rechtePruefen($b, 'benutzer_einladen');
    $rolle = rolleNormalisieren($e['rolle'] ?? null);
    if (!in_array($rolle, EINLADBARE_ROLLEN[$b['rolle']] ?? [], true)) {
        throw new ApiFehler(403, 'Sie dürfen nur Benutzer mit der Rolle Nutzer einladen.');
    }
    $email = emailNormalisieren($e['email'] ?? '');
    $vorname = text($e, 'vorname', 100, true);
    $nachname = text($e, 'nachname', 100, true);
    $org = orgEinheitNormalisieren($e['orgEinheit'] ?? '');
    $vorhanden = zeile('SELECT status FROM benutzer WHERE email = ?', [$email]);
    if ($vorhanden) {
        throw new ApiFehler(400, $vorhanden['status'] === 'eingeladen'
            ? 'Diese Person ist bereits eingeladen. Nutzen Sie in der Liste „Einladung erneut senden“.'
            : 'Für diese E-Mail-Adresse gibt es bereits ein Konto.');
    }
    drosseln('einladen:' . $b['id'], 50, 86400, 'Sie haben heute bereits sehr viele Einladungen versendet. Bitte versuchen Sie es morgen erneut.');
    drosselungMerken('einladen:' . $b['id']);
    abfrage(
        "INSERT INTO benutzer (email, vorname, nachname, org_einheit, rolle, status, erstellt_am, erstellt_von) VALUES (?, ?, ?, ?, ?, 'eingeladen', ?, ?)",
        [$email, $vorname, $nachname, $org, $rolle, jetzt(), $b['id']]
    );
    $neu = zeile('SELECT * FROM benutzer WHERE id = ?', [(int)db()->lastInsertId()]);
    $ergebnis = einladungSenden($neu, $b);
    protokoll('eingeladen', anzeigeName($neu) . ' (' . $email . ') als ' . ROLLEN[$rolle] . ' eingeladen', 'benutzer', (int)$neu['id']);
    return $ergebnis + ['benutzer' => benutzerListe()];
}

function einladungVerwaltbar(array $b, int $id): array
{
    rechtePruefen($b, 'benutzer_einladen');
    $z = zeile('SELECT * FROM benutzer WHERE id = ?', [$id]);
    if (!$z || $z['status'] !== 'eingeladen') {
        throw new ApiFehler(400, 'Zu diesem Konto gibt es keine offene Einladung.');
    }
    if (!in_array($z['rolle'], EINLADBARE_ROLLEN[$b['rolle']] ?? [], true)) {
        throw new ApiFehler(403, 'Dafür fehlt Ihnen die Berechtigung.');
    }
    return $z;
}

function einladungErneut(array $e): array
{
    $b = angemeldet();
    $z = einladungVerwaltbar($b, (int)($e['id'] ?? 0));
    drosseln('einladen:' . $b['id'], 50, 86400, 'Sie haben heute bereits sehr viele Einladungen versendet. Bitte versuchen Sie es morgen erneut.');
    drosselungMerken('einladen:' . $b['id']);
    $ergebnis = einladungSenden($z, $b);
    protokoll('einladung_erneut', 'Einladung an ' . $z['email'] . ' erneut gesendet', 'benutzer', (int)$z['id']);
    return $ergebnis + ['benutzer' => benutzerListe()];
}

function einladungZurueckziehen(array $e): array
{
    $b = angemeldet();
    $z = einladungVerwaltbar($b, (int)($e['id'] ?? 0));
    abfrage('DELETE FROM tokens WHERE benutzer_id = ?', [$z['id']]);
    abfrage('DELETE FROM benutzer WHERE id = ?', [$z['id']]);
    protokoll('einladung_zurueckgezogen', 'Einladung an ' . $z['email'] . ' zurückgezogen', 'benutzer', (int)$z['id']);
    return ['benutzer' => benutzerListe()];
}

function verwaltetesKonto(int $id): array
{
    $z = zeile('SELECT * FROM benutzer WHERE id = ?', [$id]);
    if (!$z) {
        throw new ApiFehler(404, 'Das Benutzerkonto existiert nicht mehr.');
    }
    return $z;
}

function benutzerSpeichern(array $e): array
{
    $b = angemeldet();
    rechtePruefen($b, 'benutzer_verwalten');
    $z = verwaltetesKonto((int)($e['id'] ?? 0));
    $rolle = rolleNormalisieren($e['rolle'] ?? null);
    $email = emailNormalisieren($e['email'] ?? '');
    $vorname = text($e, 'vorname', 100, true);
    $nachname = text($e, 'nachname', 100, true);
    $org = orgEinheitNormalisieren($e['orgEinheit'] ?? '');
    if ($z['rolle'] === 'admin' && $rolle !== 'admin' && $z['status'] === 'aktiv' && anzahlAktiverAdmins() <= 1) {
        throw new ApiFehler(400, 'Das ist der letzte aktive Administrator. Ernennen Sie zuerst einen weiteren Administrator.');
    }
    if ($email !== $z['email'] && wert('SELECT id FROM benutzer WHERE email = ? AND id <> ?', [$email, $z['id']])) {
        throw new ApiFehler(400, 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.');
    }
    abfrage('UPDATE benutzer SET email = ?, vorname = ?, nachname = ?, org_einheit = ?, rolle = ? WHERE id = ?', [$email, $vorname, $nachname, $org, $rolle, $z['id']]);
    $aenderungen = [];
    if ($rolle !== $z['rolle']) {
        $aenderungen[] = 'Rolle ' . ROLLEN[$z['rolle']] . ' → ' . ROLLEN[$rolle];
        // Neue Rechte gelten sofort; bestehende Anmeldungen enden (eigene bleibt)
        sitzungenBeenden((int)$z['id'], (int)$z['id'] === (int)$b['id'] ? $b['sitzung_id'] : null);
    }
    if ($email !== $z['email']) {
        $aenderungen[] = 'E-Mail ' . $z['email'] . ' → ' . $email;
        $neu = zeile('SELECT * FROM benutzer WHERE id = ?', [$z['id']]);
        hinweisMail(['email' => $z['email']] + $neu, 'Ihre E-Mail-Adresse wurde geändert', 'Die Administration hat die E-Mail-Adresse Ihres Kontos in der Persona-Datenbank auf ' . $email . ' geändert.');
    }
    if ($org !== $z['org_einheit']) {
        $aenderungen[] = 'Org-Einheit ' . ($z['org_einheit'] ?: '–') . ' → ' . $org;
    }
    if ($vorname !== $z['vorname'] || $nachname !== $z['nachname']) {
        $aenderungen[] = 'Name geändert';
    }
    protokoll('benutzer_geaendert', 'Konto ' . $email . ' bearbeitet' . ($aenderungen ? ': ' . implode(', ', $aenderungen) : ''), 'benutzer', (int)$z['id']);
    return ['benutzer' => benutzerListe()];
}

function benutzerStatus(array $e): array
{
    $b = angemeldet();
    rechtePruefen($b, 'benutzer_verwalten');
    $z = verwaltetesKonto((int)($e['id'] ?? 0));
    $aktiv = ($e['aktiv'] ?? null) === true;
    if ((int)$z['id'] === (int)$b['id']) {
        throw new ApiFehler(400, 'Sie können Ihr eigenes Konto nicht deaktivieren.');
    }
    if ($z['status'] === 'eingeladen') {
        throw new ApiFehler(400, 'Das Konto ist noch nicht aktiviert.');
    }
    if ($aktiv) {
        abfrage("UPDATE benutzer SET status = 'aktiv', aktiviert_am = ?, inaktiv_gewarnt_am = NULL WHERE id = ?", [jetzt(), $z['id']]);
        protokoll('benutzer_aktiviert', 'Konto ' . $z['email'] . ' wieder aktiviert', 'benutzer', (int)$z['id']);
    } else {
        if ($z['rolle'] === 'admin' && anzahlAktiverAdmins() <= 1) {
            throw new ApiFehler(400, 'Das ist der letzte aktive Administrator.');
        }
        abfrage("UPDATE benutzer SET status = 'deaktiviert' WHERE id = ?", [$z['id']]);
        sitzungenBeenden((int)$z['id']);
        protokoll('benutzer_deaktiviert', 'Konto ' . $z['email'] . ' deaktiviert', 'benutzer', (int)$z['id']);
    }
    return ['benutzer' => benutzerListe()];
}

function benutzerLoeschen(array $e): array
{
    $b = angemeldet();
    rechtePruefen($b, 'benutzer_verwalten');
    $z = verwaltetesKonto((int)($e['id'] ?? 0));
    if ((int)$z['id'] === (int)$b['id']) {
        throw new ApiFehler(400, 'Sie können Ihr eigenes Konto nicht löschen.');
    }
    if ($z['rolle'] === 'admin' && $z['status'] === 'aktiv' && anzahlAktiverAdmins() <= 1) {
        throw new ApiFehler(400, 'Das ist der letzte aktive Administrator.');
    }
    abfrage('DELETE FROM sitzungen WHERE benutzer_id = ?', [$z['id']]);
    abfrage('DELETE FROM tokens WHERE benutzer_id = ?', [$z['id']]);
    abfrage('DELETE FROM benutzer WHERE id = ?', [$z['id']]);
    protokoll('benutzer_geloescht', 'Konto ' . anzeigeName($z) . ' (' . $z['email'] . ') gelöscht', 'benutzer', (int)$z['id']);
    return ['benutzer' => benutzerListe()];
}
