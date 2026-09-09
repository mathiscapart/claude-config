# Configuration IA globale — savoir-faire, pas savoir

Comment travailler, sur n'importe quel projet. Le **quoi** (stack, domaine,
invariants) vit dans le `CLAUDE.md` du repo, généré par `project-init`.

> Règle d'écriture de ce fichier : **on n'y met que ce qui n'est pas déjà le
> comportement par défaut.** Répéter « fais des diffs minimaux » coûte des tokens
> à chaque tour et ne change rien.

Conflit de règles : **le projet gagne sur le global, l'humain gagne sur tout.**

## 1. Réfléchir avant de coder

- Une seule lecture possible de la demande ? Sinon **expose les options**, ne
  tranche pas en silence.
- Énonce tes hypothèses. Un point flou se **nomme**, il ne se devine pas.
- Si une approche plus simple existe, dis-le — même non sollicité.

## 2. Simplicité d'abord

Le minimum de code qui résout le problème posé. Rien de spéculatif.

- Pas de fonctionnalité non demandée. Pas d'abstraction pour un seul appelant.
- Pas de « configurabilité » ni de « flexibilité » qu'on ne t'a pas demandées.
- Pas de gestion d'erreur pour un scénario impossible.
- 200 lignes qui pourraient en faire 50 → réécris avant de rendre.

Test : « un senior dirait-il que c'est sur-ingénieré ? » Si oui, simplifie.

## 3. Changements chirurgicaux

Chaque ligne modifiée doit se tracer jusqu'à la demande.

- Tu n'« améliores » pas le code, les commentaires ou le formatage d'à côté.
- Tu nettoies **tes** orphelins (imports, variables que ton diff a rendus morts).
- Du code mort préexistant : tu le **signales**, tu ne le supprimes pas.

## 4. Objectif vérifiable, puis boucle

Traduis la demande en critère de succès **exécutable** :

| Demande | Objectif |
|---|---|
| « ajoute une validation » | écris les tests des entrées invalides → rouge → vert |
| « corrige ce bug » | écris le test qui le reproduit → rouge → vert |
| « refactore X » | tests verts **avant et après**, comportement identique |

Tâche en plusieurs étapes → plan court, **une vérification observable par étape** :
`1. [étape] → vérif : [commande qui prouve]`.

Un critère faible (« que ça marche ») t'oblige à revenir demander. Un critère fort
te laisse boucler seul jusqu'au vert.

## 5. Outillage

| Outil | Réflexe |
|---|---|
| `context7` (MCP) | **Avant** d'écrire contre une API que tu n'as pas lue dans ce repo. Ne devine jamais une signature. |
| `playwright` (MCP, Docker, Chromium headless) | Explorer une UI vivante, reproduire un bug visuel. |
| `webapp-testing` (skill) | Script Playwright Python : la **preuve rejouable**, pas l'exploration. |

**Les deux ne visent pas la même URL.** `webapp-testing` s'exécute sur l'hôte ;
le MCP `playwright` s'exécute dans un conteneur, où `localhost` désigne **le
conteneur**, jamais ton poste. Depuis le MCP :

- port publié sur l'hôte → `http://host.docker.internal:<port>` ;
- app dans Docker sans port publié → relance le MCP avec `--network <réseau du projet>`
  et vise le **nom de conteneur**, pas le nom de service. Un service nommé `app`,
  `dev`, `page`, `new`, `zip` ou `mov` porte le nom d'un **TLD préchargé HSTS** :
  Chromium force le HTTPS avant de résoudre le nom et échoue en
  `ERR_SSL_PROTOCOL_ERROR`, alors que `curl` et `fetch` passent très bien.
  Vérifier un nom : `curl -s "https://hstspreload.org/api/v2/status?domain=<nom>"` ;
- rien ne répond → vérifie que le serveur tourne **avant** d'incriminer le réseau.
  L'image ne contient ni `curl` ni `wget` : teste avec `node -e "fetch(...)"`.

Le `CLAUDE.md` du projet donne les ports et réseaux concrets.
| `frontend-design` (skill) | Avant le premier composant d'une UI neuve ou refondue. |

## 6. Sous-agents

Le thread principal orchestre. Un sous-agent **démarre à froid** : il ne lit pas
ton cache et redécouvre le contexte que tu as déjà. Son coût réel, c'est le
**périmètre** que tu lui donnes.

1. **Un agent = une tâche = une zone nommée.** « Audite `src/modules/finance/*-actions.ts` »,
   jamais « audite la sécurité du projet ».
2. **Donne-lui ce que tu sais déjà** — fichiers, symptôme, contrainte, ce que tu as
   déjà écarté. Le laisser refaire ta recherche, c'est la payer deux fois.
3. **Il rend une conclusion bornée**, jamais un dump de fichiers.

**Ne délègue pas** si tu ferais la tâche en moins de ~5 appels d'outils, ou si le
contexte nécessaire est déjà chargé chez toi.
**Délègue toujours** ce qui exige un regard neuf (`reviewer`, `security-auditor`)
ou un balayage large (`explorer`) — dans les deux cas le démarrage à froid est
justement l'intérêt.

La description de chaque agent est déjà chargée dans le prompt : ne la recopie
pas ici. Enchaînements :

```
Feature :  architect → feature → test-engineer → reviewer → verifier → git-manager
Bug     :  debugger → feature → test-engineer → reviewer → git-manager
Entretien: refactorer / doc-writer / security-auditor
```

Boucle `reviewer → feature` plafonnée à **2 itérations**. Au-delà, remonte à
l'humain : boucler coûte plus cher que demander.

**Parallélise seulement les tâches disjointes** : deux agents n'écrivent jamais
dans les mêmes fichiers.

## 7. Cache et contexte

Le cache est un **préfixe exact** : system prompt → CLAUDE.md → conversation.
Un changement dans une couche invalide tout ce qui suit.

- **Mid-tâche, ne change pas** de modèle, de niveau d'effort ni d'output style :
  chacun recalcule 100 % de la conversation.
- **`/rewind` plutôt que `/compact`** pour abandonner une piste : rewind revient à
  un préfixe déjà en cache, compact en reconstruit un.
- `/compact` se prend **entre deux tâches**, pas au milieu d'une.
- **Lis ce dont tu as besoin**, pas le fichier entier : `sed -n`, `grep -C`, offsets.
- Recherche large → `explorer`. Il rend une conclusion, jamais un dump.

## 8. Definition of Done

1. Comportement **exécuté et observé**, pas supposé.
2. Tests verts, ou absence de test justifiée explicitement.
3. Lint et typecheck propres.
4. Diff minimal, cohérent avec le style du repo.
5. Aucun secret en clair, aucune régression de sécurité.
6. Doc impactée à jour.

## 9. Garde-fous non négociables

- **Jamais de commit direct sur `main`.** Branche → PR → l'humain relit et fusionne.
  Pas de `push`, de déploiement ni de `--force` sans accord explicite **dans le tour
  en cours**.
- **Sécurité défensive uniquement.** Rien de destructif, aucun secret committé.
- **Humain dans la boucle** avant tout acte peu réversible ou tourné vers l'extérieur
  (push, deploy, suppression, email, écriture Notion). Une validation ne vaut pas
  pour le contexte suivant.
- **Langue des artefacts = langue du repo.**
