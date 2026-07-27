# Painel Gerencial de Carteira — Silva & Silva (uso interno)

Dashboard **interno** (não para clientes) com a visão consolidada do escritório:
quem concentra o trabalho, cobertura por área, esforço × tamanho da carteira e
panorama grupo a grupo.

> Documento de **uso interno**. Não distribuir a clientes.

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
