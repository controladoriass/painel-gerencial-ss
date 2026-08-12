# Painel Gerencial de Carteira · Silva & Silva

**No ar:** https://controladoriass.github.io/painel-gerencial-ss/

Dashboard interno de uso da diretoria com a visão consolidada da carteira
processual do escritório: quem concentra o trabalho, cobertura por área,
esforço × tamanho da carteira, presença jurídica, idade da carteira, perfil
processual, partes contrárias, movimento anual e panorama grupo a grupo.

> Documento de **uso interno**. Link discreto, mas público — não divulgar a clientes.

## De onde vêm os dados

Este painel **não tem base de dados própria**. Ele lê os JSONs já publicados
no repositório dos indicadores por cliente (`dashboard-juridico`) via GitHub Pages:

```
https://controladoriass.github.io/dashboard-juridico/dados/
```

Estratégia de carregamento em cascata:

1. **Embed local** (`src/data-embed.js`) — dados congelados na última atualização
   mensal. É o que aparece imediatamente ao abrir a página.
2. **Fetch remoto em background** — 800 ms após a página abrir, o painel busca
   os JSONs vivos do repo dos clientes. Se houver diferença, re-renderiza com
   fade suave. Zero espera visível.
3. **`dados/` local** — só ativa quando servido por HTTP local (`python -m http.server`).

## Estrutura do projeto

```
painel-gerencial-ss/
├── index.html                    ← arquivo gerado, é o que sobe pro Pages
├── src/                          ← código-fonte
│   ├── index.template.html         esqueleto HTML com marcadores /* BUILD:INJECT_* */
│   ├── styles/                     CSS (concatenado em ordem alfabética)
│   │   └── main.css
│   ├── scripts/                    JS (concatenado em ordem alfabética)
│   │   └── app.js
│   └── data-embed.js               fallback offline com dados da última mensal
├── scripts/
│   └── build.py                  ← gera index.html a partir de src/
├── docs/
│   ├── ARCHITECTURE.md             como o projeto está organizado
│   └── CHANGELOG.md                histórico de mudanças relevantes
└── README.md                     ← este arquivo
```

## Como mexer no painel

**Nunca edite `index.html` na raiz.** Ele é gerado. Edite em `src/` e rebuilde.

```bash
# 1. edite o que quiser em src/styles/ ou src/scripts/
# 2. gere o index.html
python scripts/build.py

# 3. verifique abrindo o index.html no browser (duplo-clique funciona)
# 4. publique
git add -A
git commit -m "descrição da mudança"
git push
```

O Pages atualiza sozinho em ~1 minuto. Ctrl+Shift+R no browser para forçar
reload sem cache.

## Requisitos

Só Python 3. Nada de Node, npm ou build tool. O `build.py` usa apenas
`pathlib` da stdlib.

## Deploy

Pushes na `main` são publicados automaticamente pelo GitHub Pages. O `index.html`
na raiz é o único arquivo servido — ele contém CSS, JS, dados e logo tudo
embutido, e por isso também funciona por duplo-clique sem servidor.

## Atualização mensal dos dados

Ao rodar a rotina mensal no repositório dos indicadores por cliente
(`dashboard-juridico`), o painel interno reflete os números novos automaticamente
na próxima abertura — sem tocar em nada aqui.

Para atualizar também o embed offline (opcional, mas recomendado para manter o
duplo-clique com dados frescos), copie os JSONs para `src/data-embed.js` seguindo
o script `atualizar.py` na pasta de trabalho local `Dashboard-Interno/`.

## Documentação técnica

- [ARCHITECTURE.md](docs/ARCHITECTURE.md) — como o código está organizado
- [CHANGELOG.md](docs/CHANGELOG.md) — histórico das mudanças
