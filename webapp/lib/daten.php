<?php
// Personas, Firmen, E-Learning-Formate: Lesen, Speichern, Löschen, Versionen, Bilder, Import/Export.
declare(strict_types=1);

// JSON-Feld => [Spalte, Typ, Länge, Pflicht]
const PERSONA_FELDER = [
    'personaId' => ['persona_id', 'int'],
    'vorname' => ['vorname', 'text', 100, true],
    'name' => ['name', 'text', 100, true],
    'gruppe' => ['gruppe', 'text', 100],
    'funktion' => ['funktion', 'text', 255],
    'kundenprofil' => ['kundenprofil', 'text', 100],
    'cJourney' => ['c_journey', 'text', 50],
    'geschlecht' => ['geschlecht', 'text', 50],
    'herkunft' => ['herkunft', 'text', 255],
    'geburtstag' => ['geburtstag', 'text', 50],
    'alter' => ['alter_jahre', 'int'],
    'strasse' => ['strasse', 'text', 255],
    'plz' => ['plz', 'text', 20],
    'ort' => ['ort', 'text', 255],
    'stadtteil' => ['stadtteil', 'text', 255],
    'beruf' => ['beruf', 'text', 255],
    'familienstand' => ['familienstand', 'text', 100],
    'wohnart' => ['wohnart', 'text', 255],
    'verwandt' => ['verwandt', 'text', 10000],
    'lebenslauf' => ['lebenslauf', 'text', 20000],
    'aktivitaeten' => ['aktivitaeten', 'text', 20000],
    'charakter' => ['charakter', 'text', 20000],
    'sonstiges' => ['sonstiges', 'text', 20000],
    'wocStimme' => ['woc_stimme', 'text', 255],
    'didAvatar' => ['did_avatar', 'text', 255],
    'bilderLink' => ['bilder_link', 'text', 2000],
];

const FIRMA_FELDER = [
    'firmenId' => ['firmen_id', 'int'],
    'name' => ['name', 'text', 255, true],
    'funktion' => ['funktion', 'text', 100],
    'branche' => ['branche', 'text', 255],
    'strasse' => ['strasse', 'text', 255],
    'plz' => ['plz', 'text', 20],
    'ort' => ['ort', 'text', 255],
    'sonstiges' => ['sonstiges', 'text', 20000],
];

const FORMAT_FELDER = [
    'formatId' => ['format_nr', 'int'],
    'name' => ['name', 'text', 255, true],
    'formatTyp' => ['format_typ', 'text', 50, true],
    'medienentwickler' => ['medienentwickler', 'text', 255, true],
    'link' => ['link', 'text', 2000],
    'httpLink' => ['http_link', 'text', 2000],
];

const TYPEN = [
    'persona' => ['tabelle' => 'personas', 'felder' => PERSONA_FELDER, 'name' => 'Persona'],
    'firma' => ['tabelle' => 'firmen', 'felder' => FIRMA_FELDER, 'name' => 'Firma'],
    'format' => ['tabelle' => 'formate', 'felder' => FORMAT_FELDER, 'name' => 'Format'],
];

function typInfo(string $typ): array
{
    if (!isset(TYPEN[$typ])) {
        throw new ApiFehler(400, 'Unbekannter Typ.');
    }
    return TYPEN[$typ];
}

function bildUrl($id): ?string
{
    return $id ? 'api/index.php?r=bild&id=' . (int)$id : null;
}

// Zeile aus der Datenbank => JSON-Objekt
function zeileNachJson(array $z, array $felder): array
{
    $j = ['id' => (int)$z['id']];
    foreach ($felder as $schluessel => $f) {
        $w = $z[$f[0]];
        $j[$schluessel] = $w === null ? null : ($f[1] === 'int' ? (int)$w : $w);
    }
    $j['version'] = (int)$z['version'];
    $j['erstelltAm'] = iso($z['erstellt_am']);
    $j['geaendertAm'] = iso($z['geaendert_am']);
    $j['geaendertVon'] = $z['geaendert_von_name'];
    return $j;
}

function datenbestand(): array
{
    $personas = [];
    foreach (abfrage('SELECT * FROM personas ORDER BY name, vorname')->fetchAll() as $z) {
        $p = zeileNachJson($z, PERSONA_FELDER);
        $p['bild'] = bildUrl($z['bild_id']);
        $p['bildGross'] = bildUrl($z['bild_gross_id']);
        $personas[] = $p;
    }
    $firmen = array_map(function ($z) {
        return zeileNachJson($z, FIRMA_FELDER);
    }, abfrage('SELECT * FROM firmen ORDER BY name')->fetchAll());
    $formate = array_map(function ($z) {
        return zeileNachJson($z, FORMAT_FELDER);
    }, abfrage('SELECT * FROM formate ORDER BY name')->fetchAll());
    return [
        'einstellungen' => ['appTitel' => einstellung('app_titel', 'R+V Lernwelt – Persona-Datenbank')],
        'personas' => $personas,
        'firmen' => $firmen,
        'formate' => $formate,
        'firmaPersonas' => array_map(function ($z) {
            return ['firmaId' => (int)$z['firma_id'], 'personaId' => (int)$z['persona_id'], 'funktionInFirma' => $z['funktion_in_firma']];
        }, abfrage('SELECT * FROM firma_personas')->fetchAll()),
        'beziehungen' => array_map(function ($z) {
            return ['personaId' => (int)$z['persona_id'], 'relatedPersonaId' => (int)$z['related_persona_id'], 'verhaeltnis' => $z['verhaeltnis']];
        }, abfrage('SELECT * FROM beziehungen')->fetchAll()),
        'formatPersonas' => array_map(function ($z) {
            return ['formatId' => (int)$z['format_id'], 'personaId' => (int)$z['persona_id']];
        }, abfrage('SELECT * FROM format_personas')->fetchAll()),
    ];
}

// Eingabe => Spaltenwerte (geprüft)
function felderLesen(array $daten, array $felder): array
{
    $werte = [];
    foreach ($felder as $schluessel => $f) {
        if ($f[1] === 'int') {
            $werte[$f[0]] = ganzzahl($daten, $schluessel);
        } else {
            $werte[$f[0]] = text($daten, $schluessel, $f[2], $f[3] ?? false);
        }
    }
    return $werte;
}

// ------------------------------------------------------------------
// Bilder
// ------------------------------------------------------------------
function bildAusEingabe($wert): ?int
{
    if ($wert === null || $wert === '') {
        return null;
    }
    if (!is_string($wert)) {
        throw new ApiFehler(400, 'Ungültiges Bild.');
    }
    if (preg_match('/[?&]id=(\d+)$/', $wert, $m)) {
        return wert('SELECT id FROM bilder WHERE id = ?', [(int)$m[1]]) ? (int)$m[1] : null;
    }
    if (preg_match('#^data:(image/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$#', $wert, $m)) {
        $bytes = base64_decode($m[2], true);
        return bildSpeichern($bytes === false ? '' : $bytes);
    }
    throw new ApiFehler(400, 'Ungültiges Bild.');
}

function bildSpeichern(string $bytes): int
{
    if ($bytes === '' || strlen($bytes) > 5 * 1024 * 1024) {
        throw new ApiFehler(400, 'Das Bild ist leer oder größer als 5 MB.');
    }
    $info = @getimagesizefromstring($bytes);
    if (!$info || !in_array($info['mime'], ['image/jpeg', 'image/png', 'image/webp'], true)) {
        throw new ApiFehler(400, 'Die Datei ist kein gültiges JPG-, PNG- oder WebP-Bild.');
    }
    abfrage('INSERT INTO bilder (mime, daten, erstellt_am) VALUES (?, ?, ?)', [$info['mime'], $bytes, jetzt()]);
    return (int)db()->lastInsertId();
}

function bildAusliefern(int $id): void
{
    $b = zeile('SELECT mime, daten FROM bilder WHERE id = ?', [$id]);
    if (!$b) {
        throw new ApiFehler(404, 'Bild nicht gefunden.');
    }
    header('Content-Type: ' . $b['mime']);
    header('Cache-Control: private, max-age=604800, immutable');
    header('Content-Length: ' . strlen($b['daten']));
    echo $b['daten'];
}

// ------------------------------------------------------------------
// Momentaufnahmen und Versionen
// ------------------------------------------------------------------
function momentaufnahme(string $typ, int $id): ?array
{
    $info = typInfo($typ);
    $z = zeile('SELECT * FROM ' . $info['tabelle'] . ' WHERE id = ?', [$id]);
    if (!$z) {
        return null;
    }
    $daten = zeileNachJson($z, $info['felder']);
    unset($daten['erstelltAm'], $daten['geaendertAm'], $daten['geaendertVon'], $daten['version']);
    if ($typ === 'persona') {
        $daten['bildId'] = $z['bild_id'] === null ? null : (int)$z['bild_id'];
        $daten['bildGrossId'] = $z['bild_gross_id'] === null ? null : (int)$z['bild_gross_id'];
        $daten['firmen'] = array_map(function ($r) {
            return ['firmaId' => (int)$r['firma_id'], 'funktionInFirma' => $r['funktion_in_firma']];
        }, abfrage('SELECT firma_id, funktion_in_firma FROM firma_personas WHERE persona_id = ? ORDER BY firma_id', [$id])->fetchAll());
        $daten['beziehungen'] = beziehungenVon($id);
        $daten['formate'] = array_map('intval', abfrage('SELECT format_id FROM format_personas WHERE persona_id = ? ORDER BY format_id', [$id])->fetchAll(PDO::FETCH_COLUMN));
    } elseif ($typ === 'firma') {
        $daten['personas'] = array_map(function ($r) {
            return ['personaId' => (int)$r['persona_id'], 'funktionInFirma' => $r['funktion_in_firma']];
        }, abfrage('SELECT persona_id, funktion_in_firma FROM firma_personas WHERE firma_id = ? ORDER BY persona_id', [$id])->fetchAll());
    } else {
        $daten['personas'] = array_map('intval', abfrage('SELECT persona_id FROM format_personas WHERE format_id = ? ORDER BY persona_id', [$id])->fetchAll(PDO::FETCH_COLUMN));
    }
    return $daten;
}

// Beziehungen einer Persona in beide Richtungen: [{andere, verhaeltnis, gegen}]
function beziehungenVon(int $id): array
{
    $liste = [];
    foreach (abfrage('SELECT related_persona_id, verhaeltnis FROM beziehungen WHERE persona_id = ?', [$id])->fetchAll() as $r) {
        $liste[(int)$r['related_persona_id']] = ['andere' => (int)$r['related_persona_id'], 'verhaeltnis' => $r['verhaeltnis'], 'gegen' => null];
    }
    foreach (abfrage('SELECT persona_id, verhaeltnis FROM beziehungen WHERE related_persona_id = ?', [$id])->fetchAll() as $r) {
        $andere = (int)$r['persona_id'];
        if (!isset($liste[$andere])) {
            $liste[$andere] = ['andere' => $andere, 'verhaeltnis' => null, 'gegen' => $r['verhaeltnis']];
        } else {
            $liste[$andere]['gegen'] = $r['verhaeltnis'];
        }
    }
    ksort($liste);
    return array_values($liste);
}

function versionMerken(string $typ, int $id, string $aktion, array $benutzer, ?array $daten = null): void
{
    $daten = $daten ?? momentaufnahme($typ, $id);
    $info = typInfo($typ);
    $version = (int)(wert('SELECT version FROM ' . $info['tabelle'] . ' WHERE id = ?', [$id]) ?? 0);
    abfrage(
        'INSERT INTO versionen (typ, objekt_id, version, aktion, daten, zeit, benutzer_id, benutzer_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [$typ, $id, $version, $aktion, json_encode($daten, JSON_UNESCAPED_UNICODE), jetzt(), $benutzer['id'], anzeigeName($benutzer)]
    );
}

function versionenListe(string $typ, int $id): array
{
    typInfo($typ);
    return array_map(function ($v) {
        return [
            'id' => (int)$v['id'], 'version' => (int)$v['version'], 'aktion' => $v['aktion'],
            'zeit' => iso($v['zeit']), 'benutzer' => $v['benutzer_name'], 'daten' => json_decode($v['daten'], true),
        ];
    }, abfrage('SELECT * FROM versionen WHERE typ = ? AND objekt_id = ? ORDER BY id DESC LIMIT 100', [$typ, $id])->fetchAll());
}

// Gelöschte Einträge, deren letzte Version "geloescht" ist
function geloeschteListe(): array
{
    $liste = [];
    $zeilen = abfrage(
        "SELECT v.* FROM versionen v JOIN (SELECT typ, objekt_id, MAX(id) AS max_id FROM versionen GROUP BY typ, objekt_id) m ON m.max_id = v.id WHERE v.aktion = 'geloescht' ORDER BY v.id DESC LIMIT 200"
    )->fetchAll();
    foreach ($zeilen as $v) {
        $info = typInfo($v['typ']);
        if (wert('SELECT id FROM ' . $info['tabelle'] . ' WHERE id = ?', [$v['objekt_id']])) {
            continue;
        }
        $d = json_decode($v['daten'], true);
        $liste[] = [
            'versionId' => (int)$v['id'], 'typ' => $v['typ'], 'typName' => $info['name'],
            'name' => $v['typ'] === 'persona' ? trim(($d['vorname'] ?? '') . ' ' . ($d['name'] ?? '')) : ($d['name'] ?? ''),
            'zeit' => iso($v['zeit']), 'benutzer' => $v['benutzer_name'],
        ];
    }
    return $liste;
}

// ------------------------------------------------------------------
// Speichern
// ------------------------------------------------------------------
function zeitstempelSpalten(array $benutzer): array
{
    return ['geaendert_am' => jetzt(), 'geaendert_von' => $benutzer['id'], 'geaendert_von_name' => anzeigeName($benutzer)];
}

// Legt an oder aktualisiert; bei $erzwungeneId (Wiederherstellen) wird diese ID verwendet
function zeileSchreiben(string $tabelle, ?int $id, ?int $version, array $werte, array $benutzer, ?int $erzwungeneId = null): int
{
    $werte += zeitstempelSpalten($benutzer);
    if ($id !== null) {
        $sets = implode(', ', array_map(function ($s) {
            return $s . ' = ?';
        }, array_keys($werte)));
        $sql = 'UPDATE ' . $tabelle . ' SET ' . $sets . ', version = version + 1 WHERE id = ?';
        $param = array_merge(array_values($werte), [$id]);
        if ($version !== null) {
            $sql .= ' AND version = ?';
            $param[] = $version;
        }
        $st = abfrage($sql, $param);
        if ($st->rowCount() === 0) {
            if (!wert('SELECT id FROM ' . $tabelle . ' WHERE id = ?', [$id])) {
                throw new ApiFehler(404, 'Der Eintrag existiert nicht mehr.');
            }
            throw new ApiFehler(409, 'Der Eintrag wurde inzwischen von jemand anderem geändert. Laden Sie die Seite neu und wiederholen Sie Ihre Änderung.', ['konflikt' => true]);
        }
        return $id;
    }
    $werte['erstellt_am'] = jetzt();
    if ($erzwungeneId !== null) {
        $werte = ['id' => $erzwungeneId] + $werte;
    }
    $spalten = array_keys($werte);
    abfrage('INSERT INTO ' . $tabelle . ' (' . implode(', ', $spalten) . ') VALUES (' . implode(', ', array_fill(0, count($spalten), '?')) . ')', array_values($werte));
    return $erzwungeneId ?? (int)db()->lastInsertId();
}

function personaIdFrei(?int $personaId, ?int $eigeneId): void
{
    if ($personaId === null) {
        return;
    }
    $andere = wert('SELECT id FROM personas WHERE persona_id = ?', [$personaId]);
    if ($andere && (int)$andere !== $eigeneId) {
        throw new ApiFehler(400, 'Die Persona-ID ' . $personaId . ' ist bereits vergeben.');
    }
}

function existiert(string $tabelle, int $id): bool
{
    return (bool)wert('SELECT id FROM ' . $tabelle . ' WHERE id = ?', [$id]);
}

function personaSchreiben(array $e, array $benutzer, string $aktion = '', ?int $erzwungeneId = null): int
{
    $id = isset($e['id']) && $erzwungeneId === null ? (int)$e['id'] : null;
    $daten = is_array($e['daten'] ?? null) ? $e['daten'] : [];
    $werte = felderLesen($daten, PERSONA_FELDER);
    personaIdFrei($werte['persona_id'], $id ?? $erzwungeneId);
    if (array_key_exists('bildId', $daten)) {
        $werte['bild_id'] = $daten['bildId'] && existiert('bilder', (int)$daten['bildId']) ? (int)$daten['bildId'] : null;
        $werte['bild_gross_id'] = $daten['bildGrossId'] && existiert('bilder', (int)$daten['bildGrossId']) ? (int)$daten['bildGrossId'] : null;
    } else {
        $werte['bild_id'] = bildAusEingabe($daten['bild'] ?? null);
        $werte['bild_gross_id'] = bildAusEingabe($daten['bildGross'] ?? null);
    }
    $vorhandenVorher = $erzwungeneId !== null && existiert('personas', $erzwungeneId);
    $id = zeileSchreiben('personas', $vorhandenVorher ? $erzwungeneId : $id, $erzwungeneId === null ? ganzzahl($e, 'version') : null, $werte, $benutzer, $vorhandenVorher ? null : $erzwungeneId);

    if (isset($e['firmen']) && is_array($e['firmen'])) {
        abfrage('DELETE FROM firma_personas WHERE persona_id = ?', [$id]);
        $gesehen = [];
        foreach ($e['firmen'] as $f) {
            $fid = (int)($f['firmaId'] ?? 0);
            if ($fid && !isset($gesehen[$fid]) && existiert('firmen', $fid)) {
                $gesehen[$fid] = true;
                abfrage('INSERT INTO firma_personas (firma_id, persona_id, funktion_in_firma) VALUES (?, ?, ?)', [$fid, $id, text($f, 'funktionInFirma', 255)]);
            }
        }
    }
    if (isset($e['beziehungen']) && is_array($e['beziehungen'])) {
        abfrage('DELETE FROM beziehungen WHERE persona_id = ? OR related_persona_id = ?', [$id, $id]);
        foreach ($e['beziehungen'] as $b) {
            $andere = (int)($b['andere'] ?? 0);
            if (!$andere || $andere === $id || !existiert('personas', $andere)) {
                continue;
            }
            $verhaeltnis = text($b, 'verhaeltnis', 255);
            $gegen = text($b, 'gegen', 255);
            // Nur Gegenrichtung bekannt: keine leere Hinrichtung anlegen
            if ($verhaeltnis !== null || $gegen === null) {
                abfrage('INSERT IGNORE INTO beziehungen (persona_id, related_persona_id, verhaeltnis) VALUES (?, ?, ?)', [$id, $andere, $verhaeltnis]);
            }
            if ($gegen !== null) {
                abfrage('INSERT IGNORE INTO beziehungen (persona_id, related_persona_id, verhaeltnis) VALUES (?, ?, ?)', [$andere, $id, $gegen]);
            }
        }
    }
    if (isset($e['formate']) && is_array($e['formate'])) {
        abfrage('DELETE FROM format_personas WHERE persona_id = ?', [$id]);
        foreach (array_unique(array_map('intval', $e['formate'])) as $fid) {
            if ($fid && existiert('formate', $fid)) {
                abfrage('INSERT INTO format_personas (format_id, persona_id) VALUES (?, ?)', [$fid, $id]);
            }
        }
    }
    return $id;
}

function firmaSchreiben(array $e, array $benutzer, ?int $erzwungeneId = null): int
{
    $id = isset($e['id']) && $erzwungeneId === null ? (int)$e['id'] : null;
    $werte = felderLesen(is_array($e['daten'] ?? null) ? $e['daten'] : [], FIRMA_FELDER);
    $vorhandenVorher = $erzwungeneId !== null && existiert('firmen', $erzwungeneId);
    $id = zeileSchreiben('firmen', $vorhandenVorher ? $erzwungeneId : $id, $erzwungeneId === null ? ganzzahl($e, 'version') : null, $werte, $benutzer, $vorhandenVorher ? null : $erzwungeneId);
    if (isset($e['personas']) && is_array($e['personas'])) {
        abfrage('DELETE FROM firma_personas WHERE firma_id = ?', [$id]);
        $gesehen = [];
        foreach ($e['personas'] as $p) {
            $pid = (int)($p['personaId'] ?? 0);
            if ($pid && !isset($gesehen[$pid]) && existiert('personas', $pid)) {
                $gesehen[$pid] = true;
                abfrage('INSERT INTO firma_personas (firma_id, persona_id, funktion_in_firma) VALUES (?, ?, ?)', [$id, $pid, text($p, 'funktionInFirma', 255)]);
            }
        }
    }
    return $id;
}

function formatSchreiben(array $e, array $benutzer, ?int $erzwungeneId = null): int
{
    $id = isset($e['id']) && $erzwungeneId === null ? (int)$e['id'] : null;
    $daten = is_array($e['daten'] ?? null) ? $e['daten'] : [];
    $werte = felderLesen($daten, FORMAT_FELDER);
    if (!in_array($werte['format_typ'], ['Lernprogramm', 'Video', 'Podcast'], true)) {
        throw new ApiFehler(400, 'Unbekannter Format-Typ.');
    }
    if ($werte['format_nr'] !== null && ($werte['format_nr'] < 0 || $werte['format_nr'] > 999)) {
        throw new ApiFehler(400, 'Die ID muss zwischen 0 und 999 liegen.');
    }
    $vorhandenVorher = $erzwungeneId !== null && existiert('formate', $erzwungeneId);
    $id = zeileSchreiben('formate', $vorhandenVorher ? $erzwungeneId : $id, $erzwungeneId === null ? ganzzahl($e, 'version') : null, $werte, $benutzer, $vorhandenVorher ? null : $erzwungeneId);
    if (isset($e['personas']) && is_array($e['personas'])) {
        abfrage('DELETE FROM format_personas WHERE format_id = ?', [$id]);
        foreach (array_unique(array_map('intval', $e['personas'])) as $pid) {
            if ($pid && existiert('personas', $pid)) {
                abfrage('INSERT INTO format_personas (format_id, persona_id) VALUES (?, ?)', [$id, $pid]);
            }
        }
    }
    return $id;
}

function objektName(string $typ, int $id): string
{
    $info = typInfo($typ);
    $z = zeile('SELECT * FROM ' . $info['tabelle'] . ' WHERE id = ?', [$id]);
    if (!$z) {
        return '#' . $id;
    }
    return $typ === 'persona' ? $z['vorname'] . ' ' . $z['name'] : $z['name'];
}

function speichern(string $typ, array $e, array $benutzer): int
{
    return transaktion(function () use ($typ, $e, $benutzer) {
        $neu = empty($e['id']);
        if ($typ === 'persona') {
            $id = personaSchreiben($e, $benutzer);
        } elseif ($typ === 'firma') {
            $id = firmaSchreiben($e, $benutzer);
        } else {
            $id = formatSchreiben($e, $benutzer);
        }
        versionMerken($typ, $id, $neu ? 'angelegt' : 'geaendert', $benutzer);
        protokoll($neu ? 'angelegt' : 'geaendert', typInfo($typ)['name'] . ' „' . objektName($typ, $id) . '“ ' . ($neu ? 'angelegt' : 'geändert'), $typ, $id, $benutzer);
        return $id;
    });
}

function loeschen(string $typ, int $id, array $benutzer): void
{
    transaktion(function () use ($typ, $id, $benutzer) {
        $info = typInfo($typ);
        $daten = momentaufnahme($typ, $id);
        if (!$daten) {
            throw new ApiFehler(404, 'Der Eintrag existiert nicht mehr.');
        }
        $name = objektName($typ, $id);
        versionMerken($typ, $id, 'geloescht', $benutzer, $daten);
        abfrage('DELETE FROM ' . $info['tabelle'] . ' WHERE id = ?', [$id]);
        if ($typ === 'persona') {
            abfrage('DELETE FROM firma_personas WHERE persona_id = ?', [$id]);
            abfrage('DELETE FROM format_personas WHERE persona_id = ?', [$id]);
            abfrage('DELETE FROM beziehungen WHERE persona_id = ? OR related_persona_id = ?', [$id, $id]);
        } elseif ($typ === 'firma') {
            abfrage('DELETE FROM firma_personas WHERE firma_id = ?', [$id]);
        } else {
            abfrage('DELETE FROM format_personas WHERE format_id = ?', [$id]);
        }
        protokoll('geloescht', $info['name'] . ' „' . $name . '“ gelöscht', $typ, $id, $benutzer);
    });
}

function wiederherstellen(int $versionId, array $benutzer): array
{
    return transaktion(function () use ($versionId, $benutzer) {
        $v = zeile('SELECT * FROM versionen WHERE id = ?', [$versionId]);
        if (!$v) {
            throw new ApiFehler(404, 'Version nicht gefunden.');
        }
        $typ = $v['typ'];
        $id = (int)$v['objekt_id'];
        $d = json_decode($v['daten'], true);
        $eingabe = ['daten' => $d];
        if ($typ === 'persona') {
            $eingabe += ['firmen' => $d['firmen'] ?? [], 'beziehungen' => $d['beziehungen'] ?? [], 'formate' => $d['formate'] ?? []];
            personaSchreiben($eingabe, $benutzer, '', $id);
        } elseif ($typ === 'firma') {
            $eingabe['personas'] = $d['personas'] ?? [];
            firmaSchreiben($eingabe, $benutzer, $id);
        } else {
            $eingabe['personas'] = $d['personas'] ?? [];
            formatSchreiben($eingabe, $benutzer, $id);
        }
        versionMerken($typ, $id, 'wiederhergestellt', $benutzer);
        protokoll('wiederhergestellt', typInfo($typ)['name'] . ' „' . objektName($typ, $id) . '“ auf Stand vom ' . substr($v['zeit'], 0, 16) . ' UTC zurückgesetzt', $typ, $id, $benutzer);
        return ['typ' => $typ, 'id' => $id];
    });
}

function beziehungAendern(int $personaId, int $andere, ?string $verhaeltnis, ?string $gegen, bool $entfernen, array $benutzer): void
{
    transaktion(function () use ($personaId, $andere, $verhaeltnis, $gegen, $entfernen, $benutzer) {
        if (!existiert('personas', $personaId) || !existiert('personas', $andere) || $personaId === $andere) {
            throw new ApiFehler(400, 'Ungültige Persona.');
        }
        if ($entfernen) {
            abfrage('DELETE FROM beziehungen WHERE (persona_id = ? AND related_persona_id = ?) OR (persona_id = ? AND related_persona_id = ?)', [$personaId, $andere, $andere, $personaId]);
        } else {
            abfrage('INSERT INTO beziehungen (persona_id, related_persona_id, verhaeltnis) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE verhaeltnis = VALUES(verhaeltnis)', [$personaId, $andere, $verhaeltnis]);
            if ($gegen !== null) {
                abfrage('INSERT INTO beziehungen (persona_id, related_persona_id, verhaeltnis) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE verhaeltnis = VALUES(verhaeltnis)', [$andere, $personaId, $gegen]);
            }
        }
        $werte = zeitstempelSpalten($benutzer);
        abfrage('UPDATE personas SET geaendert_am = ?, geaendert_von = ?, geaendert_von_name = ?, version = version + 1 WHERE id = ?', [$werte['geaendert_am'], $werte['geaendert_von'], $werte['geaendert_von_name'], $personaId]);
        versionMerken('persona', $personaId, 'geaendert', $benutzer);
        protokoll('geaendert', 'Familienbeziehung ' . objektName('persona', $personaId) . ' – ' . objektName('persona', $andere) . ($entfernen ? ' entfernt' : ' hinzugefügt'), 'persona', $personaId, $benutzer);
    });
}

// ------------------------------------------------------------------
// Export und Import (vollständiger Datenbestand inkl. Bilder)
// ------------------------------------------------------------------
function exportieren(): array
{
    $d = datenbestand();
    $bilder = [];
    foreach (abfrage('SELECT id, mime, daten FROM bilder WHERE id IN (SELECT bild_id FROM personas UNION SELECT bild_gross_id FROM personas)')->fetchAll() as $b) {
        $bilder[(int)$b['id']] = 'data:' . $b['mime'] . ';base64,' . base64_encode($b['daten']);
    }
    foreach ($d['personas'] as &$p) {
        foreach (['bild', 'bildGross'] as $feld) {
            if ($p[$feld] && preg_match('/id=(\d+)$/', $p[$feld], $m)) {
                $p[$feld] = $bilder[(int)$m[1]] ?? null;
            }
        }
    }
    unset($p);
    $d['schema'] = 2;
    $d['exportiertAm'] = iso(jetzt());
    return $d;
}

// Ersetzt den kompletten Datenbestand. $bildOrdner erlaubt Pfade wie "bilder/1004.jpg" (Startdaten).
function importieren(array $d, array $benutzer, ?string $bildOrdner = null): array
{
    if (!isset($d['personas']) || !is_array($d['personas'])) {
        throw new ApiFehler(400, 'Die Datei enthält keine Persona-Daten.');
    }
    return transaktion(function () use ($d, $benutzer, $bildOrdner) {
        foreach (['format_personas', 'firma_personas', 'beziehungen', 'personas', 'firmen', 'formate'] as $t) {
            abfrage('DELETE FROM ' . $t);
        }
        $bildLaden = function ($wert) use ($bildOrdner) {
            if (is_string($wert) && $bildOrdner && preg_match('#^bilder/([A-Za-z0-9_-]+\.(?:jpg|png))$#', $wert, $m) && is_file($bildOrdner . '/' . $m[1])) {
                return bildSpeichern((string)file_get_contents($bildOrdner . '/' . $m[1]));
            }
            if (is_string($wert) && strpos($wert, 'data:') === 0) {
                return bildAusEingabe($wert);
            }
            return null;
        };
        foreach ($d['firmen'] ?? [] as $f) {
            firmaSchreiben(['daten' => $f], $benutzer, (int)$f['id']);
        }
        foreach ($d['formate'] ?? [] as $f) {
            formatSchreiben(['daten' => $f + ['formatTyp' => 'Lernprogramm']], $benutzer, (int)$f['id']);
        }
        foreach ($d['personas'] as $p) {
            $p['bildId'] = $bildLaden($p['bild'] ?? null);
            $p['bildGrossId'] = $bildLaden($p['bildGross'] ?? null);
            personaSchreiben(['daten' => $p], $benutzer, '', (int)$p['id']);
        }
        foreach ($d['firmaPersonas'] ?? [] as $fp) {
            if (existiert('firmen', (int)$fp['firmaId']) && existiert('personas', (int)$fp['personaId'])) {
                abfrage('INSERT IGNORE INTO firma_personas (firma_id, persona_id, funktion_in_firma) VALUES (?, ?, ?)', [(int)$fp['firmaId'], (int)$fp['personaId'], $fp['funktionInFirma'] ?? null]);
            }
        }
        foreach ($d['beziehungen'] ?? [] as $b) {
            if (existiert('personas', (int)$b['personaId']) && existiert('personas', (int)$b['relatedPersonaId'])) {
                abfrage('INSERT IGNORE INTO beziehungen (persona_id, related_persona_id, verhaeltnis) VALUES (?, ?, ?)', [(int)$b['personaId'], (int)$b['relatedPersonaId'], $b['verhaeltnis'] ?? null]);
            }
        }
        foreach ($d['formatPersonas'] ?? [] as $fp) {
            if (existiert('formate', (int)$fp['formatId']) && existiert('personas', (int)$fp['personaId'])) {
                abfrage('INSERT IGNORE INTO format_personas (format_id, persona_id) VALUES (?, ?)', [(int)$fp['formatId'], (int)$fp['personaId']]);
            }
        }
        if (!empty($d['einstellungen']['appTitel'])) {
            einstellungSetzen('app_titel', mb_substr((string)$d['einstellungen']['appTitel'], 0, 120));
        }
        foreach (['persona' => 'personas', 'firma' => 'firmen', 'format' => 'formate'] as $typ => $tabelle) {
            foreach (abfrage('SELECT id FROM ' . $tabelle)->fetchAll(PDO::FETCH_COLUMN) as $id) {
                versionMerken($typ, (int)$id, 'importiert', $benutzer);
            }
        }
        $anzahl = ['personas' => (int)wert('SELECT COUNT(*) FROM personas'), 'firmen' => (int)wert('SELECT COUNT(*) FROM firmen'), 'formate' => (int)wert('SELECT COUNT(*) FROM formate')];
        protokoll('importiert', 'Datenbestand importiert: ' . $anzahl['personas'] . ' Personas, ' . $anzahl['firmen'] . ' Firmen, ' . $anzahl['formate'] . ' Formate', null, null, $benutzer);
        return $anzahl;
    });
}
