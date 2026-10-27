
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


SELECT * FROM users

SELECT * FROM user_stats

SELECT * FROM rooms

SELECT * FROM game_state

SELECT * FROM room_players