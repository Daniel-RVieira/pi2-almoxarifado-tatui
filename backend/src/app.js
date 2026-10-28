import express from "express";
import cors from "cors";
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

// Tratador de erros genérico (evita expor stack trace ao cliente em produção).
app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor." });
});
