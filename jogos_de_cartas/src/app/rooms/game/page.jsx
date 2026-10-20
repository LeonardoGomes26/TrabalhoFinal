'use client'

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { io } from "socket.io-client"

function getApiUrl(){
    if(typeof window === 'undefined')
        return 'http://localhost:5000'

    const {hostname, origin} = window.location
    if(hostname === 'localhost' || hostname === '127.0.0.1')
        return 'http://localhost:5000'
    return origin.replace('-3000', '-5000')
}

export default function GamePage(){
    const router = useRouter()
    const [socket, setSocket] = useState(null)
    const [players, setPlayers] = useState([])
    const [counter, setCounter] = useState(0)
    const [playerCount, setPlayerCount] = useState(0)
    const [currentTurnUserId, setCurrentTurnUserId] = useState(null)
    const [notification, setNotification] = useState('')
    const [currentUser, setCurrentUser] = useState({id: '', username: ''})

    useEffect(() => {
        const storedId = localStorage.getItem('playerId')
        const storedName = localStorage.getItem('username')

        if(!storedId || !storedName){
            router.push('/')
            return;
        }

        setCurrentUser({id: storedId, username: storedName})

        const socketInstance = io(getApiUrl(), {
            transports: ['websocket', 'polling']
        })
        setSocket(socketInstance)

        socketInstance.on('connect', () => {
            socketInstance.emit('join_game', {
                userId: storedId, 
                username: storedName
            })
        })

        socketInstance.on('player_count_updated', (count) => {
            setPlayerCount(count)
        })

        socketInstance.on('game_state_updated', ({counter, players, currentTurnUserId}) => {
            if(counter !== undefined && counter !== null)
                setCounter(Number(counter))
            setPlayers(players || [])
            setCurrentTurnUserId(currentTurnUserId)
        })

        socketInstance.on('turn_changed', ({counter, currentTurnUserId, message}) => {
            if(counter !== undefined && counter !== null)
                setCounter(Number(counter))
            setCurrentTurnUserId(currentTurnUserId)
            setNotification(message)
        })

        return () => {
            socketInstance.disconnect()
        }
    }, [router])

    const numericCurrentId = currentUser.id ? parseInt(String(currentUser.id).replace('user_', ''), 10) : null
    const isMyTurn = Boolean(
        currentTurnUserId &&
        numericCurrentId &&
        Number(currentTurnUserId) === Number(numericCurrentId)
    )

    function handleCounterAction(type){
        if(socket && isMyTurn)  
            socket.emit('action_counter', {type})
    }

    function handleLeaveGame(){
        if(socket){
            socket.emit('leave_game')
            socket.disconnect()
        }
        localStorage.removeItem('playerId')
        localStorage.removeItem('username')
        router.push('/')
    }

    return(
        <div className="paiGame">
            <div className="titulo">
                <p><strong>Jogador logado:</strong> {currentUser.username}</p>
                <p><strong>Jogadores conectados:</strong> {playerCount}</p>

                <button onClick={handleLeaveGame} className="buttonSair">Sair</button>
            </div>

            <div className="menuWindow">
                {notification}
            </div>

            <div className="divGame">
                <h3>Contador atual</h3>
                <h1 className="contador">{counter}</h1>

                <div className="buttons">
                    <button className="buttonMais" onClick={() => handleCounterAction('increment')} disabled={!isMyTurn} style={{cursor: isMyTurn ? 'pointer' : 'not-allowed', opacity: isMyTurn ? 1 : 0.4, backgroundColor: isMyTurn ? "#0070f3" : "#ccc"}}>+</button>
                    <button className="buttonMenos" onClick={() => handleCounterAction('decrement')} disabled={!isMyTurn} style={{cursor: isMyTurn ? 'pointer' : 'not-allowed', opacity: isMyTurn ? 1 : 0.4, backgroundColor: isMyTurn ? "#0070f3" : "#ccc"}}>-</button>

                    {!isMyTurn && (
                        <p className="espera">Aguarde sua vez para alterar o contador</p>
                    )}
                </div>

                <div className="playersList">
                    <p>
                        <strong>Vez de jogar: </strong>
                        <span className="suaVez" style={{color: isMyTurn ? 'green' : 'black'}}>{isMyTurn ? 'Sua vez!' : players.find(p => Number(p.user_id) === Number(currentTurnUserId))?.username || 'Aguardando...'}</span>
                    </p>

                    <h3>Jogadores na sala: </h3>
                    <ul>
                        {players.map((p) => (
                            <li key={p.user_id}>
                                {p.username} {Number(p.user_id) === Number(currentTurnUserId) ? '(Sua vez de jogar)' : ''}
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
        </div>
    )
}