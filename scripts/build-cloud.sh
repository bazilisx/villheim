#!/usr/bin/env bash
# Compile check for cloud sessions that cannot reach nuget.bepinex.dev (BepInEx.Core and UnityEngine.Modules 6000
# live only there). Fetches the other references from nuget.org and BepInEx from its GitHub release, then builds
# both projects against those DLLs with UnityEngine.Modules 2021.3 standing in for Unity 6. Good for catching
# compile errors; CI and scripts/deploy.ps1 make the DLLs that go in the game.
#
# Usage: scripts/build-cloud.sh [work dir]   (default /tmp/villheim-cloud-build)
# Output: <work dir>/logic/bin/Release/Villheim.Logic.dll
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
work="${1:-/tmp/villheim-cloud-build}"
refs="$work/refs"
mkdir -p "$refs" "$work/core" "$work/logic"

fetch() { # id version
  local dir="$refs/$1"
  if [ ! -d "$dir" ]; then
    curl -sSL -o "$refs/$1.nupkg" "https://api.nuget.org/v3-flatcontainer/$1/$2/$1.$2.nupkg"
    mkdir -p "$dir" && (cd "$dir" && unzip -qo "../$1.nupkg")
  fi
}

fetch digitalroot.valheim.common.references 1.0.22
fetch jotunnlib 2.30.2
fetch unityengine.modules 2021.3.33
if [ ! -d "$refs/bepinex" ]; then
  curl -sSL -o "$refs/bepinex.zip" https://github.com/BepInEx/BepInEx/releases/download/v5.4.21/BepInEx_x64_5.4.21.0.zip
  mkdir -p "$refs/bepinex" && (cd "$refs/bepinex" && unzip -qo ../bepinex.zip)
fi

cat > "$work/nuget.config" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<configuration><packageSources><clear /><add key="nuget.org" value="https://api.nuget.org/v3/index.json" /></packageSources></configuration>
EOF

cat > "$work/refs.props" <<EOF
<Project>
  <PropertyGroup>
    <TargetFramework>net48</TargetFramework><LangVersion>latest</LangVersion><Nullable>disable</Nullable>
    <AllowUnsafeBlocks>true</AllowUnsafeBlocks><NoWarn>\$(NoWarn);CS0618</NoWarn>
    <EnableDefaultCompileItems>false</EnableDefaultCompileItems>
    <AppendTargetFrameworkToOutputPath>false</AppendTargetFrameworkToOutputPath>
    <GenerateAssemblyInfo>false</GenerateAssemblyInfo>
  </PropertyGroup>
  <ItemGroup>
    <PackageReference Include="Microsoft.NETFramework.ReferenceAssemblies" Version="1.0.3" PrivateAssets="all" />
    <Reference Include="$refs/bepinex/BepInEx/core/BepInEx.dll" Private="false" />
    <Reference Include="$refs/bepinex/BepInEx/core/0Harmony.dll" Private="false" />
    <Reference Include="$refs/jotunnlib/lib/net462/Jotunn.dll" Private="false" />
    <Reference Include="$refs/digitalroot.valheim.common.references/ref/net48/*.dll" Private="false" />
    <Reference Include="$refs/unityengine.modules/lib/net35/*.dll" Private="false" />
  </ItemGroup>
</Project>
EOF

cat > "$work/core/Villheim.csproj" <<EOF
<Project Sdk="Microsoft.NET.Sdk">
  <Import Project="../refs.props" />
  <PropertyGroup><AssemblyName>Villheim</AssemblyName></PropertyGroup>
  <ItemGroup><Compile Include="$repo/src/Villheim/**/*.cs" Exclude="$repo/src/Villheim/obj/**;$repo/src/Villheim/bin/**" /></ItemGroup>
</Project>
EOF

cat > "$work/logic/Villheim.Logic.csproj" <<EOF
<Project Sdk="Microsoft.NET.Sdk">
  <Import Project="../refs.props" />
  <PropertyGroup><AssemblyName>Villheim.Logic</AssemblyName></PropertyGroup>
  <ItemGroup>
    <Compile Include="$repo/src/Villheim.Logic/**/*.cs" Exclude="$repo/src/Villheim.Logic/obj/**;$repo/src/Villheim.Logic/bin/**" />
    <EmbeddedResource Include="$repo/src/Villheim.Logic/Dialogue/*.txt" LogicalName="Villheim.Logic.Dialogue.%(Filename)%(Extension)" />
    <ProjectReference Include="../core/Villheim.csproj" Private="false" />
  </ItemGroup>
</Project>
EOF

cd "$work"
dotnet build logic/Villheim.Logic.csproj -c Release --configfile nuget.config -nologo
