// backend/db.js
// Conexão com PostgreSQL usando pool de conexões
// Suporta DATABASE_URL (Neon/Render) ou variáveis separadas

const { Pool } = require('pg');

const pool = new Pool(
  process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
    : {
        host:     process.env.DB_HOST     || 'localhost',
        port:     parseInt(process.env.DB_PORT || '5432'),
        database: process.env.DB_NAME     || 'somotor',
        user:     process.env.DB_USER     || 'postgres',
        password: process.env.DB_PASS     || '',
        ssl:      process.env.DB_SSL === 'require'
                    ? { rejectUnauthorized: false }
                    : false,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      }
);

// Testa a conexão ao iniciar
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Falha ao conectar PostgreSQL:', err.message);
    return;
  }
  client.query('SELECT version()', (err2, result) => {
    release();
    if (err2) {
      console.error('❌ Erro ao verificar versão:', err2.message);
      return;
    }
    const version = result.rows[0].version.split(' ').slice(0,2).join(' ');
    console.log(`✅ PostgreSQL conectado: ${version}`);
  });
});

pool.on('error', (err) => {
  console.error('❌ Erro inesperado no pool PostgreSQL:', err.message);
});

module.exports = pool;
