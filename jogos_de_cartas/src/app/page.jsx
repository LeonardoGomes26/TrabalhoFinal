'use client'
import { getSocket } from "@/lib/socket";
import { useEffect, useState } from "react";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [value, setValue] = useState(0)
  const [isMyTurn, setIsMyTurn] = useState(false)
  const [totalPlayers, setTotalPlayers] = useState(0)

  function mais(){
    const socket = getSocket()
    if(socket && isMyTurn)
      socket.emit('send_input', value + 1)
  }

  function menos(){
    const socket = getSocket()
    if(socket && isMyTurn)
      socket.emit('send_input', value - 1)
  }

  useEffect(() => {
    const socket = getSocket()
    if(!socket) return;
    
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
      setIsMyTurn(false)
    }

    function onReceiveInput(data){
      if(data && typeof data.counter !== 'undefined'){
        setValue(data.counter)
        setTotalPlayers(data.totalPlayers ?? 0)
        setIsMyTurn(data.activePlayerId === socket.id)
      }
    }

    if(socket.connected)
      setIsConnected(true)

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('receive_input', onReceiveInput)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('receive_input', onReceiveInput)
    }
  }, [])
  
  return (
    <div>
      <h1>Status: {isConnected ? 'Conectado' : 'Desconectado'}</h1>
      <p>Jogadores na sala: {totalPlayers}</p>

      <h2>{isMyTurn ? '🟢 SUA VEZ DE JOGAR!' : '🔴 Aguarde a sua vez...'}</h2>

      <div className="menuWindow">
        <p>slave</p>
      </div>
      <div>
        <input type="text" value={value ?? 0} readOnly/>
        <button onClick={mais} disabled={!isMyTurn || !isConnected} style={{cursor: isMyTurn ? 'pointer' : 'not-allowed'}}>+</button>
        <button onClick={menos} disabled={!isMyTurn || !isConnected} style={{cursor: isMyTurn ? 'pointer' : 'not-allowed'}}>-</button>
      </div>
    </div>
  );
}