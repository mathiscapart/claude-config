# Installe la config Claude partagée sur Windows : symlinke les fichiers du repo
# dans ~\.claude\. Idempotent. À lancer après `git clone` sur une nouvelle machine.
# Requiert : PowerShell en mode administrateur OU Developer Mode activé.
#   ! .\install.ps1

$ErrorActionPreference = "Stop"

$Repo   = $PSScriptRoot
$Claude = Join-Path $env:USERPROFILE ".claude"

New-Item -ItemType Directory -Force -Path $Claude | Out-Null

foreach ($item in @("CLAUDE.md", "agents", "settings.json")) {
    $target = Join-Path $Claude $item
    $source = Join-Path $Repo  $item

    # Sauvegarde si un fichier/dossier réel préexiste (pas déjà un symlink)
    if ((Test-Path $target) -and (-not ((Get-Item $target -Force).Attributes -band [IO.FileAttributes]::ReparsePoint))) {
        $bak = "$target.bak.$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
        Move-Item -Path $target -Destination $bak
        Write-Host "sauvegardé : $target -> $bak"
    }

    # Supprime le symlink existant avant de le recréer
    if (Test-Path $target) {
        Remove-Item -Path $target -Force
    }

    $kind = if (Test-Path $source -PathType Container) { "Junction" } else { "SymbolicLink" }
    New-Item -ItemType $kind -Path $target -Target $source | Out-Null
    Write-Host "symlink : $target -> $source"
}

Write-Host ""
Write-Host "OK. Config Claude installée depuis $Repo."
Write-Host "Secrets/overrides locaux : place-les dans $Claude\settings.local.json (non versionné)."
