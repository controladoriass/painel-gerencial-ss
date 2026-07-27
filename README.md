# Painel Gerencial de Carteira — Silva & Silva (uso interno)

**No ar (link interno):** https://controladoriass.github.io/painel-gerencial-ss/

Dashboard **interno** (não para clientes) com a visão consolidada do escritório:
quem concentra o trabalho, cobertura por área, esforço × tamanho da carteira e
panorama grupo a grupo.

> Documento de **uso interno**. Link discreto, mas público — não divulgar a clientes.

## De onde vêm os dados (LEIA ISTO)

**Este painel NÃO tem dados próprios.** Ele lê, ao vivo, os mesmos arquivos JSON já
publicados no repositório dos **indicadores jurídicos** (`dashboard-juridico`), pela
URL do GitHub Pages:

    https://controladoriass.github.io/dashboard-juridico/dados/

Consequências práticas:

- **Você atualiza os dados num lugar só:** a rotina mensal do `dashboard-juridico`
  (`Dashboard/ATUALIZAR_MENSAL.md`). Assim que aquele repositório é republicado, este
  painel reflete os números novos ao recarregar a página. **Nada a fazer aqui.**
- **Dependência:** se os JSONs forem removidos ou o repositório dos indicadores sair
  do ar, o painel deixa de receber dado vivo e passa a mostrar o **retrato embutido**
  (cópia congelada dentro do próprio HTML) — não quebra, mas para de atualizar.
- **Onde trocar a fonte:** constante `FONTE_REMOTA`, no topo do `<script>` em
  `index.html`. Se o repositório dos indicadores mudar de nome/URL, é só esse valor
  que precisa ser ajustado.

Ordem das fontes que o painel tenta, em cascata (`index.html`):
1. **Remota** — a URL acima (dado vivo). É o que vale quando publicado/online.
2. **`dados/` local** — só quando servido por HTTP a partir desta pasta.
3. **Embed** (`window.DADOS_EMBED`, dentro do HTML) — fallback offline / duplo-clique.

### Trocar a data-corte
No `index.html`, constante `DATA_CORTE` (aparece no cabeçalho). Atualizar quando a
mensal mudar a data dos dados.

### Atualizar o embed offline (opcional)
O embed é só um retrato de segurança para abrir sem internet. Para atualizá-lo ao
estado corrente dos JSONs locais:

    python atualizar.py            # copia de ../Dashboard/dados/ e re-embute
    python atualizar.py --no-copy  # só re-embute o que já está em ./dados/

Depois, para republicar o painel (só necessário se você mexeu no visual/embed):

    cp index.html _publicar/index.html
    cd _publicar && git add -A && git commit -m "..." && git push

## Estrutura

```
Dashboard-Interno/
├── index.html          # o painel (autocontido; sem dependência de biblioteca de gráfico)
├── dados/              # os 10 JSONs por grupo + manifest.json
│   ├── manifest.json   # {"ordem": [...]} — quais grupos carregar
│   └── <grupo>.json    # mesmo formato do dashboard de indicadores por cliente
└── README.md
```

### Como abrir

**Basta dar duplo-clique no `index.html`.** Os dados ficam embutidos dentro do
próprio arquivo (bloco `window.DADOS_EMBED`), então o painel funciona offline,
sem servidor, mesmo por `file://`.

Se preferir servir por HTTP (opcional — ele detecta e usa `dados/*.json` como
fallback quando o embed não existe):

```bash
cd Dashboard-Interno
python -m http.server 8777
# abrir http://localhost:8777/index.html
```

## De onde vêm os dados

São **os mesmos JSONs** do dashboard de indicadores por cliente
(`Dashboard/dados/*.json`), gerados na rotina mensal (`Dashboard/ATUALIZAR_MENSAL.md`).
Este painel **não recoleta nada** — só lê e consolida.

### Atualização mensal (1 comando)

Depois de rodar a atualização mensal no projeto principal, rode:

```bash
cd Dashboard-Interno
python atualizar.py
```

Isso copia os JSONs de `../Dashboard/dados/` e **re-embute** os dados dentro do
`index.html` (para continuar abrindo por duplo-clique). O painel descobre grupos,
áreas e totais sozinho — não há nada a editar no HTML, **exceto a data-corte**
(ver abaixo).

> Se os JSONs novos já estiverem em `./dados/`, use `python atualizar.py --no-copy`.

## Decisões de dado embutidas no código

- **Horas por estimativa:** os grupos em `HORAS_ESTIMATIVA` (`abc`, `russi`, `wf`)
  têm o total de horas estimado — o volume de apontamentos inviabilizou a coleta
  integral via API na data-corte 24/07/2026. Aparecem marcados com `^`.
  Fonte: `../Dashboard/ESTADO_FINAL_24-07.md`. **Revisar essa lista** se a coleta
  real desses grupos passar a ser viável numa mensal futura.
- **Áreas/complexidade:** calculadas sobre os processos **ativos** de cada grupo.
- **Movimentação:** soma de prazos + audiências + reuniões/diligências (acumulado
  da série).

## Data-corte

Os dados são um retrato de **24/07/2026**. O rótulo no cabeçalho do painel
(`#m-corte`) está fixo em `index.html` — atualizar junto com a mensal.

## Publicação (GitHub Pages) — PENDENTE decisão de acesso

Repositório separado do dashboard de clientes. Antes de publicar, definir a
proteção (repo privado × link secreto × senha na página) — é **uso interno**.
