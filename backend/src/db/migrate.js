import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../config/db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const schemaPath = path.join(__dirname, "schema.sql");
  const schemaSql = readFileSync(schemaPath, "utf-8");

  console.log("Aplicando schema.sql em", process.env.DATABASE_URL);
  await pool.query(schemaSql);
  console.log("Schema aplicado com sucesso.");

  await pool.end();
}

migrate().catch((err) => {
  console.error("Falha ao aplicar o schema:", err);
  process.exit(1);
});
