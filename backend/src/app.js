import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import importRoutes from "./routes/importRoutes.js";
import produtosRoutes from "./routes/produtosRoutes.js";
import indicadoresRoutes from "./routes/indicadoresRoutes.js";
import gruposRoutes from "./routes/gruposRoutes.js";
import pcaRoutes from "./routes/pcaRoutes.js";

export const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

app.use("/api/importacoes", importRoutes);
app.use("/api/produtos", produtosRoutes);
app.use("/api/dashboard", indicadoresRoutes);
app.use("/api/grupos", gruposRoutes);
app.use("/api/pca", pcaRoutes);

// Em produção (ex.: Render), o backend também entrega o frontend compilado
// (frontend/dist), para o sistema inteiro rodar em um único endereço. Em
// desenvolvimento a pasta não existe e o Vite continua servindo o frontend.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pastaFrontend = path.join(__dirname, "..", "..", "frontend", "dist");
if (existsSync(pastaFrontend)) {
  app.use(express.static(pastaFrontend));
  // Rotas do Vue Router (ex.: /relatorio-pca) devolvem o index.html.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api")) return next();
    res.sendFile(path.join(pastaFrontend, "index.html"));
  });
}

// Tratador de erros genérico (evita expor stack trace ao cliente em produção).
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});
