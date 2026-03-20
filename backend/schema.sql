-- ============================================================
--  Só Motor — Schema do Banco de Dados (versão consolidada)
--  Execute: psql -U postgres -d somotor -f schema.sql
--  ⚠  Usa CREATE TABLE IF NOT EXISTS — seguro em banco existente
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─── USUÁRIOS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usuarios (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome         VARCHAR(100) NOT NULL,
  email        VARCHAR(150) UNIQUE NOT NULL,
  senha_hash   VARCHAR(255) NOT NULL,
  perfil       VARCHAR(20) NOT NULL DEFAULT 'viewer'
               CHECK (perfil IN ('admin','gerente','comprador','viewer')),
  unidade      VARCHAR(50) DEFAULT 'Todas',
  ativo        BOOLEAN DEFAULT TRUE,
  criado_em    TIMESTAMP DEFAULT NOW(),
  ultimo_login TIMESTAMP
);

INSERT INTO usuarios (nome, email, senha_hash, perfil)
VALUES (
  'Administrador',
  'admin@somotor.com.br',
  '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lheW',
  'admin'
) ON CONFLICT (email) DO NOTHING;

-- ─── PRODUTOS / ESTOQUE GERAL ─────────────────────────────────
CREATE TABLE IF NOT EXISTS produtos (
  id               SERIAL PRIMARY KEY,
  unidade          VARCHAR(50),
  referencia       VARCHAR(50) NOT NULL,
  descricao        VARCHAR(255),
  grupo            VARCHAR(50),
  sub_grupo        VARCHAR(50),
  saldo_estoque    NUMERIC(12,2) DEFAULT 0,
  custo_medio      NUMERIC(12,2) DEFAULT 0,
  valor_estoque    NUMERIC(14,2) DEFAULT 0,
  cobertura_meses  NUMERIC(8,2)  DEFAULT 0,
  status_cobertura VARCHAR(30),
  giro_estoque     NUMERIC(8,2)  DEFAULT 0,
  qtd_saida_6m     NUMERIC(12,2) DEFAULT 0,
  vlr_saida_6m     NUMERIC(14,2) DEFAULT 0,
  vlr_desconto_6m  NUMERIC(14,2) DEFAULT 0,
  qtd_saida_mes    NUMERIC(12,2) DEFAULT 0,
  vlr_saida_mes    NUMERIC(14,2) DEFAULT 0,
  qtd_compra_6m    NUMERIC(12,2) DEFAULT 0,
  vlr_compra_6m    NUMERIC(14,2) DEFAULT 0,
  qtd_notas_6m     NUMERIC(12,2) DEFAULT 0,
  margem_bruta_unit NUMERIC(12,2) DEFAULT 0,
  margem_pct       NUMERIC(8,2)  DEFAULT 0,
  lucro_bruto_6m   NUMERIC(14,2) DEFAULT 0,
  fornecedor_ult   VARCHAR(100),
  dt_ult_compra    DATE,
  dias_sem_compra  NUMERIC(8,2)  DEFAULT 0,
  status_produto   VARCHAR(30),
  atualizado_em    TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_produtos_grupo      ON produtos(grupo);
CREATE INDEX IF NOT EXISTS idx_produtos_unidade    ON produtos(unidade);
CREATE INDEX IF NOT EXISTS idx_produtos_status_cob ON produtos(status_cobertura);
CREATE INDEX IF NOT EXISTS idx_produtos_referencia ON produtos(referencia);
CREATE INDEX IF NOT EXISTS idx_produtos_val_est    ON produtos(valor_estoque DESC);

-- ─── ESTOQUE MATRIZ (CD) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS estoque_matriz (
  id                      SERIAL PRIMARY KEY,
  referencia              VARCHAR(50) NOT NULL,
  descricao               VARCHAR(255),
  grupo                   VARCHAR(50),
  sub_grupo               VARCHAR(50),
  codigo_barras           VARCHAR(50),
  saldo_estoque_cd        NUMERIC(14,2) DEFAULT 0,
  custo_medio_estoque     NUMERIC(12,4) DEFAULT 0,
  valor_estoque_cd        NUMERIC(14,2) DEFAULT 0,
  cobertura_meses_cd      NUMERIC(8,2)  DEFAULT 0,
  cobertura_dias_cd       NUMERIC(8,0)  DEFAULT 0,
  status_cobertura        VARCHAR(30),
  giro_estoque_cd         NUMERIC(8,2)  DEFAULT 0,
  qtd_total_saida_cd_6m   NUMERIC(14,2) DEFAULT 0,
  vlr_total_saida_cd_6m   NUMERIC(14,2) DEFAULT 0,
  qtd_transferida_6m      NUMERIC(14,2) DEFAULT 0,
  vlr_transferido_6m      NUMERIC(14,2) DEFAULT 0,
  qtd_venda_direta_cd_6m  NUMERIC(14,2) DEFAULT 0,
  vlr_venda_direta_cd_6m  NUMERIC(14,2) DEFAULT 0,
  qtd_saida_cd_mes        NUMERIC(14,2) DEFAULT 0,
  vlr_saida_cd_mes        NUMERIC(14,2) DEFAULT 0,
  meses_com_saida_cd      NUMERIC(4,0)  DEFAULT 0,
  media_mensal_qtd_cd     NUMERIC(14,2) DEFAULT 0,
  preco_medio_saida       NUMERIC(12,4) DEFAULT 0,

  -- Histórico mensal nomeado (ago25 → jan26)
  qtd_ago25   NUMERIC(14,2) DEFAULT 0,  vlr_ago25   NUMERIC(14,2) DEFAULT 0,
  qtd_set25   NUMERIC(14,2) DEFAULT 0,  vlr_set25   NUMERIC(14,2) DEFAULT 0,
  qtd_out25   NUMERIC(14,2) DEFAULT 0,  vlr_out25   NUMERIC(14,2) DEFAULT 0,
  qtd_nov25   NUMERIC(14,2) DEFAULT 0,  vlr_nov25   NUMERIC(14,2) DEFAULT 0,
  qtd_dez25   NUMERIC(14,2) DEFAULT 0,  vlr_dez25   NUMERIC(14,2) DEFAULT 0,
  qtd_jan26   NUMERIC(14,2) DEFAULT 0,  vlr_jan26   NUMERIC(14,2) DEFAULT 0,

  qtd_comprada_6m         NUMERIC(14,2) DEFAULT 0,
  vlr_comprado_6m         NUMERIC(14,2) DEFAULT 0,
  vlr_desconto_compra_6m  NUMERIC(14,2) DEFAULT 0,
  qtd_notas_6m            NUMERIC(8,0)  DEFAULT 0,
  vlr_ipi_6m              NUMERIC(14,2) DEFAULT 0,
  vlr_icms_6m             NUMERIC(14,2) DEFAULT 0,
  vlr_impostos_total_6m   NUMERIC(14,2) DEFAULT 0,
  custo_medio_compra_6m   NUMERIC(12,4) DEFAULT 0,
  dt_ult_compra           DATE,
  fornecedor_ult          VARCHAR(100),
  vlr_ult_compra          NUMERIC(12,4) DEFAULT 0,
  qtd_ult_compra          NUMERIC(14,2) DEFAULT 0,
  desconto_ult_compra     NUMERIC(8,2)  DEFAULT 0,
  perc_ipi_ult            NUMERIC(8,2)  DEFAULT 0,
  vlr_ipi_ult             NUMERIC(12,2) DEFAULT 0,
  perc_icms_ult           NUMERIC(8,2)  DEFAULT 0,
  vlr_icms_ult            NUMERIC(12,2) DEFAULT 0,
  custo_efetivo_ult_compra NUMERIC(12,4) DEFAULT 0,
  dias_sem_compra         NUMERIC(8,0)  DEFAULT 0,
  dt_pen_compra           DATE,
  fornecedor_pen          VARCHAR(100),
  vlr_pen_compra          NUMERIC(12,4) DEFAULT 0,
  qtd_pen_compra          NUMERIC(14,2) DEFAULT 0,
  desconto_pen_compra     NUMERIC(8,2)  DEFAULT 0,
  vlr_ipi_pen             NUMERIC(12,2) DEFAULT 0,
  vlr_icms_pen            NUMERIC(12,2) DEFAULT 0,
  dt_ante_compra          DATE,
  fornecedor_ante         VARCHAR(100),
  vlr_ante_compra         NUMERIC(12,4) DEFAULT 0,
  qtd_ante_compra         NUMERIC(14,2) DEFAULT 0,
  variacao_ult_pen_pct    NUMERIC(10,2) DEFAULT 0,
  variacao_ult_ante_pct   NUMERIC(10,2) DEFAULT 0,
  variacao_ult_vs_media_pct NUMERIC(10,2) DEFAULT 0,
  margem_pct              NUMERIC(8,2)  DEFAULT 0,
  lucro_bruto_6m          NUMERIC(14,2) DEFAULT 0,
  data_primeira_compra    DATE,
  status_produto          VARCHAR(30),
  importado_em            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_emx_referencia ON estoque_matriz(referencia);
CREATE INDEX IF NOT EXISTS idx_emx_grupo      ON estoque_matriz(grupo);
CREATE INDEX IF NOT EXISTS idx_emx_status     ON estoque_matriz(status_produto);
CREATE INDEX IF NOT EXISTS idx_emx_val_est    ON estoque_matriz(valor_estoque_cd DESC);

-- ─── ESTOQUE FILIAIS (TODAS AS LOJAS) ─────────────────────────
CREATE TABLE IF NOT EXISTS estoque_filiais (
  id                      SERIAL PRIMARY KEY,
  filial                  VARCHAR(10)  NOT NULL,
  referencia              VARCHAR(50)  NOT NULL,
  descricao               VARCHAR(255),
  grupo                   VARCHAR(50),
  sub_grupo               VARCHAR(50),

  -- Estoque
  saldo_estoque_filial    NUMERIC(14,2) DEFAULT 0,
  custo_medio_filial      NUMERIC(12,4) DEFAULT 0,
  valor_estoque_filial    NUMERIC(14,2) DEFAULT 0,

  -- Cobertura
  cobertura_meses_filial  NUMERIC(8,2)  DEFAULT 0,
  cobertura_dias_filial   NUMERIC(8,0)  DEFAULT 0,
  status_cobertura_filial VARCHAR(30),

  -- Giro / Vendas 6 meses
  giro_estoque_filial     NUMERIC(8,2)  DEFAULT 0,
  qtd_vendida_filial_6m   NUMERIC(14,2) DEFAULT 0,
  vlr_vendido_filial_6m   NUMERIC(14,2) DEFAULT 0,

  -- Vendas mês atual
  qtd_vendida_filial_mes  NUMERIC(14,2) DEFAULT 0,
  vlr_vendido_filial_mes  NUMERIC(14,2) DEFAULT 0,

  -- Médias e histórico mensal (6 meses)
  meses_com_venda_filial   NUMERIC(4,0)  DEFAULT 0,
  media_mensal_qtd_filial  NUMERIC(14,2) DEFAULT 0,
  preco_medio_venda_filial NUMERIC(12,4) DEFAULT 0,

  qtd_mes1 NUMERIC(14,2) DEFAULT 0, vlr_mes1 NUMERIC(14,2) DEFAULT 0,
  qtd_mes2 NUMERIC(14,2) DEFAULT 0, vlr_mes2 NUMERIC(14,2) DEFAULT 0,
  qtd_mes3 NUMERIC(14,2) DEFAULT 0, vlr_mes3 NUMERIC(14,2) DEFAULT 0,
  qtd_mes4 NUMERIC(14,2) DEFAULT 0, vlr_mes4 NUMERIC(14,2) DEFAULT 0,
  qtd_mes5 NUMERIC(14,2) DEFAULT 0, vlr_mes5 NUMERIC(14,2) DEFAULT 0,
  qtd_mes6 NUMERIC(14,2) DEFAULT 0, vlr_mes6 NUMERIC(14,2) DEFAULT 0,

  -- Recebimentos NSD
  qtd_recebida_nsd_6m     NUMERIC(14,2) DEFAULT 0,
  vlr_recebido_nsd_6m     NUMERIC(14,2) DEFAULT 0,

  -- Margem / Resultado
  margem_pct_filial       NUMERIC(8,2)  DEFAULT 0,
  lucro_bruto_filial_6m   NUMERIC(14,2) DEFAULT 0,

  importado_em            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ef_filial     ON estoque_filiais(filial);
CREATE INDEX IF NOT EXISTS idx_ef_referencia ON estoque_filiais(referencia);
CREATE INDEX IF NOT EXISTS idx_ef_grupo      ON estoque_filiais(grupo);
CREATE INDEX IF NOT EXISTS idx_ef_status_cob ON estoque_filiais(status_cobertura_filial);
CREATE INDEX IF NOT EXISTS idx_ef_filial_ref ON estoque_filiais(filial, referencia);
CREATE INDEX IF NOT EXISTS idx_ef_val_est    ON estoque_filiais(valor_estoque_filial DESC);

-- ─── CADASTRO DE FILIAIS ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS filiais (
  codigo    VARCHAR(10) PRIMARY KEY,
  nome      VARCHAR(100) NOT NULL,
  cidade    VARCHAR(100),
  estado    VARCHAR(2),
  ativa     BOOLEAN DEFAULT TRUE,
  criado_em TIMESTAMP DEFAULT NOW()
);

INSERT INTO filiais (codigo, nome, cidade, estado) VALUES
  ('PRZ', 'Parnamirim (Matriz)',       'Parnamirim',        'RN'),
  ('NAB', 'Natal Boa Viagem',          'Natal',             'RN'),
  ('SCR', 'Santa Cruz',               'Santa Cruz',        'RN'),
  ('PET', 'Petrolina',               'Petrolina',         'PE'),
  ('AJU', 'Aracaju',                 'Aracaju',           'SE'),
  ('SAL', 'Salvador',                'Salvador',          'BA'),
  ('FEI', 'Feira de Santana',        'Feira de Santana',  'BA'),
  ('CGR', 'Campo Grande',            'Campo Grande',      'MS'),
  ('CRU', 'Cruz das Almas',          'Cruz das Almas',    'BA'),
  ('ARP', 'Araripina',              'Araripina',         'PE'),
  ('IPS', 'Ipojuca',                 'Ipojuca',           'PE'),
  ('MCO', 'Mossoró Centro',          'Mossoró',           'RN'),
  ('PAR', 'Parnaíba',               'Parnaíba',          'PI'),
  ('FZA', 'Fortaleza',              'Fortaleza',         'CE'),
  ('SJP', 'São João do Piauí',      'São João do Piauí', 'PI'),
  ('SMP', 'Simões',                  'Simões',            'PI'),
  ('VMA', 'Valença',                 'Valença',           'BA'),
  ('0NN', 'Loja Nova (0NN)',          NULL,                NULL)
ON CONFLICT (codigo) DO NOTHING;

-- ─── FROTA ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS veiculos_frota (
  id           SERIAL PRIMARY KEY,
  codigo       VARCHAR(20) NOT NULL UNIQUE,
  motorista    VARCHAR(100) NOT NULL,
  cidade       VARCHAR(100) NOT NULL,
  status       VARCHAR(30) NOT NULL,
  combustivel  INTEGER NOT NULL DEFAULT 0,
  latitude     NUMERIC(10,6) NOT NULL,
  longitude    NUMERIC(10,6) NOT NULL,
  rota         VARCHAR(150) NOT NULL,
  receita      NUMERIC(12,2) NOT NULL DEFAULT 0,
  ultimo_sinal TIMESTAMP NOT NULL DEFAULT NOW()
);

INSERT INTO veiculos_frota (codigo, motorista, cidade, status, combustivel, latitude, longitude, rota, receita, ultimo_sinal) VALUES
  ('MDM-042','Carlos A.','Recife',    'Online', 78,-8.0476,-34.8770,'Recife → Olinda',       182.40,NOW()),
  ('MDM-018','Marina S.','Jaboatão',  'Em rota',64,-8.1120,-35.0150,'Jaboatão → Recife',     96.20, NOW()),
  ('MDM-011','João P.', 'Petrolina',  'Alerta', 29,-9.3891,-40.5030,'Petrolina → Juazeiro',  211.00,NOW()),
  ('MDM-063','Lia M.',  'Paulista',   'Online', 53,-7.9408,-34.8731,'Paulista → Recife',     58.30, NOW()),
  ('MDM-077','Rafael T.','Caruaru',   'Online', 71,-8.2836,-35.9761,'Caruaru → Bezerros',    74.90, NOW()),
  ('MDM-091','Bianca F.','Olinda',    'Em rota',47,-8.0089,-34.8553,'Olinda → Recife',       134.50,NOW())
ON CONFLICT (codigo) DO NOTHING;

-- ─── MIGRATION SEGURA — adiciona colunas em bancos antigos ────
DO $$
DECLARE
  col record;
  cols text[][] := ARRAY[
    ARRAY['estoque_matriz','cobertura_meses_cd',        'NUMERIC(8,2) DEFAULT 0'],
    ARRAY['estoque_matriz','cobertura_dias_cd',         'NUMERIC(8,0) DEFAULT 0'],
    ARRAY['estoque_matriz','media_mensal_qtd_cd',       'NUMERIC(14,2) DEFAULT 0'],
    ARRAY['estoque_matriz','preco_medio_saida',         'NUMERIC(12,4) DEFAULT 0'],
    ARRAY['estoque_matriz','variacao_ult_vs_media_pct', 'NUMERIC(10,2) DEFAULT 0'],
    ARRAY['estoque_matriz','margem_pct',                'NUMERIC(8,2) DEFAULT 0'],
    ARRAY['estoque_matriz','lucro_bruto_6m',            'NUMERIC(14,2) DEFAULT 0']
  ];
BEGIN
  FOR i IN 1..array_length(cols, 1) LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = cols[i][1] AND column_name = cols[i][2]
    ) THEN
      EXECUTE format('ALTER TABLE %I ADD COLUMN %I %s', cols[i][1], cols[i][2], cols[i][3]);
      RAISE NOTICE 'Coluna adicionada: %.%', cols[i][1], cols[i][2];
    END IF;
  END LOOP;
END $$;

SELECT 'Schema Só Motor criado/atualizado com sucesso!' AS status;
