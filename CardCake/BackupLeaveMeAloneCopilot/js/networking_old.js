// Networking class for multiplayer functionality using WebRTC with localStorage signaling

class Networking {
    constructor(signalingMethod = 'broadcastChannel') {
        this.signalingMethod = signalingMethod;
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
        
        // Message queue
        this.messageQueue = [];
        
        // ICE candidate queue
        this.iceCandidateQueue = [];
        
        // Signal tracking flags
        this.joinRequestReceived = false;
        this.joinAckReceived = false;
        this.offerReceived = false;
        this.answerReceived = false;
        this.isRetrying = false;
        this.processingOffer = false;
        this.processingAnswer = false;
        this.creatingAnswer = false;
        this.pendingRemoteDescription = false;
        
        // Retry tracking
        this._offerRetryCount = 0;
        this._answerRetryCount = 0;
        this._offerRequestCount = 0;
        this._lastOfferRequestTime = 0;
        
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
        this.setupSignaling();
    }

    setupSignaling() {
        // Always use BroadcastChannel - no polling needed
        console.log('BroadcastChannel signaling setup complete');
    }

    checkForSignals() {
        // No longer needed - using BroadcastChannel only
        return;
    }

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

    async handleSignal(signal) {
        console.log('Received signal:', signal.type, 'from:', signal.sender);
        
        try {
            switch (signal.type) {
                case 'offer':
                    await this.handleOffer(signal);
                    break;
                case 'answer':
                    await this.handleAnswer(signal);
                    break;
                case 'ice-candidate':
                    await this.handleIceCandidate(signal);
                    break;
                case 'join-room':
                    await this.handleJoinRoom(signal);
                    break;
                case 'join-ack':
                    await this.handleJoinAck(signal);
                    break;
                case 'request-offer':
                    await this.handleRequestOffer(signal);
                    break;
                default:
                    console.log('Unknown signal type:', signal.type);
            }
        } catch (error) {
            console.error('Error handling signal:', error);
        }
    }
    
    async handleJoinAck(signal) {
        if (this.isHost) return;
        
        console.log('Join request acknowledged by host:', signal.hostName);
        this.joinAckReceived = true;
        
        // Host has acknowledged our join, we're now waiting for an offer
        console.log('Waiting for offer from host...');
        
        // If no offer is received within a reasonable time, send another join request
        setTimeout(() => {
            if (this.connectionState !== 'connected' && !this.offerReceived) {
                console.log('No offer received after join-ack, sending another join request...');
                this.sendSignal({
                    type: 'join-room',
                    guestName: this.playerName
                });
            }
        }, 5000);
    }

    // Create a new room
    async createRoom(playerName) {
        this.playerName = playerName;
        this.roomCode = Utils.generateRoomCode();
        this.isHost = true;
        this.joinRequestReceived = false;
        this.answerReceived = false;
        
        console.log('Creating room:', this.roomCode);
        
        try {
            // Clear any existing signals
            Utils.saveToStorage(`fiteme_signals_${this.roomCode}_host`, []);
            Utils.saveToStorage(`fiteme_signals_${this.roomCode}_guest`, []);
            
            await this.setupWebRTCAsHost();
            this.updateConnectionState('connecting');
            
            // Store room info
            this.storeRoomInfo({
                roomCode: this.roomCode,
                hostName: playerName,
                timestamp: Date.now(),
                status: 'waiting'
            });
            
            return this.roomCode;
        } catch (error) {
            console.error('Failed to create room:', error);
            this.updateConnectionState('error');
            throw error;
        }
    }

    // Join an existing room
    async joinRoom(roomCode, playerName) {
        this.playerName = playerName;
        this.roomCode = roomCode;
        this.isHost = false;
        this.offerReceived = false;
        this.joinAckReceived = false;
        
        console.log('Joining room:', roomCode);
        
        try {
            // Check if room exists
            const roomInfo = this.getRoomInfo(roomCode);
            console.log('Room info found:', roomInfo);
            
            if (!roomInfo) {
                // Wait a bit and try again in case room was just created
                await new Promise(resolve => setTimeout(resolve, 1000));
                const retryRoomInfo = this.getRoomInfo(roomCode);
                if (!retryRoomInfo) {
                    throw new Error('Room not found');
                }
                console.log('Room found on retry:', retryRoomInfo);
            }
            
            const finalRoomInfo = roomInfo || this.getRoomInfo(roomCode);
            
            if (finalRoomInfo.status === 'full') {
                throw new Error('Room is full');
            }
            
            this.opponentName = finalRoomInfo.hostName;
            this.updateConnectionState('connecting');
            
            // Clear any old signals that might be in the queue
            Utils.saveToStorage(`fiteme_signals_${this.roomCode}_host`, []);
            Utils.saveToStorage(`fiteme_signals_${this.roomCode}_guest`, []);
            
            await this.setupWebRTCAsGuest();
            
            // Send the join signal immediately and then set up retries
            console.log('Sending join-room signal to host');
            this.sendSignal({
                type: 'join-room',
                guestName: playerName
            });
            
            // Set up retry if we don't get acknowledgement
            const joinRetryInterval = setInterval(() => {
                if (!this.joinAckReceived && !this.offerReceived) {
                    console.log('No response from host, sending join-room signal again');
                    this.sendSignal({
                        type: 'join-room',
                        guestName: playerName
                    });
                } else {
                    clearInterval(joinRetryInterval);
                }
            }, 3000);
            
            // Clear retry interval after 30 seconds regardless
            setTimeout(() => {
                if (joinRetryInterval) {
                    clearInterval(joinRetryInterval);
                }
            }, 30000);
            
        } catch (error) {
            console.error('Failed to join room:', error);
            this.updateConnectionState('error');
            throw error;
        }
    }

    async setupWebRTCAsHost() {
        const configuration = {
            iceServers: [
                // Free public STUN servers
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                // Free TURN servers with credentials (more reliable for NAT traversal)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceTransportPolicy: 'all'
        };

        this.localConnection = new RTCPeerConnection(configuration);
        this.setupConnectionEventHandlers();
        
        // Host creates data channel - use more reliable settings
        this.dataChannel = this.localConnection.createDataChannel('gameData', {
            ordered: true,
            maxPacketLifeTime: 5000, // 5 seconds timeout for packets
            negotiated: true,
            id: 0 // Use fixed channel ID to avoid negotiation issues
        });
        this.setupDataChannelHandlers();
        
        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.log('Connection timeout reached');
                this.updateConnectionState('error');
            }
        }, 45000); // 45 second timeout - increased for better reliability
    }

    async setupWebRTCAsGuest() {
        const configuration = {
            iceServers: [
                // Free public STUN servers
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { urls: 'stun:stun2.l.google.com:19302' },
                // Free TURN servers with credentials (more reliable for NAT traversal)
                {
                    urls: 'turn:openrelay.metered.ca:80',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                },
                {
                    urls: 'turn:openrelay.metered.ca:443?transport=tcp',
                    username: 'openrelayproject',
                    credential: 'openrelayproject'
                }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceTransportPolicy: 'all'
        };

        this.localConnection = new RTCPeerConnection(configuration);
        this.setupConnectionEventHandlers();
        
        // Guest will receive data channel
        this.localConnection.addEventListener('datachannel', (event) => {
            console.log('Data channel received from host');
            this.dataChannel = event.channel;
            this.setupDataChannelHandlers();
        });
        
        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
            if (!this.isConnected) {
                console.log('Connection timeout reached');
                this.updateConnectionState('error');
            }
        }, 45000); // 45 second timeout - increased for better reliability
    }

    setupConnectionEventHandlers() {
        this.localConnection.addEventListener('icecandidate', (event) => {
            if (event.candidate) {
                this.iceCandidatesGathered = (this.iceCandidatesGathered || 0) + 1;
                const candidateType = event.candidate.type || (event.candidate.candidate ? event.candidate.candidate.split(' ')[7] : 'unknown');
                console.log(`Sending ICE candidate #${this.iceCandidatesGathered} (${candidateType})`);
                this.sendSignal({
                    type: 'ice-candidate',
                    candidate: event.candidate
                });
            } else {
                console.log('ICE gathering completed');
                this.gatheringComplete = true;
            }
        });

        this.localConnection.addEventListener('connectionstatechange', () => {
            const state = this.localConnection.connectionState;
            console.log('WebRTC connection state changed:', state);
            if (state === 'connected') {
                console.log('WebRTC connected successfully!');
            }
            if (state === 'failed') {
                console.log('WebRTC connection failed, will retry in 2 seconds if still failed.');
                setTimeout(() => {
                    if (this.localConnection.connectionState === 'failed') {
                        this.updateConnectionState('error');
                        this.attemptReconnection();
                    }
                }, 2000);
            }
        });

        this.localConnection.addEventListener('iceconnectionstatechange', () => {
            const iceState = this.localConnection.iceConnectionState;
            console.log('ICE connection state:', iceState);
            if (iceState === 'connected' || iceState === 'completed') {
                console.log('ICE connection established!');
            }
            if (iceState === 'failed') {
                console.log('ICE connection failed, will retry in 2 seconds if still failed.');
                setTimeout(() => {
                    if (this.localConnection.iceConnectionState === 'failed') {
                        this.updateConnectionState('error');
                        this.attemptReconnection();
                    }
                }, 2000);
            }
        });

        // Data channel state logging
        if (this.dataChannel) {
            this.dataChannel.addEventListener('open', () => {
                console.log('Data channel opened');
                this.isConnected = true;
                this.updateConnectionState('connected');
                this.processMessageQueue();
            });
            this.dataChannel.addEventListener('close', () => {
                console.log('Data channel closed');
                this.isConnected = false;
                this.updateConnectionState('disconnected');
            });
            this.dataChannel.addEventListener('error', (error) => {
                console.error('Data channel error:', error);
                this.updateConnectionState('error');
            });
        }
    }

    async createOffer() {
        if (this.processingOffer) {
            console.log('Already creating an offer, ignoring duplicate request');
            return;
        }
        
        this.processingOffer = true;
        
        try {
            console.log('Creating new offer...');
            
            // If we're in a bad state, reset the connection
            if (!this.localConnection || 
                this.localConnection.connectionState === 'failed' || 
                this.localConnection.iceConnectionState === 'failed' ||
                this.localConnection.signalingState === 'closed') {
                console.log('Connection in bad state before creating offer, resetting...');
                
                // Close old connection if it exists
                if (this.localConnection) {
                    this.localConnection.close();
                }
                
                // Set up a fresh connection
                await this.setupWebRTCAsHost();
            }
            
            // Set initial timeout for gathering candidates
            this.gatheringComplete = false;
            this.iceCandidatesGathered = 0;
            
            // Create the offer with unified plan format
            const offerOptions = {
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            };
            
            const offer = await this.localConnection.createOffer(offerOptions);
            console.log('Offer created with SDP type:', offer.type);
            
            // Set local description - check signaling state first
            if (this.localConnection.signalingState !== 'stable') {
                console.log(`Warning: Setting local description in non-stable state: ${this.localConnection.signalingState}`);
            }
            
            await this.localConnection.setLocalDescription(offer);
            console.log('Local description set');
            
            // Give some time for ICE candidates to gather before sending offer
            // This can help with connection establishment
            await new Promise(resolve => {
                const checkGatheringState = () => {
                    if (this.localConnection.iceGatheringState === 'complete') {
                        console.log('ICE gathering complete naturally');
                        this.gatheringComplete = true;
                        resolve();
                    } else if (this.iceCandidatesGathered >= 3) {
                        // If we've collected at least 3 candidates, proceed
                        console.log('Collected enough ICE candidates, proceeding');
                        resolve();
                    } else {
                        setTimeout(checkGatheringState, 500);
                    }
                };
                
                // Start checking after a small delay
                setTimeout(checkGatheringState, 500);
                
                // Timeout after 3 seconds regardless
                setTimeout(() => {
                    console.log('ICE gathering timeout reached, proceeding anyway');
                    resolve();
                }, 3000);
            });
            
            // Get the current description (which might have been updated with ICE candidates)
            if (!this.localConnection || !this.localConnection.localDescription) {
                console.error('Connection lost while gathering candidates');
                return;
            }
            
            const currentOffer = this.localConnection.localDescription;
            
            console.log('Sending offer to guest after gathering ICE candidates');
            this.sendSignal({
                type: 'offer',
                offer: currentOffer
            });
        } catch (error) {
            console.error('Failed to create offer:', error);
        } finally {
            this.processingOffer = false;
        }
    }

    async handleOffer(signal) {
        if (this.isHost) return;
        
        console.log('Received offer from host');
        
        // Set flag but avoid processing duplicate offers simultaneously
        if (this.processingOffer) {
            console.log('Already processing an offer, ignoring duplicate');
            return;
        }
        
        this.processingOffer = true;
        this.offerReceived = true;
        
        try {
            // If we're in a bad state, reset the connection
            if (!this.localConnection || 
                this.localConnection.connectionState === 'failed' || 
                this.localConnection.iceConnectionState === 'failed') {
                console.log('Connection in failed state before processing offer, resetting...');
                
                // Close old connection
                if (this.localConnection) {
                    this.localConnection.close();
                }
                
                // Set up a fresh connection
                await this.setupWebRTCAsGuest();
            }
            
            // Before setting a new remote description, clear any existing operations
            if (this.pendingRemoteDescription) {
                console.log('Canceling pending remote description operation');
                this.pendingRemoteDescription = false;
            }
            
            console.log('Setting remote description (offer)');
            this.pendingRemoteDescription = true;
            await this.localConnection.setRemoteDescription(signal.offer);
            this.pendingRemoteDescription = false;
            console.log('Remote description set successfully');
            
            // Process any queued ICE candidates now that remote description is set
            await this.processQueuedIceCandidates();
            
            // Wait a moment before creating answer to let remote candidates process
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Reset answer creation flag
            this.creatingAnswer = false;
            
            console.log('Creating answer...');
            this.creatingAnswer = true;
            const answer = await this.localConnection.createAnswer();
            console.log('Answer created, setting local description');
            
            // Before setting local description, make sure we're not in an inconsistent state
            if (this.localConnection.signalingState !== 'have-remote-offer') {
                console.log('Unexpected signaling state, cannot set local description:', this.localConnection.signalingState);
                this.processingOffer = false;
                this.creatingAnswer = false;
                return;
            }
            
            await this.localConnection.setLocalDescription(answer);
            this.creatingAnswer = false;
            
            // Wait for some ICE candidates to gather before sending answer
            this.iceCandidatesGathered = 0;
            await new Promise(resolve => {
                const checkGatheringState = () => {
                    if (this.localConnection.iceGatheringState === 'complete') {
                        console.log('ICE gathering complete before sending answer');
                        resolve();
                    } else if (this.iceCandidatesGathered >= 2) {
                        console.log('Collected enough ICE candidates for answer, proceeding');
                        resolve();
                    } else {
                        setTimeout(checkGatheringState, 500);
                    }
                };
                
                // Start checking after a small delay
                setTimeout(checkGatheringState, 500);
                
                // Timeout after 2 seconds regardless
                setTimeout(() => {
                    console.log('ICE gathering timeout for answer reached, proceeding anyway');
                    resolve();
                }, 2000);
            });
            
            // Get the current description (which might have been updated with ICE candidates)
            const currentAnswer = this.localConnection.localDescription;
            
            console.log('Local description set, sending answer');
            this.sendSignal({
                type: 'answer',
                answer: currentAnswer
            });
            console.log('Answer sent to host');
            
            // Set up a progressive retry mechanism - gradually increasing timeout
            this._offerRetryCount = (this._offerRetryCount || 0) + 1;
            const timeout = Math.min(5000 + (this._offerRetryCount * 2000), 15000); // Start at 5s, max 15s
            
            console.log(`Setting up retry #${this._offerRetryCount} with timeout ${timeout}ms`);
            
            // If we don't connect within the timeout, request another offer
            setTimeout(() => {
                if (this.connectionState !== 'connected') {
                    console.log(`Connection not established after answering (retry #${this._offerRetryCount}), requesting another offer...`);
                    
                    // If we've tried multiple times, do a full reset first
                    if (this._offerRetryCount >= 3) {
                        console.log('Multiple retries failed, forcing connection reset...');
                        this.forceResetConnection().then(() => {
                            // After reset, send request for new offer
                            this.sendSignal({
                                type: 'request-offer',
                                guestName: this.playerName
                            });
                        });
                    } else {
                        // Just request a new offer
                        this.sendSignal({
                            type: 'request-offer',
                            guestName: this.playerName
                        });
                    }
                }
            }, timeout);
            
        } catch (error) {
            console.error('Failed to handle offer:', error);
            this.updateConnectionState('error');
        } finally {
            // Clear the processing flag
            this.processingOffer = false;
        }
    }

    async handleAnswer(signal) {
        if (!this.isHost) return;
        
        console.log('Received answer from guest');
        
        // Avoid processing duplicate answers simultaneously
        if (this.processingAnswer) {
            console.log('Already processing an answer, ignoring duplicate');
            return;
        }
        
        this.processingAnswer = true;
        this.answerReceived = true;
        
        try {
            // If we're in a bad state, log warning but try anyway
            if (!this.localConnection || 
                this.localConnection.signalingState !== 'have-local-offer') {
                console.log(`Warning: Processing answer in non-offer state: ${this.localConnection?.signalingState || 'no connection'}`);
                
                // If connection is closed or null, we can't set remote description
                if (!this.localConnection || 
                    this.localConnection.connectionState === 'closed' || 
                    this.localConnection.signalingState === 'closed') {
                    console.error('Cannot set remote description on closed/null connection');
                    this.processingAnswer = false;
                    return;
                }
            }
            
            // Proceed with setting remote description
            await this.localConnection.setRemoteDescription(signal.answer);
            console.log('Guest answer set as remote description');
            
            // Process any queued ICE candidates now that remote description is set
            await this.processQueuedIceCandidates();
            
            // Progressive retry mechanism with increasing timeouts
            this._answerRetryCount = (this._answerRetryCount || 0) + 1;
            const timeout = Math.min(6000 + (this._answerRetryCount * 2000), 15000);
            
            console.log(`Setting up host retry #${this._answerRetryCount} with timeout ${timeout}ms`);
            
            // If connection doesn't establish within the timeout, try again
            setTimeout(() => {
                if (this.connectionState !== 'connected' && this.answerReceived) {
                    console.log(`Connection not established after answer (retry #${this._answerRetryCount}), creating new offer...`);
                    
                    // If we've tried multiple times, do a full reset
                    if (this._answerRetryCount >= 3) {
                        console.log('Multiple host retries failed, forcing connection reset...');
                        this.forceResetConnection().then(() => {
                            this.createOffer();
                        });
                    } else {
                        this.createOffer();
                    }
                }
            }, timeout);
            
        } catch (error) {
            console.error('Failed to handle answer:', error);
            this.updateConnectionState('error');
            
            // If we get an error, try to reset the connection after a brief delay
            setTimeout(() => {
                if (this.connectionState !== 'connected') {
                    console.log('Resetting connection after answer error...');
                    this.retryConnection();
                }
            }, 3000);
        } finally {
            this.processingAnswer = false;
        }
    }
    
    async handleRequestOffer(signal) {
        if (!this.isHost) return;
        
        console.log('Received explicit offer request from guest:', signal.guestName);
        
        // If we've received too many requests in a short time, slow down
        if (this._lastOfferRequestTime && (Date.now() - this._lastOfferRequestTime < 5000)) {
            console.log('Offer requests coming too quickly, throttling...');
            
            // If we've had multiple requests in short succession, more drastic action is needed
            if (this._offerRequestCount && this._offerRequestCount >= 3) {
                console.log('Multiple offer requests in short time, forcing connection reset...');
                await this.forceResetConnection();
                this._offerRequestCount = 0;
            } else {
                this._offerRequestCount = (this._offerRequestCount || 0) + 1;
                return; // Skip this request
            }
        }
        
        // Update request tracking
        this._lastOfferRequestTime = Date.now();
        
        // Ensure the connection is in a good state before creating a new offer
        if (!this.localConnection || 
            this.localConnection.connectionState === 'failed' || 
            this.localConnection.iceConnectionState === 'failed' ||
            this.localConnection.signalingState === 'closed') {
            console.log('Connection in failed state, resetting before creating new offer...');
            await this.forceResetConnection();
        }
        
        // Create and send a new offer
        console.log('Creating new offer upon request...');
        await this.createOffer();
    }
    
    async forceResetConnection() {
        console.log('Forcing complete connection reset...');
        
        // Close and clean up old connection
        if (this.localConnection) {
            this.localConnection.close();
            this.localConnection = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        // Clear all state
        this.iceCandidateQueue = [];
        this.processingOffer = false;
        this.processingAnswer = false;
        this.creatingAnswer = false;
        this.pendingRemoteDescription = false;
        
        // Wait a moment to ensure cleanup
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Set up a fresh connection
        if (this.isHost) {
            await this.setupWebRTCAsHost();
        } else {
            await this.setupWebRTCAsGuest();
        }
        
        // Update connection state
        this.updateConnectionState('connecting');
    }

    async handleIceCandidate(signal) {
        if (!signal.candidate) {
            console.log('Received empty ICE candidate, ignoring');
            return;
        }
        
        // Check if this is a candidate with a valid mid value
        if (signal.candidate.sdpMid !== '0' && signal.candidate.sdpMid !== null && signal.candidate.sdpMid !== undefined) {
            // If we have transceivers with mid=0 only, we need to modify the candidate
            const transceivers = this.localConnection.getTransceivers();
            if (transceivers.length === 1 && transceivers[0].mid === '0') {
                console.log(`Fixing ICE candidate mid=${signal.candidate.sdpMid} to mid=0`);
                signal.candidate.sdpMid = '0';
                signal.candidate.usernameFragment = this.localConnection.localDescription?.sdp.match(/a=ice-ufrag:(.*)\r\n/)?.[1] || undefined;
            }
        }
        
        console.log(`Received ICE candidate mid=${signal.candidate.sdpMid} mLineIdx=${signal.candidate.sdpMLineIndex} type=${signal.candidate.type || 'unknown'}`);
        
        try {
            if (this.localConnection.remoteDescription) {
                try {
                    await this.localConnection.addIceCandidate(signal.candidate);
                    console.log('ICE candidate added successfully');
                } catch (innerError) {
                    if (innerError.toString().includes('No such transceiver')) {
                        console.log('Transceiver mismatch, modifying candidate...');
                        
                        // Try with modified candidate - set to first available mid
                        const fixedCandidate = {...signal.candidate};
                        fixedCandidate.sdpMid = '0';  // Default to data channel mid
                        fixedCandidate.sdpMLineIndex = 0;
                        
                        try {
                            await this.localConnection.addIceCandidate(fixedCandidate);
                            console.log('Modified ICE candidate added successfully');
                        } catch (modifiedError) {
                            console.error('Failed to add modified ICE candidate:', modifiedError);
                            // Don't queue candidates that fail even after modification
                        }
                    } else {
                        // Other error, queue the candidate
                        console.error('Standard ICE candidate add failed:', innerError);
                        this.iceCandidateQueue.push(signal.candidate);
                    }
                }
            } else {
                // Queue ICE candidate if remote description not set yet
                console.log('Queueing ICE candidate - no remote description yet');
                this.iceCandidateQueue.push(signal.candidate);
                
                // Log the queue length
                console.log(`ICE candidate queue length: ${this.iceCandidateQueue.length}`);
            }
        } catch (error) {
            console.error('Failed to add ICE candidate:', error);
        }
    }
    
    async processQueuedIceCandidates() {
        console.log(`Processing ${this.iceCandidateQueue.length} queued ICE candidates`);
        
        if (!this.localConnection || !this.localConnection.remoteDescription) {
            console.log('Cannot process ICE candidates - no connection or remote description');
            return; // Keep the queue for later
        }
        
        // Get all available mid values from transceivers
        const availableMids = new Set();
        
        // For data channel connections, we always need mid=0 even if there are no transceivers
        availableMids.add('0');
        
        try {
            const transceivers = this.localConnection.getTransceivers();
            transceivers.forEach(transceiver => {
                if (transceiver.mid !== null && transceiver.mid !== undefined) {
                    availableMids.add(transceiver.mid);
                }
            });
            console.log('Available mid values:', Array.from(availableMids));
        } catch (e) {
            console.error('Error getting transceiver info:', e);
            // We already added '0' as a fallback
        }
        
        // Filter for unique candidates (avoid duplicates)
        const uniqueCandidates = [];
        const uniqueKeys = new Set();
        
        for (const candidate of this.iceCandidateQueue) {
            if (!candidate) continue;
            
            // Create a key based on candidate content
            const key = `${candidate.candidate || ''}`;
            if (!uniqueKeys.has(key)) {
                uniqueKeys.add(key);
                
                // Check if we need to fix the candidate's mid value
                if (candidate.sdpMid !== null && !availableMids.has(candidate.sdpMid) && availableMids.size > 0) {
                    // Clone candidate and fix mid value to match available transceiver
                    const fixedCandidate = {...candidate};
                    fixedCandidate.sdpMid = availableMids.values().next().value; // Use first available mid
                    fixedCandidate.sdpMLineIndex = 0;
                    uniqueCandidates.push(fixedCandidate);
                    console.log(`Fixing candidate mid=${candidate.sdpMid} to mid=${fixedCandidate.sdpMid}`);
                } else {
                    uniqueCandidates.push(candidate);
                }
            }
        }
        
        console.log(`Filtered to ${uniqueCandidates.length} unique ICE candidates`);
        
        // Clear the original queue
        this.iceCandidateQueue = [];
        const failedCandidates = [];
        
        // Process unique candidates
        for (const candidate of uniqueCandidates) {
            try {
                if (this.localConnection && this.localConnection.remoteDescription) {
                    await this.localConnection.addIceCandidate(candidate);
                    console.log(`Queued ICE candidate added successfully (mid=${candidate.sdpMid})`);
                } else {
                    console.log('Connection or remote description disappeared, saving candidate');
                    failedCandidates.push(candidate);
                }
            } catch (error) {
                console.error(`Failed to add queued ICE candidate (mid=${candidate.sdpMid}):`, error);
                
                // Try one more time with a fixed candidate
                if (error.toString().includes('No such transceiver')) {
                    try {
                        const fixedCandidate = {...candidate};
                        fixedCandidate.sdpMid = '0'; // Fallback to data channel mid
                        fixedCandidate.sdpMLineIndex = 0;
                        
                        await this.localConnection.addIceCandidate(fixedCandidate);
                        console.log('Fixed ICE candidate added on second attempt');
                    } catch (retryError) {
                        // Give up on this candidate
                        console.error('Failed to add candidate even with fix:', retryError);
                    }
                }
            }
        }
        
        // Save any failed candidates for later
        this.iceCandidateQueue = failedCandidates;
        
        // If there are still candidates in the queue, schedule one more attempt
        if (this.iceCandidateQueue.length > 0) {
            console.log(`Still have ${this.iceCandidateQueue.length} ICE candidates queued, scheduling retry`);
            setTimeout(() => {
                if (this.localConnection && this.localConnection.remoteDescription) {
                    this.processQueuedIceCandidates();
                }
            }, 2000);
        }
    }

    // Room management
    storeRoomInfo(roomInfo) {
        Utils.saveToStorage(`fiteme_room_${this.roomCode}`, roomInfo);
    }

    updateRoomInfo(updates) {
        const roomInfo = this.getRoomInfo(this.roomCode);
        if (roomInfo) {
            const updatedInfo = { ...roomInfo, ...updates, timestamp: Date.now() };
            Utils.saveToStorage(`fiteme_room_${this.roomCode}`, updatedInfo);
        }
    }

    getRoomInfo(roomCode) {
        return Utils.loadFromStorage(`fiteme_room_${roomCode}`);
    }

    // Message handling
    sendMessage(message) {
        const fullMessage = {
            ...message,
            sender: this.playerName,
            timestamp: Date.now()
        };

        if (this.isConnected && this.dataChannel && this.dataChannel.readyState === 'open') {
            try {
                this.dataChannel.send(JSON.stringify(fullMessage));
                return true;
            } catch (error) {
                console.error('Failed to send message:', error);
                this.messageQueue.push(fullMessage);
                return false;
            }
        } else {
            this.messageQueue.push(fullMessage);
            return false;
        }
    }

    handleMessage(message) {
        if (this.onMessageReceived) {
            this.onMessageReceived(message);
        }
        
        switch (message.type) {
            case 'player_joined':
                this.opponentName = message.sender;
                if (this.onOpponentJoined) {
                    this.onOpponentJoined(message.sender);
                }
                break;
                
            case 'player_left':
                if (this.onOpponentLeft) {
                    this.onOpponentLeft(message.sender);
                }
                break;
                
            case 'ping':
                this.sendMessage({ type: 'pong' });
                break;
        }
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0 && this.isConnected) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }
    }

    updateConnectionState(state) {
        this.connectionState = state;
        console.log('Connection state updated:', state);
        
        // If the connection errors, schedule automatic retry
        if (state === 'error' && !this.isRetrying) {
            this.isRetrying = true;
            console.log('Scheduling connection retry in 3 seconds...');
            
            setTimeout(() => {
                if (this.connectionState === 'error' || this.connectionState === 'disconnected') {
                    console.log('Attempting connection retry...');
                    this.retryConnection();
                }
                this.isRetrying = false;
            }, 3000);
        }
        
        if (this.onConnectionStateChange) {
            this.onConnectionStateChange(state);
        }
    }
    
    async retryConnection() {
        if (!this.roomCode) return;
        
        console.log('Retrying connection...');
        
        if (this.localConnection) {
            // Close existing connection
            this.localConnection.close();
            this.localConnection = null;
        }
        
        if (this.dataChannel) {
            this.dataChannel.close();
            this.dataChannel = null;
        }
        
        // Recreate WebRTC connection
        if (this.isHost) {
            await this.setupWebRTCAsHost();
            this.updateConnectionState('connecting');
            setTimeout(() => {
                this.createOffer();
            }, 1000);
        } else {
            await this.setupWebRTCAsGuest();
            this.updateConnectionState('connecting');
            this.sendSignal({
                type: 'join-room',
                guestName: this.playerName
            });
        }
    }

    // Keep connection alive
    startKeepAlive() {
        setInterval(() => {
            if (this.isConnected) {
                this.sendMessage({ type: 'ping' });
            }
        }, 30000);
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
        
        // Clean up room info and signals
        if (this.roomCode) {
            Utils.removeFromStorage(`fiteme_room_${this.roomCode}`);
            Utils.removeFromStorage(`fiteme_signals_${this.roomCode}`);
            Utils.removeFromStorage(`fiteme_signals_${this.roomCode}_host`);
            Utils.removeFromStorage(`fiteme_signals_${this.roomCode}_guest`);
            Utils.removeFromStorage(`fiteme_last_signal_${this.roomCode}_${this.playerName}`);
            Utils.removeFromStorage(`fiteme_legacy_last_${this.roomCode}_${this.playerName}`);
            Utils.removeFromStorage(`fiteme_signal_trigger_${this.roomCode}`);
        }
        
        this.updateConnectionState('disconnected');
        
        if (this.onOpponentLeft && this.opponentName) {
            this.onOpponentLeft(this.opponentName);
        }
    }

    // Utility methods
    isHostPlayer() {
        return this.isHost;
    }

    getRoomCode() {
        return this.roomCode;
    }

    getPlayerName() {
        return this.playerName;
    }

    getOpponentName() {
        return this.opponentName;
    }

    getConnectionState() {
        return this.connectionState;
    }

    isConnectedToOpponent() {
        return this.isConnected;
    }

    // Connection statistics and debugging
    async getConnectionStats() {
        if (!this.localConnection) return null;
        
        try {
            const stats = await this.localConnection.getStats();
            const result = {
                connectionState: this.localConnection.connectionState,
                iceConnectionState: this.localConnection.iceConnectionState,
                iceGatheringState: this.localConnection.iceGatheringState,
                signalingState: this.localConnection.signalingState,
                candidates: {
                    local: [],
                    remote: []
                },
                dataChannel: this.dataChannel ? {
                    readyState: this.dataChannel.readyState,
                    bufferedAmount: this.dataChannel.bufferedAmount
                } : null
            };
            
            stats.forEach(report => {
                if (report.type === 'local-candidate') {
                    result.candidates.local.push({
                        type: report.candidateType,
                        protocol: report.protocol,
                        address: report.address
                    });
                } else if (report.type === 'remote-candidate') {
                    result.candidates.remote.push({
                        type: report.candidateType,
                        protocol: report.protocol,
                        address: report.address
                    });
                }
            });
            
            return result;
        } catch (error) {
            console.error('Failed to get connection stats:', error);
            return null;
        }
    }
    
    // Debug method to log current state
    logConnectionState() {
        console.log('=== Connection State Debug ===');
        console.log('Is Host:', this.isHost);
        console.log('Room Code:', this.roomCode);
        console.log('Player Name:', this.playerName);
        console.log('Opponent Name:', this.opponentName);
        console.log('Is Connected:', this.isConnected);
        console.log('Connection State:', this.connectionState);
        
        if (this.localConnection) {
            console.log('WebRTC Connection State:', this.localConnection.connectionState);
            console.log('ICE Connection State:', this.localConnection.iceConnectionState);
            console.log('ICE Gathering State:', this.localConnection.iceGatheringState);
            console.log('Signaling State:', this.localConnection.signalingState);
        }
        
        if (this.dataChannel) {
            console.log('Data Channel State:', this.dataChannel.readyState);
        }
        
        console.log('Queued ICE Candidates:', this.iceCandidateQueue.length);
        console.log('Message Queue Length:', this.messageQueue.length);
        console.log('===============================');
    }

    // Clean up old rooms
    static cleanupOldRooms() {
        const now = Date.now();
        const maxAge = 24 * 60 * 60 * 1000; // 24 hours
        
        Object.keys(localStorage).forEach(key => {
            if (key.startsWith('fiteme_room_')) {
                try {
                    const roomData = JSON.parse(localStorage.getItem(key));
                    if (roomData && roomData.timestamp && (now - roomData.timestamp) > maxAge) {
                        localStorage.removeItem(key);
                    }
                } catch (e) {
                    // Remove invalid entries
                    localStorage.removeItem(key);
                }
            }
        });
    }

    // Check if the connection is healthy and usable
    isConnectionHealthy() {
        if (!this.localConnection) return false;
        
        // Check WebRTC connection state
        const connectionOK = this.localConnection.connectionState === 'connected' || 
                            this.localConnection.connectionState === 'connecting';
                            
        // Check ICE connection state                    
        const iceOK = this.localConnection.iceConnectionState === 'connected' || 
                     this.localConnection.iceConnectionState === 'completed' ||
                     this.localConnection.iceConnectionState === 'checking';
        
        // Check data channel if it exists
        let dataChannelOK = true;
        if (this.dataChannel) {
            dataChannelOK = this.dataChannel.readyState === 'open' || 
                           this.dataChannel.readyState === 'connecting';
        }
        
        return connectionOK && iceOK && dataChannelOK;
    }
}

// Export for use in other modules
window.Networking = Networking;

// Clean up old rooms on page load
document.addEventListener('DOMContentLoaded', () => {
    Networking.cleanupOldRooms();
});
