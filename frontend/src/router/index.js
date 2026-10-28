import { createRouter, createWebHistory } from "vue-router";
import DashboardView from "../views/DashboardView.vue";
import ConsumoAnualView from "../views/ConsumoAnualView.vue";
import RelatorioPcaView from "../views/RelatorioPcaView.vue";

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", name: "dashboard", component: DashboardView },
    {
      path: "/produtos/:codigo/consumo-anual",
      name: "consumo-anual",
      component: ConsumoAnualView,
      props: true,
    },
    // meta.largo: tabela com 12 colunas, usa a largura maior definida em App.vue
    { path: "/relatorio-pca", name: "relatorio-pca", component: RelatorioPcaView, meta: { largo: true } },
  ],
});

export default router;
