# context-bar

Copie figée de https://github.com/hamzafer/claude-code-mods (dossier mods/context-bar), licence MIT, (c) 2026 Hamza Zafar.

- Commit source : 77f1ebcd5d228db98ceecdc7ca9ec063287b9f07 (16 oct. 2026), version 0.1.3
- Testé avec Claude Code 2.1.302
- Relu et validé avec claude plugin validate. Appels demandés : $.command.register, $.env.get, $.fs.exists, $.fs.read (lecture du seul fichier claude-code-mods/bands.json), $.session.usage, $.state, $.store, $.ui.resolve. Aucun accès réseau, aucune écriture de fichier, aucun process lancé.
- Mise à jour : automatique, workflow .github/workflows/sync-mods.yml (lundi 06:00 UTC ou à la main) qui ouvre une PR à relire. Source suivie dans plugins/upstreams.json.
