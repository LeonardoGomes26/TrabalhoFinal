const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    host: process.env.PGHOST,
    port: process.env.PGPORT,
    database: process.env.PGDATABASE
});

pool.on('connect', () => {
    console.log('Conectado ao Banco de Dados com sucesso!')
})

module.exports = {
    query: (text, params) => pool.query(text, params)
}