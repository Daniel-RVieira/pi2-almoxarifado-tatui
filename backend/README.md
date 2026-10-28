# Backend — API do Almoxarifado

Node.js + Express + PostgreSQL.

## Configuração

```bash
npm install
cp .env.example .env   # ajuste se necessário
npm run db:migrate     # cria/atualiza o schema no Postgres
npm run dev             # http://localhost:3000 (nodemon)
```

Pré-requisito: PostgreSQL 16 rodando localmente na porta **5433** (instalado via Homebrew — veja o README na raiz do projeto), com o banco `almoxarifado_tatui_dev` e o usuário `almoxarifado_app` já criados.

> Atenção: esta máquina tem uma `DATABASE_URL` de outro projeto exportada globalmente no shell (variável de ambiente, não neste repositório). Por isso `src/config/db.js` carrega o `.env` com `override: true` — sem isso, o backend conectaria no banco errado. Não remova esse `override`.

## Endpoints principais

- `POST /api/importacoes` — multipart, campos `balancete` (obrigatório) e `consumoAnual` (opcional).
- `GET /api/produtos?grupoId=&busca=`
- `GET /api/produtos/:codigo/consumo-anual`
- `PUT /api/produtos/:codigo/parametros` — `{ estoqueMinimo, pontoRessuprimento, estoqueMaximo, observacao }`
- `GET /api/grupos`
- `GET /api/dashboard/resumo`
- `GET /api/dashboard/top-consumo?limite=10`
- `GET /api/pca/exercicios` — anos com Consumo Anual importado
- `GET /api/pca?ano=2026&grupoId=&somenteComConsumo=true` — relatório de apoio ao PCA (consumo do exercício e projeção para 12 meses)

## Estrutura

```
src/
  config/db.js        pool de conexão PostgreSQL
  db/schema.sql        schema idempotente
  db/migrate.js        aplica o schema.sql
  importers/            parsing de baixo nível dos CSVs do JL Soft
  services/              regras de negócio (import, indicadores)
  routes/                 endpoints Express
```

## Relatório de apoio ao PCA

`services/pcaService.js`. Para o exercício escolhido (a importação de Consumo
Anual mais recente daquele ano), calcula por produto:

- consumo do ano (quantidade e valor calculado);
- média mensal = consumo ÷ meses decorridos até o mês de referência (ex.: Ref 08/2026 → 8 meses);
- projeção para o ano seguinte = média mensal × 12 (arredondada para cima), valorizada pelo preço médio do consumo no exercício, sem reajuste;
- quantidade sugerida = projeção − saldo atual do Balancete enviado no mesmo upload.

O Balancete "pareado" é localizado pelo `importado_em` idêntico (os dois arquivos
são gravados na mesma transação). A comparação é feita no SQL porque o
timestamp tem microssegundos e o `Date` do JavaScript só guarda milissegundos.

## Regra de negócio importante: preço unitário efetivo

O Balancete relata, na coluna "Vl. Unitário", o preço do **saldo atual** — que
vem 0 sempre que o item termina o período com estoque zerado (justamente os
itens de maior consumo: 82 dos 293 produtos, ~R$ 67 mil em saídas, ficariam
com o consumo mensal calculado como R$ 0,00 se esse campo fosse usado direto).

Por isso `balanceteImporter.js` calcula um `valor_unitario_efetivo` com a
seguinte prioridade: preço médio das saídas do período (`saidas_valor /
saidas_qtd`) → valor unitário do saldo atual → preço médio do saldo anterior.
É esse valor, não o `valor_unitario` bruto, que entra no cálculo de
`valor_calculado` do consumo mensal.
