// AI Mock Interview - Refactored and Simplified
console.log('🚀 Loading AI Interview Application...');

// =============================================================================
// CONFIGURATION
// =============================================================================

const CONFIG = {
    API_BASE_URL: 'http://127.0.0.1:5000',
    SPEECH_TIMEOUT: 3000,
    AI_RESPONSE_DELAY: 1000,
    VAD_THRESHOLD: 0.02,
    SILENCE_FRAMES: 60  // ~3 seconds at 20fps
};

// =============================================================================
// GLOBAL STATE
// =============================================================================

let interviewState = {
    questions: [],
    currentIndex: 0,
    history: [],
    isActive: false,
    jobTitle: '',
    company: ''
};

let audioState = {
    context: null,
    analyser: null,
    microphone: null,
    isListening: false,
    recognition: null
};

let videoState = {
    peerConnection: null,
    streamId: null,
    sessionId: null,
    isConnected: false,
    isSpeaking: false
};

let conversationState = {
    turn: 'ai',  // 'ai' or 'user'
    transcript: '',
    silenceCount: 0
};

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function $(id) {
    return document.getElementById(id);
}

function setText(id, text) {
    const el = $(id);
    if (el) el.textContent = text;
}

function setValue(id, value) {
    const el = $(id);
    if (el) el.value = value;
}

function show(id) {
    const el = $(id);
    if (el) el.classList.remove('hidden');
}

function hide(id) {
    const el = $(id);
    if (el) el.classList.add('hidden');
}

function showError(message) {
    console.error('Error:', message);
    setText('errorDisplay', message);
    show('errorDisplay');
}

function clearError() {
    setText('errorDisplay', '');
    hide('errorDisplay');
}

function updateStatus(status) {
    console.log('Status:', status);
    setText('conversationStatus', status);
    setText('speechStatus', status);
}

// =============================================================================
// API FUNCTIONS
// =============================================================================

async function apiCall(endpoint, data = {}) {
    try {
        const response = await fetch(`${CONFIG.API_BASE_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error(`API call failed (${endpoint}):`, error);
        throw error;
    }
}

// =============================================================================
// SPEECH RECOGNITION
// =============================================================================

function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        throw new Error('Speech Recognition not supported. Please use Chrome or Edge.');
    }

    audioState.recognition = new SpeechRecognition();
    const recognition = audioState.recognition;
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        console.log('🎤 Speech recognition started');
        audioState.isListening = true;
    };

    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
                console.log('📝 Final transcript:', transcript);
            } else {
                interimTranscript += transcript;
            }
        }
        
        conversationState.transcript = finalTranscript + interimTranscript;
        setValue('answerInput', conversationState.transcript);
        
        // Process final transcript immediately
        if (finalTranscript.trim()) {
            console.log('🎯 Processing final transcript:', finalTranscript.trim());
            processUserSpeech(finalTranscript.trim());
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error === 'not-allowed') {
            showError('Microphone permission denied. Please allow access.');
        }
    };

    recognition.onend = () => {
        console.log('🛑 Speech recognition ended');
        audioState.isListening = false;
        
        // Auto-restart if we should still be listening
        if (conversationState.turn === 'user' && interviewState.isActive && !videoState.isSpeaking) {
            setTimeout(startListening, 100);
        }
    };

    return true;
}

function startListening() {
    if (audioState.recognition && !audioState.isListening && conversationState.turn === 'user') {
        try {
            conversationState.transcript = '';
            setValue('answerInput', '');
            audioState.recognition.start();
            updateStatus('🎤 Listening...');
        } catch (error) {
            console.error('Failed to start recognition:', error);
        }
    }
}

function stopListening() {
    if (audioState.recognition && audioState.isListening) {
        audioState.recognition.stop();
        updateStatus('⚡ Processing...');
    }
}

function processUserSpeech(text) {
    if (!text || conversationState.turn !== 'user') return;
    
    console.log('📝 Processing speech:', text);
    stopListening();
    
    // Add delay to allow for natural speech completion
    setTimeout(() => {
        processUserAnswer(text);
    }, CONFIG.AI_RESPONSE_DELAY);
}

// =============================================================================
// AUDIO CONTEXT & VAD
// =============================================================================

async function initAudioContext() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        
        audioState.context = new (window.AudioContext || window.webkitAudioContext)();
        
        if (audioState.context.state === 'suspended') {
            await audioState.context.resume();
        }
        
        audioState.microphone = audioState.context.createMediaStreamSource(stream);
        audioState.analyser = audioState.context.createAnalyser();
        
        audioState.analyser.fftSize = 512;
        audioState.analyser.smoothingTimeConstant = 0.8;
        
        audioState.microphone.connect(audioState.analyser);
        
        startVoiceActivityDetection();
        console.log('✅ Audio context initialized');
        return true;
    } catch (error) {
        console.error('Audio initialization failed:', error);
        showError('Microphone access failed: ' + error.message);
        return false;
    }
}

function startVoiceActivityDetection() {
    if (!audioState.analyser) return;
    
    const bufferLength = audioState.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    let speechDetected = false;
    let silenceCount = 0;
    
    function detectActivity() {
        if (!interviewState.isActive || videoState.isSpeaking) {
            requestAnimationFrame(detectActivity);
            return;
        }
        
        audioState.analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
        const level = average / 255;
        
        if (level > CONFIG.VAD_THRESHOLD && conversationState.turn === 'user') {
            if (!speechDetected && !audioState.isListening) {
                speechDetected = true;
                silenceCount = 0;
                console.log('🗣️ Speech detected, starting recognition');
                startListening();
            }
        } else if (level < CONFIG.VAD_THRESHOLD * 0.3) {
            silenceCount++;
            if (speechDetected && silenceCount > CONFIG.SILENCE_FRAMES) {
                speechDetected = false;
                silenceCount = 0;
                console.log('🤫 Silence detected, processing speech');
                if (audioState.isListening) {
                    // Let speech recognition handle the processing
                    setTimeout(() => {
                        if (conversationState.transcript.trim()) {
                            processUserSpeech(conversationState.transcript.trim());
                        }
                    }, 1000);
                }
            }
        }
        
        requestAnimationFrame(detectActivity);
    }
    
    detectActivity();
}

// =============================================================================
// D-ID VIDEO INTEGRATION
// =============================================================================

async function connectToVideo() {
    console.log('🎭 Connecting to D-ID...');
    updateStatus('Connecting video...');
    
    try {
        const data = await apiCall('/create_did_stream', {
            source_url: 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg'
        });
        
        videoState.streamId = data.id;
        videoState.sessionId = data.session_id;
        
        videoState.peerConnection = new RTCPeerConnection({ iceServers: data.ice_servers });
        
        videoState.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                apiCall('/did_stream_ice', {
                    stream_id: videoState.streamId,
                    session_id: videoState.sessionId,
                    candidate: event.candidate
                }).catch(console.error);
            }
        };
        
        videoState.peerConnection.ontrack = (event) => {
            const video = $('hassanVideo');
            if (video) {
                video.srcObject = event.streams[0];
                video.play().catch(console.error);
                hide('hassanPlaceholder');
                show('hassanVideo');
            }
        };
        
        videoState.peerConnection.oniceconnectionstatechange = () => {
            const state = videoState.peerConnection.iceConnectionState;
            videoState.isConnected = state === 'connected';
            console.log('🔗 ICE state:', state);
        };
        
        await videoState.peerConnection.setRemoteDescription(new RTCSessionDescription(data.offer));
        const answer = await videoState.peerConnection.createAnswer();
        await videoState.peerConnection.setLocalDescription(answer);
        
        await apiCall('/did_stream_sdp', {
            stream_id: videoState.streamId,
            session_id: videoState.sessionId,
            answer: videoState.peerConnection.localDescription
        });
        
        console.log('✅ D-ID connected');
        return true;
        
    } catch (error) {
        console.error('D-ID connection failed:', error);
        showError('Video connection failed: ' + error.message);
        return false;
    }
}

async function speakText(text) {
    if (!videoState.isConnected) {
        console.error('D-ID not connected');
        return;
    }
    
    videoState.isSpeaking = true;
    conversationState.turn = 'ai';
    updateStatus('🤖 AI speaking...');
    
    try {
        console.log('🗣️ Speaking:', text.substring(0, 50) + '...');
        
        await apiCall('/did_stream_talk', {
            stream_id: videoState.streamId,
            session_id: videoState.sessionId,
            text: text
        });
        
        // Estimate speech duration
        const words = text.split(' ').length;
        const duration = Math.max(3000, (words / 150) * 60 * 1000); // 150 WPM
        
        setTimeout(() => {
            videoState.isSpeaking = false;
            conversationState.turn = 'user';
            updateStatus('💬 Your turn to speak');
            console.log('✅ AI finished speaking');
        }, duration);
        
    } catch (error) {
        console.error('Speech error:', error);
        videoState.isSpeaking = false;
        conversationState.turn = 'user';
        updateStatus('❌ Error - continue');
    }
}

// =============================================================================
// INTERVIEW LOGIC
// =============================================================================

async function startInterview() {
    console.log('🚀 Starting interview...');
    
    const jobTitle = $('jobTitleInput').value.trim();
    const company = $('companyInput').value.trim();
    
    if (!jobTitle) {
        showError('Please enter a job title');
        return;
    }
    
    clearError();
    setText('startButton', 'Starting...');
    $('startButton').disabled = true;
    
    try {
        // Initialize systems
        const [audioOk, speechOk, videoOk] = await Promise.all([
            initAudioContext(),
            initSpeechRecognition(),
            connectToVideo()
        ]);
        
        if (!audioOk || !speechOk || !videoOk) {
            throw new Error('System initialization failed');
        }
        
        // Get interview questions
        const questionData = await apiCall('/get_questions', {
            job_title: jobTitle,
            company: company,
            max_questions: 4
        });
        
        interviewState.questions = questionData.questions;
        interviewState.jobTitle = jobTitle;
        interviewState.company = company;
        interviewState.currentIndex = 0;
        interviewState.history = [];
        interviewState.isActive = true;
        
        // Update UI
        hide('setupArea');
        show('interviewArea');
        
        setText('questionDisplay', interviewState.questions[0]);
        setValue('answerInput', '');
        setText('aiFeedback', 'Interview in progress...');
        
        // Start conversation
        const intro = `Hello! I'm excited to interview you for the ${jobTitle} position${company ? ` at ${company}` : ''}. Let's have a natural conversation. I'll ask questions and you can respond naturally. Ready? Let's start: ${interviewState.questions[0]}`;
        
        await speakText(intro);
        
    } catch (error) {
        console.error('Interview start failed:', error);
        showError('Failed to start interview: ' + error.message);
        setText('startButton', '🚀 Start Interview');
        $('startButton').disabled = false;
    }
}

async function processUserAnswer(answer) {
    if (!answer || !interviewState.isActive) return;
    
    console.log('📝 Processing answer:', answer);
    setValue('answerInput', answer);
    
    try {
        const currentQuestion = interviewState.questions[interviewState.currentIndex];
        
        const evaluation = await apiCall('/evaluate_answer', {
            question: currentQuestion,
            answer: answer,
            conversation_history: interviewState.history
        });
        
        const feedback = evaluation.evaluation;
        setText('aiFeedback', feedback);
        
        // Save to history
        interviewState.history.push({
            question: currentQuestion,
            answer: answer,
            feedback: feedback
        });
        
        // Move to next question or end interview
        interviewState.currentIndex++;
        
        if (interviewState.currentIndex < interviewState.questions.length) {
            const nextQuestion = interviewState.questions[interviewState.currentIndex];
            setText('questionDisplay', nextQuestion);
            
            const response = `${feedback} Now, let's move on: ${nextQuestion}`;
            await speakText(response);
        } else {
            await endInterview();
        }
        
    } catch (error) {
        console.error('Answer processing failed:', error);
        showError('Failed to process answer: ' + error.message);
        conversationState.turn = 'user';
        updateStatus('❌ Error - try again');
    }
}

async function endInterview() {
    interviewState.isActive = false;
    updateStatus('🎉 Interview Complete');
    
    try {
        const finalEval = await apiCall('/get_final_evaluation', {
            history: interviewState.history,
            job_title: interviewState.jobTitle,
            company: interviewState.company
        });
        
        setText('questionDisplay', 'Interview Complete! 🎉');
        setText('aiFeedback', finalEval.final_evaluation);
        
        const closing = `Thank you for completing the interview! ${finalEval.final_evaluation}`;
        await speakText(closing);
        
        // Offer to restart
        setTimeout(() => {
            if (confirm('Interview complete! Would you like to start a new interview?')) {
                location.reload();
            }
        }, 8000);
        
    } catch (error) {
        console.error('Final evaluation failed:', error);
        showError('Failed to generate final evaluation: ' + error.message);
    }
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function setupEventListeners() {
    // Start button
    const startBtn = $('startButton');
    if (startBtn) {
        startBtn.addEventListener('click', startInterview);
    }
    
    // Emergency controls
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' && e.ctrlKey && interviewState.isActive) {
            e.preventDefault();
            if (conversationState.turn === 'user') {
                const text = conversationState.transcript.trim();
                if (text) {
                    processUserSpeech(text);
                }
            }
        }
    });
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        interviewState.isActive = false;
        if (videoState.peerConnection) {
            videoState.peerConnection.close();
        }
        if (audioState.context) {
            audioState.context.close();
        }
    });
}

function init() {
    console.log('🎯 Initializing AI Interview Application...');
    
    // Check for required elements
    if (!$('startButton') || !$('jobTitleInput')) {
        showError('Required HTML elements not found');
        return;
    }
    
    setupEventListeners();
    console.log('✅ Application initialized successfully!');
}

// Start the application
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}