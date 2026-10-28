<script setup>
import { computed } from "vue";

const props = defineProps({
  resumo: { type: Object, required: true },
});

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const cards = computed(() => [
  {
    chave: "total",
    titulo: "Total de itens",
    valor: props.resumo.totalItens,
    classe: "card--neutro",
  },
  {
    chave: "zerados",
    titulo: "Estoque zerado",
    valor: props.resumo.zerados,
    classe: "card--perigo",
  },
  {
    chave: "abaixoMinimo",
    titulo: "Abaixo do estoque mínimo",
    valor: props.resumo.abaixoDoMinimo,
    classe: "card--perigo",
  },
  {
    chave: "proximoRessuprimento",
    titulo: "Próximos do ponto de ressuprimento",
    valor: props.resumo.proximosRessuprimento,
    classe: "card--alerta",
  },
  {
    chave: "semMovimentacao",
    titulo: "Sem movimentação no ano",
    valor: props.resumo.semMovimentacao,
    classe: "card--info",
  },
]);

const valorTotalFormatado = computed(() => formatoMoeda.format(props.resumo.valorTotalEstoque ?? 0));
</script>

<template>
  <section aria-labelledby="titulo-resumo">
    <h2 id="titulo-resumo">Resumo do estoque</h2>
    <ul class="cards">
      <li v-for="card in cards" :key="card.chave" class="card" :class="card.classe">
        <p class="card__titulo">{{ card.titulo }}</p>
        <p class="card__valor">{{ card.valor }}</p>
      </li>
      <li class="card card--neutro">
        <p class="card__titulo">Valor total em estoque</p>
        <p class="card__valor card__valor--texto">{{ valorTotalFormatado }}</p>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.cards {
  list-style: none;
  margin: 0.5rem 0 1.5rem;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.card {
  border: 1px solid var(--cor-borda);
  border-left-width: 6px;
  border-radius: 6px;
  padding: 0.9rem 1rem;
  background: #fff;
}

.card__titulo {
  margin: 0 0 0.35rem;
  font-size: 0.85rem;
  font-weight: 600;
}

.card__valor {
  margin: 0;
  font-size: 1.9rem;
  font-weight: 700;
}

.card__valor--texto {
  font-size: 1.3rem;
}

.card--neutro { border-left-color: var(--cor-primaria); }
.card--perigo { border-left-color: var(--cor-perigo); background: var(--cor-perigo-bg); }
.card--alerta { border-left-color: var(--cor-alerta); background: var(--cor-alerta-bg); }
.card--info { border-left-color: var(--cor-info); background: var(--cor-info-bg); }
</style>
