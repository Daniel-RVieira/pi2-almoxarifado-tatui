<script setup>
const props = defineProps({
  produtos: { type: Array, required: true },
  grupos: { type: Array, required: true },
});

const grupoId = defineModel("grupoId");
const busca = defineModel("busca");

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

const ROTULOS_STATUS = {
  zerado: "Estoque zerado",
  abaixo_minimo: "Abaixo do mínimo",
  proximo_ressuprimento: "Próximo do ressuprimento",
  sem_movimentacao: "Sem movimentação",
  normal: "Normal",
};

function rotuloStatus(status) {
  return ROTULOS_STATUS[status] ?? status;
}
</script>

<template>
  <section aria-labelledby="titulo-produtos">
    <h2 id="titulo-produtos">Produtos do almoxarifado</h2>

    <div class="filtros">
      <div class="campo">
        <label for="filtro-busca">Buscar por descrição</label>
        <input id="filtro-busca" type="search" v-model="busca" placeholder="ex.: papel sulfite" />
      </div>
      <div class="campo">
        <label for="filtro-grupo">Grupo</label>
        <select id="filtro-grupo" v-model="grupoId">
          <option :value="undefined">Todos os grupos</option>
          <option v-for="g in props.grupos" :key="g.id" :value="g.id">{{ g.nome }}</option>
        </select>
      </div>
    </div>

    <div class="tabela-scroll">
      <table>
        <caption class="sr-only">
          Lista de produtos do almoxarifado com código, descrição, grupo, saldo atual, valor em
          estoque e situação em relação ao estoque mínimo e ponto de ressuprimento.
        </caption>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Descrição</th>
            <th scope="col">Grupo</th>
            <th scope="col">Saldo atual</th>
            <th scope="col">Valor em estoque</th>
            <th scope="col">Situação</th>
            <th scope="col">Consumo anual</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="p in props.produtos" :key="p.produto_id" :class="`linha--${p.status}`">
            <td>{{ p.codigo }}</td>
            <td>{{ p.descricao }}</td>
            <td>{{ p.grupo_nome }}</td>
            <td>{{ Number(p.saldo_atual_qtd) }} {{ p.unidade }}</td>
            <td>{{ formatoMoeda.format(p.valor_total ?? 0) }}</td>
            <td>
              <span class="selo" :class="`selo--${p.status}`">{{ rotuloStatus(p.status) }}</span>
            </td>
            <td>
              <router-link :to="`/produtos/${p.codigo}/consumo-anual`">Ver consumo</router-link>
            </td>
          </tr>
          <tr v-if="props.produtos.length === 0">
            <td colspan="7">Nenhum produto encontrado para os filtros atuais.</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  margin: 0.5rem 0 1rem;
}
.campo {
  display: flex;
  flex-direction: column;
}

.tabela-scroll {
  overflow-x: auto;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

.selo {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  border: 1px solid transparent;
}
.selo--zerado { background: var(--cor-perigo-bg); color: var(--cor-perigo); border-color: var(--cor-perigo); }
.selo--abaixo_minimo { background: var(--cor-perigo-bg); color: var(--cor-perigo); border-color: var(--cor-perigo); }
.selo--proximo_ressuprimento { background: var(--cor-alerta-bg); color: var(--cor-alerta); border-color: var(--cor-alerta); }
.selo--sem_movimentacao { background: var(--cor-info-bg); color: var(--cor-info); border-color: var(--cor-info); }
.selo--normal { background: var(--cor-neutro-bg); color: #333; }
</style>
