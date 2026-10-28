import { readFileSync } from "node:fs";
import { parse } from "csv-parse/sync";

/**
 * Lê um CSV exportado pelo JL Soft e retorna um array de linhas (cada linha é
 * um array de campos). Os arquivos são UTF-8 (confirmado por inspeção dos bytes
 * brutos — o texto do relatório antigo mencionava Latin-1, mas isso estava errado).
 *
 * csv-parse trata corretamente quebras de linha (\r\n) embutidas dentro de campos
 * entre aspas, o que ocorre no cabeçalho do relatório "Consumo Anual por Produto".
 */
export function lerLinhasCsv(caminhoArquivo) {
  const conteudo = readFileSync(caminhoArquivo, "utf-8");
  return parse(conteudo, {
    relax_column_count: true,
    skip_empty_lines: false,
  });
}

/**
 * Converte um número no padrão brasileiro ("1.155,000000") para Number.
 * Retorna null para valores vazios/indefinidos.
 */
export function parseNumeroBR(valor) {
  if (valor === undefined || valor === null) return null;
  const texto = String(valor).trim();
  if (texto === "") return null;
  const normalizado = texto.replace(/\./g, "").replace(",", ".");
  const numero = Number(normalizado);
  return Number.isNaN(numero) ? null : numero;
}

/**
 * Extrai {codigo, nome} do campo de grupo repetido em cada linha do Balancete,
 * ex.: "1 - MATERIAL DE ESCRITORIO" -> { codigo: "1", nome: "MATERIAL DE ESCRITORIO" }.
 * O CSV não possui delimitador explícito de grupo — o valor vem embutido no
 * bloco de cabeçalho que se repete em cada linha.
 */
export function parseGrupo(textoGrupo) {
  if (!textoGrupo) return null;
  const match = String(textoGrupo)
    .trim()
    .match(/^(\d+)\s*-\s*(.+)$/);
  if (!match) return null;
  return { codigo: match[1], nome: match[2].trim() };
}

// Código de produto legado embutido no início da descrição, ex.:
// "01.0069 - CLIPS 3/0 ." (o código atual do item, nesse caso, é outro, ex. 01.0187).
// Ocorre em ~8% dos itens do Balancete (recodificação anterior no JL Soft).
const REGEX_CODIGO_LEGADO = /^(\d{2}\.\d{4})\s*-\s*(.+)$/;

export function separarCodigoLegado(descricao) {
  if (!descricao) return { descricao, codigoLegado: null };
  const match = String(descricao).trim().match(REGEX_CODIGO_LEGADO);
  if (!match) return { descricao: descricao.trim(), codigoLegado: null };
  return { descricao: match[2].trim(), codigoLegado: match[1] };
}

// Normalização de unidades de medida com grafias divergentes encontradas na
// análise dos dados (ex.: "K" usado isoladamente para o que deveria ser "KG").
const MAPA_UNIDADES = {
  K: "KG",
};

export function normalizarUnidade(unidade) {
  if (!unidade) return unidade;
  const limpa = String(unidade).trim().toUpperCase();
  return MAPA_UNIDADES[limpa] || limpa;
}
