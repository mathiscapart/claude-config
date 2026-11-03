# Context Bar pour Orca

Un panneau dans la barre latérale droite d'Orca qui montre ce qui remplit la fenêtre de contexte de
la session Claude Code active, par catégorie, comme `/context` : prompt système, outils, MCP,
agents, mémoire, skills, messages, espace libre et marge d'auto-compaction.

Orca ne laisse pas les plugins dessiner dans la zone de chat : le panneau latéral est l'emplacement
le plus proche.

## Fonctionnement

- Le worker (`worker/main.mjs`) surveille `~/.claude/projects` (ou `$CLAUDE_CONFIG_DIR/projects`).
- La session suivie se choisit dans le sélecteur en haut du panneau :
  - **Auto** (par défaut) : la session la plus récente du workspace qui a le focus dans Orca
    (événement `workspace.changed`), sinon la plus récente tout court. Changer de workspace
    rafraîchit le panneau aussitôt. Entre deux chats d'un même workspace, c'est le dernier qui a
    écrit qui gagne : Orca n'expose pas aux plugins l'onglet de chat qui a le focus.
  - **une session précise** parmi les 15 plus récentes (titre généré par Claude, projet) : elle
    reste épinglée jusqu'au retour en Auto.
- Le chemin du workspace vient du CLI d'Orca (`orca worktree list`) : la méthode `workspace.list`
  n'existe qu'à partir de l'API hôte 1.3. Pour départager des workspaces homonymes (plusieurs
  `main`), un terminal du workspace tranche, sinon celui dont la session Claude est la plus récente.
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
`~/.claude/projects`, lance `claude` et le CLI `orca`). Seule capability Orca demandée :
`workspace:read`, pour savoir quel workspace a le focus.

## Tests

```sh
node --test orca-plugins/context-bar/test/*.test.mjs
```

`test/context-output.md` est une vraie sortie de `/context` (Claude Code 2.1.317), tronquée au
tableau des catégories.
