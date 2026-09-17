import { io } from "socket.io-client";

let socketInstance

export const getSocket = () => {
    if (typeof window !== 'undefined' && !socketInstance){
        socketInstance = io('http://127.0.0.1:5000', {
            transports: ['websocket'],
            autoConnect: true
        })
    }
    return socketInstance;
} 