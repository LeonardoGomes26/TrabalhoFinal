const express = require('express')
const http = require('http')
const { Server } = require('socket.io')

const app = express()
const server = http.createServer(app)

const io = new Server(server, {
  cors: {
    origin: 'http://localhost:3000'
  }
})

io.on('connection', (socket) => {
  console.log('Cliente conectado: '+socket.id)

  socket.on('disconnect', () => {
    console.log('Cliente desconectado: '+socket.id)
  })
})

server.listen(4000, () => {
  console.log('Servidor socket.io está rodando na porta 4000')
})