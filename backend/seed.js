// seed.js — Popula o banco com os dados do CSV
// Execute: node seed.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'somotor',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASS     || '',
});

async function seed() {
  const client = await pool.connect();
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Lê o JSON de seed (gerado a partir do CSV)
    const dataPath = path.join(__dirname, '..', 'seed_data.json');
    if (!fs.existsSync(dataPath)) {
      console.error('❌ Arquivo seed_data.json não encontrado em:', dataPath);
      console.log('   Coloque o arquivo seed_data.json na raiz do projeto.');
      process.exit(1);
    }

    const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    console.log(`📦 ${data.length} produtos para inserir...`);

    await client.query('BEGIN');

    // Limpa tabela antes de inserir
    await client.query('TRUNCATE TABLE produtos RESTART IDENTITY');

    // Insere em lotes de 500
    const BATCH = 500;
    let inserted = 0;

    for (let i = 0; i < data.length; i += BATCH) {
      const batch = data.slice(i, i + BATCH);
      const values = [];
      const params = [];
      let paramIdx = 1;

      for (const r of batch) {
        values.push(`(
          $${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},
          $${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},
          $${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},
          $${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},
          $${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++},$${paramIdx++}
        )`);
        params.push(
          r.unidade, r.referencia, r.descricao, r.grupo, r.sub_grupo,
          r.saldo_estoque, r.custo_medio, r.valor_estoque, r.cobertura_meses, r.status_cobertura,
          r.giro_estoque, r.qtd_saida_6m, r.vlr_saida_6m, r.vlr_desconto_6m, r.qtd_saida_mes,
          r.vlr_saida_mes, r.qtd_compra_6m, r.vlr_compra_6m, r.qtd_notas_6m, r.margem_bruta_unit,
          r.margem_pct, r.lucro_bruto_6m, r.fornecedor_ult, r.dt_ult_compra, r.status_produto
        );
      }

      await client.query(`
        INSERT INTO produtos (
          unidade, referencia, descricao, grupo, sub_grupo,
          saldo_estoque, custo_medio, valor_estoque, cobertura_meses, status_cobertura,
          giro_estoque, qtd_saida_6m, vlr_saida_6m, vlr_desconto_6m, qtd_saida_mes,
          vlr_saida_mes, qtd_compra_6m, vlr_compra_6m, qtd_notas_6m, margem_bruta_unit,
          margem_pct, lucro_bruto_6m, fornecedor_ult, dt_ult_compra, status_produto
        ) VALUES ${values.join(',')}
      `, params);

      inserted += batch.length;
      process.stdout.write(`\r   Inseridos: ${inserted}/${data.length}`);
    }

    await client.query('COMMIT');
    console.log(`\n✅ Seed concluído! ${inserted} produtos inseridos.`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Erro no seed:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch(console.error);
