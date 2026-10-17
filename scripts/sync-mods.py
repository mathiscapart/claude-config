#!/usr/bin/env python3
"""Compare les mods copiés dans plugins/ à leur upstream (plugins/upstreams.json).

Si le contenu diffère, remplace la copie, met à jour le commit et la version dans
upstreams.json et ORIGIN.md. Ne commit rien: le workflow ouvre une PR à relire.
Un changement sur un autre mod du même dépôt upstream ne déclenche rien.
"""
import json
import re
import subprocess
import sys
import tempfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONF = ROOT / "plugins" / "upstreams.json"
SKIP_DIRS = {"tests", "node_modules", ".git"}
SKIP_FILES = {"tsconfig.json"}
KEEP = {"ORIGIN.md"}  # fichier à nous, jamais comparé ni écrasé


def tree(base: Path, skip_keep: bool) -> dict:
    out = {}
    for p in sorted(base.rglob("*")):
        rel = p.relative_to(base)
        if not p.is_file() or set(rel.parts[:-1]) & SKIP_DIRS or p.name in SKIP_FILES:
            continue
        if skip_keep and rel.parts == (p.name,) and p.name in KEEP:
            continue
        out[rel.as_posix()] = p.read_bytes()
    return out


def sh(*args, cwd=None):
    return subprocess.run(args, cwd=cwd, check=True, capture_output=True, text=True).stdout.strip()


def main() -> int:
    conf = json.loads(CONF.read_text())
    changed = []
    for name, up in conf.items():
        with tempfile.TemporaryDirectory() as tmp:
            sh("git", "clone", "--quiet", "--depth", "1", f"https://github.com/{up['repo']}.git", tmp)
            sha = sh("git", "rev-parse", "HEAD", cwd=tmp)
            src = Path(tmp) / up["path"]
            if not src.is_dir():
                print(f"ERREUR {name}: {up['path']} a disparu de {up['repo']}", file=sys.stderr)
                return 1
            want = tree(src, skip_keep=False)
            lic = Path(tmp) / "LICENSE"
            if lic.is_file():
                want["LICENSE"] = lic.read_bytes()
            dest = ROOT / "plugins" / name
            have = tree(dest, skip_keep=True)
            if want == have:
                print(f"{name}: à jour (upstream {sha[:7]})")
                continue
            for rel in sorted(set(want) | set(have)):
                if want.get(rel) != have.get(rel):
                    print(f"{name}: {'ajouté' if rel not in have else 'supprimé' if rel not in want else 'modifié'} {rel}")
            for rel in have:
                if rel not in want:
                    (dest / rel).unlink()
            for rel, data in want.items():
                f = dest / rel
                f.parent.mkdir(parents=True, exist_ok=True)
                f.write_bytes(data)
            version = json.loads((dest / ".claude-plugin" / "plugin.json").read_text()).get("version", "?")
            old = up.get("commit", "")
            up["commit"] = sha
            origin = dest / "ORIGIN.md"
            if origin.is_file():
                text = origin.read_text()
                text = re.sub(
                    r"- Commit source : .*",
                    f"- Commit source : {sha} ({date.today():%d/%m/%Y}), version {version}",
                    text,
                )
                if "RELIRE" not in text:
                    text += "\n> RELIRE : synchro automatique, les appels listés ci-dessus et la version de Claude Code testée sont à revérifier (voir la sortie de `claude plugin validate` dans la PR).\n"
                origin.write_text(text)
            changed.append(f"{name} {old[:7]} -> {sha[:7]} (v{version})")
    CONF.write_text(json.dumps(conf, indent=2) + "\n")
    print("CHANGED: " + "; ".join(changed) if changed else "Rien à synchroniser.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
