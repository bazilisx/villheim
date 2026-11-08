#!/usr/bin/env bash
# Proves the in-game generator outside the game: the mod's LabEngine (Jint, the shipped DLLs) and node make the same
# .blueprint files for the same requests and seeds.
# Usage: tools/gen-test/run.sh [requests.txt] [tries]   (output in /tmp/vh-gen-test)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
list="$(cd "$(dirname "${1:-$here/requests.txt}")" && pwd)/$(basename "${1:-$here/requests.txt}")"
tries="${2:-8}"
out=/tmp/vh-gen-test
node "$here/../blueprint-lab/lib/build_engine.js"
(cd "$here" && dotnet run -c Release -- "$list" "$out/cs" "$tries")
(cd "$here/../blueprint-lab" && node lab/compare_engine.js "$list" "$out/cs" "$out/node" "$tries")
