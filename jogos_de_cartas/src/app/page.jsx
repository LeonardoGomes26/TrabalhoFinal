'use client'
import { getSocket } from "@/lib/socket";
import { useEffect, useState } from "react";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)
  const [value, setValue] = useState(0)

  function onchange(e){
    setValue(e)
  }
  function mais(){
    const socket = getSocket()
    const newValue = value + 1
    setValue(newValue)
    
    if(socket)
      socket.emit('send_input', newValue)
  }

  function menos(){
    const socket = getSocket()
    const newValue = value - 1
    setValue(newValue)
    
    if(socket)
      socket.emit('send_input', newValue)
  }

  useEffect(() => {
    const socket = getSocket()
    if(!socket) return
    
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('receive_input', onchange)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('receive-input', onchange)
    }
  }, [])
  
  return (
    <div>
      <h1>Status: {isConnected ? 'Conectado' : 'Desconectado'}</h1>

      <input type="text" value={value} onChange={onchange} disabled/>
      <input type="button" value="+" onClick={mais}/>
      <input type="button" value="-" onClick={menos}/>
    </div>
  );
}