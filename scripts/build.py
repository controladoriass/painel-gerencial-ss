# -*- coding: utf-8 -*-
"""
build.py — Compila os arquivos-fonte em `src/` num único `index.html` na raiz.

Uso:
    python scripts/build.py

Esse `index.html` é o arquivo que o GitHub Pages serve. Ele contém tudo embutido
(CSS + JS + dados congelados + logo em base64), por isso funciona também offline
por duplo-clique (sem servidor).

Estrutura esperada de fontes:
    src/index.template.html   esqueleto HTML com marcadores /* BUILD:INJECT_* */
    src/styles/main.css       CSS principal (ou vários .css concatenados nessa ordem alfabética)
    src/scripts/app.js        JS principal (ou vários .js concatenados nessa ordem alfabética)
    src/data-embed.js         linha `window.DADOS_EMBED = {...}` (fallback offline)

Como funciona:
    1. Lê o template.
    2. Concatena TODOS os arquivos .css em `src/styles/` em ordem alfabética.
    3. Concatena TODOS os arquivos .js em `src/scripts/` em ordem alfabética.
    4. Substitui os marcadores do template pelo conteúdo.
    5. Escreve o resultado em `index.html` na raiz.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "src"


def read_all(folder: Path, extension: str) -> str:
    """Lê todos os arquivos com a extensão dada, em ordem alfabética, e concatena."""
    if not folder.exists():
        return ""
    parts = []
    for f in sorted(folder.glob(f"*{extension}")):
        parts.append(f"/* ---- {f.name} ---- */\n")
        parts.append(f.read_text(encoding='utf-8'))
        if not parts[-1].endswith("\n"):
            parts.append("\n")
    return "".join(parts)


def main() -> int:
    template = (SRC / "index.template.html").read_text(encoding='utf-8')

    css = read_all(SRC / "styles", ".css")
    js_app = read_all(SRC / "scripts", ".js")
    embed = (SRC / "data-embed.js").read_text(encoding='utf-8')

    # Substitui marcadores
    out = template
    out = out.replace("/* BUILD:INJECT_CSS */", css)
    out = out.replace("/* BUILD:INJECT_DATA_EMBED */", embed)
    out = out.replace("/* BUILD:INJECT_JS */", js_app)

    dest = ROOT / "index.html"
    dest.write_text(out, encoding='utf-8')

    size_kb = len(out) / 1024
    print(f"[ok] index.html gerado ({size_kb:.0f} KB)")
    print(f"     CSS: {len(css)/1024:.0f} KB · JS: {len(js_app)/1024:.0f} KB · embed: {len(embed)/1024:.0f} KB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
