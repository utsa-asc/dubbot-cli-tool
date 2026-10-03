#!/bin/bash
# Rebuild manifest.json and mirror the dashboard data folder to the web server.
# Runs on the export computer after the daily exports finish.
#
# TODO: fill in DEST and the copy commands once the internal host is chosen.
set -euo pipefail

DATA_DIR="${DATA_DIR:-/Users/garza/Development-vpaa/dubbot-cli/dashboard/data}"
NODE="${NODE:-/opt/local/bin/node}"
CLI="$(cd "$(dirname "$0")/.." && pwd)/dist/index.js"

"$NODE" "$CLI" manifest --dir "$DATA_DIR"

# CSVs first, manifest last, so the page never sees a manifest that lists
# files that have not arrived yet.
# Linux/macOS over SSH:
#   rsync -a --exclude manifest.json "$DATA_DIR"/ host:/srv/dubbot/data/
#   rsync -a "$DATA_DIR"/manifest.json host:/srv/dubbot/data/
# Windows / IIS share:
#   robocopy "$DATA_DIR" '\\server\dubbot\data' /E /XF manifest.json
#   cp "$DATA_DIR"/manifest.json '\\server\dubbot\data\'
echo "publish: DEST not configured; manifest rebuilt only" >&2
