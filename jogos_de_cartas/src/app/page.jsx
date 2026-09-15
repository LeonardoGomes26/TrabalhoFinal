'use client'
import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io('http://localhost:4000')

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    
    function onConnect() {
      setIsConnected(true);
    }

    function onDisconnect() {
      setIsConnected(false);
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])
  return (
    <div>
      <h1>Status: {isConnected ? 'Conectado' : 'Desconectado'}</h1>
    </div>
  );
}