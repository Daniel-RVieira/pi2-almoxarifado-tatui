import { Router } from "express";
import {
  listarProdutos,
  obterConsumoAnualProduto,
  atualizarParametros,
} from "../services/indicadoresService.js";

const router = Router();

// GET /api/produtos?grupoId=&busca=
router.get("/", async (req, res) => {
  const { grupoId, busca } = req.query;
  const produtos = await listarProdutos({
    grupoId: grupoId ? Number(grupoId) : undefined,
    busca: busca || undefined,
  });
  res.json(produtos);
});

// GET /api/produtos/:codigo/consumo-anual
router.get("/:codigo/consumo-anual", async (req, res) => {
  const resultado = await obterConsumoAnualProduto(req.params.codigo);
  if (!resultado) return res.status(404).json({ erro: "Produto não encontrado." });
  res.json(resultado);
});

// PUT /api/produtos/:codigo/parametros — estoque mínimo, ponto de ressuprimento,
// estoque máximo e observação livre (sugestão do Roberto Palma).
router.put("/:codigo/parametros", async (req, res) => {
  const atualizado = await atualizarParametros(req.params.codigo, req.body);
  if (!atualizado) return res.status(404).json({ erro: "Produto não encontrado." });
  res.json(atualizado);
});

export default router;
