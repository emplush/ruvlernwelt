<?php
// Tägliche Wartung: Aufräumen, Datenschutz-Fristen, inaktive Konten.
// Läuft automatisch einmal am Tag beim ersten Aufruf oder per Cronjob (api/index.php?r=wartung&schluessel=...).
declare(strict_types=1);

const INAKTIV_MONATE = 12;
const INAKTIV_WARNUNG_TAGE = 14;
const PROTOKOLL_IP_TAGE = 90;
const PROTOKOLL_JAHRE = 2;

function wartungFaellig(): bool
{
    $zuletzt = einstellung('wartung_zuletzt');
    return $zuletzt === null || strtotime($zuletzt . ' UTC') < time() - 86400;
}

function wartung(): array
{
    einstellungSetzen('wartung_zuletzt', jetzt());
    $ergebnis = ['deaktiviert' => 0, 'gewarnt' => 0];

    abfrage('DELETE FROM sitzungen WHERE zuletzt_aktiv < ? OR erstellt_am < ?', [jetzt(-SITZUNG_LEERLAUF), jetzt(-SITZUNG_HOECHSTENS)]);
    abfrage('DELETE FROM drosselung WHERE zeit < ?', [jetzt(-86400)]);
    abfrage('DELETE FROM tokens WHERE ablauf < ? AND zweck <> ?', [jetzt(-30 * 86400), 'einladung']);
    abfrage("UPDATE protokoll SET ip = '' WHERE zeit < ? AND ip <> ''", [jetzt(-PROTOKOLL_IP_TAGE * 86400)]);
    abfrage('DELETE FROM protokoll WHERE zeit < ?', [gmdate('Y-m-d H:i:s', strtotime('-' . PROTOKOLL_JAHRE . ' years'))]);

    // Bezugszeitpunkt: letzte Anmeldung, bei Wieder-Aktivierung deren Zeitpunkt
    $bezug = 'GREATEST(COALESCE(letzte_anmeldung, aktiviert_am, erstellt_am), COALESCE(aktiviert_am, erstellt_am))';
    $grenze = gmdate('Y-m-d H:i:s', strtotime('-' . INAKTIV_MONATE . ' months'));
    $warngrenze = gmdate('Y-m-d H:i:s', strtotime('-' . INAKTIV_MONATE . ' months +' . INAKTIV_WARNUNG_TAGE . ' days'));

    foreach (abfrage("SELECT * FROM benutzer WHERE status = 'aktiv' AND $bezug < ?", [$grenze])->fetchAll() as $b) {
        if ($b['rolle'] === 'admin' && anzahlAktiverAdmins() <= 1) {
            continue; // der letzte Administrator bleibt aktiv
        }
        abfrage("UPDATE benutzer SET status = 'deaktiviert' WHERE id = ?", [$b['id']]);
        sitzungenBeenden((int)$b['id']);
        protokoll('benutzer_deaktiviert', 'Konto ' . $b['email'] . ' automatisch deaktiviert (' . INAKTIV_MONATE . ' Monate ohne Anmeldung)', 'benutzer', (int)$b['id'], ['id' => null, 'vorname' => 'System', 'nachname' => '', 'email' => '']);
        $ergebnis['deaktiviert']++;
    }

    $bald = abfrage("SELECT * FROM benutzer WHERE status = 'aktiv' AND inaktiv_gewarnt_am IS NULL AND $bezug < ?", [$warngrenze])->fetchAll();
    if ($bald) {
        $zeilen = array_map(function ($b) {
            return '• ' . anzeigeName($b) . ' (' . $b['email'] . ', ' . (ROLLEN[$b['rolle']] ?? '') . ')';
        }, $bald);
        $admins = abfrage("SELECT * FROM benutzer WHERE rolle = 'admin' AND status = 'aktiv'")->fetchAll();
        foreach ($admins as $admin) {
            try {
                mailVorlage($admin['email'], 'Konten werden bald automatisch deaktiviert', 'Inaktive Konten', array_merge([
                    anrede($admin),
                    'Die folgenden Konten haben sich seit fast ' . INAKTIV_MONATE . ' Monaten nicht angemeldet. Sie werden in etwa ' . INAKTIV_WARNUNG_TAGE . ' Tagen automatisch deaktiviert:',
                ], $zeilen, [
                    'Meldet sich die Person vorher an, bleibt das Konto aktiv. Deaktivierte Konten können Sie in der Benutzerverwaltung wieder aktivieren.',
                ]), ['text' => 'Zur Benutzerverwaltung', 'url' => appLink('benutzer')]);
            } catch (Throwable $ex) {
                protokoll('mail_fehler', 'Warnung zu inaktiven Konten an ' . $admin['email'] . ' fehlgeschlagen: ' . $ex->getMessage(), null, null, $admin);
            }
        }
        foreach ($bald as $b) {
            abfrage('UPDATE benutzer SET inaktiv_gewarnt_am = ? WHERE id = ?', [jetzt(), $b['id']]);
        }
        $ergebnis['gewarnt'] = count($bald);
    }
    return $ergebnis;
}
