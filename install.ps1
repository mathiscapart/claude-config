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

# Hooks Orca : restent dans le settings.json local, jamais dans le repo (voir .gitattributes)
git -C $Repo config filter.strip-orca-hooks.clean "node scripts/strip-orca-hooks.js"

# Skills : on symlinke skill par skill, pour ne pas écraser ceux d'autres outils
$SkillsDir = Join-Path $Claude "skills"
New-Item -ItemType Directory -Force -Path $SkillsDir | Out-Null
foreach ($skill in (Get-ChildItem (Join-Path $Repo "skills") -Directory -ErrorAction SilentlyContinue)) {
    $target = Join-Path $SkillsDir $skill.Name
    if (Test-Path $target) { Remove-Item -Path $target -Recurse -Force }
    New-Item -ItemType Junction -Path $target -Target $skill.FullName | Out-Null
    Write-Host "symlink : $target -> $($skill.FullName)"
}

# Serveurs MCP (stockés dans ~\.claude.json, non versionnable : on les rejoue)
Write-Host ""
Write-Host "Serveurs MCP a ajouter sur une nouvelle machine :"
Write-Host '  claude mcp add -s user -t http context7 "https://mcp.context7.com/mcp?client=claude-code"'
Write-Host '  claude mcp add -s user playwright -- docker run -i --rm --init --shm-size=1g --add-host=host.docker.internal:host-gateway mcr.microsoft.com/playwright/mcp:v0.0.80'
Write-Host "Plugins :"
Write-Host '  claude plugin install frontend-design@claude-plugins-official -s user'
Write-Host ""
Write-Host "Le skill webapp-testing requiert : pip install playwright && python -m playwright install chromium"

Write-Host ""
Write-Host "OK. Config Claude installée depuis $Repo."
Write-Host "Secrets/overrides locaux : place-les dans $Claude\settings.local.json (non versionné)."
