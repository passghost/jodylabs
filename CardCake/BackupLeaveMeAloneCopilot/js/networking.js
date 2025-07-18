// Simplified networking class for multiplayer functionality using WebRTC with BroadcastChannel signaling

class Networking {
    constructor() {
        this.isHost = false;
        this.roomCode = null;
        this.playerName = '';
        this.opponentName = '';
        
        // WebRTC connections
        this.localConnection = null;
        this.dataChannel = null;
        
        // Connection state
        this.isConnected = false;
        this.connectionState = 'disconnected';
        
        // Callbacks
        this.onConnectionStateChange = null;
        this.onMessageReceived = null;
        this.onOpponentJoined = null;
        this.onOpponentLeft = null;
        
        // Signaling - Always use BroadcastChannel for same-device testing
        this.broadcastChannel = new BroadcastChannel('fiteme_signaling');
        this.broadcastChannel.onmessage = (event) => {
            if (event.data && event.data.roomCode === this.roomCode && event.data.sender !== this.playerName) {
                console.log('Received signal via BroadcastChannel:', event.data.type);
                this.handleSignal(event.data);
            }
        };
        
        console.log('Networking initialized with BroadcastChannel');
    }

    // Create a new room
    async createRoom(playerName) {
        this.playerName = playerName;
        this.roomCode = Utils.generateRoomCode();
        this.isHost = true;
        
        console.log('Creating room:', this.roomCode, 'for player:', playerName);
        
        // Save room info
        Utils.saveToStorage(`fiteme_room_${this.roomCode}`, {
            host: playerName,
            created: Date.now()
        });
        
        this.updateConnectionState('connecting');
        return this.roomCode;
    }

    // Join an existing room
    async joinRoom(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode;
        this.isHost = false;
        
        console.log('Joining room:', roomCode, 'as player:', playerName);
        
        // Check if room exists
        const roomInfo = Utils.loadFromStorage(`fiteme_room_${roomCode}`);
        if (!roomInfo) {
            throw new Error('Room not found');
        }
        
        this.opponentName = roomInfo.host;
        this.updateConnectionState('connecting');
        
        // Send join request
        this.sendSignal({
            type: 'join-request',
            playerName: playerName
        });
        
        // Setup WebRTC connection as guest
        await this.setupWebRTCConnection();
    }

    // Send a signal via BroadcastChannel
    sendSignal(signal) {
        if (!this.roomCode) return;
        
        const signalData = {
            ...signal,
            sender: this.playerName,
            roomCode: this.roomCode,
            timestamp: Date.now()
        };
        
        console.log('Sending signal:', signal.type, 'to room:', this.roomCode);
        this.broadcastChannel.postMessage(signalData);
    }

    // Handle incoming signals
    async handleSignal(signal) {
        console.log('Received signal:', signal.type, 'from:', signal.sender);
        
        try {
            switch (signal.type) {
                case 'join-request':
                    if (this.isHost) {
                        this.opponentName = signal.playerName;
                        console.log('Guest joined:', signal.playerName);
                        
                        // Send join acknowledgment
                        this.sendSignal({
                            type: 'join-ack',
                            hostName: this.playerName
                        });
                        
                        // Setup WebRTC connection as host
                        await this.setupWebRTCConnection();
                        
                        if (this.onOpponentJoined) {
                            this.onOpponentJoined(signal.playerName);
                        }
                    }
                    break;
                    
                case 'join-ack':
                    if (!this.isHost) {
                        this.opponentName = signal.hostName;
                        console.log('Join acknowledged by host:', signal.hostName);
                        
                        if (this.onOpponentJoined) {
                            this.onOpponentJoined(signal.hostName);
                        }
                    }
                    break;
                    
                case 'offer':
                    if (!this.isHost && signal.offer) {
                        console.log('Received offer, creating answer...');
                        await this.localConnection.setRemoteDescription(signal.offer);
                        const answer = await this.localConnection.createAnswer();
                        await this.localConnection.setLocalDescription(answer);
                        
                        this.sendSignal({
                            type: 'answer',
                            answer: answer
                        });
                    }
                    break;
                    
                case 'answer':
                    if (this.isHost && signal.answer) {
                        console.log('Received answer, setting remote description...');
                        await this.localConnection.setRemoteDescription(signal.answer);
                    }
                    break;
                    
                case 'ice-candidate':
                    if (signal.candidate) {
                        console.log('Received ICE candidate');
                        await this.localConnection.addIceCandidate(signal.candidate);
                    }
                    break;
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }

    // Setup WebRTC connection
    async setupWebRTCConnection() {
        console.log('Setting up WebRTC connection...');
        
        // Create RTCPeerConnection with STUN servers
        this.localConnection = new RTCPeerConnection({
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        });
        
        // Handle ICE candidates
        this.localConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate');
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            }
        };
        
        // Handle connection state changes
        this.localConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.localConnection.connectionState);
            
            switch (this.localConnection.connectionState) {
                case 'connected':
                    this.isConnected = true;
                    this.updateConnectionState('connected');
                    break;
                case 'disconnected':
                case 'failed':
                case 'closed':
                    this.isConnected = false;
                    this.updateConnectionState('disconnected');
                    break;
            }
        };
        
        if (this.isHost) {
            // Host creates data channel
            this.dataChannel = this.localConnection.createDataChannel('game-data');
            this.setupDataChannel();
            
            // Create and send offer
            const offer = await this.localConnection.createOffer();
            await this.localConnection.setLocalDescription(offer);
            
            this.sendSignal({
                type: 'offer',
                offer: offer
            });
        } else {
            // Guest listens for data channel
            this.localConnection.ondatachannel = (event) => {
                this.dataChannel = event.channel;
                this.setupDataChannel();
            };
        }
    }

    // Setup data channel
    setupDataChannel() {
        if (!this.dataChannel) return;
        
        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.updateConnectionState('connected');
        };
        
        this.dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.updateConnectionState('disconnected');
        };
        
        this.dataChannel.onmessage = (event) => {
            console.log('Received message:', event.data);
            if (this.onMessageReceived) {
                try {
                    const message = JSON.parse(event.data);
                    this.onMessageReceived(message);
                } catch (error) {
                    console.error('Error parsing message:', error);
                }
            }
        };
        
        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
        };
    }

    // Send a message to the opponent
    sendMessage(message) {
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            this.dataChannel.send(JSON.stringify(message));
            return true;
        }
        return false;
    }

    // Update connection state
    updateConnectionState(state) {
        if (this.connectionState !== state) {
            this.connectionState = state;
            console.log('Connection state changed to:', state);
            
            if (this.onConnectionStateChange) {
                this.onConnectionStateChange(state);
            }
        }
    }

    // Check if connected to opponent
    isConnectedToOpponent() {
        return this.isConnected && this.dataChannel && this.dataChannel.readyState === 'open';
    }

    // Get room code
    getRoomCode() {
        return this.roomCode;
    }

    // Get connection stats
    async getConnectionStats() {
        if (!this.localConnection) return null;
        
        const stats = await this.localConnection.getStats();
        const result = {
            connectionState: this.localConnection.connectionState,
            iceConnectionState: this.localConnection.iceConnectionState,
            iceGatheringState: this.localConnection.iceGatheringState,
            signalingState: this.localConnection.signalingState,
            dataChannel: this.dataChannel ? {
                readyState: this.dataChannel.readyState,
                bufferedAmount: this.dataChannel.bufferedAmount
            } : null,
            candidates: {
                local: [],
                remote: []
            }
        };
        
        stats.forEach(report => {
            if (report.type === 'local-candidate') {
                result.candidates.local.push(report);
            } else if (report.type === 'remote-candidate') {
                result.candidates.remote.push(report);
            }
        });
        
        return result;
    }

    // Log connection state
    logConnectionState() {
        if (this.localConnection) {
            console.log('=== Connection State ===');
            console.log('Connection:', this.localConnection.connectionState);
            console.log('ICE Connection:', this.localConnection.iceConnectionState);
            console.log('ICE Gathering:', this.localConnection.iceGatheringState);
            console.log('Signaling:', this.localConnection.signalingState);
            if (this.dataChannel) {
                console.log('Data Channel:', this.dataChannel.readyState);
            }
            console.log('========================');
        }
    }

    // Disconnect and cleanup
    disconnect() {
        this.isConnected = false;
        
        // Close BroadcastChannel
        if (this.broadcastChannel) {
            this.broadcastChannel.close();
            this.broadcastChannel = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        if (this.localConnection) {
            this.localConnection.close();
            this.localConnection = null;
        }
        
        // Clean up room info
        if (this.roomCode) {
            Utils.removeFromStorage(`fiteme_room_${this.roomCode}`);
        }
        
        this.updateConnectionState('disconnected');
        
        if (this.onOpponentLeft && this.opponentName) {
            this.onOpponentLeft(this.opponentName);
        }
    }
}
