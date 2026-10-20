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

CREATE TABLE room_players (
	id SERIAL PRIMARY KEY,
	user_id INT REFERENCES users(id) ON DELETE CASCADE UNIQUE,
	socket_id VARCHAR(255) NOT NULL,
	username VARCHAR(50) NOT NULL,
	joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);


SELECT * FROM users

SELECT * FROM user_stats

SELECT * FROM game_state

SELECT * FROM room_players