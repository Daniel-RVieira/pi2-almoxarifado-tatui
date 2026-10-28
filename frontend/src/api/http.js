import axios from "axios";

// baseURL relativa: em desenvolvimento o Vite (vite.config.js) faz proxy de
// /api para o backend Express; em produção, backend e frontend ficam atrás
// do mesmo domínio/proxy reverso.
export const http = axios.create({
  baseURL: "/api",
});
