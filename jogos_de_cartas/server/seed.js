require('dotenv').config()
const db = require('./jogo_de_cartasDB')

async function runSeed(){
    
    console.log('[SEEDS] Iniciando o reset do Banco de Dados...')

    try{
        console.log('[SEEDS] Removendo tabelas existentes...')
        await db.query(`
            DROP TABLE IF EXISTS room_players CASCADE;
            DROP TABLE IF EXISTS user_stats CASCADE;
            DROP TABLE IF EXISTS users CASCADE;
            DROP TABLE IF EXISTS game_state CASCADE;
        `)

        console.log('[SEEDS] Recriando a estrutura do banco...')
        await db.query(`
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL
            );

            CREATE TABLE user_stats (
                user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                wins INT DEFAULT 0,
                losses INT DEFAULT 0,
                total_games INT DEFAULT 0
            );

            CREATE TABLE game_state (
                id INT PRIMARY KEY DEFAULT 1,
                counter INT NOT NULL DEFAULT 0,
                current_turn_user_id INT REFERENCES users(id) ON DELETE SET NULL,
                CONSTRAINT single_row CHECK (id = 1)
            );
            INSERT INTO game_state (id, counter, current_turn_user_id) VALUES (1, 0, NULL);

            CREATE TABLE room_players (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
                socket_id VARCHAR(255) NOT NULL,
                username VARCHAR(50) NOT NULL,
                joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `)
            
        console.log('[SEEDS] Banco de dados resetado com sucesso!')
    } catch(err){
        console.error('[SEEDS] Erro ao resetar o banco:', err.message)
    } finally{
        process.exit(0)
    }
}

runSeed()