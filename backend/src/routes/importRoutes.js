import { Router } from "express";
import multer from "multer";
import { unlink } from "node:fs/promises";
import { importarArquivos } from "../services/importService.js";

const upload = multer({ dest: "uploads/" });
const router = Router();

// POST /api/importacoes — recebe os dois CSVs (Balancete Analítico e Consumo
// Anual por Produto) em um único upload multipart e processa em uma transação.
router.post(
  "/",
  upload.fields([
    { name: "balancete", maxCount: 1 },
    { name: "consumoAnual", maxCount: 1 },
  ]),
  async (req, res) => {
    const arquivoBalancete = req.files?.balancete?.[0];
    const arquivoConsumoAnual = req.files?.consumoAnual?.[0];

    if (!arquivoBalancete) {
      return res.status(400).json({ erro: "É obrigatório enviar o arquivo do Balancete Analítico (campo 'balancete')." });
    }

    try {
      const resumo = await importarArquivos({
        balancete: { caminho: arquivoBalancete.path, nomeOriginal: arquivoBalancete.originalname },
        consumoAnual: arquivoConsumoAnual
          ? { caminho: arquivoConsumoAnual.path, nomeOriginal: arquivoConsumoAnual.originalname }
          : null,
      });
      res.status(201).json(resumo);
    } catch (erro) {
      console.error("Erro ao importar arquivos:", erro);
      res.status(500).json({ erro: "Falha ao processar a importação.", detalhe: erro.message });
    } finally {
      await Promise.all(
        [arquivoBalancete, arquivoConsumoAnual]
          .filter(Boolean)
          .map((arquivo) => unlink(arquivo.path).catch(() => {}))
      );
    }
  }
);

export default router;
