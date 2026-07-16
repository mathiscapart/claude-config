#!/usr/bin/env bash
# Installe la config Claude partagée sur un poste : symlinke les fichiers du repo
# dans ~/.claude/. Idempotent. À lancer après `git clone` sur une nouvelle machine.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLAUDE="$HOME/.claude"
mkdir -p "$CLAUDE"

for item in CLAUDE.md agents settings.json; do
  target="$CLAUDE/$item"
  # Sauvegarde d'un fichier réel préexistant pour ne rien écraser en silence
  if [ -e "$target" ] && [ ! -L "$target" ]; then
    mv "$target" "$target.bak.$(date +%s)"
    echo "sauvegardé : $target -> $target.bak.*"
  fi
  ln -sfn "$REPO/$item" "$target"
  echo "symlink : $target -> $REPO/$item"
done

echo "OK. Config Claude installée depuis $REPO."
echo "Secrets/overrides locaux : place-les dans $CLAUDE/settings.local.json (non versionné)."
