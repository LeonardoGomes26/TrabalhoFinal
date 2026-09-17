import { io } from "socket.io-client";

let socketInstance

export const getSocket = () => {
    if (typeof window !== 'undefined' && !socketInstance){
        socketInstance = io('https://cgxkcdx6-5000.brs.devtunnels.ms', {
            transports: ['polling', 'websocket'],
            secure: true,
            autoConnect: true
        })
    }
    return socketInstance;
} 