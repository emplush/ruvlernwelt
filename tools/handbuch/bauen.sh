#!/usr/bin/env bash
# Erzeugt die Bildschirmfotos für das Handbuch (webapp/handbuch/*.jpg) und webapp/handbuch.pdf.
# Voraussetzungen: PHP 8.1+ mit pdo_mysql, laufende MariaDB/MySQL (root über Socket),
# Node.js mit global installiertem Playwright und Chromium.
# Aufruf aus dem Repository-Wurzelordner: bash tools/handbuch/bauen.sh
set -euo pipefail
WURZEL=$(cd "$(dirname "$0")/../.." && pwd)
ARBEIT=$(mktemp -d)
PORT=8190
bash "$WURZEL/tools/test/test_starten.sh" "$ARBEIT" "$PORT" lernwelt_handbuch
trap 'kill $(cat "$ARBEIT/php.pid") 2>/dev/null || true' EXIT
NODE_PATH=$(npm root -g) node "$WURZEL/tools/handbuch/bauen.js" "http://127.0.0.1:$PORT/" "$WURZEL/webapp" "$ARBEIT"
