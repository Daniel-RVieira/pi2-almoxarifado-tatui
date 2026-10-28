-- Schema do Sistema Web de Monitoramento de Estoque do Almoxarifado (PI2 - Grupo 13)
-- Nomes de entidade alinhados com o Relatório Parcial (seção 2.5.4): Grupo, Produto,
-- Movimentacao, ConsumoMensal, ImportacaoArquivo, ParametroEstoque.
--
-- Script idempotente: pode ser executado várias vezes sem erro (CREATE ... IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS grupos (
  id     SERIAL PRIMARY KEY,
  codigo VARCHAR(10) NOT NULL UNIQUE,   -- ex.: "1", "11", "12" (extraído do campo "Grupo: N - NOME")
  nome   VARCHAR(120) NOT NULL
);

CREATE TABLE IF NOT EXISTS produtos (
  id             SERIAL PRIMARY KEY,
  codigo         VARCHAR(10) NOT NULL UNIQUE,   -- padrão XX.XXXX
  descricao      TEXT NOT NULL,                 -- sempre a descrição do Balancete Analítico (a do
                                                  -- Consumo Anual vem truncada e não é usada aqui)
  unidade        VARCHAR(10),
  grupo_id       INTEGER REFERENCES grupos(id),
  codigo_legado  VARCHAR(10),                    -- código antigo, quando embutido no início da
                                                  -- descrição original (padrão "XX.XXXX - ...")
  criado_em      TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS parametros_estoque (
  produto_id          INTEGER PRIMARY KEY REFERENCES produtos(id) ON DELETE CASCADE,
  estoque_minimo      NUMERIC(14,4) NOT NULL DEFAULT 0,
  ponto_ressuprimento NUMERIC(14,4) NOT NULL DEFAULT 0,
  estoque_maximo      NUMERIC(14,4),
  observacao          TEXT   -- campo de observação livre por produto (sugestão do servidor
                              -- Roberto Palma, seção 2.5.6 do relatório; UI fica para uma etapa futura)
);

CREATE TABLE IF NOT EXISTS importacoes_arquivo (
  id                  SERIAL PRIMARY KEY,
  tipo                VARCHAR(20) NOT NULL CHECK (tipo IN ('balancete', 'consumo_anual')),
  nome_arquivo        VARCHAR(255) NOT NULL,
  periodo_referencia  VARCHAR(60),      -- texto bruto do período (ex.: "01/01/2026 a 04/09/2026")
  ano_referencia      INTEGER,          -- usado pelo Consumo Anual, para saber até que mês há dado real
  mes_referencia       INTEGER,          -- (1-12) meses após este ficam NULL, não zero
  importado_em        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS movimentacoes (
  id                  SERIAL PRIMARY KEY,
  produto_id          INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  importacao_id       INTEGER NOT NULL REFERENCES importacoes_arquivo(id) ON DELETE CASCADE,
  saldo_anterior_qtd  NUMERIC(14,4) NOT NULL DEFAULT 0,
  saldo_anterior_valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  entradas_qtd        NUMERIC(14,4) NOT NULL DEFAULT 0,
  entradas_valor      NUMERIC(14,2) NOT NULL DEFAULT 0,
  saidas_qtd          NUMERIC(14,4) NOT NULL DEFAULT 0,
  saidas_valor        NUMERIC(14,2) NOT NULL DEFAULT 0,
  saldo_atual_qtd     NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_unitario      NUMERIC(14,4) NOT NULL DEFAULT 0,
  valor_total         NUMERIC(14,2) NOT NULL DEFAULT 0,
  -- Preço unitário efetivo, usado para calcular o valor do consumo mensal.
  -- NÃO é o mesmo que valor_unitario: aquele vem da coluna "Vl. Unitário" do
  -- SALDO ATUAL do Balancete e fica 0 quando o item termina o período zerado
  -- (achado da implementação: os itens de maior consumo do almoxarifado são
  -- justamente os que esgotam o estoque). valor_unitario_efetivo usa, em ordem
  -- de preferência: preço médio das saídas (saidas_valor/saidas_qtd), depois o
  -- valor_unitario do saldo atual, depois o preço médio do saldo anterior.
  valor_unitario_efetivo NUMERIC(14,4) NOT NULL DEFAULT 0,
  UNIQUE (produto_id, importacao_id)
);

ALTER TABLE movimentacoes ADD COLUMN IF NOT EXISTS valor_unitario_efetivo NUMERIC(14,4) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS consumo_mensal (
  id             SERIAL PRIMARY KEY,
  produto_id     INTEGER NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  importacao_id  INTEGER NOT NULL REFERENCES importacoes_arquivo(id) ON DELETE CASCADE,
  ano            INTEGER NOT NULL,
  mes            INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
  quantidade     NUMERIC(14,4),   -- NULL quando o mês ainda não ocorreu no período de referência
  valor_calculado NUMERIC(14,2),  -- quantidade x valor_unitario do Balancete da mesma importação
                                   -- (o campo "Total de Gastos" do CSV de origem NÃO é usado: ele
                                   -- reflete quantidade, não valor monetário — ver seção 2.5.2 do
                                   -- Relatório Parcial)
  UNIQUE (produto_id, importacao_id, ano, mes)
);

CREATE INDEX IF NOT EXISTS idx_movimentacoes_produto ON movimentacoes(produto_id);
CREATE INDEX IF NOT EXISTS idx_consumo_mensal_produto_ano ON consumo_mensal(produto_id, ano);

-- View com o estado atual de estoque de cada produto, considerando sempre a
-- movimentação da importação mais recente (permite reimportar sem duplicar histórico).
CREATE OR REPLACE VIEW vw_estado_atual AS
SELECT
  p.id                  AS produto_id,
  p.codigo,
  p.descricao,
  p.unidade,
  g.id                  AS grupo_id,
  g.codigo              AS grupo_codigo,
  g.nome                AS grupo_nome,
  m.saldo_atual_qtd,
  m.valor_unitario,
  m.valor_total,
  m.importacao_id       AS ultima_importacao_id,
  COALESCE(pe.estoque_minimo, 0)      AS estoque_minimo,
  COALESCE(pe.ponto_ressuprimento, 0) AS ponto_ressuprimento,
  pe.estoque_maximo,
  pe.observacao
FROM produtos p
JOIN grupos g ON g.id = p.grupo_id
LEFT JOIN LATERAL (
  SELECT mv.*
  FROM movimentacoes mv
  WHERE mv.produto_id = p.id
  ORDER BY mv.importacao_id DESC
  LIMIT 1
) m ON true
LEFT JOIN parametros_estoque pe ON pe.produto_id = p.id;
