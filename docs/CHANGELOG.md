# Changelog

Todas as mudanças relevantes vão aqui em ordem cronológica reversa (mais recentes primeiro).

## [Unreleased]

### Reorganizado
- Repositório passa a ser um projeto organizado por pastas:
  - Fontes em `src/` (styles, scripts, embed).
  - Build simples em `scripts/build.py` (só Python stdlib).
  - Documentação em `docs/`.
  - `index.html` na raiz vira o artefato gerado.
- Fluxo de mexer no painel muda:
  1. Editar em `src/`
  2. Rodar `python scripts/build.py`
  3. `git push` publica.
- Nenhum novo requisito: sem Node, sem npm, sem build tool.
- **Comportamento visual e funcional idênticos ao anterior.**

## 2026-08-10 — Cortina 2s + JetBrains Mono no CARREGANDO

- Cortina de loading: delay de abertura 550 ms → 2000 ms.
- Fonte da caption "CARREGANDO PAINEL GERENCIAL": Montserrat → JetBrains Mono.
- Fonte Inter revertida para Montserrat em todos os textos corridos, exceto nas descrições das seções (`.sec-desc`), que ficam com Inter.

## 2026-08-10 — Tema escuro: correções pontuais

- Setas do carrossel, tabs em pílula ativa, pill "MEDIANA · 1.7a" no histograma jurídico, linhas top-1/2/3 do panorama e chips das siglas UF (top 6 estados) tinham `background: var(--navy)`, que no dark theme vira creme; corrigido com overrides específicos.
- Mapa do Brasil: `_corHeatmap()` agora retorna cor sensível ao tema para `pct=0`; stops do gradiente têm versão dark.

## 2026-08-10 — Refino corporativo

- Paleta reduzida: navy + dourado + cinza. Semaforização verde/amarelo/vermelho substituída por gradiente de intensidade em dourado→navy.
- Top-3 dos rankings: sem fundo dourado; só traço lateral fino + numeração em ouro.
- Cantos arredondados exagerados removidos: pills e círculos viraram retângulos (border-radius 2-3 px) em 18 elementos.

## 2026-08-10 — Sidebar navy + tema escuro + toggle

- Nav sticky horizontal virou sidebar navy vertical fixa (250 px).
- Toggle de tema (sol/lua) no rodapé da sidebar, persistência em `localStorage`.
- Halo pulsante nos KPIs, sweep dourado periódico, parallax leve nos cards.
- Botão "Voltar ao topo" no canto inferior direito.

## 2026-08-10 — Cortina de loading

- Cortina full-screen navy com logo do escritório, brilho dourado sweep e caption "CARREGANDO PAINEL GERENCIAL". As duas metades deslizam como cortina de teatro ao terminar o render.

## Marcos anteriores

Ver histórico do `git log` para o restante da evolução do painel (~40+ ajustes finos entre 2026-07-27 e 2026-08-10).
