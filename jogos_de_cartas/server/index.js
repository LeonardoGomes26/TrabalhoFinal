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

async function getGameStateFromDB(){
  const playerRes = await db.query('SELECT user_id, username, socket_id FROM room_players ORDER BY id ASC')

  const stateRes = await db.query('SELECT counter, current_turn_user_id FROM game_state WHERE id = 1')

  const rawCounter = stateRes.rows[0]?.counter

  return{
    counter: rawCounter !== undefined && rawCounter !== null ? Number(rawCounter) : 0,
    players: playerRes.rows,
    currentTurnUserId: stateRes.rows[0]?.current_turn_user_id ? Number(stateRes.rows[0]?.current_turn_user_id) : null
  }
}

async function rotateTurnInDB(){
  const playerRes = await db.query('SELECT user_id FROM room_players ORDER BY id ASC')
  const players = playerRes.rows

  if(players.length === 0){
    await db.query('UPDATE game_state SET current_turn_user_id = NULL WHERE id = 1')
    return null
  }

  const stateRes = await db.query('SELECT current_turn_user_id FROM game_state WHERE id = 1')
  const currentTurnUserId = stateRes.rows[0]?.current_turn_user_id

  const currentTurnIndex = players.findIndex(p => Number(p.user_id) === Number(currentTurnUserId))
  const nextIndex = (currentTurnIndex + 1) % players.length
  const nextUserId = players[nextIndex].user_id

  await db.query('UPDATE game_state SET current_turn_user_id = $1 WHERE id = 1', [nextUserId])
  return nextUserId
}

app.get('/api/ping', (req, res) => {
  res.json({status: 'ok', message: 'Backend funcionando!'})
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
    let userQuery = await db.query('SELECT * FROM users WHERE username = $1', [username])
    let user = userQuery.rows[0]

    if(!user)
      return res.status(400).json({error: 'Usuário não encontrado'})

    if(user && user.password_hash !== password)
      return res.status(401).json({error: 'Senha incorreta!'})

    return res.json({
      message: 'Login realizado com sucesso!',
      user: {id: `user_${user.id}`, username: user.username}
    })
  } catch(err){
    return res.status(500).json({error: err.message})
  }
})

io.on('connection', (socket) => {
  console.log('Cliente conectado: ', socket.id)

  socket.on('join_game', async ({userId, username}) => {
    try{
      const numericUserId = parseInt(String(userId).replace('user_', ''), 10)

      await db.query(`INSERT INTO room_players (user_id, username, socket_id) VALUES ($1, $2, $3) ON CONFLICT (user_id) DO UPDATE SET socket_id = $3, username = $2`, [numericUserId, username, socket.id])

      const stateRes = await db.query('SELECT current_turn_user_id FROM game_state WHERE id = 1')
      if(!stateRes.rows[0]?.current_turn_user_id)
        await db.query('UPDATE game_state SET current_turn_user_id = $1 WHERE id = 1', [numericUserId])

      const gameState = await getGameStateFromDB()
      io.emit('player_count_updated', gameState.players.length)
      io.emit('game_state_updated', gameState)

      console.log(`O jogador ${username} (ID: ${numericUserId}) entrou na sala`)
    } catch(err){
      console.log('Erro ao registrar entrada no Banco: ', err.message)
    }
  })

  socket.on('action_counter', async ({type}) => {
    try{
      const playerRes = await db.query('SELECT user_id, username FROM room_players WHERE socket_id = $1', [socket.id])
      if(playerRes.rows.length === 0){
        console.log(`Ação rejeitada: Socket ${socket.id} não registrado`)
        return
      }

      const player = playerRes.rows[0]
      const stateRes = await db.query('SELECT counter, current_turn_user_id FROM game_state WHERE id = 1')
      const {counter, current_turn_user_id} = stateRes.rows[0]

      if(Number(current_turn_user_id) !== Number(player.user_id))
        return;

      const delta = type === 'increment' ? 1 : type === 'decrement' ? -1 : 0
      const newCounter = Number(counter) + delta

      await db.query('UPDATE game_state SET counter = $1 WHERE id = 1', [newCounter])

      const nextTurnUserId = await rotateTurnInDB()

      const updatedState = await getGameStateFromDB()

      io.emit('game_state_updated', updatedState)
      io.emit('turn_changed', {
        counter: updatedState.counter,
        currentTurnUserId: updatedState.currentTurnUserId,
        message: `${player.username} alterou o contador para ${newCounter}`
      })
    } catch(err){
      console.log('Erro no contador: ', err.message)
    }
  })

  async function handlePlayerLeave(userId){
    try{
      const playerRes = await db.query('SELECT user_id, username FROM room_players WHERE socket_id = $1', [socket.id])

      if(playerRes.rows.length === 0)
        return;

      const leavingPlayer = playerRes.rows[0]

      const stateRes = await db.query('SELECT current_turn_user_id FROM game_state WHERE id = 1')
      const wasHisTurn = Number(stateRes.rows[0]?.current_turn_user_id) === Number(leavingPlayer.user_id)

      await db.query('DELETE FROM room_players WHERE socket_id = $1', [socket.id])
      
      if(wasHisTurn)
        await rotateTurnInDB()

      const updatedState = await getGameStateFromDB()

      io.emit('player_count_updated', updatedState.players.length)
      io.emit('game_state_updated', updatedState)

      if(updatedState.players.length > 0 && wasHisTurn){
        io.emit('turn_changed', {
          counter: updatedState.counter,  
          currentTurnUserId: updatedState.currentTurnUserId,
          message: `${leavingPlayer.username} saiu. O turno foi passado!`
        })
      }
      
    } catch(err){
      console.log('Erro ao processar a saída no Banco: ', err.message)
    }
  }
  socket.on('disconnect', async () => {
    try{
      const playerRes = await db.query('SELECT user_id FROM room_players WHERE socket_id = $1', [socket.id])
      if(playerRes.rows.length === 0)
        return

      const userId = playerRes.rows[0].user_id

      if(pendingDisconnects.has(userId))
        clearTimeout(pendingDisconnects.get(userId))

      const timer = setTimeout(async () => {
        pendingDisconnects.delete(userId)
        console.log(`Tolerância de conexão expirou para o usuário ${userId}. Removendo o jogador da partida...`)
        await handlePlayerLeave(userId)
      }, 1500)

      pendingDisconnects.set(userId, timer)
    } catch(err){
      console.log('Erro no disconnect: ', err.message)
    }
  })
  
  socket.on('leave_game', async () => {
    try{
      const playerRes = await db.query('SELECT user_id FROM room_players WHERE socket_id = $1', [socket.id])
      if(playerRes.rows.length > 0){
        const userId = playerRes.rows[0].user_id
        if(pendingDisconnects.has(userId)){
          clearTimeout(pendingDisconnects.get(userId))
          pendingDisconnects.delete(userId)
        }
        await handlePlayerLeave(userId)
      }
    } catch(err){
      console.log('Erro ao processar leave_game: ', err.message)
    }
  })
})

const PORT = process.env.PORT || 5000
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`)
})