const express = require('express')
const http = require('http')
const { Server } = require('socket.io')
const db = require('./jogo_de_cartasDB')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
})

let currentCounter = 0
let players = []
let currentTurnIndex = 0

async function loadGameStateFromDB(){
  try{
    const res = await db.query('SELECT counter FROM game_state WHERE id = 1')
    if(res.rows.length > 0){
      currentCounter = res.rows[0].counter
      console.log(`Estado restaurado no Banco de Dados!`)
    }
  } catch(err){
    console.log('Erro ao ler do Banco: ', err.message)
  }
}

function emitGameState(){
  io.emit('receive_input', {
    counter: currentCounter,
    activePlayerId: players[currentTurnIndex] || null,
    totalPlayers: players.length
  })
}

io.on('connection', (socket) => {
  console.log('Cliente conectado: '+socket.id)

  players.push(socket.id)
  emitGameState()

  socket.emit('receive_input', currentCounter)
  
  socket.on('send_input', async (newValue) => {
    if(socket.id !== players[currentTurnIndex]){
      console.log(`Bloqueado: Jogador ${socket.id} tentou jogar fora do turno`)
      return;
    }

    currentCounter = newValue
    currentTurnIndex = (currentTurnIndex + 1) % players.length

    try{
      await db.query('UPDATE game_state SET counter = $1 WHERE id = 1', [currentCounter])
    } catch(err){
      console.log('Erro ao salvar no Banco: ', err.message)
    }

    emitGameState()
  })

  socket.on('disconnect', () => {
    console.log('Cliente desconectado: '+socket.id)

    players = players.filter(id => id !== socket.id)

    if(currentTurnIndex >= players.length)
      currentTurnIndex = 0

    emitGameState()
  })
})

loadGameStateFromDB().then(() => {
  server.listen(5000, '0.0.0.0', () => {
  console.log('Servidor socket.io está rodando na porta 5000')
  })
})
