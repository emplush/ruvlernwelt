<?php
// Galerie: Bilder je Persona hochladen, ansehen, herunterladen (einzeln oder als ZIP), beschreiben, löschen.
// Die Dateien liegen im Galerie-Ordner (Konfiguration "galerie_ordner", sonst webapp/daten/galerie),
// je Persona ein Unterordner, mit zufälligem Speichernamen. Ausgeliefert wird nur über api/index.php.
declare(strict_types=1);

const GALERIE_MAX_BYTES = 20 * 1024 * 1024;
const GALERIE_TYPEN = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
const GALERIE_VORSCHAU_KANTE = 480;
const GALERIE_ZIP_MAX = 500;

function galerieOrdner(): string
{
    $ordner = (string)(konfiguration()['galerie_ordner'] ?? '');
    if ($ordner === '') {
        $ordner = dirname(__DIR__) . '/daten/galerie';
    }
    $ordner = rtrim($ordner, '/\\');
    if (!is_dir($ordner) && !@mkdir($ordner, 0750, true) && !is_dir($ordner)) {
        throw new ApiFehler(500, 'Der Galerie-Ordner kann nicht angelegt werden. Bitte Schreibrechte prüfen (siehe Handbuch, Installation).');
    }
    return $ordner;
}

function galeriePfad(array $z, bool $vorschau = false): string
{
    $name = $z['speichername'];
    if ($vorschau) {
        $name = preg_replace('/\.[a-z]+$/', '', $name) . '_v.jpg';
    }
    return galerieOrdner() . '/' . (int)$z['persona_id'] . '/' . $name;
}

// "Ottmar Düring – Porträt (1).JPG" => "ottmar-duering-portraet-1"
function dateinameBereinigen(string $name): string
{
    $name = mb_strtolower(pathinfo(str_replace('\\', '/', $name), PATHINFO_FILENAME), 'UTF-8');
    $name = strtr($name, [
        'ä' => 'ae', 'ö' => 'oe', 'ü' => 'ue', 'ß' => 'ss',
        'á' => 'a', 'à' => 'a', 'â' => 'a', 'ã' => 'a', 'å' => 'a', 'æ' => 'ae', 'ç' => 'c', 'č' => 'c', 'ć' => 'c',
        'é' => 'e', 'è' => 'e', 'ê' => 'e', 'ë' => 'e', 'ě' => 'e', 'í' => 'i', 'ì' => 'i', 'î' => 'i', 'ï' => 'i',
        'ñ' => 'n', 'ń' => 'n', 'ó' => 'o', 'ò' => 'o', 'ô' => 'o', 'õ' => 'o', 'ø' => 'o', 'œ' => 'oe',
        'ś' => 's', 'š' => 's', 'ş' => 's', 'ú' => 'u', 'ù' => 'u', 'û' => 'u', 'ů' => 'u', 'ý' => 'y', 'ÿ' => 'y',
        'ž' => 'z', 'ź' => 'z', 'ż' => 'z', 'ł' => 'l', 'ř' => 'r', 'đ' => 'd',
    ]);
    $name = preg_replace('/[^a-z0-9]+/', '-', $name);
    $name = trim(substr((string)$name, 0, 80), '-');
    return $name !== '' ? $name : 'bild';
}

function galerieNameFrei(int $personaId, string $basis, string $endung): string
{
    $kandidat = $basis . '.' . $endung;
    for ($n = 2; wert('SELECT 1 FROM galerie WHERE persona_id = ? AND dateiname = ?', [$personaId, $kandidat]); $n++) {
        $kandidat = $basis . '-' . $n . '.' . $endung;
    }
    return $kandidat;
}

function galerieJson(array $z): array
{
    $basis = 'api/index.php?r=galerie-datei&id=' . (int)$z['id'];
    return [
        'id' => (int)$z['id'],
        'personaId' => (int)$z['persona_id'],
        'dateiname' => $z['dateiname'],
        'originalName' => $z['original_name'],
        'mime' => $z['mime'],
        'groesse' => (int)$z['groesse'],
        'breite' => (int)$z['breite'],
        'hoehe' => (int)$z['hoehe'],
        'beschreibung' => $z['beschreibung'],
        'hochgeladenAm' => iso($z['hochgeladen_am']),
        'hochgeladenVon' => $z['hochgeladen_von_name'],
        'url' => $basis,
        'vorschau' => $basis . '&art=vorschau',
        'download' => $basis . '&art=download',
    ];
}

function galerieListe(int $personaId): array
{
    return array_map('galerieJson', abfrage('SELECT * FROM galerie WHERE persona_id = ? ORDER BY hochgeladen_am DESC, id DESC', [$personaId])->fetchAll());
}

function galerieAnzahlen(): array
{
    $anzahl = [];
    foreach (abfrage('SELECT persona_id, COUNT(*) AS n FROM galerie GROUP BY persona_id')->fetchAll() as $z) {
        $anzahl[(int)$z['persona_id']] = (int)$z['n'];
    }
    return $anzahl;
}

function galerieStatistik(): array
{
    $z = zeile('SELECT COUNT(*) AS anzahl, COALESCE(SUM(groesse), 0) AS bytes, COUNT(DISTINCT persona_id) AS personas FROM galerie');
    return ['anzahl' => (int)$z['anzahl'], 'bytes' => (int)$z['bytes'], 'personas' => (int)$z['personas'], 'maxBytes' => GALERIE_MAX_BYTES];
}

function uploadFehlerText(int $code): string
{
    switch ($code) {
        case UPLOAD_ERR_INI_SIZE:
        case UPLOAD_ERR_FORM_SIZE:
            return 'Die Datei ist größer, als der Server annimmt (höchstens ' . (int)(GALERIE_MAX_BYTES / 1048576) . ' MB).';
        case UPLOAD_ERR_PARTIAL:
        case UPLOAD_ERR_NO_FILE:
            return 'Die Datei ist nicht vollständig angekommen. Bitte versuchen Sie es erneut.';
        default:
            return 'Die Datei konnte auf dem Server nicht gespeichert werden.';
    }
}

// Vorschaubild: bevorzugt vom Browser erzeugt (spart Speicher auf dem Server), sonst mit GD.
function galerieVorschauSpeichern(string $ziel, string $original, array $info): bool
{
    $v = $_FILES['vorschau'] ?? null;
    if ($v && ($v['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_OK && $v['size'] > 0 && $v['size'] <= 1024 * 1024) {
        $vi = @getimagesize($v['tmp_name']);
        if ($vi && $vi['mime'] === 'image/jpeg' && max($vi[0], $vi[1]) <= 2 * GALERIE_VORSCHAU_KANTE) {
            return move_uploaded_file($v['tmp_name'], $ziel);
        }
    }
    if (!function_exists('imagecreatefromstring') || $info[0] * $info[1] > 40000000) {
        return false;
    }
    $bild = @imagecreatefromstring((string)file_get_contents($original));
    if (!$bild) {
        return false;
    }
    $f = min(1, GALERIE_VORSCHAU_KANTE / max($info[0], $info[1]));
    $b = max(1, (int)round($info[0] * $f));
    $h = max(1, (int)round($info[1] * $f));
    $klein = imagecreatetruecolor($b, $h);
    imagefill($klein, 0, 0, imagecolorallocate($klein, 255, 255, 255));
    imagecopyresampled($klein, $bild, 0, 0, 0, 0, $b, $h, $info[0], $info[1]);
    $ok = imagejpeg($klein, $ziel, 82);
    imagedestroy($bild);
    imagedestroy($klein);
    return $ok;
}

function galerieHochladen(int $personaId, array $benutzer): array
{
    rechtePruefen($benutzer, 'galerie_bearbeiten');
    $p = zeile('SELECT id, vorname, name FROM personas WHERE id = ?', [$personaId]);
    if (!$p) {
        throw new ApiFehler(404, 'Persona nicht gefunden.');
    }
    drosseln('galerie:' . $benutzer['id'], 1000, 3600, 'Sie haben in kurzer Zeit sehr viele Bilder hochgeladen. Bitte warten Sie eine Weile.');
    $datei = $_FILES['datei'] ?? null;
    if (!$datei || is_array($datei['error'])) {
        throw new ApiFehler(400, empty($_POST) && empty($_FILES) && (int)($_SERVER['CONTENT_LENGTH'] ?? 0) > 0
            ? uploadFehlerText(UPLOAD_ERR_INI_SIZE) : 'Es wurde keine Datei übertragen.');
    }
    if ($datei['error'] !== UPLOAD_ERR_OK) {
        throw new ApiFehler(400, uploadFehlerText((int)$datei['error']));
    }
    if ($datei['size'] > GALERIE_MAX_BYTES) {
        throw new ApiFehler(400, uploadFehlerText(UPLOAD_ERR_INI_SIZE));
    }
    $info = @getimagesize($datei['tmp_name']);
    if (!$info || !isset(GALERIE_TYPEN[$info['mime']]) || $info[0] < 1 || $info[1] < 1) {
        throw new ApiFehler(400, 'Die Datei ist kein Bild im Format JPG, PNG, WebP oder GIF.');
    }
    $hash = hash_file('sha256', $datei['tmp_name']);
    $doppelt = zeile('SELECT dateiname FROM galerie WHERE persona_id = ? AND sha256 = ?', [$personaId, $hash]);
    if ($doppelt) {
        throw new ApiFehler(409, 'Dieses Bild ist bereits in der Galerie (' . $doppelt['dateiname'] . ').', ['doppelt' => true]);
    }
    $original = mb_substr((string)$datei['name'], 0, 255);
    $endung = GALERIE_TYPEN[$info['mime']];
    $speichername = bin2hex(random_bytes(16)) . '.' . $endung;
    $ordner = galerieOrdner() . '/' . $personaId;
    if (!is_dir($ordner) && !@mkdir($ordner, 0750, true) && !is_dir($ordner)) {
        throw new ApiFehler(500, 'Der Galerie-Ordner ist nicht beschreibbar.');
    }
    $ziel = $ordner . '/' . $speichername;
    if (!move_uploaded_file($datei['tmp_name'], $ziel)) {
        throw new ApiFehler(500, 'Die Datei konnte auf dem Server nicht gespeichert werden.');
    }
    $vorschauPfad = $ordner . '/' . preg_replace('/\.[a-z]+$/', '', $speichername) . '_v.jpg';
    $hatVorschau = galerieVorschauSpeichern($vorschauPfad, $ziel, $info);
    try {
        $id = transaktion(function () use ($personaId, $original, $endung, $speichername, $hatVorschau, $info, $datei, $hash, $benutzer) {
            $name = galerieNameFrei($personaId, dateinameBereinigen($original), $endung);
            abfrage(
                'INSERT INTO galerie (persona_id, dateiname, original_name, speichername, hat_vorschau, mime, groesse, breite, hoehe, sha256, hochgeladen_am, hochgeladen_von, hochgeladen_von_name)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [$personaId, $name, $original, $speichername, $hatVorschau ? 1 : 0, $info['mime'], (int)$datei['size'], $info[0], $info[1], $hash, jetzt(), $benutzer['id'], anzeigeName($benutzer)]
            );
            return (int)db()->lastInsertId();
        });
    } catch (Throwable $t) {
        @unlink($ziel);
        @unlink($vorschauPfad);
        throw $t;
    }
    $z = zeile('SELECT * FROM galerie WHERE id = ?', [$id]);
    protokoll('galerie_hochgeladen', 'Bild „' . $z['dateiname'] . '“ in die Galerie von ' . trim($p['vorname'] . ' ' . $p['name']) . ' hochgeladen', 'persona', $personaId, $benutzer);
    drosselungMerken('galerie:' . $benutzer['id']);
    return galerieJson($z);
}

function galerieDateiAusliefern(int $id, string $art): void
{
    $z = zeile('SELECT * FROM galerie WHERE id = ?', [$id]);
    if (!$z) {
        throw new ApiFehler(404, 'Bild nicht gefunden.');
    }
    $pfad = galeriePfad($z);
    $mime = $z['mime'];
    if ($art === 'vorschau' && (int)$z['hat_vorschau'] === 1 && is_file(galeriePfad($z, true))) {
        $pfad = galeriePfad($z, true);
        $mime = 'image/jpeg';
    }
    if (!is_file($pfad)) {
        throw new ApiFehler(404, 'Die Bilddatei fehlt auf dem Server.');
    }
    header('Content-Type: ' . $mime);
    header('Content-Length: ' . filesize($pfad));
    header('Cache-Control: private, max-age=604800, immutable');
    header("Content-Security-Policy: default-src 'none'; sandbox");
    header('Content-Disposition: ' . ($art === 'download' ? 'attachment' : 'inline') . '; filename="' . $z['dateiname'] . '"');
    readfile($pfad);
}

function galerieAuswahl(array $ids, ?int $personaId = null): array
{
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids))));
    if (!$ids) {
        throw new ApiFehler(400, 'Es sind keine Bilder ausgewählt.');
    }
    if (count($ids) > GALERIE_ZIP_MAX) {
        throw new ApiFehler(400, 'Bitte wählen Sie höchstens ' . GALERIE_ZIP_MAX . ' Bilder auf einmal.');
    }
    $sql = 'SELECT * FROM galerie WHERE id IN (' . implode(',', array_fill(0, count($ids), '?')) . ')';
    $werte = $ids;
    if ($personaId !== null) {
        $sql .= ' AND persona_id = ?';
        $werte[] = $personaId;
    }
    $zeilen = abfrage($sql . ' ORDER BY dateiname', $werte)->fetchAll();
    if (!$zeilen) {
        throw new ApiFehler(404, 'Die ausgewählten Bilder wurden nicht gefunden.');
    }
    return $zeilen;
}

function galerieZip(int $personaId, string $idListe): void
{
    $p = zeile('SELECT id, vorname, name, persona_id FROM personas WHERE id = ?', [$personaId]);
    if (!$p) {
        throw new ApiFehler(404, 'Persona nicht gefunden.');
    }
    if (!class_exists('ZipArchive')) {
        throw new ApiFehler(500, 'Der Server kann keine ZIP-Dateien erstellen (PHP-Erweiterung zip fehlt).');
    }
    $zeilen = galerieAuswahl(explode(',', $idListe), $personaId);
    @set_time_limit(300);
    $temp = tempnam(sys_get_temp_dir(), 'galerie');
    $zip = new ZipArchive();
    if ($zip->open($temp, ZipArchive::OVERWRITE) !== true) {
        throw new ApiFehler(500, 'Die ZIP-Datei konnte nicht erstellt werden.');
    }
    foreach ($zeilen as $z) {
        if (is_file(galeriePfad($z))) {
            $zip->addFile(galeriePfad($z), $z['dateiname']);
            $zip->setCompressionName($z['dateiname'], ZipArchive::CM_STORE); // Bilder sind bereits komprimiert
        }
    }
    $zip->close();
    $name = dateinameBereinigen(trim(($p['persona_id'] ?? '') . ' ' . $p['vorname'] . ' ' . $p['name'])) . '-bilder.zip';
    protokoll('galerie_zip', count($zeilen) . ' Bilder aus der Galerie von ' . trim($p['vorname'] . ' ' . $p['name']) . ' als ZIP heruntergeladen', 'persona', $personaId);
    header('Content-Type: application/zip');
    header('Content-Length: ' . filesize($temp));
    header('Content-Disposition: attachment; filename="' . $name . '"');
    readfile($temp);
    @unlink($temp);
}

function galerieLoeschen(array $ids, array $benutzer): int
{
    rechtePruefen($benutzer, 'galerie_bearbeiten');
    $zeilen = galerieAuswahl($ids);
    $proPersona = [];
    foreach ($zeilen as $z) {
        abfrage('DELETE FROM galerie WHERE id = ?', [(int)$z['id']]);
        @unlink(galeriePfad($z));
        @unlink(galeriePfad($z, true));
        $proPersona[(int)$z['persona_id']][] = $z['dateiname'];
    }
    foreach ($proPersona as $personaId => $namen) {
        $text = count($namen) === 1 ? 'Bild „' . $namen[0] . '“' : count($namen) . ' Bilder (' . implode(', ', array_slice($namen, 0, 5)) . (count($namen) > 5 ? ', …' : '') . ')';
        protokoll('galerie_geloescht', $text . ' aus der Galerie von ' . objektName('persona', $personaId) . ' gelöscht', 'persona', $personaId, $benutzer);
    }
    return count($zeilen);
}

function galerieBeschreiben(int $id, ?string $beschreibung, array $benutzer): array
{
    rechtePruefen($benutzer, 'galerie_bearbeiten');
    if (!zeile('SELECT id FROM galerie WHERE id = ?', [$id])) {
        throw new ApiFehler(404, 'Bild nicht gefunden.');
    }
    abfrage('UPDATE galerie SET beschreibung = ? WHERE id = ?', [$beschreibung, $id]);
    return galerieJson(zeile('SELECT * FROM galerie WHERE id = ?', [$id]));
}
