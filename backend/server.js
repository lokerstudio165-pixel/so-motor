// server.js — Servidor principal Só Motor
require('dotenv').config();
const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const pool     = require('./db');

const app = express();

// ─── MIGRATION AUTOMÁTICA ─────────────────────────────────────
// Cria tabelas novas sem apagar dados existentes
async function runMigrations() {
  const client = await pool.connect();
  try {
    // ── Filiais cadastro ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS filiais (
        codigo    VARCHAR(10) PRIMARY KEY,
        nome      VARCHAR(100) NOT NULL,
        cidade    VARCHAR(100),
        estado    VARCHAR(2),
        ativa     BOOLEAN DEFAULT TRUE,
        criado_em TIMESTAMP DEFAULT NOW()
      );
    `);
    await client.query(`
      INSERT INTO filiais (codigo, nome, cidade, estado) VALUES
        ('PRZ','Parnamirim (Matriz)',       'Parnamirim',        'RN'),
        ('NAB','Natal Boa Viagem',          'Natal',             'RN'),
        ('SCR','Santa Cruz',               'Santa Cruz',        'RN'),
        ('PET','Petrolina',                'Petrolina',         'PE'),
        ('AJU','Aracaju',                  'Aracaju',           'SE'),
        ('SAL','Salvador',                 'Salvador',          'BA'),
        ('FEI','Feira de Santana',         'Feira de Santana',  'BA'),
        ('CGR','Campo Grande',             'Campo Grande',      'MS'),
        ('CRU','Cruz das Almas',           'Cruz das Almas',    'BA'),
        ('ARP','Araripina',               'Araripina',         'PE'),
        ('IPS','Ipojuca',                  'Ipojuca',           'PE'),
        ('MCO','Mossoró Centro',           'Mossoró',           'RN'),
        ('PAR','Parnaíba',                 'Parnaíba',          'PI'),
        ('FZA','Fortaleza',               'Fortaleza',         'CE'),
        ('SJP','São João do Piauí',       'São João do Piauí', 'PI'),
        ('SMP','Simões',                   'Simões',            'PI'),
        ('VMA','Valença',                  'Valença',           'BA'),
        ('0NN','Loja Nova (0NN)',           NULL,                NULL)
      ON CONFLICT (codigo) DO NOTHING;
    `);

    // ── estoque_filiais ───────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS estoque_filiais (
        id                      SERIAL PRIMARY KEY,
        filial                  VARCHAR(10)  NOT NULL,
        referencia              VARCHAR(50)  NOT NULL,
        descricao               VARCHAR(255),
        grupo                   VARCHAR(50),
        sub_grupo               VARCHAR(50),
        saldo_estoque_filial    NUMERIC(14,2) DEFAULT 0,
        custo_medio_filial      NUMERIC(12,4) DEFAULT 0,
        valor_estoque_filial    NUMERIC(14,2) DEFAULT 0,
        cobertura_meses_filial  NUMERIC(12,2)  DEFAULT 0,
        cobertura_dias_filial   NUMERIC(12,0)  DEFAULT 0,
        status_cobertura_filial VARCHAR(30),
        giro_estoque_filial     NUMERIC(12,2)  DEFAULT 0,
        qtd_vendida_filial_6m   NUMERIC(14,2) DEFAULT 0,
        vlr_vendido_filial_6m   NUMERIC(14,2) DEFAULT 0,
        qtd_vendida_filial_mes  NUMERIC(14,2) DEFAULT 0,
        vlr_vendido_filial_mes  NUMERIC(14,2) DEFAULT 0,
        meses_com_venda_filial  NUMERIC(8,0)  DEFAULT 0,
        media_mensal_qtd_filial NUMERIC(14,2) DEFAULT 0,
        preco_medio_venda_filial NUMERIC(12,4) DEFAULT 0,
        qtd_mes1  NUMERIC(14,2) DEFAULT 0, vlr_mes1  NUMERIC(14,2) DEFAULT 0,
        qtd_mes2  NUMERIC(14,2) DEFAULT 0, vlr_mes2  NUMERIC(14,2) DEFAULT 0,
        qtd_mes3  NUMERIC(14,2) DEFAULT 0, vlr_mes3  NUMERIC(14,2) DEFAULT 0,
        qtd_mes4  NUMERIC(14,2) DEFAULT 0, vlr_mes4  NUMERIC(14,2) DEFAULT 0,
        qtd_mes5  NUMERIC(14,2) DEFAULT 0, vlr_mes5  NUMERIC(14,2) DEFAULT 0,
        qtd_mes6  NUMERIC(14,2) DEFAULT 0, vlr_mes6  NUMERIC(14,2) DEFAULT 0,
        qtd_recebida_nsd_6m     NUMERIC(14,2) DEFAULT 0,
        vlr_recebido_nsd_6m     NUMERIC(14,2) DEFAULT 0,
        margem_pct_filial       NUMERIC(12,2)  DEFAULT 0,
        lucro_bruto_filial_6m   NUMERIC(14,2) DEFAULT 0,
        importado_em            TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_ef_filial     ON estoque_filiais(filial);
      CREATE INDEX IF NOT EXISTS idx_ef_referencia ON estoque_filiais(referencia);
      CREATE INDEX IF NOT EXISTS idx_ef_grupo      ON estoque_filiais(grupo);
      CREATE INDEX IF NOT EXISTS idx_ef_status_cob ON estoque_filiais(status_cobertura_filial);
      CREATE INDEX IF NOT EXISTS idx_ef_filial_ref ON estoque_filiais(filial, referencia);
      CREATE INDEX IF NOT EXISTS idx_ef_val_est    ON estoque_filiais(valor_estoque_filial DESC);
    `);
    console.log('✅ Migration OK — filiais + estoque_filiais prontos.');

    await client.query(`
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
        cobertura_meses_cd      NUMERIC(12,2)  DEFAULT 0,
        cobertura_dias_cd       NUMERIC(12,0)  DEFAULT 0,
        status_cobertura        VARCHAR(30),
        giro_estoque_cd         NUMERIC(12,2)  DEFAULT 0,
        qtd_total_saida_cd_6m   NUMERIC(14,2) DEFAULT 0,
        vlr_total_saida_cd_6m   NUMERIC(14,2) DEFAULT 0,
        qtd_transferida_6m      NUMERIC(14,2) DEFAULT 0,
        vlr_transferido_6m      NUMERIC(14,2) DEFAULT 0,
        qtd_venda_direta_cd_6m  NUMERIC(14,2) DEFAULT 0,
        vlr_venda_direta_cd_6m  NUMERIC(14,2) DEFAULT 0,
        qtd_saida_cd_mes        NUMERIC(14,2) DEFAULT 0,
        vlr_saida_cd_mes        NUMERIC(14,2) DEFAULT 0,
        meses_com_saida_cd      NUMERIC(8,0)  DEFAULT 0,

        -- Histórico mensal nomeado (ago25 → jan26)
        qtd_ago25  NUMERIC(14,2) DEFAULT 0,  vlr_ago25  NUMERIC(14,2) DEFAULT 0,
        qtd_set25  NUMERIC(14,2) DEFAULT 0,  vlr_set25  NUMERIC(14,2) DEFAULT 0,
        qtd_out25  NUMERIC(14,2) DEFAULT 0,  vlr_out25  NUMERIC(14,2) DEFAULT 0,
        qtd_nov25  NUMERIC(14,2) DEFAULT 0,  vlr_nov25  NUMERIC(14,2) DEFAULT 0,
        qtd_dez25  NUMERIC(14,2) DEFAULT 0,  vlr_dez25  NUMERIC(14,2) DEFAULT 0,
        qtd_jan26  NUMERIC(14,2) DEFAULT 0,  vlr_jan26  NUMERIC(14,2) DEFAULT 0,

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
        perc_ipi_ult            NUMERIC(12,2)  DEFAULT 0,
        vlr_ipi_ult             NUMERIC(12,2) DEFAULT 0,
        perc_icms_ult           NUMERIC(12,2)  DEFAULT 0,
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
        variacao_ult_pen_pct    NUMERIC(14,2) DEFAULT 0,
        variacao_ult_ante_pct   NUMERIC(14,2) DEFAULT 0,
        data_primeira_compra    DATE,
        status_produto          VARCHAR(30),
        media_mensal_qtd_cd     NUMERIC(14,2) DEFAULT 0,
        preco_medio_saida       NUMERIC(12,4) DEFAULT 0,
        variacao_ult_vs_media_pct NUMERIC(14,2) DEFAULT 0,
        margem_pct              NUMERIC(12,2)  DEFAULT 0,
        lucro_bruto_6m          NUMERIC(14,2) DEFAULT 0,
        importado_em            TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_emx_referencia ON estoque_matriz(referencia);
      CREATE INDEX IF NOT EXISTS idx_emx_grupo      ON estoque_matriz(grupo);
      CREATE INDEX IF NOT EXISTS idx_emx_status     ON estoque_matriz(status_produto);
      CREATE INDEX IF NOT EXISTS idx_emx_val_est    ON estoque_matriz(valor_estoque_cd DESC);
    `);

    // ── Adiciona colunas que possam estar faltando em bancos antigos ──────────
    const addColIfMissing = async (table, col, def) => {
      await client.query(`
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name='${table}' AND column_name='${col}'
          ) THEN
            ALTER TABLE ${table} ADD COLUMN ${col} ${def};
          END IF;
        END $$;
      `);
    };
    // Colunas do estoque_matriz que versões antigas podem não ter
    await addColIfMissing('estoque_matriz', 'status_cobertura',           "VARCHAR(30)");
    await addColIfMissing('estoque_matriz', 'giro_estoque_cd',            'NUMERIC(8,2) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'cobertura_meses_cd',         'NUMERIC(8,2) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'cobertura_dias_cd',          'NUMERIC(8,0) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'media_mensal_qtd_cd',        'NUMERIC(14,2) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'preco_medio_saida',          'NUMERIC(12,4) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'variacao_ult_vs_media_pct',  'NUMERIC(10,2) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'margem_pct',                 'NUMERIC(8,2) DEFAULT 0');
    await addColIfMissing('estoque_matriz', 'lucro_bruto_6m',             'NUMERIC(14,2) DEFAULT 0');
    // Histórico mensal
    for (const [q, v] of [
      ['qtd_ago25','vlr_ago25'],['qtd_set25','vlr_set25'],['qtd_out25','vlr_out25'],
      ['qtd_nov25','vlr_nov25'],['qtd_dez25','vlr_dez25'],['qtd_jan26','vlr_jan26'],
    ]) {
      await addColIfMissing('estoque_matriz', q, 'NUMERIC(14,2) DEFAULT 0');
      await addColIfMissing('estoque_matriz', v, 'NUMERIC(14,2) DEFAULT 0');
    }

    console.log('✅ Migration OK — estoque_matriz pronta.');

    // Ampliar campos NUMERIC que podem ter overflow
    const alterCols = [
      ['estoque_matriz', 'cobertura_meses_cd',      'NUMERIC(12,2)'],
      ['estoque_matriz', 'cobertura_dias_cd',        'NUMERIC(12,0)'],
      ['estoque_matriz', 'giro_estoque_cd',          'NUMERIC(12,2)'],
      ['estoque_matriz', 'meses_com_saida_cd',       'NUMERIC(8,0)'],
      ['estoque_matriz', 'variacao_ult_pen_pct',     'NUMERIC(14,2)'],
      ['estoque_matriz', 'variacao_ult_ante_pct',    'NUMERIC(14,2)'],
      ['estoque_matriz', 'variacao_ult_vs_media_pct','NUMERIC(14,2)'],
      ['estoque_matriz', 'margem_pct',               'NUMERIC(12,2)'],
      ['estoque_matriz', 'perc_ipi_ult',             'NUMERIC(12,2)'],
      ['estoque_matriz', 'perc_icms_ult',            'NUMERIC(12,2)'],
      ['estoque_filiais','cobertura_meses_filial',   'NUMERIC(12,2)'],
      ['estoque_filiais','cobertura_dias_filial',    'NUMERIC(12,0)'],
      ['estoque_filiais','giro_estoque_filial',      'NUMERIC(12,2)'],
      ['estoque_filiais','margem_pct_filial',        'NUMERIC(12,2)'],
    ];
    for (const [table, col, type] of alterCols) {
      await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE ${type}`).catch(() => {});
    }
    console.log('✅ Migration OK — campos NUMERIC ampliados.');

    // ── Tabela de clientes ────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS clientes (
        id                SERIAL PRIMARY KEY,
        nome              VARCHAR(200) NOT NULL,
        documento         VARCHAR(30),
        telefone          VARCHAR(30),
        email             VARCHAR(150),
        cidade            VARCHAR(100),
        estado            VARCHAR(2),
        filial_ref        VARCHAR(10),
        latitude          NUMERIC(10,6),
        longitude         NUMERIC(10,6),
        segmento          VARCHAR(80),
        status            VARCHAR(20) DEFAULT 'Ativo',
        total_compras_6m  NUMERIC(14,2) DEFAULT 0,
        total_compras_mes NUMERIC(14,2) DEFAULT 0,
        ticket_medio      NUMERIC(12,2) DEFAULT 0,
        observacao        TEXT,
        criado_em         TIMESTAMP DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_cli_filial ON clientes(filial_ref);
      CREATE INDEX IF NOT EXISTS idx_cli_cidade ON clientes(cidade);
      CREATE INDEX IF NOT EXISTS idx_cli_status ON clientes(status);
    `);

    // Seed: clientes demonstrativos cobrindo todas as filiais
    await client.query(`
      INSERT INTO clientes (nome, documento, telefone, email, cidade, estado, filial_ref, latitude, longitude, segmento, status, total_compras_6m, total_compras_mes, ticket_medio, observacao)
      VALUES
        ('Auto Peças Nordeste Ltda',   '12.345.678/0001-90','(84) 99201-4455','compras@autopecasnordeste.com.br','Parnamirim',      'RN','PRZ', -5.9225,-35.2616,'Oficina Mecânica','Ativo', 48200,8100,1605,'Cliente desde 2019. Compra semanalmente.'),
        ('Mecânica São Paulo Center',  '23.456.789/0001-01','(84) 98712-3300','spcenter@gmail.com',              'Natal',           'RN','NAB', -5.7945,-35.2110,'Oficina Mecânica','Ativo', 31500,5200,1050,'Preferência por peças Bosch e Continental.'),
        ('Transportes Potiguar SA',    '34.567.890/0001-12','(84) 99333-7788','frota@tpotiguar.com.br',          'Natal',           'RN','NAB', -5.8000,-35.2200,'Transportadora','Ativo',  67000,11200,2233,'Frota de 42 caminhões. Contrato anual.'),
        ('Oficina do Zé Pedrinho',     '456.789.012-34',    '(84) 99444-5566','',                                'Santa Cruz',      'RN','SCR', -6.2252,-35.8020,'Oficina Mecânica','Ativo', 12400,2100,620,'Pequeno, mas muito fiel. Paga à vista.'),
        ('Borracharia Santa Cruz 24h', '567.890.123-45',    '(84) 98555-6677','',                                'Santa Cruz',      'RN','SCR', -6.2300,-35.8100,'Borracharia','Ativo',       8900,1500,445,'Pedidos urgentes frequentes.'),
        ('Diesel do Vale Ltda',        '45.678.901/0001-23','(87) 99123-4400','diesel@dovale.com.br',            'Petrolina',       'PE','PET', -9.3891,-40.5030,'Distribuidor','Ativo',      55000,9300,1833,'Distribui para Juazeiro e região.'),
        ('Multipeças Petrolina',       '56.789.012/0001-34','(87) 98234-5511','multipecas@petrolina.net',        'Petrolina',       'PE','PET', -9.3950,-40.5100,'Loja de Autopeças','Ativo',29800,4900,993,'Compra mensalmente. Bom pagador.'),
        ('Log Sergipe Transportes',    '67.890.123/0001-45','(79) 99345-6622','logistica@logsergipe.com.br',     'Aracaju',         'SE','AJU',-10.9472,-37.0731,'Transportadora','Ativo',   42000,7100,1400,'Contrato semestral renovado.'),
        ('Auto Sul Bahia',             '78.901.234/0001-56','(71) 99456-7733','autosulba@yahoo.com',             'Salvador',        'BA','SAL',-12.9714,-38.5014,'Oficina Mecânica','Ativo', 38500,6400,1283,'Grande volume em suspensão e freios.'),
        ('Centro Automotivo Bahia',    '89.012.345/0001-67','(75) 99567-8844','centroauto@bahia.com.br',         'Feira de Santana','BA','FEI',-12.2664,-38.9663,'Oficina Mecânica','Ativo', 27600,4600,920,'Obras frequentes para frotas do agro.'),
        ('Agro Peças MS Ltda',         '90.123.456/0001-78','(67) 99678-9955','agropecas@ms.com.br',             'Campo Grande',    'MS','CGR',-20.4697,-54.6201,'Agronegócio','Ativo',      51000,8500,1700,'Equipamentos agrícolas e pesados.'),
        ('Mecânica Cruz das Almas',    '01.234.567/0001-89','(75) 99789-0066','mecanica@cruzdas.com.br',         'Cruz das Almas',  'BA','CRU',-12.6593,-39.1058,'Oficina Mecânica','Ativo', 15200,2500,506,'Atende toda a microrregião.'),
        ('Peças & Serviços Araripina', '11.222.333/0001-44','(87) 98890-1177','pecas@araripina.net',             'Araripina',       'PE','ARP', -7.5527,-40.4983,'Loja de Autopeças','Ativo',18700,3100,623,'Forte em filtragem e óleo.'),
        ('Ipojuca Frotas Ltda',        '22.333.444/0001-55','(81) 99901-2288','frotas@ipojuca.com.br',           'Ipojuca',         'PE','IPS', -8.3997,-35.0617,'Transportadora','Ativo',   33400,5600,1113,'Porto de Suape. Alta frequência de compra.'),
        ('Mossoró Diesel Center',      '33.444.555/0001-66','(84) 98012-3399','diesel@mossoro.com.br',           'Mossoró',         'RN','MCO', -5.1879,-37.3441,'Distribuidor','Ativo',     44500,7400,1483,'Fornece para todo o alto-oeste RN.'),
        ('Transportes Parnaíba SA',    '44.555.666/0001-77','(86) 99123-4400','frota@transparnaiba.com.br',      'Parnaíba',        'PI','PAR', -2.9056,-41.7760,'Transportadora','Ativo',   29000,4800,966,'Rota do litoral piauiense.'),
        ('Auto Forte Fortaleza',       '55.666.777/0001-88','(85) 99234-5511','autoforte@fortaleza.com.br',      'Fortaleza',       'CE','FZA', -3.7172,-38.5434,'Loja de Autopeças','Ativo',62000,10300,2066,'Maior cliente CE. Linha pesada.'),
        ('Mecânica Piauí Central',     '66.777.888/0001-99','(89) 98345-6622','piauicentral@gmail.com',          'São João do Piauí','PI','SJP',-8.3565,-42.2500,'Oficina Mecânica','Ativo', 11800,1900,393,'Atende interior do PI.'),
        ('Simões Auto Peças',          '77.888.999/0001-00','(89) 99456-7733','simoes@autopecas.net',            'Simões',          'PI','SMP', -7.6000,-40.8333,'Loja de Autopeças','Ativo',9400,1600,313,'Loja familiar, clientela fiel.'),
        ('Valença Motores Bahia',      '88.999.000/0001-11','(75) 99567-8844','valencamotores@ba.com.br',        'Valença',         'BA','VMA',-13.3700,-39.0738,'Oficina Mecânica','Ativo', 14100,2300,470,'Especializado em motores diesel.'),
        ('Recife Peças Novas',         '99.000.111/0001-22','(81) 99678-9955','recifepecas@gmail.com',           'Recife',          'PE','0NN', -8.0539,-34.9293,'Loja de Autopeças','Ativo',21500,3600,716,'Nova parceria. Potencial de crescimento.'),
        ('Oficina Inativa Exemplo',    '11.111.111/0001-11','(00) 00000-0000','',                                'Natal',           'RN','NAB', -5.8100,-35.2300,'Oficina Mecânica','Inativo',0,0,0,'Encerrou atividades em jan/26.')
      ON CONFLICT DO NOTHING;
    `);
    console.log('✅ Migration OK — clientes prontos.');
  } catch (err) {
    console.error('❌ Erro na migration:', err.message);
  } finally {
    client.release();
  }
}

// ─── MIDDLEWARES ──────────────────────────────────────────────
app.use(express.json({ limit: '50mb' }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://localhost:5173',
  ],
  credentials: true,
}));

// Log de requisições
app.use((req, res, next) => {
  const ts = new Date().toISOString().slice(11,19);
  console.log(`[${ts}] ${req.method} ${req.path}`);
  next();
});

// ─── ROTAS ────────────────────────────────────────────────────
const { router: authRouter } = require('./routes/auth');
app.use('/api/auth',     authRouter);
app.use('/api/kpis',     require('./routes/kpis'));
app.use('/api/produtos', require('./routes/produtos'));
app.use('/api/frota',    require('./routes/frota'));
app.use('/api/database', require('./routes/database'));
app.use('/api/clientes', require('./routes/clientes'));

// ─── HEALTH CHECK ─────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString(), app: 'Só Motor API' });
});

// ─── ERRO 404 ─────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: 'Rota não encontrada' });
});

// ─── ERROR HANDLER ────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Erro não tratado:', err.message);
  res.status(500).json({ error: 'Erro interno do servidor' });
});

// ─── INICIAR ──────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
runMigrations().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀 Só Motor API rodando em http://localhost:${PORT}`);
    console.log(`   Ambiente: ${process.env.NODE_ENV || 'development'}`);
    console.log(`   Banco: ${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}\n`);
  });
});
