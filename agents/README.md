# Système d'agents généralistes

Couche **globale** (savoir-faire), agnostique au métier. Le contexte projet (le
*quoi*) vit dans le `CLAUDE.md` de chaque repo, généré par `project-init`.
Les règles d'orchestration sont dans `~/.claude/CLAUDE.md`.

> Ce fichier `README.md` n'est pas un agent (pas de frontmatter `name`/`description`),
> il est donc ignoré par le chargement des subagents.

## Roster

| Agent | Modèle | Écrit ? | Rôle |
|---|---|---|---|
| `project-init` | opus | oui | Bootstrap la couche projet (CLAUDE.md, conventions) |
| `project-manager` | sonnet | Notion | Backlog, épics, issues (Notion) |
| `explorer` | haiku | non | Recherche read-only en fan-out, rend une conclusion |
| `architect` | opus | non | Plans d'implémentation, décisions de design |
| `feature` | sonnet | oui | Écrit/modifie le code, diffs minimaux |
| `debugger` | sonnet | oui | Cause racine des bugs, correctif ciblé |
| `test-engineer` | sonnet | oui | Écrit + exécute les tests (TDD) |
| `reviewer` | opus | non | Revue de correction (boucle evaluator) |
| `security-auditor` | sonnet | non | Audit sécurité défensif |
| `refactorer` | sonnet | oui | Simplifie sans changer le comportement |
| `verifier` | sonnet | non | Exerce le flux end-to-end réel |
| `doc-writer` | haiku | oui | Doc, docstrings, CHANGELOG |
| `git-manager` | haiku | oui | Commits conventionnels, staging sûr |

## Orchestration

Le **thread principal Claude Code est l'orchestrateur** — un subagent ne peut pas
en appeler un autre. Il route selon la table de `~/.claude/CLAUDE.md`.

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
- Modèle par coût/qualité : Haiku (tri/doc), Sonnet (implémentation), Opus
  (architecture/revue critique).
- Boucle evaluator-optimizer bornée · humain dans la boucle avant tout acte peu
  réversible.

## Portabilité (autres harness)

Chaque agent a un frontmatter en deux parties :
- **Natif Claude Code** : `name`, `description`, `model`, `tools`.
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
