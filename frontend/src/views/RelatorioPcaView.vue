<script setup>
import { computed, onMounted, ref, watch } from "vue";
import { http } from "../api/http.js";

const formatoMoeda = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const formatoQtd = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const moeda = (v) => formatoMoeda.format(v ?? 0);
const qtd = (v) => (v === null || v === undefined ? "—" : formatoQtd.format(v));

const exercicios = ref([]);
const grupos = ref([]);
const ano = ref(undefined);
const grupoId = ref(undefined);
const somenteComConsumo = ref(true);
const relatorio = ref(null);
const carregando = ref(true);
const erro = ref("");

const NOMES_MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho",
  "agosto", "setembro", "outubro", "novembro", "dezembro"];

const descricaoMetodo = computed(() => {
  const e = relatorio.value?.exercicio;
  if (!e) return "";
  const ate = NOMES_MESES[(e.mesReferencia || 12) - 1];
  return `Consumo de janeiro a ${ate} de ${e.ano} (${e.mesesConsiderados} meses). ` +
    `Projeção para ${relatorio.value.anoProjecao} = consumo médio mensal × 12, ` +
    `valorizada pelo preço unitário médio do consumo em ${e.ano}, sem reajuste. ` +
    `Quantidade sugerida = projeção − saldo atual em estoque.`;
});

async function carregarFiltros() {
  const [{ data: listaExercicios }, { data: listaGrupos }] = await Promise.all([
    http.get("/pca/exercicios"),
    http.get("/grupos"),
  ]);
  exercicios.value = listaExercicios;
  grupos.value = listaGrupos;
  if (listaExercicios.length) ano.value = listaExercicios[0].ano;
}

async function carregarRelatorio() {
  if (!ano.value) {
    carregando.value = false;
    return;
  }
  carregando.value = true;
  erro.value = "";
  try {
    const { data } = await http.get("/pca", {
      params: {
        ano: ano.value,
        grupoId: grupoId.value || undefined,
        somenteComConsumo: somenteComConsumo.value,
      },
    });
    relatorio.value = data;
  } catch (err) {
    relatorio.value = null;
    erro.value = err.response?.data?.erro ?? "Não foi possível gerar o relatório.";
  } finally {
    carregando.value = false;
  }
}

// Exportação em CSV no padrão do Excel em português: separador ";", vírgula
// decimal e BOM UTF-8 para os acentos aparecerem corretamente.
function exportarCsv() {
  const r = relatorio.value;
  if (!r) return;
  const num = (v, casas = 2) =>
    v === null || v === undefined ? "" : Number(v).toFixed(casas).replace(".", ",");
  const texto = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const linhas = [[
    "Grupo", "Código", "Descrição", "Unidade",
    `Consumo ${r.exercicio.ano} (qtd.)`, `Valor consumido ${r.exercicio.ano} (R$)`,
    "Média mensal (qtd.)", "Preço unitário (R$)",
    `Projeção ${r.anoProjecao} (qtd.)`, `Valor projetado ${r.anoProjecao} (R$)`,
    "Saldo atual (qtd.)", "Qtd. sugerida para aquisição", "Valor sugerido (R$)",
  ].map(texto).join(";")];
  for (const g of r.grupos) {
    for (const i of g.itens) {
      linhas.push([
        texto(g.nome), texto(i.codigo), texto(i.descricao), texto(i.unidade),
        num(i.quantidadeAno), num(i.valorAno), num(i.mediaMensal), num(i.precoUnitario),
        num(i.projecaoQuantidade, 0), num(i.projecaoValor), num(i.saldoAtual),
        num(i.quantidadeSugerida, 0), num(i.valorSugerido),
      ].join(";"));
    }
  }
  linhas.push([texto("TOTAL GERAL"), "", "", "", "", num(r.totais.valorAno), "", "", "",
    num(r.totais.projecaoValor), "", "", num(r.totais.valorSugerido)].join(";"));

  const blob = new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `relatorio-pca-${r.anoProjecao}-base-${r.exercicio.ano}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function imprimir() {
  window.print();
}

onMounted(async () => {
  await carregarFiltros();
  await carregarRelatorio();
});
watch([ano, grupoId, somenteComConsumo], carregarRelatorio);
</script>

<template>
  <h1>Relatório de apoio ao PCA</h1>
  <p class="subtitulo">
    Consumo de materiais no exercício e projeção para os 12 meses do ano seguinte, para subsidiar o
    Plano de Contratações Anual (Ato nº 74/2024, art. 29).
  </p>

  <div class="filtros nao-imprimir">
    <div class="campo">
      <label for="filtro-ano">Exercício de base</label>
      <select id="filtro-ano" v-model.number="ano" :disabled="!exercicios.length">
        <option v-for="e in exercicios" :key="e.ano" :value="e.ano">
          {{ e.ano }} (ref. {{ e.periodoReferencia }})
        </option>
      </select>
    </div>
    <div class="campo">
      <label for="filtro-grupo-pca">Grupo</label>
      <select id="filtro-grupo-pca" v-model="grupoId">
        <option :value="undefined">Todos os grupos</option>
        <option v-for="g in grupos" :key="g.id" :value="g.id">{{ g.nome }}</option>
      </select>
    </div>
    <div class="campo campo--checkbox">
      <input id="filtro-consumo" type="checkbox" v-model="somenteComConsumo" />
      <label for="filtro-consumo">Somente itens com consumo</label>
    </div>
    <div class="acoes">
      <button type="button" class="botao" :disabled="!relatorio" @click="exportarCsv">Exportar CSV (Excel)</button>
      <button type="button" class="botao botao--secundario" :disabled="!relatorio" @click="imprimir">
        Imprimir / salvar em PDF
      </button>
    </div>
  </div>

  <p v-if="!carregando && !exercicios.length" role="status">
    Nenhum relatório de Consumo Anual foi importado ainda. Importe os arquivos pelo dashboard.
  </p>
  <p v-else-if="carregando" role="status">Gerando relatório…</p>
  <p v-else-if="erro" role="alert">{{ erro }}</p>

  <template v-else-if="relatorio">
    <p class="metodo">{{ descricaoMetodo }}</p>

    <ul class="totais" aria-label="Totais do relatório">
      <li><span>Itens</span><strong>{{ relatorio.totais.itens }}</strong></li>
      <li><span>Valor consumido em {{ relatorio.exercicio.ano }}</span><strong>{{ moeda(relatorio.totais.valorAno) }}</strong></li>
      <li><span>Valor projetado para {{ relatorio.anoProjecao }}</span><strong>{{ moeda(relatorio.totais.projecaoValor) }}</strong></li>
      <li><span>Valor sugerido para aquisição</span><strong>{{ moeda(relatorio.totais.valorSugerido) }}</strong></li>
    </ul>

    <div class="tabela-scroll">
      <table class="tabela-pca">
        <caption class="sr-only">
          Consumo por produto em {{ relatorio.exercicio.ano }} e projeção para {{ relatorio.anoProjecao }},
          agrupado por grupo de material, com subtotais por grupo e total geral.
        </caption>
        <thead>
          <tr>
            <th scope="col">Código</th>
            <th scope="col">Descrição</th>
            <th scope="col">Unid.</th>
            <th scope="col" class="num">Consumo {{ relatorio.exercicio.ano }} (qtd.)</th>
            <th scope="col" class="num">Valor consumido</th>
            <th scope="col" class="num">Média mensal</th>
            <th scope="col" class="num">Preço unit.</th>
            <th scope="col" class="num">Projeção {{ relatorio.anoProjecao }} (qtd.)</th>
            <th scope="col" class="num">Valor projetado</th>
            <th scope="col" class="num">Saldo atual</th>
            <th scope="col" class="num">Qtd. sugerida</th>
            <th scope="col" class="num">Valor sugerido</th>
          </tr>
        </thead>
        <tbody v-for="g in relatorio.grupos" :key="g.id">
          <tr class="linha-grupo">
            <th scope="colgroup" colspan="12">{{ g.codigo }} - {{ g.nome }}</th>
          </tr>
          <tr v-for="i in g.itens" :key="i.codigo">
            <td>{{ i.codigo }}</td>
            <td>{{ i.descricao }}</td>
            <td>{{ i.unidade }}</td>
            <td class="num">{{ qtd(i.quantidadeAno) }}</td>
            <td class="num">{{ moeda(i.valorAno) }}</td>
            <td class="num">{{ qtd(i.mediaMensal) }}</td>
            <td class="num">{{ moeda(i.precoUnitario) }}</td>
            <td class="num">{{ qtd(i.projecaoQuantidade) }}</td>
            <td class="num">{{ moeda(i.projecaoValor) }}</td>
            <td class="num">{{ qtd(i.saldoAtual) }}</td>
            <td class="num destaque">{{ qtd(i.quantidadeSugerida) }}</td>
            <td class="num destaque">{{ moeda(i.valorSugerido) }}</td>
          </tr>
          <tr class="linha-subtotal">
            <th scope="row" colspan="4">Subtotal {{ g.nome }} ({{ g.totais.itens }} itens)</th>
            <td class="num">{{ moeda(g.totais.valorAno) }}</td>
            <td colspan="3"></td>
            <td class="num">{{ moeda(g.totais.projecaoValor) }}</td>
            <td colspan="2"></td>
            <td class="num">{{ moeda(g.totais.valorSugerido) }}</td>
          </tr>
        </tbody>
        <!-- tbody (e não tfoot): o navegador repetiria um tfoot no fim de cada página impressa -->
        <tbody>
          <tr class="linha-total">
            <th scope="row" colspan="4">Total geral ({{ relatorio.totais.itens }} itens)</th>
            <td class="num">{{ moeda(relatorio.totais.valorAno) }}</td>
            <td colspan="3"></td>
            <td class="num">{{ moeda(relatorio.totais.projecaoValor) }}</td>
            <td colspan="2"></td>
            <td class="num">{{ moeda(relatorio.totais.valorSugerido) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="rodape">
      Fontes: Consumo Anual por Produto ({{ relatorio.exercicio.arquivoConsumo }}, ref.
      {{ String(relatorio.exercicio.mesReferencia).padStart(2, "0") }}/{{ relatorio.exercicio.ano }})
      <template v-if="relatorio.exercicio.periodoBalancete">
        e Balancete Analítico ({{ relatorio.exercicio.periodoBalancete }})</template>, exportados do JL Soft.
      Relatório gerado em {{ new Date().toLocaleDateString("pt-BR") }}.
    </p>
  </template>
</template>

<style scoped>
.subtitulo {
  margin-top: -0.5rem;
}
.filtros {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
  margin: 1rem 0;
}
.campo {
  display: flex;
  flex-direction: column;
}
.campo--checkbox {
  flex-direction: row;
  align-items: center;
  gap: 0.4rem;
  padding-bottom: 0.5rem;
}
.campo--checkbox label {
  margin: 0;
}
.acoes {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}
.botao {
  background: var(--cor-primaria);
  color: #fff;
  border: 1px solid var(--cor-primaria);
  border-radius: 4px;
  padding: 0.5rem 0.9rem;
}
.botao--secundario {
  background: #fff;
  color: var(--cor-primaria);
}
.botao:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.metodo {
  background: var(--cor-info-bg);
  border-left: 4px solid var(--cor-info);
  padding: 0.6rem 0.8rem;
  font-size: 0.95rem;
}
.totais {
  list-style: none;
  padding: 0;
  margin: 1rem 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.75rem;
}
.totais li {
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-left: 6px solid var(--cor-primaria);
  border-radius: 6px;
  padding: 0.7rem 0.9rem;
  display: flex;
  flex-direction: column;
}
.totais span {
  font-size: 0.85rem;
  font-weight: 600;
}
.totais strong {
  font-size: 1.35rem;
}
.tabela-scroll {
  overflow-x: auto;
  background: #fff;
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
}
.tabela-pca {
  font-size: 0.85rem;
}
.tabela-pca th,
.tabela-pca td {
  padding: 0.35rem 0.45rem;
  vertical-align: top;
}
.num {
  text-align: right;
  white-space: nowrap;
}
.tabela-pca td:nth-child(2) {
  min-width: 16rem;
}
.linha-grupo th {
  background: var(--cor-neutro-bg);
  font-weight: 700;
}
.linha-subtotal th,
.linha-subtotal td {
  font-weight: 600;
  border-bottom: 2px solid var(--cor-borda);
}
.linha-total th,
.linha-total td {
  font-weight: 700;
  background: var(--cor-neutro-bg);
}
.destaque {
  font-weight: 600;
}
.rodape {
  font-size: 0.85rem;
  margin-top: 1rem;
}
.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media print {
  .nao-imprimir {
    display: none !important;
  }
  .tabela-scroll {
    overflow: visible;
    border: none;
  }
  .tabela-pca {
    font-size: 8pt;
  }
  .tabela-pca tr {
    break-inside: avoid;
  }
  .totais li {
    border-left-width: 3px;
  }
}
</style>
