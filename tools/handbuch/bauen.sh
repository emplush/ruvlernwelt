#!/usr/bin/env bash
# Erzeugt die Bildschirmfotos für das Handbuch (webapp/handbuch/*.jpg) und webapp/handbuch.pdf.
# Voraussetzungen: Python 3, Node.js mit global installiertem Playwright und Chromium.
# Aufruf aus dem Repository-Wurzelordner: bash tools/handbuch/bauen.sh
set -euo pipefail
WURZEL=$(cd "$(dirname "$0")/../.." && pwd)
ARBEIT=$(mktemp -d)
cp -r "$WURZEL/webapp" "$ARBEIT/webapp"
python3 "$WURZEL/tools/handbuch/testserver.py" "$ARBEIT/webapp" 8190 > "$ARBEIT/server.log" 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null || true' EXIT
sleep 2
NODE_PATH=$(npm root -g) node "$WURZEL/tools/handbuch/bauen.js" "http://127.0.0.1:8190/" "$WURZEL/webapp" "$ARBEIT/webapp"
