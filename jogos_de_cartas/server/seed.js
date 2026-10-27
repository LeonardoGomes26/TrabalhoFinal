require('dotenv').config()
const db = require('./jogo_de_cartasDB')

async function runSeed(){
    
    console.log('[SEEDS] Iniciando o reset do Banco de Dados...')

    try{
        console.log('[SEEDS] Removendo tabelas existentes...')
        await db.query(`
            DROP TABLE IF EXISTS room_players CASCADE;
            DROP TABLE IF EXISTS user_stats CASCADE;
            DROP TABLE IF EXISTS rooms CASCADE;
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

            CREATE TABLE rooms (
                id SERIAL PRIMARY KEY,
                name VARCHAR(50) UNIQUE NOT NULL,
                max_players INT DEFAULT 6
            );

            CREATE TABLE game_state (
                room_id INT PRIMARY KEY REFERENCES rooms(id) ON DELETE CASCADE,
                counter INT NOT NULL DEFAULT 0,
                status VARCHAR(20) NOT NULL DEFAULT 'WAITING',
                current_turn_user_id INT REFERENCES users(id) ON DELETE SET NULL
            );

            CREATE TABLE room_players (
                id SERIAL PRIMARY KEY,
                room_id INT REFERENCES rooms(id) ON DELETE CASCADE,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                socket_id VARCHAR(255) NOT NULL,
                username VARCHAR(50) NOT NULL,
                is_ready BOOLEAN DEFAULT FALSE,
                CONSTRAINT unique_user_per_room UNIQUE (room_id, user_id)
            );
        `)

        const defaultRoom = await db.query(`INSERT INTO rooms (name) VALUES ('Sala 1') RETURNING id`);
        const roomId = defaultRoom.rows[0].id;

        await db.query(`INSERT INTO game_state (room_id, counter, status, current_turn_user_id) VALUES ($1, 0, 'WAITING', NULL)`, [roomId]);
            
        console.log('[SEEDS] Banco de dados resetado e Sala 1 criada!')
    } catch(err){
        console.error('[SEEDS] Erro ao resetar o banco:', err.message)
    } finally{
        process.exit(0)
    }
}

runSeed()