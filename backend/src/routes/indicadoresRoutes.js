import { Router } from "express";
import { obterResumo, obterTopConsumo } from "../services/indicadoresService.js";

const router = Router();

// GET /api/dashboard/resumo — cards de indicadores do dashboard.
router.get("/resumo", async (_req, res) => {
  res.json(await obterResumo());
});

// GET /api/dashboard/top-consumo?limite=10 — ranking para o gráfico de barras.
router.get("/top-consumo", async (req, res) => {
  const limite = Number(req.query.limite) || 10;
  res.json(await obterTopConsumo(limite));
});

export default router;
