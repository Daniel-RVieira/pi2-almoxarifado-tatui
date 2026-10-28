import {
  lerLinhasCsv,
  parseNumeroBR,
  parseGrupo,
  separarCodigoLegado,
  normalizarUnidade,
} from "./csvParser.js";

// Posições de coluna do Balancete Analítico (JL Soft), mapeadas a partir da
// inspeção direta do arquivo real — cada linha repete todo o cabeçalho
// institucional antes de chegar nos dados do produto.
const COL = {
  PERIODO_TEXTO: 9, // "BALANCETE ANALÍTICO - NO PERÍODO DE: dd/mm/aaaa À dd/mm/aaaa - (...)"
  GRUPO: 17, // "1 - MATERIAL DE ESCRITORIO"
  CODIGO: 36,
  DESCRICAO: 37,
  UNIDADE: 38,
  SALDO_ANTERIOR_QTD: 39,
  SALDO_ANTERIOR_VALOR: 40,
  ENTRADAS_QTD: 41,
  ENTRADAS_VALOR: 42,
  SAIDAS_QTD: 43,
  SAIDAS_VALOR: 44,
  SALDO_ATUAL_QTD: 45,
  VALOR_UNITARIO: 46,
  VALOR_TOTAL: 47,
};

const REGEX_CODIGO_PRODUTO = /^\d{2}\.\d{4}$/;
const REGEX_PERIODO = /PER[IÍ]ODO DE:\s*([\d/]+)\s*[ÀA]\s*([\d/]+)/i;

/**
 * Preço unitário efetivo do produto no período, usado para valorizar o
 * consumo mensal. O "Vl. Unitário" que o Balancete reporta é o do SALDO
 * ATUAL — e vem 0 sempre que o item termina o período com estoque zerado,
 * que são justamente os itens de maior consumo (82 dos 293 produtos, ~R$ 67
 * mil em saídas, ficariam com valor de consumo calculado como R$ 0,00 se
 * esse campo fosse usado direto). Por isso a prioridade é: preço médio das
 * saídas do período > valor unitário do saldo atual > preço médio do saldo
 * anterior.
 */
function calcularValorUnitarioEfetivo({ saidasQtd, saidasValor, saldoAtualQtd, valorUnitario, saldoAnteriorQtd, saldoAnteriorValor }) {
  if (saidasQtd > 0) return saidasValor / saidasQtd;
  if (saldoAtualQtd > 0) return valorUnitario;
  if (saldoAnteriorQtd > 0) return saldoAnteriorValor / saldoAnteriorQtd;
  return 0;
}

/**
 * Faz o parsing do Balancete Analítico exportado pelo JL Soft.
 * Retorna { periodoReferencia, produtos: [...] }.
 */
export function parseBalancete(caminhoArquivo) {
  const linhas = lerLinhasCsv(caminhoArquivo);

  let periodoReferencia = null;
  const produtos = [];

  for (const linha of linhas) {
    const codigo = (linha[COL.CODIGO] || "").trim();
    if (!REGEX_CODIGO_PRODUTO.test(codigo)) continue; // ignora linhas de rodapé/totais

    if (!periodoReferencia) {
      const textoPeriodo = linha[COL.PERIODO_TEXTO] || "";
      const match = textoPeriodo.match(REGEX_PERIODO);
      if (match) periodoReferencia = `${match[1]} a ${match[2]}`;
    }

    const grupo = parseGrupo(linha[COL.GRUPO]);
    const { descricao, codigoLegado } = separarCodigoLegado(linha[COL.DESCRICAO]);

    const produto = {
      codigo,
      descricao,
      codigoLegado,
      unidade: normalizarUnidade(linha[COL.UNIDADE]),
      grupoCodigo: grupo?.codigo ?? null,
      grupoNome: grupo?.nome ?? "SEM GRUPO",
      saldoAnteriorQtd: parseNumeroBR(linha[COL.SALDO_ANTERIOR_QTD]) ?? 0,
      saldoAnteriorValor: parseNumeroBR(linha[COL.SALDO_ANTERIOR_VALOR]) ?? 0,
      entradasQtd: parseNumeroBR(linha[COL.ENTRADAS_QTD]) ?? 0,
      entradasValor: parseNumeroBR(linha[COL.ENTRADAS_VALOR]) ?? 0,
      saidasQtd: parseNumeroBR(linha[COL.SAIDAS_QTD]) ?? 0,
      saidasValor: parseNumeroBR(linha[COL.SAIDAS_VALOR]) ?? 0,
      saldoAtualQtd: parseNumeroBR(linha[COL.SALDO_ATUAL_QTD]) ?? 0,
      valorUnitario: parseNumeroBR(linha[COL.VALOR_UNITARIO]) ?? 0,
      valorTotal: parseNumeroBR(linha[COL.VALOR_TOTAL]) ?? 0,
    };
    produto.valorUnitarioEfetivo = calcularValorUnitarioEfetivo(produto);

    produtos.push(produto);
  }

  return { periodoReferencia, produtos };
}
