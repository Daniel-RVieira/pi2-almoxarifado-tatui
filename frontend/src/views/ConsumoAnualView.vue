<script setup>
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from "vue";
import {
  Chart,
  LineController,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Title,
} from "chart.js";
import { http } from "../api/http.js";

Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Title);

const props = defineProps({
  codigo: { type: String, required: true },
});

const NOMES_MESES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const dados = ref(null);
const carregando = ref(true);
const naoEncontrado = ref(false);
const canvasRef = ref(null);
let instanciaGrafico = null;

async function carregar() {
  carregando.value = true;
  naoEncontrado.value = false;
  try {
    const { data } = await http.get(`/produtos/${props.codigo}/consumo-anual`);
    dados.value = data;
    // carregando precisa virar false ANTES de desenhar: o <canvas> fica
    // dentro do v-else-if="dados", que só é escolhido quando v-if="carregando"
    // já for falso. Se isso ficasse para o finally (depois de desenharGrafico),
    // o canvas ainda não existiria no DOM e o Chart.js falharia ao tentar
    // obter o contexto 2D ("can't acquire context from the given item").
    carregando.value = false;
    await nextTick();
    desenharGrafico();
  } catch (err) {
    carregando.value = false;
    if (err.response?.status === 404) naoEncontrado.value = true;
    else throw err;
  }
}

function desenharGrafico() {
  if (!dados.value?.meses?.length) return;
  const quantidades = dados.value.meses.map((m) => (m.quantidade === null ? null : Number(m.quantidade)));

  if (instanciaGrafico) instanciaGrafico.destroy();
  instanciaGrafico = new Chart(canvasRef.value, {
    type: "line",
    data: {
      labels: NOMES_MESES,
      datasets: [
        {
          label: "Quantidade consumida por mês",
          data: quantidades,
          borderColor: "#1f3a5f",
          backgroundColor: "#1f3a5f",
          spanGaps: false,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: {
        title: { display: true, text: `Consumo mensal — ${dados.value.produto.descricao}` },
      },
      scales: { y: { beginAtZero: true } },
    },
  });
}

onMounted(carregar);
watch(() => props.codigo, carregar);
onBeforeUnmount(() => instanciaGrafico?.destroy());
</script>

<template>
  <p><router-link to="/">&larr; Voltar ao dashboard</router-link></p>

  <p v-if="carregando" role="status">Carregando…</p>
  <p v-else-if="naoEncontrado" role="alert">Produto "{{ props.codigo }}" não encontrado.</p>

  <template v-else-if="dados">
    <h1>Consumo anual — {{ dados.produto.descricao }}</h1>
    <p>Código: {{ dados.produto.codigo }} · Ano de referência: {{ dados.anoReferencia ?? "—" }}</p>

    <section aria-labelledby="titulo-grafico-mensal" class="grafico-container">
      <h2 id="titulo-grafico-mensal" class="sr-only">Gráfico de consumo mensal</h2>
      <canvas
        v-if="dados.meses.length"
        ref="canvasRef"
        role="img"
        :aria-label="`Gráfico de linha do consumo mensal de ${dados.produto.descricao}`"
      ></canvas>
      <p v-else>Ainda não há Consumo Anual importado para este produto.</p>
    </section>

    <table v-if="dados.meses.length">
      <caption class="sr-only">Consumo mensal, quantidade e valor calculado por mês</caption>
      <thead>
        <tr>
          <th scope="col">Mês</th>
          <th scope="col">Quantidade consumida</th>
          <th scope="col">Valor calculado</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="m in dados.meses" :key="m.mes">
          <td>{{ NOMES_MESES[m.mes - 1] }}</td>
          <td>{{ m.quantidade === null ? "—" : Number(m.quantidade) }}</td>
          <td>{{ m.valor_calculado === null ? "—" : formatoMoeda.format(m.valor_calculado) }}</td>
        </tr>
      </tbody>
    </table>
  </template>
</template>

<style scoped>
.grafico-container {
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 1rem 1.1rem;
  margin: 1rem 0 1.5rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}
</style>
