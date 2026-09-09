# Système d'agents généralistes

Couche **globale** (savoir-faire), agnostique au métier. Le contexte projet (le
*quoi*) vit dans le `CLAUDE.md` de chaque repo, généré par `project-init`.
Les règles d'orchestration sont dans `~/.claude/CLAUDE.md`.

> Ce fichier `README.md` n'est pas un agent (pas de frontmatter `name`/`description`),
> il est donc ignoré par le chargement des subagents.

## Roster

| Agent | Modèle | Effort | maxTurns | Écrit ? | Rôle |
|---|---|---|---|---|---|
| `explorer` | haiku | — | 8 | non | Recherche read-only en fan-out, rend une conclusion |
| `git-manager` | haiku | — | 6 | oui | Commits conventionnels, staging sûr |
| `doc-writer` | sonnet | low | 8 | oui | Doc, docstrings, CHANGELOG |
| `verifier` | sonnet | low | 12 | non | Exerce le flux end-to-end réel |
| `feature` | sonnet | medium | 25 | oui | Écrit/modifie le code, diffs minimaux |
| `refactorer` | sonnet | medium | 15 | oui | Simplifie sans changer le comportement |
| `test-engineer` | sonnet | medium | 20 | oui | Écrit + exécute les tests (TDD) |
| `project-manager` | sonnet | medium | 12 | Notion | Backlog, épics, issues |
| `project-init` | opus | medium | 15 | oui | Bootstrap la couche projet (CLAUDE.md, conventions) |
| `debugger` | sonnet | **high** | 20 | oui | Cause racine des bugs, correctif ciblé |
| `security-auditor` | sonnet | **high** | 15 | non | Audit sécurité défensif |
| `reviewer` | opus | **high** | 12 | non | Revue de correction (boucle evaluator) |
| `architect` | opus | **high** | 15 | non | Plans d'implémentation, décisions de design |

L'effort sert au **jugement sous incertitude**, pas à la récupération mécanique :
un `grep` ne raisonne pas mieux avec plus d'effort. Comme la règle de périmètre
donne déjà sa zone à l'agent, l'effort se concentre là où reste de l'incertitude.
`explorer` et `git-manager` n'ont pas de champ `effort` : les niveaux disponibles
dépendent du modèle et ils héritent alors de celui de la session.

## Orchestration

Le **thread principal Claude Code est l'orchestrateur**. Les agents de ce dossier
ont tous un `tools:` restreint sans `Agent` : ils ne peuvent pas re-déléguer, ils
rendent un résultat. (Ce n'est pas une limite du harness — un agent avec `tools: *`
le pourrait ; c'est un choix de conception ici.)

```
Feature :  architect → feature → test-engineer → reviewer → verifier → git-manager
Bug     :  debugger → feature → test-engineer → reviewer → git-manager
Entretien: refactorer / doc-writer / security-auditor
```

Boucle `reviewer ↔ feature` plafonnée à 2 itérations. Parallélise seulement les
tâches disjointes (jamais deux agents en écriture sur les mêmes fichiers).

### Agent Teams (déjà activé : `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`)
Réserve-le aux cas où les agents doivent **discuter** entre eux (debug par
hypothèses concurrentes, revue parallèle sécu+perf+tests). Plus cher que les
subagents classiques — le défaut reste la délégation simple.

## Principes appliqués (Anthropic / OpenAI / Google)

- Responsabilité unique par agent · moindre privilège d'outils (read-only pour
  explorer/architect/reviewer/security-auditor/verifier).
- Isolation de contexte : les agents de recherche rendent une conclusion, pas des
  dumps → économie de tokens.
- Modèle et effort par nature de tâche (voir le roster), plafond `maxTurns`
  mécanique par agent.
- **Chaque sous-agent recharge toute la hiérarchie CLAUDE.md** (global + projet) :
  sa densité est payée à chaque lancement, pas une fois par session. Les agents ne
  doivent donc jamais le relire avec un outil.
- Boucle evaluator-optimizer bornée · humain dans la boucle avant tout acte peu
  réversible.

## Portabilité (autres harness)

Chaque agent a un frontmatter en deux parties :
- **Natif Claude Code** : `name`, `description`, `model`, `effort`, `maxTurns`,
  `color`, `tools`.
- **Portable** (préfixé, ignoré par Claude Code) : `spec_version`, `role`,
  `handoffs`, `inputs`, `outputs`.

Pour cibler OpenAI (Agents SDK) ou Google (ADK), un adaptateur lit le corps +
`role`/`handoffs`/`tools` et génère l'objet agent correspondant
(`Agent(instructions=…, handoffs=[…])` / `LlmAgent(sub_agents=[…])`). Les prompts
sont volontairement **auto-portants** (peu de dépendances à des fichiers externes)
pour rester valables hors Claude Code. Prépends `~/.claude/CLAUDE.md` comme
préambule commun lors de la génération. → à implémenter dans `agents/build/` (Phase 6).

## Synchronisation multi-postes

Versionne `~/.claude/{CLAUDE.md,agents/,settings.json}` dans un repo Git
`claude-config` ; clone/symlink sur chaque poste. Garde `settings.local.json`
gitignoré (clés, chemins locaux). Ne synchronise pas `projects/`/`history.jsonl`
(chemins absolus). Option équipe : empaqueter en plugin marketplace.
