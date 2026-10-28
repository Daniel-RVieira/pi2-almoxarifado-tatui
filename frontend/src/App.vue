<script setup>
import { useRoute } from "vue-router";

const route = useRoute();
</script>

<template>
  <a class="pular-para-conteudo" href="#conteudo-principal">Pular para o conteúdo</a>

  <header class="cabecalho">
    <router-link to="/" class="cabecalho__titulo">
      Almoxarifado — Câmara Municipal de Tatuí
    </router-link>
    <nav aria-label="Navegação principal" class="cabecalho__nav">
      <router-link to="/">Dashboard</router-link>
      <router-link to="/relatorio-pca">Relatório PCA</router-link>
    </nav>
  </header>

  <main id="conteudo-principal" class="conteudo" :class="{ 'conteudo--largo': route.meta.largo }">
    <router-view />
  </main>
</template>

<style>
.pular-para-conteudo {
  position: absolute;
  left: -9999px;
  top: 0;
  background: #fff;
  color: #111;
  padding: 0.75rem 1rem;
  z-index: 100;
}
.pular-para-conteudo:focus {
  left: 0.5rem;
  top: 0.5rem;
}

.cabecalho {
  background: #1f3a5f;
  color: #fff;
  padding: 0.9rem 1.25rem;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem 1.5rem;
}
.cabecalho__nav {
  display: flex;
  gap: 1rem;
  margin-left: auto;
}
.cabecalho__nav a {
  color: #fff;
  text-decoration: none;
  padding-bottom: 2px;
  border-bottom: 2px solid transparent;
}
.cabecalho__nav a.router-link-exact-active {
  border-bottom-color: #ffd166;
}
.cabecalho__nav a:focus-visible {
  outline: 3px solid #ffd166;
  outline-offset: 2px;
}
@media print {
  .cabecalho,
  .pular-para-conteudo {
    display: none;
  }
  .conteudo {
    max-width: none;
    padding: 0;
  }
  @page {
    size: A4 landscape;
    margin: 12mm;
  }
}
.cabecalho__titulo {
  color: #fff;
  text-decoration: none;
  font-size: 1.15rem;
  font-weight: 700;
}
.cabecalho__titulo:focus-visible {
  outline: 3px solid #ffd166;
  outline-offset: 2px;
}

.conteudo {
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1.25rem 3rem;
}
.conteudo--largo {
  max-width: 1600px;
}
</style>
