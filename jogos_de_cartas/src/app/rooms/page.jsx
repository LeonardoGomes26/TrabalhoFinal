'use client'

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { io } from "socket.io-client"

function getApiURL(){
    if(typeof window === 'undefined')
        return 'http://localhost:5000'
    const {hostname, origin} = window.location
    if(hostname === 'localhost' || hostname === '127.0.0.1')
        return 'http://localhost:5000'
    return origin.replace('-3000', '-5000')
}

export default function Rooms(){
    const router = useRouter()
    const [rooms, setRooms] = useState([])
    const [error, setError] = useState('')
    const [username, setUsername] = useState('')

    useEffect(() => {
        const storedId = localStorage.getItem('playerId')
        const storedName = localStorage.getItem('username')

        if(!storedId || !storedName){
            router.push('/')
            return
        }

        setUsername(storedName)
        fetchRooms()

        const socketInstance = io(getApiURL(), {transports: ['websocket', 'polling']})

        socketInstance.on('rooms_list_changed', () => {
            fetchRooms()
        })

        return () => {
            socketInstance.disconnect()
        }
    }, [router])
    
    async function fetchRooms(){
        try{
            const res = await fetch(`${getApiURL}/api/rooms`)
            const data = await res.json()

            if(res.ok)
                setRooms(data)
        } catch(err){
            setError('Erro ao carregar a lista de salas!')
        }
    }
    function handleJoinRoom(roomId){
        localStorage.setItem('selectedRoomId', String(roomId))
        router.push('/game')
    }
    function handleLogout(){
        localStorage.clear()
        router.push('/')
    }
    return(
        <div className="div_main_rooms">
            <div className="rooms_top">
                <h2>Salas Disponíveis</h2>
                <button onClick={handleLogout} className="button_logout_rooms">Sair</button>
            </div>
            <p className="title_roomsPage">
                Bem-Vindo(a) <strong>{username}</strong>! Escolha uma sala para jogar!
            </p>
            {error && (
                <div className="error_rooms_message">
                    {error}
                </div>
            )}

            <div className="rooms_list">
                {rooms.length === 0 ? (
                    <p className="alert_create_room">Carregando salas...</p>
                ) : (rooms.map((room) => {
                    const isFull = Number(room.current_players) >= Number(room.max_players)
                    const inProgress = room.status === 'IN_PROGRESS'
                    const cannotJoin = isFull || inProgress

                    return(
                        <div key={room.id} className="internal_room" style={{backgroundColor: cannotJoin ? '#f8f9fa' : '#ffffff'}}>
                            <div>
                                <strong style={{fontSize: '18px'}}>{room.name}</strong>
                                <div className="number_of_players">
                                    Jogadores: {room.current_players} / {room.max_players}
                                </div>
                                <div className="waiting_room" style={{color: inProgress ? '#d9534f' : '#5cb85c'}}>
                                    {inProgress ? 'Partida em Andamento (Entrada bloqueada)' : 'No Lobby (Aguardando Jogadores)'}
                                </div>
                            </div>
                            
                            <button onClick={() => handleJoinRoom(room.id)} disabled={cannotJoin} className="button_enter_rooms" style={{cursor: cannotJoin ? 'not-allowed' : 'pointer', backgroundColor: isFull ? '#ccc' : inProgress ? '#d9534f' : '#0073f3', opacity: cannotJoin ? 0.6 : 1}}>{isFull ? 'Cheia' : inProgress ? 'Em Andamento' : 'Entrar'}</button>
                        </div>
                    )
                }))}
            </div>
        </div>
    )
}