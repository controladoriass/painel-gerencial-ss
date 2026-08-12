# Arquitetura

## Filosofia

**Simplicidade sobre engenharia.** O painel é servido pelo GitHub Pages
como um único arquivo estático. Não há backend, banco de dados, framework
ou build tool complexo. A organização em pastas existe para deixar o código
legível e mantível, não para introduzir dependências.

## Diagrama do fluxo

```
        ┌──────────────────────────────────────────────────────┐
        │                    src/                              │
        │   ┌─────────────────┐  ┌────────────┐  ┌──────────┐ │
        │   │ index.template  │  │  styles/   │  │scripts/  │ │
        │   │      .html      │  │  *.css     │  │  *.js    │ │
        │   └─────────────────┘  └────────────┘  └──────────┘ │
        │                            +                         │
        │                       data-embed.js                  │
        └──────────────────────────────────────────────────────┘
                                    │
                          python scripts/build.py
                                    ▼
        ┌──────────────────────────────────────────────────────┐
        │                    index.html                        │
        │        (auto-contido, ~1.1 MB, sobe pro Pages)       │
        └──────────────────────────────────────────────────────┘
                                    │
                              git push origin
                                    ▼
        ┌──────────────────────────────────────────────────────┐
        │       https://controladoriass.github.io/             │
        │              painel-gerencial-ss/                    │
        └──────────────────────────────────────────────────────┘
```

## Como o build funciona

`scripts/build.py` faz 4 coisas:

1. Lê `src/index.template.html` — esqueleto HTML com 3 marcadores:
   - `/* BUILD:INJECT_CSS */`
   - `/* BUILD:INJECT_DATA_EMBED */`
   - `/* BUILD:INJECT_JS */`
2. Concatena todos os `.css` em `src/styles/` em **ordem alfabética**.
3. Concatena todos os `.js` em `src/scripts/` em **ordem alfabética**.
4. Substitui os marcadores e escreve em `index.html` na raiz.

Cada arquivo concatenado ganha um comentário `/* ---- nome-do-arquivo ---- */`
como cabeçalho, para que o engenheiro que estiver depurando o `index.html`
gerado saiba de onde cada bloco veio.

## Estratégia de carregamento dos dados

O painel usa **embed-first, remoto no fundo**:

1. Ao abrir, renderiza **imediatamente** com os dados de `data-embed.js`
   (dados congelados da última atualização mensal). A cortina de loading
   fica ~2 segundos por experiência de marca, não porque precisa carregar.
2. 800 ms depois, dispara em paralelo o fetch de 104 requisições ao repo
   remoto (`dashboard-juridico`). Se algo tiver mudado desde o embed
   (comparação por hash de `cod:proc:ativos:horas`), re-renderiza com fade
   suave (`body.reloading`).
3. Se o remoto estiver fora do ar, o painel continua com o embed. Zero
   quebra visível.

## Estrutura do CSS

Hoje o CSS está em `src/styles/main.css` como um único arquivo. Se ele
crescer demais, a estratégia é dividir por bloco visual (`hero.css`,
`sidebar.css`, `carrossel.css`, `rankings.css`, etc). O `build.py` já
concatena todos em ordem alfabética — basta soltar novos `.css` na pasta.

**Ordem de leitura** (para futura subdivisão):

- Variáveis CSS raiz (paleta, tipografia)
- Reset e globais
- Hero (topo)
- Sidebar (nav vertical)
- Cortina de loading
- Cards do carrossel de rankings executivos
- Cada uma das 9 seções (carga, áreas, eficiência, presença, idade, perfil, partes, movimento, panorama)
- Botão voltar ao topo e toggle de tema
- Overrides do tema escuro

## Estrutura do JS

Hoje o JS está em `src/scripts/app.js` como um único arquivo. Se crescer,
divide por seção. Cada `render*()` pode virar seu próprio módulo:

- `render-carga.js` — Distribuição da carga
- `render-areas.js` — Cobertura por área do direito
- `render-eficiencia.js` — Matriz esforço × carteira
- `render-presenca.js` — Tribunais, mapa Brasil, instância
- `render-idade.js` — Faixas etárias + histograma
- `render-perfil.js` — Polo processual
- `render-partes.js` — Adversários recorrentes
- `render-movimento.js` — Entradas × encerramentos
- `render-panorama.js` — Tabela completa
- `render-rankings-exec.js` — Carrossel dos 5 rankings
- `ui-nav.js` — Sidebar + scrollspy
- `ui-tema.js` — Toggle claro/escuro
- `ui-cortina.js` — Loading de abertura
- `ui-back-top.js` — Botão voltar ao topo
- `ui-filtros.js` — Filtros textuais das seções
- `data-loader.js` — Estratégia embed-first + fetch remoto
- `utils.js` — NUM(), formatters, count-up, etc

O `build.py` concatena tudo em ordem alfabética. A ordem é intencional:
os utilitários vêm primeiro (utils.js, data-loader.js) e as seções depois.

## Como o embed funciona

O `src/data-embed.js` contém uma única atribuição:

```js
window.DADOS_EMBED = { manifest: {...}, grupos: {...} };
```

Isso permite duas coisas:

1. **Duplo-clique funciona**: quando o browser abre `file://` (sem servidor),
   ele não consegue fazer `fetch()` de arquivos locais. Nesses casos, o
   painel usa `window.DADOS_EMBED` como fonte.
2. **Carregamento instantâneo**: mesmo online, o embed é usado primeiro e
   substituído em background pela versão remota se houver diferença.

Para atualizar o embed, use o script `atualizar.py` na pasta de trabalho
local `Dashboard-Interno/` (fora deste repo).

## Sobre o `atualizar.py`

O `atualizar.py` mora na pasta de trabalho local (`Dashboard-Interno/` no
computador do Rangel), fora deste repo publicado. Ele:

1. Copia `../Dashboard/dados/*.json` para `dados/` local.
2. Re-embuta os dados em `src/data-embed.js` deste repo.

Fluxo mensal completo:

```bash
# 1. rodar a atualização mensal do dashboard-juridico (repo dos clientes)
# 2. na pasta Dashboard-Interno/, atualizar os dados:
python atualizar.py

# 3. entrar no repo publicado
cd _publicar

# 4. rodar o build
python scripts/build.py

# 5. publicar
git add -A
git commit -m "atualização mensal DD/MM/YYYY"
git push
```
