<script setup>
import { ref, onMounted, watch } from "vue";
import { http } from "../api/http.js";
import ResumoCards from "../components/ResumoCards.vue";
import ImportPanel from "../components/ImportPanel.vue";
import GraficoConsumo from "../components/GraficoConsumo.vue";
import ProdutosTable from "../components/ProdutosTable.vue";

const resumo = ref(null);
const grupos = ref([]);
const produtos = ref([]);
const grupoId = ref(undefined);
const busca = ref("");
const carregandoProdutos = ref(true);
const versaoGrafico = ref(0);

async function carregarResumo() {
  const { data } = await http.get("/dashboard/resumo");
  resumo.value = data;
}

async function carregarGrupos() {
  const { data } = await http.get("/grupos");
  grupos.value = data;
}

// Cada consulta recebe um número; só a mais recente atualiza a tabela. Sem isso,
// com a latência do servidor na nuvem, uma resposta antiga (ex.: de uma letra
// digitada antes) podia chegar depois e sobrescrever o filtro atual.
let ultimaConsulta = 0;

async function carregarProdutos() {
  const consulta = ++ultimaConsulta;
  carregandoProdutos.value = true;
  const { data } = await http.get("/produtos", {
    params: { grupoId: grupoId.value || undefined, busca: busca.value || undefined },
  });
  if (consulta !== ultimaConsulta) return;
  produtos.value = data;
  carregandoProdutos.value = false;
}

// A busca espera 300 ms sem digitação antes de consultar; o grupo filtra na hora.
let esperaBusca = null;
watch(busca, () => {
  clearTimeout(esperaBusca);
  esperaBusca = setTimeout(carregarProdutos, 300);
});

async function carregarTudo() {
  await Promise.all([carregarResumo(), carregarGrupos(), carregarProdutos()]);
  versaoGrafico.value++;
}

function aoImportar() {
  carregarTudo();
}

onMounted(carregarTudo);
watch(grupoId, carregarProdutos);
</script>

<template>
  <h1>Dashboard do Almoxarifado</h1>

  <ImportPanel @importado="aoImportar" />

  <ResumoCards v-if="resumo" :resumo="resumo" />

  <GraficoConsumo :atualizar-em="versaoGrafico" />

  <ProdutosTable
    :produtos="produtos"
    :grupos="grupos"
    v-model:grupo-id="grupoId"
    v-model:busca="busca"
  />
  <p v-if="carregandoProdutos" role="status">Carregando produtos…</p>
</template>
