// AI Mock Interview with Hassan - Complete D-ID Integration
// No Ready Player Me - Pure D-ID Implementation

// =============================================================================
// GLOBAL VARIABLES & STATE
// =============================================================================

// DOM Elements
const elements = {
    jobTitleInput: document.getElementById('jobTitleInput'),
    companyInput: document.getElementById('companyInput'),
    // Removed voiceSelect as D-ID handles voice internally for its streams
    speechRate: document.getElementById('speechRate'),
    speechRateValue: document.getElementById('speechRateValue'), // Added for speech rate display
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
    hassanVideo: document.getElementById('hassanVideo'), // D-ID video element
    hassanStatus: document.getElementById('hassanStatus'), // D-ID status element
    hassanPlaceholder: document.getElementById('hassanPlaceholder'), // D-ID placeholder
    setupArea: document.getElementById('setupArea') // Added to hide setup area
};

// Interview State
let interviewQuestions = [];
let currentQuestionIndex = 0;
let currentQuestion = '';
let interviewHistory = []; // To store question, answer, feedback for final evaluation

// Speech Recognition
let recognition;
let isRecording = false;
// Removed synth and selectedVoice as D-ID handles speech synthesis

// D-ID Streaming API Variables
let peerConnection;
let streamId;
let sessionId;
let talkDeferred = Promise.resolve(); // Use a deferred promise to chain speech calls

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Displays a message in the error display area.
 * @param {string} message - The error message to display.
 */
function displayError(message) {
    elements.errorDisplay.textContent = message;
    elements.errorDisplay.classList.remove('hidden');
    console.error('Error:', message);
}

/**
 * Clears any displayed error messages.
 */
function clearError() {
    elements.errorDisplay.textContent = '';
    elements.errorDisplay.classList.add('hidden');
}

/**
 * Shows/hides the loading indicator.
 * @param {boolean} show - True to show, false to hide.
 */
function showLoading(show) {
    elements.loadingIndicator.classList.toggle('hidden', !show);
}

/**
 * Updates the D-ID connection status display.
 * @param {string} status - The status message.
 * @param {string} color - Tailwind CSS color class (e.g., 'text-green-500').
 */
function updateHassanStatus(status, color = 'text-white') {
    elements.hassanStatus.textContent = status;
    elements.hassanStatus.className = `absolute bottom-2 left-2 bg-black bg-opacity-50 ${color} text-xs px-2 py-1 rounded-md`;
    elements.hassanStatus.classList.remove('hidden'); // Ensure status is visible when updated
}

// =============================================================================
// D-ID INTEGRATION (WebRTC Streaming - Proxying via Backend)
// =============================================================================

/**
 * Connects to the D-ID streaming API via WebRTC, proxied through backend.
 */
async function connectToDID() {
    updateHassanStatus('Connecting...');
    clearError();

    // Hide placeholder and show video/status elements
    elements.hassanPlaceholder.classList.add('hidden');
    elements.hassanVideo.classList.remove('hidden');
    elements.hassanStatus.classList.remove('hidden');

    // Add video event listeners for debugging
    elements.hassanVideo.addEventListener('loadedmetadata', () => {
        console.log('Video Event: loadedmetadata - Video dimensions:', elements.hassanVideo.videoWidth, 'x', elements.hassanVideo.videoHeight);
    });
    elements.hassanVideo.addEventListener('canplay', () => {
        console.log('Video Event: canplay - Video is ready to play through to the end.');
    });
    elements.hassanVideo.addEventListener('playing', () => {
        console.log('Video Event: playing - Video has started playing.');
        // --- NEW: Unmute the video once it starts playing ---
        if (elements.hassanVideo.muted) {
            elements.hassanVideo.muted = false;
            console.log('Video has been unmuted.');
        }
        // --- END NEW ---
    });
    elements.hassanVideo.addEventListener('error', (e) => {
        console.error('Video Event: error - Video playback error:', e);
        if (elements.hassanVideo.error) {
            console.error('Video Error Code:', elements.hassanVideo.error.code);
            console.error('Video Error Message:', elements.hassanVideo.error.message);
        }
    });


    if (peerConnection && peerConnection.connectionState === 'connected') {
        console.log('D-ID already connected.');
        updateHassanStatus('Connected', 'text-green-500');
        return true;
    }

    try {
        // Step 1: Create D-ID stream via backend proxy
        const didResponse = await fetch('http://127.0.0.1:5000/create_did_stream', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                source_url: 'https://d-id-public-bucket.s3.us-west-2.amazonaws.com/alice.jpg', 
            }),
        });

        if (!didResponse.ok) {
            const errorData = await didResponse.json();
            throw new Error(`Failed to create D-ID stream via backend: ${didResponse.status} - ${errorData.error || didResponse.statusText}`);
        }

        const { id: newStreamId, session_id: newSessionId, offer, ice_servers } = await didResponse.json();
        streamId = newStreamId;
        sessionId = newSessionId;

        console.log('D-ID Stream Created. Stream ID:', streamId);
        console.log('D-ID Session ID received:', sessionId);
        console.log('D-ID ICE Servers received:', ice_servers); // Log received ICE servers

        // Use the ICE servers provided by D-ID
        peerConnection = new RTCPeerConnection({
            iceServers: ice_servers, 
        });

        // Step 2: Handle ICE candidates and send via backend proxy
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
                }).catch(e => console.error('Error sending ICE candidate via backend:', e));
            }
        };

        // Step 3: Handle incoming video/audio tracks
        peerConnection.ontrack = (event) => {
            console.log('RTCPeerConnection ontrack event received:', event); // Log ontrack event
            const mediaStream = event.streams[0];

            // --- NEW LOGGING FOR STREAM CONTENTS ---
            console.log('MediaStream received:', mediaStream);
            console.log('MediaStream ID:', mediaStream.id);
            console.log('MediaStream active:', mediaStream.active);
            console.log('MediaStream video tracks:', mediaStream.getVideoTracks());
            console.log('MediaStream audio tracks:', mediaStream.getAudioTracks());
            // --- END NEW LOGGING ---

            if (elements.hassanVideo.srcObject !== mediaStream) {
                elements.hassanVideo.srcObject = mediaStream;
                // Add a small delay before playing to ensure browser has processed srcObject
                setTimeout(() => {
                    elements.hassanVideo.play().catch(e => console.error('Error playing video:', e));
                    console.log('Video stream attached and play attempted. Video element readyState:', elements.hassanVideo.readyState); 
                    console.log('Video element dimensions (offsetWidth x offsetHeight):', elements.hassanVideo.offsetWidth, 'x', elements.hassanVideo.offsetHeight);
                }, 100); // 100ms delay
            }
        };

        // Step 4: Monitor ICE connection state
        peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed' || peerConnection.iceConnectionState === 'disconnected') {
                updateHassanStatus('Disconnected', 'text-red-500');
                console.error('D-ID connection failed or disconnected.');
                // Optionally try to reconnect here
            } else if (peerConnection.iceConnectionState === 'connected') {
                updateHassanStatus('Connected', 'text-green-500');
            } else {
                updateHassanStatus(peerConnection.iceConnectionState);
            }
        };

        // Step 5: Set remote description and create answer
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        // Step 6: Send SDP answer via backend proxy
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
        console.log('D-ID stream connected successfully!');
        return true;

    } catch (error) {
        console.error('D-ID connection error:', error);
        displayError(`Failed to connect to D-ID: ${error.message}`);
        updateHassanStatus('Connection Failed', 'text-red-500');
        // Revert visibility if connection fails
        elements.hassanPlaceholder.classList.remove('hidden');
        elements.hassanVideo.classList.add('hidden');
        elements.hassanStatus.classList.add('hidden');
        return false;
    }
}

/**
 * Sends text to D-ID for speaking via backend proxy and plays the generated video.
 * @param {string} text - The text for D-ID to speak.
 */
async function speak(text) {
    if (!peerConnection || peerConnection.connectionState !== 'connected') {
        displayError('D-ID not connected. Please refresh or check API key.');
        return;
    }

    // Chain speech calls to ensure they play sequentially
    talkDeferred = talkDeferred.then(async () => {
        try {
            console.log('Sending text to D-ID via backend:', text);
            showLoading(true); // Show loading while D-ID processes

            const talkResponse = await fetch(`http://127.0.0.1:5000/did_stream_talk`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stream_id: streamId,
                    session_id: sessionId,
                    text: text, // Send the text to speak
                    // You can add voice customization here if your backend supports it,
                    // e.g., 'voice_id': 'en-US-JennyNeural'
                }),
            });

            if (!talkResponse.ok) {
                const errorData = await talkResponse.json();
                throw new Error(`Failed to send text to D-ID via backend: ${talkResponse.status} - ${errorData.error || talkResponse.statusText}`);
            }

            const talkData = await talkResponse.json();
            console.log('D-ID Talk initiated:', talkData);

            // D-ID will send video frames via WebRTC to elements.hassanVideo.srcObject
            // We just need to ensure the video is playing.
            if (elements.hassanVideo.paused) {
                await elements.hassanVideo.play().catch(e => console.error('Error playing video after talk:', e));
            }

        } catch (error) {
            console.error('Error speaking with D-ID:', error);
            displayError(`D-ID speech error: ${error.message}`);
        } finally {
            showLoading(false); // Hide loading after D-ID processes
        }
    }).catch(e => {
        console.error("Previous D-ID speech failed, chaining next:", e);
        showLoading(false);
    });
}

/**
 * Stops the current D-ID talk via backend proxy.
 */
async function stopSpeaking() {
    if (!peerConnection || peerConnection.connectionState !== 'connected' || !sessionId || !streamId) {
        return;
    }
    try {
        await fetch(`http://127.0.0.1:5000/did_stream_stop`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stream_id: streamId,
                session_id: sessionId,
            }),
        });
        console.log('D-ID talk stopped.');
    } catch (error) {
        console.error('Error stopping D-ID talk via backend:', error);
    }
}

/**
 * Destroys the D-ID streaming session via backend proxy.
 */
async function destroyDIDStream() {
    if (!peerConnection || !streamId || !sessionId) {
        return;
    }
    console.log('Attempting to destroy D-ID stream...');
    try {
        await fetch(`http://127.0.0.1:5000/did_stream_destroy`, {
            method: 'POST', // Changed from DELETE to POST for consistency with Flask's request.get_json()
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stream_id: streamId,
                session_id: sessionId,
            }),
        });
        console.log('D-ID stream destroyed successfully.');
    } catch (error) {
        console.error('Error destroying D-ID stream via backend:', error);
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
// SPEECH RECOGNITION
// =============================================================================

/**
 * Initializes the Web Speech Recognition API.
 */
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        displayError('Speech Recognition not supported in this browser. Please use Chrome or Edge.');
        elements.micButton.disabled = true;
        return;
    }

    recognition = new SpeechRecognition();
    recognition.continuous = false; // Listen for a single utterance
    recognition.interimResults = false; // Only return final results
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        isRecording = true;
        elements.speechStatus.textContent = 'Listening...';
        elements.micButton.classList.add('hidden');
        elements.stopMicButton.classList.remove('hidden');
        elements.answerInput.placeholder = 'Speak your answer...';
    };

    recognition.onresult = (event) => {
        const speechResult = event.results[0][0].transcript;
        elements.answerInput.value = speechResult;
        elements.speechStatus.textContent = 'Processing...';
        stopRecording(); // Automatically stop after result
        submitAnswer(); // Automatically submit the answer
    };

    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        elements.speechStatus.textContent = `Error: ${event.error}`;
        displayError(`Speech recognition error: ${event.error}`);
        stopRecording();
    };

    recognition.onend = () => {
        isRecording = false;
        elements.speechStatus.textContent = 'Idle';
        elements.micButton.classList.remove('hidden');
        elements.stopMicButton.classList.add('hidden');
        elements.answerInput.placeholder = 'Type your answer here or use the microphone...';
    };
}

/**
 * Starts speech recognition.
 */
function startRecording() {
    if (recognition && !isRecording) {
        clearError();
        recognition.start();
    }
}

/**
 * Stops speech recognition.
 */
function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
}

// =============================================================================
// INTERVIEW LOGIC
// =============================================================================

/**
 * Starts the mock interview.
 */
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
        // Connect to D-ID first
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
            const errorData = await response.json();
            throw new Error(`Failed to fetch questions: ${response.status} - ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        interviewQuestions = data.questions;
        currentQuestionIndex = 0;
        interviewHistory = []; // Reset history for new interview

        if (interviewQuestions && interviewQuestions.length > 0) {
            currentQuestion = interviewQuestions[currentQuestionIndex];
            elements.questionDisplay.textContent = currentQuestion;

            // Speak the introduction and first question using D-ID
            const introText = `Hello! I'm your AI interviewer. Let's begin your interview for the ${jobTitle} role at ${company || 'your target company'}. Your first question is: ${currentQuestion}`;
            await speak(introText);

            elements.setupArea.classList.add('hidden');
            elements.interviewArea.classList.remove('hidden');
            elements.answerInput.value = '';
            elements.aiFeedback.textContent = 'Your feedback will appear here...';
            elements.nextButton.classList.add('hidden');
            elements.answerButton.classList.remove('hidden');
        } else {
            displayError('Could not retrieve interview questions. Please try again.');
        }
    } catch (error) {
        displayError(`Interview start failed: ${error.message}`);
        console.error('Interview start error:', error);
        // Ensure elements are shown if connection fails
        elements.hassanPlaceholder.classList.remove('hidden');
        elements.hassanVideo.classList.add('hidden');
        elements.hassanStatus.classList.add('hidden');
    } finally {
        showLoading(false);
        elements.startButton.disabled = false;
    }
}

/**
 * Submits the user's answer for evaluation.
 */
async function submitAnswer() {
    const userAnswer = elements.answerInput.value.trim();
    if (!userAnswer) {
        displayError('Please provide an answer before submitting.');
        return;
    }

    clearError();
    showLoading(true);
    elements.answerButton.disabled = true;
    elements.micButton.disabled = true;
    elements.stopMicButton.disabled = true;

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
            throw new Error(`Failed to evaluate answer: ${response.status} - ${errorData.error || response.statusText}`);
        }

        const data = await response.json();
        const feedback = data.evaluation;
        elements.aiFeedback.textContent = feedback;

        // Store this turn in history
        interviewHistory.push({
            question: currentQuestion,
            answer: userAnswer,
            feedback: feedback
        });

        // Speak the feedback using D-ID
        await speak(feedback);

        elements.nextButton.classList.remove('hidden');
        elements.answerButton.classList.add('hidden');

    } catch (error) {
        displayError(`Answer submission failed: ${error.message}`);
        console.error('Answer submission error:', error);
    } finally {
        showLoading(false);
        elements.answerButton.disabled = false;
        elements.micButton.disabled = false;
        elements.stopMicButton.disabled = false;
    }
}

/**
 * Moves to the next question or ends the interview.
 */
async function nextQuestion() {
    currentQuestionIndex++;
    elements.answerInput.value = '';
    elements.aiFeedback.textContent = 'Your feedback will appear here...';
    elements.nextButton.classList.add('hidden');
    elements.answerButton.classList.remove('hidden');
    clearError();

    if (currentQuestionIndex < interviewQuestions.length) {
        currentQuestion = interviewQuestions[currentQuestionIndex];
        elements.questionDisplay.textContent = currentQuestion;
        await speak(currentQuestion); // Speak the next question
    } else {
        // End of interview, get final evaluation
        showLoading(true);
        try {
            const response = await fetch('http://127.0.0.1:5000/get_final_evaluation', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history: interviewHistory }), // Pass history to backend
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`Failed to get final evaluation: ${response.status} - ${errorData.error || response.statusText}`);
            }

            const data = await response.json();
            const finalEvaluation = data.final_evaluation;
            elements.questionDisplay.textContent = "Interview Complete!";
            elements.aiFeedback.textContent = finalEvaluation;

            // Speak the final evaluation
            await speak("Interview complete! Here is your final evaluation: " + finalEvaluation);

            // Hide input and show restart option or summary
            elements.answerInput.classList.add('hidden');
            elements.micButton.classList.add('hidden');
            elements.stopMicButton.classList.add('hidden');
            elements.answerButton.classList.add('hidden');
            elements.repeatQuestionButton.classList.add('hidden');
            elements.nextButton.textContent = "Start New Interview";
            elements.nextButton.classList.remove('hidden'); // Use next button to restart
            elements.nextButton.onclick = () => window.location.reload(); // Reload to restart
        } catch (error) {
            displayError(`Final evaluation failed: ${error.message}`);
            console.error('Final evaluation error:', error);
        } finally {
            showLoading(false);
        }
    }
}

// =============================================================================
// EVENT LISTENERS & INITIALIZATION
// =============================================================================

function setupEventListeners() {
    // Speech rate display
    elements.speechRate.addEventListener('input', (e) => {
        elements.speechRateValue.textContent = e.target.value;
    });

    // Speech recognition
    elements.micButton.addEventListener('click', startRecording);
    elements.stopMicButton.addEventListener('click', stopRecording);

    // Interview controls
    elements.startButton.addEventListener('click', startInterview);
    elements.answerButton.addEventListener('click', submitAnswer);
    elements.nextButton.addEventListener('click', nextQuestion);
    elements.repeatQuestionButton.addEventListener('click', () => {
        if (currentQuestion) {
            speak(currentQuestion);
        }
    });

    // Ensure D-ID stream is destroyed on page unload
    window.addEventListener('beforeunload', destroyDIDStream);
}

function initApp() {
    console.log('🚀 Initializing AI Mock Interview Application...');
    
    initSpeechRecognition();
    setupEventListeners();
    
    console.log('✅ Application initialized successfully!');
}

// Initialize the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
