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
- Le workspace ouvert vient de l'événement `workspace.changed` (nom et branche), traduit en chemin
  par le CLI d'Orca (`orca worktree ps`) : `workspace.list` n'existe qu'à partir de l'API hôte 1.3.
  Quand plusieurs workspaces portent le même nom et la même branche, un terminal du workspace
  départage (ses ids sont ceux d'`orca terminal list`), sinon le champ `isActive` de
  `orca worktree ps` ; si rien ne tranche, le panneau garde le workspace précédent plutôt que de
  choisir au hasard. Le plus sûr reste de donner un nom distinct à chaque workspace
  (`orca worktree set --worktree path:<chemin> --display-name <nom>`, ne touche pas à la branche). L'activité d'un agent dans un autre workspace ne
  change jamais la session suivie.
- À chaque fin de tour (`stop_reason: end_turn`) ou changement de session, il lance :

  ```
  claude -p /context --resume <session> --fork-session --no-session-persistence --output-format json
  ```

  `/context` est une commande locale : aucun appel au modèle (`num_turns: 0`, vérifié à chaque
  lecture), aucun fichier de session créé, le transcript d'origine n'est pas modifié. Compter ~3 s
  par mesure, le temps que `claude` démarre ses serveurs MCP.
- Le bouton ↻ force une nouvelle mesure.
- Les catégories que `/context` détaille se déplient : outils MCP (par serveur, puis par outil),
  agents, fichiers mémoire, skills, chacun avec ses tokens. Le tableau des outils MCP de `/context`
  liste aussi les outils différés : sa somme dépasse donc la ligne « MCP tools ».
- Chaque mesure est ajoutée à l'historique de sa session, `~/.claude/context-bar/history/<session>.jsonl`
  (ou sous `$CLAUDE_CONFIG_DIR`) : date, tour, total, tokens par catégorie, sans le détail par
  élément. Remesurer le même tour au même total n'ajoute rien. Sous la barre, une courbe montre
  le total mesure après mesure, l'écart avec la précédente et le nombre de compactions (chute de
  plus de 30 %). L'historique commence à la première mesure : rien n'est reconstitué pour les tours
  passés.

## Panneau Conversations

Un second panneau liste les 40 sessions les plus récentes, tous projets confondus, avec leur
dernière mesure enregistrée dans l'historique (pourcentage, total, jauge jusqu'au seuil de
compaction). Ouvrir la liste ne lance pas `claude`. Une ligne se déplie sur la répartition par
catégorie, la courbe de l'historique et deux boutons :

- **Mesurer** lance `/context` sur cette session (~3 s, même garde-fou `num_turns: 0`) et l'ajoute
  à son historique, sans changer la session suivie ;
- **Suivre** épingle la session dans le panneau Context Bar et bascule dessus (via
  `orca plugin open`, l'API plugin ne sait pas ouvrir un panneau). Retour au suivi du workspace
  actif : « Auto » dans le sélecteur.

La session suivie par Context Bar est marquée ●. La liste se recharge à chaque mesure de la
session suivie, au retour sur le panneau, ou avec ↻.
- Orca arrête un worker inactif depuis quelques minutes et ne le relance pas pour `workspace.changed` :
  tant qu'il est ouvert, le panneau relaie cet événement au worker et le sollicite chaque minute.
  Panneau fermé, le suivi s'arrête ; il reprend sur le workspace courant à la réouverture.

C'est une **ré-estimation** avec la configuration actuelle (CLAUDE.md, MCP) : si tu la modifies en
cours de session, le chiffre peut s'écarter de ce que le process en cours a réellement chargé.
Les lignes « (deferred) » sont listées par `/context` mais hors du total ; elles sont grisées.

## Installer en local

```sh
orca plugin dev load orca-plugins/context-bar   # puis --approve <empreinte> affichée
orca plugin open local.context-bar                  # --panel conversations pour la liste
```

Le plugin est `trusted-worker` : son worker tourne en Node avec les droits de ton compte (il lit
`~/.claude/projects`, lance `claude` et le CLI `orca`). Seule capability Orca demandée :
`workspace:read`, pour savoir quel workspace a le focus.

## Tests

```sh
node --test orca-plugins/context-bar/test/*.test.mjs
```

`test/context-output.md` est une vraie sortie de `/context` (Claude Code 2.1.317), avec la liste
des outils MCP réduite à deux serveurs.
