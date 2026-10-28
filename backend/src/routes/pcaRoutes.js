import { Router } from "express";
import { listarExercicios, obterRelatorioPca } from "../services/pcaService.js";

const router = Router();

// GET /api/pca/exercicios — anos com Consumo Anual importado.
router.get("/exercicios", async (_req, res) => {
  res.json(await listarExercicios());
});

// GET /api/pca?ano=2026&grupoId=&somenteComConsumo=true — relatório de apoio ao PCA.
router.get("/", async (req, res) => {
  const { ano, grupoId, somenteComConsumo } = req.query;
  const relatorio = await obterRelatorioPca({
    ano: ano ? Number(ano) : undefined,
    grupoId: grupoId ? Number(grupoId) : undefined,
    somenteComConsumo: somenteComConsumo !== "false",
  });
  if (!relatorio) return res.status(404).json({ erro: "Nenhum Consumo Anual importado para o exercício informado." });
  res.json(relatorio);
});

export default router;
