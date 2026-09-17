'use client'
import { getSocket } from "@/lib/socket";
import { useEffect, useState } from "react";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false)

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