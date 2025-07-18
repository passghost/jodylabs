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
            console.log('Loading PeerJS library...');
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js';
            script.onload = () => {
                console.log('PeerJS library loaded successfully');
            };
            script.onerror = () => {
                console.error('Failed to load PeerJS library');
            };
            document.head.appendChild(script);
        } else {
            console.log('PeerJS library already available');
        }
    }
    
    // Helper method to wait for PeerJS library to be available
    waitForPeerJS() {
        return new Promise((resolve) => {
            const checkPeerJS = () => {
                if (typeof Peer !== 'undefined') {
                    resolve();
                } else {
                    setTimeout(checkPeerJS, 100);
                }
            };
            checkPeerJS();
        });
    }
    
    initializePeerJS(customId = null) {
        // Enhanced PeerJS configuration with multiple STUN/TURN servers
        const peerOptions = {
            config: {
                'iceServers': [
                    { urls: 'stun:stun.l.google.com:19302' },
                    { urls: 'stun:stun1.l.google.com:19302' },
                    { urls: 'stun:stun2.l.google.com:19302' },
                    { urls: 'stun:stun3.l.google.com:19302' },
                    { urls: 'stun:stun4.l.google.com:19302' },
                    // Additional STUN servers for better connectivity
                    { urls: 'stun:stun.services.mozilla.com' },
                    { urls: 'stun:stun.stunprotocol.org:3478' }
                ],
                'iceTransportPolicy': 'all'
            },
            // Use reliable connection settings
            reliable: true,
            debug: 2 // Enable debug logging
        };
        
        // Initialize PeerJS
        if (customId) {
            this.peer = new Peer(customId, peerOptions);
        } else {
            this.peer = new Peer(peerOptions);
        }
        
        this.peer.on('open', (id) => {
            console.log('PeerJS connected with ID:', id);
            this.peerId = id;
            
            // Add a small delay to ensure the peer is fully registered
            setTimeout(() => {
                console.log('PeerJS peer fully initialized');
            }, 1000);
        });
        
        this.peer.on('connection', (conn) => {
            console.log('Incoming connection from:', conn.peer);
            this.conn = conn;
            this.setupConnectionHandlers();
            this.isConnected = true;
            this.updateConnectionState('connected');
            
            // Send immediate acknowledgment to confirm connection
            conn.on('open', () => {
                console.log('Incoming connection established and open');
                conn.send({
                    type: 'connection-ack',
                    message: 'Connection established'
                });
            });
            
            if (this.onOpponentJoined) {
                this.onOpponentJoined(conn.peer);
            }
        });
        
        this.peer.on('error', (err) => {
            console.error('PeerJS error:', err);
            if (err.type === 'peer-unavailable') {
                console.log('Peer unavailable - room code may not exist or peer may be offline');
            } else if (err.type === 'unavailable-id') {
                console.log('Peer ID already taken - generating new one');
            }
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
                // Send acknowledgment back
                this.conn.send({
                    type: 'join-ack',
                    playerName: this.playerName
                });
            } else if (data.type === 'join-ack') {
                this.opponentName = data.playerName;
                console.log('Join acknowledged by:', data.playerName);
            } else if (data.type === 'connection-ack') {
                console.log('Connection acknowledged:', data.message);
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
        
        // Wait for PeerJS library to be available
        await this.waitForPeerJS();
        
        let attempts = 0;
        const maxAttempts = 5;
        
        while (attempts < maxAttempts) {
            try {
                // Generate a custom room code for the host
                const customRoomCode = this.generateShortRoomCode();
                console.log(`Attempting to create room with code: ${customRoomCode} (attempt ${attempts + 1})`);
                
                // Initialize PeerJS with custom ID for host
                this.initializePeerJS(customRoomCode);
                
                // Wait for PeerJS to be ready
                return new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => {
                        reject(new Error('Room creation timeout'));
                    }, 20000); // Increased timeout
                    
                    this.peer.on('error', (err) => {
                        clearTimeout(timeout);
                        if (err.type === 'unavailable-id') {
                            console.log('Room code taken, will retry with new code');
                            reject(new Error('RETRY'));
                        } else {
                            console.error('Peer error during room creation:', err);
                            reject(err);
                        }
                    });
                    
                    this.peer.on('open', (id) => {
                        console.log('Host peer opened with ID:', id);
                        // Give the peer extra time to be fully registered on the PeerJS server
                        setTimeout(() => {
                            if (this.peer && this.peerId && this.peer.open) {
                                clearTimeout(timeout);
                                this.roomCode = this.peerId;
                                console.log('Room created successfully with code:', this.roomCode);
                                console.log('Host is ready to accept connections');
                                this.updateConnectionState('waiting');
                                resolve(this.roomCode);
                            }
                        }, 2000); // Increased to 2 seconds for better reliability
                    });
                    
                    // Fallback check in case 'open' event doesn't fire
                    const checkPeer = () => {
                        if (this.peer && this.peerId && this.peer.open) {
                            clearTimeout(timeout);
                            this.roomCode = this.peerId;
                            console.log('Room created successfully with code:', this.roomCode);
                            this.updateConnectionState('waiting');
                            resolve(this.roomCode);
                        } else {
                            setTimeout(checkPeer, 200);
                        }
                    };
                    setTimeout(checkPeer, 2000); // Start checking after 2 seconds
                });
                
            } catch (error) {
                attempts++;
                if (error.message === 'RETRY' && attempts < maxAttempts) {
                    console.log(`Retrying room creation (attempt ${attempts + 1})`);
                    // Clean up the failed peer
                    if (this.peer) {
                        this.peer.destroy();
                        this.peer = null;
                    }
                    continue;
                } else {
                    throw error;
                }
            }
        }
        
        throw new Error('Failed to create room after multiple attempts');
    }
    
    // Generate a short, user-friendly room code
    generateShortRoomCode() {
        const chars = 'ABCDEFGHIJKLMNPQRSTUVWXYZ123456789'; // Avoid confusing chars like O, 0
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    // Join an existing room
    async joinRoom(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode.toUpperCase(); // Normalize to uppercase
        this.isHost = false;
        
        console.log('Attempting to join room:', this.roomCode);
        
        // Wait for PeerJS library to be available
        await this.waitForPeerJS();
        
        // Initialize PeerJS without custom ID for client
        this.initializePeerJS();
        
        // Wait for PeerJS to be ready, then connect
        return new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
                reject(new Error('Connection timeout - unable to establish connection within 25 seconds'));
            }, 25000); // Increased timeout
            
            let connectionAttempted = false;
            
            // Handle peer errors during connection
            const peerErrorHandler = (err) => {
                if (!this.isConnected && !connectionAttempted) {
                    console.error('Peer error during connection:', err);
                    clearTimeout(timeout);
                    
                    let errorMessage = 'Connection failed';
                    if (err.type === 'peer-unavailable') {
                        errorMessage = 'Room not found - please check the room code and ensure the host is online';
                    } else if (err.type === 'network') {
                        errorMessage = 'Network error - please check your internet connection';
                    } else if (err.type === 'server-error') {
                        errorMessage = 'Server error - please try again in a moment';
                    }
                    
                    reject(new Error(errorMessage));
                }
            };
            
            this.peer.on('error', peerErrorHandler);
            
            const attemptConnection = () => {
                if (!this.peer || !this.peerId || !this.peer.open) {
                    setTimeout(attemptConnection, 100);
                    return;
                }
                
                if (connectionAttempted) {
                    return; // Prevent multiple connection attempts
                }
                
                // Add a small delay after peer is ready to ensure proper registration
                setTimeout(() => {
                    if (connectionAttempted) return;
                    connectionAttempted = true;
                    
                    try {
                        console.log('Client peer ready with ID:', this.peerId);
                        console.log('Attempting connection to room:', this.roomCode);
                        
                        // Connect directly to the room code (which is the host's peer ID)
                        this.conn = this.peer.connect(this.roomCode, {
                            reliable: true,
                            metadata: { playerName: playerName }
                        });
                        
                        if (!this.conn) {
                            clearTimeout(timeout);
                            reject(new Error('Failed to create connection object - room may not exist'));
                            return;
                        }
                        
                        this.setupConnectionHandlers();
                        
                        // Connection opened successfully
                        this.conn.on('open', () => {
                            console.log('Connection opened to host');
                            clearTimeout(timeout);
                            this.peer.off('error', peerErrorHandler); // Remove error handler
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
                            
                            resolve();
                        });
                        
                        // Connection error
                        this.conn.on('error', (err) => {
                            console.error('Connection error:', err);
                            clearTimeout(timeout);
                            this.peer.off('error', peerErrorHandler); // Remove error handler
                            
                            let errorMessage = 'Failed to connect to room';
                            if (err.message && err.message.includes('Negotiation')) {
                                errorMessage = 'Connection negotiation failed - this could be due to network restrictions or the host being offline';
                            } else if (err.message && err.message.includes('unavailable')) {
                                errorMessage = 'Room not found - please verify the room code';
                            } else if (err.type === 'peer-unavailable') {
                                errorMessage = 'Room not found - please check the room code and ensure the host is online';
                            }
                            
                            reject(new Error(errorMessage));
                        });
                        
                        // Connection closed before opening
                        this.conn.on('close', () => {
                            if (!this.isConnected) {
                                console.log('Connection closed before opening');
                                clearTimeout(timeout);
                                this.peer.off('error', peerErrorHandler); // Remove error handler
                                reject(new Error('Connection closed by host before establishing'));
                            }
                        });
                        
                    } catch (error) {
                        console.error('Failed to initiate connection:', error);
                        clearTimeout(timeout);
                        this.peer.off('error', peerErrorHandler); // Remove error handler
                        reject(new Error('Failed to initiate connection: ' + error.message));
                    }
                }, 1000); // Wait 1 second after peer is ready
            };
            
            attemptConnection();
        });
    }
    
    // Check if a room exists before joining
    async checkRoomExists(roomCode) {
        console.log('Checking if room exists:', roomCode);
        
        try {
            await this.waitForPeerJS();
            
            const testPeer = new Peer({
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' }
                    ]
                }
            });
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    testPeer.destroy();
                    resolve(false); // Assume room doesn't exist if timeout
                }, 5000);
                
                testPeer.on('open', () => {
                    // Try to connect to the room
                    const testConn = testPeer.connect(roomCode.toUpperCase());
                    
                    testConn.on('open', () => {
                        clearTimeout(timeout);
                        testConn.close();
                        testPeer.destroy();
                        resolve(true);
                    });
                    
                    testConn.on('error', (err) => {
                        clearTimeout(timeout);
                        testPeer.destroy();
                        if (err.type === 'peer-unavailable') {
                            resolve(false);
                        } else {
                            resolve(true); // Other errors might mean room exists but connection failed
                        }
                    });
                });
                
                testPeer.on('error', () => {
                    clearTimeout(timeout);
                    testPeer.destroy();
                    resolve(false);
                });
            });
            
        } catch (error) {
            console.error('Room check error:', error);
            return false;
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
    
    // Test connection to PeerJS server
    async testConnection() {
        console.log('Testing connection to PeerJS server...');
        
        try {
            await this.waitForPeerJS();
            
            const testPeer = new Peer({
                config: {
                    'iceServers': [
                        { urls: 'stun:stun.l.google.com:19302' }
                    ]
                }
            });
            
            return new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    testPeer.destroy();
                    reject(new Error('Connection test timeout'));
                }, 10000);
                
                testPeer.on('open', (id) => {
                    clearTimeout(timeout);
                    console.log('Connection test successful, peer ID:', id);
                    testPeer.destroy();
                    resolve(true);
                });
                
                testPeer.on('error', (err) => {
                    clearTimeout(timeout);
                    console.error('Connection test failed:', err);
                    testPeer.destroy();
                    reject(err);
                });
            });
            
        } catch (error) {
            console.error('Connection test error:', error);
            throw error;
        }
    }
}
