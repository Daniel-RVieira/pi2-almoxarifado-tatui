import { lerLinhasCsv, parseNumeroBR } from "./csvParser.js";

// Posições de coluna do relatório "Consumo Anual por Produto" (JL Soft).
// As colunas 14-29 são apenas o cabeçalho repetido (rótulos "Produto",
// "Janeiro", ... "Saldo Atual"); os dados reais do item começam na coluna 30.
const COL = {
  PERIODO_TEXTO: 9, // "CONSUMO ANUAL POR PRODUTO - Ref: mm/aaaa\r\nALMOXARIFADO UNICO"
  PRODUTO: 30, // "XX.XXXX  DESCRIÇÃO TRUNCADA" — descrição NÃO é usada (vem cortada)
  PRIMEIRO_MES: 31, // Janeiro .. Dezembro = colunas 31-42 (12 meses)
  // 43 = Média Mensal (não usado)
  // 44 = "Total de Gastos" (NÃO usado como valor monetário — ver achado da análise:
  //       esse campo reflete quantidade consumida, não R$; o valor real é calculado
  //       no importService a partir de quantidade x valor_unitario do Balancete)
  SALDO_ATUAL: 45,
};

const REGEX_CODIGO_PRODUTO = /^(\d{2}\.\d{4})/;
const REGEX_REFERENCIA = /Ref:\s*(\d{2})\/(\d{4})/i;

/**
 * Faz o parsing do relatório "Consumo Anual por Produto".
 * Retorna { anoReferencia, mesReferencia, periodoReferencia, itens }, em que
 * cada item traz `quantidadesPorMes` (array de 12 posições, jan=0..dez=11) —
 * meses posteriores ao mês de referência vêm como `null` (ainda não ocorreram),
 * em vez de 0, para não distorcer médias em consultas futuras.
 */
export function parseConsumoAnual(caminhoArquivo) {
  const linhas = lerLinhasCsv(caminhoArquivo);

  let mesReferencia = null;
  let anoReferencia = null;
  let periodoReferencia = null;

  const itens = [];

  for (const linha of linhas) {
    const campoProduto = (linha[COL.PRODUTO] || "").trim();
    const matchCodigo = campoProduto.match(REGEX_CODIGO_PRODUTO);
    if (!matchCodigo) continue; // ignora linhas de rodapé/cabeçalho

    if (!mesReferencia) {
      const textoPeriodo = linha[COL.PERIODO_TEXTO] || "";
      const matchRef = textoPeriodo.match(REGEX_REFERENCIA);
      if (matchRef) {
        mesReferencia = Number(matchRef[1]);
        anoReferencia = Number(matchRef[2]);
        periodoReferencia = `${matchRef[1]}/${matchRef[2]}`;
      }
    }

    const quantidadesPorMes = [];
    for (let i = 0; i < 12; i++) {
      const numeroMes = i + 1;
      if (mesReferencia && numeroMes > mesReferencia) {
        quantidadesPorMes.push(null); // mês ainda não ocorrido no período exportado
      } else {
        quantidadesPorMes.push(parseNumeroBR(linha[COL.PRIMEIRO_MES + i]) ?? 0);
      }
    }

    itens.push({
      codigo: matchCodigo[1],
      quantidadesPorMes,
      saldoAtualInformado: parseNumeroBR(linha[COL.SALDO_ATUAL]),
    });
  }

  return { anoReferencia, mesReferencia, periodoReferencia, itens };
}
