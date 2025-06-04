// AI Mock Interview - Main JavaScript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// =============================================================================
// GLOBAL VARIABLES & STATE
// =============================================================================

// DOM Elements
const elements = {
    jobTitleInput: document.getElementById('jobTitleInput'),
    companyInput: document.getElementById('companyInput'),
    voiceSelect: document.getElementById('voiceSelect'),
    speechRate: document.getElementById('speechRate'),
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
    avatarCanvas: document.getElementById('avatar-canvas'),
    avatarStatus: document.getElementById('avatarStatus')
};

// Application State
let interviewQuestions = [];
let currentQuestionIndex = 0;
let allFeedback = [];
let currentQuestion = '';

// Three.js Variables
let scene, camera, renderer, controls, avatarModel, animationMixer;
let speakingAnimation, idleAnimation, currentAction;

// Facial Animation Variables (FIXED)
let facialMeshes = [];
let allMorphTargets = {};
let isSpeaking = false;
const clock = new THREE.Clock();

// Speech Variables
let recognition = null;
let isRecording = false;
const synth = window.speechSynthesis;
let selectedVoice = null;

// =============================================================================
// AVATAR & THREE.JS SYSTEM
// =============================================================================

function initThreeJS() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    
    const aspect = elements.avatarCanvas.clientWidth / elements.avatarCanvas.clientHeight;
    camera = new THREE.PerspectiveCamera(45, aspect, 0.1, 1000);
    camera.position.set(0, 1.65, 1.2);
    
    renderer = new THREE.WebGLRenderer({ 
        canvas: elements.avatarCanvas, 
        antialias: true 
    });
    renderer.setSize(elements.avatarCanvas.clientWidth, elements.avatarCanvas.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    
    controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 1.65, 0);
    controls.enableZoom = true;
    controls.enablePan = false;
    controls.maxPolarAngle = Math.PI / 1.5;
    controls.minDistance = 0.8;
    controls.maxDistance = 2.5;
    
    // Professional lighting setup
    const ambientLight = new THREE.AmbientLight(0x404040, 1.0);
    scene.add(ambientLight);
    
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.2);
    keyLight.position.set(1.5, 2.5, 2);
    keyLight.castShadow = true;
    scene.add(keyLight);
    
    const fillLight = new THREE.DirectionalLight(0xffffff, 0.6);
    fillLight.position.set(-1, 1.5, 1);
    scene.add(fillLight);
    
    const rimLight = new THREE.DirectionalLight(0x7c3aed, 0.4);
    rimLight.position.set(0, 2, -2);
    scene.add(rimLight);
    
    animate();
}

function loadAvatar() {
    updateAvatarStatus('loading', 'Loading avatar...');
    
    const avatarUrl = 'https://models.readyplayer.me/683efe096ef5e269d307e27e.glb?morphTargets=ARKit,Oculus%20Visemes';
    const gltfLoader = new GLTFLoader();
    
    gltfLoader.load(
        avatarUrl,
        (gltf) => {
            console.log('✅ Avatar loaded successfully!');
            avatarModel = gltf.scene;
            
            // Setup animations
            if (gltf.animations && gltf.animations.length) {
                animationMixer = new THREE.AnimationMixer(avatarModel);
                
                idleAnimation = gltf.animations.find(clip => 
                    clip.name.toLowerCase().includes('idle') || 
                    clip.name.toLowerCase().includes('breathing')
                );
                
                if (!idleAnimation && gltf.animations.length > 0) {
                    idleAnimation = gltf.animations[0];
                }
                
                if (idleAnimation) {
                    currentAction = animationMixer.clipAction(idleAnimation);
                    currentAction.play();
                }
            }
            
            // CRITICAL: Setup facial morphs with material fixes
            const morphCount = setupFacialMorphsFixed();
            positionAvatar();
            scene.add(avatarModel);
            
            if (morphCount > 10) {
                updateAvatarStatus('ready', `Avatar ready! ${morphCount} facial morphs available`);
            } else {
                updateAvatarStatus('ready', 'Avatar ready (fallback mode)');
                createFallbackAvatar();
            }
        },
        (progress) => {
            const percent = (progress.loaded / progress.total * 100);
            updateAvatarStatus('loading', `Loading avatar... ${percent.toFixed(0)}%`);
        },
        (error) => {
            console.error('Avatar loading error:', error);
            updateAvatarStatus('ready', 'Avatar ready (fallback mode)');
            createFallbackAvatar();
        }
    );
}

function setupFacialMorphsFixed() {
    facialMeshes = [];
    allMorphTargets = {};
    
    if (!avatarModel) return 0;
    
    console.log('🔍 Setting up facial morphs with material fixes...');
    
    avatarModel.traverse((child) => {
        if (child.isMesh && child.morphTargetDictionary && Object.keys(child.morphTargetDictionary).length > 0) {
            const morphs = Object.keys(child.morphTargetDictionary);
            console.log(`📍 Found facial mesh: ${child.name} with ${morphs.length} morphs`);
            
            // CRITICAL FIX: Enable morphTargets on the material
            if (child.material) {
                if (!child.material.morphTargets) {
                    child.material.morphTargets = true;
                    child.material.needsUpdate = true;
                    console.log(`✅ FIXED: Enabled morphTargets on material for ${child.name}`);
                }
                
                if (!child.material.morphNormals) {
                    child.material.morphNormals = true;
                    child.material.needsUpdate = true;
                }
            }
            
            // Initialize morph influences
            if (!child.morphTargetInfluences) {
                child.morphTargetInfluences = new Array(morphs.length).fill(0);
            }
            
            // Store mesh data
            facialMeshes.push({
                mesh: child,
                name: child.name,
                morphTargetDictionary: child.morphTargetDictionary,
                morphTargetInfluences: child.morphTargetInfluences
            });
            
            // Build global morph dictionary
            Object.keys(child.morphTargetDictionary).forEach(morphName => {
                if (!allMorphTargets[morphName]) {
                    allMorphTargets[morphName] = [];
                }
                allMorphTargets[morphName].push({
                    mesh: child,
                    index: child.morphTargetDictionary[morphName]
                });
            });
        }
    });
    
    const totalMorphs = Object.keys(allMorphTargets).length;
    console.log(`🎭 Total unique morphs found: ${totalMorphs}`);
    
    return totalMorphs;
}

function positionAvatar() {
    if (!avatarModel) return;
    
    const box = new THREE.Box3().setFromObject(avatarModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    
    const scaleFactor = 3.0 / size.y;
    avatarModel.scale.setScalar(scaleFactor);
    
    const headHeight = size.y * 0.15;
    avatarModel.position.set(0, -center.y * scaleFactor + headHeight, 0);
    
    avatarModel.traverse((child) => {
        if (child.isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
        }
    });
}

function createFallbackAvatar() {
    const group = new THREE.Group();
    
    // Create basic avatar components
    const headGeometry = new THREE.SphereGeometry(0.3, 32, 32);
    const headMaterial = new THREE.MeshLambertMaterial({ color: 0xfdbcb4 });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.y = 1.65;
    head.castShadow = true;
    group.add(head);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.06, 16, 16);
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0xffffff });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.12, 1.7, 0.25);
    leftEye.scale.z = 0.5;
    group.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.12, 1.7, 0.25);
    rightEye.scale.z = 0.5;
    group.add(rightEye);
    
    // Mouth
    const mouthGeometry = new THREE.CylinderGeometry(0.08, 0.08, 0.03, 16);
    const mouthMaterial = new THREE.MeshLambertMaterial({ color: 0xd2691e });
    const mouth = new THREE.Mesh(mouthGeometry, mouthMaterial);
    mouth.position.set(0, 1.55, 0.25);
    mouth.rotation.x = Math.PI / 2;
    group.add(mouth);
    
    group.userData = {
        mouth: mouth,
        leftEye: leftEye,
        rightEye: rightEye,
        originalMouthScale: mouth.scale.y
    };
    
    if (avatarModel) {
        scene.remove(avatarModel);
    }
    avatarModel = group;
    scene.add(avatarModel);
    
    console.log('🎭 Created fallback avatar');
}

function animate() {
    requestAnimationFrame(animate);
    
    const delta = clock.getDelta();
    
    if (controls) controls.update();
    if (animationMixer) animationMixer.update(delta);
    
    // Fallback avatar breathing
    if (avatarModel && avatarModel.userData && avatarModel.userData.mouth && !isSpeaking) {
        const time = Date.now() * 0.001;
        avatarModel.position.y += Math.sin(time) * 0.002;
    }
    
    renderer.render(scene, camera);
}

function updateAvatarStatus(status, message) {
    const indicator = elements.avatarStatus.querySelector('.status-indicator');
    indicator.className = `status-indicator status-${status}`;
    elements.avatarStatus.innerHTML = `<span class="status-indicator status-${status}"></span>${message}`;
}

// =============================================================================
// FACIAL ANIMATION SYSTEM (FIXED)
// =============================================================================

function setMorphTarget(morphName, value) {
    if (!allMorphTargets[morphName]) {
        return false;
    }
    
    allMorphTargets[morphName].forEach(target => {
        target.mesh.morphTargetInfluences[target.index] = Math.max(0, Math.min(1, value));
        
        // CRITICAL: Force geometry update
        if (target.mesh.geometry && target.mesh.geometry.attributes.position) {
            target.mesh.geometry.attributes.position.needsUpdate = true;
        }
    });
    
    return true;
}

function resetMorphTargets() {
    facialMeshes.forEach(facialMesh => {
        if (facialMesh.morphTargetInfluences) {
            for (let i = 0; i < facialMesh.morphTargetInfluences.length; i++) {
                facialMesh.morphTargetInfluences[i] = 0;
            }
            
            if (facialMesh.mesh.geometry && facialMesh.mesh.geometry.attributes.position) {
                facialMesh.mesh.geometry.attributes.position.needsUpdate = true;
            }
        }
    });
}

function startSpeakingAnimation() {
    if (!avatarModel) return;
    
    console.log('🎭 Starting speaking animation with facial morphs...');
    isSpeaking = true;
    animateRealisticSpeaking();
}

function stopSpeakingAnimation() {
    if (!avatarModel) return;
    
    console.log('🔇 Stopping speaking animation...');
    isSpeaking = false;
    resetMorphTargets();
}

function animateRealisticSpeaking() {
    if (!isSpeaking) return;
    
    const speakingMorphs = ['mouthOpen', 'jawOpen', 'mouthSmileLeft', 'mouthSmileRight', 'viseme_aa', 'viseme_E', 'viseme_O'];
    
    const interval = setInterval(() => {
        if (!isSpeaking) {
            clearInterval(interval);
            resetMorphTargets();
            return;
        }
        
        // Animate random mouth movements
        const morph = speakingMorphs[Math.floor(Math.random() * speakingMorphs.length)];
        const intensity = 0.2 + Math.random() * 0.6;
        const duration = 80 + Math.random() * 120;
        
        setMorphTarget(morph, intensity);
        
        setTimeout(() => {
            if (isSpeaking) {
                setMorphTarget(morph, 0);
            }
        }, duration);
        
    }, 120 + Math.random() * 100);
}

// Test function (exposed globally)
window.testFacialAnimation = function() {
    console.log('🧪 Testing facial animation...');
    
    setMorphTarget('mouthOpen', 1.0);
    setTimeout(() => setMorphTarget('mouthOpen', 0), 500);
    
    setTimeout(() => {
        setMorphTarget('mouthSmileLeft', 0.8);
        setMorphTarget('mouthSmileRight', 0.8);
    }, 600);
    
    setTimeout(() => {
        setMorphTarget('mouthSmileLeft', 0);
        setMorphTarget('mouthSmileRight', 0);
    }, 1200);
};

// =============================================================================
// SPEECH SYSTEM
// =============================================================================

function initSpeechRecognition() {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        elements.micButton.style.display = 'none';
        elements.speechStatus.textContent = 'Speech recognition not supported';
        return;
    }
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
        isRecording = true;
        elements.micButton.classList.add('recording');
        elements.micButton.classList.add('hidden');
        elements.stopMicButton.classList.remove('hidden');
        elements.speechStatus.textContent = 'Listening...';
    };
    
    recognition.onresult = (event) => {
        let finalTranscript = '';
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript + ' ';
            } else {
                interimTranscript += transcript;
            }
        }
        
        if (finalTranscript) {
            elements.answerInput.value += finalTranscript;
        }
        
        elements.speechStatus.textContent = interimTranscript ? `Hearing: "${interimTranscript}"` : 'Listening...';
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        elements.speechStatus.textContent = `Error: ${event.error}`;
        stopRecording();
    };
    
    recognition.onend = () => {
        stopRecording();
    };
}

function startRecording() {
    if (recognition && !isRecording) {
        recognition.start();
    }
}

function stopRecording() {
    if (recognition && isRecording) {
        recognition.stop();
    }
    
    isRecording = false;
    elements.micButton.classList.remove('recording');
    elements.micButton.classList.remove('hidden');
    elements.stopMicButton.classList.add('hidden');
    elements.speechStatus.textContent = '';
}

function populateVoiceList() {
    const voices = synth.getVoices();
    elements.voiceSelect.innerHTML = '<option value="">Default Voice</option>';
    
    voices.forEach((voice, index) => {
        if (voice.lang.startsWith('en')) {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            elements.voiceSelect.appendChild(option);
        }
    });
}

function speak(text, priority = false) {
    if (synth.speaking && !priority) {
        return;
    }
    
    if (priority) {
        synth.cancel();
    }
    
    const utterance = new SpeechSynthesisUtterance(text);
    
    if (selectedVoice) {
        utterance.voice = selectedVoice;
    }
    
    utterance.rate = parseFloat(elements.speechRate.value);
    utterance.pitch = 1;
    utterance.volume = 0.8;
    
    // Start facial animation when speech begins
    utterance.onstart = () => {
        console.log('🎙️ Speech started - beginning facial animation');
        startSpeakingAnimation();
    };
    
    // Stop facial animation when speech ends
    utterance.onend = () => {
        console.log('🎙️ Speech ended - stopping facial animation');
        stopSpeakingAnimation();
    };
    
    utterance.onerror = () => {
        console.log('🎙️ Speech error - stopping facial animation');
        stopSpeakingAnimation();
    };
    
    synth.speak(utterance);
}

// =============================================================================
// INTERVIEW LOGIC & API INTEGRATION
// =============================================================================

async function startInterview() {
    const jobTitle = elements.jobTitleInput.value.trim();
    const company = elements.companyInput.value.trim();

    if (!jobTitle || !company) {
        showError('Please enter both job title and company.');
        return;
    }

    // Reset state
    interviewQuestions = [];
    currentQuestionIndex = 0;
    allFeedback = [];
    currentQuestion = '';
    
    clearFeedback();
    showLoading(true);
    elements.interviewArea.classList.remove('hidden');

    try {
        console.log('Fetching questions from backend...');
        const response = await fetch('http://127.0.0.1:5000/get_questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ job_title: jobTitle, company: company }),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch questions`);
        }
        
        const data = await response.json();
        interviewQuestions = data.questions;
        
        if (!interviewQuestions || interviewQuestions.length === 0) {
            throw new Error('No questions received from the API');
        }
        
        console.log(`Received ${interviewQuestions.length} questions from backend`);
        showLoading(false);
        displayQuestion();
        
    } catch (error) {
        console.error('Error starting interview:', error);
        
        // Fallback to mock questions if API fails
        console.log('Falling back to mock questions...');
        showError(`Backend unavailable. Using sample questions. Error: ${error.message}`);
        
        interviewQuestions = [
            `Tell me about yourself and why you're interested in the ${jobTitle} position at ${company}.`,
            `What technical skills and experience make you a strong candidate for this role?`,
            `Describe a challenging project you've worked on. What obstacles did you face and how did you overcome them?`,
            `Why specifically do you want to work at ${company}? What attracts you to our company culture and mission?`,
            `Where do you see your career progressing in the next 5 years, and how does this role fit into those goals?`
        ];
        
        showLoading(false);
        displayQuestion();
    }
}

async function submitAnswer() {
    const answer = elements.answerInput.value.trim();
    if (!answer) {
        showError('Please provide an answer before submitting.');
        return;
    }

    elements.answerButton.disabled = true;
    elements.nextButton.classList.add('hidden');
    showFeedback('Evaluating your answer...', true);

    try {
        console.log('Submitting answer to backend...');
        const response = await fetch('http://127.0.0.1:5000/evaluate_answer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                question: currentQuestion, 
                answer: answer 
            }),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to evaluate answer`);
        }
        
        const data = await response.json();
        const feedback = data.evaluation;
        
        console.log('Received evaluation from backend');
        showFeedback(feedback);
        speak(feedback);
        
        allFeedback.push({ 
            question: currentQuestion, 
            answer: answer, 
            feedback: feedback 
        });
        
        elements.nextButton.classList.remove('hidden');
        
    } catch (error) {
        console.error('Error evaluating answer:', error);
        
        // Fallback to mock evaluation if API fails
        console.log('Falling back to mock evaluation...');
        showError(`Backend evaluation failed. Using sample feedback. Error: ${error.message}`);
        
        const mockFeedback = generateMockFeedback(answer);
        showFeedback(mockFeedback);
        speak(mockFeedback);
        
        allFeedback.push({ 
            question: currentQuestion, 
            answer: answer, 
            feedback: mockFeedback 
        });
        
        elements.nextButton.classList.remove('hidden');
        
    } finally {
        elements.answerButton.disabled = false;
    }
}

function nextQuestion() {
    currentQuestionIndex++;
    elements.answerInput.value = '';
    clearFeedback();
    elements.nextButton.classList.add('hidden');
    
    if (currentQuestionIndex < interviewQuestions.length) {
        displayQuestion();
    } else {
        finishInterview();
    }
}

function displayQuestion() {
    if (currentQuestionIndex < interviewQuestions.length) {
        currentQuestion = interviewQuestions[currentQuestionIndex];
        const questionText = `Question ${currentQuestionIndex + 1}: ${currentQuestion}`;
        
        elements.questionDisplay.textContent = questionText;
        speak(currentQuestion);
    }
}

function finishInterview() {
    elements.questionDisplay.textContent = 'Interview Complete! 🎉';
    elements.answerInput.classList.add('hidden');
    elements.answerButton.classList.add('hidden');
    elements.repeatQuestionButton.classList.add('hidden');
    
    speak('Congratulations! You have completed the interview. Generating your final evaluation...');
    getFinalEvaluation();
}

async function getFinalEvaluation() {
    showFeedback('Generating final evaluation...', true);
    
    try {
        console.log('Requesting final evaluation from backend...');
        const response = await fetch('http://127.0.0.1:5000/get_final_evaluation', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP ${response.status}: Failed to get final evaluation`);
        }
        
        const data = await response.json();
        const finalEval = data.final_evaluation;
        
        console.log('Received final evaluation from backend');
        showFeedback(finalEval);
        speak(finalEval);
        
    } catch (error) {
        console.error('Error getting final evaluation:', error);
        
        // Fallback to mock evaluation if API fails
        console.log('Falling back to mock final evaluation...');
        showError(`Backend final evaluation failed. Using sample evaluation. Error: ${error.message}`);
        
        const mockFinalEval = generateFinalEvaluation();
        showFeedback(mockFinalEval);
        speak(mockFinalEval);
    }
}

// =============================================================================
// HELPER FUNCTIONS & UI
// =============================================================================

function generateMockFeedback(answer) {
    const feedbacks = [
        "Excellent answer! You provided specific examples and demonstrated clear understanding. Consider adding more quantifiable results to strengthen your response.",
        "Good response! You covered the key points well. To improve, try to be more concise and focus on the most impactful aspects of your experience.",
        "Solid answer! Your enthusiasm comes through clearly. Consider providing more specific technical details to showcase your expertise.",
        "Strong response! You structured your answer well. Adding a brief example of measurable impact would make it even more compelling.",
        "Great job! You demonstrated good self-awareness. Consider connecting your answer more explicitly to the role requirements."
    ];
    return feedbacks[Math.floor(Math.random() * feedbacks.length)];
}

function generateFinalEvaluation() {
    return `Final Evaluation:\n\nOverall Performance: Strong\n\n✅ Strengths:\n• Clear communication style\n• Relevant experience highlighted\n• Good engagement with questions\n• Professional demeanor\n\n📈 Areas for Growth:\n• Provide more specific metrics and results\n• Practice the STAR method for behavioral questions\n• Research company-specific talking points\n\n🎯 Recommendation: You're well-prepared for interviews! Continue practicing with specific examples and quantifiable achievements to make your responses even more impactful.`;
}

function showLoading(show) {
    elements.loadingIndicator.classList.toggle('hidden', !show);
}

function showError(message) {
    elements.errorDisplay.textContent = message;
    elements.errorDisplay.classList.remove('hidden');
    setTimeout(() => {
        elements.errorDisplay.classList.add('hidden');
    }, 5000);
}

function showFeedback(message, isLoading = false) {
    elements.aiFeedback.textContent = message;
    elements.aiFeedback.style.fontStyle = isLoading ? 'italic' : 'normal';
}

function clearFeedback() {
    elements.aiFeedback.textContent = 'Your feedback will appear here...';
    elements.aiFeedback.style.fontStyle = 'italic';
}

function onWindowResize() {
    const width = elements.avatarCanvas.clientWidth;
    const height = elements.avatarCanvas.clientHeight;
    
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
}

// =============================================================================
// EVENT LISTENERS & INITIALIZATION
// =============================================================================

function setupEventListeners() {
    // Voice selection
    elements.voiceSelect.addEventListener('change', (e) => {
        const voices = synth.getVoices();
        selectedVoice = e.target.value ? voices[e.target.value] : null;
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
            speak(currentQuestion, true);
        }
    });

    // Window resize
    window.addEventListener('resize', onWindowResize);
    
    // Voice list population
    if (synth.onvoiceschanged !== undefined) {
        synth.onvoiceschanged = populateVoiceList;
    }
}

function initApp() {
    console.log('🚀 Initializing AI Mock Interview Application...');
    
    initThreeJS();
    initSpeechRecognition();
    populateVoiceList();
    loadAvatar();
    setupEventListeners();
    
    console.log('✅ Application initialized successfully!');
}

// Initialize the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}

