<?php
// Einziger Einstiegspunkt der Server-Schnittstelle: api/index.php?r=<route>
declare(strict_types=1);

$lib = dirname(__DIR__) . '/lib';
require $lib . '/basis.php';
require $lib . '/konten.php';
require $lib . '/mail.php';
require $lib . '/daten.php';
require $lib . '/benutzer.php';
require $lib . '/wartung.php';
require $lib . '/einrichtung.php';

header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

// Routen: Name => [Methode, öffentlich (ohne Anmeldung)]
const ROUTEN = [
    'status' => ['GET', true],
    'einrichten' => ['POST', true],
    'anmelden' => ['POST', true],
    'abmelden' => ['POST', true],
    'passwort-vergessen' => ['POST', true],
    'token-info' => ['POST', true],
    'einladung-annehmen' => ['POST', true],
    'passwort-zuruecksetzen' => ['POST', true],
    'email-bestaetigen' => ['POST', true],
    'wartung' => ['GET', true],
    'daten' => ['GET', false],
    'bild' => ['GET', false],
    'speichern' => ['POST', false],
    'loeschen' => ['POST', false],
    'beziehung' => ['POST', false],
    'versionen' => ['GET', false],
    'wiederherstellen' => ['POST', false],
    'geloescht' => ['GET', false],
    'konto' => ['POST', false],
    'passwort-aendern' => ['POST', false],
    'email-aendern' => ['POST', false],
    'ueberall-abmelden' => ['POST', false],
    'benutzer' => ['GET', false],
    'einladen' => ['POST', false],
    'einladung-erneut' => ['POST', false],
    'einladung-zurueckziehen' => ['POST', false],
    'benutzer-speichern' => ['POST', false],
    'benutzer-status' => ['POST', false],
    'benutzer-loeschen' => ['POST', false],
    'einstellungen' => ['GET', false],
    'einstellungen-speichern' => ['POST', false],
    'mail-test' => ['POST', false],
    'protokoll' => ['GET', false],
    'export' => ['GET', false],
    'import' => ['POST', false],
];

function sicherheitPruefen(string $route, bool $oeffentlich): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        return;
    }
    // Anfragen fremder Seiten abweisen: eigener Header (erzwingt CORS-Vorabprüfung) und passende Herkunft
    if (($_SERVER['HTTP_X_LERNWELT'] ?? '') !== '1') {
        throw new ApiFehler(403, 'Anfrage abgelehnt.');
    }
    $herkunft = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($herkunft !== '' && parse_url($herkunft, PHP_URL_HOST) !== parse_url('http://' . ($_SERVER['HTTP_HOST'] ?? ''), PHP_URL_HOST)) {
        throw new ApiFehler(403, 'Anfrage abgelehnt.');
    }
    if (!$oeffentlich) {
        $b = angemeldet();
        if (!hash_equals($b['csrf'], (string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            throw new ApiFehler(403, 'Die Sitzung ist nicht mehr gültig. Bitte laden Sie die Seite neu.');
        }
    }
}

function datenBearbeiter(): array
{
    $b = angemeldet();
    rechtePruefen($b, 'daten_bearbeiten');
    return $b;
}

function ausfuehren(string $route)
{
    $e = $_SERVER['REQUEST_METHOD'] === 'POST' ? eingabe() : [];
    switch ($route) {
        case 'status':
            $status = einrichtungStatus();
            if (!$status['eingerichtet']) {
                return $status;
            }
            if (wartungFaellig()) {
                try {
                    wartung();
                } catch (Throwable $ex) {
                    error_log('Wartung fehlgeschlagen: ' . $ex->getMessage());
                }
            }
            $b = aktuellerBenutzerOderNull();
            return ['eingerichtet' => true, 'appTitel' => einstellung('app_titel', 'R+V Lernwelt – Persona-Datenbank'), 'ich' => $b ? ich() : null];
        case 'einrichten':
            return einrichten($e);
        case 'anmelden':
            return ['ich' => anmelden($e)];
        case 'abmelden':
            abmelden();
            return ['ok' => true];
        case 'passwort-vergessen':
            passwortVergessen($e);
            return ['ok' => true];
        case 'token-info':
            return tokenInfo($e);
        case 'einladung-annehmen':
            return ['ich' => einladungAnnehmen($e)];
        case 'passwort-zuruecksetzen':
            return ['ich' => passwortZuruecksetzen($e)];
        case 'email-bestaetigen':
            return emailBestaetigen($e);
        case 'wartung':
            if (!hash_equals((string)(konfiguration()['cron_schluessel'] ?? ''), (string)($_GET['schluessel'] ?? '')) || empty(konfiguration()['cron_schluessel'])) {
                throw new ApiFehler(403, 'Anfrage abgelehnt.');
            }
            return wartung();

        case 'daten':
            angemeldet();
            return datenbestand();
        case 'bild':
            angemeldet();
            bildAusliefern((int)($_GET['id'] ?? 0));
            return null;
        case 'speichern':
            $b = datenBearbeiter();
            $typ = (string)($e['typ'] ?? '');
            typInfo($typ);
            $id = speichern($typ, $e, $b);
            return ['id' => $id, 'daten' => datenbestand()];
        case 'loeschen':
            $b = datenBearbeiter();
            loeschen((string)($e['typ'] ?? ''), (int)($e['id'] ?? 0), $b);
            return ['daten' => datenbestand()];
        case 'beziehung':
            $b = datenBearbeiter();
            beziehungAendern((int)($e['personaId'] ?? 0), (int)($e['andere'] ?? 0), text($e, 'verhaeltnis', 255), text($e, 'gegen', 255), !empty($e['entfernen']), $b);
            return ['daten' => datenbestand()];
        case 'versionen':
            angemeldet();
            return ['versionen' => versionenListe((string)($_GET['typ'] ?? ''), (int)($_GET['id'] ?? 0))];
        case 'wiederherstellen':
            $b = datenBearbeiter();
            $ziel = wiederherstellen((int)($e['versionId'] ?? 0), $b);
            return $ziel + ['daten' => datenbestand()];
        case 'geloescht':
            rechtePruefen(angemeldet(), 'einstellungen');
            return ['eintraege' => geloeschteListe()];

        case 'konto':
            return ['ich' => kontoSpeichern($e)];
        case 'passwort-aendern':
            passwortAendern($e);
            return ['ok' => true];
        case 'email-aendern':
            return emailAendern($e);
        case 'ueberall-abmelden':
            ueberallAbmelden();
            return ['ok' => true];

        case 'benutzer':
            return ['benutzer' => benutzerListe()];
        case 'einladen':
            return einladen($e);
        case 'einladung-erneut':
            return einladungErneut($e);
        case 'einladung-zurueckziehen':
            return einladungZurueckziehen($e);
        case 'benutzer-speichern':
            return benutzerSpeichern($e);
        case 'benutzer-status':
            return benutzerStatus($e);
        case 'benutzer-loeschen':
            return benutzerLoeschen($e);

        case 'einstellungen':
            return einstellungenLesen();
        case 'einstellungen-speichern':
            return einstellungenSpeichern($e);
        case 'mail-test':
            return mailTest($e);
        case 'protokoll':
            return protokollLesen($_GET);
        case 'export':
            rechtePruefen(angemeldet(), 'einstellungen');
            protokoll('exportiert', 'Datenbestand exportiert');
            return exportieren();
        case 'import':
            $b = angemeldet();
            rechtePruefen($b, 'einstellungen');
            return ['anzahl' => importieren($e, $b), 'daten' => datenbestand()];
    }
    throw new ApiFehler(404, 'Unbekannte Anfrage.');
}

try {
    $route = (string)($_GET['r'] ?? '');
    if (!isset(ROUTEN[$route])) {
        throw new ApiFehler(404, 'Unbekannte Anfrage.');
    }
    [$methode, $oeffentlich] = ROUTEN[$route];
    if ($_SERVER['REQUEST_METHOD'] !== $methode) {
        throw new ApiFehler(405, 'Methode nicht erlaubt.');
    }
    sicherheitPruefen($route, $oeffentlich);
    $ergebnis = ausfuehren($route);
    if ($ergebnis !== null) {
        antwort(['ok' => true] + $ergebnis);
    }
} catch (ApiFehler $f) {
    antwort(['ok' => false, 'meldung' => $f->getMessage()] + $f->extra, $f->status);
} catch (Throwable $t) {
    error_log('Persona-Datenbank: ' . $t->getMessage() . ' in ' . $t->getFile() . ':' . $t->getLine());
    antwort(['ok' => false, 'meldung' => 'Interner Fehler. Bitte versuchen Sie es später erneut.'], 500);
}
