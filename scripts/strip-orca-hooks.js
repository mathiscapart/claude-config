// Filtre git « clean » de settings.json : retire ce qu'Orca injecte dans
// ~/.claude/settings.json (hooks et statusLine pointant vers ~/.orca/agent-hooks).
// Ces chemins sont propres à chaque machine ; le fichier local les garde, le repo non.
// Lit le JSON sur stdin, écrit la version versionnée sur stdout.
const ORCA = ".orca/agent-hooks";

let input = "";
process.stdin.on("data", (chunk) => (input += chunk));
process.stdin.on("end", () => {
  const settings = JSON.parse(input);

  for (const [event, matchers] of Object.entries(settings.hooks ?? {})) {
    const kept = matchers
      .map((m) => ({ ...m, hooks: (m.hooks ?? []).filter((h) => !(h.command ?? "").includes(ORCA)) }))
      .filter((m) => m.hooks.length > 0);
    if (kept.length > 0) settings.hooks[event] = kept;
    else delete settings.hooks[event];
  }
  if (settings.hooks && Object.keys(settings.hooks).length === 0) delete settings.hooks;
  if (JSON.stringify(settings.statusLine ?? "").includes(ORCA)) delete settings.statusLine;

  process.stdout.write(JSON.stringify(settings, null, 2) + "\n");
});
