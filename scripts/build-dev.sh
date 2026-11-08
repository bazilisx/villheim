#!/usr/bin/env bash
# Builds both assemblies (Debug) and collects the files to deploy into one folder (with the Jint DLLs).
# Usage: scripts/build-dev.sh <output-dir>
set -euo pipefail
repo="$(cd "$(dirname "$0")/.." && pwd)"
out="${1:?output folder}"
mkdir -p "$out"
dotnet build "$repo/Villheim.sln" -c Debug -nologo -v q
cp "$repo/src/Villheim/bin/Debug/Villheim.dll" "$repo/src/Villheim/bin/Debug/Villheim.pdb" "$out/"
cp "$repo/src/Villheim.Logic/bin/Debug/Villheim.Logic.dll" "$repo/src/Villheim.Logic/bin/Debug/Villheim.Logic.pdb" "$out/"
# Jint and its helpers for 'vh gen'
cp "$repo"/src/Villheim.Logic/bin/Debug/{Jint,Acornima,System.Runtime.CompilerServices.Unsafe}.dll "$out/"
ls -la "$out"
