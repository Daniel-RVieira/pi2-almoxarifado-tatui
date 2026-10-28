import { pool } from "../config/db.js";

/**
 * Exercícios disponíveis para o relatório do PCA: um por ano de referência,
 * usando sempre a importação de Consumo Anual mais recente daquele ano.
 */
export async function listarExercicios() {
  const { rows } = await pool.query(
    `SELECT DISTINCT ON (ano_referencia)
            id, ano_referencia, mes_referencia, periodo_referencia, nome_arquivo, importado_em
     FROM importacoes_arquivo
     WHERE tipo = 'consumo_anual' AND ano_referencia IS NOT NULL
     ORDER BY ano_referencia DESC, importado_em DESC, id DESC`
  );
  return rows.map((r) => ({
    importacaoId: r.id,
    ano: r.ano_referencia,
    mesReferencia: r.mes_referencia,
    periodoReferencia: r.periodo_referencia,
    nomeArquivo: r.nome_arquivo,
    importadoEm: r.importado_em,
  }));
}

/**
 * Balancete enviado no mesmo upload do Consumo Anual. Os dois são gravados na
 * mesma transação, então compartilham o mesmo `importado_em` (now() é fixo
 * dentro da transação).
 */
async function buscarBalancetePareado(importacaoConsumo) {
  // A comparação fica no SQL: o timestamp tem microssegundos, e o Date do
  // JavaScript só guarda milissegundos.
  const { rows } = await pool.query(
    `SELECT b.id, b.periodo_referencia
     FROM importacoes_arquivo b
     JOIN importacoes_arquivo c ON c.id = $1 AND b.importado_em = c.importado_em
     WHERE b.tipo = 'balancete'
     ORDER BY b.id DESC LIMIT 1`,
    [importacaoConsumo.importacaoId]
  );
  return rows[0] ?? null;
}

const arred2 = (n) => Math.round(n * 100) / 100;

/**
 * Relatório de apoio ao Plano de Contratações Anual (PCA).
 *
 * Para cada produto: consumo do exercício (quantidade e valor), consumo médio
 * mensal, projeção para os próximos 12 meses e a quantidade sugerida para
 * aquisição, descontado o saldo atual em estoque.
 *
 * Projeção = consumo médio mensal x 12, em que a média considera apenas os
 * meses já decorridos até o mês de referência do arquivo (ex.: Ref 08/2026 ->
 * 8 meses). O valor projetado usa o preço unitário efetivo do exercício e não
 * aplica reajuste de preços.
 */
export async function obterRelatorioPca({ ano, grupoId, somenteComConsumo = true } = {}) {
  const exercicios = await listarExercicios();
  if (exercicios.length === 0) return null;

  const exercicio = ano ? exercicios.find((e) => e.ano === ano) : exercicios[0];
  if (!exercicio) return null;

  const balancete = await buscarBalancetePareado(exercicio);
  const mesesConsiderados = exercicio.mesReferencia || 12;

  const valores = [exercicio.importacaoId, balancete?.id ?? null];
  let filtroGrupo = "";
  if (grupoId) {
    valores.push(grupoId);
    filtroGrupo = `AND p.grupo_id = $${valores.length}`;
  }

  const { rows } = await pool.query(
    `SELECT p.codigo, p.descricao, p.unidade,
            g.id AS grupo_id, g.codigo AS grupo_codigo, g.nome AS grupo_nome,
            COALESCE(SUM(cm.quantidade), 0)      AS quantidade_ano,
            COALESCE(SUM(cm.valor_calculado), 0) AS valor_ano,
            m.valor_unitario_efetivo,
            m.saldo_atual_qtd
     FROM consumo_mensal cm
     JOIN produtos p ON p.id = cm.produto_id
     JOIN grupos g ON g.id = p.grupo_id
     LEFT JOIN movimentacoes m ON m.produto_id = p.id AND m.importacao_id = $2
     WHERE cm.importacao_id = $1 ${filtroGrupo}
     GROUP BY p.id, g.id, m.valor_unitario_efetivo, m.saldo_atual_qtd
     ${somenteComConsumo ? "HAVING COALESCE(SUM(cm.quantidade), 0) > 0" : ""}
     ORDER BY g.nome, p.descricao`,
    valores
  );

  const itens = rows.map((r) => {
    const quantidadeAno = Number(r.quantidade_ano);
    const valorAno = Number(r.valor_ano);
    // Preço médio do consumo no exercício; sem consumo, cai para o preço
    // unitário efetivo do Balancete pareado.
    const precoUnitario = quantidadeAno > 0 ? valorAno / quantidadeAno : Number(r.valor_unitario_efetivo ?? 0);
    const mediaMensal = quantidadeAno / mesesConsiderados;
    const projecaoQuantidade = Math.ceil(mediaMensal * 12 - 1e-9);
    const saldoAtual = r.saldo_atual_qtd === null ? null : Number(r.saldo_atual_qtd);
    const quantidadeSugerida = Math.max(0, Math.ceil(projecaoQuantidade - (saldoAtual ?? 0) - 1e-9));

    return {
      codigo: r.codigo,
      descricao: r.descricao,
      unidade: r.unidade,
      grupo: { id: r.grupo_id, codigo: r.grupo_codigo, nome: r.grupo_nome },
      quantidadeAno,
      valorAno: arred2(valorAno),
      mediaMensal: arred2(mediaMensal),
      precoUnitario: arred2(precoUnitario),
      projecaoQuantidade,
      projecaoValor: arred2(projecaoQuantidade * precoUnitario),
      saldoAtual,
      quantidadeSugerida,
      valorSugerido: arred2(quantidadeSugerida * precoUnitario),
    };
  });

  const somar = (lista) =>
    lista.reduce(
      (t, i) => ({
        itens: t.itens + 1,
        valorAno: arred2(t.valorAno + i.valorAno),
        projecaoValor: arred2(t.projecaoValor + i.projecaoValor),
        valorSugerido: arred2(t.valorSugerido + i.valorSugerido),
      }),
      { itens: 0, valorAno: 0, projecaoValor: 0, valorSugerido: 0 }
    );

  const porGrupo = new Map();
  for (const item of itens) {
    if (!porGrupo.has(item.grupo.id)) porGrupo.set(item.grupo.id, { ...item.grupo, itens: [] });
    porGrupo.get(item.grupo.id).itens.push(item);
  }
  const grupos = [...porGrupo.values()].map((g) => ({ ...g, totais: somar(g.itens) }));

  return {
    exercicio: {
      ano: exercicio.ano,
      mesReferencia: exercicio.mesReferencia,
      mesesConsiderados,
      arquivoConsumo: exercicio.nomeArquivo,
      periodoBalancete: balancete?.periodo_referencia ?? null,
      importadoEm: exercicio.importadoEm,
    },
    anoProjecao: exercicio.ano + 1,
    grupos,
    totais: somar(itens),
  };
}
