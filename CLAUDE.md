# Configuration IA globale — savoir-faire, pas savoir

Ce fichier définit **comment** travailler avec l'IA sur n'importe quel projet
(code, infra, sécurité, data…). Il est générique et ne contient aucun contexte
métier. Le **quoi** (stack, domaine, conventions locales) vit dans le `CLAUDE.md`
de chaque projet, généré par l'agent `project-init`.

> Principe directeur : *prompting is temporary, structure is permanent*.
> On construit par couches, sobrement. Un fichier qui veut tout dire ne dit rien.

## Architecture à deux couches

- **Couche globale** (`~/.claude/`) : agents généralistes réutilisables + ce fichier.
  Jamais spécialisée à un projet.
- **Couche projet** (`<repo>/.claude/` + `<repo>/CLAUDE.md`) : contexte métier,
  stack, conventions, definition of done locale. Générée par `project-init`.

Un agent lit le `CLAUDE.md` du projet courant pour connaître le contexte, puis
applique le savoir-faire ci-dessous.

## Le thread principal est l'orchestrateur

Il n'existe pas de subagent « orchestrateur » : un subagent ne peut pas en
appeler un autre. **C'est toi, thread principal, qui orchestres** en déléguant
aux subagents ci-dessous. Règle de délégation :

| Situation | Délègue à |
|---|---|
| Démarrer / cadrer la config IA d'un projet | `project-init` |
| Gérer le backlog, épics, issues (Notion) | `project-manager` |
| Chercher/localiser du code dans un gros repo | `explorer` (parallélise en fan-out) |
| Concevoir un plan d'implémentation, trancher un design | `architect` |
| Écrire / modifier du code applicatif ou infra | `feature` |
| Isoler la cause racine d'un bug | `debugger` |
| Écrire et exécuter des tests | `test-engineer` |
| Relire du code pour la correction | `reviewer` |
| Audit sécurité défensif | `security-auditor` |
| Nettoyer/simplifier sans changer le comportement | `refactorer` |
| Vérifier qu'un changement marche pour de vrai (end-to-end) | `verifier` |
| Doc, docstrings, CHANGELOG | `doc-writer` |
| Commits (conventional), staging, push | `git-manager` |

### Flux type
```
Feature :  architect → feature → test-engineer → reviewer → verifier → git-manager
Bug     :  debugger → feature → test-engineer → reviewer → git-manager
Entretien: refactorer / doc-writer / security-auditor
```
La boucle `reviewer → feature` (evaluator-optimizer) est plafonnée à **2 itérations** :
au-delà, remonte à l'humain plutôt que de boucler à l'infini.

## Économie de contexte (tokens)

- Un besoin de **recherche large** → `explorer` (renvoie une conclusion, pas des
  dumps de fichiers). N'inonde jamais le thread principal de contenu brut.
- **Parallélise uniquement les tâches disjointes** : deux agents ne doivent pas
  écrire dans les mêmes fichiers en même temps.
- Le bon modèle pour le bon rôle : le routage/tri sur Haiku, l'implémentation sur
  Sonnet, l'architecture et la revue critique sur Opus. Chaque agent porte déjà
  son `model` optimal — ne le surcharge que si le rapport coût/qualité le justifie.

## Definition of Done universelle

Un travail n'est « fini » que si :
1. Le comportement est **vérifié** (exécuté, pas seulement supposé — cf. `verifier`).
2. Les tests passent (ou l'absence de test est justifiée explicitement).
3. Le lint/format du projet est propre.
4. Le diff est **minimal** et cohérent avec le style du repo.
5. Aucun secret en clair, aucune régression de sécurité.
6. La doc impactée est à jour.

## Règles humaines + IA (toutes activités confondues)

- **Diffs minimaux.** On modifie ce qui doit l'être, rien de plus.
- **Lire avant d'écrire.** On comprend le code/l'infra existant avant de le changer.
- **Écrire comme le voisin.** On imite les conventions, le nommage, la densité de
  commentaires du fichier édité — on n'impose pas son propre style.
- **Sécurité défensive uniquement.** Pas de code destructif, pas d'évasion de
  détection, pas de secret committé.
- **Humain dans la boucle** avant tout acte peu réversible ou externe (push, deploy,
  suppression, envoi). On propose, l'humain valide.
- **Dire la vérité sur les résultats.** Si un test échoue, on le dit avec la sortie.
  Si une étape est sautée, on le dit. On ne masque pas.
- **Langue des artefacts = langue du repo.** Commits, commentaires, doc suivent la
  langue déjà présente dans le projet.
