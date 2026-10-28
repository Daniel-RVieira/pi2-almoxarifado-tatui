# Sistema Web de Monitoramento de Estoque e Apoio ao PCA — Câmara Municipal da Estância Turística de Tatuí

Projeto Integrador II — UNIVESP — Grupo 13.

Sistema web que importa os arquivos CSV exportados pelo sistema JL Soft (módulo de almoxarifado da Câmara Municipal da Estância Turística de Tatuí) — Balancete Analítico e Consumo Anual por Produto — e disponibiliza um dashboard com indicadores de estoque (itens zerados, abaixo do mínimo, próximos do ponto de ressuprimento, sem movimentação) relatórios de consumo anual e um relatório de apoio ao Plano de Contratações Anual (PCA), com a projeção do consumo para os 12 meses seguintes. O PCA é exigido pelo Ato nº 74/2024 da Câmara, que regulamenta a Lei nº 14.133/2021.

## Estrutura do repositório

```
backend/         API REST (Node.js + Express + PostgreSQL) — importação dos CSVs e indicadores
frontend/        Dashboard web (Vue 3 + Vite + Chart.js)
amostras-csv/    Cópias dos CSVs reais do almoxarifado, usadas para desenvolvimento e verificação
```

Os documentos do Projeto Integrador (relatórios, termos e PDFs) não são versionados neste repositório.

## Pré-requisitos (ambiente local)

- Node.js (instalado via Homebrew)
- PostgreSQL 16 (instalado via Homebrew, rodando na porta **5433** para não conflitar com outra instância de PostgreSQL já existente na máquina)

## Banco de dados

Banco de desenvolvimento: `almoxarifado_tatui_dev`, usuário `almoxarifado_app`.

```
psql -p 5433 -d almoxarifado_tatui_dev
```

## Como rodar localmente

Ver instruções detalhadas em `backend/README.md` e `frontend/README.md`.

Resumo:

```bash
# Backend
cd backend
npm install
npm run db:migrate
npm run dev      # http://localhost:3000

# Frontend (outro terminal)
cd frontend
npm install
npm run dev       # http://localhost:5173
```

Depois, acesse o dashboard e importe os dois arquivos de `amostras-csv/` pelo painel de importação.

## Achados importantes sobre os dados de origem (JL Soft)

Documentados em detalhe no relatório do Projeto Integrador. Resumo essencial para quem for mexer no importador:

- Os CSVs são **UTF-8** (não Latin-1).
- Cada linha repete todo o cabeçalho institucional; os campos reais do produto ficam em posições fixas de coluna.
- O campo **"Total de Gastos"** do relatório de Consumo Anual não é valor monetário — é quantidade consumida. O valor de consumo é **calculado** no sistema (quantidade × valor unitário do Balancete), nunca lido diretamente desse campo.
- A descrição do produto no Consumo Anual vem truncada; a descrição completa usada pelo sistema vem sempre do Balancete Analítico.
