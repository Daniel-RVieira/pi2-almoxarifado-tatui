import pg from "pg";
import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import path from "node:path";

// override: true é proposital — esta máquina tem uma DATABASE_URL de OUTRO
// projeto ("despesas") exportada globalmente no shell. Sem override, o dotenv
// não sobrescreve variáveis já presentes no ambiente e o backend acabaria
// conectando no banco errado. O .env deste projeto sempre tem prioridade.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env"), override: true });

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL não definida. Copie backend/.env.example para backend/.env e ajuste os valores."
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

pool.on("error", (err) => {
  console.error("Erro inesperado no pool de conexões do PostgreSQL:", err);
});
