# Context Bar pour Orca

Un panneau dans la barre latérale droite d'Orca qui montre ce qui remplit la fenêtre de contexte de
la session Claude Code active, par catégorie, comme `/context` : prompt système, outils, MCP,
agents, mémoire, skills, messages, espace libre et marge d'auto-compaction.

Orca ne laisse pas les plugins dessiner dans la zone de chat : le panneau latéral est l'emplacement
le plus proche.

## Fonctionnement

- Le worker (`worker/main.mjs`) surveille `~/.claude/projects` (ou `$CLAUDE_CONFIG_DIR/projects`).
- La session suivie est le transcript principal écrit le plus récemment : celle avec laquelle tu
  parles. Avec plusieurs chats actifs en parallèle, le panneau suit le dernier qui a écrit.
- À chaque fin de tour (`stop_reason: end_turn`) ou changement de session, il lance :

  ```
  claude -p /context --resume <session> --fork-session --no-session-persistence --output-format json
  ```

  `/context` est une commande locale : aucun appel au modèle (`num_turns: 0`, vérifié à chaque
  lecture), aucun fichier de session créé, le transcript d'origine n'est pas modifié. Compter ~3 s
  par mesure, le temps que `claude` démarre ses serveurs MCP.
- Le bouton ↻ force une nouvelle mesure.

C'est une **ré-estimation** avec la configuration actuelle (CLAUDE.md, MCP) : si tu la modifies en
cours de session, le chiffre peut s'écarter de ce que le process en cours a réellement chargé.
Les lignes « (deferred) » sont listées par `/context` mais hors du total ; elles sont grisées.

## Installer en local

```sh
orca plugin dev load orca-plugins/context-bar   # puis --approve <empreinte> affichée
orca plugin open local.context-bar
```

Le plugin est `trusted-worker` : son worker tourne en Node avec les droits de ton compte (il lit
`~/.claude/projects` et lance `claude`). Aucune capability Orca n'est demandée.

## Tests

```sh
node --test orca-plugins/context-bar/test/*.test.mjs
```

`test/context-output.md` est une vraie sortie de `/context` (Claude Code 2.1.317), tronquée au
tableau des catégories.
