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
    const [gameStatus, setGameStatus] = useState('WAITING')
    const [currentTurnUserId, setCurrentTurnUserId] = useState(null)
    const [notification, setNotification] = useState('')
    const [currentUser, setCurrentUser] = useState({id: '', username: ''})
    const [roomId, setRoomId] = useState(null)

    useEffect(() => {
        const storedId = localStorage.getItem('playerId')
        const storedName = localStorage.getItem('username')
        const storedRoomId = localStorage.getItem('selectedRoomId')

        if(!storedId || !storedName || !storedRoomId){
            router.push('/rooms')
            return;
        }

        setCurrentUser({id: storedId, username: storedName})
        setRoomId(storedRoomId)

        const socketInstance = io(getApiUrl(), {
            transports: ['websocket', 'polling']
        })
        setSocket(socketInstance)

        socketInstance.on('connect', () => {
            socketInstance.emit('join_game', {
                userId: storedId, 
                username: storedName,
                roomId: storedRoomId
            })
        })

        socketInstance.on('game_in_progress', (msg) => {
            alert(msg)
            router.push('/rooms')
        })
        
        socketInstance.on('room_full', (msg) => {
            alert(msg)
            router.push('/rooms')
        })

        socketInstance.on('error_message', (msg) => {
            alert(msg)
            router.push('/rooms')
        })

        socketInstance.on('player_count_updated', (count) => {
            setPlayerCount(count)
        })

        socketInstance.on('game_state_updated', ({counter, status, players, currentTurnUserId}) => {
            if(counter !== undefined && counter !== null)
                setCounter(Number(counter))
            if(status)
                setGameStatus(status)
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
            socketInstance.emit('leave_game', {roomId: storedRoomId})
            socketInstance.disconnect()
        }
    }, [router])

    const numericCurrentId = currentUser.id ? parseInt(String(currentUser.id).replace('user_', ''), 10) : null
    const me = players.find(p => Number(p.user_id) === Number(numericCurrentId))
    const isReady = me?.is_ready || false

    const isMyTurn = Boolean(
        gameStatus === 'IN_PROGRESS' &&
        currentTurnUserId &&
        numericCurrentId &&
        Number(currentTurnUserId) === Number(numericCurrentId)
    )

    function handleToggleReady(){
        if(socket && roomId)
            socket.emit('toggle_ready', {roomId})
    }
    
    function handleCounterAction(type){
        if(socket && isMyTurn && roomId)  
            socket.emit('action_counter', {type, roomId})
    }

    function handleResetGame(){
        if(socket && roomId)
            socket.emit('reset_game', {roomId})
    }

    function handleLeaveGame(){
        if(socket && roomId){
            socket.emit('leave_game', {roomId})
            socket.disconnect()
        }
        localStorage.removeItem('selectedRoomId')
        router.push('/rooms')
    }

    return(
        <div className="paiGame">
            <div className="titulo">
                <h2>Mesa do Jogo (Sala #{roomId})</h2>
                <button onClick={handleLeaveGame} className="buttonSair">Sair</button>
            </div>

            <p><strong>Jogador logado:</strong> {currentUser.username}</p>
            <p><strong>Jogadores conectados:</strong> {playerCount}</p>

            <div className="menuWindow">
                {notification}
            </div>

            {gameStatus === 'WAITING' && (
                <div className="menu_lobby">
                    <h3 className="title_lobby">Lobby de Espera</h3>
                    <p className="text_lobby">
                        A partida iniciará quando <strong>todos os johadores</strong> clicarem em "Pronto!"
                    </p>
                    <button onClick={handleToggleReady} style={{backgroundColor: isReady ? '#5cb85c' : '#0070f3'}} className="button_ready">{isReady ? 'Você está pronto! (Clique para cancelar)' : 'Estou Pronto!'}</button>
                </div>
            )}

            <div className="divGame">
                <h3>Contador da Partida</h3>
                <h1 className="contador">{counter}</h1>

                <div className="buttons">
                    <button className="buttonMais" onClick={() => handleCounterAction('increment')} disabled={!isMyTurn} style={{cursor: isMyTurn ? 'pointer' : 'not-allowed', opacity: isMyTurn ? 1 : 0.4, backgroundColor: isMyTurn ? "#0070f3" : "#ccc"}}>+</button>
                    <button className="buttonMenos" onClick={() => handleCounterAction('decrement')} disabled={!isMyTurn} style={{cursor: isMyTurn ? 'pointer' : 'not-allowed', opacity: isMyTurn ? 1 : 0.4, backgroundColor: isMyTurn ? "#0070f3" : "#ccc"}}>-</button>

                    {gameStatus === 'WAITING' && (
                        <p className="espera">Aguardando o início da partida...</p>
                    )}
                    
                    {gameStatus === 'IN_PROGRESS' && !isMyTurn && (
                        <p className="espera">Aguarde sua vez de jogar</p>
                    )}
                </div>

                {gameStatus === 'IN_PROGRESS' && (
                    <div className="button_end_game">
                        <button onClick={handleResetGame}>Finalizar Partida (Voltar para o Lobby)</button>
                    </div>
                )}

                <div className="playersList">
                    <p>
                        <strong>Status da Sala: </strong>
                        <span style={{fontWeight: 'bold', color: gameStatus === 'IN_PROGRESS' ? 'green' : '#f0ad4e'}}>{gameStatus === 'IN_PROGRESS' ? 'Em Andamento' : 'Aguardando o restante do Lobby'}</span>
                    </p>
                    {gameStatus === 'IN_PROGRESS' && (
                        <p>
                            <strong>Vez de jogar: </strong>
                            <span className="suaVez" style={{color: isMyTurn ? 'green' : 'black'}}>{isMyTurn ? 'Sua vez!' : players.find(p => Number(p.user_id) === Number(currentTurnUserId))?.username || 'Aguardando...'}</span>
                        </p>
                    )}
                    

                    <h3>Jogadores na Sala ({players.length}/6):</h3>
                    <ul>
                        {players.map((p) => {
                            const isItHisTurn = Number(p.user_id) === Number(currentTurnUserId) && gameStatus === 'IN_PROGRESS'

                            return(
                                <li key={p.user_id} style={{marginBottom: '6px'}}>
                                    <strong>{p.username}</strong>
                                    {''}
                                    {gameStatus === 'WAITING' ? (
                                        p.is_ready ? (
                                            <span style={{color: 'green', fontWeight: 'bold'}}>[Pronto ✓]</span>
                                        ) : (
                                            <span style={{color: 'grey'}}>[Aguardando...]</span>
                                        )
                                    ) : isItHisTurn ? (
                                        <span style={{color: 'green', fontWeight: 'bold'}}>(Vez de jogar)</span>
                                    ) : null}
                                    {p.username} {Number(p.user_id) === Number(currentTurnUserId) ? '(Sua vez de jogar)' : ''}
                                </li>
                            )
                        })}
                    </ul>
                </div>
            </div>
        </div>
    )
}