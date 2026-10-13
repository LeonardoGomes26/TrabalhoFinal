const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PGUSER || 'postgres',
    password: String(process.env.PGPASSWORD || ''),
    host: process.env.PGHOST || 'localhost',
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.PGDATABASE || 'jogo_de_cartas'
});

pool.on('connect', () => {
    console.log('Conectado ao Banco de Dados com sucesso')
})

module.exports = {
    query: (text, params) => pool.query(text, params)
}