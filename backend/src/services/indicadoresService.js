import { pool } from "../config/db.js";

/**
 * Retorna um Map<produto_id, quantidadeTotalNoAno> a partir da importação de
 * Consumo Anual mais recente. Usado para o indicador "sem movimentação"
 * (sugestão do servidor Roberto Palma, seção 2.5.6 do Relatório Parcial —
 * hoje sustentada pelos dados reais: 194 dos 293 itens sem nenhuma saída).
 */
async function buscarConsumoTotalPorProduto() {
  const { rows: ultimaImportacaoRows } = await pool.query(
    `SELECT id FROM importacoes_arquivo
     WHERE tipo = 'consumo_anual'
     ORDER BY importado_em DESC LIMIT 1`
  );
  if (ultimaImportacaoRows.length === 0) return new Map();

  const importacaoId = ultimaImportacaoRows[0].id;
  const { rows } = await pool.query(
    `SELECT produto_id, COALESCE(SUM(quantidade), 0) AS total
     FROM consumo_mensal
     WHERE importacao_id = $1
     GROUP BY produto_id`,
    [importacaoId]
  );

  return new Map(rows.map((r) => [r.produto_id, Number(r.total)]));
}

/**
 * Classifica o status de estoque de um produto para destaque no dashboard.
 * Categorias mutuamente exclusivas, na ordem de prioridade abaixo.
 */
function calcularStatus(produto, totalConsumoAno) {
  const saldo = Number(produto.saldo_atual_qtd);
  const minimo = Number(produto.estoque_minimo);
  const ressuprimento = Number(produto.ponto_ressuprimento);

  if (saldo <= 0) return "zerado";
  if (minimo > 0 && saldo < minimo) return "abaixo_minimo";
  if (ressuprimento > 0 && saldo <= ressuprimento) return "proximo_ressuprimento";
  if (totalConsumoAno === 0) return "sem_movimentacao";
  return "normal";
}

/**
 * Lista os produtos com o estado atual de estoque, filtráveis por grupo e por
 * busca textual na descrição, cada um já com o `status` calculado.
 */
export async function listarProdutos({ grupoId, busca } = {}) {
  const condicoes = [];
  const valores = [];

  if (grupoId) {
    valores.push(grupoId);
    condicoes.push(`grupo_id = $${valores.length}`);
  }
  if (busca) {
    valores.push(`%${busca}%`);
    condicoes.push(`descricao ILIKE $${valores.length}`);
  }

  const where = condicoes.length ? `WHERE ${condicoes.join(" AND ")}` : "";
  const { rows } = await pool.query(
    `SELECT * FROM vw_estado_atual ${where} ORDER BY descricao`,
    valores
  );

  const consumoPorProduto = await buscarConsumoTotalPorProduto();

  return rows.map((produto) => ({
    ...produto,
    consumoTotalAno: consumoPorProduto.get(produto.produto_id) ?? 0,
    status: calcularStatus(produto, consumoPorProduto.get(produto.produto_id) ?? 0),
  }));
}

/**
 * Resumo agregado para os cards do dashboard.
 */
export async function obterResumo() {
  const produtos = await listarProdutos();

  const contagem = {
    totalItens: produtos.length,
    zerados: 0,
    abaixoDoMinimo: 0,
    proximosRessuprimento: 0,
    semMovimentacao: 0,
  };

  let valorTotalEstoque = 0;
  for (const produto of produtos) {
    valorTotalEstoque += Number(produto.valor_total ?? 0);
    if (produto.status === "zerado") contagem.zerados++;
    else if (produto.status === "abaixo_minimo") contagem.abaixoDoMinimo++;
    else if (produto.status === "proximo_ressuprimento") contagem.proximosRessuprimento++;
    else if (produto.status === "sem_movimentacao") contagem.semMovimentacao++;
  }

  return { ...contagem, valorTotalEstoque };
}

/**
 * Ranking dos produtos com maior valor de consumo no ano (importação de
 * Consumo Anual mais recente), para o gráfico de barras do dashboard.
 */
export async function obterTopConsumo(limite = 10) {
  const { rows: ultimaImportacaoRows } = await pool.query(
    `SELECT id FROM importacoes_arquivo
     WHERE tipo = 'consumo_anual'
     ORDER BY importado_em DESC LIMIT 1`
  );
  if (ultimaImportacaoRows.length === 0) return [];

  const importacaoId = ultimaImportacaoRows[0].id;
  const { rows } = await pool.query(
    `SELECT p.codigo, p.descricao, SUM(cm.valor_calculado) AS valor_total_ano
     FROM consumo_mensal cm
     JOIN produtos p ON p.id = cm.produto_id
     WHERE cm.importacao_id = $1
     GROUP BY p.id, p.codigo, p.descricao
     HAVING SUM(cm.valor_calculado) > 0
     ORDER BY valor_total_ano DESC
     LIMIT $2`,
    [importacaoId, limite]
  );

  return rows.map((r) => ({ ...r, valor_total_ano: Number(r.valor_total_ano) }));
}

/**
 * Consumo mês a mês do produto (importação de Consumo Anual mais recente).
 */
export async function obterConsumoAnualProduto(codigo) {
  const { rows: produtoRows } = await pool.query(
    "SELECT id, codigo, descricao FROM produtos WHERE codigo = $1",
    [codigo]
  );
  if (produtoRows.length === 0) return null;
  const produto = produtoRows[0];

  const { rows: importacaoRows } = await pool.query(
    `SELECT id, ano_referencia, mes_referencia FROM importacoes_arquivo
     WHERE tipo = 'consumo_anual' ORDER BY importado_em DESC LIMIT 1`
  );
  if (importacaoRows.length === 0) {
    return { produto, anoReferencia: null, meses: [] };
  }
  const importacao = importacaoRows[0];

  const { rows: meses } = await pool.query(
    `SELECT mes, quantidade, valor_calculado
     FROM consumo_mensal
     WHERE produto_id = $1 AND importacao_id = $2
     ORDER BY mes`,
    [produto.id, importacao.id]
  );

  return { produto, anoReferencia: importacao.ano_referencia, meses };
}

export async function listarGrupos() {
  const { rows } = await pool.query("SELECT id, codigo, nome FROM grupos ORDER BY nome");
  return rows;
}

export async function atualizarParametros(codigo, { estoqueMinimo, pontoRessuprimento, estoqueMaximo, observacao }) {
  const { rows: produtoRows } = await pool.query("SELECT id FROM produtos WHERE codigo = $1", [codigo]);
  if (produtoRows.length === 0) return null;
  const produtoId = produtoRows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO parametros_estoque (produto_id, estoque_minimo, ponto_ressuprimento, estoque_maximo, observacao)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (produto_id) DO UPDATE SET
       estoque_minimo = EXCLUDED.estoque_minimo,
       ponto_ressuprimento = EXCLUDED.ponto_ressuprimento,
       estoque_maximo = EXCLUDED.estoque_maximo,
       observacao = EXCLUDED.observacao
     RETURNING *`,
    [produtoId, estoqueMinimo ?? 0, pontoRessuprimento ?? 0, estoqueMaximo ?? null, observacao ?? null]
  );
  return rows[0];
}
