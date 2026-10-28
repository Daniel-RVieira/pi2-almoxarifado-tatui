<script setup>
import { onMounted, onBeforeUnmount, ref, watch } from "vue";
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Title,
} from "chart.js";
import { http } from "../api/http.js";

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip, Title);

const props = defineProps({
  atualizarEm: { type: Number, default: 0 }, // muda para forçar recarregar após nova importação
});

const canvasRef = ref(null);
let instanciaGrafico = null;
const carregando = ref(true);
const semDados = ref(false);

async function carregarGrafico() {
  carregando.value = true;
  const { data } = await http.get("/dashboard/top-consumo", { params: { limite: 10 } });
  carregando.value = false;
  semDados.value = data.length === 0;
  if (semDados.value) return;

  const rotulos = data.map((d) => `${d.codigo}`);
  const valores = data.map((d) => d.valor_total_ano);
  const descricoes = data.map((d) => d.descricao);

  if (instanciaGrafico) instanciaGrafico.destroy();
  instanciaGrafico = new Chart(canvasRef.value, {
    type: "bar",
    data: {
      labels: rotulos,
      datasets: [
        {
          label: "Valor de consumo no ano (R$)",
          data: valores,
          backgroundColor: "#1f3a5f",
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: "Top 10 itens por valor de consumo no ano" },
        tooltip: {
          callbacks: {
            title: (contexto) => descricoes[contexto[0].dataIndex],
          },
        },
      },
      scales: {
        y: { beginAtZero: true },
      },
    },
  });
}

onMounted(carregarGrafico);
watch(() => props.atualizarEm, carregarGrafico);
onBeforeUnmount(() => instanciaGrafico?.destroy());
</script>

<template>
  <section aria-labelledby="titulo-grafico-consumo" class="grafico-container">
    <h2 id="titulo-grafico-consumo">Itens de maior consumo</h2>
    <p v-if="carregando">Carregando gráfico…</p>
    <p v-else-if="semDados">Ainda não há dados de consumo importados.</p>
    <canvas v-show="!carregando && !semDados" ref="canvasRef" role="img" aria-label="Gráfico de barras dos 10 produtos com maior valor de consumo no ano"></canvas>
  </section>
</template>

<style scoped>
.grafico-container {
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 1rem 1.1rem;
  margin: 1.5rem 0;
}
</style>
