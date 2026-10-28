import { pool } from "../config/db.js";
import { parseBalancete } from "../importers/balanceteImporter.js";
import { parseConsumoAnual } from "../importers/consumoAnualImporter.js";

async function upsertGrupo(client, codigo, nome) {
  const { rows } = await client.query(
    `INSERT INTO grupos (codigo, nome)
     VALUES ($1, $2)
     ON CONFLICT (codigo) DO UPDATE SET nome = EXCLUDED.nome
     RETURNING id`,
    [codigo ?? "0", nome ?? "SEM GRUPO"]
  );
  return rows[0].id;
}

async function upsertProduto(client, produto, grupoId) {
  const { rows } = await client.query(
    `INSERT INTO produtos (codigo, descricao, unidade, grupo_id, codigo_legado, atualizado_em)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (codigo) DO UPDATE SET
       descricao = EXCLUDED.descricao,
       unidade = EXCLUDED.unidade,
       grupo_id = EXCLUDED.grupo_id,
       codigo_legado = EXCLUDED.codigo_legado,
       atualizado_em = now()
     RETURNING id, (xmax = 0) AS foi_criado`,
    [produto.codigo, produto.descricao, produto.unidade, grupoId, produto.codigoLegado]
  );
  return rows[0];
}

/**
 * Importa o Balancete Analítico: cria/atualiza grupos e produtos, e registra a
 * movimentação (saldo anterior, entradas, saídas, saldo atual) desta importação.
 */
async function importarBalancete(client, caminhoArquivo, nomeArquivo) {
  const { periodoReferencia, produtos } = parseBalancete(caminhoArquivo);

  const { rows: importacaoRows } = await client.query(
    `INSERT INTO importacoes_arquivo (tipo, nome_arquivo, periodo_referencia)
     VALUES ('balancete', $1, $2)
     RETURNING id`,
    [nomeArquivo, periodoReferencia]
  );
  const importacaoId = importacaoRows[0].id;

  let gruposCriados = 0;
  let produtosCriados = 0;
  let produtosAtualizados = 0;
  const gruposVistos = new Set();

  for (const produto of produtos) {
    const grupoId = await upsertGrupo(client, produto.grupoCodigo, produto.grupoNome);
    if (!gruposVistos.has(produto.grupoCodigo)) {
      gruposVistos.add(produto.grupoCodigo);
      gruposCriados++;
    }

    const { id: produtoId, foi_criado: foiCriado } = await upsertProduto(client, produto, grupoId);
    if (foiCriado) produtosCriados++;
    else produtosAtualizados++;

    await client.query(
      `INSERT INTO movimentacoes (
         produto_id, importacao_id, saldo_anterior_qtd, saldo_anterior_valor,
         entradas_qtd, entradas_valor, saidas_qtd, saidas_valor,
         saldo_atual_qtd, valor_unitario, valor_total, valor_unitario_efetivo
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (produto_id, importacao_id) DO UPDATE SET
         saldo_anterior_qtd = EXCLUDED.saldo_anterior_qtd,
         saldo_anterior_valor = EXCLUDED.saldo_anterior_valor,
         entradas_qtd = EXCLUDED.entradas_qtd,
         entradas_valor = EXCLUDED.entradas_valor,
         saidas_qtd = EXCLUDED.saidas_qtd,
         saidas_valor = EXCLUDED.saidas_valor,
         saldo_atual_qtd = EXCLUDED.saldo_atual_qtd,
         valor_unitario = EXCLUDED.valor_unitario,
         valor_total = EXCLUDED.valor_total,
         valor_unitario_efetivo = EXCLUDED.valor_unitario_efetivo`,
      [
        produtoId,
        importacaoId,
        produto.saldoAnteriorQtd,
        produto.saldoAnteriorValor,
        produto.entradasQtd,
        produto.entradasValor,
        produto.saidasQtd,
        produto.saidasValor,
        produto.saldoAtualQtd,
        produto.valorUnitario,
        produto.valorTotal,
        produto.valorUnitarioEfetivo,
      ]
    );
  }

  return {
    importacaoId,
    periodoReferencia,
    totalProdutos: produtos.length,
    gruposDistintos: gruposVistos.size,
    produtosCriados,
    produtosAtualizados,
  };
}

/**
 * Importa o Consumo Anual por Produto, casando cada item pelo código com o
 * produto já existente (criado pelo Balancete). O valor monetário mensal é
 * CALCULADO (quantidade x valor_unitario do Balancete desta mesma importação)
 * — o campo "Total de Gastos" do CSV de origem é ignorado propositalmente,
 * pois a análise mostrou que ele reflete quantidade, não valor em R$.
 */
async function importarConsumoAnual(client, caminhoArquivo, nomeArquivo, importacaoBalanceteId) {
  const { anoReferencia, mesReferencia, periodoReferencia, itens } = parseConsumoAnual(caminhoArquivo);

  const { rows: importacaoRows } = await client.query(
    `INSERT INTO importacoes_arquivo (tipo, nome_arquivo, periodo_referencia, ano_referencia, mes_referencia)
     VALUES ('consumo_anual', $1, $2, $3, $4)
     RETURNING id`,
    [nomeArquivo, periodoReferencia, anoReferencia, mesReferencia]
  );
  const importacaoId = importacaoRows[0].id;

  let produtosProcessados = 0;
  const produtosNaoEncontrados = [];

  for (const item of itens) {
    const { rows: produtoRows } = await client.query(
      "SELECT id FROM produtos WHERE codigo = $1",
      [item.codigo]
    );
    if (produtoRows.length === 0) {
      produtosNaoEncontrados.push(item.codigo);
      continue;
    }
    const produtoId = produtoRows[0].id;

    // Valor unitário vem sempre do Balancete processado na mesma importação;
    // se por algum motivo o produto não tiver movimentação nesta importação
    // (ex.: arquivos de períodos diferentes), cai para a movimentação mais recente.
    let valorUnitario = 0;
    if (importacaoBalanceteId) {
      const { rows } = await client.query(
        "SELECT valor_unitario_efetivo FROM movimentacoes WHERE produto_id = $1 AND importacao_id = $2",
        [produtoId, importacaoBalanceteId]
      );
      if (rows.length > 0) valorUnitario = Number(rows[0].valor_unitario_efetivo);
    }
    if (!valorUnitario) {
      const { rows } = await client.query(
        `SELECT valor_unitario_efetivo FROM movimentacoes
         WHERE produto_id = $1 ORDER BY importacao_id DESC LIMIT 1`,
        [produtoId]
      );
      if (rows.length > 0) valorUnitario = Number(rows[0].valor_unitario_efetivo);
    }

    for (let mes = 1; mes <= 12; mes++) {
      const quantidade = item.quantidadesPorMes[mes - 1];
      const valorCalculado =
        quantidade === null ? null : Math.round(quantidade * valorUnitario * 100) / 100;

      await client.query(
        `INSERT INTO consumo_mensal (produto_id, importacao_id, ano, mes, quantidade, valor_calculado)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (produto_id, importacao_id, ano, mes) DO UPDATE SET
           quantidade = EXCLUDED.quantidade,
           valor_calculado = EXCLUDED.valor_calculado`,
        [produtoId, importacaoId, anoReferencia, mes, quantidade, valorCalculado]
      );
    }
    produtosProcessados++;
  }

  return {
    importacaoId,
    periodoReferencia,
    anoReferencia,
    mesReferencia,
    totalItens: itens.length,
    produtosProcessados,
    produtosNaoEncontrados,
  };
}

/**
 * Importa os dois arquivos em uma única transação: primeiro o Balancete
 * (cria/atualiza produtos e grupos), depois o Consumo Anual (casa por código
 * e calcula o valor mensal a partir do valor unitário do Balancete recém-importado).
 */
export async function importarArquivos({ balancete, consumoAnual }) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const resumoBalancete = await importarBalancete(client, balancete.caminho, balancete.nomeOriginal);
    let resumoConsumoAnual = null;
    if (consumoAnual) {
      resumoConsumoAnual = await importarConsumoAnual(
        client,
        consumoAnual.caminho,
        consumoAnual.nomeOriginal,
        resumoBalancete.importacaoId
      );
    }

    await client.query("COMMIT");
    return { balancete: resumoBalancete, consumoAnual: resumoConsumoAnual };
  } catch (erro) {
    await client.query("ROLLBACK");
    throw erro;
  } finally {
    client.release();
  }
}
