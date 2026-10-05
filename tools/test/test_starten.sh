#!/usr/bin/env bash
# Startet eine frische Testumgebung: Kopie von webapp/, leere MariaDB-Datenbank, PHP-Server.
# Aufruf: bash tools/test/test_starten.sh <arbeitsordner> <port> [datenbank]
# Danach: Einrichtung per API (Code code-123-test) oder im Browser unter http://127.0.0.1:<port>/
# Voraussetzungen: php (8.1+) mit pdo_mysql, laufende MariaDB/MySQL mit root-Zugang über Socket.
set -euo pipefail
WURZEL=$(cd "$(dirname "$0")/../.." && pwd)
ZIEL=$1
PORT=$2
DB=${3:-lernwelt_test}

rm -rf "$ZIEL" && mkdir -p "$ZIEL"
cp -r "$WURZEL/webapp" "$ZIEL/webapp"
mysql -uroot -e "DROP DATABASE IF EXISTS \`$DB\`; CREATE DATABASE \`$DB\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'lernwelt'@'localhost' IDENTIFIED BY 'testpass';
  CREATE USER IF NOT EXISTS 'lernwelt'@'127.0.0.1' IDENTIFIED BY 'testpass';
  GRANT ALL ON \`$DB\`.* TO 'lernwelt'@'localhost'; GRANT ALL ON \`$DB\`.* TO 'lernwelt'@'127.0.0.1'; FLUSH PRIVILEGES;"
cat > "$ZIEL/webapp/konfiguration.php" <<EOF
<?php
return [
  'db' => ['host' => '127.0.0.1', 'port' => 3306, 'name' => '$DB', 'benutzer' => 'lernwelt', 'passwort' => 'testpass'],
  'basis_url' => 'http://127.0.0.1:$PORT',
  'https' => false,
  'schluessel' => '$(php -r 'echo bin2hex(random_bytes(32));')',
  'einrichtungs_code' => 'code-123-test',
  'erster_admin' => 'michael.herget@ruv.de',
  'cron_schluessel' => 'cron-test',
  'hibp' => false,
  'mail_protokoll' => '$ZIEL/mails.jsonl',
];
EOF
: > "$ZIEL/mails.jsonl"
php -S "127.0.0.1:$PORT" -t "$ZIEL/webapp" > "$ZIEL/php.log" 2>&1 &
echo $! > "$ZIEL/php.pid"
sleep 1
echo "Testserver läuft: http://127.0.0.1:$PORT/ (PID $(cat "$ZIEL/php.pid"), Mails in $ZIEL/mails.jsonl)"
