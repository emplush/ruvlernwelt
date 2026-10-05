<?php
// Vorlage für die Konfiguration. Kopieren als "konfiguration.php" (im selben Ordner)
// oder – besser – als "lernwelt-konfiguration.php" eine Ebene ÜBER dem Web-Verzeichnis.
// Die Datei enthält Zugangsdaten und gehört nie ins Repository.
return [
    // Datenbank aus dem ALL-INKL-KAS (Datenbanken → Datenbank anlegen)
    'db' => [
        'host' => 'localhost',
        'port' => 3306,
        'name' => 'd0xxxxxx',
        'benutzer' => 'd0xxxxxx',
        'passwort' => 'HIER-DAS-DATENBANK-PASSWORT',
    ],

    // Adresse der Anwendung, wie sie in E-Mail-Links erscheinen soll (mit https://, ohne # am Ende)
    'basis_url' => 'https://www.ruv-lernwelt.de',

    // Läuft die Seite über HTTPS? Nur für lokale Tests auf false setzen.
    'https' => true,

    // Zufälliger Schlüssel (64 Hex-Zeichen), verschlüsselt u. a. das SMTP-Passwort.
    // Erzeugen z. B. mit: php -r "echo bin2hex(random_bytes(32));"
    // Nach der Einrichtung nicht mehr ändern, sonst muss das SMTP-Passwort neu eingegeben werden.
    'schluessel' => 'HIER-64-HEX-ZEICHEN',

    // Einmaliger Code für die Erst-Einrichtung (beliebiger langer Zufallstext)
    'einrichtungs_code' => 'HIER-EIN-LANGER-ZUFALLSTEXT',

    // E-Mail-Adresse des ersten Administrators
    'erster_admin' => 'michael.herget@ruv.de',

    // Schlüssel für den täglichen Cronjob: https://…/api/index.php?r=wartung&schluessel=…
    'cron_schluessel' => 'HIER-EIN-WEITERER-ZUFALLSTEXT',

    // Ordner für die Galerie-Bilder. Leer lassen = webapp/daten/galerie (per .htaccess gesperrt).
    // Besser außerhalb des Web-Verzeichnisses, z. B. '/www/htdocs/w0123456/lernwelt-galerie'.
    'galerie_ordner' => '',

    // Neue Passwörter gegen bekannte Datenlecks prüfen (Have I Been Pwned, k-Anonymität)
    'hibp' => true,
];
