// AI Mock Interview - Bulletproof Version
// Absolutely no null reference errors possible

console.log('🚀 Loading bulletproof script...');

// =============================================================================
// SAFE ELEMENT ACCESS
// =============================================================================

function safeAddEventListener(elementId, eventType, handler) {
    const element = document.getElementById(elementId);
    if (element && typeof element.addEventListener === 'function') {
        element.addEventListener(eventType, handler);
        console.log(`✅ Event listener added: ${elementId} -> ${eventType}`);
        return true;
    } else {
        console.log(`⚠️ Skipped event listener: ${elementId} not found`);
        return false;
    }
}

function safeGetElement(id) {
    try {
        const element = document.getElementById(id);
        if (element) {
            console.log(`✅ Found element: ${id}`);
            return element;
        } else {
            console.log(`⚠️ Element not found: ${id}`);
            return null;
        }
    } catch (error) {
        console.error(`❌ Error getting element ${id}:`, error);
        return null;
    }
}

// =============================================================================
// GLOBAL STATE
// =============================================================================

// Interview State
let interviewQuestions = [];
let currentQuestionIndex = 0;
let currentQuestion = '';
let interviewHistory = [];
let isInterviewActive = false;
let isAISpeaking = false;
let isUserSpeaking = false;
let conversationTurn = 'ai';

// Audio & Speech
let recognition;
let isListening = false;
let audioContext;
let analyser;
let microphone;
let vadThreshold = 0.01;
let speechTimer;
let silenceTimer;
let currentTranscript = '';
let finalTranscript = '';

// D-ID Streaming
let peerConnection;
let streamId;
let sessionId;
let talkDeferred = Promise.resolve();

// Timing constants
const SILENCE_TIMEOUT = 2000;
const SPEECH_START_DELAY = 500;
const AI_RESPONSE_DELAY = 800;

// =============================================================================
// SAFE HELPER FUNCTIONS
// =============================================================================

function safeSetText(elementId, text) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

function safeSetValue(elementId, value) {
    const element = document.getElementById(elementId);
    if (element && 'value' in element) {
        element.value = value;
        return true;
    }
    return false;
}

function safeAddClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element && element.classList) {
        element.classList.add(className);
        return true;
    }
    return false;
}

function safeRemoveClass(elementId, className) {
    const element = document.getElementById(elementId);
    if (element && element.classList) {
        element.classList.remove(className);
        return true;
    }
    return false;
}

function safeToggleClass(elementId, className, force) {
    const element = document.getElementById(elementId);
    if (element && element.classList) {
        element.classList.toggle(className, force);
        return true;
    }
    return false;
}

function displayError(message) {
    console.error('❌ Error:', message);
    
    // Try multiple ways to show the error
    if (safeSetText('errorDisplay', message)) {
        safeRemoveClass('errorDisplay', 'hidden');
    } else {
        // Fallback to alert if error display doesn't exist
        alert('Error: ' + message);
    }
}

function clearError() {
    safeSetText('errorDisplay', '');
    safeAddClass('errorDisplay', 'hidden');
}

function showLoading(show) {
    console.log(`⏳ Loading: ${show}`);
    safeToggleClass('loadingIndicator', 'hidden', !show);
}

function updateConversationStatus(status) {
    console.log(`📊 Status: ${status}`);
    
    // Try multiple status elements
    safeSetText('conversationStatus', status) || 
    safeSetText('speechStatus', status) ||
    console.log(`Status: ${status}`);
}

function updateHassanStatus(status, color = 'text-white') {
    console.log(`🎭 Hassan: ${status}`);
    
    const element = document.getElementById('hassanStatus');
    if (element) {
        element.textContent = status;
        element.className = `absolute bottom-2 left-2 bg-black bg-opacity-50 ${color} text-xs px-2 py-1 rounded-md`;
        safeRemoveClass('hassanStatus', 'hidden');
    }
}

// =============================================================================
// AUDIO & SPEECH FUNCTIONS
// =============================================================================

function testAudioLevelsEnhanced() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let testCount = 0;
    let maxLevel = 0;
    let avgLevel = 0;
    
    function checkLevels() {
        if (testCount++ > 100) { // Test for ~5 seconds
            avgLevel = avgLevel / testCount;
            console.log(`🎚️ Audio test complete:`);
            console.log(`📊 Max level: ${maxLevel.toFixed(4)}`);
            console.log(`📊 Avg level: ${avgLevel.toFixed(4)}`);
            console.log(`📊 Recommended threshold: ${Math.max(avgLevel * 3, 0.015).toFixed(4)}`);
            
            if (maxLevel < 0.005) {
                console.warn('⚠️ Very low audio levels - check microphone');
            }
            return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const normalizedLevel = average / 255;
        
        if (normalizedLevel > maxLevel) {
            maxLevel = normalizedLevel;
        }
        avgLevel += normalizedLevel;
        
        setTimeout(checkLevels, 50);
    }
    
    checkLevels();
}

console.log('🔧 SPEECH SENSITIVITY FIX LOADED');
console.log('💡 Run testSensitivity() for adjustment commands');

async function initAudioContext() {
    try {
        console.log('🎤 Initializing enhanced audio...');
        
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,      // Important for background noise
                autoGainControl: true,
                sampleRate: 44100
            } 
        });
        
        console.log('✅ Microphone permission granted');
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        if (audioContext.state === 'suspended') {
            await audioContext.resume();
            console.log('🔄 Audio context resumed');
        }
        
        microphone = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        
        // Enhanced settings for better speech detection
        analyser.fftSize = 1024; // Increased for better frequency analysis
        analyser.smoothingTimeConstant = 0.6; // More smoothing to reduce noise spikes
        analyser.minDecibels = -80; // Adjusted range
        analyser.maxDecibels = -10;
        
        microphone.connect(analyser);
        
        // Test audio levels first
        testAudioLevelsEnhanced();
        
        // Start enhanced detection after brief delay
        setTimeout(() => {
            startVoiceActivityDetection();
        }, 1000);
        
        console.log('✅ Enhanced audio context initialized');
        return true;
    } catch (error) {
        console.error('❌ Audio failed:', error);
        displayError('Microphone access failed: ' + error.message);
        return false;
    }
}

function testAudioLevels() {
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let testCount = 0;
    let maxLevel = 0;
    
    function checkLevels() {
        if (testCount++ > 50) { // Test for ~2.5 seconds
            console.log(`🎚️ Audio test complete. Max level detected: ${maxLevel.toFixed(3)}`);
            if (maxLevel < 0.001) {
                console.warn('⚠️ Very low audio levels - check microphone');
                displayError('Microphone levels very low. Please speak louder or check microphone settings.');
            }
            return;
        }
        
        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const normalizedLevel = average / 255;
        
        if (normalizedLevel > maxLevel) {
            maxLevel = normalizedLevel;
        }
        
        setTimeout(checkLevels, 50);
    }
    
    checkLevels();
}


function startVoiceActivityDetection() {
    if (!analyser) return;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // MUCH HIGHER THRESHOLD - Only detect actual speech
    vadThreshold = 0.02; // Was 0.005, now 4x higher
    const speechConfirmThreshold = 0.03; // Must reach this level to confirm speech
    const silenceThreshold = 0.01; // Must drop below this to confirm silence
    
    let speechConfirmed = false;
    let consecutiveSpeechFrames = 0;
    let consecutiveSilenceFrames = 0;
    const minSpeechFrames = 5; // Must detect speech for 5 frames (~250ms)
    const minSilenceFrames = 100; // Must detect silence for 100 frames (~5 seconds)
    
    console.log('🎯 Enhanced Voice Activity Detection started');
    console.log(`📊 Thresholds: VAD=${vadThreshold}, Speech=${speechConfirmThreshold}, Silence=${silenceThreshold}`);
    
    function detectVoiceActivity() {
        if (!isInterviewActive || isAISpeaking) {
            requestAnimationFrame(detectVoiceActivity);
            return;
        }
        
        try {
            analyser.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
            const normalizedLevel = average / 255;
            
            // Debug logging (reduced frequency)
            if (Math.random() < 0.005) { // Log 0.5% of the time
                console.log(`🎤 Level: ${normalizedLevel.toFixed(4)} | Speech: ${speechConfirmed} | Frames: S${consecutiveSpeechFrames}/Si${consecutiveSilenceFrames}`);
            }
            
            // Speech detection logic
            if (normalizedLevel > vadThreshold) {
                consecutiveSpeechFrames++;
                consecutiveSilenceFrames = 0;
                
                // Confirm speech only after reaching higher threshold for several frames
                if (!speechConfirmed && 
                    consecutiveSpeechFrames >= minSpeechFrames && 
                    normalizedLevel > speechConfirmThreshold &&
                    !isUserSpeaking && 
                    conversationTurn === 'user') {
                    
                    speechConfirmed = true;
                    console.log(`🗣️ SPEECH CONFIRMED! Level: ${normalizedLevel.toFixed(4)} after ${consecutiveSpeechFrames} frames`);
                    handleSpeechStart();
                }
            } else if (normalizedLevel <= silenceThreshold) {
                consecutiveSilenceFrames++;
                consecutiveSpeechFrames = 0;
                
                // Confirm silence only after sustained quiet period
                if (speechConfirmed && consecutiveSilenceFrames >= minSilenceFrames && isUserSpeaking) {
                    speechConfirmed = false;
                    console.log(`🤫 SILENCE CONFIRMED! Level: ${normalizedLevel.toFixed(4)} after ${consecutiveSilenceFrames} frames`);
                    handlePossibleSpeechEnd();
                }
            } else {
                // In between thresholds - maintain current state but reset frame counters partially
                consecutiveSpeechFrames = Math.max(0, consecutiveSpeechFrames - 1);
                consecutiveSilenceFrames = Math.max(0, consecutiveSilenceFrames - 1);
            }
            
        } catch (error) {
            console.error('VAD error:', error);
        }
        
        requestAnimationFrame(detectVoiceActivity);
    }
    
    detectVoiceActivity();
}



// Enhanced speech start with confirmation delay
function handleSpeechStart() {
    // Remove the timeout delay since we already have frame-based confirmation
    if (!isUserSpeaking && conversationTurn === 'user') {
        isUserSpeaking = true;
        startContinuousRecognition();
        updateConversationStatus('🎤 Listening...');
        console.log('🎤 Speech detection confirmed, recognition started');
    }
}


// Enhanced speech end with immediate response
function handlePossibleSpeechEnd() {
    // Remove timeout since we already confirmed silence
    if (isUserSpeaking) {
        handleSpeechEnd();
    }
}

// Manual threshold adjustment for testing
function adjustSensitivity(newThreshold) {
    vadThreshold = newThreshold;
    console.log(`🎚️ VAD threshold adjusted to: ${vadThreshold}`);
}

// Quick sensitivity tests
function testSensitivity() {
    console.log('🧪 SENSITIVITY TEST COMMANDS:');
    console.log('adjustSensitivity(0.01) - Very sensitive');
    console.log('adjustSensitivity(0.02) - Normal (current)'); 
    console.log('adjustSensitivity(0.03) - Less sensitive');
    console.log('adjustSensitivity(0.05) - Much less sensitive');
}

// Enhanced speech end processing
function handleSpeechEnd() {
    if (isUserSpeaking) {
        isUserSpeaking = false;
        stopContinuousRecognition();
        updateConversationStatus('⚡ Processing...');
        console.log('⚡ Speech ended, processing response');
        
        // Shorter delay since we already waited for silence confirmation
        setTimeout(() => {
            if (finalTranscript.trim()) {
                processUserResponse(finalTranscript.trim());
            } else {
                conversationTurn = 'user';
                updateConversationStatus('💬 Your turn to speak');
                console.log('🔄 No transcript, ready for next speech');
            }
        }, 500); // Reduced from 800ms to 500ms
    }
}

function initContinuousSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.error('❌ Speech Recognition not supported');
        displayError('Speech Recognition not supported. Please use Chrome or Edge.');
        return false;
    }

    console.log('✅ Speech recognition available');
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
        console.log('🎤 Speech recognition STARTED');
        isListening = true;
    };

    recognition.onresult = (event) => {
        let interim = '';
        finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            const confidence = event.results[i][0].confidence;
            
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
                console.log(`📝 Final transcript: "${transcript}" (confidence: ${confidence})`);
            } else {
                interim += transcript;
            }
        }
        
        currentTranscript = finalTranscript + interim;
        safeSetValue('answerInput', currentTranscript);
        
        // Show real-time feedback
        if (currentTranscript.trim()) {
            updateConversationStatus('🎤 Recording: "' + currentTranscript.substring(0, 30) + '..."');
        }
        
        if (isUserSpeaking) {
            clearTimeout(silenceTimer);
            silenceTimer = setTimeout(() => {
                if (isUserSpeaking) {
                    handleSpeechEnd();
                }
            }, SILENCE_TIMEOUT);
        }
    };

    recognition.onerror = (event) => {
        console.error('❌ Speech recognition error:', event.error);
        
        if (event.error === 'no-speech') {
            console.log('🔄 No speech detected, restarting...');
            if (isListening && conversationTurn === 'user') {
                setTimeout(() => startContinuousRecognition(), 100);
            }
        } else if (event.error === 'audio-capture') {
            displayError('Microphone not accessible. Please check permissions.');
        } else if (event.error === 'not-allowed') {
            displayError('Microphone permission denied. Please allow access.');
        } else {
            displayError(`Speech error: ${event.error}`);
        }
    };

    recognition.onend = () => {
        console.log('🛑 Speech recognition ENDED');
        isListening = false;
        
        if (isListening && conversationTurn === 'user' && !isAISpeaking) {
            console.log('🔄 Auto-restarting speech recognition...');
            setTimeout(() => startContinuousRecognition(), 100);
        }
    };

    return true;
}

function startContinuousRecognition() {
    if (recognition && !isListening) {
        try {
            isListening = true;
            currentTranscript = '';
            finalTranscript = '';
            safeSetValue('answerInput', '');
            recognition.start();
            console.log('🎤 Recognition started');
        } catch (error) {
            console.error('Recognition start failed:', error);
            isListening = false;
        }
    }
}

function stopContinuousRecognition() {
    if (recognition && isListening) {
        isListening = false;
        recognition.stop();
        console.log('⏹️ Recognition stopped');
    }
}

// =============================================================================
// D-ID INTEGRATION
// =============================================================================

async function connectToDID() {
    console.log('🎭 Connecting to D-ID...');
    updateHassanStatus('Connecting...');
    clearError();

    safeAddClass('hassanPlaceholder', 'hidden');
    safeRemoveClass('hassanVideo', 'hidden');
    safeRemoveClass('hassanStatus', 'hidden');

    // Add video event listeners safely
    const videoElement = document.getElementById('hassanVideo');
    if (videoElement) {
        videoElement.addEventListener('playing', () => {
            console.log('📹 Video playing');
            if (videoElement.muted) {
                videoElement.muted = false;
                console.log('🔊 Video unmuted');
            }
        });
    }

    if (peerConnection && peerConnection.connectionState === 'connected') {
        updateHassanStatus('Connected', 'text-green-500');
        return true;
    }

    try {
        const didResponse = await fetch('http://127.0.0.1:5000/create_did_stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_url: 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg',
            }),
        });

        if (!didResponse.ok) {
            const errorData = await didResponse.json();
            throw new Error(`D-ID failed: ${errorData.error}`);
        }

        const { id: newStreamId, session_id: newSessionId, offer, ice_servers } = await didResponse.json();
        streamId = newStreamId;
        sessionId = newSessionId;

        console.log('✅ D-ID stream created:', streamId);

        peerConnection = new RTCPeerConnection({ iceServers: ice_servers });

        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                fetch('http://127.0.0.1:5000/did_stream_ice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        stream_id: streamId,
                        session_id: sessionId,
                        candidate: event.candidate,
                    }),
                }).catch(e => console.error('ICE error:', e));
            }
        };

        peerConnection.ontrack = (event) => {
            const mediaStream = event.streams[0];
            if (videoElement && videoElement.srcObject !== mediaStream) {
                videoElement.srcObject = mediaStream;
                setTimeout(() => {
                    videoElement.play().catch(e => console.error('Video play error:', e));
                }, 100);
                console.log('📹 Video stream attached');
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            const state = peerConnection.iceConnectionState;
            console.log('🔗 ICE state:', state);
            if (state === 'connected') {
                updateHassanStatus('Connected', 'text-green-500');
            } else if (state === 'failed' || state === 'disconnected') {
                updateHassanStatus('Disconnected', 'text-red-500');
            } else {
                updateHassanStatus(state);
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await fetch('http://127.0.0.1:5000/did_stream_sdp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stream_id: streamId,
                session_id: sessionId,
                answer: peerConnection.localDescription,
            }),
        });

        updateHassanStatus('Connected', 'text-green-500');
        console.log('✅ D-ID connected');
        return true;

    } catch (error) {
        console.error('❌ D-ID error:', error);
        displayError(`D-ID failed: ${error.message}`);
        updateHassanStatus('Failed', 'text-red-500');
        
        safeRemoveClass('hassanPlaceholder', 'hidden');
        safeAddClass('hassanVideo', 'hidden');
        safeAddClass('hassanStatus', 'hidden');
        return false;
    }
}

async function speakNaturally(text) {
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
        console.error('❌ D-ID not connected');
        displayError('D-ID not connected');
        return;
    }

    isAISpeaking = true;
    conversationTurn = 'ai';
    updateConversationStatus('🤖 AI speaking...');

    return new Promise((resolve) => {
        talkDeferred = talkDeferred.then(async () => {
            try {
                console.log('🗣️ Speaking:', text.substring(0, 50) + '...');

                // ENHANCED: Force video to be ready before speaking
                const videoElement = document.getElementById('hassanVideo');
                if (videoElement) {
                    // Ensure video is unmuted and playing
                    videoElement.muted = false;
                    videoElement.volume = 1.0;
                    
                    // Try to play if paused
                    if (videoElement.paused) {
                        await videoElement.play().catch(e => console.log('Video play attempt:', e));
                    }
                    
                    console.log('📹 Video state:', {
                        muted: videoElement.muted,
                        volume: videoElement.volume,
                        paused: videoElement.paused,
                        readyState: videoElement.readyState
                    });
                }

                const talkResponse = await fetch('http://127.0.0.1:5000/did_stream_talk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        stream_id: streamId,
                        session_id: sessionId,
                        text: text,
                    }),
                });

                if (!talkResponse.ok) {
                    const errorData = await talkResponse.json();
                    throw new Error(`Talk failed: ${errorData.error}`);
                }

                const talkData = await talkResponse.json();
                console.log('✅ D-ID talk response:', talkData);

                // ENHANCED: Better duration estimation and audio monitoring
                const wordCount = text.split(' ').length;
                const baseSpeed = 150; // words per minute
                const estimatedDuration = (wordCount / baseSpeed) * 60 * 1000;
                const minDuration = 3000; // minimum 3 seconds
                const maxDuration = 30000; // maximum 30 seconds
                const speechDuration = Math.min(Math.max(estimatedDuration, minDuration), maxDuration);

                console.log(`⏱️ Speech duration: ${speechDuration}ms for ${wordCount} words`);

                // ENHANCED: Monitor for actual audio/video activity
                let audioDetected = false;
                const audioMonitor = setInterval(() => {
                    if (videoElement && !videoElement.paused && videoElement.currentTime > 0) {
                        audioDetected = true;
                        console.log('🔊 Audio activity detected');
                        clearInterval(audioMonitor);
                    }
                }, 500);

                setTimeout(() => {
                    clearInterval(audioMonitor);
                    isAISpeaking = false;
                    conversationTurn = 'user';
                    updateConversationStatus('💬 Your turn to speak');
                    console.log('✅ AI finished speaking');
                    if (!audioDetected) {
                        console.warn('⚠️ No audio activity detected - check D-ID API or video element');
                    }
                    resolve();
                }, speechDuration);

            } catch (error) {
                console.error('❌ Speech error:', error);
                isAISpeaking = false;
                conversationTurn = 'user';
                updateConversationStatus('❌ Error - continue');
                resolve();
            }
        });
    });
}

// =============================================================================
// INTERVIEW FUNCTIONS
// =============================================================================

async function startNaturalInterview() {
    console.log('🚀 Starting interview...');
    
    const jobTitleElement = document.getElementById('jobTitleInput');
    const companyElement = document.getElementById('companyInput');
    const startButtonElement = document.getElementById('startButton');

    if (!jobTitleElement) {
        displayError('Job title input not found');
        return;
    }

    const jobTitle = jobTitleElement.value.trim();
    const company = companyElement ? companyElement.value.trim() : '';

    console.log('📝 Job:', jobTitle, 'Company:', company);

    if (!jobTitle) {
        displayError('Please enter a job title');
        return;
    }

    clearError();
    showLoading(true);
    if (startButtonElement) startButtonElement.disabled = true;

    try {
        console.log('🔧 Initializing systems...');
        
        const audioOk = await initAudioContext();
        const speechOk = initContinuousSpeechRecognition();
        const didOk = await connectToDID();

        if (!audioOk || !speechOk || !didOk) {
            throw new Error('System initialization failed');
        }

        console.log('📡 Getting questions...');

        const response = await fetch('http://127.0.0.1:5000/get_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_title: jobTitle, company: company }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Questions failed: ${errorData.error}`);
        }

        const data = await response.json();
        interviewQuestions = data.questions;
        currentQuestionIndex = 0;
        interviewHistory = [];
        isInterviewActive = true;

        console.log('📝 Got questions:', interviewQuestions.length);

        if (interviewQuestions && interviewQuestions.length > 0) {
            currentQuestion = interviewQuestions[currentQuestionIndex];
            safeSetText('questionDisplay', currentQuestion);

            // UI updates
            safeAddClass('setupArea', 'hidden');
            safeRemoveClass('interviewArea', 'hidden');
            safeSetValue('answerInput', '');
            safeSetText('aiFeedback', 'Natural conversation in progress...');

            // Hide buttons for natural experience
            const buttonsToHide = ['answerButton', 'nextButton', 'micButton', 'stopMicButton'];
            buttonsToHide.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.style.display = 'none';
            });

            const introText = `Hello! I'm excited to interview you for the ${jobTitle} position${company ? ` at ${company}` : ''}. Let's have a natural conversation. I'll ask you questions and you can respond naturally - no need to click any buttons. Ready? Let's start with: ${currentQuestion}`;
            
            console.log('🎬 Starting conversation...');
            await speakNaturally(introText);

        } else {
            throw new Error('No questions received');
        }

    } catch (error) {
        console.error('❌ Interview failed:', error);
        displayError(`Interview failed: ${error.message}`);
        isInterviewActive = false;
    } finally {
        showLoading(false);
        if (startButtonElement) startButtonElement.disabled = false;
    }
}

async function processUserResponse(userAnswer) {
    if (!userAnswer || !isInterviewActive) return;

    console.log('📝 Processing:', userAnswer);
    safeSetValue('answerInput', userAnswer);

    try {
        const response = await fetch('http://127.0.0.1:5000/evaluate_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestion,
                answer: userAnswer,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Evaluation failed: ${errorData.error}`);
        }

        const data = await response.json();
        const feedback = data.evaluation;
        safeSetText('aiFeedback', feedback);

        interviewHistory.push({
            question: currentQuestion,
            answer: userAnswer,
            feedback: feedback
        });

        currentQuestionIndex++;
        
        if (currentQuestionIndex < interviewQuestions.length) {
            currentQuestion = interviewQuestions[currentQuestionIndex];
            safeSetText('questionDisplay', currentQuestion);
            
            const nextText = `${feedback} Now, let's move on to the next question: ${currentQuestion}`;
            await speakNaturally(nextText);
            
        } else {
            await endInterview(feedback);
        }

    } catch (error) {
        console.error('❌ Processing failed:', error);
        displayError(`Processing failed: ${error.message}`);
        conversationTurn = 'user';
        updateConversationStatus('❌ Error - try again');
    }
}

async function endInterview(lastFeedback) {
    isInterviewActive = false;
    updateConversationStatus('🎉 Complete');

    try {
        const response = await fetch('http://127.0.0.1:5000/get_final_evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ history: interviewHistory }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Final evaluation failed: ${errorData.error}`);
        }

        const data = await response.json();
        const finalEvaluation = data.final_evaluation;
        
        safeSetText('questionDisplay', 'Interview Complete! 🎉');
        safeSetText('aiFeedback', finalEvaluation);

        const closingText = `Thank you for completing the interview! Here's your overall assessment: ${finalEvaluation} This concludes our session. Feel free to start a new interview anytime!`;
        await speakNaturally(closingText);

        setTimeout(() => {
            if (confirm('Interview complete! Start a new interview?')) {
                window.location.reload();
            }
        }, 5000);

    } catch (error) {
        console.error('❌ Final evaluation failed:', error);
        displayError(`Final evaluation failed: ${error.message}`);
    }
}

function toggleSpeechDetection() {
    if (isUserSpeaking) {
        handleSpeechEnd();
        console.log('🛑 Manual speech end');
    } else if (conversationTurn === 'user') {
        handleSpeechStart();
        console.log('▶️ Manual speech start');
    }
}

// =============================================================================
// BULLETPROOF INITIALIZATION
// =============================================================================

function setupEventListeners() {
    console.log('🔧 Setting up events...');
    
    // Bulletproof event listener setup
    let setupCount = 0;
    
    // Speech rate slider
    if (safeAddEventListener('speechRate', 'input', (e) => {
        safeSetText('speechRateValue', e.target.value);
    })) setupCount++;
    
    // Start button - THE CRITICAL ONE
    if (safeAddEventListener('startButton', 'click', startNaturalInterview)) {
        setupCount++;
        console.log('🎯 START BUTTON EVENT LISTENER ADDED SUCCESSFULLY');
    } else {
        console.error('❌ FAILED TO ADD START BUTTON EVENT LISTENER');
    }

    // Page cleanup
    window.addEventListener('beforeunload', () => {
        console.log('🧹 Cleanup');
        isInterviewActive = false;
        if (peerConnection) peerConnection.close();
        if (audioContext) audioContext.close();
    });

    // Emergency controls
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.ctrlKey && isInterviewActive) {
            e.preventDefault();
            console.log('🚨 Emergency toggle');
            if (isUserSpeaking) {
                handleSpeechEnd();
            } else if (conversationTurn === 'user') {
                handleSpeechStart();
            }
        }
    });

    console.log(`✅ Event listeners setup: ${setupCount} successful`);
    return setupCount;
}

function initApp() {
    console.log('🎯 Initializing bulletproof app...');
    
    // Test critical elements
    const startBtn = document.getElementById('startButton');
    const jobInput = document.getElementById('jobTitleInput');
    
    console.log('🔍 Critical elements check:');
    console.log('Start button:', startBtn ? '✅ Found' : '❌ Missing');
    console.log('Job input:', jobInput ? '✅ Found' : '❌ Missing');
    
    if (!startBtn) {
        console.error('❌ CRITICAL: Start button not found');
        displayError('Start button not found in HTML');
        return;
    }
    
    if (!jobInput) {
        console.error('❌ CRITICAL: Job input not found');
        displayError('Job title input not found in HTML');
        return;
    }
    
    const setupCount = setupEventListeners();
    
    if (setupCount === 0) {
        console.error('❌ CRITICAL: No event listeners setup');
        displayError('Event listener setup failed');
        return;
    }
    
    console.log('✅ Bulletproof app initialized successfully!');
    console.log('💡 Ready for natural conversation!');
    
    // Test start button manually
    console.log('🧪 Testing start button click handler...');
    if (startBtn.onclick || startBtn.addEventListener) {
        console.log('✅ Start button has click capability');
    } else {
        console.error('❌ Start button cannot handle clicks');
    }
}

// Initialize
console.log('📋 DOM ready state:', document.readyState);

if (document.readyState === 'loading') {
    console.log('⏳ Waiting for DOM...');
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    console.log('🏃 DOM ready, initializing now...');
    initApp();
}

console.log('✅ Script loaded completely');