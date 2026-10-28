<script setup>
import { ref } from "vue";
import { http } from "../api/http.js";

const emit = defineEmits(["importado"]);

const arquivoBalancete = ref(null);
const arquivoConsumoAnual = ref(null);
const enviando = ref(false);
const mensagem = ref("");
const erro = ref("");

function onBalanceteChange(evento) {
  arquivoBalancete.value = evento.target.files[0] ?? null;
}
function onConsumoAnualChange(evento) {
  arquivoConsumoAnual.value = evento.target.files[0] ?? null;
}

async function enviarImportacao() {
  erro.value = "";
  mensagem.value = "";

  if (!arquivoBalancete.value) {
    erro.value = "Selecione o arquivo do Balancete Analítico (obrigatório).";
    return;
  }

  const formData = new FormData();
  formData.append("balancete", arquivoBalancete.value);
  if (arquivoConsumoAnual.value) {
    formData.append("consumoAnual", arquivoConsumoAnual.value);
  }

  enviando.value = true;
  try {
    const { data } = await http.post("/importacoes", formData);
    const totalProdutos = data.balancete?.totalProdutos ?? 0;
    const naoEncontrados = data.consumoAnual?.produtosNaoEncontrados?.length ?? 0;
    mensagem.value = `Importação concluída: ${totalProdutos} produtos processados` +
      (data.consumoAnual ? `, ${data.consumoAnual.produtosProcessados} com consumo anual atualizado` : "") +
      (naoEncontrados ? `. ${naoEncontrados} código(s) do Consumo Anual não encontrados no Balancete.` : ".");
    emit("importado");
  } catch (err) {
    erro.value = err.response?.data?.erro || "Falha ao importar os arquivos. Tente novamente.";
  } finally {
    enviando.value = false;
  }
}
</script>

<template>
  <section aria-labelledby="titulo-importacao" class="painel-importacao">
    <h2 id="titulo-importacao">Importar arquivos do JL Soft</h2>
    <form @submit.prevent="enviarImportacao">
      <div class="campo">
        <label for="input-balancete">Balancete Analítico (CSV) *</label>
        <input id="input-balancete" type="file" accept=".csv" required @change="onBalanceteChange" />
      </div>
      <div class="campo">
        <label for="input-consumo-anual">Consumo Anual por Produto (CSV)</label>
        <input id="input-consumo-anual" type="file" accept=".csv" @change="onConsumoAnualChange" />
      </div>
      <button type="submit" :disabled="enviando">
        {{ enviando ? "Importando…" : "Importar" }}
      </button>
    </form>

    <p role="status" aria-live="polite" class="mensagem" v-if="mensagem">{{ mensagem }}</p>
    <p role="alert" class="mensagem mensagem--erro" v-if="erro">{{ erro }}</p>
  </section>
</template>

<style scoped>
.painel-importacao {
  border: 1px solid var(--cor-borda);
  border-radius: 6px;
  padding: 1rem 1.1rem;
  background: #fff;
  margin-bottom: 1.5rem;
}

form {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 1rem;
}

.campo {
  display: flex;
  flex-direction: column;
}

button {
  background: var(--cor-primaria);
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.55rem 1.1rem;
}
button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.mensagem {
  margin-top: 0.9rem;
}
.mensagem--erro {
  color: var(--cor-perigo);
  font-weight: 600;
}
</style>
