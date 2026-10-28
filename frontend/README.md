# Frontend — Dashboard do Almoxarifado

Vue 3 + Vite + Chart.js.

## Configuração

```bash
npm install
npm run dev       # http://localhost:5173, com proxy de /api para o backend em :3000
```

O backend precisa estar rodando (`cd ../backend && npm run dev`) para as chamadas `/api/*` funcionarem — o proxy está configurado em `vite.config.js`.

## Estrutura

```
src/
  api/http.js                 instância axios (baseURL "/api")
  router/index.js              rotas: "/", "/produtos/:codigo/consumo-anual" e "/relatorio-pca"
  views/DashboardView.vue      página principal
  views/ConsumoAnualView.vue   detalhe de consumo mensal por produto
  views/RelatorioPcaView.vue   relatório de apoio ao PCA (consumo + projeção 12 meses, exporta CSV e imprime/salva PDF)
  components/
    ImportPanel.vue    upload dos dois CSVs
    ResumoCards.vue    cards de indicadores
    GraficoConsumo.vue gráfico de barras (top consumo)
    ProdutosTable.vue  tabela filtrável de produtos
```

## Acessibilidade (WCAG 2.1 AA)

- Link "pular para o conteúdo", landmarks semânticos (`header`, `main`).
- Tabelas com `<caption>` e `<th scope="col">`.
- Status de estoque exibido como texto (selo), nunca só por cor.
- Formulário de importação com `<label for>` e mensagens de status/erro em `aria-live`/`role="alert"`.
- Gráficos com `role="img"` e `aria-label` descritivo (o Chart.js não gera isso sozinho).
