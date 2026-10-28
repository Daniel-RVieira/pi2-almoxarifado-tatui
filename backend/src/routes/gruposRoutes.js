import { Router } from "express";
import { listarGrupos } from "../services/indicadoresService.js";

const router = Router();

// GET /api/grupos
router.get("/", async (_req, res) => {
  res.json(await listarGrupos());
});

export default router;
