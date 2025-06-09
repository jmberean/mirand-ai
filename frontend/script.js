// AI Mock Interview - Fixed Audio Isolation & Conversation Flow
// Addresses: audio bleeding, abrupt cutoffs, stuck states, loading UI issues

// =============================================================================
// GLOBAL VARIABLES & STATE
// =============================================================================

// DOM Elements
const elements = {
    jobTitleInput: document.getElementById('jobTitleInput'),
    companyInput: document.getElementById('companyInput'),
    startButton: document.getElementById('startButton'),
    interviewArea: document.getElementById('interviewArea'),
    questionDisplay: document.getElementById('questionDisplay'),
    answerInput: document.getElementById('answerInput'),
    answerButton: document.getElementById('answerButton'),
    nextButton: document.getElementById('nextButton'),
    repeatQuestionButton: document.getElementById('repeatQuestionButton'),
    micButton: document.getElementById('micButton'),
    stopMicButton: document.getElementById('stopMicButton'),
    speechStatus: document.getElementById('speechStatus'),
    aiFeedback: document.getElementById('aiFeedback'),
    loadingIndicator: document.getElementById('loadingIndicator'),
    errorDisplay: document.getElementById('errorDisplay'),
    hassanVideo: document.getElementById('hassanVideo'),
    hassanStatus: document.getElementById('hassanStatus'),
    hassanPlaceholder: document.getElementById('hassanPlaceholder'),
    setupArea: document.getElementById('setupArea'),
    floatingControls: document.getElementById('floatingControls')
};

// Interview State
let interviewQuestions = [];
let currentQuestionIndex = 0;
let currentQuestion = '';
let interviewHistory = [];

// Speech Recognition
let recognition;
let isRecording = false;

// D-ID Streaming API Variables
let peerConnection;
let streamId;
let sessionId;
let talkDeferred = Promise.resolve();

// Enhanced Audio Management
let audioContext;
let analyser;
let microphone;
let isAISpeaking = false;
let speechTimeout;
let voiceActivityTimeout;
let silenceThreshold = -45; // Made less sensitive
let speechDetectionDelay = 2000; // Increased delay after AI stops
let userSpeechTimeout = 5000; // Increased timeout for user speech (5 seconds)
let minSpeechDuration = 1000; // Minimum speech duration before considering submission

// Conversation State Management
const conversationState = {
    phase: 'setup',
    awaitingResponse: false,
    currentQuestionDepth: 0,
    maxFollowUpDepth: 2,
    questionStartTime: null,
    responseStartTime: null,
    lastAISpeechEnd: null,
    userStartedSpeaking: false,
    speechStartTime: null
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function displayError(message) {
    elements.errorDisplay.textContent = message;
    elements.errorDisplay.classList.remove('hidden');
    console.error('Error:', message);
    setTimeout(() => elements.errorDisplay.classList.add('hidden'), 5000);
}

function clearError() {
    elements.errorDisplay.textContent = '';
    elements.errorDisplay.classList.add('hidden');
}

function showLoading(show) {
    elements.loadingIndicator.classList.toggle('hidden', !show);
}

function updateHassanStatus(status, color = 'text-white') {
    elements.hassanStatus.textContent = status;
    elements.hassanStatus.className = `absolute bottom-4 left-4 bg-black bg-opacity-70 ${color} text-sm px-3 py-2 rounded-lg`;
    elements.hassanStatus.classList.remove('hidden');
}

function updateInterviewStatus(status, type = 'ready') {
    const statusElement = elements.speechStatus;
    const statusTypes = {
        'ready': { class: 'status-ready', icon: '⚡', text: status },
        'listening': { class: 'status-listening', icon: '🎤', text: status },
        'processing': { class: 'status-processing', icon: '🧠', text: status },
        'ai-speaking': { class: 'status-ai-speaking', icon: '🗣️', text: status }
    };
    
    const config = statusTypes[type] || statusTypes['ready'];
    statusElement.className = `status-indicator ${config.class}`;
    statusElement.innerHTML = `
        <div class="w-3 h-3 bg-current rounded-full"></div>
        <span>${config.icon} ${config.text}</span>
    `;
}

function highlightTranscript(isActive) {
    const transcriptArea = document.querySelector('.transcript-area');
    transcriptArea.classList.toggle('active', isActive);
}

function showFloatingControls() {
    elements.floatingControls.classList.remove('hidden');
}

// =============================================================================
// ENHANCED AUDIO CONTEXT & VOICE DETECTION
// =============================================================================

async function initAudioContext() {
    try {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 1024; // Increased for better accuracy
        analyser.smoothingTimeConstant = 0.3; // Less smoothing for quicker response

        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });
        microphone = audioContext.createMediaStreamSource(stream);
        microphone.connect(analyser);
        
        console.log('Audio context initialized with echo cancellation');
        return true;
    } catch (error) {
        console.error('Failed to initialize audio context:', error);
        return false;
    }
}

function detectVoiceActivity() {
    if (!analyser) return false;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate RMS (Root Mean Square) for more accurate voice detection
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i];
    }
    const rms = Math.sqrt(sum / bufferLength);
    const volume = 20 * Math.log10(rms / 255);
    
    return volume > silenceThreshold;
}

// =============================================================================
// IMPROVED SPEECH RECOGNITION WITH BETTER ISOLATION
// =============================================================================

function initEnhancedSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        displayError('Speech Recognition not supported in this browser. Please use Chrome or Edge.');
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let finalTranscript = '';
    let lastResultTime = Date.now();
    let silenceStartTime = null;

    recognition.onstart = () => {
        console.log('Speech recognition started');
        updateInterviewStatus('Listening for your voice...', 'ready');
    };

    recognition.onresult = (event) => {
        // CRITICAL: Enhanced AI speaking detection with timing check
        const timeSinceAISpoke = conversationState.lastAISpeechEnd ? 
            Date.now() - conversationState.lastAISpeechEnd : Infinity;
        
        if (isAISpeaking || timeSinceAISpoke < speechDetectionDelay) {
            console.log(`Ignoring speech - AI speaking or too soon (${timeSinceAISpoke}ms since AI finished)`);
            return;
        }

        let interimTranscript = '';
        let hasNewFinalResult = false;
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
                hasNewFinalResult = true;
                lastResultTime = Date.now();
            } else {
                interimTranscript += transcript;
            }
        }

        // Update textarea
        elements.answerInput.value = finalTranscript + interimTranscript;
        
        const currentText = (finalTranscript + interimTranscript).trim();
        
        // Detect start of user speech
        if (!conversationState.userStartedSpeaking && currentText.length > 0) {
            conversationState.userStartedSpeaking = true;
            conversationState.speechStartTime = Date.now();
            updateInterviewStatus('I can hear you speaking...', 'listening');
            highlightTranscript(true);
            console.log('User started speaking');
        }

        // Clear any existing timeouts
        clearTimeout(speechTimeout);
        clearTimeout(voiceActivityTimeout);

        // Only set submission timeout if we have substantial content
        if (finalTranscript.trim().length > 10) {
            // Use voice activity detection for better timing
            voiceActivityTimeout = setTimeout(() => {
                checkVoiceActivityAndSubmit();
            }, 500); // Check every 500ms
        }
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'no-speech' && event.error !== 'audio-capture') {
            updateInterviewStatus(`Error: ${event.error}`, 'ready');
            
            // Try to restart recognition
            setTimeout(() => {
                if (!isAISpeaking) {
                    startListening();
                }
            }, 1000);
        }
    };

    recognition.onend = () => {
        console.log('Speech recognition ended');
        
        // Auto-restart if we should still be listening
        if (conversationState.awaitingResponse && !isAISpeaking) {
            setTimeout(() => {
                startListening();
            }, 100);
        }
    };

    function checkVoiceActivityAndSubmit() {
        if (!conversationState.userStartedSpeaking || isAISpeaking) return;
        
        const isCurrentlySpeaking = detectVoiceActivity();
        const timeSinceSpeechStart = Date.now() - conversationState.speechStartTime;
        const finalText = finalTranscript.trim();
        
        if (!isCurrentlySpeaking && timeSinceSpeechStart > minSpeechDuration && finalText.length > 5) {
            // User stopped speaking and we have content
            if (!silenceStartTime) {
                silenceStartTime = Date.now();
            }
            
            const silenceDuration = Date.now() - silenceStartTime;
            
            if (silenceDuration > 2000) { // 2 seconds of silence
                console.log('Auto-submitting after detecting silence');
                submitAnswer();
                resetSpeechState();
                return;
            }
        } else {
            silenceStartTime = null; // Reset silence timer if user is still speaking
        }
        
        // Set up next check
        voiceActivityTimeout = setTimeout(() => {
            checkVoiceActivityAndSubmit();
        }, 500);
    }

    function resetSpeechState() {
        conversationState.userStartedSpeaking = false;
        conversationState.speechStartTime = null;
        finalTranscript = '';
        silenceStartTime = null;
        updateInterviewStatus('Ready for next question...', 'ready');
        highlightTranscript(false);
        clearTimeout(speechTimeout);
        clearTimeout(voiceActivityTimeout);
    }

    function startListening() {
        if (recognition && !isAISpeaking) {
            try {
                recognition.start();
                console.log('Started listening for speech');
            } catch (e) {
                console.log('Recognition already running or failed to start');
            }
        }
    }

    // Export functions for external use
    window.resetSpeechState = resetSpeechState;
    window.startListening = startListening;
}

// =============================================================================
// D-ID INTEGRATION WITH IMPROVED TIMING
// =============================================================================

async function connectToDID() {
    updateHassanStatus('Connecting...');
    clearError();

    elements.hassanPlaceholder.classList.add('hidden');
    elements.hassanVideo.classList.remove('hidden');
    elements.hassanStatus.classList.remove('hidden');

    elements.hassanVideo.addEventListener('loadedmetadata', () => {
        console.log('Video loaded:', elements.hassanVideo.videoWidth, 'x', elements.hassanVideo.videoHeight);
    });
    
    elements.hassanVideo.addEventListener('playing', () => {
        console.log('Video started playing');
        if (elements.hassanVideo.muted) {
            elements.hassanVideo.muted = false;
            console.log('Video unmuted');
        }
    });
    
    elements.hassanVideo.addEventListener('error', (e) => {
        console.error('Video error:', e);
    });

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
            throw new Error(`Failed to create D-ID stream: ${didResponse.status} - ${errorData.error}`);
        }

        const { id: newStreamId, session_id: newSessionId, offer, ice_servers } = await didResponse.json();
        streamId = newStreamId;
        sessionId = newSessionId;

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
                }).catch(e => console.error('ICE candidate error:', e));
            }
        };

        peerConnection.ontrack = (event) => {
            const mediaStream = event.streams[0];
            if (elements.hassanVideo.srcObject !== mediaStream) {
                elements.hassanVideo.srcObject = mediaStream;
                setTimeout(() => {
                    elements.hassanVideo.play().catch(e => console.error('Video play error:', e));
                }, 100);
            }
        };

        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'connected') {
                updateHassanStatus('Connected', 'text-green-500');
            } else if (peerConnection.iceConnectionState === 'failed') {
                updateHassanStatus('Connection Failed', 'text-red-500');
            } else {
                updateHassanStatus(peerConnection.iceConnectionState);
            }
        };

        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        await fetch(`http://127.0.0.1:5000/did_stream_sdp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stream_id: streamId,
                session_id: sessionId,
                answer: peerConnection.localDescription,
            }),
        });

        updateHassanStatus('Connected', 'text-green-500');
        console.log('D-ID connected successfully');
        return true;

    } catch (error) {
        console.error('D-ID connection error:', error);
        displayError(`Failed to connect to D-ID: ${error.message}`);
        updateHassanStatus('Connection Failed', 'text-red-500');
        
        elements.hassanPlaceholder.classList.remove('hidden');
        elements.hassanVideo.classList.add('hidden');
        elements.hassanStatus.classList.add('hidden');
        return false;
    }
}

async function enhancedSpeak(text) {
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
        displayError('D-ID not connected. Please refresh and try again.');
        return;
    }

    // ENHANCED: Stop speech recognition completely during AI speech
    isAISpeaking = true;
    updateInterviewStatus('AI is speaking...', 'ai-speaking');
    
    if (recognition) {
        try {
            recognition.stop();
            console.log('Stopped speech recognition for AI speech');
        } catch (e) {
            console.log('Speech recognition stop handled');
        }
    }

    // Clear any pending speech timeouts
    clearTimeout(speechTimeout);
    clearTimeout(voiceActivityTimeout);

    return talkDeferred = talkDeferred.then(async () => {
        try {
            console.log('D-ID speaking:', text.substring(0, 50) + '...');
            
            const talkResponse = await fetch(`http://127.0.0.1:5000/did_stream_talk`, {
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
                throw new Error(`D-ID speech failed: ${errorData.error}`);
            }

            // Improved speech duration calculation
            const wordCount = text.split(' ').length;
            const baseRate = 130; // words per minute (slightly slower)
            const estimatedDuration = (wordCount / baseRate) * 60 * 1000;
            const minDuration = 2000;
            const maxDuration = 15000; // Max 15 seconds
            const speechDuration = Math.min(Math.max(estimatedDuration, minDuration), maxDuration);

            console.log(`Speech duration: ${speechDuration}ms for ${wordCount} words`);

            // Hide loading immediately when speech starts
            showLoading(false);

            // Wait for speech to complete
            await new Promise(resolve => setTimeout(resolve, speechDuration));

        } catch (error) {
            console.error('D-ID speech error:', error);
            displayError(`Speech error: ${error.message}`);
        } finally {
            // ENHANCED: Improved post-speech state management
            setTimeout(() => {
                isAISpeaking = false;
                conversationState.lastAISpeechEnd = Date.now();
                
                // Only restart speech recognition if we're awaiting a response
                if (conversationState.awaitingResponse) {
                    updateInterviewStatus('Your turn - speak when ready', 'listening');
                    
                    // Give extra time before starting recognition
                    setTimeout(() => {
                        if (!isAISpeaking && window.startListening) {
                            window.startListening();
                        }
                    }, 1000); // 1 second extra delay
                } else {
                    updateInterviewStatus('Listening...', 'ready');
                }
            }, speechDetectionDelay);
        }
    });
}

async function destroyDIDStream() {
    if (!peerConnection || !streamId || !sessionId) return;
    
    try {
        await fetch(`http://127.0.0.1:5000/did_stream_destroy`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stream_id: streamId, session_id: sessionId }),
        });
    } catch (error) {
        console.error('Error destroying D-ID stream:', error);
    } finally {
        if (peerConnection) {
            peerConnection.close();
            peerConnection = null;
        }
        streamId = null;
        sessionId = null;
    }
}

// =============================================================================
// IMPROVED CONVERSATION FLOW
// =============================================================================

function getFollowUpIntroPhrase() {
    const phrases = [
        "That's interesting.",
        "I see.",
        "Thanks for sharing that.", 
        "Good point.",
        "I understand."
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

function getTransitionPhrase() {
    const phrases = [
        "Great! Let's move on to our next topic.",
        "Thank you for that response. Now, let's discuss another area.",
        "Excellent. I'd like to explore a different aspect with you.",
        "Perfect. Let's shift our focus to the next question.",
        "That was very insightful. Moving forward,"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

function getQuestionIntroPhrase() {
    const phrases = [
        "Here's my next question:",
        "I'd like to ask you about:",
        "Let's discuss:",
        "My next question for you is:",
        "I'm curious about:"
    ];
    return phrases[Math.floor(Math.random() * phrases.length)];
}

async function submitAnswer() {
    const userAnswer = elements.answerInput.value.trim();
    if (!userAnswer || userAnswer.length < 5) {
        updateInterviewStatus('Please speak a bit more...', 'listening');
        return;
    }

    // Improved state management
    updateInterviewStatus('Processing your answer...', 'processing');
    highlightTranscript(false);
    conversationState.awaitingResponse = false;
    
    // Clear all speech-related timeouts
    clearTimeout(speechTimeout);
    clearTimeout(voiceActivityTimeout);
    
    clearError();
    showLoading(true);

    try {
        const response = await fetch('http://127.0.0.1:5000/evaluate_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                question: currentQuestion,
                answer: userAnswer,
                question_index: currentQuestionIndex,
                follow_up_depth: conversationState.currentQuestionDepth,
                response_time_seconds: conversationState.responseStartTime ? 
                    Math.round((Date.now() - conversationState.responseStartTime) / 1000) : null
            }),
        });

        if (!response.ok) {
            throw new Error(`Evaluation failed: ${response.status}`);
        }

        const data = await response.json();
        const evaluation = data.evaluation;
        const needsFollowUp = data.needs_follow_up || false;
        const followUpQuestion = data.follow_up_question || null;

        elements.aiFeedback.textContent = evaluation;

        interviewHistory.push({
            question: currentQuestion,
            answer: userAnswer,
            feedback: evaluation,
            question_index: currentQuestionIndex,
            follow_up_depth: conversationState.currentQuestionDepth,
            timestamp: new Date().toISOString()
        });

        // Hide loading before speaking starts
        showLoading(false);
        
        await enhancedSpeak(evaluation);

        if (needsFollowUp && 
            followUpQuestion && 
            conversationState.currentQuestionDepth < conversationState.maxFollowUpDepth) {
            await handleFollowUpQuestion(followUpQuestion);
        } else {
            await handleQuestionTransition();
        }

    } catch (error) {
        showLoading(false);
        displayError(`Answer submission failed: ${error.message}`);
        console.error('Answer submission error:', error);
        updateInterviewStatus('Ready to continue...', 'ready');
        
        // Restart listening on error
        setTimeout(() => {
            if (window.startListening) {
                window.startListening();
            }
        }, 2000);
    }
}

async function handleFollowUpQuestion(followUpQuestion) {
    conversationState.phase = 'follow-up';
    conversationState.currentQuestionDepth++;
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const followUpIntro = getFollowUpIntroPhrase();
    const fullFollowUp = `${followUpIntro} ${followUpQuestion}`;
    
    currentQuestion = followUpQuestion;
    elements.questionDisplay.innerHTML = `
        <div class="text-sm text-blue-600 mb-2">Follow-up Question:</div>
        <div>${followUpQuestion}</div>
    `;
    
    await enhancedSpeak(fullFollowUp);
    prepareForUserResponse();
}

async function handleQuestionTransition() {
    conversationState.phase = 'transition';
    conversationState.currentQuestionDepth = 0;
    currentQuestionIndex++;
    
    if (currentQuestionIndex < interviewQuestions.length) {
        const transitionPhrase = getTransitionPhrase();
        await enhancedSpeak(transitionPhrase);
        
        await new Promise(resolve => setTimeout(resolve, 1500));
        await askNextMainQuestion();
    } else {
        await handleInterviewCompletion();
    }
}

async function askNextMainQuestion() {
    conversationState.phase = 'questioning';
    
    currentQuestion = interviewQuestions[currentQuestionIndex];
    elements.questionDisplay.innerHTML = `
        <div class="text-sm text-gray-500 mb-2">Question ${currentQuestionIndex + 1} of ${interviewQuestions.length}:</div>
        <div>${currentQuestion}</div>
    `;
    
    const questionIntro = getQuestionIntroPhrase();
    const fullQuestion = `${questionIntro} ${currentQuestion}`;
    
    await enhancedSpeak(fullQuestion);
    prepareForUserResponse();
}

function prepareForUserResponse() {
    conversationState.awaitingResponse = true;
    conversationState.responseStartTime = Date.now();
    
    elements.answerInput.value = '';
    highlightTranscript(true);
    
    // Reset speech state
    if (window.resetSpeechState) {
        window.resetSpeechState();
    }
    
    showFloatingControls();
}

async function handleInterviewCompletion() {
    conversationState.phase = 'complete';
    updateInterviewStatus('Interview complete!', 'processing');
    
    showLoading(true);
    
    try {
        const response = await fetch('http://127.0.0.1:5000/get_final_evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                history: interviewHistory,
                total_duration_minutes: Math.round((Date.now() - conversationState.questionStartTime) / 60000)
            }),
        });

        if (!response.ok) {
            throw new Error(`Final evaluation failed: ${response.status}`);
        }

        const data = await response.json();
        const finalEvaluation = data.final_evaluation;
        
        elements.questionDisplay.innerHTML = `
            <div class="text-2xl font-bold text-green-600 mb-4">🎉 Interview Complete!</div>
            <div class="text-gray-600">Thank you for completing the mock interview session.</div>
        `;
        
        elements.aiFeedback.innerHTML = `
            <div class="text-lg font-semibold mb-3">Final Evaluation:</div>
            <div>${finalEvaluation}</div>
        `;

        showLoading(false);
        
        const completionMessage = `Congratulations! You've completed the interview. Here's your final evaluation: ${finalEvaluation}`;
        await enhancedSpeak(completionMessage);

        showCompletionInterface();

    } catch (error) {
        showLoading(false);
        displayError(`Final evaluation failed: ${error.message}`);
        console.error('Final evaluation error:', error);
    }
}

function showCompletionInterface() {
    updateInterviewStatus('Session complete', 'ready');
    
    document.querySelector('.transcript-area').innerHTML = `
        <div class="text-center py-8">
            <div class="text-6xl mb-4">🌟</div>
            <h3 class="text-2xl font-bold text-gray-800 mb-4">Well Done!</h3>
            <p class="text-gray-600 mb-6">You've successfully completed your mock interview session.</p>
            <button onclick="window.location.reload()" 
                    class="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-bold py-3 px-8 rounded-xl transition duration-300 transform hover:scale-105">
                Start New Interview
            </button>
        </div>
    `;
    
    elements.floatingControls.innerHTML = `
        <button onclick="window.location.reload()" 
                class="control-button bg-blue-600 hover:bg-blue-700 text-white"
                title="New Interview">
            🔄
        </button>
    `;
}

// =============================================================================
// MAIN INTERVIEW LOGIC
// =============================================================================

async function startInterview() {
    const jobTitle = elements.jobTitleInput.value.trim();
    const company = elements.companyInput.value.trim();

    if (!jobTitle) {
        displayError('Please enter a job title to start the interview.');
        return;
    }

    clearError();
    showLoading(true);
    elements.startButton.disabled = true;

    try {
        conversationState.phase = 'introduction';
        conversationState.questionStartTime = Date.now();
        
        await initAudioContext();
        const didConnected = await connectToDID();
        if (!didConnected) {
            throw new Error("Could not establish D-ID connection.");
        }

        const response = await fetch('http://127.0.0.1:5000/get_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_title: jobTitle, company: company }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch questions: ${response.status}`);
        }

        const data = await response.json();
        interviewQuestions = data.questions;
        currentQuestionIndex = 0;
        interviewHistory = [];

        if (interviewQuestions && interviewQuestions.length > 0) {
            initEnhancedSpeechRecognition();

            elements.setupArea.classList.add('hidden');
            elements.interviewArea.classList.remove('hidden');
            showFloatingControls();

            updateInterviewStatus('Interview starting...', 'ai-speaking');
            
            const introText = `Hello! I'm your AI interviewer, and I'm excited to speak with you today. We'll be conducting a mock interview for the ${jobTitle} position${company ? ` at ${company}` : ''}. I'll ask you a few questions, and you can take your time to think about your responses. Speak naturally, and I'll provide feedback along the way. Are you ready to begin?`;
            
            showLoading(false); // Hide loading before first speech
            await enhancedSpeak(introText);
            
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            conversationState.phase = 'questioning';
            currentQuestion = interviewQuestions[currentQuestionIndex];
            elements.questionDisplay.innerHTML = `
                <div class="text-sm text-gray-500 mb-2">Question 1 of ${interviewQuestions.length}:</div>
                <div>${currentQuestion}</div>
            `;
            
            const firstQuestionText = `Let's start with our first question: ${currentQuestion}`;
            await enhancedSpeak(firstQuestionText);
            
            prepareForUserResponse();

        } else {
            displayError('Could not retrieve interview questions. Please try again.');
        }
    } catch (error) {
        displayError(`Interview start failed: ${error.message}`);
        console.error('Interview start error:', error);
    } finally {
        showLoading(false);
        elements.startButton.disabled = false;
    }
}

async function repeatQuestion() {
    if (currentQuestion) {
        updateInterviewStatus('Repeating question...', 'ai-speaking');
        const repeatPhrase = "Let me repeat the question for you:";
        await enhancedSpeak(`${repeatPhrase} ${currentQuestion}`);
        prepareForUserResponse();
    }
}

// =============================================================================
// EVENT LISTENERS & INITIALIZATION
// =============================================================================

function setupEventListeners() {
    elements.startButton.addEventListener('click', startInterview);
    elements.answerButton.addEventListener('click', submitAnswer);
    elements.repeatQuestionButton.addEventListener('click', repeatQuestion);
    window.addEventListener('beforeunload', destroyDIDStream);
}

function initApp() {
    console.log('🚀 Initializing Enhanced AI Mock Interview...');
    setupEventListeners();
    console.log('✅ Application initialized successfully!');
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

// Export for debugging
window.conversationState = conversationState;
window.enhancedSpeak = enhancedSpeak;
window.updateInterviewStatus = updateInterviewStatus;