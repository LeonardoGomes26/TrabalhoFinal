require('dotenv').config();
const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const cors = require('cors')
const db = require('./jogo_de_cartasDB')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: '*'
}))
app.use(express.json())

const pendingDisconnects = new Map()

async function ensureAvaliableRoom(){
  try{
    const openRoomRes = await db.query(`
      SELECT r.id
      FROM rooms r
      JOIN game_state gs ON r.id = gs.room_id
      LEFT JOIN room_players rp ON r.id = rp.room_id
      WHERE gs.status = 'WAITING'
      GROUP BY r.id, r.max_players
      HAVING COUNT(rp.id) < r.max_players
      LIMIT 1
    `)

    if(openRoomRes.rows.length === 0){
      const totalRoomsRes = await db.query('SELECT COUNT(*)::int AS total FROM rooms')
      const nextNumber = totalRoomsRes.rows[0].total+1
      const roomName = `Sala ${nextNumber}`

      const newRoomId = newRoom.rows[0].id
      await db.query("INSERT INTO game_state (room_id, counter, status, current_turn_user_id) VALUES ($1, 0, 'WAITING', NULL)", [newRoomId])

      console.log(`[AUTO-ROOM] Nova sala criada automaticamente: ${roomName} (ID: ${newRoomId})`)
      io.emit('rooms_list_changed')
    }
  } catch(err){
    console.log('Erro ao verificar/criar sala automática: ', err.message)
  }
}

async function getGameStateFromDB(roomId){
  const playerRes = await db.query('SELECT user_id, username, socket_id, is_ready FROM room_players WHERE room_id = $1 ORDER BY id ASC', [roomId])

  const stateRes = await db.query('SELECT counter, status, current_turn_user_id FROM game_state WHERE room_id = $1', [roomId])

  const rawCounter = stateRes.rows[0]?.counter

  return{
    roomId: Number(roomId),
    counter: rawCounter !== undefined && rawCounter !== null ? Number(rawCounter) : 0,
    status: stateRes.rows[0]?.status || 'WAITING',
    players: playerRes.rows,
    currentTurnUserId: stateRes.rows[0]?.current_turn_user_id ? Number(stateRes.rows[0].current_turn_user_id) : null
  }
}

async function rotateTurnInDB(roomId){
  const playerRes = await db.query('SELECT user_id FROM room_players WHERE room_id = $1 ORDER BY id ASC', [roomId])
  const players = playerRes.rows

  if(players.length === 0){
    await db.query('UPDATE game_state SET current_turn_user_id = NULL WHERE room_id = $1', [roomId])
    return null
  }

  const stateRes = await db.query('SELECT current_turn_user_id FROM game_state WHERE room_id = $1', [roomId])
  const currentTurnUserId = stateRes.rows[0]?.current_turn_user_id

  const currentIndex = players.findIndex(p => Number(p.user_id) === Number(currentTurnUserId))
  const nextIndex = (currentIndex === -1 || currentIndex + 1 >= players.length) ? 0 : currentIndex + 1
  const nextUserId = players[nextIndex].user_id

  await db.query('UPDATE game_state SET current_turn_user_id = $1 WHERE room_id = $2', [nextUserId, roomId])
  return nextUserId
}

async function checkIfAllReadyAndStart(roomId){
  const stateRes = await db.query('SELECT status FROM game_state WHERE room_id = $1', [roomId])
  if(stateRes.rows[0]?.status === 'IN_PROGRESS')
    return false
  
  const activePlayersRes = await db.query('SELECT user_id, is_ready FROM room_players WHERE room_id = $1', [roomId])
  const activePlayers = activePlayersRes.rows
  const allReady = activePlayers.every(p => p.is_ready === true)

  if(allReady){
    const firstUserId = activePlayers[0].user_id
    await db.query(`UPDATE game_state SET status = 'IN_PRGRESS', current_turn_user_id = $1 WHERE room_id = $2`, [firstUserId, roomId])
    await ensureAvaliableRoom()
    return true
  }
  return false
}

app.get('/api/ping', (req, res) => {
  res.json({status: 'ok', message: 'Backend funcionando!'})
})

app.get('/api/rooms', async (req, res) => {
  try{
    await ensureAvaliableRoom()
    
    const result = await db.query(`
      SELECT r.id, r.name, r.max_players, gs.status, COUNT(rp.id)::int AS current_players
      FROM rooms r
      JOIN game_state gs ON r.id = gs.room_id
      LEFT JOIN room_players rp ON r.id = rp.room_id
      GROUP BY r.id, gs.status
      ORDER BY r.created_at DESC
    `)
    return res.json(result.rows)
  } catch(err){
    return res.status(500).json({error: err.message})
  }
})

app.post('/api/register', async (req, res) => {
  const {username, password} = req.body
  if(!username || !password)
    return res.status(400).json({error: 'Preencha usuário e senha!'})

  try{
    const checkUser = await db.query(`SELECT id FROM users WHERE username = $1`, [username])
    if(checkUser.rows.length > 0)
      return res.status(400).json({error: 'Este nome de usuário já está sendo usado'})

    const newUser = await db.query(`INSERT INTO users (username, password_hash) VALUES ($1, $2) RETURNING id, username`, [username, password])
    const user = newUser.rows[0]

    await db.query(`INSERT INTO user_stats (user_id, wins, losses, total_games) VALUES ($1, 0, 0, 0)`, [user.id])

    return res.status(201).json({
      message: 'Conta criada com sucesso!',
      user: {id: `user_${user.id}`, username: user.username}
    })

  } catch(err){
    console.log('Erro no cadastro: ', err.message)
    return res.status(500).json({error: err.message})
  }
})

app.post('/api/login', async (req, res) => {
  const {username, password} = req.body

  if(!username || !password)
    return res.status(400).json({error: 'Preencha usuário e senha!'})

  try{
    const userQuery = await db.query('SELECT * FROM users WHERE username = $1', [username])
    const user = userQuery.rows[0]

    if(!user)
      return res.status(400).json({error: 'Usuário não encontrado'})

    if(user.password_hash !== password)
      return res.status(401).json({error: 'Senha incorreta!'})

    return res.json({
      message: 'Login realizado com sucesso!',
      user: {id: `user_${user.id}`, username: user.username}
    })
  } catch(err){
    return res.status(500).json({error: err.message})
  }
})

app.post('/api/rooms', async (req, res) => {
  const { name } = req.body
  if(!name || !name.trim())
    return res.status(400).json({error: 'Nome da sala é obrigatório!'})

  try{
    const checkRoom = await db.query('SELECT id FROM rooms WHERE name = $1', [name.trim()])
    if(checkRoom.rows.length > 0)
      return res.status(400).json({error: 'Já existe uma sala com esse nome'})

    const newRoom = await db.query('INSERT INTO rooms (name) VALUES ($1) RETURNING id, name, max_players', [name.trim()])
    const room = newRoom.rows[0]

    await db.query(`INSERT INTO game_state (room_id, counter, status, current_turn_user_id) VALUES ($1, 0, 'WAITING', NULL)`, [room.id])

    io.emit('rooms_list_changed')
    return res.status(201).json({room: {...room, status: 'WAITING', current_players: 0}})
  } catch(err){
    return res.status(500).json({error: err.message})
  }
})

io.on('connection', (socket) => {
  console.log('Cliente conectado: ', socket.id)

  socket.on('join_game', async ({userId, username, roomId}) => {
    try{
      const numericUserId = parseInt(String(userId).replace('user_', ''), 10)
      const numericRoomId = Number(roomId)

      const roomCheck = await db.query(
        `SELECT r.max_players, gs.status, 
        (SELECT COUNT(*) FROM room_players WHERE room_id = $1 AND user_id != $2) AS other_players,
        (SELECT COUNT(*) FROM room_players WHERE room_id = $1 AND user_id = $2) AS is_already_in_room
          FROM rooms r 
          JOIN game_state gs ON r.id = gs.room_id 
          WHERE r.id = $1`,
        [numericRoomId, numericUserId]
      );

      if(roomCheck.rows.length === 0)
        return socket.emit('error_message', 'Sala não encontrada')
      
      const {max_players, status: roomStatus, other_players, is_already_in_room} = roomCheck.rows[0]
      const isReconnecting = Number(is_already_in_room)

      if(roomStatus === 'IN_PROGRESS' && !isReconnecting)
        return socket.emit('game_in_progress', 'A partida nessa sala já está em andamento. Você não pode entrar agora.')

      if(!isReconnecting && Number(other_players) >= Number(max_players))
        return socket.emit('room_full', 'Está sala já está cheia (máximo 6 jogadores)')

      const pendingKey = `${numericUserId}_${numericRoomId}`
      if(pendingDisconnects.has(pendingKey)){
        clearTimeout(pendingDisconnects.get(pendingKey))
        pendingDisconnects.delete(pendingKey)
      }

      await db.query(
        `INSERT INTO room_players (room_id, user_id, username, socket_id, is_ready)
         VALUES ($1, $2, $3, $4, FALSE)
         ON CONFLICT (room_id, user_id) 
         DO UPDATE SET socket_id = $4, username = $3`,
        [numericRoomId, numericUserId, username, socket.id]
      );

      socket.join(`room_${numericRoomId}`)

      const gameState = await getGameStateFromDB(numericRoomId)
      const roomChannel = `room_${numericRoomId}`
      
      io.to(roomChannel).emit('player_count_updated', gameState.players.length)
      io.to(roomChannel).emit('game_state_updated', gameState)
      io.emit('rooms_list_changed')
      console.log(`O jogador ${username} (ID: ${numericUserId}) entrou na sala`)
    } catch(err){
      console.log('Erro ao registrar entrada no Banco: ', err.message)
    }
  })

  socket.on('toggle_ready', async ({roomId}) => {
    try{
      const numericRoomId = Number(roomId)
      const playerRes = await db.query('SELECT user_id, is_ready FROM room_players WHERE socket_id = $1 AND room_id = $2', [socket.id, numericRoomId])

      if(playerRes.rows.length === 0)
        return;

      const player = playerRes.rows[0]
      const newReadyState = !player.is_ready

      await db.query('UPDATE room_players SET is_ready = $1 WHERE room_id = $2 AND user_id = $3', [newReadyState, numericRoomId, player.user_id])

      const gameStarted = await checkIfAllReadyAndStart(numericRoomId)
      const updatedState = await getGameStateFromDB(numericRoomId)
      const roomChannel = `room_${numericRoomId}`

      io.to(roomChannel).emit('game_state_updated', updatedState)

      if(gameStarted){
        io.to(roomChannel).emit('turn_changed', {
          counter: updatedState.counter,
          currentTurnUserId: updatedState.currentTurnUserId,
          message: 'Todos estão prontos! A partida começou!'
        })
        io.emit('rooms_list_changed')
      }
    } catch(err){
      console.log('Erro no toggle_ready: ', err.message)
    }
  })
  
  socket.on('action_counter', async ({type, roomId}) => {
    try{
      const numericRoomId = Number(roomId)
      const playerRes = await db.query('SELECT user_id, username FROM room_players WHERE socket_id = $1 AND room_id = $2', [socket.id, numericRoomId])
      if(playerRes.rows.length === 0)
        return;

      const player = playerRes.rows[0]
      const stateRes = await db.query('SELECT counter, status, current_turn_user_id FROM game_state WHERE room_id = $1', [numericRoomId])
      const {counter, status: gameStatus, current_turn_user_id} = stateRes.rows[0]

      if(gameStatus !== 'IN_PROGRESS')
        return;
      if(Number(current_turn_user_id) !== Number(player.user_id))
        return;

      const delta = type === 'increment' ? 1 : type === 'decrement' ? -1 : 0
      const newCounter = Number(counter) + delta

      await db.query('UPDATE game_state SET counter = $1 WHERE room_id = $2', [newCounter, numericRoomId])

      await rotateTurnInDB(numericRoomId)

      const updatedState = await getGameStateFromDB(numericRoomId)
      const roomChannel = `room_${numericRoomId}`

      io.to(roomChannel).emit('game_state_updated', updatedState)
      io.to(roomChannel).emit('turn_changed', {
        counter: updatedState.counter,
        currentTurnUserId: updatedState.currentTurnUserId,
        message: `${player.username} alterou o contador para ${newCounter}`
      })
    } catch(err){
      console.log('Erro no contador: ', err.message)
    }
  })

  socket.on('reset_game', async ({roomId}) => {
    try{
      const numericRoomId = Number(roomId)

      await db.query("UPDATE game_state SET status = 'WAITING', counter = 0, current_turn_user_id = NULL WHERE room_id = $1", [numericRoomId]);
      await db.query("UPDATE room_players SET is_ready = FALSE WHERE room_id = $1", [numericRoomId]);

      const updatedState = await getGameStateFromDB(numericRoomId)
      const roomChannel = `room_${numericRoomId}`

      io.to(roomChannel).emit('game_state_updated', updatedState)
      io.to(roomChannel).emit('turn_changed', {
        counter: 0,
        currentTurnUserId: null,
        message: 'A partida terminou! A sala voltou para o lobby.'
      })

      io.emit('rooms_list_changed')
    } catch(err){
      console.log('Erro no reset_game: ', err.message)
    }
  })

  async function handlePlayerLeave(userId, roomId){
    try{
      const playerRes = await db.query('SELECT username FROM room_players WHERE user_id = $1 AND room_id = $2', [userId, roomId])
      if(playerRes.rows.length === 0)
        return;

      const leavingPlayer = playerRes.rows[0]
      const stateRes = await db.query('SELECT current_turn_user_id, status FROM game_state WHERE room_id = $1', [roomId])
      const wasHisTurn = Number(stateRes.rows[0]?.current_turn_user_id) === Number(userId)
      const gameStatus = stateRes.rows[0]?.status

      await db.query('DELETE FROM room_players WHERE user_id = $1 AND room_id = $2', [userId, roomId])
      
      const activePlayersRes = await db.query('SELECT user_id FROM room_players WHERE room_id = $1', [roomId])

      if(activePlayersRes.rows.length === 0 && gameStatus === 'IN_PROGRESS')
        await db.query(`UPDATE game_state SET status = 'WAITING', counter = 0, current_turn_user_id = NULL WHERE room_id = $1`, [roomId])
      else if(wasHisTurn && gameStatus === 'IN_PROGRESS')
        await rotateTurnInDB(roomId)
      else if(gameStatus === 'WAITING')
        await checkIfAllReadyAndStart(roomId)

      const updatedState = await getGameStateFromDB(roomId)
      const roomChannel = `room_${roomId}`

      io.to(roomChannel).emit('player_count_updated', updatedState.players.length)
      io.to(roomChannel).emit('game_state_updated', updatedState)

      if(updatedState.players.length > 0 && wasHisTurn && gameStatus === 'IN_PROGRESS'){
        io.to(roomChannel).emit('turn_changed', {
          counter: updatedState.counter,  
          currentTurnUserId: updatedState.currentTurnUserId,
          message: `${leavingPlayer.username} saiu. O turno foi passado!`
        })
      }
      io.emit('rooms_list_changed')
    } catch(err){
      console.log('Erro ao processar a saída da sala: ', err.message)
    }
  }
  socket.on('disconnect', async () => {
    try{
      const playerRes = await db.query('SELECT user_id, room_id FROM room_players WHERE socket_id = $1', [socket.id])
      if(playerRes.rows.length === 0)
        return

      const {userId: userId, room_id: roomId} = playerRes.rows[0]
      const pendingKey = `${userId}_${roomId}`

      if(pendingDisconnects.has(pendingKey))
        clearTimeout(pendingDisconnects.get(pendingKey))

      const timer = setTimeout(async () => {
        pendingDisconnects.delete(pendingKey)
        console.log(`Tolerância de conexão expirou para o usuário ${userId}. Removendo o jogador da partida...`)
        await handlePlayerLeave(userId, roomId)
      }, 2000)

      pendingDisconnects.set(pendingKey, timer)
    } catch(err){
      console.log('Erro no disconnect: ', err.message)
    }
  })
  
  socket.on('leave_game', async ({roomId}) => {
    try{
      const playerRes = await db.query('SELECT user_id FROM room_players WHERE socket_id = $1 AND room_id = $2', [socket.id, Number(roomId)])
      if(playerRes.rows.length > 0){
        const userId = playerRes.rows[0].user_id
        const pendingKey = `${userId}_${roomId}`
        if(pendingDisconnects.has(pendingKey)){
          clearTimeout(pendingDisconnects.get(pendingKey))
          pendingDisconnects.delete(pendingKey)
        }
        await handlePlayerLeave(userId, Number(roomId))
      }
    } catch(err){
      console.log('Erro no leave_game: ', err.message)
    }
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})