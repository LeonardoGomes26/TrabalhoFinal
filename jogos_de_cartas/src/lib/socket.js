import { io } from "socket.io-client";

let socket = null

function getServerURL(){
    if (typeof window === "undefined") return "http://localhost:5000";
  
    const { hostname, origin } = window.location;
    
    if (hostname === "localhost" || hostname === "127.0.0.1") {
        return "http://localhost:5000";
    }
    
    return origin.replace("-3000", "-5000");
}

export const getSocket = () => {
    if (typeof window === "undefined") return null;

    if (!socket) {
        const serverUrl = getServerURL();
        const playerId = localStorage.getItem("playerId");

        socket = io(serverUrl, {
        auth: {
            playerId: playerId
        },
        extraHeaders: {
            "X-Tunnel-Skip-Anti-Phishing-Page": "true"
        }
        });
    }

    return socket;
} 