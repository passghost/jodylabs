// Simple networking class for multiplayer functionality using PeerJS

class Networking {
    constructor() {
        this.isHost = false;
        this.roomCode = null;
        this.playerName = '';
        this.opponentName = '';
        
        // PeerJS connections
        this.peer = null;
        this.conn = null;
        this.peerId = null;
        
        // Connection state
        this.isConnected = false;
        this.connectionState = 'disconnected';
        
        // Callbacks
        this.onConnectionStateChange = null;
        this.onMessageReceived = null;
        this.onOpponentJoined = null;
        this.onOpponentLeft = null;
        
        // Initialize PeerJS
        this.setupSignaling();
        
        console.log('Networking initialized with PeerJS for online multiplayer');
    }
    
    setupSignaling() {
        // Load PeerJS library if not already loaded
        if (typeof Peer === 'undefined') {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
            script.onload = () => {
                this.initializePeerJS();
            };
            document.head.appendChild(script);
        } else {
            this.initializePeerJS();
        }
    }
    
    initializePeerJS() {
        // Initialize PeerJS with free public server
        this.peer = new Peer({
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' }
                ]
            }
        });
        
        this.peer.on('open', (id) => {
            console.log('PeerJS connected with ID:', id);
            this.peerId = id;
        });
        
        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.conn = conn;
            this.setupConnectionHandlers();
            this.isConnected = true;
            this.updateConnectionState('connected');
            
            if (this.onOpponentJoined) {
                this.onOpponentJoined(conn.peer);
            }
        });
        
        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            this.updateConnectionState('error');
        });
    }
    
    setupConnectionHandlers() {
        if (!this.conn) return;
        
        this.conn.on('data', (data) => {
            console.log('Received data:', data);
            if (data.type === 'game-message' && this.onMessageReceived) {
                this.onMessageReceived(data.payload);
            } else if (data.type === 'join-request') {
                this.opponentName = data.playerName;
                console.log('Opponent joined:', data.playerName);
            }
        });
        
        this.conn.on('close', () => {
            console.log('Connection closed');
            this.isConnected = false;
            this.updateConnectionState('disconnected');
            if (this.onOpponentLeft) {
                this.onOpponentLeft('Opponent');
            }
        });
        
        this.conn.on('error', (err) => {
            console.error('Connection error:', err);
        });
    }

    // Create a new room
    async createRoom(playerName) {
        this.playerName = playerName;
        this.isHost = true;
        
        // Wait for PeerJS to be ready
        if (!this.peer || !this.peerId) {
            return new Promise((resolve) => {
                const checkPeer = () => {
                    if (this.peer && this.peerId) {
                        this.roomCode = this.peerId;
                        console.log('Room created with ID:', this.roomCode);
                        this.updateConnectionState('waiting');
                        resolve(this.roomCode);
                    } else {
                        setTimeout(checkPeer, 100);
                    }
                };
                checkPeer();
            });
        } else {
            this.roomCode = this.peerId;
            console.log('Room created with ID:', this.roomCode);
            this.updateConnectionState('waiting');
            return this.roomCode;
        }
    }

    // Join an existing room
    async joinRoom(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode;
        this.isHost = false;
        
        console.log('Attempting to join room:', roomCode);
        
        // Wait for PeerJS to be ready
        if (!this.peer) {
            throw new Error('PeerJS not initialized');
        }
        
        try {
            this.conn = this.peer.connect(roomCode);
            this.setupConnectionHandlers();
            
            this.conn.on('open', () => {
                console.log('Connected to host');
                this.isConnected = true;
                this.updateConnectionState('connected');
                
                // Send join message
                this.conn.send({
                    type: 'join-request',
                    playerName: playerName
                });
                
                if (this.onOpponentJoined) {
                    this.onOpponentJoined('Host');
                }
            });
            
        } catch (error) {
            console.error('Failed to connect:', error);
            throw new Error('Failed to connect to room');
        }
    }
    
    sendMessage(message) {
        if (!this.conn || !this.isConnected) {
            console.warn('No connection available for sending message');
            return;
        }
        
        console.log('Sending game message:', message);
        this.conn.send({
            type: 'game-message',
            payload: message
        });
    }
    
    updateConnectionState(state) {
        this.connectionState = state;
        console.log('Connection state:', state);
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange(state);
        }
    }

    disconnect() {
        this.isConnected = false;
        
        // Close PeerJS connection
        if (this.conn) {
            this.conn.close();
            this.conn = null;
        }
        
        // Close peer
        if (this.peer) {
            this.peer.destroy();
            this.peer = null;
        }
        
        this.updateConnectionState('disconnected');
        
        if (this.onOpponentLeft && this.opponentName) {
            this.onOpponentLeft(this.opponentName);
        }
    }
}
